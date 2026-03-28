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
  Stepper, 
  Step, 
  StepLabel, 
  CircularProgress, 
  Stack, 
  RadioGroup, 
  FormControlLabel, 
  Radio, 
  Autocomplete 
} from '@mui/material';
import { 
  MonitorWeight as WeightIcon, 
  Height as HeightIcon, 
  Favorite as HeartIcon, 
  Bloodtype as BloodIcon, 
  Thermostat as TempIcon,
  Warning as WarningIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Timer as TimerIcon,
  Opacity as OpacityIcon
} from '@mui/icons-material';

import { subscribeToQueue, updateQueueStatus, updateQueueTriage } from '../services/queueService';
import { saveVitals } from '../services/encounterService';
import { QueueItem, Vitals, TriageLevel } from '../types';
import { getPatientById } from '../services/patientService';
import { auth } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { evaluateTriage, TriageResult } from '../utils/triage';
import StationLayout from '../components/StationLayout';

const VitalsStation: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { notify, selectedClinic, setSelectedPatient, selectedPatient } = useAppStore();
  
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // GLOBAL CLINICAL STATE - Standards applied for all clinics
  const [vitals, setVitals] = useState<any>({
    systolic: 120,
    diastolic: 80,
    heartRate: 72,
    temperature: 36.5,
    weight: 70,
    height: 170,
    bmi: 24.2,
    oxygenSaturation: 98,
    blood_sugar: '',
    hemoglobin: '', 
    chief_complaint: '',
    onset_date: '',
    duration_value: '',
    duration_unit: 'days',
    is_pregnant: 'no',
    pregnancy_months: '',
    alcohol_consumption: 'none',
    tobacco_use: 'none', 
    allergies: '',
    chronic_conditions: [],
    nurse_priority: '' 
  });

  const steps = ['Complaints', 'Station 1: Body', 'Station 2: Vitals', 'Station 3: Labs & Risk'];

  useEffect(() => {
    if (!selectedClinic) return;
    const unsubscribe = subscribeToQueue('WAITING_FOR_VITALS' as any, setWaitingList, (err) => console.error(err));
    return () => unsubscribe();
  }, [selectedClinic]);

  // Global BMI Auto-calculation
  useEffect(() => {
    if (vitals.weight && vitals.height) {
      const heightInMeters = vitals.height / 100;
      const bmi = (vitals.weight / (heightInMeters * heightInMeters)).toFixed(1);
      setVitals((prev: any) => ({ ...prev, bmi: parseFloat(bmi) }));
    }
  }, [vitals.weight, vitals.height]);

  // Smart Wait-Time Formatting: Shows hours if > 60 mins
  const formatWaitTime = (createdAt: any) => {
    if (!createdAt) return '0 min';
    const totalMinutes = Math.floor((Date.now() - createdAt.toDate().getTime()) / 60000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} hr ${mins} min`;
  };

  const systemTriage = evaluateTriage(vitals);

  const getVitalStatus = (type: 'bp' | 'hr' | 'o2', val1: number, val2?: number) => {
    if (type === 'bp') {
      if (val1 >= 180 || (val2 && val2 >= 120)) return { color: '#ef4444', label: 'EMERGENCY' };
      if (val1 >= 140 || (val2 && val2 >= 90)) return { color: '#f59e0b', label: 'URGENT' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    if (type === 'hr') {
      if (val1 > 120 || val1 < 50) return { color: '#ef4444', label: 'EMERGENCY' };
      if (val1 > 100 || val1 < 60) return { color: '#f59e0b', label: 'URGENT' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    return { color: '#e2e8f0', label: '' };
  };

  const handleSelectPatient = async (item: QueueItem) => {
    const patient = await getPatientById(item.patient_id);
    if (patient) {
      setSelectedPatient(patient);
      setSelectedQueueItem(item);
      setActiveStep(0);
      setVitals({
        systolic: 120, diastolic: 80, heartRate: 72, temperature: 36.5,
        weight: 70, height: 170, bmi: 24.2, oxygenSaturation: 98,
        blood_sugar: '', hemoglobin: '', 
        chief_complaint: '', onset_date: '', duration_value: '', duration_unit: 'days',
        is_pregnant: 'no', pregnancy_months: '',
        alcohol_consumption: 'none', tobacco_use: 'none', 
        allergies: '', chronic_conditions: [],
        nurse_priority: ''
      });
    }
  };

  const handleSaveVitals = async () => {
    if (!selectedQueueItem) return;
    setIsSaving(true);
    try {
      const finalPriority = vitals.nurse_priority || systemTriage.triage_level;
      await saveVitals({
        ...vitals,
        suggested_priority: systemTriage.triage_level,
        assigned_priority: finalPriority,
        encounter_id: selectedQueueItem.encounter_id,
        patient_id: selectedQueueItem.patient_id,
        created_by: auth.currentUser?.uid || 'unknown'
      });
      await updateQueueTriage(selectedQueueItem.id!, {
        triage_level: finalPriority,
        priority_score: finalPriority === 'emergency' ? 100 : finalPriority === 'urgent' ? 75 : 50,
      });
      await updateQueueStatus(selectedQueueItem.id!, 'READY_FOR_DOCTOR' as any);
      notify(`Triage complete for ${selectedQueueItem.patient_name}`, 'success');
      setSelectedPatient(null);
      setSelectedQueueItem(null);
      setActiveStep(0);
    } catch (err) {
      notify("Failed to save triage data", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StationLayout title="Nurse Triage Station" stationName="Vitals" showPatientContext={!!selectedPatient}>
      {!selectedPatient ? (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 5, border: '1px solid #e2e8f0' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Wait Time</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Patient Name</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {waitingList.map(item => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TimerIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="body2">{formatWaitTime(item.created_at)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell fontWeight="bold" sx={{ py: 3 }}>{item.patient_name}</TableCell>
                  <TableCell align="right">
                    <Button variant="contained" size="large" onClick={() => handleSelectPatient(item)}>Start Triage</Button>
                  </TableCell>
                </TableRow>
              ))}
              {waitingList.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 10 }}>No patients waiting in queue.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ maxWidth: 850, mx: 'auto' }}>
          <Stepper activeStep={activeStep} sx={{ mb: 6 }} alternativeLabel>
            {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          <Paper elevation={0} sx={{ p: 5, borderRadius: 6, border: '1px solid #cbd5e1', bgcolor: 'white' }}>
            {activeStep === 0 && (
              <Stack spacing={4}>
                <Typography variant="h5" fontWeight="900" color="primary">CHIEF COMPLAINT</Typography>
                <TextField fullWidth multiline rows={4} label="Reason for Visit" value={vitals.chief_complaint} onChange={(e) => setVitals({...vitals, chief_complaint: e.target.value})} />
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}><TextField fullWidth label="Approx Onset Date" type="date" InputLabelProps={{ shrink: true }} value={vitals.onset_date} onChange={(e) => setVitals({...vitals, onset_date: e.target.value})} /></Grid>
                  <Grid item xs={12} md={6}>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth label="Duration" type="number" value={vitals.duration_value} onChange={(e) => setVitals({...vitals, duration_value: e.target.value})} />
                      <Select sx={{ width: 120 }} value={vitals.duration_unit} onChange={(e) => setVitals({...vitals, duration_unit: e.target.value})}>
                        <MenuItem value="days">Days</MenuItem><MenuItem value="weeks">Weeks</MenuItem><MenuItem value="months">Months</MenuItem>
                      </Select>
                    </Stack>
                  </Grid>
                </Grid>
              </Stack>
            )}

            {activeStep === 1 && (
              <Stack spacing={4}>
                <Typography variant="h5" fontWeight="900" color="primary">STATION 1: BODY MEASURES</Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}><TextField fullWidth label="Weight (kg)" type="number" value={vitals.weight} onChange={(e) => setVitals({...vitals, weight: parseFloat(e.target.value)})} InputProps={{ sx: { height: 90, fontSize: '2rem' }}} /></Grid>
                  <Grid item xs={12} md={6}><TextField fullWidth label="Height (cm)" type="number" value={vitals.height} onChange={(e) => setVitals({...vitals, height: parseFloat(e.target.value)})} InputProps={{ sx: { height: 90, fontSize: '2rem' }}} /></Grid>
                </Grid>
                <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'primary.main', color: 'white', borderRadius: 4 }}>
                  <Typography variant="h6">Calculated BMI</Typography>
                  <Typography variant="h2" fontWeight="900">{vitals.bmi || '--'}</Typography>
                </Paper>
                {selectedPatient?.gender?.toLowerCase() === 'female' && (
                  <Card variant="outlined" sx={{ p: 3, borderRadius: 4, bgcolor: '#fff1f2', border: '1px solid #fecdd3' }}>
                    <Typography variant="subtitle1" fontWeight="bold">Pregnancy Screening</Typography>
                    <RadioGroup row value={vitals.is_pregnant} onChange={(e) => setVitals({...vitals, is_pregnant: e.target.value})}>
                      <FormControlLabel value="yes" control={<Radio color="error" />} label="Pregnant" />
                      <FormControlLabel value="no" control={<Radio />} label="Not Pregnant" />
                    </RadioGroup>
                    {vitals.is_pregnant === 'yes' && (
                      <TextField label="How many months?" fullWidth sx={{ mt: 2, bgcolor: 'white' }} value={vitals.pregnancy_months} onChange={(e) => setVitals({...vitals, pregnancy_months: e.target.value})} />
                    )}
                  </Card>
                )}
              </Stack>
            )}

            {activeStep === 2 && (
              <Stack spacing={4}>
                <Typography variant="h5" fontWeight="900" color="primary">STATION 2: CARDIOVASCULAR</Typography>
                <Box sx={{ p: 4, borderRadius: 5, border: `6px solid ${getVitalStatus('bp', vitals.systolic, vitals.diastolic).color}`, textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight="900" color={getVitalStatus('bp', vitals.systolic, vitals.diastolic).color}>{getVitalStatus('bp', vitals.systolic, vitals.diastolic).label}</Typography>
                  <Stack direction="row" spacing={3} justifyContent="center" alignItems="center">
                    <TextField label="Systolic" type="number" value={vitals.systolic} onChange={(e) => setVitals({...vitals, systolic: parseInt(e.target.value)})} InputProps={{ sx: { fontSize: '3rem', textAlign: 'center' }}} />
                    <Typography variant="h1">/</Typography>
                    <TextField label="Diastolic" type="number" value={vitals.diastolic} onChange={(e) => setVitals({...vitals, diastolic: parseInt(e.target.value)})} InputProps={{ sx: { fontSize: '3rem', textAlign: 'center' }}} />
                  </Stack>
                </Box>
                <Grid container spacing={3}>
                  <Grid item xs={6}><TextField fullWidth label="Heart Rate" value={vitals.heartRate} onChange={(e) => setVitals({...vitals, heartRate: parseInt(e.target.value)})} /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="SpO2 (%)" value={vitals.oxygenSaturation} onChange={(e) => setVitals({...vitals, oxygenSaturation: parseInt(e.target.value)})} /></Grid>
                </Grid>
              </Stack>
            )}

            {activeStep === 3 && (
              <Stack spacing={3}>
                <Typography variant="h5" fontWeight="900" color="primary">STATION 3: FINAL TRIAGE</Typography>
                <Autocomplete multiple options={['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease']} value={vitals.chronic_conditions} onChange={(_, v) => setVitals({...vitals, chronic_conditions: v})} renderInput={(p) => <TextField {...p} label="Chronic Conditions" />} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Tobacco Use</InputLabel>
                      <Select value={vitals.tobacco_use} label="Tobacco Use" onChange={(e) => setVitals({...vitals, tobacco_use: e.target.value})}>
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="smoking">Smoking</MenuItem>
                        <MenuItem value="chewing">Chewing (Gutkha/Pan Masala)</MenuItem>
                        <MenuItem value="both">Both</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Alcohol Consumption</InputLabel>
                      <Select value={vitals.alcohol_consumption} label="Alcohol Consumption" onChange={(e) => setVitals({...vitals, alcohol_consumption: e.target.value})}>
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="occasional">Occasional</MenuItem>
                        <MenuItem value="regular">Regular</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <TextField fullWidth multiline rows={2} label="Allergies" value={vitals.allergies} onChange={(e) => setVitals({...vitals, allergies: e.target.value})} />
                
                <Divider sx={{ my: 3 }} />
                
                <Box sx={{ p: 3, bgcolor: '#f0f9ff', borderRadius: 4, border: '1px solid #bae6fd' }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>SYSTEM SUGGESTION: <strong>{systemTriage.triage_level.toUpperCase()}</strong></Typography>
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>NURSE OVERRIDE</InputLabel>
                    <Select value={vitals.nurse_priority} label="NURSE OVERRIDE" onChange={(e) => setVitals({...vitals, nurse_priority: e.target.value})} sx={{ height: 80, fontWeight: 'bold', bgcolor: 'white' }}>
                      <MenuItem value=""><em>Follow System</em></MenuItem>
                      <MenuItem value="emergency" sx={{ color: 'error.main', fontWeight: 'bold' }}>EMERGENCY (Red)</MenuItem>
                      <MenuItem value="urgent" sx={{ color: 'warning.main', fontWeight: 'bold' }}>URGENT (Yellow)</MenuItem>
                      <MenuItem value="standard" sx={{ color: 'success.main', fontWeight: 'bold' }}>NORMAL (Green)</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Stack>
            )}

            <Stack direction="row" spacing={3} sx={{ mt: 6 }}>
              <Button fullWidth size="large" variant="outlined" sx={{ height: 80, fontWeight: 800 }} onClick={activeStep === 0 ? () => setSelectedPatient(null) : () => setActiveStep(s => s - 1)}>{activeStep === 0 ? "Cancel" : "Back"}</Button>
              <Button fullWidth size="large" variant="contained" sx={{ height: 80, fontWeight: 900 }} onClick={activeStep === 3 ? handleSaveVitals : () => setActiveStep(s => s + 1)} disabled={isSaving}>
                {activeStep === 3 ? (isSaving ? "Saving..." : "FINISH") : "NEXT STATION"}
              </Button>
            </Stack>
          </Paper>
        </Box>
      )}
    </StationLayout>
  );
};

export default VitalsStation;