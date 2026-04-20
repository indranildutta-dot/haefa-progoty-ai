import React from 'react';
import { Paper, Box, Typography, Divider, Grid } from '@mui/material';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { DailySummary } from '../../types';

import ReportSectionWrapper from './ReportSectionWrapper';

interface MaternalHealthTrackerProps {
  summaries: DailySummary[];
}

const MaternalHealthTracker: React.FC<MaternalHealthTrackerProps> = ({ summaries }) => {
  const chartData = summaries.slice(-14).map(s => ({
    date: s.date.split('-').slice(1).join('/'),
    anc: s.maternal_health?.anc_visits || 0,
    highRisk: s.maternal_health?.high_risk_pregnancies || 0
  })).reverse();

  const totalANC = summaries.reduce((acc, cur) => acc + (cur.maternal_health?.anc_visits || 0), 0);
  const totalHighRisk = summaries.reduce((acc, cur) => acc + (cur.maternal_health?.high_risk_pregnancies || 0), 0);
  
  const pieData = [
    { name: 'Normal ANC', value: totalANC - totalHighRisk },
    { name: 'High Risk', value: totalHighRisk }
  ];

  const COLORS = ['#0ea5e9', '#ef4444'];

  return (
    <ReportSectionWrapper 
      title="MATERNAL HEALTH & ANC" 
      subtitle="PREGNANCY TRACKING & RISK STRATIFICATION" 
      description="This module tracks Ante-Natal Care (ANC) visits and uses AI-driven identification for high-risk pregnancies based on clinical indicators (BP, age, and systemic symptoms). It ensures that vulnerable patients are prioritized for advanced clinical care and referral."
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Box sx={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={10} fontWeight={700} />
                <YAxis fontSize={10} fontWeight={700} />
                <Tooltip 
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="anc" fill="#0ea5e9" name="ANC Visits" radius={[4, 4, 0, 0]} />
                <Bar dataKey="highRisk" fill="#ef4444" name="High Risk" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ height: 250, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height="70%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ mt: 1, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={900} color="#ef4444">{totalHighRisk}</Typography>
              <Typography variant="caption" fontWeight={800} color="text.secondary">HIGH RISK CASES DETECTED</Typography>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </ReportSectionWrapper>
  );
};

export default MaternalHealthTracker;
