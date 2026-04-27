import React from 'react';
import { Box, Paper, Typography, Avatar, Chip, Stack, Divider, Tooltip } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

// Icons for the Sentinel Alerts
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import SmokingRoomsIcon from '@mui/icons-material/SmokingRooms';
import WineBarIcon from '@mui/icons-material/WineBar';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PregnantWomanIcon from '@mui/icons-material/PregnantWoman';
import SpeedIcon from '@mui/icons-material/Speed';
import FavoriteIcon from '@mui/icons-material/Favorite';
import OpacityIcon from '@mui/icons-material/Opacity';

import { calculateAgeDisplay } from '../utils/patient';

const PatientContextBar: React.FC = () => {
  const { selectedPatient } = useAppStore();
  const { isMobile } = useResponsiveLayout();

  if (!selectedPatient) return null;

  // 1. Precise Age Calculation
  const ageDisplay = calculateAgeDisplay(selectedPatient);

  // 2. Triage Color System (Global Clinical Standard)
  const getTriageStyle = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': 
        return { bg: '#ef4444', text: '#fff', border: '2px solid #b91c1c', label: 'EMERGENCY' }; 
      case 'urgent': 
        return { bg: '#f59e0b', text: '#fff', border: '2px solid #d97706', label: 'URGENT' };
      case 'standard': 
        return { bg: '#10b981', text: '#fff', border: '2px solid #059669', label: 'STANDARD' };
      default: 
        return { bg: '#94a3b8', text: '#fff', border: '1px solid #64748b', label: 'PENDING' };
    }
  };

  const triage = getTriageStyle(selectedPatient.triage_level || 'standard');
  const vitals = selectedPatient.currentVitals;

  // 3. Highest Alert Color System (Halo)
  const getHighestAlertColor = () => {
    const colors = {
      RED: '#ef4444',
      YELLOW: '#f59e0b',
      GREEN: '#10b981',
      GRAY: '#94a3b8'
    };

    let highestPriority = 0; // 0: Gray, 1: Green, 2: Yellow, 3: Red
    let finalColor = colors.GRAY;

    const updatePriority = (color: string) => {
      let p = 0;
      if (color === colors.RED || color === '#f43f5e') p = 3;
      else if (color === colors.YELLOW) p = 2;
      else if (color === colors.GREEN) p = 1;

      if (p > highestPriority) {
        highestPriority = p;
        finalColor = color;
      }
    };

    // Factor: Triage Level
    updatePriority(triage.bg);

    if (vitals) {
      // Helper to get age in years
      const getAgeYears = () => {
        let years = selectedPatient.age_years;
        if (selectedPatient.date_of_birth) {
          const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
          if (regex.test(selectedPatient.date_of_birth)) {
            const [_, day, month, year] = selectedPatient.date_of_birth.match(regex)!;
            const birthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
            const today = new Date();
            years = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) years--;
          }
        } else if (selectedPatient.estimated_birth_year) {
          years = new Date().getFullYear() - selectedPatient.estimated_birth_year;
        }
        return years ?? 0;
      };

      const age = getAgeYears();

      // Factor: BP
      const s = vitals.systolic_2 || vitals.systolic;
      const d = vitals.diastolic_2 || vitals.diastolic;
      if (s >= 180 || d >= 120) updatePriority(colors.RED);
      else if (s >= 130 || d >= 80) updatePriority(colors.YELLOW);
      else if (s > 0) updatePriority(colors.GREEN);

      // Factor: HR
      if (vitals.heartRate > 0) {
        let hrLow = 60, hrHigh = 100;
        if (age < 1) { hrLow = 100; hrHigh = 160; }
        else if (age <= 2) { hrLow = 98; hrHigh = 140; }
        else if (age <= 5) { hrLow = 80; hrHigh = 120; }
        else if (age <= 12) { hrLow = 75; hrHigh = 110; }

        if (vitals.heartRate > hrHigh || vitals.heartRate < hrLow) updatePriority(colors.RED);
        else if (vitals.heartRate > (hrHigh - 5) || vitals.heartRate < (hrLow + 5)) updatePriority(colors.YELLOW);
        else updatePriority(colors.GREEN);
      }

      // Factor: RR
      if (vitals.respiratoryRate > 0) {
        let rrLow = 12, rrHigh = 20;
        if (age < 1) { rrLow = 30; rrHigh = 60; }
        else if (age <= 12) { rrLow = 18; rrHigh = 30; }

        if (vitals.respiratoryRate > rrHigh || vitals.respiratoryRate < rrLow) updatePriority(colors.RED);
        else if (vitals.respiratoryRate > (rrHigh - 2) || vitals.respiratoryRate < (rrLow + 2)) updatePriority(colors.YELLOW);
        else updatePriority(colors.GREEN);
      }

      // Factor: SpO2
      if (vitals.oxygenSaturation > 0) {
        if (vitals.oxygenSaturation < 90) updatePriority(colors.RED);
        else if (vitals.oxygenSaturation <= 92) updatePriority(colors.YELLOW);
        else updatePriority(colors.GREEN);
      }

      // Factor: BMI
      if (vitals.bmi_class === 'Obese' || vitals.bmi_class === 'Underweight') updatePriority(colors.RED);
      else if (vitals.bmi_class === 'Overweight') updatePriority(colors.YELLOW);
      else if (vitals.bmi > 0) updatePriority(colors.GREEN);

      // Factor: MUAC
      if (vitals.muac_class === 'Severely Malnourished') updatePriority(colors.RED);
      else if (vitals.muac_class === 'Moderately Malnourished') updatePriority(colors.YELLOW);
      else if (vitals.muac > 0) updatePriority(colors.GREEN);

      // Factor: Glucose (FBG/RBG)
      if (vitals.fbg >= 126 || vitals.rbg >= 200) updatePriority(colors.RED);
      else if (vitals.fbg >= 100 || vitals.rbg >= 140) updatePriority(colors.YELLOW);
      else if (vitals.fbg > 0 || vitals.rbg > 0) updatePriority(colors.GREEN);

      // Factor: Hemoglobin
      if (vitals.hemoglobin > 0) {
        if (vitals.hemoglobin < 7) updatePriority(colors.RED);
        else if (vitals.hemoglobin < 11) updatePriority(colors.YELLOW); // Simplified threshold for halo
        else updatePriority(colors.GREEN);
      }

      // CRITICAL: Nurse Override takes absolute precedence if set
      if (vitals.nurse_priority) {
        const overrideStyle = getTriageStyle(vitals.nurse_priority);
        return overrideStyle.bg;
      }
    }

    return finalColor;
  };

  const haloColor = getHighestAlertColor();

  return (
    <Paper 
      elevation={4} 
      sx={{ 
        p: 1.5, 
        mb: 0, 
        borderBottom: '1px solid rgba(0,0,0,0.12)', 
        borderRadius: 0,
        bgcolor: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        overflowX: 'auto',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}
    >
      {/* SECTION: Patient Identity */}
      <Avatar 
        src={selectedPatient.photo_url} 
        sx={{ 
          width: 52, 
          height: 52, 
          border: `4px solid ${haloColor}`, 
          boxShadow: `0 0 15px ${haloColor}66`,
          bgcolor: 'primary.main',
          transition: 'all 0.3s ease'
        }}
      >
        {selectedPatient.given_name?.[0]}{selectedPatient.family_name?.[0]}
      </Avatar>
      
      <Box sx={{ minWidth: '160px' }}>
        <Typography variant="h6" noWrap sx={{ lineHeight: 1.1, fontWeight: 900, fontSize: isMobile ? '0.95rem' : '1.1rem', color: '#1e293b' }}>
          {selectedPatient.given_name} {selectedPatient.family_name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', bgcolor: '#f1f5f9', px: 1, borderRadius: 1 }}>
            {selectedPatient.gender} • {ageDisplay || '??'}
          </Typography>
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 35, alignSelf: 'center' }} />

      {/* SECTION: Vitals Sparkline (Critical for Quick Review) */}
      {!isMobile && (
        <>
          <Stack direction="row" spacing={3} sx={{ px: 1 }}>
            <Box>
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', lineHeight: 1 }}>BP</Typography>
              <Typography variant="body2" sx={{ fontWeight: 900, color: '#0f172a' }}>
                {vitals?.systolic || '--'}/{vitals?.diastolic || '--'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', lineHeight: 1 }}>SpO2</Typography>
              <Typography variant="body2" sx={{ fontWeight: 900, color: (vitals?.oxygenSaturation && vitals.oxygenSaturation < 94) ? '#ef4444' : '#0f172a' }}>
                {vitals?.oxygenSaturation ? `${vitals.oxygenSaturation}%` : '--'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 900, display: 'block', lineHeight: 1 }}>RR</Typography>
              <Typography variant="body2" sx={{ fontWeight: 900, color: '#0f172a' }}>
                {vitals?.respiratoryRate || '--'}
              </Typography>
            </Box>
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 35, alignSelf: 'center' }} />
        </>
      )}

      {/* SECTION: The Risk Sentinel (Alert Network) */}
      <Stack direction="row" spacing={1} alignItems="center">
        {/* Pregnancy Alert */}
        {selectedPatient?.gender?.toLowerCase() === 'female' && vitals?.is_pregnant === true && (
          <Tooltip title={`Pregnancy: ${vitals?.pregnancy_months || '?'} months`}>
            <Chip 
              icon={<PregnantWomanIcon style={{ color: 'white', fontSize: 18 }} />}
              label="PREGNANT"
              sx={{ bgcolor: '#be123c', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
            />
          </Tooltip>
        )}

        {/* Allergy Alert */}
        {!!vitals?.allergies && (Array.isArray(vitals.allergies) ? vitals.allergies.length > 0 : String(vitals.allergies).length > 0) && (
          <Tooltip title={`Allergies: ${Array.isArray(vitals.allergies) ? vitals.allergies.join(', ') : vitals.allergies}`}>
            <Chip 
              icon={<WarningIcon style={{ color: 'white', fontSize: 16 }} />}
              label="ALLERGIES"
              sx={{ bgcolor: '#e11d48', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
            />
          </Tooltip>
        )}

        {/* Social History Alerts */}
        {vitals?.social_history?.take_any && (
          <>
            {vitals.social_history.smoking && (
              <Chip 
                icon={<SmokingRoomsIcon style={{ color: 'white', fontSize: 16 }} />}
                label="SMOKING"
                sx={{ bgcolor: '#f59e0b', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
              />
            )}
            {vitals.social_history.chewing_tobacco && (
              <Chip 
                icon={<SmokingRoomsIcon style={{ color: 'white', fontSize: 16 }} />}
                label="CHEWING"
                sx={{ bgcolor: '#991b1b', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
              />
            )}
            {vitals.alcohol_use && vitals.alcohol_use !== 'None' && (
              <Chip 
                icon={<WineBarIcon style={{ color: 'white', fontSize: 16 }} />}
                label={`ALCOHOL: ${vitals.alcohol_use.toUpperCase()}`}
                sx={{ bgcolor: '#4338ca', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
              />
            )}
            {vitals.social_history.betel_nuts && (
              <Chip 
                label="BETEL NUTS"
                sx={{ bgcolor: '#7c2d12', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
              />
            )}
            {vitals.social_history.recreational_drugs && (
              <Chip 
                label="DRUGS"
                sx={{ bgcolor: '#1e1b4b', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
              />
            )}
          </>
        )}

        {/* BMI Alert */}
        {!!vitals?.bmi_class && (vitals.bmi_class === 'Obese' || vitals.bmi_class === 'Overweight' || vitals.bmi_class === 'Underweight') && (
          <Chip 
            icon={<SpeedIcon style={{ color: 'white', fontSize: 16 }} />}
            label={vitals.bmi_class.toUpperCase()}
            sx={{ 
              bgcolor: vitals.bmi_class === 'Obese' ? '#7c2d12' : 
                       vitals.bmi_class === 'Overweight' ? '#f59e0b' : '#0369a1', 
              color: 'white', 
              fontWeight: 900, 
              borderRadius: 1.5, 
              height: 28, 
              fontSize: '0.7rem' 
            }}
          />
        )}

        {/* MUAC Alert */}
        {!!vitals?.muac_class && (vitals.muac_class === 'Severely Malnourished' || vitals.muac_class === 'Moderately Malnourished') && (
          <Chip 
            icon={<SpeedIcon style={{ color: 'white', fontSize: 16 }} />}
            label={vitals.muac_class.toUpperCase()}
            sx={{ bgcolor: vitals.muac_class === 'Severely Malnourished' ? '#ef4444' : '#f59e0b', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
          />
        )}

        {/* BP Alert - Hypertension if second reading is also abnormal (>= 130/80) */}
        {((vitals?.systolic_2 >= 130 || vitals?.diastolic_2 >= 80) || 
          (vitals?.systolic_2 === undefined && (vitals?.systolic >= 130 || vitals?.diastolic >= 80))) && (
          <Chip 
            icon={<FavoriteIcon style={{ color: 'white', fontSize: 16 }} />}
            label="HYPERTENSION"
            sx={{ bgcolor: '#b91c1c', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
          />
        )}

        {/* SpO2 Alert */}
        {vitals?.oxygenSaturation !== undefined && vitals.oxygenSaturation < 94 && (
          <Chip 
            icon={<OpacityIcon style={{ color: 'white', fontSize: 16 }} />}
            label="LOW SpO2"
            sx={{ bgcolor: '#7f1d1d', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
          />
        )}

        {/* Blood Sugar Alert */}
        {vitals?.rbg >= 200 && (
          <Chip 
            label="CRITICAL RBG"
            sx={{ bgcolor: '#9d174d', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
          />
        )}
        {vitals?.fbg >= 126 && (
          <Chip 
            label="HIGH FBG"
            sx={{ bgcolor: '#9d174d', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
          />
        )}

        {/* Hemoglobin Alert */}
        {vitals?.hemoglobin > 0 && vitals.hemoglobin < 11 && (
          <Chip 
            icon={<OpacityIcon style={{ color: 'white', fontSize: 16 }} />}
            label={vitals.hemoglobin < 7 ? "SEVERE ANEMIA" : vitals.hemoglobin < 10 ? "MODERATE ANEMIA" : "MILD ANEMIA"}
            sx={{ bgcolor: vitals.hemoglobin < 7 ? '#ef4444' : vitals.hemoglobin < 10 ? '#f97316' : '#f59e0b', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
          />
        )}
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      <LocalHospitalIcon sx={{ color: triage.bg, opacity: 0.9, fontSize: 24 }} />
    </Paper>
  );
};

export default PatientContextBar;