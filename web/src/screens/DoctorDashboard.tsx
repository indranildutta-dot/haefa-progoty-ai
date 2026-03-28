import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Grid, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, Card, CardContent, Paper, Divider,
  Stack, Tooltip
} from '@mui/material';
import { 
  Assignment as AssignmentIcon, 
  Warning as WarningIcon,
  Error as ErrorIcon,
  PregnantWoman as PregnancyIcon,
  LocalHospital as TriageIcon,
  Timer as TimerIcon
} from '@mui/icons-material';
import { 
  collection, query, where, getDocs 
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { subscribeToQueue, updateQueueStatus, callNextPatient } from '../services/queueService';
import { 
  saveConsultation, getVitalsByEncounter, getEncounterById,
  updateEncounterStatus, getPatientHistory
} from '../services/encounterService';
import { getTriageAssessmentByEncounter } from '../services/triageService';
import { updateQueueMetric } from '../services/queueMetricsService';
import { getPatientById } from '../services/patientService';
import { getPatientByQrToken } from '../services/qrService';
import { QueueItem, Encounter, Patient, Prescription, VitalsRecord, TriageAssessment, SafetyAlert } from '../types';

import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import PatientSummaryPanel from '../components/PatientSummaryPanel';
import ConsultationPanel from '../components/ConsultationPanel';
import VitalsSnapshot from '../components/VitalsSnapshot';
import AlertBanner from '../components/AlertBanner';
import QrScannerModal from '../components/QrScannerModal';
import StationLayout from '../components/StationLayout';
import PatientContextBar from '../components/PatientContextBar'; // Newly updated sidebar
import { useAppStore } from '../store/useAppStore';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { checkPrescriptionSafety } from '../services/medicationSafetyService';
import { initialClinicalAssessment } from '../components/ClinicalAssessmentPanel';

interface DoctorDashboardProps {
  countryId: string;
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ countryId }) => {
  const { notify, selectedCountry, selectedClinic, setSelectedPatient, userProfile } = useAppStore();
  const { isMobile, isTablet } = useResponsiveLayout();
  
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentVitals, setCurrentVitals] = useState<VitalsRecord | null>(null);
  const [currentTriage, setCurrentTriage] = useState<TriageAssessment | null>(null);
  const [consultationCount, setConsultationCount] = useState(0);

  // Consultation Form State
  const [consultData, setConsultData] = useState({
    diagnosis: '',
    notes: '',
    treatmentNotes: '',
    prescriptions: [] as Prescription[],
    clinicalAssessment: initialClinicalAssessment,
    labInvestigations: [] as string[],
    referrals: [] as string[]
  });

  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([]);
  const [openSafetyDialog, setOpenSafetyDialog] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState('');
  const [consultationStartTime, setConsultationStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00');

  // Timer logic
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

  // Queue Subscription
  useEffect(() => {
    if (!selectedClinic) return;
    const unsubscribe = subscribeToQueue(
      ['READY_FOR_DOCTOR', 'IN_CONSULTATION'] as any, 
      setWaitingList,
      (err) => notify("Queue sync error", "error")
    );
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

      const [patient, encounter, vitals, triage] = await Promise.all([
        getPatientById(item.patient_id),
        getEncounterById(item.encounter_id),
        getVitalsByEncounter(item.encounter_id),
        getTriageAssessmentByEncounter(item.encounter_id)
      ]);

      // Attach vitals/triage to patient for the Sidebar Context
      const patientWithVitals = { ...patient, currentVitals: vitals, triage_level: item.triage_level };
      
      setCurrentPatient(patientWithVitals);
      setSelectedPatient(patientWithVitals);
      setCurrentEncounter(encounter);
      setCurrentVitals(vitals);
      setCurrentTriage(triage);
    } catch (err) {
      notify("Failed to load clinical data", "error");
    }
  };

  // RISK BADGE RENDERER: This shows indicators in the queue list
  const renderRiskBadges = (item: any) => (
    <Stack direction="row" spacing={0.5}>
      {/* Triage Chip */}
      <Chip 
        label={item.triage_level?.toUpperCase() || 'STANDARD'} 
        size="small"
        sx={{ 
          fontWeight: 900, fontSize: '0.65rem',
          bgcolor: item.triage_level === 'emergency' ? '#ef4444' : item.triage_level === 'urgent' ? '#f59e0b' : '#10b981',
          color: 'white'
        }}
      />
      {/* Pregnancy Alert Badge */}
      {item.is_pregnant === 'yes' && (
        <Tooltip title="Patient is Pregnant">
          <Chip icon={<PregnancyIcon sx={{ fontSize: '12px !important', color: 'white !important' }} />} label="PREG" size="small" sx={{ bgcolor: '#be123c', color: 'white', fontWeight: 900, fontSize: '0.65rem' }} />
        </Tooltip>
      )}
      {/* Allergy Alert Badge */}
      {item.has_allergies && (
        <Tooltip title="Known Allergies">
          <Chip icon={<ErrorIcon sx={{ fontSize: '12px !important', color: 'white !important' }} />} label="ALGY" size="small" sx={{ bgcolor: '#e11d48', color: 'white', fontWeight: 900, fontSize: '0.65rem' }} />
        </Tooltip>
      )}
    </Stack>
  );

  const renderQueueView = () => (
    <Container maxWidth="xl" sx={{ mt: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={9}>
          <Card sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" fontWeight="900">Patient Queue</Typography>
                <Button variant="contained" onClick={() => handleOpenConsult(waitingList[0])} disabled={waitingList.length === 0}>Call Next Patient</Button>
              </Box>
              
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Wait</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Patient Name</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Risk & Triage</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {waitingList.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <TimerIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="body2" fontWeight="bold">
                                    {Math.floor((Date.now() - (item.created_at?.toDate().getTime() || Date.now())) / 60000)}m
                                </Typography>
                            </Stack>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{item.patient_name}</TableCell>
                        <TableCell>{renderRiskBadges(item)}</TableCell>
                        <TableCell align="right">
                          <Button variant="contained" size="small" onClick={() => handleOpenConsult(item)}>
                            {item.status === 'IN_CONSULTATION' ? 'RESUME' : 'START'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={3}>
          <Card sx={{ borderRadius: 4, bgcolor: 'primary.main', color: 'white', textAlign: 'center', p: 2 }}>
            <Typography variant="overline">Waiting for Review</Typography>
            <Typography variant="h2" fontWeight="900">{waitingList.length}</Typography>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );

  const renderConsultationWorkspace = () => (
    <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100vh' }}>
      <PatientContextBar /> {/* Sidebar with Color Coded Risk Alerts */}
      
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Grid container spacing={3}>
          {/* Left Panel: Clinical Data */}
          <Grid item xs={12} lg={3}>
             <Stack spacing={3}>
                <Paper sx={{ p: 2, borderRadius: 4, border: '1px solid #e2e8f0' }}>
                    <VitalsSnapshot vitals={currentVitals} />
                </Paper>
                <Paper sx={{ p: 2, borderRadius: 4, border: '1px solid #e2e8f0' }}>
                    <Typography variant