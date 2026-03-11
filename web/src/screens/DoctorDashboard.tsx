import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Button, 
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Divider,
  Card,
  CardContent,
  Tabs,
  Tab
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MedicationIcon from '@mui/icons-material/Medication';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { db } from "../firebase";
import { subscribeToQueue, updateQueueStatus, callNextPatient } from '../services/queueService';
import { 
  getLatestEncounter, 
  saveConsultation, 
  getVitalsByEncounter,
  getEncounterById,
  updateEncounterStatus
} from '../services/encounterService';
import { getTriageAssessmentByEncounter } from '../services/triageService';
import { updateQueueMetric } from '../services/queueMetricsService';
import { getPatientById } from '../services/patientService';
import { QueueItem, Encounter, Patient, Prescription, VitalsRecord, TriageAssessment } from '../types';
import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import PrescriptionForm from '../components/PrescriptionForm';
import PatientAllergies from '../components/PatientAllergies';
import { auth } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { checkPrescriptionSafety } from '../services/medicationSafetyService';
import { SafetyAlert } from '../types';

interface DoctorDashboardProps {
  countryId: string;
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ countryId }) => {
  const { notify, selectedCountry, selectedClinic } = useAppStore();
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentVitals, setCurrentVitals] = useState<VitalsRecord | null>(null);
  const [currentTriage, setCurrentTriage] = useState<TriageAssessment | null>(null);
  const [openConsultDialog, setOpenConsultDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Consultation Form State
  const [consultData, setConsultData] = useState({
    chiefComplaint: '',
    diagnosis: '',
    notes: '',
    prescriptions: [] as Prescription[]
  });

  const [consultationCount, setConsultationCount] = useState(0);

  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([]);
  const [openSafetyDialog, setOpenSafetyDialog] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState('');

  useEffect(() => {
    const fetchConsultationCount = async () => {
      try {
        if (!selectedCountry || !selectedClinic) return;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const q = query(
          collection(db, "diagnoses"),
          where("country_code", "==", selectedCountry.id),
          where("clinic_id", "==", selectedClinic.id),
          where("created_at", ">=", startOfDay)
        );
        const snapshot = await getDocs(q);
        setConsultationCount(snapshot.size);
      } catch (err) {
        console.error("Error fetching consultation count:", err);
      }
    };
    fetchConsultationCount();
  }, [selectedCountry, selectedClinic]);

  useEffect(() => {
    const unsubscribe = subscribeToQueue(['READY_FOR_DOCTOR', 'IN_CONSULTATION'] as any, (items) => {
      setWaitingList(items);
    });
    return () => unsubscribe();
  }, []);

  const handleCallNextPatient = async () => {
    const readyPatients = waitingList.filter(p => p.status === 'READY_FOR_DOCTOR');
    if (readyPatients.length === 0) {
      notify("No patients waiting for consultation.", "info");
      return;
    }
    
    const nextPatient = readyPatients[0];
    
    try {
      await handleOpenConsult(nextPatient);
      notify(`Called next patient: ${nextPatient.patient_name || nextPatient.patient_id}`, 'success');
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to call next patient.");
      notify("Failed to call next patient", "error");
    }
  };

  const handleOpenConsult = async (item: QueueItem) => {
    setSelectedItem(item);
    try {
      const uid = auth.currentUser?.uid || 'unknown';
      if (item.status === 'READY_FOR_DOCTOR') {
        await callNextPatient(item.id!, uid);
        await updateEncounterStatus(item.encounter_id, 'IN_CONSULTATION');
        await updateQueueMetric(item.clinic_id, {
          ready_for_doctor: -1,
          in_consultation: 1
        });
      }

      const [patient, encounter, vitals, triage] = await Promise.all([
        getPatientById(item.patient_id),
        getEncounterById(item.encounter_id),
        getVitalsByEncounter(item.encounter_id),
        getTriageAssessmentByEncounter(item.encounter_id)
      ]);
      setCurrentPatient(patient);
      setCurrentEncounter(encounter);
      setCurrentVitals(vitals);
      setCurrentTriage(triage);
      setOpenConsultDialog(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load patient data.");
    }
  };

  const handleSaveConsult = async () => {
    if (!selectedItem) return;
    
    if (consultData.prescriptions.length > 0) {
      const alerts = await checkPrescriptionSafety(selectedItem.patient_id, consultData.prescriptions);
      if (alerts.length > 0) {
        setSafetyAlerts(alerts);
        setOpenSafetyDialog(true);
        return;
      }
    }
    
    await executeSaveConsult();
  };

  const executeSaveConsult = async () => {
    if (!selectedItem) return;
    try {
      const uid = auth.currentUser?.uid || 'unknown';
      
      // If there's an override justification, we could append it to notes or save it elsewhere.
      const finalNotes = overrideJustification 
        ? `${consultData.notes}\n\n[Safety Override Justification]: ${overrideJustification}`
        : consultData.notes;

      const hasPrescriptions = consultData.prescriptions.length > 0;
      await saveConsultation(
        {
          encounter_id: selectedItem.encounter_id,
          patient_id: selectedItem.patient_id,
          chief_complaint: consultData.chiefComplaint,
          diagnosis: consultData.diagnosis,
          notes: finalNotes,
          created_by: uid
        },
        hasPrescriptions ? {
          encounter_id: selectedItem.encounter_id,
          patient_id: selectedItem.patient_id,
          prescriptions: consultData.prescriptions,
          created_by: uid
        } : undefined
      );

      const nextStatus = hasPrescriptions ? 'WAITING_FOR_PHARMACY' : 'COMPLETED';
      await updateQueueStatus(selectedItem.id!, nextStatus as any);
      
      // Refresh count
      if (selectedCountry && selectedClinic) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const q = query(
          collection(db, "diagnoses"), 
          where("country_code", "==", selectedCountry.id),
          where("clinic_id", "==", selectedClinic.id),
          where("created_at", ">=", startOfDay)
        );
        const snapshot = await getDocs(q);
        setConsultationCount(snapshot.size);
      }

      notify(`Consultation completed for ${currentPatient?.first_name}`, 'success');
      setOpenConsultDialog(false);
      setOpenSafetyDialog(false);
      setOverrideJustification('');
      setSelectedItem(null);
      setConsultData({ chiefComplaint: '', diagnosis: '', notes: '', prescriptions: [] });
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to save consultation.");
      notify("Failed to save consultation", "error");
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight="800" color="primary" gutterBottom>
            Doctor Consultation
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Manage patient consultations and prescriptions.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" color="primary" onClick={handleCallNextPatient} disabled={waitingList.length === 0} size="large" sx={{ fontWeight: 700, borderRadius: 2 }}>
            Call Next Patient
          </Button>
          <Button variant="outlined" component={Link} to="/queue" startIcon={<AssignmentIcon />} sx={{ borderRadius: 2 }}>
            View Queue Board
          </Button>
        </Box>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 9 }}>
          <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <AssignmentIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="700">Patients Ready for Consultation</Typography>
              </Box>
              
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Patient Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Wait Time</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {waitingList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography color="textSecondary" sx={{ py: 4 }}>No patients waiting for consultation.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      waitingList.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_name || item.patient_id}</TableCell>
                          <TableCell>{item.created_at ? Math.floor((Date.now() - item.created_at.toDate().getTime()) / 60000) : '??'} mins</TableCell>
                          <TableCell>
                            <Chip 
                              label={item.triage_level?.toUpperCase() || 'STANDARD'} 
                              size="small" 
                              color={
                                item.triage_level === 'emergency' ? 'error' :
                                item.triage_level === 'urgent' ? 'warning' :
                                item.triage_level === 'low' ? 'success' : 'default'
                              }
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button 
                              variant={item.status === 'IN_CONSULTATION' ? "outlined" : "contained"} 
                              color={item.status === 'IN_CONSULTATION' ? "secondary" : "primary"}
                              size="small" 
                              onClick={() => handleOpenConsult(item)}
                            >
                              {item.status === 'IN_CONSULTATION' ? 'Resume' : 'Start'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'primary.dark', color: 'white' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: 'bold' }}>Consultations Today</Typography>
              <Typography variant="h3" fontWeight="800">{consultationCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Consultation Dialog */}
      <Dialog open={openConsultDialog} onClose={() => setOpenConsultDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: '800', bgcolor: '#f8f9fa', borderBottom: '1px solid', borderColor: 'divider' }}>
          Consultation: {currentPatient ? `${currentPatient.first_name} ${currentPatient.last_name}` : 'Loading...'}
          <Typography variant="caption" display="block" color="textSecondary">
            {currentPatient?.gender}, {currentPatient?.date_of_birth}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {currentTriage && currentTriage.allergies.length > 0 && (
            <Alert severity="error" sx={{ borderRadius: 0 }}>
              <Typography variant="subtitle2" fontWeight="bold">ALLERGY WARNING: {currentTriage.allergies.join(', ')}</Typography>
            </Alert>
          )}
          <Grid container sx={{ height: '70vh' }}>
            {/* Left Panel: Vitals & History */}
            <Grid size={{ xs: 12, md: 4 }} sx={{ borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto', p: 3, bgcolor: 'grey.50' }}>
              <Box mb={4}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'primary.main' }}>Current Vitals</Typography>
                {currentVitals ? (
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 6 }}><Paper variant="outlined" sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="caption" color="textSecondary">BP</Typography><Typography variant="body2" fontWeight="bold">{currentVitals.systolic}/{currentVitals.diastolic}</Typography></Paper></Grid>
                    <Grid size={{ xs: 6 }}><Paper variant="outlined" sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="caption" color="textSecondary">HR</Typography><Typography variant="body2" fontWeight="bold">{currentVitals.heartRate} bpm</Typography></Paper></Grid>
                    <Grid size={{ xs: 6 }}><Paper variant="outlined" sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="caption" color="textSecondary">Temp</Typography><Typography variant="body2" fontWeight="bold">{currentVitals.temperature}°C</Typography></Paper></Grid>
                    <Grid size={{ xs: 6 }}><Paper variant="outlined" sx={{ p: 1, textAlign: 'center', borderRadius: 2 }}><Typography variant="caption" color="textSecondary">BMI</Typography><Typography variant="body2" fontWeight="bold">{currentVitals.bmi}</Typography></Paper></Grid>
                  </Grid>
                ) : <Typography variant="caption">No vitals recorded.</Typography>}
              </Box>
              
              <Box mb={4}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'primary.main' }}>Patient Safety & Background</Typography>
                {currentTriage ? (
                  <Box>
                    <Typography variant="body2"><strong>Tobacco:</strong> {currentTriage.tobacco_use}</Typography>
                    <Typography variant="body2"><strong>Alcohol:</strong> {currentTriage.alcohol_use}</Typography>
                    <Typography variant="body2"><strong>Diseases:</strong> {currentTriage.chronic_diseases.join(', ')}</Typography>
                    <Typography variant="body2"><strong>Pregnancy:</strong> {currentTriage.pregnancy_status}</Typography>
                    <Typography variant="body2"><strong>Notes:</strong> {currentTriage.triage_notes}</Typography>
                  </Box>
                ) : <Typography variant="caption">No triage assessment recorded.</Typography>}
              </Box>

              <Box mb={4}>
                {currentPatient && <PatientAllergies patientId={currentPatient.id!} />}
              </Box>
              
              <Box>
                <Box display="flex" alignItems="center" mb={1}>
                  <HistoryIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight="bold">Patient History</Typography>
                </Box>
                {currentPatient && <PatientHistoryTimeline patientId={currentPatient.id!} />}
              </Box>
            </Grid>

            {/* Right Panel: Consultation Form */}
            <Grid size={{ xs: 12, md: 8 }} sx={{ overflowY: 'auto', p: 4 }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Tab label="Assessment" icon={<AssignmentIcon />} iconPosition="start" sx={{ fontWeight: 700 }} />
                <Tab label="Prescription" icon={<MedicationIcon />} iconPosition="start" sx={{ fontWeight: 700 }} />
              </Tabs>

              {tabValue === 0 && (
                <Box>
                  <TextField fullWidth label="Chief Complaint" multiline rows={2} variant="outlined" sx={{ mb: 3 }} value={consultData.chiefComplaint} onChange={(e) => setConsultData({ ...consultData, chiefComplaint: e.target.value })} />
                  <TextField fullWidth label="Diagnosis" variant="outlined" sx={{ mb: 3 }} value={consultData.diagnosis} onChange={(e) => setConsultData({ ...consultData, diagnosis: e.target.value })} />
                  <TextField fullWidth label="Clinical Notes" multiline rows={6} variant="outlined" value={consultData.notes} onChange={(e) => setConsultData({ ...consultData, notes: e.target.value })} />
                </Box>
              )}

              {tabValue === 1 && (
                <PrescriptionForm prescriptions={consultData.prescriptions} onChange={(p) => setConsultData({ ...consultData, prescriptions: p })} />
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8f9fa', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => setOpenConsultDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveConsult} size="large" disabled={!consultData.diagnosis} sx={{ fontWeight: 700, borderRadius: 2 }}>
            Finish Consultation
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openSafetyDialog} onClose={() => setOpenSafetyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main', fontWeight: '800' }}>Medication Safety Alerts</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" gutterBottom>The following safety issues were detected with the prescribed medications:</Typography>
          <Box sx={{ mt: 2, mb: 3 }}>
            {safetyAlerts.map((alert, idx) => (
              <Alert key={idx} severity={alert.severity === 'high' ? 'error' : 'warning'} sx={{ mb: 1, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{alert.type} Alert ({alert.severity} severity)</Typography>
                <Typography variant="body2">{alert.description}</Typography>
              </Alert>
            ))}
          </Box>
          <Typography variant="body2" fontWeight="bold" gutterBottom>Override Justification (Required)</Typography>
          <TextField fullWidth multiline rows={3} placeholder="Please provide clinical justification for overriding these safety alerts..." value={overrideJustification} onChange={(e) => setOverrideJustification(e.target.value)} error={overrideJustification.trim() === ''} helperText={overrideJustification.trim() === '' ? 'Justification is required to proceed' : ''} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenSafetyDialog(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={executeSaveConsult} disabled={overrideJustification.trim() === ''} sx={{ fontWeight: 700, borderRadius: 2 }}>
            Override & Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DoctorDashboard;
