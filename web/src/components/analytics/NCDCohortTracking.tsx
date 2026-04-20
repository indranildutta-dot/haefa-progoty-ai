import React from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Divider
} from '@mui/material';
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

interface NCDCohortTrackingProps {
  summaries: DailySummary[];
}

const NCDCohortTracking: React.FC<NCDCohortTrackingProps> = ({ summaries }) => {
  const chartData = React.useMemo(() => {
    return [...summaries]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => ({
        date: s.date.slice(5), // MM-DD
        SBP: s.ncd_metrics?.avg_sbp || 0,
        DBP: s.ncd_metrics?.avg_dbp || 0,
        Glucose: (s.ncd_metrics?.avg_glucose || 0) / 10 // Scaled for visibility on same axis
      }));
  }, [summaries]);

  return (
    <ReportSectionWrapper 
      title="NCD COHORT TRACKING" 
      subtitle="LONGITUDINAL BLOOD PRESSURE & GLUCOSE TRENDS (SCALED)" 
      description="This longitudinal report tracks the average Blood Pressure (Systolic/Diastolic) and Blood Glucose levels for all patients within the selected period. It identifies if chronic disease management programs are successfully stabilizing patient cohorts over time."
    >
      <Box sx={{ height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
            <Tooltip 
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Legend verticalAlign="top" align="right" />
            <Line type="monotone" dataKey="SBP" stroke="#b91c1c" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="DBP" stroke="#1d4ed8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="Glucose" stroke="#059669" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </ReportSectionWrapper>
  );
};

export default NCDCohortTracking;
