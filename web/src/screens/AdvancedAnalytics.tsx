import React, { useState, useMemo, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid, 
  Paper, 
  Stack, 
  IconButton, 
  Button,
  Divider,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import { useNavigate, Navigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useAppStore } from '../store/useAppStore';

// Components
import AnalyticsFilters, { FilterState } from '../components/analytics/AnalyticsFilters';
import DiseasePrevalence from '../components/analytics/DiseasePrevalence';
import OperationalThroughput from '../components/analytics/OperationalThroughput';
import NCDCohortTracking from '../components/analytics/NCDCohortTracking';
import PharmacySupplyIntelligence from '../components/analytics/PharmacySupplyIntelligence';
import ReferralAnalysis from '../components/analytics/ReferralAnalysis';
import GeminiInsightsSidebar from '../components/analytics/GeminiInsightsSidebar';
import MaternalHealthTracker from '../components/analytics/MaternalHealthTracker';
import PediatricNutrition from '../components/analytics/PediatricNutrition';
import TBSurveillance from '../components/analytics/TBSurveillance';
import ProviderProductivity from '../components/analytics/ProviderProductivity';
import OperationalEfficiency from '../components/analytics/OperationalEfficiency';
import ClinicalOutcomes from '../components/analytics/ClinicalOutcomes';
import RiskStratification from '../components/analytics/RiskStratification';
import CVRiskAnalysis from '../components/analytics/CVRiskAnalysis';
import ResourceForecasting from '../components/analytics/ResourceForecasting';

// Icons
import StorageIcon from '@mui/icons-material/Storage';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import InfoIcon from '@mui/icons-material/Info';

// Services
import { fetchDailySummaries, triggerAggregation } from '../services/analyticsService';
import { DailySummary } from '../types';

// Internal Small Helper
const SummaryCard: React.FC<{ title: string, value: any, label: string, color: string }> = ({ title, value, label, color }) => (
  <Paper sx={{ 
    p: 3, 
    borderRadius: 4, 
    border: '1px solid #e2e8f0', 
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
    position: 'relative',
    overflow: 'hidden'
  }}>
    <Box sx={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', bgcolor: color }} />
    <Typography variant="overline" color="text.secondary" fontWeight={900}>
      {title}
    </Typography>
    <Typography variant="h3" fontWeight={900} sx={{ color: '#0f172a', my: 1 }}>
      {value || 0}
    </Typography>
    <Typography variant="caption" color="text.secondary" fontWeight={600}>
      {label}
    </Typography>
  </Paper>
);

import StationLayout from '../components/StationLayout';

const AdvancedAnalytics: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAppStore();
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [isPreview, setIsPreview] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    dateRange: [null, null], // Default to last 30 days logic in service
    countryId: 'all',
    clinicId: 'all',
    nationality: 'all',
    ageGroup: 'all',
    sex: 'all',
    visitStatus: 'all'
  });

  // Security Redirect (Must be after all hooks to avoid Rule of Hooks violation)
  useEffect(() => {
    if (userProfile && !userProfile.isApproved) {
      navigate('/');
    }
  }, [userProfile, navigate]);

  // Derived statistics (Memoized for performance)
  const aggregatedData = useMemo(() => {
    if (summaries.length === 0) return null;
    
    // Flattening and aggregating across days
    const totalPatients = summaries.reduce((acc, cur) => acc + (cur.total_patients || 0), 0);
    const newPatients = summaries.reduce((acc, cur) => acc + (cur.new_patients || 0), 0);
    
    // Merge disease prevalence
    const diseaseMap: Record<string, number> = {};
    summaries.forEach(s => {
      Object.entries(s.disease_prevalence || {}).forEach(([code, count]) => {
        diseaseMap[code] = (diseaseMap[code] || 0) + (count as number);
      });
    });

    return {
      totalPatients,
      newPatients,
      diseaseMap,
      summaries // Pass through for charts
    };
  }, [summaries]);

  // Handle Load logic inside hook block
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetchDailySummaries(filters);
      setSummaries(response.data);
      setIsPreview(response.isPreview);
      setError(null);
    } catch (err: any) {
      console.error("Aggregation Fetch Error:", err);
      setError("Failed to load analytics data. Ensure your connection is stable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleSyncData = async () => {
    setSyncing(true);
    try {
      await triggerAggregation();
      setTimeout(() => {
        loadData();
        setSyncing(false);
      }, 2000);
    } catch (err) {
      console.error("Aggregation Trigger Error:", err);
      setSyncing(false);
    }
  };

  if (userProfile && !userProfile.isApproved) {
    return null; // Don't render until security check passes or redirects
  }

  return (
    <StationLayout 
      title="Advanced Reporting" 
      stationName="Analytics"
      actions={
        <Stack direction="row" spacing={2}>
          <Tooltip title={syncing ? "Syncing..." : "Re-calculate real clinical data from Firestore"}>
            <Button 
              variant="outlined" 
              startIcon={syncing ? <CircularProgress size={16} /> : <CloudSyncIcon />}
              onClick={handleSyncData}
              disabled={syncing}
              sx={{ borderRadius: 2, fontWeight: 900, borderColor: '#e2e8f0' }}
            >
              {syncing ? 'SYNCING...' : 'RE-AGGREGATE LIVE DATA'}
            </Button>
          </Tooltip>
          <Tooltip title="AI Insights Powered by Gemini">
            <Button 
              variant="outlined" 
              startIcon={<AutoAwesomeIcon />}
              onClick={() => setShowInsights(!showInsights)}
              sx={{ 
                borderRadius: 2, 
                fontWeight: 900,
                bgcolor: showInsights ? 'primary.50' : 'transparent',
                borderColor: showInsights ? 'primary.main' : '#e2e8f0'
              }}
            >
              AI INSIGHTS
            </Button>
          </Tooltip>
          <Button 
            variant="contained" 
            startIcon={<FileDownloadIcon />}
            sx={{ borderRadius: 2, fontWeight: 900, bgcolor: '#0f172a' }}
          >
            EXPORT PDF
          </Button>
        </Stack>
      }
    >
      <Box sx={{ pb: 10 }}>
        {isPreview && !loading && (
          <Box sx={{ mb: 3, bgcolor: '#fff7ed', border: '1px solid #ffedd5', py: 1.5, px: 3, borderRadius: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <InfoIcon sx={{ color: '#ea580c' }} />
              <Typography variant="body2" color="#9a3412" fontWeight={700}>
                BOARD VIEW ENABLED: Using preview datasets while the clinical background engine aggregates fresh data. 
                Click "RE-AGGREGATE LIVE DATA" above to force a refresh from the Firestore clinical records.
              </Typography>
            </Stack>
          </Box>
        )}

        <Grid container spacing={3}>
          {/* Global Slicers */}
          <Grid size={{ xs: 12 }}>
            <AnalyticsFilters filters={filters} onFilterChange={setFilters} />
          </Grid>

          {loading ? (
            <Grid size={{ xs: 12 }} sx={{ display: 'flex', justifyContent: 'center', py: 20 }}>
              <Stack alignItems="center" spacing={2}>
                <CircularProgress size={60} thickness={4} />
                <Typography fontWeight={800} color="text.secondary">AGGREGATING POPULATION DATA...</Typography>
              </Stack>
            </Grid>
          ) : error ? (
            <Grid size={{ xs: 12 }}>
              <Alert severity="error" variant="filled" sx={{ borderRadius: 3, fontWeight: 700 }}>
                {error}
              </Alert>
            </Grid>
          ) : (
            <>
              {/* Main Analytics Content */}
              <Grid size={{ xs: 12, lg: showInsights ? 8 : 12 }}>
                <Grid container spacing={3}>
                  {/* Top Row: Key Metrics */}
                  <Grid size={{ xs: 12, md: 4 }}>
                    <SummaryCard title="TOTAL CLINIC VISITS" value={aggregatedData?.totalPatients} label="Aggregated Period" color="#1e40af" />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <SummaryCard title="FIRST-TIME PATIENTS" value={aggregatedData?.newPatients} label={`${~~((aggregatedData?.newPatients! / (aggregatedData?.totalPatients || 1)) * 100)}% of Total`} color="#0d9488" />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <SummaryCard title="AVG TRIAGE TIME" value="14min" label="Across All Stations" color="#854d0e" />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <ProviderProductivity summaries={summaries} />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <ClinicalOutcomes summaries={summaries} />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <CVRiskAnalysis summaries={summaries} />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <OperationalEfficiency summaries={summaries} />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <RiskStratification summaries={summaries} />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <ResourceForecasting summaries={summaries} />
                  </Grid>

                  {/* Modules */}
                  <Grid size={{ xs: 12, md: 8 }}>
                    <DiseasePrevalence data={aggregatedData?.diseaseMap} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <ReferralAnalysis summaries={summaries} />
                  </Grid>
                  
                  <Grid size={{ xs: 12 }}>
                    <OperationalThroughput summaries={summaries} />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <NCDCohortTracking summaries={summaries} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <PharmacySupplyIntelligence summaries={summaries} />
                  </Grid>

                  {/* New Strategic Modules */}
                  <Grid size={{ xs: 12, lg: 7 }}>
                    <MaternalHealthTracker summaries={summaries} />
                  </Grid>
                  <Grid size={{ xs: 12, lg: 5 }}>
                    <TBSurveillance summaries={summaries} />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <PediatricNutrition summaries={summaries} />
                  </Grid>
                </Grid>
              </Grid>

              {/* Gemini Sidepanel */}
              {showInsights && (
                <Grid size={{ xs: 12, lg: 4 }}>
                  <GeminiInsightsSidebar data={aggregatedData} summaries={summaries} filters={filters} onClose={() => setShowInsights(false)} />
                </Grid>
              )}
            </>
          )}
        </Grid>
      </Box>
    </StationLayout>
  );
};

export default AdvancedAnalytics;
