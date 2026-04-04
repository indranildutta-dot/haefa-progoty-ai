import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Box, IconButton, Grid, Paper, CircularProgress, Chip, Stack } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import TimerIcon from '@mui/icons-material/Timer';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { QueuePatient, Patient, QueueItem } from '../types';
import { OperationType, handleFirestoreError } from '../utils/firestoreError';
import { getPatientById } from '../services/patientService';
import { useAppStore } from '../store/useAppStore';
import QueueColumn from '../components/queue/QueueColumn';
import QueuePatientDetailDrawer from '../components/queue/QueuePatientDetailDrawer';
import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

import { calculateAgeDisplay } from '../utils/patient';

const QueueBoard: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { selectedCountry, selectedClinic, userProfile } = useAppStore();
  const [rawQueueItems, setRawQueueItems] = useState<QueueItem[]>([]);
  const [patientsCache, setPatientsCache] = useState<Record<string, Patient>>({});
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null);
  const [loading, setLoading] = useState(true);

  // Formatting logic for clinical wait times
  const formatWaitTime = (createdAt: any) => {
    if (!createdAt) return '0m';
    const totalMinutes = Math.floor((Date.now() - createdAt.toDate().getTime()) / 60000);
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getTriageColor = (level: string) => {
    switch(level?.toLowerCase()) {
      case 'emergency': return '#ef4444'; // Red
      case 'urgent': return '#f59e0b';    // Amber
      case 'standard': return '#10b981';  // Green
      default: return '#94a3b8';         
    }
  };

  useEffect(() => {
    if (!selectedCountry || !selectedClinic || !userProfile?.isApproved) return;
    
    // Querying active queue - filtering status in memory to avoid composite index requirements
    const q = query(collection(db, "queues_active"), 
              where("country_id", "==", selectedCountry.id), 
              where("clinic_id", "==", selectedClinic.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QueueItem[];
        
        // Filter status in memory
        const items = allItems.filter(item => item.status !== 'COMPLETED');
        
        // Sort by arrival time
        items.sort((a, b) => (a.created_at?.toMillis() || 0) - (b.created_at?.toMillis() || 0));
        setRawQueueItems(items);
        setLoading(false);
      } catch (e) { setLoading(false); }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "queues_active");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCountry, selectedClinic, userProfile?.isApproved]);

  // Background cache management for patient names/photos
  useEffect(() => {
    const fetchMissingPatients = async () => {
      const missingIds = rawQueueItems.map(i => i.patient_id).filter(id => !patientsCache[id]);
      if (missingIds.length > 0) {
        const newPatients = { ...patientsCache };
        await Promise.all(missingIds.map(async id => { 
          const p = await getPatientById(id); if (p) newPatients[id] = p; 
        }));
        setPatientsCache(newPatients);
      }
    };
    fetchMissingPatients();
  }, [rawQueueItems]);

  const queuePatients = useMemo(() => {
    return rawQueueItems.map(item => {
      const p = patientsCache[item.patient_id];
      return {
        encounterId: item.encounter_id,
        queueId: item.id,
        patientId: item.patient_id,
        patientName: p ? `${p.given_name} ${p.family_name}` : 'Loading...',
        triageLevel: item.triage_level,
        encounterStatus: item.status,
        createdAt: item.created_at,
        waitTimeDisplay: formatWaitTime(item.created_at),
        triageColor: getTriageColor(item.triage_level),
        photoUrl: p?.photo_url,
        ageDisplay: calculateAgeDisplay(p),
        gender: p?.gender,
        village: p?.village
      } as any;
    });
  }, [rawQueueItems, patientsCache]);

  const { isMobile, isTablet } = useResponsiveLayout();

  const grouped = useMemo(() => {
    const g: any = { VITALS1: [], VITALS2: [], VITALS3: [], DOCTOR: [], PHARMACY: [] };
    queuePatients.forEach(p => {
      if (p.encounterStatus === 'WAITING_FOR_VITALS' || p.encounterStatus === 'REGISTERED') g.VITALS1.push(p);
      else if (p.encounterStatus === 'WAITING_FOR_VITALS_2') g.VITALS2.push(p);
      else if (p.encounterStatus === 'WAITING_FOR_VITALS_3') g.VITALS3.push(p);
      else if (p.encounterStatus === 'READY_FOR_DOCTOR' || p.encounterStatus === 'IN_CONSULTATION') g.DOCTOR.push(p);
      else if (p.encounterStatus === 'WAITING_FOR_PHARMACY') g.PHARMACY.push(p);
    });
    return g;
  }, [queuePatients]);

  return (
    <StationLayout title="Live Station Queue" stationName="Queue" showPatientContext={false}
      actions={<IconButton onClick={() => window.location.reload()} color="primary"><RefreshIcon /></IconButton>}
    >
      <Grid container spacing={2} sx={{ flexGrow: 1, minHeight: 'calc(100vh - 250px)' }}>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QueueColumn title="BODY MEASURES" headerColor="#f3e5f5" patients={grouped.VITALS1} onPatientClick={setSelectedPatient} loading={loading} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QueueColumn title={isMobile || isTablet ? "VITALS" : "VITAL SIGNS"} headerColor="#f3e5f5" patients={grouped.VITALS2} onPatientClick={setSelectedPatient} loading={loading} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QueueColumn title="LABS & RISK" headerColor="#f3e5f5" patients={grouped.VITALS3} onPatientClick={setSelectedPatient} loading={loading} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QueueColumn title="DOCTOR" headerColor="#e8f5e9" patients={grouped.DOCTOR} onPatientClick={setSelectedPatient} loading={loading} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
          <QueueColumn title="PHARMACY" headerColor="#fff3e0" patients={grouped.PHARMACY} onPatientClick={setSelectedPatient} loading={loading} />
        </Grid>
      </Grid>
      <QueuePatientDetailDrawer patient={selectedPatient} onClose={() => setSelectedPatient(null)} onMove={(encounterId, nextStatus) => {
        // For now, just close the drawer and reload
        setSelectedPatient(null);
        window.location.reload();
      }} />
    </StationLayout>
  );
};

export default QueueBoard;