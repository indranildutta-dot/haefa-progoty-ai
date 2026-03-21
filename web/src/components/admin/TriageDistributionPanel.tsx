import React from 'react';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';

interface TriageDistributionPanelProps {
  data: { red: number; orange: number; yellow: number; green: number };
}

const TriageDistributionPanel: React.FC<TriageDistributionPanelProps> = ({ data }) => {
  return (
    <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <CardContent>
        <Typography variant="h6" fontWeight="800" gutterBottom>Triage Distribution</Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Chip label={`Red: ${data.red}`} sx={{ bgcolor: 'error.light', color: 'white', fontWeight: 'bold' }} />
          <Chip label={`Orange: ${data.orange}`} sx={{ bgcolor: 'warning.light', color: 'white', fontWeight: 'bold' }} />
          <Chip label={`Yellow: ${data.yellow}`} sx={{ bgcolor: 'info.light', color: 'white', fontWeight: 'bold' }} />
          <Chip label={`Green: ${data.green}`} sx={{ bgcolor: 'success.light', color: 'white', fontWeight: 'bold' }} />
        </Box>
      </CardContent>
    </Card>
  );
};

export default TriageDistributionPanel;
