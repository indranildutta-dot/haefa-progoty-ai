import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Divider, 
  IconButton, 
  CircularProgress,
  Stack,
  Alert,
  Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InsightsIcon from '@mui/icons-material/Insights';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';
import { FilterState } from './AnalyticsFilters';
import { DailySummary } from '../../types';

interface GeminiInsightsSidebarProps {
  data: any;
  summaries: DailySummary[];
  filters: FilterState;
  onClose: () => void;
}

const GeminiInsightsSidebar: React.FC<GeminiInsightsSidebarProps> = ({ data, summaries, filters, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

      const lastFiveDays = summaries.slice(-5).map(s => ({ 
        date: s.date, 
        total: s.total_patients, 
        ncd: s.ncd_metrics,
        cv_risk: s.cv_risk_metrics 
      }));

      const prompt = `
        You are a population health analyst for HAEFA, an NGO providing medical care in refugee camps and rural Bangladesh.
        Analyze the following clinical data summary and provide a brief (2-3 paragraph), professional executive briefing.
        
        DATA CONTEXT:
        - Total Patients: ${data?.totalPatients}
        - New Patients: ${data?.newPatients}
        - Clinic Filters: ${filters.clinicId}
        - Date Range: ${filters.dateRange[0]} to ${filters.dateRange[1]}
        
        TOP DIAGNOSES:
        ${JSON.stringify(data?.diseaseMap)}
        
        CARDIOVASCULAR (CV) RISK PROFILE:
        Includes WHO South Asia risk stratifications (Lab-based and Non-Lab based).
        Recent snapshots: ${JSON.stringify(lastFiveDays.map(d => ({ date: d.date, cv_risk: d.cv_risk })))}

        INSTRUCTIONS:
        1. Identify any outbreaks or significant spikes in specific diseases.
        2. Highlight concerns in NCD management (Blood Pressure/Glucose) and CV Risk trends.
        3. Note disparities or concentrations in high CV risk categories (>=20% or >=30%).
        4. Analyze Maternal Health (ANC) and high-risk case volume.
        5. Assess pediatric nutrition (MUAC) and malnutrition rates.
        6. Flag any suspected TB cases for immediate intervention.
        7. Recommend operational adjustments if wait times are high.
        8. Use a professional, medical tone. Use Markdown for formatting.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      setInsight(response.text || 'No significant anomalies detected for this period.');
    } catch (err: any) {
      console.error("Gemini Error:", err);
      setError("Unable to connect to AI Insight Engine. Please check your API configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data) {
      generateInsights();
    }
  }, [data]);

  return (
    <Paper sx={{ 
      height: '100%', 
      borderRadius: 4, 
      bgcolor: '#0f172a', 
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #1e293b'
    }}>
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoAwesomeIcon sx={{ color: '#60a5fa' }} />
          <Typography variant="h6" fontWeight={900}>GEMINI AI BRIEFING</Typography>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: '#94a3b8' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider sx={{ borderColor: '#1e293b' }} />

      <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10 }}>
            <CircularProgress size={40} sx={{ color: '#60a5fa' }} />
            <Typography sx={{ mt: 2, fontWeight: 700, color: '#94a3b8' }}>SCANNING CLINICAL TRENDS...</Typography>
          </Box>
        ) : error ? (
          <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>{error}</Alert>
        ) : (
          <Box className="markdown-body">
             <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
                <Chip icon={<InsightsIcon sx={{ color: 'white !important' }} />} label="Trend Detected" size="small" sx={{ bgcolor: '#1e40af', color: 'white', fontWeight: 700 }} />
                <Chip icon={<WarningAmberIcon sx={{ color: 'white !important' }} />} label="NCD Alert" size="small" sx={{ bgcolor: '#991b1b', color: 'white', fontWeight: 700 }} />
             </Stack>
             <ReactMarkdown>{insight || ''}</ReactMarkdown>
          </Box>
        )}
      </Box>

      <Box sx={{ p: 3, bgcolor: '#1e293b', borderTop: '1px solid #334155' }}>
        <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic' }}>
          AI-generated insights are intended for clinical decision support and must be verified by a board-certified professional.
        </Typography>
      </Box>
    </Paper>
  );
};

export default GeminiInsightsSidebar;
