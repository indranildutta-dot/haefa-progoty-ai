import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

interface PatientWait {
  name: string;
  station: string;
  wait: number;
}

interface LongestWaitPanelProps {
  patients: PatientWait[];
}

const LongestWaitPanel: React.FC<LongestWaitPanelProps> = ({ patients }) => {
  return (
    <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <CardContent>
        <Typography variant="h6" fontWeight="800" gutterBottom>Longest Waiting</Typography>
        {patients.map((p, index) => (
          <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Box>
              <Typography variant="body2" fontWeight="bold">{p.name}</Typography>
              <Typography variant="caption" color="text.secondary">{p.station}</Typography>
            </Box>
            <Typography variant="body2" fontWeight="bold" color="error.main">{p.wait} min</Typography>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
};

export default LongestWaitPanel;
