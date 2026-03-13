import React, { useState, useEffect, useMemo } from 'react';
import { 
  Typography, 
  Box, 
  IconButton,
  Grid,
  Stack
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { QueuePatient, Patient, QueueItem } from '../types';
import { getPatientById } from '../services/patientService';
import { useAppStore } from '../store/useAppStore';
import QueueColumn from '../components/queue/QueueColumn';
import QueuePatientDetailDrawer from '../components/queue/QueuePatientDetailDrawer';
import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface QueueBoardProps {
  countryId: string;
}

const QueueBoard: React.FC<QueueBoardProps> = ({ countryId }) => {
  const { selectedCountry, selectedClinic } = useAppStore();
  const { isMobile, isTablet } = useResponsiveLayout();
  const [queuePatients, setQueuePatients] = useState<QueuePatient[]>([]);
  const [patientsCache, setPatientsCache] = useState<Record<string, Patient>>({});
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCountry || !selectedClinic) return;
    
    const q = query(
      collection(db, "queues_active"),
      where("country_code", "==", selectedCountry.id),
      where("clinic_id", "==", selectedClinic.id),
      where("status", "!=", "COMPLETED")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QueueItem[];

        items.sort((a, b) => {
          const timeA = a.created_at?.toMillis() || 0;
          const timeB = b.created_at?.toMillis() || 0;
          return timeA - timeB;
        });

        // Fetch missing patients
        const missingIds = items
          .map(i => i.patient_id)
          .filter(id => !patientsCache[id]);

        let currentPatientsCache = patientsCache;

        if (missingIds.length > 0) {
          const newPatients = { ...patientsCache };
          await Promise.all(missingIds.map(async (id) => {
            const p = await getPatientById(id);
            if (p) newPatients[id] = p;
          }));
          setPatientsCache(newPatients);
          currentPatientsCache = newPatients;
        }

        const qPatients = items.map(item => {
          const p = currentPatientsCache[item.patient_id];
          return {
            encounterId: item.encounter_id,
            queueId: item.id,
            patientId: item.patient_id,
            patientName: p ? `${p.first_name} ${p.last_name}` : 'Loading...',
            age: p ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : 0,
            gender: p ? p.gender : '?',
            village: p?.village,
            photoUrl: p?.photo_url,
            triageLevel: item.triage_level as any,
            encounterStatus: item.status,
            createdAt: item.created_at || { toDate: () => new Date() }
          } as QueuePatient;
        });
        setQueuePatients(qPatients);
        setLoading(false);
      } catch (error) {
        console.error("Error processing queue snapshot:", error);
        setLoading(false);
      }
    }, (error) => {
      console.error("Queue snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedCountry, selectedClinic, patientsCache]);

  const groupedPatients = useMemo(() => {
    const groups: Record<string, QueuePatient[]> = {
      'REGISTERED': [],
      'WAITING_FOR_VITALS': [],
      'DOCTOR': [],
      'WAITING_FOR_PHARMACY': []
    };
    queuePatients.forEach(p => {
      if (p.encounterStatus === 'REGISTERED') groups['REGISTERED'].push(p);
      else if (p.encounterStatus === 'WAITING_FOR_VITALS') groups['WAITING_FOR_VITALS'].push(p);
      else if (p.encounterStatus === 'READY_FOR_DOCTOR' || p.encounterStatus === 'IN_CONSULTATION') groups['DOCTOR'].push(p);
      else if (p.encounterStatus === 'WAITING_FOR_PHARMACY') groups['WAITING_FOR_PHARMACY'].push(p);
    });
    return groups;
  }, [queuePatients]);

  return (
    <StationLayout
      title="Clinic Queue Board"
      stationName="Queue"
      showPatientContext={false}
      actions={
        <IconButton onClick={() => window.location.reload()} color="primary">
          <RefreshIcon />
        </IconButton>
      }
    >
      <Box sx={{ mb: isMobile ? 2 : 4 }}>
        <Typography variant="subtitle1" color="text.secondary">
          Real-time patient flow across all stations.
        </Typography>
      </Box>

      <Box 
        sx={{ 
          display: 'flex', 
          gap: { xs: 2, md: 3 }, 
          overflowX: 'auto', 
          flexGrow: 1, 
          pb: 2,
          minHeight: 'calc(100vh - 250px)',
          '&::-webkit-scrollbar': {
            height: 8,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'grey.100',
            borderRadius: 4,
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'grey.300',
            borderRadius: 4,
            '&:hover': {
              backgroundColor: 'grey.400',
            },
          },
        }}
      >
        <Box sx={{ minWidth: { xs: 280, md: 320 }, flex: 1 }}>
          <QueueColumn title="Registration" headerColor="#e3f2fd" patients={groupedPatients['REGISTERED']} onPatientClick={setSelectedPatient} loading={loading} />
        </Box>
        <Box sx={{ minWidth: { xs: 280, md: 320 }, flex: 1 }}>
          <QueueColumn title="Vitals" headerColor="#f3e5f5" patients={groupedPatients['WAITING_FOR_VITALS']} onPatientClick={setSelectedPatient} loading={loading} />
        </Box>
        <Box sx={{ minWidth: { xs: 280, md: 320 }, flex: 1 }}>
          <QueueColumn title="Doctor" headerColor="#e8f5e9" patients={groupedPatients['DOCTOR']} onPatientClick={setSelectedPatient} loading={loading} />
        </Box>
        <Box sx={{ minWidth: { xs: 280, md: 320 }, flex: 1 }}>
          <QueueColumn title="Pharmacy" headerColor="#fff3e0" patients={groupedPatients['WAITING_FOR_PHARMACY']} onPatientClick={setSelectedPatient} loading={loading} />
        </Box>
      </Box>

      <QueuePatientDetailDrawer 
        patient={selectedPatient} 
        onClose={() => setSelectedPatient(null)} 
        onMove={(encounterId, nextStatus) => {
          setQueuePatients(prev => prev.map(p => 
            p.encounterId === encounterId ? { ...p, encounterStatus: nextStatus as any } : p
          ));
        }} 
      />
    </StationLayout>
  );
};

export default QueueBoard;
