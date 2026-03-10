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
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { QueueItem, Patient } from '../types';
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
  const [patientsCache, setPatientsCache] = useState<Record<string, Patient>>({});

  useEffect(() => {
    // Subscribe to all active queue items for this session
    if (!selectedCountry || !selectedClinic) return;
    
    const q = query(
      collection(db, "queue"),
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
        .filter(item => ["WAITING_FOR_VITALS", "READY_FOR_DOCTOR", "WAITING_FOR_PHARMACY"].includes(item.status))
        .sort((a, b) => {
          const timeA = a.created_at?.toMillis() || 0;
          const timeB = b.created_at?.toMillis() || 0;
          return timeA - timeB;
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

  const getWaitTime = (createdAt: any) => {
    if (!createdAt) return '0m';
    const start = createdAt.toDate().getTime();
    const now = Date.now();
    const diff = Math.floor((now - start) / 60000);
    return `${diff}m`;
  };

  const renderQueueColumn = (title: string, status: string, color: string) => {
    const filteredItems = queueItems.filter(item => item.status === status);

    return (
      <Grid size={{ xs: 12, md: 4 }}>
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
              filteredItems.map((item) => (
                <Card key={item.id} sx={{ mb: 1.5, borderRadius: 3, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <CardContent sx={{ p: '12px !important' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="700" sx={{ lineHeight: 1.2 }}>
                          {item.patient ? `${item.patient.first_name} ${item.patient.last_name}` : 'Loading...'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Village: {item.patient?.village || '...'}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                          <AccessTimeIcon sx={{ fontSize: 14, mr: 0.5 }} />
                          <Typography variant="caption" fontWeight="600">
                            {getWaitTime(item.created_at)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </List>
        </Paper>
      </Grid>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h3" fontWeight="900" sx={{ letterSpacing: '-0.03em', color: 'primary.main' }}>
            LIVE QUEUE BOARD
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Real-time patient flow monitoring
          </Typography>
        </Box>
        <IconButton onClick={() => window.location.reload()} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      <Grid container spacing={3}>
        {renderQueueColumn("WAITING_FOR_VITALS", "WAITING_FOR_VITALS", "#6366f1")}
        {renderQueueColumn("READY_FOR_DOCTOR", "READY_FOR_DOCTOR", "#10b981")}
        {renderQueueColumn("WAITING_FOR_PHARMACY", "WAITING_FOR_PHARMACY", "#f59e0b")}
      </Grid>
    </Container>
  );
};

export default QueueBoard;
