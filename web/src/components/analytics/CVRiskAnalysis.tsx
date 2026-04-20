import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  Grid, 
  Tab, 
  Tabs,
  Paper
} from '@mui/material';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from 'recharts';
import { DailySummary } from '../../types';
import ReportSectionWrapper from './ReportSectionWrapper';
import ScienceIcon from '@mui/icons-material/Science';
import AssignmentIcon from '@mui/icons-material/Assignment';

interface CVRiskAnalysisProps {
  summaries: DailySummary[];
}

const COLORS = ['#16a34a', '#eab308', '#f97316', '#dc2626', '#7f1d1d'];
const CATEGORIES = ['<5%', '5-10%', '10-20%', '20-30%', '>=30%'];

const CVRiskAnalysis: React.FC<CVRiskAnalysisProps> = ({ summaries }) => {
  const [tab, setTab] = useState(0);

  const aggregatedMetrics = useMemo(() => {
    const lab: Record<string, number> = { '<5%': 0, '5-10%': 0, '10-20%': 0, '20-30%': 0, '>=30%': 0 };
    const nonLab: Record<string, number> = { '<5%': 0, '5-10%': 0, '10-20%': 0, '20-30%': 0, '>=30%': 0 };

    summaries.forEach(s => {
      if (s.cv_risk_metrics) {
        Object.entries(s.cv_risk_metrics.lab_based || {}).forEach(([cat, val]) => {
          lab[cat] = (lab[cat] || 0) + val;
        });
        Object.entries(s.cv_risk_metrics.non_lab_based || {}).forEach(([cat, val]) => {
          nonLab[cat] = (nonLab[cat] || 0) + val;
        });
      }
    });

    return {
      lab: CATEGORIES.map(cat => ({ name: cat, value: lab[cat] })),
      nonLab: CATEGORIES.map(cat => ({ name: cat, value: nonLab[cat] }))
    };
  }, [summaries]);

  const currentData = tab === 0 ? aggregatedMetrics.lab : aggregatedMetrics.nonLab;
  const totalCases = currentData.reduce((acc, cur) => acc + cur.value, 0);

  return (
    <ReportSectionWrapper
      title="CARDIOVASCULAR (CV) RISK PROFILE"
      subtitle="WHO SOUTH ASIA RISK STRATIFICATION"
      description="This module tracks the population risk for cardiovascular events using the WHO South Asia specific matrices. Reporting is split between Lab-based (using Total Cholesterol) and Non-Lab based (using BMI) assessments. It categorizes patients into 10-year risk tiers, guiding prophylactic management for Hypertension and Diabetes cohorts."
    >
      <Box sx={{ mb: 3 }}>
        <Tabs 
          value={tab} 
          onChange={(_, v) => setTab(v)} 
          variant="fullWidth"
          sx={{ 
            bgcolor: '#f8fafc', 
            borderRadius: 3, 
            p: 0.5,
            '& .MuiTabs-indicator': { height: '100%', borderRadius: 2.5, zIndex: 0, bgcolor: 'white', border: '1px solid #e2e8f0' },
            '& .MuiTab-root': { zIndex: 1, fontWeight: 900, minHeight: 40, py: 1 }
          }}
        >
          <Tab icon={<ScienceIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="LAB-BASED" />
          <Tab icon={<AssignmentIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="NON-LAB BASED" />
        </Tabs>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} fontWeight={800} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} fontWeight={800} tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div style={{ backgroundColor: 'white', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
                          <p style={{ margin: 0, fontWeight: 800, color: payload[0].payload.fill }}>{payload[0].payload.name}</p>
                          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>{payload[0].value} Consulations</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {currentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={900}>TOTAL ASSESSMENTS</Typography>
              <Typography variant="h4" fontWeight={900}>{totalCases}</Typography>
            </Paper>
            
            <Box sx={{ p: 1 }}>
              <Typography variant="caption" fontWeight={900} color="text.secondary" sx={{ mb: 1, display: 'block' }}>RISK DISTRIBUTION (%)</Typography>
              <Stack spacing={1}>
                {currentData.map((d, i) => (
                  <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COLORS[i] }} />
                    <Typography variant="caption" sx={{ flexGrow: 1, fontWeight: 700 }}>{d.name}</Typography>
                    <Typography variant="caption" fontWeight={900}>
                      {totalCases > 0 ? ~~((d.value / totalCases) * 100) : 0}%
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </ReportSectionWrapper>
  );
};

export default CVRiskAnalysis;
