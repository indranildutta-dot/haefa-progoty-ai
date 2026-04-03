import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import Grid from '@mui/material/Grid';
import { VitalsRecord } from '../types';

interface VitalsSnapshotProps {
  vitals: VitalsRecord | null;
}

const VitalsSnapshot: React.FC<VitalsSnapshotProps> = ({ vitals }) => {
  if (!vitals) {
    return (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3, bgcolor: 'grey.50' }}>
        <Typography variant="body2" color="textSecondary" align="center">No vitals recorded for this visit.</Typography>
      </Paper>
    );
  }

  const isAbnormalTemp = vitals.temperature && (vitals.temperature > 37.5 || vitals.temperature < 35.0);
  const isAbnormalHR = vitals.heartRate && (vitals.heartRate > 100 || vitals.heartRate < 60);
  const isAbnormalBP = vitals.systolic && vitals.diastolic && (vitals.systolic > 140 || vitals.diastolic > 90 || vitals.systolic < 90 || vitals.diastolic < 60);
  const isAbnormalO2 = vitals.oxygenSaturation && vitals.oxygenSaturation < 95;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3, bgcolor: 'primary.50', borderColor: 'primary.100' }}>
      <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
        Current Vitals
      </Typography>
      <Grid container spacing={1.5}>
        <Grid size={6}>
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'white', border: '1px solid', borderColor: isAbnormalTemp ? 'error.main' : 'divider' }}>
            <Typography variant="caption" color="textSecondary" display="block">Temp</Typography>
            <Typography variant="body2" fontWeight="bold" color={isAbnormalTemp ? 'error.main' : 'text.primary'}>
              {vitals.temperature}°C
            </Typography>
          </Box>
        </Grid>
        <Grid size={6}>
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'white', border: '1px solid', borderColor: isAbnormalHR ? 'error.main' : 'divider' }}>
            <Typography variant="caption" color="textSecondary" display="block">HR</Typography>
            <Typography variant="body2" fontWeight="bold" color={isAbnormalHR ? 'error.main' : 'text.primary'}>
              {vitals.heartRate} bpm
            </Typography>
          </Box>
        </Grid>
        <Grid size={6}>
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'white', border: '1px solid', borderColor: isAbnormalBP ? 'error.main' : 'divider' }}>
            <Typography variant="caption" color="textSecondary" display="block">BP</Typography>
            <Typography variant="body2" fontWeight="bold" color={isAbnormalBP ? 'error.main' : 'text.primary'}>
              {vitals.systolic}/{vitals.diastolic}
            </Typography>
          </Box>
        </Grid>
        <Grid size={6}>
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'white', border: '1px solid', borderColor: isAbnormalO2 ? 'error.main' : 'divider' }}>
            <Typography variant="caption" color="textSecondary" display="block">O2 Sat</Typography>
            <Typography variant="body2" fontWeight="bold" color={isAbnormalO2 ? 'error.main' : 'text.primary'}>
              {vitals.oxygenSaturation}%
            </Typography>
          </Box>
        </Grid>
        <Grid size={6}>
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'white', border: '1px solid divider' }}>
            <Typography variant="caption" color="textSecondary" display="block">BMI</Typography>
            <Typography variant="body2" fontWeight="bold">
              {vitals.bmi} ({vitals.bmi_class})
            </Typography>
          </Box>
        </Grid>
        <Grid size={6}>
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'white', border: '1px solid divider' }}>
            <Typography variant="caption" color="textSecondary" display="block">MUAC</Typography>
            <Typography variant="body2" fontWeight="bold">
              {vitals.muac} ({vitals.muac_class})
            </Typography>
          </Box>
        </Grid>
        <Grid size={12}>
          <Box sx={{ p: 1, borderRadius: 1, bgcolor: 'white', border: '1px solid divider' }}>
            <Typography variant="caption" color="textSecondary" display="block">Blood Group</Typography>
            <Typography variant="body2" fontWeight="bold" color="error.main">
              {vitals.blood_group || 'Not Recorded'}
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default VitalsSnapshot;
