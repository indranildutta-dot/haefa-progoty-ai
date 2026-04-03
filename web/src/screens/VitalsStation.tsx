import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Button, Chip, TextField, Divider, Card, CardContent, MenuItem, Select, FormControl, 
  InputLabel, Stepper, Step, StepLabel, Stack, RadioGroup, FormControlLabel, Radio, Autocomplete,
  ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { EncounterStatus } from '../types';
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
import { saveVitals, getVitalsByEncounter } from '../services/encounterService';
import { QueueItem, Vitals, TriageLevel, VitalsRecord } from '../types';
import { getPatientById } from '../services/patientService';
import { auth } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { evaluateTriage, TriageResult } from '../utils/triage';
import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface VitalsStationProps {
  countryId: string;
  mode: 1 | 2 | 3;
}

const VitalsStation: React.FC<VitalsStationProps> = ({ countryId, mode }) => {
  const { notify, selectedClinic, setSelectedPatient, selectedPatient } = useAppStore();
  
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { isMobile, isTablet } = useResponsiveLayout();

  // Determine station status based on mode
  const station = mode === 1 ? 'WAITING_FOR_VITALS' : 
                  mode === 2 ? 'WAITING_FOR_VITALS_2' : 'WAITING_FOR_VITALS_3';

  // Title logic based on mode and device
  const stationTitle = mode === 1 ? 'BODY MEASURES' :
                       mode === 2 ? (isMobile || isTablet ? 'VITALS' : 'VITAL SIGNS') : 
                       'LABS & RISK';

  const stationName = mode === 1 ? 'Body Measures' : 
                      mode === 2 ? (isMobile || isTablet ? 'Vitals' : 'Vital Signs') : 
                      'Labs & Risk';

  // GLOBAL CLINICAL STATE - Standards applied for all clinics
  const initialVitals = {
    systolic: 120,
    diastolic: 80,
    heartRate: 72,
    temperature: 36.5,
    weight: 70,
    height: 170,
    bmi: 24.2,
    bmi_class: 'Healthy Weight',
    muac: '',
    muac_class: '',
    blood_group: '',
    oxygenSaturation: 98,
    blood_sugar: 0,
    hemoglobin: 0, 
    chief_complaint: '',
    onset_date: '',
    duration_value: '',
    duration_unit: 'days',
    is_pregnant: false,
    pregnancy_months: 0,
    alcohol_consumption: 'none',
    tobacco_use: 'none', 
    allergies: '',
    chronic_conditions: [],
    nurse_priority: '' 
  };

  const [vitals, setVitals] = useState<any>(initialVitals);

  useEffect(() => {
    if (!selectedClinic) return;
    const unsubscribe = subscribeToQueue(station as any, setWaitingList, (err) => console.error(err));
    return () => unsubscribe();
  }, [selectedClinic, station]);

  const getBMIClass = (bmi: number) => {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Healthy Weight';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
  };

  const getMUACClass = (muac: number) => {
    if (!muac) return '';
    if (muac < 21) return 'Severely Malnourished';
    if (muac < 23) return 'Moderately Malnourished';
    return 'Normal';
  };

  // Global BMI & MUAC Auto-calculation
  useEffect(() => {
    const updates: any = {};
    
    if (vitals.weight && vitals.height) {
      const heightInMeters = vitals.height / 100;
      const bmi = parseFloat((vitals.weight / (heightInMeters * heightInMeters)).toFixed(1));
      updates.bmi = bmi;
      updates.bmi_class = getBMIClass(bmi);
    }

    if (vitals.muac) {
      updates.muac_class = getMUACClass(vitals.muac);
    }

    if (Object.keys(updates).length > 0) {
      setVitals((prev: any) => ({ ...prev, ...updates }));
    }
  }, [vitals.weight, vitals.height, vitals.muac]);

  // SAFETY SENTINEL SYNC: Ensures top bar updates as nurse types
  useEffect(() => {
    if (selectedPatient) {
      setSelectedPatient({
        ...selectedPatient,
        currentVitals: { ...vitals, triage_level: evaluateTriage(vitals, selectedPatient?.age_years, selectedPatient?.age_months).triage_level }
      });
    }
  }, [vitals.is_pregnant, vitals.tobacco_use, vitals.allergies]);

  // Smart Wait-Time Formatting: Shows hours if > 60 mins
  const formatWaitTime = (createdAt: any) => {
    if (!createdAt) return '0 min';
    const totalMinutes = Math.floor((Date.now() - createdAt.toDate().getTime()) / 60000);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours} hr ${mins} min`;
  };

  const systemTriage = evaluateTriage(vitals, selectedPatient?.age_years, selectedPatient?.age_months);

  const getVitalStatus = (type: 'bp' | 'hr' | 'o2', val1: number, val2?: number) => {
    if (type === 'bp') {
      if (val1 >= 180 || (val2 && val2 >= 120)) return { color: '#ef4444', label: 'EMERGENCY' };
      if (val1 >= 140 || (val2 && val2 >= 90)) return { color: '#f59e0b', label: 'URGENT' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    if (type === 'hr') {
      const age_years = selectedPatient?.age_years ?? 25;
      const age_months = selectedPatient?.age_months ?? 0;
      let hrLow = 50;
      let hrHigh = 120;

      if (age_years < 1 || (age_years === 0 && age_months > 0)) {
        hrLow = 100;
        hrHigh = 180;
      } else if (age_years >= 1 && age_years <= 12) {
        hrLow = 60;
        hrHigh = 140;
      }

      if (val1 > hrHigh || val1 < hrLow) return { color: '#ef4444', label: 'EMERGENCY' };
      if (val1 > (hrHigh - 10) || val1 < (hrLow + 10)) return { color: '#f59e0b', label: 'URGENT' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    if (type === 'o2') {
      if (val1 < 88) return { color: '#ef4444', label: 'EMERGENCY' };
      if (val1 < 90) return { color: '#f43f5e', label: 'CRITICAL' };
      if (val1 <= 92) return { color: '#f59e0b', label: 'WARNING' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    return { color: '#e2e8f0', label: '' };
  };

  const handleSelectPatient = async (item: QueueItem) => {
    const patient = await getPatientById(item.patient_id);
    if (patient) {
      setSelectedPatient(patient);
      setSelectedQueueItem(item);
      
      // Fetch existing vitals for this encounter
      const existingVitals = await getVitalsByEncounter(item.encounter_id);
      if (existingVitals) {
        setVitals({
          ...initialVitals,
          ...existingVitals,
          // Ensure is_pregnant is false for non-female patients
          is_pregnant: patient.gender?.toLowerCase() === 'female' ? existingVitals.is_pregnant : false
        });
      } else {
        setVitals(initialVitals);
      }
    }
  };

  const handleSaveVitals = async (nextStatus: EncounterStatus) => {
    if (!selectedQueueItem) return;
    setIsSaving(true);
    try {
      const finalPriority = vitals.nurse_priority || systemTriage.triage_level;
      
      // 1. Save clinical vitals record
      await saveVitals({
        ...vitals,
        is_pregnant: !!vitals.is_pregnant,
        pregnancy_months: parseInt(vitals.pregnancy_months) || 0,
        allergies: vitals.allergies ? vitals.allergies.split(',').map((s: string) => s.trim()) : [],
        suggested_priority: systemTriage.triage_level,
        assigned_priority: finalPriority,
        encounter_id: selectedQueueItem.encounter_id,
        patient_id: selectedQueueItem.patient_id,
        created_by: auth.currentUser?.uid || 'unknown'
      }, nextStatus);
      
      // 2. Update the active queue item status and triage level
      await updateQueueStatus(selectedQueueItem.id, nextStatus);
      await updateQueueTriage(selectedQueueItem.id, {
        triage_level: finalPriority as TriageLevel,
        priority_score: systemTriage.priority_score
      });
      
      notify(`Patient moved to ${nextStatus.replace(/_/g, ' ')}`, 'success');
      
      // Reset
      setSelectedPatient(null);
      setSelectedQueueItem(null);
    } catch (err) {
      console.error("Vitals Save Error:", err);
      notify("Failed to save triage data", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <StationLayout title={stationTitle} stationName={stationName} showPatientContext={!!selectedPatient}>
      {!selectedPatient ? (
        <Box>
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
                    <TableCell sx={{ fontWeight: 'bold', py: 3 }}>{item.patient_name}</TableCell>
                    <TableCell align="right">
                      <Button 
                        variant="contained" 
                        size="large" 
                        onClick={() => handleSelectPatient(item)}
                        sx={{ height: 60, borderRadius: 3, px: 4, fontWeight: 900 }}
                      >
                        Start Triage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {waitingList.length === 0 && <TableRow><TableCell colSpan={3} align="center" sx={{ py: 10 }}>No patients waiting in queue.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : (
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
          <Paper elevation={0} sx={{ p: { xs: 3, md: 6 }, borderRadius: 6, border: '1px solid #cbd5e1', bgcolor: 'white' }}>
            {mode === 1 && (
              <Stack spacing={6}>
                <Typography variant="h4" fontWeight="900" color="primary" textAlign="center">ANTHROPOMETRY</Typography>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Weight (kg)" 
                      type="number" 
                      value={vitals.weight} 
                      onChange={(e) => setVitals({...vitals, weight: parseFloat(e.target.value)})} 
                      InputProps={{ sx: { height: 100, fontSize: '2rem', fontWeight: 800 }}} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Height (cm)" 
                      type="number" 
                      value={vitals.height} 
                      onChange={(e) => setVitals({...vitals, height: parseFloat(e.target.value)})} 
                      InputProps={{ sx: { height: 100, fontSize: '2rem', fontWeight: 800 }}} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="BMI" 
                      disabled
                      value={vitals.bmi || ''} 
                      InputProps={{ sx: { height: 100, fontSize: '2rem', fontWeight: 800, bgcolor: '#f8fafc' }}} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="BMI Class" 
                      disabled
                      value={vitals.bmi_class || ''} 
                      InputProps={{ sx: { height: 100, fontSize: '1.5rem', fontWeight: 800, bgcolor: '#f8fafc', color: 'primary.main' }}} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="MUAC (cm)" 
                      type="number" 
                      value={vitals.muac} 
                      onChange={(e) => setVitals({...vitals, muac: parseFloat(e.target.value)})} 
                      InputProps={{ sx: { height: 100, fontSize: '2rem', fontWeight: 800 }}} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="MUAC Class" 
                      disabled
                      value={vitals.muac_class || ''} 
                      InputProps={{ sx: { height: 100, fontSize: '1.5rem', fontWeight: 800, bgcolor: '#f8fafc', color: 'primary.main' }}} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <FormControl fullWidth>
                      <InputLabel sx={{ fontWeight: 700 }}>Blood Group</InputLabel>
                      <Select 
                        value={vitals.blood_group} 
                        label="Blood Group" 
                        onChange={(e) => setVitals({...vitals, blood_group: e.target.value})}
                        sx={{ height: 80, fontSize: '1.5rem', fontWeight: 700 }}
                      >
                        <MenuItem value="">-- Select --</MenuItem>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                          <MenuItem key={bg} value={bg}>{bg}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
                
                {selectedPatient?.gender?.toLowerCase() === 'female' && (
                  <Card variant="outlined" sx={{ p: 4, borderRadius: 4, bgcolor: '#fff1f2', border: '1px solid #fecdd3' }}>
                    <Typography variant="h5" fontWeight="900" color="error.main" gutterBottom>Pregnancy Screening</Typography>
                    <RadioGroup row value={vitals.is_pregnant ? 'yes' : 'no'} onChange={(e) => setVitals({...vitals, is_pregnant: e.target.value === 'yes'})}>
                      <FormControlLabel value="yes" control={<Radio color="error" size="medium" />} label={<Typography variant="h6" fontWeight="700">Pregnant</Typography>} sx={{ mr: 4 }} />
                      <FormControlLabel value="no" control={<Radio size="medium" />} label={<Typography variant="h6" fontWeight="700">Not Pregnant</Typography>} />
                    </RadioGroup>
                    {vitals.is_pregnant && (
                      <TextField 
                        label="How many months?" 
                        fullWidth 
                        sx={{ mt: 3, bgcolor: 'white' }} 
                        value={vitals.pregnancy_months} 
                        onChange={(e) => setVitals({...vitals, pregnancy_months: e.target.value})} 
                        InputProps={{ sx: { height: 80, fontSize: '2rem', fontWeight: 700 }}}
                      />
                    )}
                  </Card>
                )}
              </Stack>
            )}

            {mode === 2 && (
              <Stack spacing={6}>
                <Typography variant="h4" fontWeight="900" color="primary" textAlign="center">VITALS & HABITS</Typography>
                <Box sx={{ p: 5, borderRadius: 5, border: `10px solid ${getVitalStatus('bp', vitals.systolic, vitals.diastolic).color}`, textAlign: 'center', bgcolor: 'white' }}>
                  <Typography variant="h5" fontWeight="900" color={getVitalStatus('bp', vitals.systolic, vitals.diastolic).color} sx={{ mb: 2 }}>
                    {getVitalStatus('bp', vitals.systolic, vitals.diastolic).label}
                  </Typography>
                  <Stack direction="row" spacing={4} justifyContent="center" alignItems="center">
                    <TextField 
                      label="Systolic" 
                      type="number" 
                      value={vitals.systolic} 
                      onChange={(e) => setVitals({...vitals, systolic: parseInt(e.target.value)})} 
                      InputProps={{ sx: { fontSize: '5rem', fontWeight: 900, textAlign: 'center', height: 150 }}} 
                      InputLabelProps={{ sx: { fontSize: '1.5rem', fontWeight: 700 }}}
                    />
                    <Typography variant="h1" sx={{ fontSize: '6rem', fontWeight: 300 }}>/</Typography>
                    <TextField 
                      label="Diastolic" 
                      type="number" 
                      value={vitals.diastolic} 
                      onChange={(e) => setVitals({...vitals, diastolic: parseInt(e.target.value)})} 
                      InputProps={{ sx: { fontSize: '5rem', fontWeight: 900, textAlign: 'center', height: 150 }}} 
                      InputLabelProps={{ sx: { fontSize: '1.5rem', fontWeight: 700 }}}
                    />
                  </Stack>
                </Box>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ p: 3, borderRadius: 4, border: `4px solid ${getVitalStatus('hr', vitals.heartRate).color}`, bgcolor: 'white' }}>
                      <Typography variant="subtitle1" fontWeight="900" color={getVitalStatus('hr', vitals.heartRate).color} sx={{ mb: 1 }}>
                        {getVitalStatus('hr', vitals.heartRate).label}
                      </Typography>
                      <TextField 
                        fullWidth 
                        label="Heart Rate (bpm)" 
                        type="number"
                        value={vitals.heartRate} 
                        onChange={(e) => setVitals({...vitals, heartRate: parseInt(e.target.value)})} 
                        InputProps={{ sx: { height: 100, fontSize: '2.5rem', fontWeight: 800 }}}
                      />
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ p: 3, borderRadius: 4, border: `4px solid ${getVitalStatus('o2', vitals.oxygenSaturation).color}`, bgcolor: 'white' }}>
                      <Typography variant="subtitle1" fontWeight="900" color={getVitalStatus('o2', vitals.oxygenSaturation).color} sx={{ mb: 1 }}>
                        {getVitalStatus('o2', vitals.oxygenSaturation).label}
                      </Typography>
                      <TextField 
                        fullWidth 
                        label="SpO2 (%)" 
                        type="number"
                        value={vitals.oxygenSaturation} 
                        onChange={(e) => setVitals({...vitals, oxygenSaturation: parseInt(e.target.value)})} 
                        InputProps={{ sx: { height: 100, fontSize: '2.5rem', fontWeight: 800 }}}
                      />
                    </Box>
                  </Grid>
                </Grid>
                <TextField 
                  fullWidth 
                  multiline 
                  rows={3} 
                  label="Chief Complaint" 
                  value={vitals.chief_complaint} 
                  onChange={(e) => setVitals({...vitals, chief_complaint: e.target.value})} 
                  InputProps={{ sx: { fontSize: '1.5rem', fontWeight: 500 }}}
                />
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Approx Onset Date" 
                      type="date" 
                      InputLabelProps={{ shrink: true, sx: { fontWeight: 700 } }} 
                      value={vitals.onset_date} 
                      onChange={(e) => setVitals({...vitals, onset_date: e.target.value})} 
                      InputProps={{ sx: { height: 80, fontSize: '1.5rem' }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack direction="row" spacing={2}>
                      <TextField 
                        fullWidth 
                        label="Duration" 
                        type="number" 
                        value={vitals.duration_value} 
                        onChange={(e) => setVitals({...vitals, duration_value: e.target.value})} 
                        InputProps={{ sx: { height: 80, fontSize: '1.5rem' }}}
                      />
                      <Select 
                        sx={{ width: 150, height: 80, fontSize: '1.2rem', fontWeight: 700 }} 
                        value={vitals.duration_unit} 
                        onChange={(e) => setVitals({...vitals, duration_unit: e.target.value})}
                      >
                        <MenuItem value="days">Days</MenuItem>
                        <MenuItem value="weeks">Weeks</MenuItem>
                        <MenuItem value="months">Months</MenuItem>
                      </Select>
                    </Stack>
                  </Grid>
                </Grid>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel sx={{ fontWeight: 700 }}>Tobacco Use</InputLabel>
                      <Select 
                        value={vitals.tobacco_use} 
                        label="Tobacco Use" 
                        onChange={(e) => setVitals({...vitals, tobacco_use: e.target.value})}
                        sx={{ height: 80, fontSize: '1.5rem', fontWeight: 700 }}
                      >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="smoking">Smoking</MenuItem>
                        <MenuItem value="chewing">Chewing (Gutkha/Pan Masala)</MenuItem>
                        <MenuItem value="both">Both</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel sx={{ fontWeight: 700 }}>Alcohol Consumption</InputLabel>
                      <Select 
                        value={vitals.alcohol_consumption} 
                        label="Alcohol Consumption" 
                        onChange={(e) => setVitals({...vitals, alcohol_consumption: e.target.value})}
                        sx={{ height: 80, fontSize: '1.5rem', fontWeight: 700 }}
                      >
                        <MenuItem value="none">None</MenuItem>
                        <MenuItem value="occasional">Occasional</MenuItem>
                        <MenuItem value="regular">Regular</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Stack>
            )}

            {mode === 3 && (
              <Stack spacing={6}>
                <Typography variant="h4" fontWeight="900" color="primary" textAlign="center">LABS & RISK ASSESSMENT</Typography>
                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Blood Sugar (mg/dL)" 
                      type="number"
                      value={vitals.blood_sugar} 
                      onChange={(e) => setVitals({...vitals, blood_sugar: parseFloat(e.target.value) || 0})} 
                      InputProps={{ sx: { height: 100, fontSize: '2.5rem', fontWeight: 800 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Hemoglobin (g/dL)" 
                      type="number"
                      value={vitals.hemoglobin} 
                      onChange={(e) => setVitals({...vitals, hemoglobin: parseFloat(e.target.value) || 0})} 
                      InputProps={{ sx: { height: 100, fontSize: '2.5rem', fontWeight: 800 }}}
                    />
                  </Grid>
                </Grid>
                <Autocomplete 
                  multiple 
                  options={['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease']} 
                  value={vitals.chronic_conditions} 
                  onChange={(_, v) => setVitals({...vitals, chronic_conditions: v})} 
                  renderInput={(p) => <TextField {...p} label="Chronic Conditions" InputProps={{ ...p.InputProps, sx: { fontSize: '1.5rem', minHeight: 100 }}} />} 
                />
                <TextField 
                  fullWidth 
                  multiline 
                  rows={3} 
                  label="Allergies" 
                  value={vitals.allergies} 
                  onChange={(e) => setVitals({...vitals, allergies: e.target.value})} 
                  InputProps={{ sx: { fontSize: '1.5rem', fontWeight: 500 }}}
                />
                
                <Divider sx={{ my: 4 }} />
                
                <Box sx={{ p: 5, bgcolor: '#f0f9ff', borderRadius: 5, border: '2px solid #bae6fd' }}>
                  <Typography variant="h5" color="primary" fontWeight="900" gutterBottom>
                    SYSTEM SUGGESTION: <span style={{ color: '#0369a1' }}>{systemTriage.triage_level.toUpperCase()}</span>
                  </Typography>
                  <FormControl fullWidth sx={{ mt: 4 }}>
                    <InputLabel sx={{ fontWeight: 800, fontSize: '1.2rem' }}>NURSE OVERRIDE</InputLabel>
                    <Select 
                      value={vitals.nurse_priority} 
                      label="NURSE OVERRIDE" 
                      onChange={(e) => setVitals({...vitals, nurse_priority: e.target.value})} 
                      sx={{ height: 100, fontWeight: 900, fontSize: '2rem', bgcolor: 'white' }}
                    >
                      <MenuItem value=""><em>Follow System</em></MenuItem>
                      <MenuItem value="emergency" sx={{ color: 'error.main', fontWeight: 900, fontSize: '1.5rem' }}>EMERGENCY (Red)</MenuItem>
                      <MenuItem value="urgent" sx={{ color: 'warning.main', fontWeight: 900, fontSize: '1.5rem' }}>URGENT (Yellow)</MenuItem>
                      <MenuItem value="standard" sx={{ color: 'success.main', fontWeight: 900, fontSize: '1.5rem' }}>NORMAL (Green)</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Stack>
            )}

            <Stack direction="row" spacing={4} sx={{ mt: 8 }}>
              <Button 
                fullWidth 
                size="large" 
                variant="outlined" 
                sx={{ height: 100, fontWeight: 900, fontSize: '1.5rem', borderRadius: 4, border: '3px solid' }} 
                onClick={() => setSelectedPatient(null)}
              >
                Cancel
              </Button>
              <Button 
                fullWidth 
                size="large" 
                variant="contained" 
                sx={{ height: 100, fontWeight: 900, fontSize: '1.5rem', borderRadius: 4 }} 
                onClick={() => {
                  let nextStatus: EncounterStatus = 'READY_FOR_DOCTOR';
                  if (mode === 1) nextStatus = 'WAITING_FOR_VITALS_2';
                  else if (mode === 2) nextStatus = 'WAITING_FOR_VITALS_3';
                  handleSaveVitals(nextStatus);
                }} 
                disabled={isSaving}
              >
                {mode === 1 ? 'SUBMIT TO VITAL SIGNS' : 
                 mode === 2 ? 'SUBMIT TO LABS' : 'FINISH & SEND TO DOCTOR'}
              </Button>
            </Stack>
          </Paper>
        </Box>
      )}
    </StationLayout>
  );
};

export default VitalsStation;