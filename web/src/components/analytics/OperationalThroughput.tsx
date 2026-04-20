import React from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Grid,
  Tooltip,
  Stack
} from '@mui/material';
import { DailySummary } from '../../types';

import ReportSectionWrapper from './ReportSectionWrapper';

interface OperationalThroughputProps {
  summaries: DailySummary[];
}

const OperationalThroughput: React.FC<OperationalThroughputProps> = ({ summaries }) => {
  // Aggregate wait times
  const avgWaitTimes = React.useMemo(() => {
    if (summaries.length === 0) return null;
    const totals = { reg: 0, vitals: 0, doc: 0 };
    summaries.forEach(s => {
      totals.reg += s.avg_wait_times?.reg_to_vitals || 0;
      totals.vitals += s.avg_wait_times?.vitals_to_doc || 0;
      totals.doc += s.avg_wait_times?.doc_to_pharmacy || 0;
    });
    return {
      reg: totals.reg / summaries.length,
      vitals: totals.vitals / summaries.length,
      doc: totals.doc / summaries.length
    };
  }, [summaries]);

  // Color Intensity Scale (0 to 60 mins)
  const getIntensityColor = (minutes: number) => {
    if (minutes < 15) return '#f0fdf4'; // Light green
    if (minutes < 30) return '#fefce8'; // Light yellow
    if (minutes < 45) return '#fff7ed'; // Light orange
    return '#fef2f2'; // Light red
  };

  const getBorderColor = (minutes: number) => {
    if (minutes < 15) return '#166534';
    if (minutes < 30) return '#ca8a04';
    if (minutes < 45) return '#ea580c';
    return '#991b1b';
  };

  return (
    <ReportSectionWrapper 
      title="OPERATIONAL THROUGHPUT HEATMAP" 
      subtitle="AVG WAIT TIMES BETWEEN CLINICAL STATIONS (MINUTES)"
      description="This operational heatmap tracks the average waiting duration for patients as they move through different clinical touchpoints (Registration to Pharmacy). It is a key KPI for measuring clinic efficiency and identification of staffing gaps or process bottlenecks."
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <ThroughputNode 
            label="REGISTRATION → VITALS" 
            value={avgWaitTimes?.reg} 
            color={getIntensityColor(avgWaitTimes?.reg || 0)} 
            borderColor={getBorderColor(avgWaitTimes?.reg || 0)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ThroughputNode 
            label="VITALS → DOCTOR" 
            value={avgWaitTimes?.vitals} 
            color={getIntensityColor(avgWaitTimes?.vitals || 0)} 
            borderColor={getBorderColor(avgWaitTimes?.vitals || 0)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ThroughputNode 
            label="DOCTOR → PHARMACY" 
            value={avgWaitTimes?.doc} 
            color={getIntensityColor(avgWaitTimes?.doc || 0)} 
            borderColor={getBorderColor(avgWaitTimes?.doc || 0)}
          />
        </Grid>
      </Grid>
      
      <Stack direction="row" spacing={2} sx={{ mt: 3, px: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#f0fdf4', border: '1px solid #166534' }} />
          <Typography variant="caption" fontWeight={700}>Excellent (&lt;15m)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#fefce8', border: '1px solid #ca8a04' }} />
          <Typography variant="caption" fontWeight={700}>Optimum (15-30m)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#fff7ed', border: '1px solid #ea580c' }} />
          <Typography variant="caption" fontWeight={700}>Alert (30-45m)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#fef2f2', border: '1px solid #991b1b' }} />
          <Typography variant="caption" fontWeight={700}>Critical (&gt;45m)</Typography>
        </Box>
      </Stack>
    </ReportSectionWrapper>
  );
};

const ThroughputNode: React.FC<{ label: string, value?: number, color: string, borderColor: string }> = ({ label, value, color, borderColor }) => (
  <Box sx={{ 
    p: 4, 
    borderRadius: 3, 
    bgcolor: color, 
    border: `2px solid ${borderColor}`,
    textAlign: 'center',
    transition: 'transform 0.2s',
    '&:hover': { transform: 'scale(1.02)' }
  }}>
    <Typography variant="subtitle2" fontWeight={900} sx={{ color: borderColor, mb: 1 }}>{label}</Typography>
    <Typography variant="h3" fontWeight={900} sx={{ color: borderColor }}>{Math.round(value || 0)}</Typography>
    <Typography variant="caption" fontWeight={800} sx={{ color: borderColor, opacity: 0.8 }}>MINUTES</Typography>
  </Box>
);

export default OperationalThroughput;
