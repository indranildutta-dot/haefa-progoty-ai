import React from 'react';
import { Paper, Box, Typography, Divider, Grid } from '@mui/material';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { DailySummary } from '../../types';

import ReportSectionWrapper from './ReportSectionWrapper';

interface OperationalEfficiencyProps {
  summaries: DailySummary[];
}

const OperationalEfficiency: React.FC<OperationalEfficiencyProps> = ({ summaries }) => {
  const latestSummary = summaries[0];
  
  // Prepare hourly distribution data
  const hourlyData = Object.entries(latestSummary?.operational_efficiency?.hourly_visit_distribution || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([hour, count]) => ({
      hour: `${hour}:00`,
      visits: count
    }));

  // Prepare session duration data
  const sessionData = Object.entries(latestSummary?.operational_efficiency?.avg_session_duration || {})
    .map(([station, avg]) => ({
      station: station.charAt(0).toUpperCase() + station.slice(1),
      avg: Number(avg.toFixed(1))
    }));

  const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981'];

  return (
    <ReportSectionWrapper 
      title="OPERATIONAL EFFICIENCY" 
      subtitle="HOURLY FLOW & CLINICAL SESSION DYNAMICS" 
      description="This operational dashboard monitors real-time clinic dynamics. It tracks hourly patient arrivals to identify peak workload periods and measures the average duration patients spend at each station (Vitals, Doctor, Pharmacy) to optimize throughput."
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Typography variant="caption" fontWeight={900} color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            HOURLY PATIENT INFLOW (TODAY)
          </Typography>
          <Box sx={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                <Tooltip 
                   contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="visits" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorVisits)" />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Typography variant="caption" fontWeight={900} color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            AVG SESSION DURATION (MIN)
          </Typography>
          <Box sx={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="station" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                  {sessionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Grid>
      </Grid>
    </ReportSectionWrapper>
  );
};

export default OperationalEfficiency;
