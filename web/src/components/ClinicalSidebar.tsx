import React from 'react';
import { Box, Paper, Typography, Divider, Stack, Chip } from '@mui/material';
import { useAppStore } from '../store/useAppStore';
import { 
  MonitorWeight as WeightIcon, 
  Height as HeightIcon, 
  Favorite as HeartIcon, 
  Thermostat as TempIcon,
  Opacity as OpacityIcon,
  SmokingRooms as TobaccoIcon,
  WineBar as AlcoholIcon
} from '@mui/icons-material';

const ClinicalSidebar: React.FC = () => {
  const { selectedPatient } = useAppStore();

  if (!selectedPatient || !selectedPatient.currentVitals) return null;

  const v = selectedPatient.currentVitals;

  const DataRow = ({ icon, label, value, unit, color }: any) => (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        {React.cloneElement(icon, { sx: { fontSize: 16, color: color || 'text.secondary' } })}
        <Typography variant="caption" fontWeight="800" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Stack>
      <Typography variant="body1" fontWeight="900" color="#1e293b">
        {value || '--'} <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>{unit}</span>
      </Typography>
    </Box>
  );

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        width: 280, 
        p: 3, 
        borderRadius: 4, 
        border: '1px solid #e2e8f0', 
        bgcolor: 'white',
        height: 'fit-content',
        position: 'sticky',
        top: 100,
        display: { xs: 'none', md: 'block' }
      }}
    >
      <Typography variant="h6" fontWeight="900" sx={{ mb: 3, color: 'primary.main' }}>
        CLINICAL SUMMARY
      </Typography>

      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" fontWeight="900" color="text.disabled">Anthropometry</Typography>
          <Divider sx={{ mb: 2 }} />
          <DataRow icon={<HeightIcon />} label="Height" value={v.height} unit="cm" />
          <DataRow icon={<WeightIcon />} label="Weight" value={v.weight} unit="kg" />
          <DataRow icon={<WeightIcon />} label="BMI" value={v.bmi} unit={v.bmi_class} color="primary.main" />
          {v.muac && <DataRow icon={<WeightIcon />} label="MUAC" value={v.muac} unit={v.muac_class} />}
          {v.blood_group && <DataRow icon={<OpacityIcon />} label="Blood Group" value={v.blood_group} color="error.main" />}
        </Box>

        <Box>
          <Typography variant="overline" fontWeight="900" color="text.disabled">Vital Signs</Typography>
          <Divider sx={{ mb: 2 }} />
          <DataRow icon={<HeartIcon />} label="Blood Pressure" value={`${v.systolic}/${v.diastolic}`} unit="mmHg" />
          <DataRow icon={<HeartIcon />} label="Heart Rate" value={v.heartRate} unit="bpm" />
          <DataRow icon={<OpacityIcon />} label="SpO2" value={v.oxygenSaturation} unit="%" />
          <DataRow icon={<TempIcon />} label="Temperature" value={v.temperature} unit="°C" />
        </Box>

        <Box>
          <Typography variant="overline" fontWeight="900" color="text.disabled">Habits & Risk</Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {v.tobacco_use && v.tobacco_use !== 'none' && (
              <Chip 
                size="small" 
                icon={<TobaccoIcon />} 
                label={v.tobacco_use.toUpperCase()} 
                color="error" 
                variant="outlined" 
                sx={{ fontWeight: 800 }} 
              />
            )}
            {v.alcohol_consumption && v.alcohol_consumption !== 'none' && (
              <Chip 
                size="small" 
                icon={<AlcoholIcon />} 
                label={v.alcohol_consumption.toUpperCase()} 
                color="primary" 
                variant="outlined" 
                sx={{ fontWeight: 800 }} 
              />
            )}
            {selectedPatient?.gender?.toLowerCase() === 'female' && v.is_pregnant === true && (
              <Chip 
                size="small" 
                label="PREGNANT" 
                color="error" 
                sx={{ fontWeight: 800 }} 
              />
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

export default ClinicalSidebar;
