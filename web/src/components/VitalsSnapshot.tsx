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
        <Typography variant="body2" color="textSecondary" align="center">No data recorded for this visit.</Typography>
      </Paper>
    );
  }

  const renderSection = (title: string, items: { label: string; value: any; color?: string; abnormal?: boolean }[]) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="caption" fontWeight="900" color="primary" sx={{ textTransform: 'uppercase', mb: 1, display: 'block' }}>
        {title}
      </Typography>
      <Grid container spacing={1}>
        {items.map((item, idx) => (
          <Grid size={6} key={idx}>
            <Box sx={{ 
              p: 1, 
              borderRadius: 1, 
              bgcolor: 'white', 
              border: '1px solid', 
              borderColor: item.abnormal ? 'error.main' : '#e2e8f0',
              height: '100%'
            }}>
              <Typography variant="caption" color="textSecondary" display="block" sx={{ fontSize: '0.65rem' }}>{item.label}</Typography>
              <Typography variant="body2" fontWeight="bold" color={item.abnormal ? 'error.main' : (item.color || 'text.primary')} sx={{ fontSize: '0.8rem' }}>
                {item.value || '--'}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const isAbnormalTemp = vitals.temperature && (vitals.temperature > 37.5 || vitals.temperature < 35.0);
  const isAbnormalHR = vitals.heartRate && (vitals.heartRate > 100 || vitals.heartRate < 60);
  const isAbnormalBP = vitals.systolic && vitals.diastolic && (vitals.systolic > 140 || vitals.diastolic > 90 || vitals.systolic < 90 || vitals.diastolic < 60);
  const isAbnormalO2 = vitals.oxygenSaturation && vitals.oxygenSaturation < 95;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 4, mb: 3, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
      <Typography variant="subtitle2" color="primary" fontWeight="900" sx={{ mb: 3, borderBottom: '2px solid', pb: 1 }}>
        STATION DATA SUMMARY
      </Typography>

      {renderSection('Body Measures', [
        { label: 'Weight', value: vitals.weight ? `${vitals.weight} kg` : null },
        { label: 'Height', value: vitals.height ? `${vitals.height} cm` : null },
        { label: 'BMI', value: vitals.bmi ? `${vitals.bmi} (${vitals.bmi_class})` : null },
        { label: 'MUAC', value: vitals.muac ? `${vitals.muac} (${vitals.muac_class})` : null },
      ])}

      {renderSection('Vital Signs', [
        { label: 'BP (1st)', value: vitals.systolic ? `${vitals.systolic}/${vitals.diastolic}` : null, abnormal: isAbnormalBP },
        { label: 'BP (2nd)', value: vitals.systolic_2 ? `${vitals.systolic_2}/${vitals.diastolic_2}` : null },
        { label: 'Heart Rate', value: vitals.heartRate ? `${vitals.heartRate} bpm` : null, abnormal: isAbnormalHR },
        { label: 'Temp', value: vitals.temperature ? `${vitals.temperature}°C` : null, abnormal: isAbnormalTemp },
        { label: 'SpO2', value: vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%` : null, abnormal: isAbnormalO2 },
        { label: 'Resp Rate', value: vitals.respiratoryRate ? `${vitals.respiratoryRate}/min` : null },
      ])}

      {renderSection('Labs & Risks', [
        { label: 'Blood Group', value: vitals.blood_group, color: 'error.main' },
        { label: 'FBG', value: vitals.fbg ? `${vitals.fbg} mg/dL` : null },
        { label: 'RBG', value: vitals.rbg ? `${vitals.rbg} mg/dL` : null },
        { label: 'Hemoglobin', value: vitals.hemoglobin ? `${vitals.hemoglobin} g/dL` : null },
        { label: 'Pregnant', value: vitals.is_pregnant ? `Yes (${vitals.pregnancy_months}m)` : 'No' },
        { label: 'Allergies', value: vitals.allergies?.length ? vitals.allergies.join(', ') : 'None', color: 'error.main' },
      ])}
    </Paper>
  );
};

export default VitalsSnapshot;
