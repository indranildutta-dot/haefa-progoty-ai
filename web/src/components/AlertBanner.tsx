import React from 'react';
import { Alert, Typography, Box } from '@mui/material';

interface AlertBannerProps {
  type: 'allergy' | 'critical' | 'warning' | 'info';
  title: string;
  message: string;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ type, title, message }) => {
  const severityMap = {
    allergy: 'error',
    critical: 'error',
    warning: 'warning',
    info: 'info'
  } as const;

  return (
    <Alert 
      severity={severityMap[type]} 
      sx={{ 
        mb: 2, 
        borderRadius: 2,
        border: '1px solid',
        borderColor: `${severityMap[type]}.main`,
        bgcolor: `${severityMap[type]}.50`,
        '& .MuiAlert-icon': {
          color: `${severityMap[type]}.main`,
          fontSize: 28,
          alignItems: 'center'
        }
      }}
    >
      <Box>
        <Typography variant="subtitle2" fontWeight="900" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: `${severityMap[type]}.main` }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.primary" fontWeight="500">
          {message}
        </Typography>
      </Box>
    </Alert>
  );
};

export default AlertBanner;
