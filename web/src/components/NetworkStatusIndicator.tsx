import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { getOfflineQueueCount } from '../services/backgroundRetryQueue';

const NetworkStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll for queue count
    const interval = setInterval(async () => {
      const count = await getOfflineQueueCount();
      setQueueCount(count);
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && queueCount === 0) return null;

  return (
    <Box 
      sx={{ 
        position: 'fixed', 
        bottom: 16, 
        left: 16, 
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: isOnline ? '#f59e0b' : '#ef4444',
        color: 'white',
        px: 2,
        py: 1,
        borderRadius: 2,
        boxShadow: 3,
        fontWeight: 'bold',
        fontSize: '0.875rem'
      }}
    >
      {!isOnline ? (
        <>
          <SignalWifiOffIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Offline Mode</Typography>
        </>
      ) : (
        <>
          <CloudSyncIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Syncing {queueCount} offline records...</Typography>
        </>
      )}
    </Box>
  );
};

export default NetworkStatusIndicator;
