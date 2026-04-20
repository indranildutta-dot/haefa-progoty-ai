import React from 'react';
import { Paper, Box, Typography, Divider, Grid, LinearProgress } from '@mui/material';
import { DailySummary } from '../../types';

import ReportSectionWrapper from './ReportSectionWrapper';

interface ProviderProductivityProps {
  summaries: DailySummary[];
}

const ProviderProductivity: React.FC<ProviderProductivityProps> = ({ summaries }) => {
  // Aggregate provider metrics across the selected window
  const latestSummary = summaries[0]; // Most recent day
  
  const providers = latestSummary?.provider_metrics || {
    consultations_per_doctor: {},
    screenings_per_nurse: {},
    dispensations_per_pharmacist: {}
  };

  const renderSection = (title: string, data: Record<string, number>, color: string) => {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...Object.values(data), 1);

    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={900}>{title}</Typography>
        <Box sx={{ mt: 2 }}>
          {entries.length > 0 ? entries.map(([name, count]) => (
            <Box key={name} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" fontWeight={700} color="#334155">{name}</Typography>
                <Typography variant="body2" fontWeight={900} color={color}>{count} Sessions</Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(count / max) * 100} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4, 
                  bgcolor: '#f1f5f9',
                  '& .MuiLinearProgress-bar': { bgcolor: color }
                }} 
              />
            </Box>
          )) : (
            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>No activity data for this period.</Typography>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <ReportSectionWrapper 
      title="STAKEHOLDER PERFORMANCE" 
      subtitle="DAILY PRODUCTIVITY & UTILIZATION ACROSS STATIONS" 
      description="This report provides granular visibility into the activity levels of individual healthcare providers. It tracks consultations per doctor, triage screenings per nurse, and dispensations per pharmacist, helping to identify high-performing teams and load-balance staffing across clinics."
    >
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          {renderSection("PHYSICIAN CONSULTATIONS", providers.consultations_per_doctor, "#0ea5e9")}
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          {renderSection("NURSING SCREENINGS", providers.screenings_per_nurse, "#8b5cf6")}
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          {renderSection("PHARMACY DISPENSATIONS", providers.dispensations_per_pharmacist, "#10b981")}
        </Grid>
      </Grid>
    </ReportSectionWrapper>
  );
};

export default ProviderProductivity;
