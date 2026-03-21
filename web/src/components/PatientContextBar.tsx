import React from 'react';
import { Box, Paper, Typography, Avatar, Chip, Skeleton } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const PatientContextBar: React.FC = () => {
  const { selectedPatient } = useAppStore();
  const { isMobile } = useResponsiveLayout();

  if (!selectedPatient) return null;

  const age = selectedPatient.age_years !== undefined 
    ? selectedPatient.age_years 
    : (selectedPatient.date_of_birth 
        ? new Date().getFullYear() - new Date(selectedPatient.date_of_birth).getFullYear() 
        : 'Unknown');

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
        overflowX: 'auto'
      }}
    >
      <Avatar 
        src={selectedPatient.photo_url} 
        sx={{ width: 48, height: 48, border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
      >
        {selectedPatient.given_name[0]}{selectedPatient.family_name[0]}
      </Avatar>
      
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" noWrap sx={{ lineHeight: 1.2, fontSize: isMobile ? '1rem' : '1.1rem' }}>
          {selectedPatient.given_name} {selectedPatient.family_name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            {selectedPatient.gender.toUpperCase()} • {age} YRS
          </Typography>
          <Chip 
            label={`ID: ${selectedPatient.id?.substring(0, 8)}`} 
            size="small" 
            variant="outlined" 
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} 
          />
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip 
          label="TRIAGE: STANDARD" 
          size="small" 
          color="info"
          sx={{ fontWeight: 800, borderRadius: 1 }}
        />
      </Box>
    </Paper>
  );
};

export default PatientContextBar;
