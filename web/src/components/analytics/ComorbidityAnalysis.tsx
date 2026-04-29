import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Grid,
  Paper,
  CircularProgress
} from '@mui/material';
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
import ReportSectionWrapper from './ReportSectionWrapper';
import { GoogleGenAI } from '@google/genai';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface ComorbidityAnalysisProps {
  comorbidityMap: Record<string, any> | undefined;
}

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff', '#e0e7ff', '#c7d2fe', '#a5b4fc'];

const ComorbidityAnalysis: React.FC<ComorbidityAnalysisProps> = ({ comorbidityMap }) => {
  const [selectedMajor, setSelectedMajor] = useState<string>('');
  const [sliceKey, setSliceKey] = useState<string>('_total');
  
  const [geminiInsight, setGeminiInsight] = useState<string>('');
  const [insightLoading, setInsightLoading] = useState(false);

  // Available Majors sorted by total co-occurring connections
  const majorOptions = useMemo(() => {
    if (!comorbidityMap) return [];
    return Object.keys(comorbidityMap).sort((a, b) => {
      const aTotal = Object.values(comorbidityMap[a]?._total || {}).reduce((sum: number, val: any) => sum + (val as number), 0 as number) as number;
      const bTotal = Object.values(comorbidityMap[b]?._total || {}).reduce((sum: number, val: any) => sum + (val as number), 0 as number) as number;
      return bTotal - aTotal;
    });
  }, [comorbidityMap]);

  // Set default selection when available
  React.useEffect(() => {
    if (majorOptions.length > 0 && !selectedMajor) {
      setSelectedMajor(majorOptions[0]);
    }
  }, [majorOptions, selectedMajor]);

  // Minor conditions for selected Major and Slice
  const chartData = useMemo(() => {
    if (!selectedMajor || !comorbidityMap || !comorbidityMap[selectedMajor]) return [];
    
    // Safely fallback to _total if slice doesn't exist
    const dataObj = comorbidityMap[selectedMajor][sliceKey] || {};
    
    return Object.entries(dataObj)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [selectedMajor, sliceKey, comorbidityMap]);

  // Calculate Heatmap data for top 5 Majors vs Top 5 Minors
  const heatmapData = useMemo(() => {
    if (!comorbidityMap || majorOptions.length === 0) return { majors: [], minors: [], grid: [] };
    
    const topMajors = majorOptions.slice(0, 5);
    
    // Find globally most common minors across these top 5 majors
    const globalMinorCounts: Record<string, number> = {};
    topMajors.forEach(m => {
        const minors = comorbidityMap[m]?.[sliceKey] || {};
        Object.entries(minors).forEach(([minorName, val]) => {
            globalMinorCounts[minorName] = (globalMinorCounts[minorName] || 0) + Number(val);
        });
    });
    
    const topMinors = Object.entries(globalMinorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(e => e[0]);

    const grid = topMajors.map(major => {
        const rowData: Record<string, any> = { major };
        topMinors.forEach(minor => {
            rowData[minor] = comorbidityMap[major]?.[sliceKey]?.[minor] || 0;
        });
        return rowData;
    });

    return { majors: topMajors, minors: topMinors, grid };
  }, [comorbidityMap, majorOptions, sliceKey]);

  // Fetch Insight
  const fetchInsight = async (data: any, major: string) => {
    if (!data || data.length === 0) return;
    setInsightLoading(true);
    setGeminiInsight('');
    
    try {
      const topMinorsString = data.map((d: any) => `${d.name}: ${d.value}`).join(', ');
      
      const payload = `
        Analyze the comorbidity data for patients at the NGO clinic. For the Major diagnosis '${major}', we found highly correlated minor conditions: ${topMinorsString}. Provide a very concise 2-sentence clinical warning or insight about this specific overlap. Keep it strictly clinical and objective.
      `;

      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: payload
      });
      
      if (response.text) {
        setGeminiInsight(response.text);
      }
    } catch (err) {
      console.warn("Failed to fetch insight via Gemini API.");
      setGeminiInsight(`Insight unavailable. High correlation detected between ${major} and top finding.`);
    } finally {
      setInsightLoading(false);
    }
  };

  React.useEffect(() => {
    if (chartData.length > 0 && selectedMajor) {
      // Small debounce before fetching
      const timer = setTimeout(() => {
        fetchInsight(chartData, selectedMajor);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedMajor, sliceKey]); // re-fetch when data changes


  if (!comorbidityMap || Object.keys(comorbidityMap).length === 0) {
    return (
      <ReportSectionWrapper 
        title="COMORBIDITY ANALYSIS" 
        subtitle="MAJOR VS MINOR DIAGNOSIS CORRELATION"
        description="Analyzes the relationship between primary (Major) and secondary (Minor) diagnoses. Identifies overlapping disease clusters to guide integrated screening and care."
      >
        <Typography variant="body2" color="text.secondary">
          No comorbidity data available for the selected filters.
        </Typography>
      </ReportSectionWrapper>
    );
  }

  return (
    <ReportSectionWrapper 
      title="COMORBIDITY ANALYSIS" 
      subtitle="MAJOR VS MINOR DIAGNOSIS CORRELATION"
      description="Analyzes the relationship between primary (Major) and secondary (Minor) diagnoses. Identifies overlapping disease clusters to guide integrated screening and care."
    >
      <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200, bgcolor: 'white' }}>
          <InputLabel>Major Diagnosis</InputLabel>
          <Select
            value={selectedMajor}
            label="Major Diagnosis"
            onChange={(e) => setSelectedMajor(e.target.value)}
          >
            {majorOptions.map((m) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200, bgcolor: 'white' }}>
          <InputLabel>Demographic Slicer</InputLabel>
          <Select
            value={sliceKey}
            label="Demographic Slicer"
            onChange={(e) => setSliceKey(e.target.value)}
          >
            <MenuItem value="_total">All Patients</MenuItem>
            <MenuItem disabled sx={{ bgcolor: '#f8fafc', fontWeight: 800 }}>By Sex</MenuItem>
            <MenuItem value="Male">Male</MenuItem>
            <MenuItem value="Female">Female</MenuItem>
            <MenuItem disabled sx={{ bgcolor: '#f8fafc', fontWeight: 800 }}>By Age Group</MenuItem>
            <MenuItem value="0-17">0-17 Years</MenuItem>
            <MenuItem value="18-39">18-39 Years</MenuItem>
            <MenuItem value="40-59">40-59 Years</MenuItem>
            <MenuItem value="60+">60+ Years</MenuItem>
            <MenuItem disabled sx={{ bgcolor: '#f8fafc', fontWeight: 800 }}>By Nationality</MenuItem>
            <MenuItem value="Rohingya">Rohingya</MenuItem>
            <MenuItem value="Host Community">Host Community</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, height: 400 }}>
            <Typography variant="overline" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Top 10 Co-occurring Minor Conditions for {selectedMajor}
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 150, right: 30, top: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={140} 
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
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: '#f8fafc', height: 400, display: 'flex', flexDirection: 'column' }}>
             <Typography variant="overline" color="primary" fontWeight={900} sx={{ mb: 2 }}>
                <AutoAwesomeIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle', mb: 0.5 }} />
                Clinical Correlation Insight
             </Typography>
             
             <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {insightLoading ? (
                    <Box sx={{ textAlign: 'center' }}>
                        <CircularProgress size={24} sx={{ mb: 2 }} />
                        <Typography variant="body2" color="text.secondary">Analyzing comorbidities...</Typography>
                    </Box>
                ) : (
                    <Typography variant="body1" sx={{ fontStyle: 'italic', color: '#334155', fontWeight: 500, lineHeight: 1.6 }}>
                        {geminiInsight ? `"${geminiInsight}"` : "No insights available."}
                    </Typography>
                )}
             </Box>
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12 }}>
           <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, overflowX: 'auto' }}>
            <Typography variant="overline" fontWeight={800} color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Comorbidity Heatmap (Top 5 Majors vs Top 5 Minors)
            </Typography>
            
            <Box sx={{ minWidth: 600 }}>
                {/* Header Row */}
                <Box sx={{ display: 'flex', borderBottom: '2px solid #e2e8f0', pb: 1, mb: 1 }}>
                    <Box sx={{ width: 250, fontWeight: 900, color: '#475569', fontSize: '0.875rem' }}>Major \ Minor</Box>
                    {heatmapData.minors.map(minor => (
                        <Box key={minor} sx={{ flex: 1, fontWeight: 900, color: '#475569', fontSize: '0.75rem', textAlign: 'center' }}>
                            {minor.length > 20 ? minor.substring(0, 17) + '...' : minor}
                        </Box>
                    ))}
                </Box>
                
                {/* Data Rows */}
                {heatmapData.grid.map((row, i) => (
                    <Box key={i} sx={{ display: 'flex', py: 1, borderBottom: '1px solid #f1f5f9' }}>
                        <Box sx={{ width: 250, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                            {row.major.length > 30 ? row.major.substring(0, 27) + '...' : row.major}
                        </Box>
                        {heatmapData.minors.map(minor => {
                            const val = row[minor] || 0;
                            // calculate intensity
                            const maxVal = Math.max(...heatmapData.grid.map(r => r[minor] || 0));
                            const intensity = maxVal > 0 ? (val / maxVal) : 0;
                            const bgColor = `rgba(37, 99, 235, ${intensity * 0.8})`; // Blue scale
                            
                            return (
                                <Box key={minor} sx={{ 
                                    flex: 1, 
                                    textAlign: 'center', 
                                    fontWeight: 700, 
                                    fontSize: '0.875rem',
                                    m: 0.5,
                                    borderRadius: 1,
                                    bgcolor: val > 0 ? bgColor : 'transparent',
                                    color: (intensity > 0.5) ? 'white' : '#64748b'
                                }}>
                                    {val || '-'}
                                </Box>
                            )
                        })}
                    </Box>
                ))}
            </Box>
           </Paper>
        </Grid>
      </Grid>
    </ReportSectionWrapper>
  );
};

export default ComorbidityAnalysis;
