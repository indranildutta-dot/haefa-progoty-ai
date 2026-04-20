import React from 'react';
import { Paper, Box, Typography, Divider, Alert, AlertTitle } from '@mui/material';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { DailySummary } from '../../types';
import ReportSectionWrapper from './ReportSectionWrapper';
import BugReportIcon from '@mui/icons-material/BugReport';

interface TBSurveillanceProps {
  summaries: DailySummary[];
}

const TBSurveillance: React.FC<TBSurveillanceProps> = ({ summaries }) => {
  const chartData = summaries.slice(-14).map(s => ({
    date: s.date.split('-').slice(1).join('/'),
    cases: s.infectious_disease?.tb_suspected_cases || 0
  })).reverse();

  const totalSuspected = summaries.reduce((acc, cur) => acc + (cur.infectious_disease?.tb_suspected_cases || 0), 0);

  return (
    <ReportSectionWrapper 
      title="TB SURVEILLANCE" 
      subtitle="SUSPECTED CASE TRACKING (FROM SCREENING)" 
      description="This module tracks patients who meet the clinical criteria for Suspected Tuberculosis based on the WHO screening questionnaire in the Doctor Station. It serves as an early-warning system for infectious disease outbreaks within the community."
    >
      <Box sx={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d97706" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" fontSize={10} fontWeight={700} />
            <YAxis fontSize={10} fontWeight={700} />
            <Tooltip 
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Area type="monotone" dataKey="cases" stroke="#d97706" fillOpacity={1} fill="url(#colorCases)" name="Suspected Cases" />
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      {totalSuspected > 0 && (
        <Alert icon={<BugReportIcon fontSize="inherit" />} severity="warning" sx={{ mt: 2, borderRadius: 3, fontWeight: 700 }}>
          <AlertTitle sx={{ fontWeight: 900 }}>EPIDEMIOLOGICAL ALERT</AlertTitle>
          {totalSuspected} suspected TB cases identified in the reporting period. Ensure follow-up diagnostic referrals are prioritized.
        </Alert>
      )}
    </ReportSectionWrapper>
  );
};

export default TBSurveillance;
