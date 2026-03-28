import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Grid, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Button, Chip, TextField, 
  InputAdornment, Alert, Divider, Card, CardContent, MenuItem, 
  Select, FormControl, InputLabel, Stepper, Step, StepLabel, 
  CircularProgress, Stack, RadioGroup, FormControlLabel, Radio, 
  Autocomplete
} from '@mui/material';
import { 
  MonitorWeight as WeightIcon, 
  Height as HeightIcon, 
  Favorite as HeartIcon, 
  Bloodtype as BloodIcon, 
  Thermostat as TempIcon,
  SmokingRooms as SmokingIcon,
  WineBar as AlcoholIcon,
  Warning as WarningIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Save as SaveIcon,
  History as HistoryIcon,
  Assignment as AssignmentIcon,
  Opacity as OpacityIcon
} from '@mui/icons-material';

import { subscribeToQueue, updateQueueStatus, updateQueueTriage } from '../services/queueService';
import { saveVitals } from '../services/encounterService';
import { QueueItem, Vitals, TriageLevel } from '../types';
import { getPatientById } from '../services/patientService';
import { getPatientByQrToken } from '../services/qrService';
import { auth } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { evaluateTriage, TriageResult } from '../utils/triage';
import QrScannerModal from '../components/QrScannerModal';
import StationLayout from '../components/StationLayout';

