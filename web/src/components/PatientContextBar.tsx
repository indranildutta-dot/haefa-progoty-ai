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

const PatientContextBar: React.FC = () => {
  const { selectedPatient } = useAppStore();
  const { isMobile } = useResponsiveLayout();

  if (!selectedPatient) return null;

  // 1. Precise Age Calculation
  const age = selectedPatient.age_years !== undefined 
    ? selectedPatient.age_years 
    : (selectedPatient.date_of_birth 
        ? new Date().getFullYear() - new Date(selectedPatient.date_of_birth).getFullYear() 
        : 'Unknown');

  // 2. Triage Color System (Global Standard)
  const getTriageStyle = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': 
        return { bg: '#ef4444', text: '#fff', border: '2px solid #b91c1c', label: 'EMERGENCY' }; // Deep Red
      case 'urgent': 
        return { bg: '#f59e0b', text: '#fff', border: '2px solid #d97706', label: 'URGENT' };    // Amber
      case 'standard': 
        return { bg: '#10b981', text: '#fff', border: '2px solid #059669', label: 'STANDARD' };  // Green
      default: 
        return { bg: '#94a3b8', text: '#fff', border: '1px solid #64748b', label: 'NOT TRIAGED' };
    }
  };

  const triage = getTriageStyle(selectedPatient.triage_level || 'standard');
  const vitals = selectedPatient.currentVitals || {};

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        p: 1.5, 
        mb: 0, // Pinned to the top of workspaces
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
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }}
    >
      {/* SECTION: Patient Identity */}
      <Avatar 
        src={selectedPatient.photo_url} 
        sx={{ 
          width: 56, 
          height: 56, 
          border: '2px solid white', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          bgcolor: 'primary.main'
        }}
      >
        {selectedPatient.given_name?.[0]}{selectedPatient.family_name?.[0]}
      </Avatar>
      
      <Box sx={{ minWidth: '180px' }}>
        <Typography variant="h6" noWrap sx={{ lineHeight: 1.1, fontWeight: 900, fontSize: isMobile ? '1rem' : '1.2rem', color: '#1e293b' }}>
          {selectedPatient.given_name} {selectedPatient.family_name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', bgcolor: '#f1f5f9', px: 1, borderRadius: 1 }}>
            {selectedPatient.gender} • {age} YRS
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.disabled', fontSize: '0.7rem' }}>
            ID: {selectedPatient.id?.substring(0, 8)}
          </Typography>
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 40, alignSelf: 'center' }} />

      {/* SECTION: The Risk Sentinel (The "Safety Network") */}
      <Stack direction="row" spacing={1.5} alignItems="center">
        
        {/* 1. Triage Badge */}
        <Tooltip title="Patient Priority Level">
          <Chip 
            label={triage.label} 
            sx={{ 
              bgcolor: triage.bg, 
              color: triage.text, 
              fontWeight: 900, 
              borderRadius: 1.5,
              height: 32,
              border: triage.border,
              px: 1,
              '& .MuiChip-label': { px: 1 }
            }} 
          />
        </Tooltip>

        {/* 2. Pregnancy Alert (Critical Red) */}
        {vitals.is_pregnant === 'yes' && (
          <Tooltip title={`Pregnant: ${vitals.pregnancy_months || '?'} months`}>
            <Chip 
              icon={<PregnantWomanIcon style={{ color: 'white' }} />}
              label="PREGNANT"
              sx={{ bgcolor: '#be123c', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 32 }}
            />
          </Tooltip>
        )}

        {/* 3. Allergy Alert (Bright Red) */}
        {vitals.allergies && vitals.allergies.toLowerCase() !== 'none' && (
          <Tooltip title={`Allergies: ${vitals.allergies}`}>
            <Chip 
              icon={<WarningIcon style={{ color: 'white' }} />}
              label="ALLERGIES"
              sx={{ bgcolor: '#e11d48', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 32 }}
            />
          </Tooltip>
        )}

        {/* 4. Substance Use Alert (Dhaka Clinic Standard: Gutkha/Pan Masala) */}
        {vitals.tobacco_use && vitals.tobacco_use !== 'none' && (
          <Tooltip title={`Tobacco History: ${vitals.tobacco_use}`}>
            <Chip 
              icon={<SmokingRoomsIcon style={{ color: 'white' }} />}
              label={vitals.tobacco_use === 'chewing' || vitals.tobacco_use === 'both' ? "GUTKHA/PAN" : "TOBACCO"}
              sx={{ 
                bgcolor: (vitals.tobacco_use === 'chewing' || vitals.tobacco_use === 'both') ? '#991b1b' : '#f59e0b', 
                color: 'white', 
                fontWeight: 900, 
                borderRadius: 1.5,
                height: 32 
              }}
            />
          </Tooltip>
        )}

        {/* 5. Alcohol Alert */}
        {vitals.alcohol_consumption && vitals.alcohol_consumption !== 'none' && (
          <Tooltip title={`Alcohol Intake: ${vitals.alcohol_consumption}`}>
            <Chip 
              icon={<WineBarIcon style={{ color: 'white' }} />}
              label="ALCOHOL"
              sx={{ 
                bgcolor: vitals.alcohol_consumption === 'regular' ? '#ef4444' : '#fbbf24', 
                color: 'white', 
                fontWeight: 900, 
                borderRadius: 1.5,
                height: 32 
              }}
            />
          </Tooltip>
        )}
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      {/* SECTION: Context Meta */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pr: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
          Finalized Station
        </Typography>
        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800 }}>
          {vitals.created_by ? `Nurse STN: ${vitals.created_by.substring(0, 4)}` : 'Awaiting Triage'}
        </Typography>
      </Box>

      {/* Station Icon Indicator */}
      <LocalHospitalIcon sx={{ color: triage.bg, opacity: 0.8, fontSize: 28, ml: 1 }} />
    </Paper>
  );
};

export default PatientContextBar;