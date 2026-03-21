import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

interface FunnelData {
  registered: number;
  vitals: number;
  doctor: number;
  pharmacy: number;
  completed: number;
}

interface PatientFlowFunnelProps {
  data: FunnelData;
}

const PatientFlowFunnel: React.FC<PatientFlowFunnelProps> = ({ data }) => {
  return (
    <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <CardContent>
        <Typography variant="h6" fontWeight="800" gutterBottom>Patient Flow Funnel</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          {[
            { label: 'Reg', value: data.registered },
            { label: 'Vit', value: data.vitals },
            { label: 'Doc', value: data.doctor },
            { label: 'Phar', value: data.pharmacy },
            { label: 'Comp', value: data.completed },
          ].map((item, index) => (
            <Box key={index} sx={{ textAlign: 'center' }}>
              <Typography variant="h5" fontWeight="900">{item.value}</Typography>
              <Typography variant="caption" color="text.secondary" fontWeight="600">{item.label}</Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default PatientFlowFunnel;
