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

const PatientContextBar: React.FC = () => {
  const { selectedPatient } = useAppStore();
  const { isMobile } = useResponsiveLayout();

  if (!selectedPatient) return null;

  // 1. Precise Age Calculation
  const age = selectedPatient.age_years !== undefined 
    ? selectedPatient.age_years 
    : (selectedPatient.date_of_birth 
        ? new Date().getFullYear() - new Date(selectedPatient.date_of_birth).getFullYear() 
        : '??');

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
          border: '2px solid white', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          bgcolor: 'primary.main'
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
            {selectedPatient.gender} • {age} YRS
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
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ mx: 1, height: 35, alignSelf: 'center' }} />
        </>
      )}

      {/* SECTION: The Risk Sentinel (Alert Network) */}
      <Stack direction="row" spacing={1} alignItems="center">
        {/* Triage Badge */}
        <Chip 
          label={triage.label} 
          sx={{ 
            bgcolor: triage.bg, color: triage.text, fontWeight: 900, 
            borderRadius: 1.5, height: 28, border: triage.border, fontSize: '0.7rem'
          }} 
        />

        {/* Pregnancy Alert */}
        {vitals?.is_pregnant === true && (
          <Tooltip title={`Pregnancy: ${vitals?.pregnancy_months || '?'} months`}>
            <Chip 
              icon={<PregnantWomanIcon style={{ color: 'white', fontSize: 18 }} />}
              label="PREGNANT"
              sx={{ bgcolor: '#be123c', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
            />
          </Tooltip>
        )}

        {/* Allergy Alert */}
        {vitals?.allergies && vitals?.allergies.length > 0 && (
          <Tooltip title={`Allergies: ${vitals?.allergies.join(', ')}`}>
            <Chip 
              icon={<WarningIcon style={{ color: 'white', fontSize: 16 }} />}
              label="ALLERGIES"
              sx={{ bgcolor: '#e11d48', color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' }}
            />
          </Tooltip>
        )}

        {/* Substance Use (Dhaka Standard) */}
        {vitals?.tobacco_use && vitals?.tobacco_use !== 'none' && (
          <Chip 
            icon={<SmokingRoomsIcon style={{ color: 'white', fontSize: 16 }} />}
            label={vitals?.tobacco_use === 'chewing' || vitals?.tobacco_use === 'both' ? "GUTKHA" : "TOBACCO"}
            sx={{ 
              bgcolor: (vitals?.tobacco_use === 'chewing') ? '#991b1b' : '#f59e0b', 
              color: 'white', fontWeight: 900, borderRadius: 1.5, height: 28, fontSize: '0.7rem' 
            }}
          />
        )}
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      {/* SECTION: Meta Information */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pr: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.6rem' }}>
          Finalized Station
        </Typography>
        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 900, fontSize: '0.75rem' }}>
          {vitals?.created_by ? `STN: ${vitals.created_by.substring(0, 5)}` : 'AWAITING TRIAGE'}
        </Typography>
      </Box>

      <LocalHospitalIcon sx={{ color: triage.bg, opacity: 0.9, fontSize: 24 }} />
    </Paper>
  );
};

export default PatientContextBar;