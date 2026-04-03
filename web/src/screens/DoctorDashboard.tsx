import React, { 
  useState, 
  useEffect 
} from 'react';
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
  Paper, 
  Stack, 
  Divider, 
  CircularProgress 
} from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import { auth } from "../firebase";
import { 
  subscribeToQueue, 
  updateQueueStatus 
} from '../services/queueService';
import { 
  saveConsultation, 
  getVitalsByEncounter, 
  updateEncounterStatus 
} from '../services/encounterService';
import { getPatientById } from '../services/patientService';
import { useAppStore } from '../store/useAppStore';
import StationLayout from '../components/StationLayout';
import PatientContextBar from '../components/PatientContextBar';
import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import ConsultationPanel from '../components/ConsultationPanel';
import VitalsSnapshot from '../components/VitalsSnapshot';
import { initialClinicalAssessment } from '../components/ClinicalAssessmentPanel';

interface DoctorDashboardProps {
  countryId: string;
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ countryId }) => {
  const { 
    notify, 
    selectedClinic, 
    setSelectedPatient 
  } = useAppStore();
  
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [currentVitals, setCurrentVitals] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  const [consultData, setConsultData] = useState<any>({ 
    diagnosis: '', 
    notes: '', 
    treatmentNotes: '', 
    prescriptions: [], 
    clinicalAssessment: initialClinicalAssessment 
  });

  /**
   * QUEUE SUBSCRIPTION:
   * Monitors patients ready for consultation or already in progress.
   */
  useEffect(() => {
    if (!selectedClinic) return;
    
    const unsubscribe = subscribeToQueue(
      ['READY_FOR_DOCTOR', 'IN_CONSULTATION'] as any, 
      setWaitingList, 
      (err) => console.error("Doctor Queue Error:", err)
    );
    
    return () => unsubscribe();
  }, [selectedClinic]);

  const formatWaitTime = (createdAt: any) => {
    if (!createdAt) return '0m';
    const totalMinutes = Math.floor((Date.now() - createdAt.toDate().getTime()) / 60000);
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  /**
   * PATIENT INTAKE LOGIC:
   * Sets the patient context and pulls the multi-station vitals 
   * recorded earlier (Anthropometry, Cardio, and Labs).
   */
  const handleOpenConsult = async (item: any) => {
    try {
      setSelectedItem(item);
      
      const [patient, vitals] = await Promise.all([
        getPatientById(item.patient_id), 
        getVitalsByEncounter(item.encounter_id)
      ]);
      
      setCurrentVitals(vitals);
      
      // Update global store for context-aware components
      setSelectedPatient({ 
        ...patient, 
        currentVitals: vitals, 
        triage_level: item.triage_level 
      });
      
      // Mark as active in the queue
      await updateQueueStatus(item.id, 'IN_CONSULTATION' as any);
      
    } catch (e) { 
      notify("Critical error loading patient context.", "error"); 
      console.error(e);
    }
  };

  const handleFinalize = async (status: string) => {
    if (!consultData.diagnosis) {
      notify("A primary diagnosis is required to finalize.", "warning");
      return;
    }
    
    setIsFinalizing(true);
    
    try {
      // PERSISTENCE HANDSHAKE:
      // Saves all clinical findings, prescriptions, and assessment notes.
      await saveConsultation({ 
        ...consultData, 
        encounter_id: selectedItem.encounter_id, 
        patient_id: selectedItem.patient_id, 
        created_by: auth.currentUser?.uid 
      });
      
      // Advance patient to Pharmacy or Complete
      await updateQueueStatus(selectedItem.id!, status as any);
      
      notify("Consultation finalized successfully.", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
      setConsultData({
        diagnosis: '', 
        notes: '', 
        treatmentNotes: '', 
        prescriptions: [], 
        clinicalAssessment: initialClinicalAssessment
      });
      
    } catch (e) { 
      notify("Database Error: Failed to save consultation data.", "error"); 
      console.error(e);
    } finally {
      setIsFinalizing(false);
    }
  };

  const triageColors: any = { 
    emergency: '#ef4444', 
    urgent: '#f59e0b', 
    standard: '#10b981' 
  };

  return (
    <StationLayout 
      title="Doctor Dashboard" 
      stationName="Doctor" 
      showPatientContext={!!selectedItem}
      hideSidebar={!!selectedItem}
    >
      {!selectedItem ? (
        <TableContainer 
          component={Paper} 
          elevation={0} 
          sx={{ 
            p: 2, 
            borderRadius: 4, 
            border: '1px solid #e2e8f0',
            bgcolor: 'white'
          }}
        >
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Wait Time</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Triage</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Patient Name</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {waitingList.map(item => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TimerIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> 
                      <Typography variant="body2">
                        {formatWaitTime(item.created_at)}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.triage_level?.toUpperCase()} 
                      size="small" 
                      sx={{ 
                        bgcolor: triageColors[item.triage_level] || '#94a3b8', 
                        color: 'white', 
                        fontWeight: 900,
                        fontSize: '0.65rem'
                      }} 
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {item.patient_name}
                  </TableCell>
                  <TableCell align="right">
                    <Button 
                      variant="contained" 
                      color="primary"
                      onClick={() => handleOpenConsult(item)}
                      sx={{ borderRadius: 2, fontWeight: 700 }}
                    >
                      Start Consultation
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {waitingList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 12 }}>
                    <Typography variant="body1" color="text.secondary">
                      The consultation queue is currently empty.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ mt: -3 }}>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* LEFT COLUMN: Vitals & Lab Results */}
            <Grid size={{ xs: 12, md: 3 }}>
              <VitalsSnapshot vitals={currentVitals} />
            </Grid>

            {/* MIDDLE COLUMN: Clinical Assessment & Prescription */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper 
                elevation={0}
                sx={{ 
                  p: 4, 
                  borderRadius: 4, 
                  minHeight: '700px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <Typography variant="h6" fontWeight="900" gutterBottom color="primary">
                  CLINICAL ASSESSMENT
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                {/* FIXED ID HANDSHAKE:
                   Explicitly passing patientId and encounterId to ensure 
                   ConsultationPanel anchors data correctly.
                */}
                <ConsultationPanel 
                  data={consultData} 
                  onChange={setConsultData} 
                  patientId={selectedItem.patient_id}
                  encounterId={selectedItem.encounter_id}
                />
                
                <Box sx={{ mt: 6 }}>
                  <Stack direction="row" spacing={2}>
                    <Button 
                      fullWidth 
                      variant="outlined" 
                      sx={{ height: 65, fontWeight: 900, borderRadius: 3 }} 
                      onClick={() => setSelectedItem(null)}
                    >
                      Save Progress
                    </Button>
                    <Button 
                      fullWidth 
                      variant="contained" 
                      color="secondary" 
                      sx={{ height: 65, fontWeight: 900, borderRadius: 3 }} 
                      disabled={isFinalizing}
                      onClick={() => handleFinalize('WAITING_FOR_PHARMACY')}
                    >
                      {isFinalizing ? <CircularProgress size={24} color="inherit" /> : "SEND TO PHARMACY"}
                    </Button>
                  </Stack>
                </Box>
              </Paper>
            </Grid>

            {/* RIGHT COLUMN: Patient History & Trends */}
            <Grid size={{ xs: 12, md: 3 }}>
              <PatientHistoryTimeline patientId={selectedItem.patient_id} />
            </Grid>
          </Grid>
        </Box>
      )}
    </StationLayout>
  );
};

export default DoctorDashboard;