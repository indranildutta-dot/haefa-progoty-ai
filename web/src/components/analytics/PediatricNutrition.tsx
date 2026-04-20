import React from 'react';
import { Paper, Box, Typography, Divider, Stack, Chip } from '@mui/material';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { DailySummary } from '../../types';

import ReportSectionWrapper from './ReportSectionWrapper';

interface PediatricNutritionProps {
  summaries: DailySummary[];
}

const PediatricNutrition: React.FC<PediatricNutritionProps> = ({ summaries }) => {
  const nutritionTotals = summaries.reduce((acc, cur) => {
    acc.green += (cur.nutrition?.muac_green || 0);
    acc.yellow += (cur.nutrition?.muac_yellow || 0);
    acc.red += (cur.nutrition?.muac_red || 0);
    return acc;
  }, { green: 0, yellow: 0, red: 0 });

  const data = [
    { name: 'Healthy (Green)', value: nutritionTotals.green, color: '#22c55e' },
    { name: 'MAM (Yellow)', value: nutritionTotals.yellow, color: '#eab308' },
    { name: 'SAM (Red)', value: nutritionTotals.red, color: '#ef4444' }
  ];

  const totalScreened = nutritionTotals.green + nutritionTotals.yellow + nutritionTotals.red;
  const malnutritionRate = totalScreened > 0 ? (((nutritionTotals.yellow + nutritionTotals.red) / totalScreened) * 100).toFixed(1) : 0;

  return (
    <ReportSectionWrapper 
      title="PEDIATRIC NUTRITION (MUAC)" 
      subtitle="MALNUTRITION SCREENING DISTRIBUTION" 
      description="This module tracks pediatric nutritional status using Middle Upper Arm Circumference (MUAC). Patients are classified into: Healthy (Green), Moderate Acute Malnutrition (MAM - Yellow), and Severe Acute Malnutrition (SAM - Red). It helps in tracking the prevalence of stunting and wasting in the local population."
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Chip 
          label={`${malnutritionRate}% Malnutrition Rate`} 
          color={Number(malnutritionRate) > 15 ? "error" : "warning"}
          size="small"
          sx={{ fontWeight: 900, borderRadius: 1 }}
        />
      </Box>
      <Box sx={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={false} />
            <XAxis type="number" hide />
            <YAxis dataKey="name" type="category" fontSize={10} width={100} fontWeight={800} />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>

      <Stack direction="row" spacing={2} justifyContent="space-between" sx={{ mt: 2 }}>
        <Box>
          <Typography variant="caption" display="block" color="text.secondary" fontWeight={700}>TOTAL SCREENED</Typography>
          <Typography variant="h6" fontWeight={900}>{totalScreened}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" display="block" color="error" fontWeight={700}>SEVERE (SAM)</Typography>
          <Typography variant="h6" fontWeight={900} color="error">{nutritionTotals.red}</Typography>
        </Box>
      </Stack>
    </ReportSectionWrapper>
  );
};

export default PediatricNutrition;
