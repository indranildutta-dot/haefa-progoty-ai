import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  Card, 
  CardContent, 
  Divider, 
  List, 
  ListItem, 
  ListItemText,
  Chip,
  Container,
  IconButton
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { QueueItem, Patient, ClinicMetrics } from '../types';
import { getPatientById } from '../services/patientService';
import { useAppStore } from '../store/useAppStore';

interface QueueBoardProps {
  countryId: string;
}

interface QueueItemWithPatient extends QueueItem {
  patient?: Patient;
}

const QueueBoard: React.FC<QueueBoardProps> = ({ countryId }) => {
  const { selectedCountry, selectedClinic } = useAppStore();
  const [rawQueueItems, setRawQueueItems] = useState<QueueItem[]>([]);
  const [metrics, setMetrics] = useState<ClinicMetrics | null>(null);
  const [patientsCache, setPatientsCache] = useState<Record<string, Patient>>({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    // Subscribe to clinic metrics
    if (!selectedClinic) return;
    const metricsRef = doc(db, "clinic_metrics", selectedClinic.id);
    const unsubscribe = onSnapshot(metricsRef, (docSnap) => {
      if (docSnap.exists()) {
        setMetrics(docSnap.data() as ClinicMetrics);
      }
    });
    return () => unsubscribe();
  }, [selectedClinic]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Subscribe to all active queue items for this session
    if (!selectedCountry || !selectedClinic) return;
    
    const q = query(
      collection(db, "queues_active"),
      where("country_code", "==", selectedCountry.id),
      where("clinic_id", "==", selectedClinic.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QueueItem[];

      const filteredAndSorted = items
        .filter(item => ["WAITING_FOR_VITALS", "READY_FOR_DOCTOR", "IN_CONSULTATION", "WAITING_FOR_PHARMACY"].includes(item.status))
        .sort((a, b) => {
          const priorityA = a.priority_score || 0;
          const priorityB = b.priority_score || 0;
          if (priorityA !== priorityB) {
            return priorityB - priorityA; // DESC
          }
          const timeA = a.created_at?.toMillis() || 0;
          const timeB = b.created_at?.toMillis() || 0;
          return timeA - timeB; // ASC
        });

      setRawQueueItems(filteredAndSorted);
    });

    return () => unsubscribe();
  }, [countryId]);

  useEffect(() => {
    const fetchMissingPatients = async () => {
      const missingIds = rawQueueItems
        .map(item => item.patient_id)
        .filter(id => !patientsCache[id]);

      if (missingIds.length === 0) return;

      const uniqueIds = Array.from(new Set(missingIds));
      const newPatients = { ...patientsCache };
      let updated = false;

      await Promise.all(uniqueIds.map(async (id) => {
        try {
          const p = await getPatientById(id);
          newPatients[id] = p;
          updated = true;
        } catch (err) {
          console.error(`Failed to fetch patient ${id}`, err);
        }
      }));

      if (updated) {
        setPatientsCache(newPatients);
      }
    };

    fetchMissingPatients();
  }, [rawQueueItems, patientsCache]);

  const queueItems = rawQueueItems.map(item => ({
    ...item,
    patient: patientsCache[item.patient_id]
  }));

  const getWaitTimeMinutes = (createdAt: any) => {
    if (!createdAt) return 0;
    const start = createdAt.toDate().getTime();
    return Math.floor((currentTime - start) / 60000);
  };

  const getWaitTime = (createdAt: any) => {
    return `${getWaitTimeMinutes(createdAt)}m`;
  };

  const getEscalationStatus = (level: string | undefined, waitMinutes: number) => {
    let threshold = 30; // default standard
    switch (level) {
      case 'emergency': threshold = 5; break;
      case 'urgent': threshold = 15; break;
      case 'standard': threshold = 30; break;
      case 'low': threshold = 60; break;
    }
    return waitMinutes >= threshold;
  };

  const getTriageColor = (level?: string) => {
    switch (level) {
      case 'emergency': return '#ef4444'; // red
      case 'urgent': return '#f97316'; // orange
      case 'standard': return '#eab308'; // yellow
      case 'low': return '#22c55e'; // green
      default: return '#94a3b8'; // gray
    }
  };

  const renderQueueColumn = (title: string, status: string, color: string) => {
    const filteredItems = queueItems.filter(item => item.status === status);

    return (
      <Grid size={{ xs: 12, md: 3 }}>
        <Paper 
          elevation={0} 
          sx={{ 
            height: '100%', 
            minHeight: '70vh', 
            bgcolor: '#f8fafc', 
            borderRadius: 4, 
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ p: 2, bgcolor: color, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem' }}>
              {title}
            </Typography>
            <Chip 
              label={filteredItems.length} 
              size="small" 
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 'bold' }} 
            />
          </Box>
          <List sx={{ p: 1 }}>
            {filteredItems.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center', opacity: 0.5 }}>
                <Typography variant="body2">No patients waiting</Typography>
              </Box>
            ) : (
              filteredItems.map((item) => {
                const waitMinutes = getWaitTimeMinutes(item.created_at);
                const isEscalated = item.status !== 'IN_CONSULTATION' && getEscalationStatus(item.triage_level, waitMinutes);

                return (
                  <Card 
                    key={item.id} 
                    sx={{ 
                      mb: 1.5, 
                      borderRadius: 3, 
                      boxShadow: isEscalated ? '0 0 0 2px #ef4444, 0 4px 12px rgba(239, 68, 68, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)',
                      bgcolor: isEscalated ? '#fef2f2' : 'white',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    <CardContent sx={{ p: '12px !important' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ 
                            width: 12, 
                            height: 12, 
                            borderRadius: '50%', 
                            bgcolor: getTriageColor(item.triage_level),
                            flexShrink: 0
                          }} />
                          <Box>
                            <Typography variant="subtitle1" fontWeight="700" sx={{ lineHeight: 1.2 }}>
                              {item.patient ? `${item.patient.first_name} ${item.patient.last_name}` : 'Loading...'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              Village: {item.patient?.village || '...'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Triage: <span style={{ color: getTriageColor(item.triage_level), fontWeight: 'bold', textTransform: 'capitalize' }}>{item.triage_level || 'Standard'}</span>
                            </Typography>
                            {item.status === 'IN_CONSULTATION' && (
                              <Typography variant="caption" color="primary.main" sx={{ display: 'block', fontWeight: 'bold' }}>
                                Doctor: Assigned
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            color: isEscalated ? 'error.main' : 'text.secondary',
                            bgcolor: isEscalated ? 'error.light' : 'transparent',
                            px: isEscalated ? 1 : 0,
                            py: isEscalated ? 0.5 : 0,
                            borderRadius: 1,
                            fontWeight: isEscalated ? 'bold' : 'normal'
                          }}>
                            <AccessTimeIcon sx={{ fontSize: 14, mr: 0.5 }} />
                            <Typography variant="caption" fontWeight="600">
                              {waitMinutes}m
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      {isEscalated && (
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', color: 'error.main', gap: 0.5 }}>
                          <WarningAmberIcon sx={{ fontSize: 16 }} />
                          <Typography variant="caption" fontWeight="bold">
                            Wait time exceeded
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </List>
        </Paper>
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight="800" color="primary" gutterBottom>
            Queue Board
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Real-time patient flow monitoring.
          </Typography>
        </Box>
        <IconButton onClick={() => window.location.reload()} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {metrics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'primary.50' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="primary" fontWeight="bold">Registered Today</Typography>
                <Typography variant="h4" fontWeight="800" color="primary">{metrics.patients_registered_today}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'success.50' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="success.main" fontWeight="bold">Completed Today</Typography>
                <Typography variant="h4" fontWeight="800" color="success.main">{metrics.completed_today}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'warning.50' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="warning.main" fontWeight="bold">Avg Wait Time</Typography>
                <Typography variant="h4" fontWeight="800" color="warning.main">{metrics.avg_wait_time_minutes}m</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {renderQueueColumn("WAITING VITALS", "WAITING_FOR_VITALS", "#3b82f6")}
        {renderQueueColumn("READY DOCTOR", "READY_FOR_DOCTOR", "#10b981")}
        {renderQueueColumn("IN CONSULT", "IN_CONSULTATION", "#8b5cf6")}
        {renderQueueColumn("WAITING PHARMACY", "WAITING_FOR_PHARMACY", "#f59e0b")}
      </Grid>
    </Box>
  );
};

export default QueueBoard;
