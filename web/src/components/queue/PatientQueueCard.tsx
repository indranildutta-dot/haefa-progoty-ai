import React from 'react';
import { Box, Typography, Avatar, Chip } from '@mui/material';
import { QueuePatient } from '../../types';

interface PatientQueueCardProps {
  patient: QueuePatient;
  onClick: (patient: QueuePatient) => void;
}

const PatientQueueCard: React.FC<PatientQueueCardProps> = ({ patient, onClick }) => {
  const waitMinutes = Math.floor((new Date().getTime() - patient.createdAt.toDate().getTime()) / 60000);
  
  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs} hr ${mins} min`;
  };

  const getTriageColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'emergency': return 'error.main';
      case 'urgent': return 'warning.main';
      case 'standard': return 'warning.light'; // Yellow
      case 'low': return 'success.main';
      default: return 'grey.400';
    }
  };

  const getWaitTimeColor = (minutes: number) => {
    if (minutes > 60) return 'error.main';
    if (minutes > 30) return 'warning.main';
    return 'text.secondary';
  };

  return (
    <Box 
      onClick={() => onClick(patient)}
      sx={{ 
        p: 1.5, 
        mb: 1.5, 
        bgcolor: 'background.paper', 
        borderRadius: 2, 
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
        '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5
      }}
    >
      <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
        <Chip 
          label={patient.triageLevel?.toUpperCase() || 'STANDARD'} 
          size="small" 
          sx={{ 
            bgcolor: getTriageColor(patient.triageLevel),
            color: patient.triageLevel === 'standard' ? 'black' : 'white',
            fontWeight: 900,
            fontSize: '0.65rem',
            height: 20,
            borderRadius: 1
          }} 
        />
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Avatar src={patient.photoUrl} sx={{ width: 48, height: 48, mr: 1.5, border: '2px solid', borderColor: 'grey.200' }}>
          {patient.patientName.charAt(0)}
        </Avatar>
        <Box sx={{ pr: 8 }}>
          <Typography variant="subtitle2" fontWeight="800" noWrap sx={{ fontSize: '0.95rem', lineHeight: 1.2 }}>
            {patient.patientName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Age: {patient.age} {patient.gender.charAt(0).toUpperCase()}
          </Typography>
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '60%' }}>
          Village: {patient.village || 'N/A'}
        </Typography>
        <Typography variant="caption" sx={{ color: getWaitTimeColor(waitMinutes), fontWeight: '900', bgcolor: waitMinutes > 30 ? (waitMinutes > 60 ? 'error.50' : 'warning.50') : 'transparent', px: waitMinutes > 30 ? 1 : 0, py: waitMinutes > 30 ? 0.5 : 0, borderRadius: 1 }}>
          Waiting: {formatWaitTime(waitMinutes)}
        </Typography>
      </Box>
    </Box>
  );
};

export default PatientQueueCard;
