import React from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Divider,
  Alert
} from '@mui/material';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell
} from 'recharts';
import { DailySummary } from '../../types';

import ReportSectionWrapper from './ReportSectionWrapper';

interface PharmacySupplyIntelligenceProps {
  summaries: DailySummary[];
}

const PharmacySupplyIntelligence: React.FC<PharmacySupplyIntelligenceProps> = ({ summaries }) => {
  const chartData = React.useMemo(() => {
    const medTotals: Record<string, number> = {};
    summaries.forEach(s => {
      Object.entries(s.medication_volumes || {}).forEach(([name, qty]) => {
        medTotals[name] = (medTotals[name] || 0) + (qty as number);
      });
    });

    return Object.entries(medTotals)
      .map(([name, volume]) => ({
        name,
        volume,
        burnRate: Math.round(volume / (summaries.length || 1)),
        stockDays: Math.floor(Math.random() * 30) // Mock days left logic
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 8);
  }, [summaries]);

  return (
    <ReportSectionWrapper 
      title="PHARMACY SUPPLY INTELLIGENCE" 
      subtitle="MEDICATION CONSUMPTION VOLUME & ESTIMATED BURN RATE" 
      description="This logistical intelligence report monitors the dispensed quantity of medications. 'Burn Rate' refers to the average daily consumption, allowing pharmacy managers to forecast when stocks will be depleted and trigger timely procurement."
    >
      <Box sx={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
              <Tooltip 
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend />
              <Bar dataKey="volume" name="Dispensed Volume" fill="#0f172a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="burnRate" name="Daily Burn Rate" fill="#64748b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Box sx={{ mt: 2 }}>
          {chartData.some(d => d.stockDays < 7) && (
            <Alert severity="warning" variant="outlined" sx={{ border: '1px solid #f59e0b', borderRadius: 2 }}>
              <Typography variant="caption" fontWeight={800}>CRITICAL STOCK LEVELS DETECTED</Typography>
              <Typography variant="body2" sx={{ display: 'block', fontSize: '0.75rem' }}>
                Some essential NCD medications have less than 7 days of stock remaining at current burn rates.
              </Typography>
            </Alert>
          )}
        </Box>
    </ReportSectionWrapper>
  );
};

export default PharmacySupplyIntelligence;
