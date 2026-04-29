import React from 'react';
import { Box, Typography, Avatar, Chip } from '@mui/material';
import { QueuePatient } from '../../types';

interface PatientQueueCardProps {
  patient: QueuePatient;
  onClick: (patient: QueuePatient) => void;
  isNew?: boolean;
}

const PatientQueueCard: React.FC<PatientQueueCardProps> = ({ patient, onClick, isNew }) => {
  const waitMinutes = Math.floor((new Date().getTime() - patient.createdAt.toDate().getTime()) / 60000);
  
  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs} hr ${mins} min`;
  };

  const getHaloColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': return '#ef4444'; // Red
      case 'urgent': return '#f59e0b';    // Yellow
      case 'standard': return '#10b981';  // Green
      default: return '#94a3b8';         // Grey
    }
  };

  const getWaitTimeColor = (minutes: number) => {
    if (minutes > 60) return 'error.main';
    if (minutes > 30) return 'warning.main';
    return 'text.secondary';
  };

  const nameParts = (patient.patientName || 'Unknown Patient').split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  return (
    <Box 
      onClick={() => onClick(patient)}
      sx={{ 
        p: 1, 
        mb: 1, 
        bgcolor: isNew ? '#dcfce7' : 'background.paper', 
        borderRadius: 3, 
        border: '1.5px solid',
        borderColor: isNew ? '#22c55e' : 'divider',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        '&:hover': { bgcolor: isNew ? '#bbf7d0' : 'action.hover', borderColor: 'primary.main', transform: 'translateY(-2px)' },
        transition: 'all 0.5s ease',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar 
          src={patient.photoUrl} 
          sx={{ 
            width: 56, 
            height: 56, 
            border: '6px solid', 
            borderColor: getHaloColor(patient.triageLevel),
            boxShadow: `0 0 0 2px white, 0 0 15px ${getHaloColor(patient.triageLevel)}66`,
            flexShrink: 0
          }}
        >
          {patient.patientName?.charAt(0) || '?'}
        </Avatar>
        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" fontWeight="900" noWrap sx={{ fontSize: '0.9rem', lineHeight: 1.1, color: 'text.primary' }}>
              {firstName}
            </Typography>
            <Typography variant="subtitle2" fontWeight="900" noWrap sx={{ fontSize: '0.9rem', lineHeight: 1.1, color: 'text.primary' }}>
              {lastName}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" fontWeight="700" sx={{ display: 'block', mt: 0.5, fontSize: '0.75rem' }}>
            {patient.ageDisplay ? `${patient.ageDisplay} • ` : ''}{patient.gender?.charAt(0).toUpperCase() || 'N/A'}
          </Typography>
          {patient.bmiClass && (patient.bmiClass === 'Obese' || patient.bmiClass === 'Overweight' || patient.bmiClass === 'Underweight') && (
            <Chip 
              label={patient.bmiClass.toUpperCase()} 
              size="small" 
              sx={{ 
                mt: 0.5, 
                fontWeight: 900, 
                height: 18, 
                bgcolor: patient.bmiClass === 'Obese' ? '#7c2d12' : patient.bmiClass === 'Overweight' ? '#f59e0b' : '#0369a1',
                color: 'white',
                fontSize: '0.55rem',
                borderRadius: 1
              }} 
            />
          )}
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1, pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ 
          color: getWaitTimeColor(waitMinutes), 
          fontWeight: '900', 
          fontSize: '0.7rem',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5
        }}>
          WAITING: {formatWaitTime(waitMinutes)}
        </Typography>
      </Box>
    </Box>
  );
};

export default PatientQueueCard;
