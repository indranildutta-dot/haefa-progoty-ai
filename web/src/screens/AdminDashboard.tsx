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
  MenuItem
} from '@mui/material';
import { Link } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import { collection, query, where, onSnapshot, addDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { countries } from '../config/countries';
import { QueueItem } from '../types';

interface AdminDashboardProps {
  countryId: string;
}

type Scope = 'current_clinic' | 'clinic' | 'country' | 'global';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ countryId }) => {
  const { selectedCountry, selectedClinic, notify } = useAppStore();
  
  const [scope, setScope] = useState<Scope>('current_clinic');
  const [selectedScopeId, setSelectedScopeId] = useState<string>('');
  
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
    if (!selectedScopeId) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let unsubscribePatients = () => {};
    let unsubscribeQueue = () => {};

    if (scope === 'current_clinic' || scope === 'clinic') {
      let pQuery = query(collection(db, 'patients'), where('created_at', '>=', startOfDay));
      let qQuery = query(collection(db, 'queues_active'), where('created_at', '>=', startOfDay));

      pQuery = query(pQuery, where('clinic_id', '==', selectedScopeId));
      qQuery = query(qQuery, where('clinic_id', '==', selectedScopeId));

      unsubscribePatients = onSnapshot(pQuery, (snapshot) => {
        setPatientsData(snapshot.docs.map(doc => doc.data()));
      }, (error) => console.error("Error fetching patients:", error));

      unsubscribeQueue = onSnapshot(qQuery, (snapshot) => {
        setQueueData(snapshot.docs.map(doc => doc.data() as QueueItem));
      }, (error) => console.error("Error fetching queue:", error));
    } else {
      setPatientsData([]);
      setQueueData([]);
    }

    if (scope === 'current_clinic' || scope === 'clinic') {
      const metricsRef = doc(db, 'clinic_metrics', `${selectedScopeId}_${today}`);
      const unsubscribeMetrics = onSnapshot(metricsRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMetrics(prev => ({
            ...prev,
            totalPatientsToday: data.patients_today || 0,
            activeQueue: data.active_queue || 0,
            inConsultation: data.in_consultation || 0,
            completedVisits: data.completed_today || 0,
            averageWaitTime: data.avg_wait_time || 0
          }));
        } else {
          setMetrics(prev => ({
            ...prev,
            totalPatientsToday: 0,
            activeQueue: 0,
            inConsultation: 0,
            completedVisits: 0,
            averageWaitTime: 0
          }));
        }
      });
      return () => {
        unsubscribePatients();
        unsubscribeQueue();
        unsubscribeMetrics();
      };
    } else if (scope === 'country') {
      const metricsRef = doc(db, 'country_metrics', `${selectedScopeId}_${today}`);
      const unsubscribeMetrics = onSnapshot(metricsRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMetrics(prev => ({
            ...prev,
            totalPatientsToday: data.patients_today || 0,
            activeQueue: data.active_queue || 0,
            inConsultation: data.in_consultation || 0,
            completedVisits: data.completed_today || 0,
            averageWaitTime: data.avg_wait_time || 0
          }));
        } else {
          setMetrics(prev => ({
            ...prev,
            totalPatientsToday: 0,
            activeQueue: 0,
            inConsultation: 0,
            completedVisits: 0,
            averageWaitTime: 0
          }));
        }
      });
      return () => {
        unsubscribePatients();
        unsubscribeQueue();
        unsubscribeMetrics();
      };
    } else if (scope === 'global') {
      const metricsRef = doc(db, 'global_metrics', `global_${today}`);
      const unsubscribeMetrics = onSnapshot(metricsRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMetrics(prev => ({
            ...prev,
            totalPatientsToday: data.patients_today || 0,
            activeQueue: data.active_queue || 0,
            inConsultation: data.in_consultation || 0,
            completedVisits: data.completed_today || 0,
            averageWaitTime: data.avg_wait_time || 0
          }));
        } else {
          setMetrics(prev => ({
            ...prev,
            totalPatientsToday: 0,
            activeQueue: 0,
            inConsultation: 0,
            completedVisits: 0,
            averageWaitTime: 0
          }));
        }
      });
      
      // Also fetch country breakdown for global view
      const countryMetricsQuery = query(collection(db, 'country_metrics'), where('date', '==', today));
      const unsubscribeCountryMetrics = onSnapshot(countryMetricsQuery, (snapshot) => {
        const breakdown: Record<string, { patientsToday: number, activeQueue: number }> = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.country_code) {
            breakdown[data.country_code] = {
              patientsToday: data.patients_today || 0,
              activeQueue: data.active_queue || 0
            };
          }
        });
        setMetrics(prev => ({ ...prev, countryBreakdown: breakdown }));
      });

      return () => {
        unsubscribePatients();
        unsubscribeQueue();
        unsubscribeMetrics();
        unsubscribeCountryMetrics();
      };
    }

    return () => {
      unsubscribePatients();
      unsubscribeQueue();
    };
  }, [scope, selectedScopeId]);

  // Calculate metrics
  useEffect(() => {
    const stations = {
      registration: { queue: 0, completed: patientsData.length },
      vitals: { queue: 0, completed: 0, active: 0, avgWait: 0, totalWait: 0 },
      doctor: { queue: 0, completed: 0, active: 0, avgWait: 0, totalWait: 0 },
      pharmacy: { queue: 0, completed: 0, active: 0, avgWait: 0, totalWait: 0 }
    };
    
    const countryBreakdown: Record<string, { patientsToday: number, activeQueue: number }> = {};
    
    // Initialize breakdown with all patients
    patientsData.forEach(p => {
      const cc = p.country_code;
      if (!countryBreakdown[cc]) countryBreakdown[cc] = { patientsToday: 0, activeQueue: 0 };
      countryBreakdown[cc].patientsToday++;
    });

    queueData.forEach(item => {
      const isCompleted = item.status === 'COMPLETED';
      const waitMinutes = item.created_at ? Math.floor((Date.now() - item.created_at.toMillis()) / 60000) : 0;
      
      const cc = item.country_code;
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

    setMetrics(prev => ({
      ...prev,
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
        await addDoc(collection(db, "medications"), m);
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
        await addDoc(collection(db, "drug_interactions"), i);
      }

      notify("Medications and interactions seeded successfully!", "success");
    } catch (err) {
      console.error(err);
      notify("Failed to seed medications", "error");
    }
  };

  const StatCard = ({ title, value, icon, color }: any) => (
    <Card sx={{ borderRadius: 4, height: '100%', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}.light`, color: `${color}.main` }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h4" fontWeight="800">{value}</Typography>
        <Typography variant="body2" color="text.secondary" fontWeight="600">
          {title}
        </Typography>
      </CardContent>
    </Card>
  );

  const StationCard = ({ title, data }: { title: string, data: any }) => {
    let loadColor = 'success.main';
    let loadBg = 'success.light';
    if (data.queue > 10) {
      loadColor = 'error.main';
      loadBg = 'error.light';
    } else if (data.queue > 5) {
      loadColor = 'warning.main';
      loadBg = 'warning.light';
    }

    return (
      <Card sx={{ borderRadius: 4, height: '100%', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight="800">{title}</Typography>
            <Box sx={{ px: 1.5, py: 0.5, borderRadius: 2, bgcolor: loadBg, color: loadColor, fontWeight: 'bold', fontSize: '0.75rem' }}>
              Queue: {data.queue}
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            {data.active !== undefined && (
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">Active</Typography>
                <Typography variant="body1" fontWeight="bold">{data.active}</Typography>
              </Grid>
            )}
            {data.completed !== undefined && (
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">Completed</Typography>
                <Typography variant="body1" fontWeight="bold">{data.completed}</Typography>
              </Grid>
            )}
            {data.avgWait !== undefined && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="caption" color="text.secondary" display="block">Avg Wait</Typography>
                <Typography variant="body1" fontWeight="bold">{data.avgWait} mins</Typography>
              </Grid>
            )}
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

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
            {scope === 'global' ? 'GLOBAL OPERATIONS' : 'CLINIC OPERATIONS DASHBOARD'}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Scope: {getScopeName()}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Paper sx={{ p: 1, display: 'flex', gap: 2, alignItems: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>View Scope</InputLabel>
              <Select 
                value={scope} 
                onChange={(e) => {
                  const newScope = e.target.value as Scope;
                  setScope(newScope);
                  if (newScope === 'current_clinic') setSelectedScopeId(selectedClinic?.id || '');
                  else if (newScope === 'global') setSelectedScopeId('global');
                  else setSelectedScopeId(''); // Reset so user has to pick
                }} 
                label="View Scope"
              >
                <MenuItem value="current_clinic">Current Clinic</MenuItem>
                <MenuItem value="clinic">Select Clinic</MenuItem>
                <MenuItem value="country">Select Country</MenuItem>
                <MenuItem value="global">Global View</MenuItem>
              </Select>
            </FormControl>

            {scope === 'clinic' && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Clinic</InputLabel>
                <Select 
                  value={selectedScopeId} 
                  onChange={(e) => setSelectedScopeId(e.target.value)} 
                  label="Clinic"
                >
                  {countries.flatMap(c => c.clinics).map(clinic => (
                    <MenuItem key={clinic.id} value={clinic.id}>{clinic.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {scope === 'country' && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Country</InputLabel>
                <Select 
                  value={selectedScopeId} 
                  onChange={(e) => setSelectedScopeId(e.target.value)} 
                  label="Country"
                >
                  {countries.map(country => (
                    <MenuItem key={country.id} value={country.id}>{country.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Paper>

          <Button 
            variant="contained" 
            component={Link} 
            to="/queue" 
            startIcon={<ListAltIcon />}
            sx={{ borderRadius: 3, px: 3, py: 1, fontWeight: 'bold', height: 40 }}
          >
            Queue Board
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard title="Patients Today" value={metrics.totalPatientsToday} icon={<PeopleIcon />} color="primary" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard title="Active Queue" value={metrics.activeQueue} icon={<ListAltIcon />} color="warning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard title="In Consultation" value={metrics.inConsultation} icon={<LocalHospitalIcon />} color="info" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard title="Completed Visits" value={metrics.completedVisits} icon={<AssessmentIcon />} color="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <StatCard title="Average Wait" value={`${metrics.averageWaitTime}m`} icon={<AccessTimeIcon />} color="secondary" />
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
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StationCard title="Registration" data={metrics.stations.registration} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StationCard title="Vitals" data={metrics.stations.vitals} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StationCard title="Doctor" data={metrics.stations.doctor} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StationCard title="Pharmacy" data={metrics.stations.pharmacy} />
            </Grid>
          </Grid>
        </>
      )}

      <Paper sx={{ p: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="800">
            Quick Actions
          </Typography>
          <Button size="small" variant="text" onClick={handleSeedMedications}>
            Seed Medications
          </Button>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/" sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}>
              Registration
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/vitals" sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}>
              Vitals Station
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/doctor" sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}>
              Doctor Dashboard
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Button fullWidth variant="outlined" component={Link} to="/pharmacy" sx={{ py: 2, borderRadius: 3, fontWeight: 'bold' }}>
              Pharmacy Station
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default AdminDashboard;
