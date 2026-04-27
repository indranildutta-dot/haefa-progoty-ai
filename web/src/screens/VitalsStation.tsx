import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Button, Chip, TextField, Divider, Card, CardContent, MenuItem, Select, FormControl, 
  InputLabel, Stepper, Step, StepLabel, Stack, RadioGroup, FormControlLabel, Radio, Autocomplete,
  ToggleButton, ToggleButtonGroup, Switch, IconButton, Tooltip
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
  Opacity as OpacityIcon,
  ExpandMore as ExpandMoreIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

import { subscribeToQueue, updateQueueStatus, updateQueueTriage, cancelQueueItem } from '../services/queueService';
import { saveVitals, getVitalsByEncounter } from '../services/encounterService';
import { QueueItem, Vitals, TriageLevel, VitalsRecord } from '../types';
import { getPatientById } from '../services/patientService';
import { auth } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { evaluateTriage, TriageResult } from '../utils/triage';
import StationLayout from '../components/StationLayout';
import StationSearchHeader from '../components/StationSearchHeader';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import CancelQueueDialog from '../components/CancelQueueDialog';

interface VitalsStationProps {
  countryId: string;
  mode: 1 | 2 | 3;
}

const VitalsStation: React.FC<VitalsStationProps> = ({ countryId, mode }) => {
  const { notify, selectedClinic, setSelectedPatient, selectedPatient } = useAppStore();
  
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<QueueItem | null>(null);
  const [highlightedPatientIds, setHighlightedPatientIds] = useState<string[]>([]);

  const { isMobile, isTablet } = useResponsiveLayout();

  // Determine station status based on mode
  const station = mode === 1 ? 'WAITING_FOR_VITALS' : 
                  mode === 2 ? 'WAITING_FOR_VITALS_2' : 'WAITING_FOR_VITALS_3';

  // Title logic based on mode and device
  const stationTitle = mode === 1 ? 'Body Measures' :
                       mode === 2 ? (isMobile || isTablet ? 'Vitals' : 'Vital Signs') : 
                       'Labs & Risk';

  const stationName = mode === 1 ? 'Body Measures' : 
                      mode === 2 ? (isMobile || isTablet ? 'Vitals' : 'Vital Signs') : 
                      'Labs & Risk';

  // GLOBAL CLINICAL STATE - Standards applied for all clinics
  const initialVitals = {
    systolic: NaN,
    diastolic: NaN,
    systolic_2: NaN,
    diastolic_2: NaN,
    heartRate: NaN,
    respiratoryRate: NaN,
    temperature: NaN,
    weight: NaN,
    height: NaN,
    bmi: NaN,
    bmi_class: '',
    muac: NaN,
    muac_class: '',
    blood_group: '',
    oxygenSaturation: NaN,
    blood_sugar: NaN,
    rbg: NaN,
    fbg: NaN,
    hours_since_meal: NaN,
    hemoglobin: NaN, 
    is_fasting: false,
    has_symptoms: false,
    is_pregnant: false,
    pregnancy_months: NaN,
    social_history: {
      take_any: false,
      smoking: false,
      betel_nuts: false,
      chewing_tobacco: false,
      recreational_drugs: false,
      housing: 'Catcha',
      water_source: 'Safe'
    },
    alcohol_use: 'None',
    allergies: '',
    chronic_conditions: [],
    nurse_priority: '' 
  };

  const [vitals, setVitals] = useState<any>(initialVitals);
  const [glucoseUnit, setGlucoseUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [hbUnit, setHbUnit] = useState<'g/dL' | 'g/L'>('g/dL');

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
    if (muac < 11.5) return 'Severely Malnourished';
    if (muac < 12.5) return 'Moderately Malnourished';
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

    if (vitals.muac && !isNaN(vitals.muac)) {
      updates.muac_class = getMUACClass(vitals.muac);
    } else {
      updates.muac_class = '';
    }

    if (Object.keys(updates).length > 0) {
      setVitals((prev: any) => ({ ...prev, ...updates }));
    }
  }, [vitals.weight, vitals.height, vitals.muac]);

  // SAFETY SENTINEL SYNC: Ensures top bar updates as nurse types all fields
  useEffect(() => {
    if (selectedPatient) {
      const triage = evaluateTriage(vitals, selectedPatient?.age_years, selectedPatient?.age_months);
      
      // CRITICAL: Force is_pregnant to false for non-females to prevent data leakage
      const isFemale = selectedPatient.gender?.toLowerCase() === 'female';
      const safeIsPregnant = isFemale ? !!vitals.is_pregnant : false;

      const finalTriageLevel = vitals.nurse_priority || triage.triage_level;

      setSelectedPatient({
        ...selectedPatient,
        triage_level: finalTriageLevel,
        currentVitals: { 
          ...vitals, 
          is_pregnant: safeIsPregnant,
          triage_level: finalTriageLevel 
        }
      });
    }
  }, [
    vitals.systolic, 
    vitals.diastolic, 
    vitals.heartRate, 
    vitals.respiratoryRate,
    vitals.oxygenSaturation, 
    vitals.temperature,
    vitals.is_pregnant, 
    vitals.tobacco_use, 
    vitals.allergies,
    vitals.weight,
    vitals.height,
    vitals.bmi,
    vitals.bmi_class,
    vitals.muac_class,
    vitals.blood_sugar,
    vitals.rbg,
    vitals.fbg,
    vitals.hours_since_meal,
    vitals.hemoglobin,
    vitals.nurse_priority
  ]);

  // Delayed clinical validation for Labs to prevent premature warnings while typing
  useEffect(() => {
    if (mode !== 3) return;

    const handler = setTimeout(() => {
      // Check RBG
      if (!isNaN(vitals.rbg) && (vitals.rbg > 600 || (vitals.rbg < 20 && vitals.rbg > 0))) {
        notify("Impossible Glucose value. Please recheck.", "warning");
      }
      // Check FBG
      if (!isNaN(vitals.fbg) && (vitals.fbg > 600 || (vitals.fbg < 20 && vitals.fbg > 0))) {
        notify("Impossible Glucose value. Please recheck.", "warning");
      }
      // Check Hemoglobin
      if (!isNaN(vitals.hemoglobin) && (vitals.hemoglobin > 25 || (vitals.hemoglobin < 3 && vitals.hemoglobin > 0))) {
        notify("Impossible Hemoglobin value. Please recheck.", "warning");
      }
    }, 4000); // 4-second delay as requested by clinical staff

    return () => clearTimeout(handler);
  }, [vitals.rbg, vitals.fbg, vitals.hemoglobin, mode]);

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

  const getAgeYears = (p: any): number => {
    if (!p) return 0;
    let years: number | undefined;
    if (p.age_years !== null && p.age_years !== undefined) {
      if (p.age_years > 1900) years = new Date().getFullYear() - p.age_years;
      else years = p.age_years;
    } else if (p.date_of_birth) {
      const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
      if (regex.test(p.date_of_birth)) {
        const [_, day, month, year] = p.date_of_birth.match(regex)!;
        const birthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
        const today = new Date();
        years = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) years--;
      }
    } else if (p.estimated_birth_year) {
      years = new Date().getFullYear() - p.estimated_birth_year;
    }
    return years ?? 0;
  };

  const isPediatric = getAgeYears(selectedPatient) < 18;
  const isUnderFive = getAgeYears(selectedPatient) < 5;

  const getVitalStatus = (type: 'bp' | 'hr' | 'o2' | 'rr' | 'fbg' | 'rbg', val1: number, val2?: number) => {
    if (isNaN(val1)) return { color: '#e2e8f0', label: 'PENDING' };
    
    if (type === 'bp') {
      if (isNaN(val1) || (val2 !== undefined && isNaN(val2))) return { color: '#e2e8f0', label: 'PENDING' };
      if (val1 >= 180 || (val2 && val2 >= 120)) return { color: '#ef4444', label: 'CRITICAL' };
      if (val1 >= 130 || (val2 && val2 >= 80)) return { color: '#f59e0b', label: 'WARNING' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    if (type === 'hr') {
      const age_years = getAgeYears(selectedPatient);
      const age_months = selectedPatient?.age_months ?? 0;
      let hrLow = 60;
      let hrHigh = 100;

      if (age_years === 0 && age_months === 0) {
        hrLow = 100;
        hrHigh = 160;
      } else if (age_years === 0 && age_months > 0) {
        hrLow = 100;
        hrHigh = 150;
      } else if (age_years >= 1 && age_years <= 2) {
        hrLow = 98;
        hrHigh = 140;
      } else if (age_years >= 3 && age_years <= 5) {
        hrLow = 80;
        hrHigh = 120;
      } else if (age_years >= 6 && age_years <= 12) {
        hrLow = 75;
        hrHigh = 110;
      }

      if (val1 > hrHigh || val1 < hrLow) return { color: '#ef4444', label: 'EMERGENCY' };
      if (val1 > (hrHigh - 5) || val1 < (hrLow + 5)) return { color: '#f59e0b', label: 'URGENT' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    if (type === 'rr') {
      const age_years = getAgeYears(selectedPatient);
      let rrLow = 12;
      let rrHigh = 20;

      if (age_years < 1) {
        rrLow = 30;
        rrHigh = 60;
      } else if (age_years <= 12) {
        rrLow = 18;
        rrHigh = 30;
      }

      if (val1 > rrHigh || val1 < rrLow) return { color: '#ef4444', label: 'EMERGENCY' };
      if (val1 > (rrHigh - 2) || val1 < (rrLow + 2)) return { color: '#f59e0b', label: 'URGENT' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    if (type === 'o2') {
      if (val1 < 88) return { color: '#ef4444', label: 'EMERGENCY' };
      if (val1 < 90) return { color: '#f43f5e', label: 'CRITICAL' };
      if (val1 <= 92) return { color: '#f59e0b', label: 'WARNING' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    if (type === 'fbg') {
      if (val1 >= 126) return { color: '#ef4444', label: 'DIABETES RANGE' };
      if (val1 >= 100) return { color: '#f59e0b', label: 'PREDIABETES' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    if (type === 'rbg') {
      if (val1 >= 200) return { color: '#ef4444', label: 'CRITICAL ALERT' };
      if (val1 >= 140) return { color: '#f59e0b', label: 'ELEVATED' };
      return { color: '#10b981', label: 'NORMAL' };
    }
    return { color: '#e2e8f0', label: '' };
  };

  const getHbStatus = (hb: number) => {
    if (!hb || isNaN(hb)) return { color: '#e2e8f0', label: 'PENDING' };
    
    const age_years = getAgeYears(selectedPatient);
    const age_months = selectedPatient?.age_months ?? 0;
    const isMale = selectedPatient?.gender?.toLowerCase() === 'male';
    const isPregnant = !!vitals.is_pregnant;
    
    let threshold = 12.0;
    
    if (age_years === 0 && age_months >= 1) threshold = 10.5;
    else if (age_years >= 1 && age_years <= 5) threshold = 11.0;
    else if (age_years >= 6 && age_years <= 11) threshold = 11.5;
    else if (age_years >= 12 && age_years <= 14) threshold = 12.0;
    else if (age_years >= 15) {
      if (isPregnant) threshold = 11.0;
      else if (isMale) threshold = 13.0;
      else threshold = 12.0;
    }
    
    if (hb >= threshold) return { color: '#10b981', label: 'NORMAL' };
    if (hb >= 10) return { color: '#f59e0b', label: 'MILD ANEMIA' };
    if (hb >= 7) return { color: '#f97316', label: 'MODERATE ANEMIA' };
    return { color: '#ef4444', label: 'SEVERE ANEMIA' };
  };

  const handleCancelQueueItem = async (reason: string) => {
    if (!cancelTarget) return;
    try {
      await cancelQueueItem(cancelTarget.id!, reason);
      notify(`Visit cancelled for ${cancelTarget.patient_name}`, 'info');
      setCancelTarget(null);
    } catch (err) {
      console.error("Cancel Error:", err);
      notify("Failed to cancel visit", "error");
    }
  };

  const handleSelectPatient = async (item: QueueItem) => {
    const patient = await getPatientById(item.patient_id);
    if (patient) {
      setSelectedPatient(patient);
      setSelectedQueueItem(item);
      
      // Fetch existing vitals to preserve data from previous stations
      try {
        const existingVitals = await getVitalsByEncounter(item.encounter_id);
        if (existingVitals) {
          // Merge existing vitals with initial state
          let mergedVitals = { ...initialVitals, ...existingVitals };
          
          // Clear fields for the current mode to respect "blank form" requirement
          // This ensures the nurse starts with a fresh form for the current station
          // while preserving data from previous stations for the top bar and final save.
          // Clear fields for the current mode ONLY if we are starting fresh for this station.
          // If we are revisiting a patient at the same station, keep the data.
          // However, the user requirement is to respect "blank form" requirement for NEW visits at a station.
          // The bug is that even when clicking "Save Progress" it clears it on revisit.
          
          // SOLUTION: Only clear if the encounter vitals don't have fields specific to this station already.
          if (mode === 1) {
            // mode 1 is Body Measures
            const hasBodyMeasures = !isNaN(existingVitals.weight) || !isNaN(existingVitals.height);
            if (!hasBodyMeasures) {
              mergedVitals = { 
                ...mergedVitals, 
                weight: NaN, height: NaN, bmi: NaN, bmi_class: '', muac: NaN, muac_class: '', 
                blood_group: '', is_pregnant: false, pregnancy_months: NaN 
              };
            }
          } else if (mode === 2) {
            // mode 2 is Vital Signs
            const hasVitalSigns = !isNaN(existingVitals.systolic) || !isNaN(existingVitals.heartRate);
            if (!hasVitalSigns) {
              mergedVitals = { 
                ...mergedVitals, 
                systolic: NaN, diastolic: NaN, systolic_2: NaN, diastolic_2: NaN, 
                heartRate: NaN, temperature: NaN, oxygenSaturation: NaN, respiratoryRate: NaN,
                social_history: initialVitals.social_history, alcohol_use: 'None'
              };
            }
          } else if (mode === 3) {
            // mode 3 is Labs & Risks
            const hasLabs = !isNaN(existingVitals.blood_sugar) || !isNaN(existingVitals.rbg) || !isNaN(existingVitals.hemoglobin);
            if (!hasLabs) {
              mergedVitals = { 
                ...mergedVitals, 
                blood_sugar: NaN, rbg: NaN, fbg: NaN, hours_since_meal: NaN, 
                hemoglobin: NaN, is_fasting: false, has_symptoms: false, 
                allergies: '', chronic_conditions: [] 
              };
            }
          }
          setVitals(mergedVitals);
        } else {
          setVitals(initialVitals);
        }
      } catch (err) {
        console.error("Error fetching existing vitals:", err);
        setVitals(initialVitals);
      }
    }
  };

  const isBPAbnormal = (s: number, d: number) => {
    return s >= 130 || d >= 80;
  };

  const handleSaveVitals = async (nextStatus: EncounterStatus) => {
    if (!selectedQueueItem) return;

    // Reject impossible values
    if (vitals.rbg > 600 || (vitals.rbg < 20 && vitals.rbg > 0)) {
      notify("Impossible RBG value. Please recheck.", "error");
      return;
    }
    if (vitals.fbg > 600 || (vitals.fbg < 20 && vitals.fbg > 0)) {
      notify("Impossible FBG value. Please recheck.", "error");
      return;
    }
    if (vitals.hemoglobin > 25 || (vitals.hemoglobin < 3 && vitals.hemoglobin > 0)) {
      notify("Impossible Hemoglobin value. Please recheck.", "error");
      return;
    }

    setIsSaving(true);
    try {
      const finalPriority = vitals.nurse_priority || systemTriage.triage_level;
      
      // 1. Save clinical vitals record
      await saveVitals({
        ...vitals,
        is_pregnant: !!vitals.is_pregnant,
        pregnancy_months: parseInt(vitals.pregnancy_months) || 0,
        allergies: vitals.allergies ? (Array.isArray(vitals.allergies) ? vitals.allergies : vitals.allergies.split(',').map((s: string) => s.trim())) : [],
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
        priority_score: systemTriage.priority_score,
        bmi_class: vitals.bmi_class
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
          <StationSearchHeader 
            stationStatus={station as any}
            onPatientFound={(p, item) => item ? handleSelectPatient(item) : null}
            waitingList={waitingList}
            highlightedPatientIds={highlightedPatientIds}
            setHighlightedPatientIds={setHighlightedPatientIds}
          />

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
                {waitingList.map(item => {
                  const isHighlighted = highlightedPatientIds.includes(item.patient_id);
                  return (
                    <TableRow 
                      key={item.id} 
                      hover 
                      sx={{ 
                        bgcolor: isHighlighted ? '#fef9c3' : 'inherit',
                        transition: 'background-color 0.3s ease',
                        borderLeft: isHighlighted ? '6px solid #facc15' : 'none'
                      }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <TimerIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2">{formatWaitTime(item.station_entry_at || item.created_at)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 3 }}>
                        {item.patient_name}
                        {isHighlighted && (
                          <Chip label="MATCH" size="small" color="warning" sx={{ ml: 2, fontWeight: 900, height: 20 }} />
                        )}
                        {item.bmi_class && (item.bmi_class === 'Obese' || item.bmi_class === 'Overweight' || item.bmi_class === 'Underweight') && (
                          <Chip 
                            label={item.bmi_class.toUpperCase()} 
                            size="small" 
                            sx={{ 
                              ml: 2, 
                              fontWeight: 900, 
                              height: 20, 
                              bgcolor: item.bmi_class === 'Obese' ? '#7c2d12' : item.bmi_class === 'Overweight' ? '#f59e0b' : '#0369a1',
                              color: 'white',
                              fontSize: '0.65rem'
                            }} 
                          />
                        )}
                      </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                        <Tooltip title="Cancel Visit">
                          <IconButton 
                            color="error" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelTarget(item);
                            }}
                            sx={{ mr: 4 }}
                          >
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                        <Button 
                          variant="contained" 
                          size="large" 
                          onClick={() => handleSelectPatient(item)}
                          sx={{ 
                            height: { xs: 50, sm: 60 }, 
                            borderRadius: 3, 
                            px: { xs: 2, sm: 4 }, 
                            fontWeight: 900,
                            fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1rem' },
                            bgcolor: isHighlighted ? '#ca8a04' : 'primary.main'
                          }}
                        >
                          Start Triage
                        </Button>
                      </Stack>
                    </TableCell>
                    </TableRow>
                  );
                })}
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
                      value={isNaN(vitals.weight) ? '' : vitals.weight} 
                      onChange={(e) => setVitals({...vitals, weight: parseFloat(e.target.value)})} 
                      InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 800 }}} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="Height (cm)" 
                      type="number" 
                      value={isNaN(vitals.height) ? '' : vitals.height} 
                      onChange={(e) => setVitals({...vitals, height: parseFloat(e.target.value)})} 
                      InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 800 }}} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="BMI" 
                      disabled
                      value={vitals.bmi || ''} 
                      InputProps={{ 
                        sx: { 
                          height: 80, 
                          fontSize: '1.5rem', 
                          fontWeight: 800, 
                          bgcolor: '#f8fafc',
                          border: vitals.bmi_class === 'Obese' ? '4px solid #ef4444' : 
                                  vitals.bmi_class === 'Overweight' ? '4px solid #f59e0b' : 'none',
                          borderRadius: 2,
                          boxShadow: vitals.bmi_class === 'Obese' ? '0 0 15px rgba(239, 68, 68, 0.3)' : 
                                     vitals.bmi_class === 'Overweight' ? '0 0 15px rgba(245, 158, 11, 0.3)' : 'none'
                        }
                      }} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField 
                      fullWidth 
                      label="BMI Class" 
                      disabled
                      value={vitals.bmi_class || ''} 
                      InputProps={{ 
                        sx: { 
                          height: 80, 
                          fontSize: '1.25rem', 
                          fontWeight: 800, 
                          bgcolor: '#f8fafc', 
                          color: vitals.bmi_class === 'Obese' ? '#ef4444' : 
                                 vitals.bmi_class === 'Overweight' ? '#f59e0b' : 'primary.main',
                          border: vitals.bmi_class === 'Obese' ? '4px solid #ef4444' : 
                                  vitals.bmi_class === 'Overweight' ? '4px solid #f59e0b' : 'none',
                          borderRadius: 2,
                          boxShadow: vitals.bmi_class === 'Obese' ? '0 0 15px rgba(239, 68, 68, 0.3)' : 
                                     vitals.bmi_class === 'Overweight' ? '0 0 15px rgba(245, 158, 11, 0.3)' : 'none'
                        }
                      }} 
                      InputLabelProps={{ sx: { fontWeight: 700 }}}
                    />
                  </Grid>

                  {isUnderFive && (
                    <>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField 
                          fullWidth 
                          label="MUAC (cm)" 
                          type="number" 
                          value={isNaN(vitals.muac) ? '' : vitals.muac} 
                          onChange={(e) => setVitals({...vitals, muac: parseFloat(e.target.value)})} 
                          InputProps={{ 
                            sx: { 
                              height: 80, 
                              fontSize: '1.5rem', 
                              fontWeight: 800,
                              border: vitals.muac ? (vitals.muac < 11.5 ? '4px solid #ef4444' : vitals.muac < 12.5 ? '4px solid #f59e0b' : '4px solid #10b981') : 'none',
                              boxShadow: vitals.muac ? (vitals.muac < 11.5 ? '0 0 15px #ef444444' : vitals.muac < 12.5 ? '0 0 15px #f59e0b44' : '0 0 15px #10b98144') : 'none',
                            }
                          }} 
                          InputLabelProps={{ sx: { fontWeight: 700 }}}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <TextField 
                          fullWidth 
                          label="MUAC Class" 
                          disabled
                          value={vitals.muac_class || ''} 
                          InputProps={{ 
                            sx: { 
                              height: 80, 
                              fontSize: '1.25rem', 
                              fontWeight: 800, 
                              bgcolor: '#f8fafc', 
                              color: vitals.muac_class === 'Severely Malnourished' ? '#ef4444' : vitals.muac_class === 'Moderately Malnourished' ? '#f59e0b' : '#10b981'
                            }
                          }} 
                          InputLabelProps={{ sx: { fontWeight: 700 }}}
                        />
                      </Grid>
                    </>
                  )}

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
                
                {selectedPatient?.gender?.toLowerCase() === 'female' && getAgeYears(selectedPatient) >= 12 && (
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
                        value={isNaN(vitals.pregnancy_months) ? '' : vitals.pregnancy_months} 
                        onChange={(e) => setVitals({...vitals, pregnancy_months: parseInt(e.target.value)})} 
                        InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                      />
                    )}
                  </Card>
                )}
              </Stack>
            )}

            {mode === 2 && (
              <Stack spacing={6}>
                <Typography variant="h4" fontWeight="900" color="primary" textAlign="center">VITALS & HABITS</Typography>
                
                {/* First BP Reading */}
                <Box sx={{ p: 5, borderRadius: 5, border: `10px solid ${getVitalStatus('bp', vitals.systolic, vitals.diastolic).color}`, textAlign: 'center', bgcolor: 'white' }}>
                  <Typography variant="h5" fontWeight="900" color={getVitalStatus('bp', vitals.systolic, vitals.diastolic).color} sx={{ mb: 2 }}>
                    {getVitalStatus('bp', vitals.systolic, vitals.diastolic).label === 'PENDING' ? 'BLOOD PRESSURE' : `${getVitalStatus('bp', vitals.systolic, vitals.diastolic).label} (BLOOD PRESSURE)`}
                  </Typography>
                  <Stack direction="row" spacing={4} justifyContent="center" alignItems="center">
                    <TextField 
                      label="Systolic" 
                      type="number" 
                      value={isNaN(vitals.systolic) ? '' : vitals.systolic} 
                      onChange={(e) => setVitals({...vitals, systolic: parseInt(e.target.value)})} 
                      InputProps={{ sx: { fontSize: '3rem', fontWeight: 900, textAlign: 'center', height: 100 }}} 
                      InputLabelProps={{ sx: { fontSize: '1.5rem', fontWeight: 700 }}}
                    />
                    <Typography variant="h1" sx={{ fontSize: '4rem', fontWeight: 300 }}>/</Typography>
                    <TextField 
                      label="Diastolic" 
                      type="number" 
                      value={isNaN(vitals.diastolic) ? '' : vitals.diastolic} 
                      onChange={(e) => setVitals({...vitals, diastolic: parseInt(e.target.value)})} 
                      InputProps={{ sx: { fontSize: '3rem', fontWeight: 900, textAlign: 'center', height: 100 }}} 
                      InputLabelProps={{ sx: { fontSize: '1.5rem', fontWeight: 700 }}}
                    />
                  </Stack>
                </Box>

                {/* Second BP Reading - Only if first is abnormal */}
                {!isNaN(vitals.systolic) && !isNaN(vitals.diastolic) && isBPAbnormal(vitals.systolic, vitals.diastolic) && (
                  <Box sx={{ p: 5, borderRadius: 5, border: `10px solid ${getVitalStatus('bp', vitals.systolic_2, vitals.diastolic_2).color}`, textAlign: 'center', bgcolor: '#fff7ed' }}>
                    <Typography variant="h5" fontWeight="900" color={getVitalStatus('bp', vitals.systolic_2, vitals.diastolic_2).color} sx={{ mb: 2 }}>
                      {getVitalStatus('bp', vitals.systolic_2, vitals.diastolic_2).label === 'PENDING' ? 'BLOOD PRESSURE (READING 2)' : `${getVitalStatus('bp', vitals.systolic_2, vitals.diastolic_2).label} (BLOOD PRESSURE READING 2)`}
                    </Typography>
                    <Stack direction="row" spacing={4} justifyContent="center" alignItems="center">
                      <TextField 
                        label="Systolic 2" 
                        type="number" 
                        value={isNaN(vitals.systolic_2) ? '' : vitals.systolic_2} 
                        onChange={(e) => setVitals({...vitals, systolic_2: parseInt(e.target.value)})} 
                        InputProps={{ sx: { fontSize: '3rem', fontWeight: 900, textAlign: 'center', height: 100 }}} 
                        InputLabelProps={{ sx: { fontSize: '1.5rem', fontWeight: 700 }}}
                      />
                      <Typography variant="h1" sx={{ fontSize: '4rem', fontWeight: 300 }}>/</Typography>
                      <TextField 
                        label="Diastolic 2" 
                        type="number" 
                        value={isNaN(vitals.diastolic_2) ? '' : vitals.diastolic_2} 
                        onChange={(e) => setVitals({...vitals, diastolic_2: parseInt(e.target.value)})} 
                        InputProps={{ sx: { fontSize: '3rem', fontWeight: 900, textAlign: 'center', height: 100 }}} 
                        InputLabelProps={{ sx: { fontSize: '1.5rem', fontWeight: 700 }}}
                      />
                    </Stack>
                    <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary', fontWeight: 700 }}>
                      * Machine malfunction check: Please take a second reading if the first is abnormal.
                    </Typography>
                  </Box>
                )}

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
                        value={isNaN(vitals.heartRate) ? '' : vitals.heartRate} 
                        onChange={(e) => setVitals({...vitals, heartRate: parseInt(e.target.value)})} 
                        InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 800 }}}
                      />
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ p: 3, borderRadius: 4, border: `4px solid ${getVitalStatus('rr', vitals.respiratoryRate).color}`, bgcolor: 'white' }}>
                      <Typography variant="subtitle1" fontWeight="900" color={getVitalStatus('rr', vitals.respiratoryRate).color} sx={{ mb: 1 }}>
                        {getVitalStatus('rr', vitals.respiratoryRate).label}
                      </Typography>
                      <TextField 
                        fullWidth 
                        label="Resp. Rate (bpm)" 
                        type="number"
                        value={isNaN(vitals.respiratoryRate) ? '' : vitals.respiratoryRate} 
                        onChange={(e) => setVitals({...vitals, respiratoryRate: parseInt(e.target.value)})} 
                        InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 800 }}}
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
                        value={isNaN(vitals.oxygenSaturation) ? '' : vitals.oxygenSaturation} 
                        onChange={(e) => setVitals({...vitals, oxygenSaturation: parseInt(e.target.value)})} 
                        InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 800 }}}
                      />
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ p: 3, borderRadius: 4, border: '4px solid #e2e8f0', bgcolor: 'white' }}>
                      <Typography variant="subtitle1" fontWeight="900" color="text.secondary" sx={{ mb: 1 }}>
                        TEMPERATURE
                      </Typography>
                      <TextField 
                        fullWidth 
                        label="Temp (°C)" 
                        type="number"
                        value={isNaN(vitals.temperature) ? '' : vitals.temperature} 
                        onChange={(e) => setVitals({...vitals, temperature: parseFloat(e.target.value)})} 
                        InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 800 }}}
                      />
                    </Box>
                  </Grid>
                </Grid>

                {/* Social History Section */}
                <Card variant="outlined" sx={{ borderRadius: 4, border: '2px solid #e2e8f0' }}>
                  <Box sx={{ p: 2, bgcolor: '#4c1d95', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" fontWeight="900">Social History</Typography>
                    <ExpandMoreIcon />
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    <Stack spacing={3}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" fontWeight="700">Do you take any of the followings?</Typography>
                        <Switch 
                          checked={vitals.social_history.take_any} 
                          onChange={(e) => setVitals({
                            ...vitals, 
                            social_history: { ...vitals.social_history, take_any: e.target.checked }
                          })} 
                        />
                      </Box>
                      
                      <Divider />

                      {[
                        { key: 'smoking', label: 'Smoking' },
                        { key: 'betel_nuts', label: 'Betel Nuts' },
                        { key: 'chewing_tobacco', label: 'Chewing Tobacco' },
                        { key: 'recreational_drugs', label: 'Recreational Drug' }
                      ].map((item) => (
                        <Box key={item.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: vitals.social_history.take_any ? 1 : 0.5 }}>
                          <Typography variant="body1" fontWeight="600">{item.label}</Typography>
                          <RadioGroup 
                            row 
                            value={vitals.social_history[item.key] ? 'yes' : 'no'} 
                            onChange={(e) => {
                              if (!vitals.social_history.take_any) return;
                              setVitals({
                                ...vitals, 
                                social_history: { ...vitals.social_history, [item.key]: e.target.value === 'yes' }
                              });
                            }}
                          >
                            <FormControlLabel value="no" control={<Radio size="small" />} label="No" />
                            <FormControlLabel value="yes" control={<Radio size="small" />} label="Yes" />
                          </RadioGroup>
                        </Box>
                      ))}

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: vitals.social_history.take_any ? 1 : 0.5 }}>
                        <Typography variant="body1" fontWeight="600">Alcohol Use</Typography>
                        <FormControl sx={{ minWidth: 200 }}>
                          <Select
                            size="small"
                            value={vitals.alcohol_use || 'None'}
                            onChange={(e) => setVitals({ ...vitals, alcohol_use: e.target.value })}
                            disabled={!vitals.social_history.take_any}
                          >
                            <MenuItem value="None">None</MenuItem>
                            <MenuItem value="Sometimes">Sometimes</MenuItem>
                            <MenuItem value="Regular">Regular</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" fontWeight="600">Housing Mediation</Typography>
                        <RadioGroup 
                          row 
                          value={vitals.social_history.housing} 
                          onChange={(e) => setVitals({
                            ...vitals, 
                            social_history: { ...vitals.social_history, housing: e.target.value }
                          })}
                        >
                          <FormControlLabel value="Catcha" control={<Radio size="small" />} label="Catcha" />
                          <FormControlLabel value="Paka" control={<Radio size="small" />} label="Paka" />
                        </RadioGroup>
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" fontWeight="600">Drinking Water Sources</Typography>
                        <RadioGroup 
                          row 
                          value={vitals.social_history.water_source} 
                          onChange={(e) => setVitals({
                            ...vitals, 
                            social_history: { ...vitals.social_history, water_source: e.target.value }
                          })}
                        >
                          <FormControlLabel value="Safe" control={<Radio size="small" />} label="Safe" />
                          <FormControlLabel value="Unsafe" control={<Radio size="small" />} label="Unsafe" />
                        </RadioGroup>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {mode === 3 && (
              <Stack spacing={6}>
                <Box>
                  <Typography variant="h4" fontWeight="900" color="primary" textAlign="center">LABS & RISK</Typography>
                  {isPediatric && (
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary', fontWeight: 700, mt: 1 }}>
                      * Clinical interpretation required for pediatrics
                    </Typography>
                  )}
                </Box>
                
                <Stack spacing={4}>
                  {/* RBG Section */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h6" fontWeight="700">Random Blood Glucose (RBG)</Typography>
                      <ToggleButtonGroup
                        size="small"
                        color="primary"
                        value={glucoseUnit}
                        exclusive
                        onChange={(_, val) => val && setGlucoseUnit(val)}
                      >
                        <ToggleButton value="mg/dL">mg/dL</ToggleButton>
                        <ToggleButton value="mmol/L">mmol/L</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <TextField 
                        fullWidth 
                        placeholder={glucoseUnit === 'mg/dL' ? "EX: 140" : "EX: 7.8"}
                        type="number"
                        value={isNaN(vitals.rbg) || vitals.rbg === 0 ? '' : (glucoseUnit === 'mg/dL' ? vitals.rbg : parseFloat((vitals.rbg / 18).toFixed(2)))} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val)) {
                            setVitals({...vitals, rbg: NaN});
                            return;
                          }
                          const mgdl = glucoseUnit === 'mg/dL' ? val : val * 18;
                          setVitals({...vitals, rbg: mgdl});
                        }} 
                        InputProps={{ 
                          sx: { 
                            height: 80, 
                            fontSize: '1.5rem', 
                            fontWeight: 700,
                            borderLeft: vitals.rbg > 0 ? `10px solid ${getVitalStatus('rbg', vitals.rbg).color}` : 'none'
                          },
                          endAdornment: <Typography variant="h6" sx={{ ml: 2, color: 'text.secondary' }}>{glucoseUnit}</Typography>
                        }}
                      />
                      {vitals.rbg > 0 && (
                        <Chip 
                          label={getVitalStatus('rbg', vitals.rbg).label} 
                          sx={{ bgcolor: getVitalStatus('rbg', vitals.rbg).color, color: 'white', fontWeight: 900, height: 40, px: 2 }} 
                        />
                      )}
                    </Box>
                  </Box>

                  {/* FBG Section */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h6" fontWeight="700">Fasting Blood Glucose (FBG)</Typography>
                      <ToggleButtonGroup
                        size="small"
                        color="primary"
                        value={glucoseUnit}
                        exclusive
                        onChange={(_, val) => val && setGlucoseUnit(val)}
                      >
                        <ToggleButton value="mg/dL">mg/dL</ToggleButton>
                        <ToggleButton value="mmol/L">mmol/L</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <TextField 
                        fullWidth 
                        placeholder={glucoseUnit === 'mg/dL' ? "EX: 100" : "EX: 5.6"}
                        type="number"
                        value={isNaN(vitals.fbg) || vitals.fbg === 0 ? '' : (glucoseUnit === 'mg/dL' ? vitals.fbg : parseFloat((vitals.fbg / 18).toFixed(2)))} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val)) {
                            setVitals({...vitals, fbg: NaN});
                            return;
                          }
                          const mgdl = glucoseUnit === 'mg/dL' ? val : val * 18;
                          setVitals({...vitals, fbg: mgdl});
                        }} 
                        InputProps={{ 
                          sx: { 
                            height: 80, 
                            fontSize: '1.5rem', 
                            fontWeight: 700,
                            borderLeft: vitals.fbg > 0 ? `10px solid ${getVitalStatus('fbg', vitals.fbg).color}` : 'none'
                          },
                          endAdornment: <Typography variant="h6" sx={{ ml: 2, color: 'text.secondary' }}>{glucoseUnit}</Typography>
                        }}
                      />
                      {vitals.fbg > 0 && (
                        <Chip 
                          label={getVitalStatus('fbg', vitals.fbg).label} 
                          sx={{ bgcolor: getVitalStatus('fbg', vitals.fbg).color, color: 'white', fontWeight: 900, height: 40, px: 2 }} 
                        />
                      )}
                    </Box>
                  </Box>

                  <Box>
                    <Typography variant="h6" fontWeight="700" sx={{ mb: 1 }}>Hours Since Last Meal</Typography>
                    <TextField 
                      fullWidth 
                      placeholder="Ex : 3"
                      type="number"
                      value={isNaN(vitals.hours_since_meal) || vitals.hours_since_meal === 0 ? '' : vitals.hours_since_meal} 
                      onChange={(e) => setVitals({...vitals, hours_since_meal: parseFloat(e.target.value)})} 
                      InputProps={{ sx: { height: 80, fontSize: '1.5rem', fontWeight: 700 }}}
                    />
                  </Box>

                  {/* Hemoglobin Section */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography variant="h6" fontWeight="700">Hemoglobin (Hb)</Typography>
                      <ToggleButtonGroup
                        size="small"
                        color="primary"
                        value={hbUnit}
                        exclusive
                        onChange={(_, val) => val && setHbUnit(val)}
                      >
                        <ToggleButton value="g/dL">g/dL</ToggleButton>
                        <ToggleButton value="g/L">g/L</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <TextField 
                        fullWidth 
                        placeholder={hbUnit === 'g/dL' ? "Ex : 13.8" : "Ex : 138"}
                        type="number"
                        value={isNaN(vitals.hemoglobin) || vitals.hemoglobin === 0 ? '' : (hbUnit === 'g/dL' ? vitals.hemoglobin : parseFloat((vitals.hemoglobin * 10).toFixed(1)))} 
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val)) {
                            setVitals({...vitals, hemoglobin: NaN});
                            return;
                          }
                          const gdl = hbUnit === 'g/dL' ? val : val / 10;
                          setVitals({...vitals, hemoglobin: gdl});
                        }} 
                        InputProps={{ 
                          sx: { 
                            height: 80, 
                            fontSize: '1.5rem', 
                            fontWeight: 700,
                            borderLeft: vitals.hemoglobin > 0 ? `10px solid ${getHbStatus(vitals.hemoglobin).color}` : 'none'
                          },
                          endAdornment: <Typography variant="h6" sx={{ ml: 2, color: 'text.secondary' }}>{hbUnit}</Typography>
                        }}
                      />
                      {vitals.hemoglobin > 0 && (
                        <Chip 
                          label={getHbStatus(vitals.hemoglobin).label} 
                          sx={{ bgcolor: getHbStatus(vitals.hemoglobin).color, color: 'white', fontWeight: 900, height: 40, px: 2 }} 
                        />
                      )}
                    </Box>
                  </Box>
                </Stack>

                <Box sx={{ p: 4, bgcolor: '#f8fafc', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                  <Typography variant="h6" fontWeight="900" color="text.secondary" gutterBottom>Clinical Context Flags</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={<Switch checked={vitals.is_fasting} onChange={(e) => setVitals({...vitals, is_fasting: e.target.checked})} />}
                        label="Patient is Fasting"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={<Switch checked={vitals.has_symptoms} onChange={(e) => setVitals({...vitals, has_symptoms: e.target.checked})} />}
                        label="Symptomatic (for RBG)"
                      />
                    </Grid>
                  </Grid>
                </Box>

                <TextField 
                  fullWidth 
                  multiline 
                  rows={3} 
                  label="Allergies" 
                  value={vitals.allergies} 
                  onChange={(e) => setVitals({...vitals, allergies: e.target.value})} 
                  InputProps={{ sx: { fontSize: '1.25rem', fontWeight: 500 }}}
                />
                
                <Divider sx={{ my: 4 }} />
                
                <Box sx={{ p: 5, bgcolor: '#f0f9ff', borderRadius: 5, border: '2px solid #bae6fd' }}>
                  <Typography variant="h5" sx={{ color: '#0369a1', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
                    SYSTEM SUGGESTION: <span style={{ textTransform: 'uppercase' }}>{systemTriage.triage_level}</span>
                  </Typography>
                  <FormControl fullWidth sx={{ mt: 4 }}>
                    <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', mb: 1, textTransform: 'uppercase' }}>Nurse Override</Typography>
                    <Select 
                      value={vitals.nurse_priority} 
                      onChange={(e) => setVitals({...vitals, nurse_priority: e.target.value})} 
                      sx={{ height: 80, fontWeight: 900, fontSize: '1.5rem', bgcolor: 'white', borderRadius: 3 }}
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

            <Box sx={{ mt: 8, pt: 4, borderTop: '2px dashed #e2e8f0' }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button 
                    fullWidth variant="outlined" color="inherit" size="large" 
                    startIcon={<CancelIcon />} onClick={() => setSelectedPatient(null)}
                    sx={{ height: 60, borderRadius: 3, fontWeight: 800 }}
                  >
                    Cancel
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button 
                    fullWidth variant="outlined" color="primary" size="large" 
                    startIcon={<SaveIcon />} onClick={() => handleSaveVitals(station as any)}
                    disabled={isSaving}
                    sx={{ height: 60, borderRadius: 3, fontWeight: 800 }}
                  >
                    Save Progress
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button 
                    fullWidth variant="contained" color="info" size="large" 
                    onClick={() => handleSaveVitals(station as any)}
                    disabled={isSaving}
                    sx={{ height: 60, borderRadius: 3, fontWeight: 800 }}
                  >
                    Complete Collection
                  </Button>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Button 
                    fullWidth variant="contained" color="primary" size="large" 
                    endIcon={<NextIcon />} 
                    onClick={() => {
                      let nextStatus: EncounterStatus = 'READY_FOR_DOCTOR';
                      if (mode === 1) nextStatus = 'WAITING_FOR_VITALS_2';
                      else if (mode === 2) nextStatus = 'WAITING_FOR_VITALS_3';
                      handleSaveVitals(nextStatus);
                    }}
                    disabled={isSaving}
                    sx={{ height: 60, borderRadius: 3, fontWeight: 900, fontSize: '1.1rem' }}
                  >
                    Complete & Move
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Box>
      )}
      <CancelQueueDialog 
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelQueueItem}
        patientName={cancelTarget?.patient_name || ''}
      />
    </StationLayout>
  );
};

export default VitalsStation;