const VitalsStation: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { notify, selectedPatient, setSelectedPatient, selectedClinic } = useAppStore();
  
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Expanded Clinical & Social State
  const [vitals, setVitals] = useState<any>({
    systolic: 120, diastolic: 80, heartRate: 72, temperature: 36.5,
    weight: 70, height: 170, bmi: 24.2, oxygenSaturation: 98,
    blood_sugar: '', hemoglobin: '', 
    chief_complaint: '', onset_date: '', duration_value: '', duration_unit: 'days',
    is_pregnant: 'no', pregnancy_months: '',
    alcohol_consumption: 'none', tobacco_use: 'none', 
    allergies: '', chronic_conditions: [],
    nurse_priority: '' // Field for Manual Triage Override
  });

  const steps = ['Complaints', 'Station 1: Body', 'Station 2: Vitals', 'Station 3: Labs & Risk'];

  useEffect(() => {
    if (!selectedClinic) return;
    const unsubscribe = subscribeToQueue('WAITING_FOR_VITALS' as any, setWaitingList, (err) => console.error(err));
    return () => unsubscribe();
  }, [selectedClinic]);

  // Automated Triage Suggestion
  const systemTriage = evaluateTriage(vitals);

  // Status Indicator Logic
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
    if (type === 'o2') {
      if (val1 < 90) return { color: '#ef4444', label: 'EMERGENCY' };
      if (val1 < 95) return { color: '#f59e0b', label: 'URGENT' };
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

      // 1. Save Full Clinical Record
      await saveVitals({
        ...vitals,
        suggested_priority: systemTriage.triage_level,
        assigned_priority: finalPriority,
        encounter_id: selectedQueueItem.encounter_id,
        patient_id: selectedQueueItem.patient_id,
        created_by: auth.currentUser?.uid || 'unknown'
      });

      // 2. Update Queue with Nurse-Selected Priority
      await updateQueueTriage(selectedQueueItem.id!, {
        triage_level: finalPriority,
        priority_score: finalPriority === 'emergency' ? 100 : finalPriority === 'urgent' ? 75 : 50,
        triage_source: vitals.nurse_priority ? 'manual' : 'automatic'
      });

      // 3. Push to Doctor Dashboard
      await updateQueueStatus(selectedQueueItem.id!, 'READY_FOR_DOCTOR' as any);

      notify(`Triage complete for ${selectedQueueItem.patient_name}`, 'success');
      setSelectedPatient(null);
      setSelectedQueueItem(null);
      setActiveStep(0);
    } catch (err: any) {
      console.error(err);
      notify("Failed to finalize triage data", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // --- STEP 0: INITIAL COMPLAINTS ---
  const renderIntakeStep = () => (
    <Stack spacing={4}>
      <Typography variant="h5" fontWeight="900" color="primary">PATIENT INTAKE: CHIEF COMPLAINT</Typography>
      <TextField 
        fullWidth multiline rows={4} label="Reason for Visit / Chief Complaint" 
        placeholder="e.g. Sharp chest pain, Chronic headache, Follow-up for Diabetes..." 
        value={vitals.chief_complaint} onChange={(e) => setVitals({...vitals, chief_complaint: e.target.value})}
        sx={{ bgcolor: '#fff', borderRadius: 2 }}
      />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField 
            fullWidth label="Problem Started On (Approx)" type="date" InputLabelProps={{ shrink: true }}
            value={vitals.onset_date} onChange={(e) => setVitals({...vitals, onset_date: e.target.value})}
            sx={{ height: 70 }}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField 
            fullWidth label="Duration" type="number" 
            value={vitals.duration_value} onChange={(e) => setVitals({...vitals, duration_value: e.target.value})}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <Select 
            fullWidth value={vitals.duration_unit} 
            onChange={(e) => setVitals({...vitals, duration_unit: e.target.value})}
            sx={{ height: 56 }}
          >
            <MenuItem value="days">Days</MenuItem>
            <MenuItem value="weeks">Weeks</MenuItem>
            <MenuItem value="months">Months</MenuItem>
          </Select>
        </Grid>
      </Grid>
    </Stack>
  );

  // --- STATION 1: ANTHROPOMETRY ---
  const renderStation1 = () => (
    <Stack spacing={4}>
      <Typography variant="h5" fontWeight="900" color="primary">PHYSICAL STATION 1: BODY MEASURES</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField 
            fullWidth label="Weight (kg)" type="number" 
            value={vitals.weight || ''} onChange={(e) => setVitals({...vitals, weight: parseFloat(e.target.value)})} 
            InputProps={{ sx: { height: 90, fontSize: '2rem', borderRadius: 4 }}} 
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField 
            fullWidth label="Height (cm)" type="number" 
            value={vitals.height || ''} onChange={(e) => setVitals({...vitals, height: parseFloat(e.target.value)})} 
            InputProps={{ sx: { height: 90, fontSize: '2rem', borderRadius: 4 }}} 
          />
        </Grid>
      </Grid>

      {selectedPatient?.gender?.toLowerCase() === 'female' && (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 4, bgcolor: '#fff1f2', borderColor: '#fecdd3' }}>
          <Typography variant="h6" fontWeight="bold" color="#be123c">Pregnancy Screening</Typography>
          <RadioGroup row value={vitals.is_pregnant} onChange={(e) => setVitals({...vitals, is_pregnant: e.target.value})}>
            <FormControlLabel value="yes" control={<Radio color="error" />} label={<Typography fontWeight="bold">Pregnant</Typography>} />
            <FormControlLabel value="no" control={<Radio />} label="Not Pregnant" />
          </RadioGroup>
          {vitals.is_pregnant === 'yes' && (
            <TextField 
              label="Gestation Period (Months)" type="number" fullWidth sx={{ mt: 2, bgcolor: 'white' }} 
              value={vitals.pregnancy_months} onChange={(e) => setVitals({...vitals, pregnancy_months: e.target.value})} 
            />
          )}
        </Paper>
      )}
    </Stack>
  );

  // --- STATION 2: CARDIOVASCULAR ---
  const renderStation2 = () => {
    const bpStatus = getVitalStatus('bp', vitals.systolic, vitals.diastolic);
    const hrStatus = getVitalStatus('hr', vitals.heartRate);
    const o2Status = getVitalStatus('o2', vitals.oxygenSaturation);

    return (
      <Stack spacing={4}>
        <Typography variant="h5" fontWeight="900" color="primary">PHYSICAL STATION 2: CARDIOVASCULAR</Typography>
        
        {/* Large Blood Pressure Block */}
        <Box sx={{ p: 4, borderRadius: 5, border: `6px solid ${bpStatus.color}`, textAlign: 'center', transition: 'all 0.3s' }}>
          <Typography variant="caption" fontWeight="900" color={bpStatus.color} sx={{ letterSpacing: 2 }}>{bpStatus.label}</Typography>
          <Stack direction="row" spacing={3} justifyContent="center" alignItems="center">
            <TextField 
              label="Systolic" type="number" value={vitals.systolic} 
              onChange={(e) => setVitals({...vitals, systolic: parseInt(e.target.value)})} 
              InputProps={{ sx: { fontSize: '3rem', textAlign: 'center', fontWeight: 'bold' }}} 
            />
            <Typography variant="h1" color="text.secondary">/</Typography>
            <TextField 
              label="Diastolic" type="number" value={vitals.diastolic} 
              onChange={(e) => setVitals({...vitals, diastolic: parseInt(e.target.value)})} 
              InputProps={{ sx: { fontSize: '3rem', textAlign: 'center', fontWeight: 'bold' }}} 
            />
          </Stack>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField 
              fullWidth label="Heart Rate (bpm)" type="number" value={vitals.heartRate} 
              onChange={(e) => setVitals({...vitals, heartRate: parseInt(e.target.value)})}
              InputProps={{ 
                startAdornment: <HeartIcon sx={{ mr: 1 }} color={hrStatus.color === '#ef4444' ? 'error' : 'primary'} />,
                sx: { height: 90, fontSize: '1.8rem', border: `2px solid ${hrStatus.color}`, borderRadius: 4 }
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField 
              fullWidth label="SpO2 (%)" type="number" value={vitals.oxygenSaturation} 
              onChange={(e) => setVitals({...vitals, oxygenSaturation: parseInt(e.target.value)})}
              InputProps={{ 
                sx: { height: 90, fontSize: '1.8rem', border: `2px solid ${o2Status.color}`, borderRadius: 4 }
              }}
            />
          </Grid>
        </Grid>
      </Stack>
    );
  };

  // --- STATION 3: LABS, RISK & OVERRIDE ---
  const renderStation3 = () => (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight="900" color="primary">STATION 3: LABS, RISK & FINAL TRIAGE</Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="Glucose / Blood Sugar" value={vitals.blood_sugar} onChange={(e) => setVitals({...vitals, blood_sugar: e.target.value})} placeholder="e.g. 110 mg/dL" />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="Hemoglobin" value={vitals.hemoglobin} onChange={(e) => setVitals({...vitals, hemoglobin: e.target.value})} placeholder="e.g. 13.5 g/dL" />
        </Grid>
      </Grid>

      <Autocomplete
        multiple options={['Diabetes', 'Hypertension', 'Asthma', 'COPD', 'Heart Disease', 'Thyroid', 'Gastric', 'Anemia']}
        value={vitals.chronic_conditions} onChange={(_, val) => setVitals({...vitals, chronic_conditions: val})}
        renderInput={(params) => <TextField {...params} label="Chronic Conditions" placeholder="Select existing diseases" />}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Tobacco / Substance Use</InputLabel>
            <Select value={vitals.tobacco_use} label="Tobacco / Substance Use" onChange={(e) => setVitals({...vitals, tobacco_use: e.target.value})}>
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="smoking">Smoking (Cigarettes/Bidi)</MenuItem>
              <MenuItem value="chewing">Chewing (Gutkha / Pan Masala)</MenuItem>
              <MenuItem value="both">Both Smoking & Chewing</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Alcohol Consumption</InputLabel>
            <Select value={vitals.alcohol_consumption} label="Alcohol Consumption" onChange={(e) => setVitals({...vitals, alcohol_consumption: e.target.value})}>
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="occasional">Occasional</MenuItem>
              <MenuItem value="regular">Regular / Heavy</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <TextField fullWidth multiline rows={2} label="Known Allergies" placeholder="Food or Medication allergies..." value={vitals.allergies} onChange={(e) => setVitals({...vitals, allergies: e.target.value})} />

      <Divider sx={{ my: 2 }}>Nurse Triage Decision</Divider>
      
      <Card variant="outlined" sx={{ p: 3, borderRadius: 4, bgcolor: '#f0f9ff', borderColor: '#bae6fd' }}>
        <Typography variant="subtitle2" color="primary" gutterBottom>SYSTEM SUGGESTION: <strong>{systemTriage.triage_level.toUpperCase()}</strong></Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>{systemTriage.triage_reason}</Typography>
        
        <FormControl fullWidth>
          <InputLabel sx={{ fontWeight: 'bold' }}>NURSE OVERRIDE (Select Final Priority)</InputLabel>
          <Select 
            value={vitals.nurse_priority} label="NURSE OVERRIDE (Select Final Priority)"
            onChange={(e) => setVitals({...vitals, nurse_priority: e.target.value})}
            sx={{ height: 80, borderRadius: 4, fontWeight: 'bold', fontSize: '1.2rem', bgcolor: 'white' }}
          >
            <MenuItem value=""><em>Follow System Suggestion</em></MenuItem>
            <MenuItem value="emergency" sx={{ color: '#ef4444', fontWeight: 'bold' }}>EMERGENCY (Critical - Red)</MenuItem>
            <MenuItem value="urgent" sx={{ color: '#f59e0b', fontWeight: 'bold' }}>URGENT (Delayed - Yellow)</MenuItem>
            <MenuItem value="standard" sx={{ color: '#10b981', fontWeight: 'bold' }}>STANDARD (Routine - Green)</MenuItem>
          </Select>
        </FormControl>
      </Card>
    </Stack>
  );

  return (
    <StationLayout title="Triage Station" stationName="Vitals" showPatientContext={!!selectedPatient}>
      {!selectedPatient ? (
        <TableContainer component={Paper} sx={{ borderRadius: 5, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}><TableRow><TableCell sx={{ fontWeight: 800 }}>Patient Name</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
            <TableBody>
              {waitingList.map(item => (
                <TableRow key={item.id} hover>
                  <TableCell fontWeight="bold" sx={{ py: 3 }}>{item.patient_name}</TableCell>
                  <TableCell align="right">
                    <Button variant="contained" size="large" onClick={() => handleSelectPatient(item)} sx={{ borderRadius: 2 }}>Start Triage</Button>
                  </TableCell>
                </TableRow>
              ))}
              {waitingList.length === 0 && <TableRow><TableCell colSpan={2} align="center" sx={{ py: 10 }}>No patients waiting in queue.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ maxWidth: 850, mx: 'auto' }}>
          <Stepper activeStep={activeStep} sx={{ mb: 6 }} alternativeLabel>
            {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          <Paper elevation={0} sx={{ p: 5, borderRadius: 6, border: '1px solid #cbd5e1', bgcolor: 'white' }}>
            {activeStep === 0 && renderIntakeStep()}
            {activeStep === 1 && renderStation1()}
            {activeStep === 2 && renderStation2()}
            {activeStep === 3 && renderStation3()}

            <Stack direction="row" spacing={3} sx={{ mt: 6 }}>
              <Button 
                fullWidth size="large" variant="outlined" 
                sx={{ height: 80, borderRadius: 4, fontWeight: 800, fontSize: '1.2rem' }} 
                onClick={activeStep === 0 ? () => setSelectedPatient(null) : () => setActiveStep(s => s - 1)}
              >
                {activeStep === 0 ? "Cancel" : "Back"}
              </Button>
              <Button 
                fullWidth size="large" variant="contained" 
                sx={{ height: 80, borderRadius: 4, fontWeight: 900, fontSize: '1.4rem' }} 
                onClick={activeStep === 3 ? handleSaveVitals : () => setActiveStep(s => s + 1)}
              >
                {activeStep === 3 ? (isSaving ? 'Finishing...' : 'FINISH & SEND') : 'Next Station'}
              </Button>
            </Stack>
          </Paper>
        </Box>
      )}
    </StationLayout>
  );
};

export default VitalsStation;