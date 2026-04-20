import React from 'react';
import { Paper, Box, Typography, Divider, Grid } from '@mui/material';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { DailySummary } from '../../types';

import ReportSectionWrapper from './ReportSectionWrapper';

interface ClinicalOutcomesProps {
  summaries: DailySummary[];
}

const ClinicalOutcomes: React.FC<ClinicalOutcomesProps> = ({ summaries }) => {
  // Aggregate outcomes over time
  const outcomeHistory = summaries.slice(-30).map(s => ({
    date: s.date.split('-').slice(1).join('/'),
    bp: Number((s.clinical_outcomes?.bp_controlled_rate || 0).toFixed(1)),
    glucose: Number((s.clinical_outcomes?.glucose_controlled_rate || 0).toFixed(1))
  })).reverse();

  return (
    <ReportSectionWrapper 
      title="CLINICAL QUALITY & OUTCOMES" 
      subtitle="POPULATION-LEVEL CHRONIC DISEASE MANAGEMENT SUCCESS RATES" 
      description="This high-level quality report tracks the 'Control Rate' for Hypertension and Diabetes within the patient population. These rates indicate the percentage of patients seen who successfully reached their clinical targets (e.g., BP < 140/90), serving as a primary metric for HAEFA's clinical impact."
    >
      <Box sx={{ height: 300, mt: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={outcomeHistory}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="date" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
            <YAxis 
              fontSize={10} 
              fontWeight={700} 
              axisLine={false} 
              tickLine={false} 
              domain={[0, 100]}
              tickFormatter={(val) => `${val}%`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend verticalAlign="top" height={36} />
            <Line 
              type="monotone" 
              dataKey="bp" 
              name="BP Control Rate (<140/90)" 
              stroke="#0ea5e9" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 0 }}
              activeDot={{ r: 6 }} 
            />
            <Line 
              type="monotone" 
              dataKey="glucose" 
              name="Glucose Control Rate" 
              stroke="#8b5cf6" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
              activeDot={{ r: 6 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', textAlign: 'center' }}>
          * Control rates signify the percentage of NCD patients achieving clinical targets for that day.
        </Typography>
      </Box>
    </ReportSectionWrapper>
  );
};

export default ClinicalOutcomes;
