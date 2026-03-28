import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Box, IconButton } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase';
import { QueuePatient, Patient, QueueItem, OperationType } from '../types';
import { getPatientById } from '../services/patientService';
import { useAppStore } from '../store/useAppStore';
import QueueColumn from '../components/queue/QueueColumn';
import QueuePatientDetailDrawer from '../components/queue/QueuePatientDetailDrawer';
import StationLayout from '../components/StationLayout';

const QueueBoard: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { selectedCountry, selectedClinic, userProfile } = useAppStore();
  const [queuePatients, setQueuePatients] = useState<QueuePatient[]>([]);
  const [patientsCache, setPatientsCache] = useState<Record<string, Patient>>({});
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null);
  const [loading, setLoading] = useState(true);

  const formatWaitTime = (createdAt: any) => {
    if (!createdAt) return '0m';
    const totalMinutes = Math.floor((Date.now() - createdAt.toDate().getTime()) / 60000);
    if (totalMinutes < 60) return `${totalMinutes}m`;
    return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  };

  useEffect(() => {
    if (!selectedCountry || !selectedClinic || !userProfile?.isApproved) return;
    const q = query(collection(db, "queues_active"), where("country_code", "==", selectedCountry.id), where("clinic_id", "==", selectedClinic.id), where("status", "!=", "COMPLETED"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as QueueItem[];
        items.sort((a, b) => (a.created_at?.toMillis() || 0) - (b.created_at?.toMillis() || 0));
        const missingIds = items.map(i => i.patient_id).filter(id => !patientsCache[id]);
        if (missingIds.length > 0) {
          const newPatients = { ...patientsCache };
          await Promise.all(missingIds.map(async id => { const p = await getPatientById(id); if (p) newPatients[id] = p; }));
          setPatientsCache(newPatients);
        }
        setQueuePatients(items.map(item => {
          const p = patientsCache[item.patient_id];
          return {
            encounterId: item.encounter_id, queueId: item.id, patientId: item.patient_id,
            patientName: p ? `${p.given_name} ${p.family_name}` : 'Loading...',
            age: p ? (p.age_years ?? (p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : 0)) : 0,
            gender: p ? p.gender : '?',
            triageLevel: item.triage_level,
            encounterStatus: item.status,
            createdAt: item.created_at,
            waitTimeDisplay: formatWaitTime(item.created_at)
          } as any;
        }));
        setLoading(false);
      } catch (e) { setLoading(false); }
    });
    return () => unsubscribe();
  }, [selectedCountry, selectedClinic, patientsCache]);

  const grouped = useMemo(() => {
    const g: any = { VITALS: [], DOCTOR: [], PHARMACY: [] };
    queuePatients.forEach(p => {
      if (p.encounterStatus === 'WAITING_FOR_VITALS' || p.encounterStatus === 'REGISTERED') g.VITALS.push(p);
      else if (p.encounterStatus === 'READY_FOR_DOCTOR' || p.encounterStatus === 'IN_CONSULTATION') g.DOCTOR.push(p);
      else if (p.encounterStatus === 'WAITING_FOR_PHARMACY') g.PHARMACY.push(p);
    });
    return g;
  }, [queuePatients]);

  return (
    <StationLayout title="Clinic Flow" stationName="Queue" showPatientContext={false}>
      <Box sx={{ display: 'flex', gap: 3, overflowX: 'auto', minHeight: 'calc(100vh - 250px)' }}>
        <Box sx={{ minWidth: 350, flex: 1 }}><QueueColumn title="Vitals" headerColor="#f3e5f5" patients={grouped.VITALS} onPatientClick={setSelectedPatient} loading={loading} /></Box>
        <Box sx={{ minWidth: 350, flex: 1 }}><QueueColumn title="Doctor" headerColor="#e8f5e9" patients={grouped.DOCTOR} onPatientClick={setSelectedPatient} loading={loading} /></Box>
        <Box sx={{ minWidth: 350, flex: 1 }}><QueueColumn title="Pharmacy" headerColor="#fff3e0" patients={grouped.PHARMACY} onPatientClick={setSelectedPatient} loading={loading} /></Box>
      </Box>
      <QueuePatientDetailDrawer patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
    </StationLayout>
  );
};
export default QueueBoard;