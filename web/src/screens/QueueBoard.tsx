import React, { useState, useEffect, useMemo } from 'react';
import { 
  Typography, 
  Box, 
  Container,
  IconButton,
  Grid
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { QueuePatient, Patient, Encounter } from '../types';
import { getPatientById } from '../services/patientService';
import { useAppStore } from '../store/useAppStore';
import QueueColumn from '../components/queue/QueueColumn';
import QueuePatientDetailDrawer from '../components/queue/QueuePatientDetailDrawer';

interface QueueBoardProps {
  countryId: string;
}

const QueueBoard: React.FC<QueueBoardProps> = ({ countryId }) => {
  const { selectedCountry, selectedClinic } = useAppStore();
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
          // Batch fetch in chunks or Promise.all
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
            createdAt: item.created_at || { toDate: () => new Date() } // Fallback for local optimistic writes
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
      'DOCTOR': [], // Combined READY_FOR_DOCTOR and IN_CONSULTATION
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
    <Container maxWidth={false} sx={{ py: 4, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" fontWeight="900" color="primary" sx={{ textTransform: 'uppercase' }}>
          Clinic Queue Board
        </Typography>
        <IconButton onClick={() => window.location.reload()}>
          <RefreshIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, overflowX: 'auto', flexGrow: 1, pb: 2 }}>
        <QueueColumn title="Registration" headerColor="#e3f2fd" patients={groupedPatients['REGISTERED']} onPatientClick={setSelectedPatient} loading={loading} />
        <QueueColumn title="Vitals" headerColor="#f3e5f5" patients={groupedPatients['WAITING_FOR_VITALS']} onPatientClick={setSelectedPatient} loading={loading} />
        <QueueColumn title="Doctor" headerColor="#e8f5e9" patients={groupedPatients['DOCTOR']} onPatientClick={setSelectedPatient} loading={loading} />
        <QueueColumn title="Pharmacy" headerColor="#fff3e0" patients={groupedPatients['WAITING_FOR_PHARMACY']} onPatientClick={setSelectedPatient} loading={loading} />
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
    </Container>
  );
};

export default QueueBoard;
