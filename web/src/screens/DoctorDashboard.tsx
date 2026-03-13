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
  Paper,
  Divider,
  CircularProgress
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
import { getPatientByQrToken } from '../services/qrService';
import { QueueItem, Encounter, Patient, Prescription, VitalsRecord, TriageAssessment } from '../types';
import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import PatientSummaryPanel from '../components/PatientSummaryPanel';
import ConsultationPanel from '../components/ConsultationPanel';
import VitalsSnapshot from '../components/VitalsSnapshot';
import AlertBanner from '../components/AlertBanner';
import QrScannerModal from '../components/QrScannerModal';
import { auth } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { checkPrescriptionSafety } from '../services/medicationSafetyService';
import { SafetyAlert } from '../types';

interface DoctorDashboardProps {
  countryId: string;
}

import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ countryId }) => {
  const { notify, selectedCountry, selectedClinic, selectedPatient, setSelectedPatient } = useAppStore();
  const { isMobile, isTablet } = useResponsiveLayout();
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
      setSelectedPatient(patient);
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
          chief_complaint: consultData.treatmentNotes,
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
      setSelectedPatient(null);
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
    setSelectedPatient(null);
    setConsultData({ diagnosis: '', notes: '', treatmentNotes: '', prescriptions: [] });
    setConsultationStartTime(null);
  };

  const renderQueueView = () => (
    <Box>
      <Box sx={{ mb: isMobile ? 2 : 4, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexDirection: isMobile ? 'column' : 'row', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, width: isMobile ? '100%' : 'auto' }}>
          <Button variant="contained" color="primary" onClick={handleCallNextPatient} disabled={waitingList.length === 0} fullWidth={isMobile} sx={{ fontWeight: 700, borderRadius: 2 }}>
            Call Next Patient
          </Button>
        </Box>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexDirection={isMobile ? 'column' : 'row'} gap={2}>
                <Box display="flex" alignItems="center">
                  <AssignmentIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" fontWeight="800">Patients Ready</Typography>
                </Box>
                <QrScannerModal onScan={async (token) => {
                  const patient = await getPatientByQrToken(token);
                  if (patient) {
                    const item = waitingList.find(i => i.patient_id === patient.id);
                    if (item) {
                      handleOpenConsult(item);
                    } else {
                      notify("Patient not found in queue.", "error");
                    }
                  } else {
                    notify("Patient not found.", "error");
                  }
                }} />
              </Box>
              
              {isMobile || isTablet ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {waitingList.length === 0 ? (
                    <Typography color="textSecondary" align="center" sx={{ py: 4 }}>No patients waiting.</Typography>
                  ) : (
                    waitingList.map((item) => {
                      const waitTime = item.created_at ? Math.floor((Date.now() - item.created_at.toDate().getTime()) / 60000) : 0;
                      return (
                        <Card key={item.id} variant="outlined" sx={{ borderRadius: 2 }}>
                          <CardContent sx={{ p: 2 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="start">
                              <Box>
                                <Typography variant="subtitle1" fontWeight="bold">{item.patient_name || item.patient_id}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Wait: {waitTime} mins
                                </Typography>
                              </Box>
                              <Chip 
                                label={item.triage_level?.toUpperCase() || 'STANDARD'} 
                                size="small" 
                                color={item.triage_level === 'emergency' ? 'error' : item.triage_level === 'urgent' ? 'warning' : 'default'}
                              />
                            </Box>
                            <Box display="flex" justifyContent="flex-end" mt={2}>
                              <Button 
                                variant={item.status === 'IN_CONSULTATION' ? "outlined" : "contained"} 
                                color={item.status === 'IN_CONSULTATION' ? "secondary" : "primary"}
                                size="small" 
                                onClick={() => handleOpenConsult(item)}
                              >
                                {item.status === 'IN_CONSULTATION' ? 'Resume' : 'Start'}
                              </Button>
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </Box>
              ) : (
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
                            <Typography color="textSecondary" sx={{ py: 4 }}>No patients waiting.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        waitingList.map((item) => {
                          const waitTime = item.created_at ? Math.floor((Date.now() - item.created_at.toDate().getTime()) / 60000) : 0;
                          return (
                            <TableRow key={item.id} hover>
                              <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_name || item.patient_id}</TableCell>
                              <TableCell>{waitTime} mins</TableCell>
                              <TableCell>
                                <Chip label={item.triage_level?.toUpperCase() || 'STANDARD'} size="small" />
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
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: 'bold', textTransform: 'uppercase' }}>Consultations Today</Typography>
              <Typography variant="h3" fontWeight="800">{consultationCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderConsultationWorkspace = () => {
    if (!selectedItem || !currentPatient) return null;
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#f1f5f9' }}>
        {/* Workspace Area */}
        <Box sx={{ flexGrow: 1, p: isMobile ? 1 : 2 }}>
          <Grid container spacing={2}>
            {/* Alerts Section */}
            <Grid size={{ xs: 12 }}>
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
            </Grid>

            {/* Main Content Grid */}
            <Grid size={{ xs: 12, lg: 3 }} sx={{ display: isMobile ? 'none' : 'block' }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <PatientSummaryPanel patient={currentPatient} triage={currentTriage} />
                <Divider sx={{ my: 2 }} />
                <VitalsSnapshot vitals={currentVitals} />
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
              <Paper elevation={0} sx={{ p: isMobile ? 2 : 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6" fontWeight="800" color="secondary.main">CONSULTATION</Typography>
                  <Typography variant="h5" fontWeight="900" sx={{ fontFamily: 'monospace' }}>{elapsedTime}</Typography>
                </Box>
                <ConsultationPanel data={consultData} onChange={setConsultData} />
                
                <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Button fullWidth variant="outlined" color="secondary" onClick={() => handleSaveConsult('WAITING_FOR_PHARMACY')} disabled={!consultData.diagnosis} sx={{ fontWeight: 700, py: 1.5 }}>
                    Send to Pharmacy
                  </Button>
                  <Button fullWidth variant="contained" color="secondary" onClick={() => handleSaveConsult('COMPLETED')} disabled={!consultData.diagnosis} size="large" sx={{ fontWeight: 800, py: 2 }}>
                    Complete Consultation
                  </Button>
                  <Button fullWidth color="error" variant="text" onClick={handleCancelEncounter}>
                    Cancel Encounter
                  </Button>
                </Box>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, lg: 3 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>PATIENT HISTORY</Typography>
                <PatientHistoryTimeline patientId={currentPatient.id!} />
              </Paper>
            </Grid>
          </Grid>
        </Box>

        {/* Safety Override Dialog */}
        <Dialog open={openSafetyDialog} onClose={() => setOpenSafetyDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ color: 'error.main', fontWeight: '900', textTransform: 'uppercase' }}>Safety Alerts</DialogTitle>
          <DialogContent dividers>
            {safetyAlerts.map((alert, idx) => (
              <Alert key={idx} severity={alert.severity === 'high' ? 'error' : 'warning'} sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{alert.type} Alert</Typography>
                <Typography variant="body2">{alert.description}</Typography>
              </Alert>
            ))}
            <TextField fullWidth multiline rows={3} sx={{ mt: 2 }} label="Override Justification" value={overrideJustification} onChange={(e) => setOverrideJustification(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenSafetyDialog(false)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={() => executeSaveConsult()} disabled={!overrideJustification.trim()}>Override & Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  return (
    <StationLayout
      title="Doctor Dashboard"
      stationName="Doctor"
      showPatientContext={!!selectedItem}
    >
      {!selectedItem ? renderQueueView() : renderConsultationWorkspace()}
    </StationLayout>
  );
};

export default DoctorDashboard;
