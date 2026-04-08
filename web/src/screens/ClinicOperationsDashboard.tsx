import React, { useState, useEffect, useMemo } from 'react';
import { 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  Divider,
  Container,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
  Menu,
  Alert,
  AlertTitle
} from '@mui/material';
import { Link } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import RefreshIcon from '@mui/icons-material/Refresh';
import { collection, query, where, onSnapshot, addDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { countries } from '../config/countries';
import { QueueItem } from '../types';
import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { 
  handleFirestoreError, 
  OperationType 
} from '../utils/firestoreError';

import ClinicBottleneckPanel from '../components/admin/ClinicBottleneckPanel';
import PatientFlowFunnel from '../components/admin/PatientFlowFunnel';
import WaitTimeTrendChart from '../components/admin/WaitTimeTrendChart';
import TriageDistributionPanel from '../components/admin/TriageDistributionPanel';
import LongestWaitPanel from '../components/admin/LongestWaitPanel';

interface ClinicOperationsDashboardProps {
  countryId: string;
}

type Scope = 'current_clinic' | 'clinic' | 'country' | 'global';

const ClinicOperationsDashboard: React.FC<ClinicOperationsDashboardProps> = ({ countryId }) => {
  const { selectedCountry, selectedClinic, notify, userProfile } = useAppStore();
  const { isMobile, isTablet } = useResponsiveLayout();
  
  const [scope, setScope] = useState<Scope>('current_clinic');
  const [selectedScopeId, setSelectedScopeId] = useState<string>('');
  const [vitalsMenuAnchor, setVitalsMenuAnchor] = useState<null | HTMLElement>(null);
  
  const today = new Date().toISOString().split('T')[0];
  
  const [patientsData, setPatientsData] = useState<any[]>([]);
  const [queueData, setQueueData] = useState<QueueItem[]>([]);
  const [metrics, setMetrics] = useState({
    totalPatientsToday: 0,
    activeQueue: 0,
    inConsultation: 0,
    completedVisits: 0,
    averageWaitTime: 0,
    stations: {
      registration: { queue: 0, completed: 0 },
      vitals: { queue: 0, completed: 0, active: 0, avgWait: 0, totalWait: 0 },
      doctor: { queue: 0, completed: 0, active: 0, avgWait: 0, totalWait: 0 },
      pharmacy: { queue: 0, completed: 0, active: 0, avgWait: 0, totalWait: 0 }
    },
    countryBreakdown: {} as Record<string, { patientsToday: number, activeQueue: number }>
  });

  // Initialize scope ID
  useEffect(() => {
    if (scope === 'current_clinic' && selectedClinic) {
      setSelectedScopeId(selectedClinic.id);
    } else if (scope === 'clinic' && selectedClinic && !selectedScopeId) {
      setSelectedScopeId(selectedClinic.id);
    } else if (scope === 'country' && selectedCountry && !selectedScopeId) {
      setSelectedScopeId(selectedCountry.id);
    } else if (scope === 'global') {
      setSelectedScopeId('global');
    }
  }, [scope, selectedClinic, selectedCountry, selectedScopeId]);

  // Fetch data
  useEffect(() => {
    if (!selectedScopeId || !userProfile?.isApproved) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Use simple queries that don't require composite indexes
    const pQuery = query(collection(db, 'patients'), where('created_at', '>=', startOfDay));
    const qQuery = query(collection(db, 'queues_active'), where('created_at', '>=', startOfDay));

    const unsubscribePatients = onSnapshot(pQuery, (snapshot) => {
      const allPatients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Filter in memory to avoid index requirements
      const filtered = allPatients.filter(p => {
        if (scope === 'current_clinic' || scope === 'clinic') {
          return p.clinic_id === selectedScopeId;
        } else if (scope === 'country') {
          return p.country_id === selectedScopeId;
        }
        return true; // global
      });
      
      setPatientsData(filtered);
    }, (error) => {
      console.error("Error fetching patients:", error);
      handleFirestoreError(error, OperationType.LIST, "patients");
    });

    const unsubscribeQueue = onSnapshot(qQuery, (snapshot) => {
      const allQueue = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      // Filter in memory to avoid index requirements
      const filtered = allQueue.filter(q => {
        if (scope === 'current_clinic' || scope === 'clinic') {
          return q.clinic_id === selectedScopeId;
        } else if (scope === 'country') {
          return q.country_id === selectedScopeId;
        }
        return true; // global
      });
      
      setQueueData(filtered);
    }, (error) => {
      console.error("Error fetching queue:", error);
      handleFirestoreError(error, OperationType.LIST, "queues_active");
    });

    return () => {
      unsubscribePatients();
      unsubscribeQueue();
    };
  }, [scope, selectedScopeId, userProfile?.isApproved]);

  // Calculate metrics
  useEffect(() => {
    let activeQueue = 0;
    let inConsultation = 0;
    let completedVisits = 0;
    let totalWaitTime = 0;
    let waitTimeCount = 0;

    const stations = {
      registration: { queue: 0, completed: patientsData.length },
      vitals: { queue: 0, completed: 0, active: 0, avgWait: 0, totalWait: 0 },
      doctor: { queue: 0, completed: 0, active: 0, avgWait: 0, totalWait: 0 },
      pharmacy: { queue: 0, completed: 0, active: 0, avgWait: 0, totalWait: 0 }
    };
    
    const countryBreakdown: Record<string, { patientsToday: number, activeQueue: number }> = {};
    
    // Initialize breakdown with all patients
    patientsData.forEach(p => {
      const cc = p.country_id;
      if (!countryBreakdown[cc]) countryBreakdown[cc] = { patientsToday: 0, activeQueue: 0 };
      countryBreakdown[cc].patientsToday++;
    });

    queueData.forEach(item => {
      const isCompleted = item.status === 'COMPLETED';
      const waitMinutes = item.created_at ? Math.floor((Date.now() - item.created_at.toMillis()) / 60000) : 0;
      
      if (!isCompleted) {
        activeQueue++;
      } else {
        completedVisits++;
      }

      if (item.status === 'IN_CONSULTATION') {
        inConsultation++;
      }

      if (waitMinutes > 0 && !isCompleted) {
        totalWaitTime += waitMinutes;
        waitTimeCount++;
      }

      const cc = item.country_id;
      if (!countryBreakdown[cc]) countryBreakdown[cc] = { patientsToday: 0, activeQueue: 0 };
      if (!isCompleted) {
        countryBreakdown[cc].activeQueue++;
      }
      
      // Vitals
      if (item.status === 'WAITING_FOR_VITALS') {
        stations.vitals.queue++;
        stations.vitals.active++;
        stations.vitals.totalWait += waitMinutes;
      } else {
        stations.vitals.completed++;
      }
      
      // Doctor
      if (item.status === 'READY_FOR_DOCTOR') {
        stations.doctor.queue++;
        stations.doctor.totalWait += waitMinutes;
      } else if (item.status === 'IN_CONSULTATION') {
        stations.doctor.active++;
      } else if (item.status === 'WAITING_FOR_PHARMACY' || item.status === 'COMPLETED') {
        stations.doctor.completed++;
      }
      
      // Pharmacy
      if (item.status === 'WAITING_FOR_PHARMACY') {
        stations.pharmacy.queue++;
        stations.pharmacy.active++;
        stations.pharmacy.totalWait += waitMinutes;
      } else if (item.status === 'COMPLETED') {
        stations.pharmacy.completed++;
      }
    });
    
    stations.vitals.avgWait = stations.vitals.queue > 0 ? Math.floor(stations.vitals.totalWait / stations.vitals.queue) : 0;
    stations.doctor.avgWait = stations.doctor.queue > 0 ? Math.floor(stations.doctor.totalWait / stations.doctor.queue) : 0;
    stations.pharmacy.avgWait = stations.pharmacy.queue > 0 ? Math.floor(stations.pharmacy.totalWait / stations.pharmacy.queue) : 0;

    const averageWaitTime = waitTimeCount > 0 ? Math.round(totalWaitTime / waitTimeCount) : 0;

    setMetrics(prev => ({
      ...prev,
      totalPatientsToday: patientsData.length,
      activeQueue,
      inConsultation,
      completedVisits,
      averageWaitTime,
      stations,
      countryBreakdown
    }));
  }, [patientsData, queueData]);

  const handleSeedMedications = async () => {
    try {
      const meds = [
        { name: "amoxicillin", maxDailyDose: 3000, unit: "mg" },
        { name: "ibuprofen", maxDailyDose: 3200, unit: "mg" },
        { name: "paracetamol", maxDailyDose: 4000, unit: "mg" },
        { name: "lisinopril", maxDailyDose: 40, unit: "mg" },
        { name: "aspirin", maxDailyDose: 4000, unit: "mg" },
        { name: "warfarin", maxDailyDose: 10, unit: "mg" }
      ];

      for (const m of meds) {
        await addDoc(collection(db, "medications_catalog"), m);
      }

      const interactions = [
        {
          medication1Name: "ibuprofen",
          medication2Name: "aspirin",
          severity: "high",
          description: "Increased risk of bleeding and gastrointestinal toxicity."
        },
        {
          medication1Name: "warfarin",
          medication2Name: "aspirin",
          severity: "high",
          description: "Significantly increased risk of severe bleeding."
        }
      ];

      for (const i of interactions) {
        await addDoc(collection(db, "medication_interactions"), i);
      }

      notify("Medications and interactions seeded successfully!", "success");
    } catch (err) {
      console.error(err);
      notify("Failed to seed medications", "error");
    }
  };

  const StatCard = ({ title, value, icon, color, delta }: any) => (
    <Card sx={{ borderRadius: 3, height: '100%', border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: `${color}.50` }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ p: 0.5, borderRadius: 1.5, bgcolor: 'white', color: `${color}.main`, border: '1px solid', borderColor: 'divider', display: 'flex' }}>
            {React.cloneElement(icon, { fontSize: 'small' })}
          </Box>
          {delta && (
            <Typography variant="caption" fontWeight="bold" color={delta.startsWith('+') ? 'success.main' : 'error.main'}>
              {delta}
            </Typography>
          )}
        </Box>
        <Typography variant="h5" fontWeight="800" color={`${color}.main`}>{value}</Typography>
        <Typography variant="caption" color="text.secondary" fontWeight="600" sx={{ textTransform: 'uppercase' }}>
          {title}
        </Typography>
      </CardContent>
    </Card>
  );

  const StationCard = ({ title, data, color }: { title: string, data: any, color: string }) => {
    return (
      <Card sx={{ borderRadius: 3, height: '100%', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
            <Typography variant="subtitle1" fontWeight="800">{title}</Typography>
          </Box>
          <Grid container spacing={1}>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" display="block">Queue</Typography>
            <Typography variant="h6" fontWeight="bold">{data.queue}</Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" display="block">Active</Typography>
            <Typography variant="h6" fontWeight="bold">{data.active || 0}</Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" display="block">Completed</Typography>
            <Typography variant="h6" fontWeight="bold">{data.completed}</Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" display="block">Avg Wait</Typography>
            <Typography variant="h6" fontWeight="bold">{data.avgWait}m</Typography>
          </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const getScopeName = () => {
    if (scope === 'current_clinic') return selectedClinic?.name || 'Current Clinic';
    if (scope === 'clinic') {
      for (const country of countries) {
        const clinic = country.clinics.find(c => c.id === selectedScopeId);
        if (clinic) return clinic.name;
      }
    }
    if (scope === 'country') {
      const country = countries.find(c => c.id === selectedScopeId);
      return country ? country.name : 'Selected Country';
    }
    return 'Global Operations';
  };

  // Derived data for new components
  const bottleneck = useMemo(() => {
    const s = metrics.stations;
    if (s.vitals.queue > 5 || s.vitals.avgWait > 30) return { station: 'Vitals', queue: s.vitals.queue, avgWait: s.vitals.avgWait };
    if (s.doctor.queue > 5 || s.doctor.avgWait > 30) return { station: 'Doctor', queue: s.doctor.queue, avgWait: s.doctor.avgWait };
    if (s.pharmacy.queue > 5 || s.pharmacy.avgWait > 30) return { station: 'Pharmacy', queue: s.pharmacy.queue, avgWait: s.pharmacy.avgWait };
    return null;
  }, [metrics.stations]);

  const funnelData = useMemo(() => {
    return {
      registered: metrics.totalPatientsToday,
      vitals: metrics.stations.vitals.queue + metrics.stations.vitals.active,
      doctor: metrics.stations.doctor.queue + metrics.stations.doctor.active,
      pharmacy: metrics.stations.pharmacy.queue + metrics.stations.pharmacy.active,
      completed: metrics.completedVisits,
    };
  }, [metrics]);

  const triageData = useMemo(() => {
    const counts = { red: 0, orange: 0, yellow: 0, green: 0 };
    queueData.forEach(q => {
      if (q.triage_level === 'emergency') counts.red++;
      else if (q.triage_level === 'urgent') counts.orange++;
      else if (q.triage_level === 'standard') counts.yellow++;
      else if (q.triage_level === 'low') counts.green++;
    });
    return counts;
  }, [queueData]);

  const longestWaitPatients = useMemo(() => {
    return queueData
      .filter(q => q.status !== 'COMPLETED' && q.created_at)
      .map(q => {
        const wait = Math.floor((Date.now() - q.created_at.toMillis()) / 60000);
        let station = 'Registration';
        if (q.status === 'WAITING_FOR_VITALS') station = 'Vitals';
        else if (q.status === 'READY_FOR_DOCTOR' || q.status === 'IN_CONSULTATION') station = 'Doctor';
        else if (q.status === 'WAITING_FOR_PHARMACY') station = 'Pharmacy';
        
        // Find actual patient name from patientsData
        const patient = patientsData.find(p => p.id === q.patient_id);
        const name = patient ? `${patient.given_name} ${patient.family_name}` : `Patient ${q.patient_id.substring(0,4)}`;
        
        return { name, station, wait };
      })
      .sort((a, b) => b.wait - a.wait)
      .slice(0, 3);
  }, [queueData, patientsData]);

  const trendData = useMemo(() => {
    // Simple mock trend based on current average wait for demonstration
    // In a real app, this would query historical snapshots
    const currentHour = new Date().getHours();
    return [
      { time: `${currentHour - 2}:00`, wait: Math.max(0, metrics.averageWaitTime - 5) },
      { time: `${currentHour - 1}:00`, wait: Math.max(0, metrics.averageWaitTime + 2) },
      { time: `${currentHour}:00`, wait: metrics.averageWaitTime }
    ];
  }, [metrics.averageWaitTime]);

  return (
    <StationLayout
      title={scope === 'global' ? 'GLOBAL OPERATIONS' : 'CLINIC OPERATIONS DASHBOARD'}
      stationName="Admin"
      actions={
        <Stack direction="row" spacing={2} alignItems="center">
          {!isMobile && (
            <Paper sx={{ p: 0.5, px: 1, display: 'flex', gap: 1, alignItems: 'center', borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select 
                  value={scope} 
                  onChange={(e) => {
                    const newScope = e.target.value as Scope;
                    setScope(newScope);
                    if (newScope === 'current_clinic') setSelectedScopeId(selectedClinic?.id || '');
                    else if (newScope === 'global') setSelectedScopeId('global');
                    else setSelectedScopeId('');
                  }} 
                  variant="standard"
                  disableUnderline
                  sx={{ fontSize: '0.875rem' }}
                >
                  <MenuItem value="current_clinic">Current Clinic</MenuItem>
                  {(userProfile?.role === 'global_admin' || userProfile?.role === 'country_admin' || userProfile?.role === 'admin') && [
                    <MenuItem key="clinic" value="clinic">Select Clinic</MenuItem>,
                    <MenuItem key="country" value="country">Select Country</MenuItem>
                  ]}
                  {userProfile?.role === 'global_admin' && (
                    <MenuItem value="global">Global View</MenuItem>
                  )}
                </Select>
              </FormControl>

              {scope === 'clinic' && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <Select 
                    value={selectedScopeId} 
                    onChange={(e) => setSelectedScopeId(e.target.value)}
                    variant="standard"
                    disableUnderline
                    sx={{ fontSize: '0.875rem' }}
                  >
                    {countries
                      .filter(c => userProfile?.role === 'global_admin' || userProfile?.assignedCountries?.includes(c.id) || userProfile?.assignedClinics?.some(ac => c.clinics.some(cl => cl.id === ac)))
                      .flatMap(c => c.clinics)
                      .filter(clinic => userProfile?.role === 'global_admin' || userProfile?.role === 'country_admin' || userProfile?.assignedClinics?.includes(clinic.id))
                      .map(clinic => (
                      <MenuItem key={clinic.id} value={clinic.id}>{clinic.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {scope === 'country' && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <Select 
                    value={selectedScopeId} 
                    onChange={(e) => setSelectedScopeId(e.target.value)}
                    variant="standard"
                    disableUnderline
                    sx={{ fontSize: '0.875rem' }}
                  >
                    {countries
                      .filter(country => userProfile?.role === 'global_admin' || userProfile?.assignedCountries?.includes(country.id))
                      .map(country => (
                      <MenuItem key={country.id} value={country.id}>{country.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Paper>
          )}
          
          <Button 
            variant="contained" 
            component={Link} 
            to="/queue" 
            startIcon={<ListAltIcon />}
            size={isMobile ? "small" : "medium"}
            sx={{ borderRadius: 2, fontWeight: 'bold' }}
          >
            {isMobile ? 'Queue' : 'Queue Board'}
          </Button>
        </Stack>
      }
    >
      {userProfile && !userProfile.professional_reg_no && (userProfile.role === 'doctor' || userProfile.role === 'nurse' || userProfile.role === 'pharmacy') && (
        <Alert 
          severity="warning" 
          sx={{ 
            mb: 3, 
            borderRadius: 3, 
            fontWeight: 'bold',
            border: '1px solid',
            borderColor: 'warning.main',
            bgcolor: 'warning.light',
            '& .MuiAlert-icon': { color: 'warning.dark' }
          }}
        >
          <AlertTitle sx={{ fontWeight: 900 }}>Warning: Professional License No. missing</AlertTitle>
          Prescriptions and dispensing labels may be legally invalid. Please update your profile in User Management or contact an administrator.
        </Alert>
      )}

      {isMobile && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            View Scope
          </Typography>
          <Stack spacing={2}>
            <FormControl size="small" fullWidth>
              <Select 
                value={scope} 
                onChange={(e) => {
                  const newScope = e.target.value as Scope;
                  setScope(newScope);
                  if (newScope === 'current_clinic') setSelectedScopeId(selectedClinic?.id || '');
                  else if (newScope === 'global') setSelectedScopeId('global');
                  else setSelectedScopeId('');
                }} 
              >
                <MenuItem value="current_clinic">Current Clinic</MenuItem>
                <MenuItem value="clinic">Select Clinic</MenuItem>
                <MenuItem value="country">Select Country</MenuItem>
                <MenuItem value="global">Global View</MenuItem>
              </Select>
            </FormControl>

            {scope === 'clinic' && (
              <FormControl size="small" fullWidth>
                <Select 
                  value={selectedScopeId} 
                  onChange={(e) => setSelectedScopeId(e.target.value)}
                >
                  {countries.flatMap(c => c.clinics).map(clinic => (
                    <MenuItem key={clinic.id} value={clinic.id}>{clinic.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {scope === 'country' && (
              <FormControl size="small" fullWidth>
                <Select 
                  value={selectedScopeId} 
                  onChange={(e) => setSelectedScopeId(e.target.value)}
                >
                  {countries.map(country => (
                    <MenuItem key={country.id} value={country.id}>{country.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>
        </Paper>
      )}

      <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard title="Patients" value={metrics.totalPatientsToday} icon={<PeopleIcon />} color="primary" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard title="Active" value={metrics.activeQueue} icon={<ListAltIcon />} color="warning" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard title="Consult" value={metrics.inConsultation} icon={<LocalHospitalIcon />} color="info" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard title="Done" value={metrics.completedVisits} icon={<AssessmentIcon />} color="success" />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard title="Wait" value={`${metrics.averageWaitTime}m`} icon={<AccessTimeIcon />} color="secondary" />
        </Grid>
      </Grid>

      {scope === 'global' && Object.keys(metrics.countryBreakdown).length > 0 && (
        <Paper sx={{ p: 4, mb: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
          <Typography variant="h6" fontWeight="800" gutterBottom>
            Country Breakdown
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={3}>
            {Object.entries(metrics.countryBreakdown).map(([code, data]) => {
              const country = countries.find(c => c.id === code);
              return (
                <Grid size={{ xs: 12, sm: 4 }} key={code}>
                  <Card sx={{ bgcolor: 'grey.50', boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {country?.flag} {country?.name || code}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">Patients Today:</Typography>
                        <Typography variant="body2" fontWeight="bold">{data.patientsToday}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">Active Queue:</Typography>
                        <Typography variant="body2" fontWeight="bold">{data.activeQueue}</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}

      {(scope === 'current_clinic' || scope === 'clinic') && (
        <>
          <Typography variant="h5" fontWeight="900" sx={{ mb: 3, letterSpacing: '-0.02em' }}>
            STATION STATUS
          </Typography>
          <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StationCard title="Registration" data={metrics.stations.registration} color="#10b981" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StationCard title="Vitals" data={metrics.stations.vitals} color="#0ea5e9" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StationCard title="Doctor" data={metrics.stations.doctor} color="#8b5cf6" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StationCard title="Pharmacy" data={metrics.stations.pharmacy} color="#f59e0b" />
            </Grid>
          </Grid>

          <Typography variant="h5" fontWeight="900" sx={{ mb: 3, letterSpacing: '-0.02em' }}>
            OPERATIONAL INSIGHTS
          </Typography>
          <Grid container spacing={isMobile ? 2 : 3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ClinicBottleneckPanel bottleneck={bottleneck} />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <PatientFlowFunnel data={funnelData} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <WaitTimeTrendChart data={trendData} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TriageDistributionPanel data={triageData} />
            </Grid>
            <Grid size={12}>
              <LongestWaitPanel patients={longestWaitPatients} />
            </Grid>
          </Grid>
        </>
      )}

      <Paper sx={{ p: isMobile ? 2 : 4, borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="800">
            Quick Actions
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/registration" sx={{ py: isMobile ? 1.5 : 2, borderRadius: 3, fontWeight: 'bold', fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
              Registration
            </Button>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={(e) => setVitalsMenuAnchor(e.currentTarget)}
              sx={{ py: isMobile ? 1.5 : 2, borderRadius: 3, fontWeight: 'bold', fontSize: isMobile ? '0.75rem' : '0.875rem' }}
            >
              Vitals
            </Button>
            <Menu
              anchorEl={vitalsMenuAnchor}
              open={Boolean(vitalsMenuAnchor)}
              onClose={() => setVitalsMenuAnchor(null)}
              PaperProps={{ sx: { borderRadius: 3, mt: 1, minWidth: 200 } }}
            >
              <MenuItem component={Link} to="/vitals-1" onClick={() => setVitalsMenuAnchor(null)} sx={{ py: 1.5, fontWeight: 700 }}>
                1. Body Measures
              </MenuItem>
              <MenuItem component={Link} to="/vitals-2" onClick={() => setVitalsMenuAnchor(null)} sx={{ py: 1.5, fontWeight: 700 }}>
                2. Vital Signs
              </MenuItem>
              <MenuItem component={Link} to="/labs-and-risk" onClick={() => setVitalsMenuAnchor(null)} sx={{ py: 1.5, fontWeight: 700 }}>
                3. Labs & Risks
              </MenuItem>
            </Menu>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/doctor" sx={{ py: isMobile ? 1.5 : 2, borderRadius: 3, fontWeight: 'bold', fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
              Doctor
            </Button>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/pharmacy" sx={{ py: isMobile ? 1.5 : 2, borderRadius: 3, fontWeight: 'bold', fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
              Pharmacy
            </Button>
          </Grid>
          {(userProfile?.role === 'global_admin' || userProfile?.role === 'country_admin') && (
            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
              <Button 
                fullWidth 
                variant="contained" 
                color="secondary"
                component={Link} 
                to="/admin/users" 
                startIcon={<PeopleIcon />}
                sx={{ py: isMobile ? 1.5 : 2, borderRadius: 3, fontWeight: 'bold', fontSize: isMobile ? '0.75rem' : '0.875rem' }}
              >
                User Management
              </Button>
            </Grid>
          )}
        </Grid>
      </Paper>
    </StationLayout>
  );
};

export default ClinicOperationsDashboard;
