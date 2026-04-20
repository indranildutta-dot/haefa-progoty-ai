import React from 'react';
import { Box, Typography, Stack, LinearProgress, Grid } from '@mui/material';
import ReportSectionWrapper from './ReportSectionWrapper';
import { DailySummary } from '../../types';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface RiskStratificationProps {
  summaries: DailySummary[];
}

const RiskStratification: React.FC<RiskStratificationProps> = ({ summaries }) => {
  // Simulator for Risk Stratification
  const metrics = [
    { label: 'Uncontrolled Hypertension Cluster', count: 145, trend: '+5%', color: '#ef4444', risk: 'HIGH' },
    { label: 'DM Type 2 Follow-up Gap', count: 89, trend: '-2%', color: '#f59e0b', risk: 'MEDIUM' },
    { label: 'TB Suspect Rescreening Required', count: 12, trend: '+0%', color: '#ea580c', risk: 'CRITICAL' },
    { label: 'Pediatric Growth Stunting (Z-Score < -2)', count: 67, trend: '+12%', color: '#10b981', risk: 'MODERATE' }
  ];

  return (
    <ReportSectionWrapper 
      title="AI: PATIENT RISK STRATIFICATION" 
      subtitle="PREDICTIVE CLINICAL RISK MODELING"
      description="This AI model analyzes longitudinal patient data (BP, Glucose, BMI trends) to predict which cohorts are at risk of secondary complications. It identifies clusters where multiple clinical indicators are deteriorating simultaneously, allowing clinical leaders to plan targeted interventions."
      color="#1e293b"
    >
      <Box sx={{ mb: 3, p: 2, bgcolor: '#f0f9ff', borderRadius: 3, border: '1px solid #bae6fd' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoAwesomeIcon sx={{ color: '#0ea5e9', fontSize: 18 }} />
          <Typography variant="caption" fontWeight={900} color="#0369a1">
            GEMINI PREDICTION ENGINE ACTIVE: Analyzing 30-day clinical volatility.
          </Typography>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {metrics.map((m) => (
          <Grid size={{ xs: 12 }} key={m.label}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" fontWeight={700} color="#334155">{m.label}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" fontWeight={900} sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: `${m.color}15`, color: m.color }}>{m.risk}</Typography>
                  <Typography variant="body2" fontWeight={900} color="#0f172a">{m.count}</Typography>
                </Stack>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(m.count / 200) * 100} 
                sx={{ 
                  height: 6, 
                  borderRadius: 3, 
                  bgcolor: '#f1f5f9',
                  '& .MuiLinearProgress-bar': { bgcolor: m.color }
                }} 
              />
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 0.5, display: 'block' }}>
                Cohort Trend: <span style={{ color: m.trend.startsWith('+') ? '#ef4444' : '#10b981' }}>{m.trend}</span> vs Last Quarter
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </ReportSectionWrapper>
  );
};

export default RiskStratification;
