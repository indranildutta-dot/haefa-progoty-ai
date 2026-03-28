import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Button, Chip, Paper, Stack, Divider, CircularProgress 
} from '@mui/material';
import TimerIcon from '@mui/icons-material/Timer';
import { auth } from "../firebase";
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { saveConsultation, getVitalsByEncounter, updateEncounterStatus } from '../services/encounterService';
import { getPatientById } from '../services/patientService';
import { useAppStore } from '../store/useAppStore';
import StationLayout from '../components/StationLayout';
import PatientContextBar from '../components/PatientContextBar';
import PatientHistoryTimeline from '../components/PatientHistoryTimeline';
import ConsultationPanel from '../components/ConsultationPanel';
import VitalsSnapshot from '../components/VitalsSnapshot';
import { initialClinicalAssessment } from '../components/ClinicalAssessmentPanel';

const DoctorDashboard: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { notify, selectedClinic, setSelectedPatient } = useAppStore();
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

  useEffect(() => {
    if (!selectedClinic) return;
    return subscribeToQueue(['READY_FOR_DOCTOR', 'IN_CONSULTATION'] as any, setWaitingList, (err) => console.error(err));
  }, [selectedClinic]);

  const formatWaitTime = (createdAt: any) => {
    if (!createdAt) return '0m';
    const totalMinutes = Math.floor((Date.now() - createdAt.toDate().getTime()) / 60000);
    return totalMinutes < 60 ? `${totalMinutes}m` : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  };

  const handleOpenConsult = async (item: any) => {
    try {
      setSelectedItem(item);
      const [patient, vitals] = await Promise.all([
        getPatientById(item.patient_id), 
        getVitalsByEncounter(item.encounter_id)
      ]);
      setCurrentVitals(vitals);
      setSelectedPatient({ ...patient, currentVitals: vitals, triage_level: item.triage_level });
      await updateQueueStatus(item.id, 'IN_CONSULTATION' as any);
    } catch (e) { 
      notify("Error loading patient context", "error"); 
    }
  };

  const handleFinalize = async (status: string) => {
    if (!consultData.diagnosis) return notify("Diagnosis is required.", "warning");
    setIsFinalizing(true);
    try {
      await saveConsultation({ 
        ...consultData, 
        encounter_id: selectedItem.encounter_id, 
        patient_id: selectedItem.patient_id, 
        created_by: auth.currentUser?.uid 
      });
      await updateQueueStatus(selectedItem.id!, status as any);
      notify("Consultation finalized successfully", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
    } catch (e) { 
      notify("Failed to save consultation", "error"); 
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
    <StationLayout title="Doctor Dashboard" stationName="Doctor" showPatientContext={!!selectedItem}>
      {!selectedItem ? (
        <TableContainer component={Paper} elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid #e2e8f0' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell>Wait Time</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Patient Name</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {waitingList.map(item => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TimerIcon sx={{ fontSize: 16 }}/> 
                      {formatWaitTime(item.created_at)}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.triage_level?.toUpperCase()} 
                      size="small" 
                      sx={{ bgcolor: triageColors[item.triage_level] || '#94a3b8', color: 'white', fontWeight: 900 }} 
                    />
                  </TableCell>
                  <TableCell fontWeight="bold">{item.patient_name}</TableCell>
                  <TableCell align="right">
                    <Button variant="contained" onClick={() => handleOpenConsult(item)}>Start Consultation</Button>
                  </TableCell>
                </TableRow>
              ))}
              {waitingList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No patients currently waiting for consultation.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100vh' }}>
          <PatientContextBar />
          <Grid container spacing={2} sx={{ p: 2 }}>
            <Grid item xs={12} lg={3}>
              <VitalsSnapshot vitals={currentVitals} />
            </Grid>
            <Grid item xs={12} lg={6}>
              <Paper sx={{ p: 4, borderRadius: 4, minHeight: '600px' }}>
                <Typography variant="h6" fontWeight="900" gutterBottom>CLINICAL ASSESSMENT</Typography>
                <ConsultationPanel data={consultData} onChange={setConsultData} />
                <Divider sx={{ my: 4 }} />
                <Stack direction="row" spacing={2}>
                  <Button fullWidth variant="outlined" sx={{ height: 65, fontWeight: 900 }} onClick={() => setSelectedItem(null)}>Save Draft</Button>
                  <Button 
                    fullWidth 
                    variant="contained" 
                    color="secondary" 
                    sx={{ height: 65, fontWeight: 900 }} 
                    disabled={isFinalizing}
                    onClick={() => handleFinalize('WAITING_FOR_PHARMACY')}
                  >
                    SEND TO PHARMACY
                  </Button>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={3}>
              <PatientHistoryTimeline patientId={selectedItem.patient_id} />
            </Grid>
          </Grid>
        </Box>
      )}
    </StationLayout>
  );
};

export default DoctorDashboard;