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
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { 
  getLatestEncounter, 
  saveConsultation, 
  getVitalsByEncounter,
  getEncounterById
} from '../services/encounterService';
import { getPatientById } from '../services/patientService';
import { QueueItem, Encounter, Patient, Prescription, VitalsRecord } from '../types';
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
    const unsubscribe = subscribeToQueue('READY_FOR_DOCTOR', (items) => {
      setWaitingList(items);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenConsult = async (item: QueueItem) => {
    setSelectedItem(item);
    try {
      const [patient, encounter, vitals] = await Promise.all([
        getPatientById(item.patient_id),
        getEncounterById(item.encounter_id),
        getVitalsByEncounter(item.encounter_id)
      ]);
      setCurrentPatient(patient);
      setCurrentEncounter(encounter);
      setCurrentVitals(vitals);
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

      await saveConsultation(
        {
          encounter_id: selectedItem.encounter_id,
          patient_id: selectedItem.patient_id,
          chief_complaint: consultData.chiefComplaint,
          diagnosis: consultData.diagnosis,
          notes: finalNotes,
          created_by: uid
        },
        consultData.prescriptions.length > 0 ? {
          encounter_id: selectedItem.encounter_id,
          patient_id: selectedItem.patient_id,
          prescriptions: consultData.prescriptions,
          created_by: uid
        } : undefined
      );

      await updateQueueStatus(selectedItem.id!, 'WAITING_FOR_PHARMACY' as any);
      
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
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" fontWeight="bold">
          Doctor Consultation
        </Typography>
        <Button 
          variant="outlined" 
          component={Link} 
          to="/queue"
          startIcon={<AssignmentIcon />}
        >
          View Queue Board
        </Button>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 9 }}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Box display="flex" alignItems="center" mb={2}>
              <AssignmentIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Patients Ready for Consultation</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Patient Name</TableCell>
                    <TableCell>Wait Time</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {waitingList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="textSecondary" sx={{ py: 4 }}>
                          No patients waiting for consultation.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    waitingList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_name || item.patient_id}</TableCell>
                        <TableCell>
                          {item.created_at ? Math.floor((Date.now() - item.created_at.toDate().getTime()) / 60000) : '??'} mins
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={item.triage_level?.toUpperCase() || 'STANDARD'} 
                            size="small" 
                            color={
                              item.triage_level === 'emergency' ? 'error' :
                              item.triage_level === 'urgent' ? 'warning' :
                              item.triage_level === 'low' ? 'success' : 'default'
                            } 
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button 
                            variant="contained" 
                            size="small" 
                            onClick={() => handleOpenConsult(item)}
                          >
                            Start Consultation
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 2, mb: 3, bgcolor: 'primary.dark', color: 'white' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>Consultations Today</Typography>
              <Typography variant="h3" fontWeight="bold">{consultationCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Consultation Dialog */}
      <Dialog open={openConsultDialog} onClose={() => setOpenConsultDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', bgcolor: '#f8f9fa' }}>
          Consultation - {currentPatient ? `${currentPatient.first_name} ${currentPatient.last_name}` : 'Loading...'}
          <Typography variant="caption" display="block" color="textSecondary">
            {currentPatient?.gender}, {currentPatient?.date_of_birth}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Grid container sx={{ height: '70vh' }}>
            {/* Left Panel: Vitals & History */}
            <Grid size={{ xs: 12, md: 4 }} sx={{ borderRight: '1px solid #eee', overflowY: 'auto', p: 2, bgcolor: '#fafafa' }}>
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom fontWeight="bold" color="primary">Current Vitals</Typography>
                {currentVitals ? (
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">BP</Typography>
                        <Typography variant="body2" fontWeight="bold">{currentVitals.systolic}/{currentVitals.diastolic}</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">HR</Typography>
                        <Typography variant="body2" fontWeight="bold">{currentVitals.heartRate} bpm</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">Temp</Typography>
                        <Typography variant="body2" fontWeight="bold">{currentVitals.temperature}°C</Typography>
                      </Paper>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">BMI</Typography>
                        <Typography variant="body2" fontWeight="bold">{currentVitals.bmi}</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                ) : <Typography variant="caption">No vitals recorded.</Typography>}
              </Box>
              
              <Divider sx={{ my: 2 }} />

              <Box mb={3}>
                {currentPatient && <PatientAllergies patientId={currentPatient.id!} />}
              </Box>

              <Divider sx={{ my: 2 }} />
              
              <Box>
                <Box display="flex" alignItems="center" mb={1}>
                  <HistoryIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight="bold">Patient History</Typography>
                </Box>
                {currentPatient && <PatientHistoryTimeline patientId={currentPatient.id!} />}
              </Box>
            </Grid>

            {/* Right Panel: Consultation Form */}
            <Grid size={{ xs: 12, md: 8 }} sx={{ overflowY: 'auto', p: 3 }}>
              <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
                <Tab label="Assessment" icon={<AssignmentIcon />} iconPosition="start" />
                <Tab label="Prescription" icon={<MedicationIcon />} iconPosition="start" />
              </Tabs>

              {tabValue === 0 && (
                <Box>
                  <TextField
                    fullWidth
                    label="Chief Complaint"
                    multiline
                    rows={2}
                    variant="outlined"
                    sx={{ mb: 3 }}
                    value={consultData.chiefComplaint}
                    onChange={(e) => setConsultData({ ...consultData, chiefComplaint: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Diagnosis"
                    variant="outlined"
                    sx={{ mb: 3 }}
                    value={consultData.diagnosis}
                    onChange={(e) => setConsultData({ ...consultData, diagnosis: e.target.value })}
                  />
                  <TextField
                    fullWidth
                    label="Clinical Notes"
                    multiline
                    rows={6}
                    variant="outlined"
                    value={consultData.notes}
                    onChange={(e) => setConsultData({ ...consultData, notes: e.target.value })}
                  />
                </Box>
              )}

              {tabValue === 1 && (
                <PrescriptionForm 
                  prescriptions={consultData.prescriptions} 
                  onChange={(p) => setConsultData({ ...consultData, prescriptions: p })} 
                />
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8f9fa' }}>
          <Button onClick={() => setOpenConsultDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveConsult} 
            size="large"
            disabled={!consultData.diagnosis}
          >
            Complete Consultation & Send to Pharmacy
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openSafetyDialog} onClose={() => setOpenSafetyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
          Medication Safety Alerts
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body1" gutterBottom>
            The following safety issues were detected with the prescribed medications:
          </Typography>
          <Box sx={{ mt: 2, mb: 3 }}>
            {safetyAlerts.map((alert, idx) => (
              <Alert key={idx} severity={alert.severity === 'high' ? 'error' : 'warning'} sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                  {alert.type} Alert ({alert.severity} severity)
                </Typography>
                <Typography variant="body2">
                  {alert.description}
                </Typography>
              </Alert>
            ))}
          </Box>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            Override Justification (Required)
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="Please provide clinical justification for overriding these safety alerts..."
            value={overrideJustification}
            onChange={(e) => setOverrideJustification(e.target.value)}
            error={overrideJustification.trim() === ''}
            helperText={overrideJustification.trim() === '' ? 'Justification is required to proceed' : ''}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenSafetyDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={executeSaveConsult} 
            disabled={overrideJustification.trim() === ''}
          >
            Override & Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DoctorDashboard;
