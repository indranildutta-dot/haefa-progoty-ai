import React from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Divider,
  Tabs,
  Tab,
  Stack
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
  Treemap
} from 'recharts';

import ReportSectionWrapper from './ReportSectionWrapper';

interface DiseasePrevalenceProps {
  data: Record<string, number> | undefined;
}

const COLORS = ['#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#312e81', '#4338ca', '#4f46e5', '#6366f1'];

const DiseasePrevalence: React.FC<DiseasePrevalenceProps> = ({ data }) => {
  const [tab, setTab] = React.useState(0);

  const chartData = React.useMemo(() => {
    if (!data) return [];
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [data]);

  return (
    <ReportSectionWrapper 
      title="DISEASE PREVALENCE (ICD-11)" 
      subtitle="TOP SYSTEMIC DIAGNOSES ENCOUNTERED"
      description="This report prioritizes clinical diagnoses captured across all patient encounters. It helps in mapping the local burden of disease, identifying common comorbidities, and planning public health interventions based on real-time diagnostic data."
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="TREEMAP" sx={{ fontWeight: 800 }} />
          <Tab label="RANKING" sx={{ fontWeight: 800 }} />
        </Tabs>
      </Box>
      
      <Box sx={{ height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          {tab === 0 ? (
            <Treemap
              data={chartData}
              dataKey="value"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill="#1e3a8a"
            >
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div style={{ 
                        backgroundColor: 'white', 
                        padding: '12px', 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                      }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.875rem' }}>{payload[0].payload.name}</p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{payload[0].value} Cases Identified</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </Treemap>
          ) : (
            <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={120} 
                tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
              />
              <Tooltip 
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </Box>
    </ReportSectionWrapper>
  );
};

export default DiseasePrevalence;
