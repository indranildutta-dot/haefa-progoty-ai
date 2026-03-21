import React, { useState, useEffect } from 'react';
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
  InputAdornment,
  Alert,
  Divider,
  Card,
  CardContent,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Container
} from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import FavoriteIcon from '@mui/icons-material/Favorite';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { subscribeToQueue, updateQueueStatus, updateQueueTriage } from '../services/queueService';
import { saveVitals } from '../services/encounterService';
import { QueueItem, Vitals, Patient, TriageLevel } from '../types';
import { getPatientById } from '../services/patientService';
import { getPatientByQrToken } from '../services/qrService';
import { auth } from '../firebase';
import { VitalsSchema } from '../schemas/clinical';
import { useAppStore } from '../store/useAppStore';
import { evaluateTriage, TriageResult } from '../utils/triage';
import QrScannerModal from '../components/QrScannerModal';

interface VitalsStationProps {
  countryId: string;
}

import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const VitalsStation: React.FC<VitalsStationProps> = ({ countryId }) => {
  const { notify, selectedPatient, setSelectedPatient, userProfile, selectedClinic } = useAppStore();
  const { isMobile, isTablet } = useResponsiveLayout();
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<boolean>(false);

  // Triage State
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [manualTriageLevel, setManualTriageLevel] = useState<TriageLevel | null>(null);

  // Vitals Form State
  const [vitals, setVitals] = useState<Vitals>({
    systolic: 120,
    diastolic: 80,
    heartRate: 72,
    temperature: 36.5,
    weight: 70,
    height: 170,
    bmi: 24.2,
    oxygenSaturation: 98
  });

  useEffect(() => {
    if (!userProfile?.isApproved || !selectedClinic) {
      setWaitingList([]);
      return;
    }

    setPermissionError(false);
    const unsubscribe = subscribeToQueue(
      'WAITING_FOR_VITALS' as any, 
      (items) => {
        setWaitingList(items);
      },
      (error) => {
        console.error("Queue subscription error:", error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          setPermissionError(true);
        }
      }
    );
    return () => unsubscribe();
  }, [userProfile?.isApproved, selectedClinic]);

  // Calculate BMI automatically
  useEffect(() => {
    if (vitals.weight && vitals.height) {
      const heightInMeters = vitals.height / 100;
      const bmi = vitals.weight / (heightInMeters * heightInMeters);
      setVitals(prev => ({ ...prev, bmi: parseFloat(bmi.toFixed(1)) }));
    }
  }, [vitals.weight, vitals.height]);

  // Evaluate Triage automatically
  useEffect(() => {
    const result = evaluateTriage(vitals);
    setTriageResult(result);
  }, [vitals]);

  const handleSelectPatient = async (item: QueueItem) => {
    try {
      const patient = await getPatientById(item.patient_id);
      if (patient) {
        setSelectedPatient(patient);
        setSelectedQueueItem(item);
        setManualTriageLevel(null);
        setVitals({
          systolic: 120,
          diastolic: 80,
          heartRate: 72,
          temperature: 36.5,
          weight: 70,
          height: 170,
          bmi: 24.2,
          oxygenSaturation: 98
        });
      }
    } catch (err) {
      notify("Error loading patient details", "error");
    }
  };

  const handleCancel = () => {
    setSelectedPatient(null);
    setSelectedQueueItem(null);
  };

  const handleSaveVitals = async () => {
    if (!selectedQueueItem) return;
    setErrorMsg(null);
    try {
      // 1. Validate with Zod
      const validatedVitals = VitalsSchema.parse(vitals);

      // 2. Save Vitals
      await saveVitals({
        ...validatedVitals,
        encounter_id: selectedQueueItem.encounter_id,
        patient_id: selectedQueueItem.patient_id,
        created_by: auth.currentUser?.uid || 'unknown'
      });

      // 3. Update Queue Triage
      const finalTriageLevel = manualTriageLevel || triageResult?.triage_level || 'standard';
      const isManual = !!manualTriageLevel && manualTriageLevel !== triageResult?.triage_level;
      
      let finalPriorityScore = triageResult?.priority_score || 50;
      if (isManual) {
        if (finalTriageLevel === 'emergency') finalPriorityScore = 100;
        else if (finalTriageLevel === 'urgent') finalPriorityScore = 75;
        else if (finalTriageLevel === 'standard') finalPriorityScore = 50;
        else if (finalTriageLevel === 'low') finalPriorityScore = 25;
      }

      await updateQueueTriage(selectedQueueItem.id!, {
        triage_level: finalTriageLevel,
        priority_score: finalPriorityScore,
        triage_source: isManual ? 'manual' : 'automatic',
        triage_reason: triageResult?.triage_reason || 'Normal vitals'
      });

      // 4. Update Queue Status
      await updateQueueStatus(selectedQueueItem.id!, 'READY_FOR_DOCTOR' as any);

      notify(`Vitals recorded for ${selectedQueueItem.patient_name}`, 'success');
      handleCancel();
    } catch (err: any) {
      console.error(err);
      if (err.errors) {
        setErrorMsg(err.errors[0].message);
      } else {
        setErrorMsg("Failed to save vitals.");
      }
      notify("Failed to save vitals", "error");
    }
  };

  const renderWaitingList = () => {
    if (!userProfile?.isApproved) {
      return (
        <Alert severity="warning" sx={{ borderRadius: 3, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold">Account Pending Approval</Typography>
          Your account must be approved by a Global Administrator before you can access the patient queue.
        </Alert>
      );
    }

    if (permissionError) {
      return (
        <Alert severity="error" sx={{ borderRadius: 3, mb: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold">Permission Error</Typography>
          You do not have permission to view the patient queue for this clinic. 
          Please contact your administrator to ensure your clinic assignments and security rules are correctly configured.
        </Alert>
      );
    }

    return (
      <Grid container spacing={isMobile ? 2 : 3}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexDirection={isMobile ? 'column' : 'row'} gap={2}>
                <Box display="flex" alignItems="center">
                  <LocalHospitalIcon color="info" sx={{ mr: 1 }} />
                  <Typography variant="h6" fontWeight="800">Patients Waiting</Typography>
                </Box>
                <QrScannerModal onScan={async (token) => {
                  const patient = await getPatientByQrToken(token);
                  if (patient) {
                    const item = waitingList.find(i => i.patient_id === patient.id);
                    if (item) {
                      handleSelectPatient(item);
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
                                <Typography variant="subtitle1" fontWeight="bold">{item.patient_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Registered: {item.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </Box>
                              <Chip 
                                label={item.triage_level?.toUpperCase() || 'STANDARD'} 
                                size="small" 
                                color={item.triage_level === 'emergency' ? 'error' : item.triage_level === 'urgent' ? 'warning' : 'default'}
                              />
                            </Box>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                              <Typography variant="body2" sx={{ color: waitTime > 30 ? 'error.main' : 'success.main', fontWeight: 'bold' }}>
                                {waitTime} mins wait
                              </Typography>
                              <Button variant="contained" color="info" size="small" onClick={() => handleSelectPatient(item)}>
                                Take Vitals
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
                              <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_name}</TableCell>
                              <TableCell>{waitTime} mins</TableCell>
                              <TableCell>
                                <Chip label={item.triage_level?.toUpperCase() || 'STANDARD'} size="small" />
                              </TableCell>
                              <TableCell align="right">
                                <Button variant="contained" color="info" size="small" onClick={() => handleSelectPatient(item)}>
                                  Take Vitals
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
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom fontWeight="bold">QUEUE SUMMARY</Typography>
              <Typography variant="h3" fontWeight="800" color="info.main">{waitingList.length}</Typography>
              <Typography variant="body2" color="textSecondary">Patients waiting for vitals</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderVitalsForm = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="900" color="info.main" sx={{ textTransform: 'uppercase', fontSize: isMobile ? '1.25rem' : '1.5rem' }}>
          Record Vitals & Triage
        </Typography>
        <Button variant="outlined" color="inherit" onClick={handleCancel} size={isMobile ? "small" : "medium"}>Cancel</Button>
      </Box>

      <Grid container spacing={isMobile ? 2 : 3}>
        {/* Vital Signs Grid */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none', mb: 3 }}>
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Typography variant="h6" fontWeight="800" gutterBottom color="info.main">VITAL SIGNS</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField fullWidth label="Systolic" type="number" value={vitals.systolic} onChange={(e) => setVitals({ ...vitals, systolic: parseInt(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">mmHg</InputAdornment> }} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField fullWidth label="Diastolic" type="number" value={vitals.diastolic} onChange={(e) => setVitals({ ...vitals, diastolic: parseInt(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">mmHg</InputAdornment> }} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField fullWidth label="Heart Rate" type="number" value={vitals.heartRate} onChange={(e) => setVitals({ ...vitals, heartRate: parseInt(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">bpm</InputAdornment> }} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField fullWidth label="Temp" type="number" value={vitals.temperature} onChange={(e) => setVitals({ ...vitals, temperature: parseFloat(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField fullWidth label="Weight" type="number" value={vitals.weight} onChange={(e) => setVitals({ ...vitals, weight: parseFloat(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">kg</InputAdornment> }} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField fullWidth label="Height" type="number" value={vitals.height} onChange={(e) => setVitals({ ...vitals, height: parseFloat(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">cm</InputAdornment> }} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField fullWidth label="BMI" type="number" disabled value={vitals.bmi} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <TextField fullWidth label="SpO2" type="number" value={vitals.oxygenSaturation} onChange={(e) => setVitals({ ...vitals, oxygenSaturation: parseInt(e.target.value) })} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Triage Assessment Column */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'grey.50', height: '100%' }}>
            <CardContent sx={{ p: isMobile ? 2 : 3 }}>
              <Typography variant="h6" fontWeight="800" gutterBottom color="info.main">TRIAGE ASSESSMENT</Typography>
              
              {triageResult?.isCritical && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight="bold">CRITICAL VITALS</Typography>
                  Immediate attention required.
                </Alert>
              )}

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="textSecondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>Suggested Level</Typography>
                <Typography variant="h4" sx={{ 
                  color: triageResult?.triage_level === 'emergency' ? 'error.main' : 
                         triageResult?.triage_level === 'urgent' ? 'warning.main' : 'success.main',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  fontSize: isMobile ? '2rem' : '2.5rem'
                }}>
                  {triageResult?.triage_level || 'STANDARD'}
                </Typography>
                <Typography variant="body2" color="textSecondary">{triageResult?.triage_reason}</Typography>
              </Box>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Manual Override</InputLabel>
                <Select value={manualTriageLevel || ''} label="Manual Override" onChange={(e) => setManualTriageLevel(e.target.value as TriageLevel)}>
                  <MenuItem value=""><em>Use Suggested</em></MenuItem>
                  <MenuItem value="emergency">Emergency</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                  <MenuItem value="standard">Standard</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>

              <Button variant="contained" color="info" fullWidth size="large" onClick={handleSaveVitals} sx={{ py: 2, borderRadius: 2, fontWeight: 'bold' }}>
                Save & Send to Doctor
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <StationLayout
      title="Vitals & Triage"
      stationName="Vitals"
      showPatientContext={!!selectedPatient}
    >
      {!selectedPatient ? (
        <Box>
          <Box sx={{ mb: isMobile ? 2 : 4 }}>
            <Typography variant="subtitle1" color="text.secondary">
              Select a patient from the queue to record vitals.
            </Typography>
          </Box>
          {renderWaitingList()}
        </Box>
      ) : (
        renderVitalsForm()
      )}
    </StationLayout>
  );
};

export default VitalsStation;
