import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Typography, 
  Box, 
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
  Card,
  CardContent,
  Container,
  Paper
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningIcon from '@mui/icons-material/Warning';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { db } from "../firebase";
import { subscribeToQueue, updateQueueStatus, callNextPatient } from '../services/queueService';
import { 
  saveConsultation, 
  getVitalsByEncounter,
  getEncounterById,
  updateEncounterStatus,
  getPatientHistory
} from '../services/encounterService';
import { getTriageAssessmentByEncounter } from '../services/triageService';
import { updateQueueMetric } from '../services/queueMetricsService';
import { getPatientById } from '../services/patientService';
import { QueueItem, Encounter, Patient, Prescription, VitalsRecord, TriageAssessment } from '../types';
import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import PatientSummaryPanel from '../components/PatientSummaryPanel';
import ConsultationPanel from '../components/ConsultationPanel';
import VitalsSnapshot from '../components/VitalsSnapshot';
import AlertBanner from '../components/AlertBanner';
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
  const [patientHistoryCount, setPatientHistoryCount] = useState<number>(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Consultation Form State
  const [consultData, setConsultData] = useState({
    diagnosis: '',
    notes: '',
    treatmentNotes: '',
    prescriptions: [] as Prescription[]
  });

  const [consultationCount, setConsultationCount] = useState(0);

  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([]);
  const [openSafetyDialog, setOpenSafetyDialog] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState('');
  
  const [consultationStartTime, setConsultationStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedItem && consultationStartTime) {
      interval = setInterval(() => {
        const diff = Math.floor((Date.now() - consultationStartTime) / 1000);
        const mins = Math.floor(diff / 60).toString().padStart(2, '0');
        const secs = (diff % 60).toString().padStart(2, '0');
        setElapsedTime(`${mins}:${secs}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [selectedItem, consultationStartTime]);

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
    setConsultationStartTime(Date.now());
    setElapsedTime('00:00');
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

      const [patient, encounter, vitals, triage, history] = await Promise.all([
        getPatientById(item.patient_id),
        getEncounterById(item.encounter_id),
        getVitalsByEncounter(item.encounter_id),
        getTriageAssessmentByEncounter(item.encounter_id),
        getPatientHistory(item.patient_id)
      ]);
      setCurrentPatient(patient);
      setCurrentEncounter(encounter);
      setCurrentVitals(vitals);
      setCurrentTriage(triage);
      setPatientHistoryCount(history.filter(e => e.encounter_status === 'COMPLETED').length);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load patient data.");
    }
  };

  const handleSaveConsult = async (forceStatus?: 'WAITING_FOR_PHARMACY' | 'COMPLETED') => {
    if (!selectedItem) return;
    
    if (consultData.prescriptions.length > 0) {
      const alerts = await checkPrescriptionSafety(selectedItem.patient_id, consultData.prescriptions);
      if (alerts.length > 0) {
        setSafetyAlerts(alerts);
        setOpenSafetyDialog(true);
        // We need to store the forceStatus so it can be used after override
        // A simple way is to just pass it to executeSaveConsult when overriding, but we don't have a state for it.
        // Let's just use the default logic if they override.
        return;
      }
    }
    
    await executeSaveConsult(forceStatus);
  };

  const executeSaveConsult = async (forceStatus?: 'WAITING_FOR_PHARMACY' | 'COMPLETED') => {
    if (!selectedItem) return;
    try {
      const uid = auth.currentUser?.uid || 'unknown';
      
      const finalNotes = overrideJustification 
        ? `${consultData.notes}\n\n[Safety Override Justification]: ${overrideJustification}`
        : consultData.notes;

      const hasPrescriptions = consultData.prescriptions.length > 0;
      await saveConsultation(
        {
          encounter_id: selectedItem.encounter_id,
          patient_id: selectedItem.patient_id,
          chief_complaint: consultData.treatmentNotes, // Saving treatmentNotes here for now
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

      let nextStatus = forceStatus;
      if (hasPrescriptions && nextStatus === 'COMPLETED') {
        nextStatus = 'WAITING_FOR_PHARMACY';
      } else if (!forceStatus) {
        nextStatus = hasPrescriptions ? 'WAITING_FOR_PHARMACY' : 'COMPLETED';
      }

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
      setOpenSafetyDialog(false);
      setOverrideJustification('');
      setSelectedItem(null);
      setConsultData({ diagnosis: '', notes: '', treatmentNotes: '', prescriptions: [] });
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to save consultation.");
      notify("Failed to save consultation", "error");
    }
  };

  const handleCancelEncounter = async () => {
    if (!selectedItem) return;
    try {
      await updateQueueStatus(selectedItem.id!, 'READY_FOR_DOCTOR');
      await updateEncounterStatus(selectedItem.encounter_id, 'READY_FOR_DOCTOR');
      await updateQueueMetric(selectedItem.clinic_id, {
        ready_for_doctor: 1,
        in_consultation: -1
      });
      notify("Consultation cancelled. Patient returned to queue.", "info");
    } catch (err) {
      console.error("Failed to cancel encounter:", err);
      notify("Failed to cancel encounter.", "error");
    }
    setSelectedItem(null);
    setConsultData({ diagnosis: '', notes: '', treatmentNotes: '', prescriptions: [] });
    setConsultationStartTime(null);
  };

  if (selectedItem && currentPatient) {
    const waitTime = selectedItem.created_at ? Math.floor((Date.now() - selectedItem.created_at.toDate().getTime()) / 60000) : '??';
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f1f5f9' }}>
        {/* Top Patient Banner */}
        <Paper elevation={0} sx={{ p: 2, bgcolor: 'primary.main', color: 'white', borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box>
              <Typography variant="h6" fontWeight="800">
                {currentPatient.first_name} {currentPatient.last_name} <Typography component="span" variant="body1" sx={{ opacity: 0.8 }}>| {currentPatient.date_of_birth} {currentPatient.gender} | Village: {currentPatient.village || 'N/A'}</Typography>
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                Encounter #{selectedItem.encounter_id.substring(0, 8).toUpperCase()} | Waiting {waitTime} min
              </Typography>
            </Box>
            <Chip 
              label={`TRIAGE: ${selectedItem.triage_level?.toUpperCase() || 'STANDARD'}`} 
              size="small" 
              sx={{ 
                fontWeight: 800, 
                bgcolor: selectedItem.triage_level === 'emergency' ? 'error.main' :
                         selectedItem.triage_level === 'urgent' ? 'warning.main' :
                         selectedItem.triage_level === 'low' ? 'success.main' : 'warning.light',
                color: selectedItem.triage_level === 'standard' ? 'black' : 'white'
              }} 
            />
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" sx={{ opacity: 0.8, textTransform: 'uppercase', fontWeight: 'bold' }}>Consultation Time</Typography>
            <Typography variant="h5" fontWeight="900" sx={{ fontFamily: 'monospace' }}>{elapsedTime}</Typography>
          </Box>
        </Paper>

        {/* Workspace Area */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden', p: 2 }}>
          <Grid container spacing={2} sx={{ height: '100%' }}>
            
            {/* Left Panel: Patient Summary */}
            <Grid size={{ xs: 12, md: 3 }} sx={{ height: '100%' }}>
              <Paper elevation={0} sx={{ height: '100%', borderRadius: 3, border: '1px solid', borderColor: 'divider', overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <PatientSummaryPanel patient={currentPatient} triage={currentTriage} />
                </Box>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Button fullWidth color="error" variant="outlined" onClick={handleCancelEncounter} sx={{ fontWeight: 700 }}>
                    Cancel Encounter
                  </Button>
                </Box>
              </Paper>
            </Grid>

            {/* Center Panel: Consultation Workspace */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ height: '100%' }}>
              <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Safety Alerts */}
                {currentTriage && currentTriage.allergies && currentTriage.allergies.length > 0 && (
                  <AlertBanner 
                    type="allergy" 
                    title="Allergy Alert" 
                    message={`Patient is allergic to: ${currentTriage.allergies.join(', ')}`} 
                  />
                )}
                {selectedItem.triage_level === 'emergency' && (
                  <AlertBanner 
                    type="critical" 
                    title="Critical Triage" 
                    message="Patient was triaged as EMERGENCY. Immediate attention required." 
                  />
                )}
                {currentVitals && (
                  (currentVitals.systolic && currentVitals.systolic > 180) || 
                  (currentVitals.diastolic && currentVitals.diastolic > 120) || 
                  (currentVitals.heartRate && (currentVitals.heartRate > 130 || currentVitals.heartRate < 40)) || 
                  (currentVitals.temperature && (currentVitals.temperature > 39.0 || currentVitals.temperature < 35.0)) || 
                  (currentVitals.oxygenSaturation && currentVitals.oxygenSaturation < 90)
                ) && (
                  <AlertBanner 
                    type="warning" 
                    title="Abnormal Vitals" 
                    message="Patient has critically abnormal vital signs. Please review immediately." 
                  />
                )}
                {patientHistoryCount > 0 && currentPatient && (
                  <AlertBanner 
                    type="info" 
                    title="Repeat Visit" 
                    message={`Patient has ${patientHistoryCount} previous completed encounter(s).`} 
                  />
                )}
                
                <Paper elevation={0} sx={{ flexGrow: 1, borderRadius: 3, border: '1px solid', borderColor: 'divider', overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <ConsultationPanel data={consultData} onChange={setConsultData} />
                  </Box>
                </Paper>
              </Box>
            </Grid>

            {/* Right Panel: History Timeline */}
            <Grid size={{ xs: 12, md: 3 }} sx={{ height: '100%' }}>
              <Paper elevation={0} sx={{ height: '100%', borderRadius: 3, border: '1px solid', borderColor: 'divider', overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <VitalsSnapshot vitals={currentVitals} />
                  <PatientHistoryTimeline patientId={currentPatient.id!} />
                  
                  {/* Future AI Hook */}
                  <Box sx={{ mt: 4, p: 2, borderRadius: 2, border: '1px dashed', borderColor: 'secondary.main', bgcolor: 'secondary.50', textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="secondary.main" fontWeight="bold" sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      ✨ AI Clinical Insights
                    </Typography>
                    <Typography variant="body2" color="textSecondary" fontStyle="italic">
                      AI analysis will appear here based on patient history and current symptoms.
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button fullWidth variant="outlined" color="secondary" onClick={() => handleSaveConsult('WAITING_FOR_PHARMACY')} disabled={!consultData.diagnosis} sx={{ fontWeight: 700, borderRadius: 2 }}>
                    Send to Pharmacy
                  </Button>
                  <Button fullWidth variant="contained" color="secondary" onClick={() => handleSaveConsult('COMPLETED')} disabled={!consultData.diagnosis} size="large" sx={{ fontWeight: 800, borderRadius: 2 }}>
                    Complete Consultation
                  </Button>
                </Box>
              </Paper>
            </Grid>

          </Grid>
        </Box>

        {/* Safety Override Dialog */}
        <Dialog open={openSafetyDialog} onClose={() => setOpenSafetyDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ color: 'error.main', fontWeight: '900', textTransform: 'uppercase' }}>Medication Safety Alerts</DialogTitle>
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
            <Button variant="contained" color="error" onClick={() => executeSaveConsult()} disabled={overrideJustification.trim() === ''} sx={{ fontWeight: 700, borderRadius: 2 }}>
              Override & Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Initial Queue View
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight="900" color="primary.main" gutterBottom sx={{ textTransform: 'uppercase' }}>
            Doctor Dashboard
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

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 9 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <AssignmentIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="800">Patients Ready for Consultation</Typography>
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
                              sx={{ fontWeight: 700, borderRadius: 1 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button 
                              variant={item.status === 'IN_CONSULTATION' ? "outlined" : "contained"} 
                              color={item.status === 'IN_CONSULTATION' ? "secondary" : "primary"}
                              size="small" 
                              onClick={() => handleOpenConsult(item)}
                              sx={{ borderRadius: 2, fontWeight: 700 }}
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
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: 'bold', textTransform: 'uppercase' }}>Consultations Today</Typography>
              <Typography variant="h3" fontWeight="800">{consultationCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DoctorDashboard;
