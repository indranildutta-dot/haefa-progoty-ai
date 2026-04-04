import React from 'react';
import { Box, Typography, Paper, Skeleton } from '@mui/material';
import { QueuePatient } from '../../types';
import PatientQueueCard from './PatientQueueCard';

interface QueueColumnProps {
  title: string;
  patients: QueuePatient[];
  onPatientClick: (patient: QueuePatient) => void;
  headerColor?: string;
  loading?: boolean;
}

const QueueColumn: React.FC<QueueColumnProps> = ({ title, patients, onPatientClick, headerColor = 'grey.200', loading = false }) => {
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        flex: 1,
        minWidth: 200, 
        bgcolor: 'grey.50', 
        borderRadius: 3, 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        maxHeight: '85vh',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        p: 2,
        bgcolor: headerColor,
        borderBottom: '1px solid',
        borderColor: 'divider'
      }}>
        <Typography variant="h6" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </Typography>
        <Typography variant="h5" sx={{ bgcolor: 'rgba(255,255,255,0.7)', px: 2, py: 0.5, borderRadius: 2, fontWeight: '900' }}>
          {loading ? '-' : patients.length}
        </Typography>
      </Box>
      
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
        {loading ? (
          <>
            <Skeleton variant="rounded" height={120} sx={{ mb: 2, borderRadius: 2 }} />
            <Skeleton variant="rounded" height={120} sx={{ mb: 2, borderRadius: 2 }} />
            <Skeleton variant="rounded" height={120} sx={{ mb: 2, borderRadius: 2 }} />
          </>
        ) : patients.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
            No patients in queue
          </Typography>
        ) : (
          patients.map(patient => (
            <PatientQueueCard key={patient.encounterId} patient={patient} onClick={onPatientClick} />
          ))
        )}
      </Box>
    </Paper>
  );
};

export default QueueColumn;
