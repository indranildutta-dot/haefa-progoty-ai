import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

type SystemStatus = 'online' | 'degraded' | 'offline';

const SystemHealthIndicator: React.FC = () => {
  // Placeholder for real health status
  const status: string = 'online';

  const getStatusColor = () => {
    switch (status) {
      case 'online': return '#4caf50';
      case 'degraded': return '#ff9800';
      case 'offline': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  return (
    <Tooltip title={`System Status: ${status.toUpperCase()}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}>
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
          SYSTEM {status.toUpperCase()}
        </Typography>
      </Box>
    </Tooltip>
  );
};

export default SystemHealthIndicator;
