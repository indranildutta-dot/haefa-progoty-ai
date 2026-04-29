import React, { useState, useEffect } from 'react';
import { Box, Tooltip, Typography, IconButton } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import SyncStatusDialog from './SyncStatusDialog';

type SystemStatus = 'online' | 'offline';

const SystemHealthIndicator: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>(navigator.onLine ? 'online' : 'offline');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'online': return '#4caf50';
      case 'offline': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <>
      <Tooltip title={`System Status: ${status.toUpperCase()} - Click for Details`}>
        <IconButton 
          onClick={() => setDialogOpen(true)}
          sx={{ ml: 2, borderRadius: 2, p: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FiberManualRecordIcon 
              sx={{ 
                fontSize: 12, 
                color: getStatusColor(),
                mr: 0.5,
                animation: status === 'online' ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                  '100%': { opacity: 1 },
                }
              }} 
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'medium', display: { xs: 'none', md: 'block' } }}>
              {status === 'offline' ? 'OFFLINE MODE' : 'SYSTEM ONLINE'}
            </Typography>
          </Box>
        </IconButton>
      </Tooltip>
      
      <SyncStatusDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};

export default SystemHealthIndicator;
