import React from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Divider
} from '@mui/material';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  Legend
} from 'recharts';
import { DailySummary } from '../../types';

interface ReferralAnalysisProps {
  summaries: DailySummary[];
}

const COLORS = ['#1e3a8a', '#0d9488', '#854d0e', '#b91c1c', '#6d28d9', '#475569'];

const ReferralAnalysis: React.FC<ReferralAnalysisProps> = ({ summaries }) => {
  const chartData = React.useMemo(() => {
    const reasons: Record<string, number> = {};
    summaries.forEach(s => {
      Object.entries(s.referral_reasons || {}).forEach(([reason, count]) => {
        reasons[reason] = (reasons[reason] || 0) + (count as number);
      });
    });

    return Object.entries(reasons)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [summaries]);

  return (
    <Paper sx={{ p: 0, borderRadius: 4, overflow: 'hidden', border: '1px solid #e2e8f0', height: '100%' }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={800} color="#1e293b">REFERRAL ANALYSIS</Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>EXTERNAL MEDICAL REFERRAL DISTRIBUTION</Typography>
      </Box>
      <Divider />
      
      <Box sx={{ p: 3, height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};

export default ReferralAnalysis;
