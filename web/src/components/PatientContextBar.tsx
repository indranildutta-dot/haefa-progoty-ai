import React from 'react';
import { Box, Paper, Typography, Avatar, Chip, Stack } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';

const PatientContextBar: React.FC = () => {
  const { selectedPatient } = useAppStore();
  const { isMobile } = useResponsiveLayout();

  if (!selectedPatient) return null;

  // 1. Calculate Age
  const age = selectedPatient.age_years !== undefined 
    ? selectedPatient.age_years 
    : (selectedPatient.date_of_birth 
        ? new Date().getFullYear() - new Date(selectedPatient.date_of_birth).getFullYear() 
        : 'Unknown');

  // 2. Triage & Risk Data (Assuming this is attached to selectedPatient from the store)
  const vitals = selectedPatient.currentVitals || {};
  const triageLevel = selectedPatient.triage_level || vitals.assigned_priority || 'standard';

  // 3. Helper for Risk Colors
  const getTriageColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': return { bg: '#ef4444', text: '#fff' }; // Red
      case 'urgent': return { bg: '#f59e0b', text: '#fff' };    // Amber
      case 'standard': return { bg: '#10b981', text: '#fff' };  // Green
      default: return { bg: '#94a3b8', text: '#fff' };         // Slate
    }
  };

  const triageStyle = getTriageColor(triageLevel);

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 1.5, 
        mb: 2, 
        borderBottom: '1px solid rgba(0,0,0,0.08)', 
        borderRadius: 0,
        bgcolor: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        overflowX: 'auto',
        position: 'sticky',
        top: 0,
        zIndex: 1100
      }}
    >
      <Avatar 
        src={selectedPatient.photo_url} 
        sx={{ width: 52, height: 52, border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
      >
        {selectedPatient.given_name?.[0]}{selectedPatient.family_name?.[0]}
      </Avatar>
      
      <Box sx={{ minWidth: '180px' }}>
        <Typography variant="h6" noWrap sx={{ lineHeight: 1.2, fontWeight: 800, fontSize: isMobile ? '1rem' : '1.2rem' }}>
          {selectedPatient.given_name} {selectedPatient.family_name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
            {selectedPatient.gender} • {age} YRS
          </Typography>
          <Chip 
            label={`ID: ${selectedPatient.id?.substring(0, 8)}`} 
            size="small" 
            variant="outlined" 
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 900, borderRadius: 1 }} 
          />
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

      {/* --- RISK ALERT SECTION (Dynamic Color Coding) --- */}
      <Stack direction="row" spacing={1.5} alignItems="center">
        
        {/* 1. Triage Status (Always Visible) */}
        <Chip 
          label={`TRIAGE: ${triageLevel.toUpperCase()}`} 
          sx={{ 
            bgcolor: triageStyle.bg, 
            color: triageStyle.text, 
            fontWeight: 900, 
            borderRadius: 1.5,
            px: 1
          }} 
        />

        {/* 2. Pregnancy Alert (Critical Red) */}
        {vitals.is_pregnant === 'yes' && (
          <Chip 
            icon={<ErrorIcon style={{ color: 'white' }} />}
            label={`PREGNANT: ${vitals.pregnancy_months || '?'} MONTHS`}
            sx={{ bgcolor: '#be123c', color: 'white', fontWeight: 900, borderRadius: 1.5 }}
          />
        )}

        {/* 3. Allergy Alert (Critical Red) */}
        {vitals.allergies && vitals.allergies.toLowerCase() !== 'none' && (
          <Chip 
            icon={<WarningIcon style={{ color: 'white' }} />}
            label="ALLERGIES DETECTED"
            sx={{ bgcolor: '#e11d48', color: 'white', fontWeight: 900, borderRadius: 1.5 }}
          />
        )}

        {/* 4. Tobacco/Substance Alert (Red for Gutkha, Yellow for Smoking) */}
        {vitals.tobacco_use && vitals.tobacco_use !== 'none' && (
          <Chip 
            label={vitals.tobacco_use === 'chewing' || vitals.tobacco_use === 'both' ? "HIGH RISK: GUTKHA/TOBACCO" : "TOBACCO USER"}
            sx={{ 
              bgcolor: (vitals.tobacco_use === 'chewing' || vitals.tobacco_use === 'both') ? '#991b1b' : '#f59e0b', 
              color: 'white', 
              fontWeight: 800, 
              borderRadius: 1.5 
            }}
          />
        )}

        {/* 5. Alcohol Alert */}
        {vitals.alcohol_consumption && vitals.alcohol_consumption !== 'none' && (
          <Chip 
            label={vitals.alcohol_consumption === 'regular' ? "ALCOHOL: HEAVY" : "ALCOHOL: OCCASIONAL"}
            sx={{ 
              bgcolor: vitals.alcohol_consumption === 'regular' ? '#ef4444' : '#fbbf24', 
              color: 'white', 
              fontWeight: 800, 
              borderRadius: 1.5 
            }}
          />
        )}

      </Stack>

      <Box sx={{ flexGrow: 1 }} />
      
      {/* Optional Station Indicator */}
      <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', pr: 2 }}>
        Finalized by: Nurse Station {vitals.created_by?.substring(0,4)}
      </Typography>
    </Paper>
  );
};

export default PatientContextBar;