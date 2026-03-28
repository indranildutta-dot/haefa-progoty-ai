import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, 
  Card, CardContent, Paper, Divider, CircularProgress, Stack 
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TimerIcon from '@mui/icons-material/Timer';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import { subscribeToQueue, updateQueueStatus, callNextPatient } from '../services/queueService';
import { saveConsultation, getVitalsByEncounter, getEncounterById, updateEncounterStatus, getPatientHistory } from '../services/encounterService';
import { getTriageAssessmentByEncounter } from '../services/triageService';
import { getPatientById } from '../services/patientService';
import { QueueItem, Encounter, Patient, Prescription, VitalsRecord, TriageAssessment, SafetyAlert } from '../types';

import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import PatientSummaryPanel from '../components/PatientSummaryPanel';
import ConsultationPanel from '../components/ConsultationPanel';
import VitalsSnapshot from '../components/VitalsSnapshot';
import PatientContextBar from '../components/PatientContextBar';
import StationLayout from '../components/StationLayout';
import { useAppStore } from '../store/useAppStore';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { initialClinicalAssessment } from '../components/ClinicalAssessmentPanel';

const DoctorDashboard: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { notify, selectedClinic, setSelectedPatient } = useAppStore();
  const { isMobile } = useResponsiveLayout();
  
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentVitals, setCurrentVitals] = useState<VitalsRecord | null>(null);
  const [currentTriage, setCurrentTriage] = useState<TriageAssessment | null>(null);
  const [consultationStartTime, setConsultationStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');
  const [isSaving, setIsSaving] = useState(false);

  const [consultData, setConsultData] = useState({
    diagnosis: '', notes: '', treatmentNotes: '', prescriptions: [] as Prescription[],
    clinicalAssessment: initialClinicalAssessment, labInvestigations: [] as string[], referrals: [] as string[]
  });

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
    if (!selectedClinic) return;
    const unsubscribe = subscribeToQueue(['READY_FOR_DOCTOR', 'IN_CONSULTATION'] as any, setWaitingList, (err) => console.error(err));
    return () => unsubscribe();
  }, [selectedClinic]);

  const handleOpenConsult = async (item: QueueItem) => {
    setSelectedItem(item);
    setConsultationStartTime(Date.now());
    try {
      if (item.status === 'READY_FOR_DOCTOR') {
        await updateEncounterStatus(item.encounter_id, 'IN_CONSULTATION');
        await updateQueueStatus(item.id!, 'IN_CONSULTATION' as any);
      }
      const [patient, vitals, triage] = await Promise.all([
        getPatientById(item.patient_id),
        getVitalsByEncounter(item.encounter_id),
        getTriageAssessmentByEncounter(item.encounter_id)
      ]);
      const patientWithVitals = { ...patient, currentVitals: vitals, triage_level: item.triage_level };
      setCurrentPatient(patientWithVitals);
      setSelectedPatient(patientWithVitals);
      setCurrentVitals(vitals);
      setCurrentTriage(triage);
    } catch (err) {
      notify("Failed to load patient data", "error");
    }
  };

  const handleFinalize = async (status: string) => {
    if (!selectedItem) return;
    setIsSaving(true);
    try {
      await saveConsultation({
        ...consultData,
        encounter_id: selectedItem.encounter_id,
        patient_id: selectedItem.patient_id,
        created_by: auth.currentUser?.uid
      });
      await updateQueueStatus(selectedItem.id!, status as any);
      notify("Consultation finalized.", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
    } catch (e) {
      notify("Error saving.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StationLayout title="Doctor Dashboard" stationName="Doctor" showPatientContext={!!selectedItem}>
      {!selectedItem ? (
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight="900" mb={3}>Patient Waiting Queue</Typography>
          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}><TableRow><TableCell>Wait</TableCell><TableCell>Name</TableCell><TableCell>Status</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
              <TableBody>
                {waitingList.map(item => (
                  <TableRow key={item.id} hover>
                    <TableCell>{Math.floor((Date.now() - (item.created_at?.toDate().getTime() || Date.now())) / 60000)}m</TableCell>
                    <TableCell fontWeight="bold">{item.patient_name}</TableCell>
                    <TableCell><Chip label={item.triage_level?.toUpperCase()} size="small" color={item.triage_level === 'emergency' ? 'error' : 'default'} /></TableCell>
                    <TableCell align="right"><Button variant="contained" size="small" onClick={() => handleOpenConsult(item)}>Start</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : (
        <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100vh' }}>
          <PatientContextBar />
          <Grid container spacing={2} sx={{ p: 2 }}>
            <Grid item xs={12} lg={3}>
              <Stack spacing={2}>
                <Paper sx={{ p: 2, borderRadius: 4, border: '1px solid #e2e8f0' }}>
                  <VitalsSnapshot vitals={currentVitals} />
                </Paper>
                <Paper sx={{ p: 2, borderRadius: 4, border: '1px solid #e2e8f0' }}>
                  <Typography variant="subtitle2" fontWeight="900" gutterBottom>HISTORY</Typography>
                  <PatientHistoryTimeline patientId={currentPatient?.id || ''} />
                </Paper>
              </Stack>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 4, borderRadius: 4 }}>
                <Box display="flex" justifyContent="space-between" mb={3}>
                  <Typography variant="h5" fontWeight="900">CONSULTATION</Typography>
                  <Chip label={elapsedTime} icon={<TimerIcon />} sx={{ fontWeight: 'bold' }} />
                </Box>
                <ConsultationPanel data={consultData} onChange={setConsultData} />
                <Stack spacing={2} mt={4}>
                  <Button fullWidth variant="contained" color="secondary" onClick={() => handleFinalize('WAITING_FOR_PHARMACY')} disabled={isSaving}>SEND TO PHARMACY</Button>
                  <Button fullWidth variant="outlined" onClick={() => setSelectedItem(null)}>CLOSE</Button>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={3}>
              <PatientSummaryPanel patient={currentPatient} triage={currentTriage} />
            </Grid>
          </Grid>
        </Box>
      )}
    </StationLayout>
  );
};

export default DoctorDashboard;