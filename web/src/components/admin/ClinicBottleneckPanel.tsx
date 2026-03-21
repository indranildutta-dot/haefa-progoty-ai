import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';

interface Bottleneck {
  station: string;
  queue: number;
  avgWait: number;
}

interface ClinicBottleneckPanelProps {
  bottleneck: Bottleneck | null;
}

const ClinicBottleneckPanel: React.FC<ClinicBottleneckPanelProps> = ({ bottleneck }) => {
  if (!bottleneck) {
    return (
      <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <CardContent>
          <Typography variant="h6" fontWeight="800" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="success" /> Clinic Bottleneck Detection
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No bottlenecks detected. Clinic flow is healthy.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'warning.main', boxShadow: 'none', bgcolor: 'warning.50' }}>
      <CardContent>
        <Typography variant="h6" fontWeight="800" color="warning.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon /> Bottleneck Station
        </Typography>
        <Typography variant="h5" fontWeight="900" sx={{ mt: 1 }}>{bottleneck.station}</Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Typography variant="body2" fontWeight="bold">Queue: {bottleneck.queue} patients</Typography>
          <Typography variant="body2" fontWeight="bold">Avg Wait: {bottleneck.avgWait} minutes</Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ClinicBottleneckPanel;
