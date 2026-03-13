import React, { useEffect, useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box, 
  Avatar, 
  Divider,
  CircularProgress,
  Grid
} from '@mui/material';
import { QueuePatient, VitalsRecord, DiagnosisRecord } from '../../types';
import { getVitalsByEncounter, getDiagnosisByEncounter } from '../../services/encounterService';
import { updateQueueStatus } from '../../services/queueService';
import { updateEncounterStatus } from '../../services/encounterService';
import { useAppStore } from '../../store/useAppStore';

interface QueuePatientDetailDrawerProps {
  patient: QueuePatient | null;
  onClose: () => void;
  onMove: (encounterId: string, nextStatus: string) => void;
}

const QueuePatientDetailDrawer: React.FC<QueuePatientDetailDrawerProps> = ({ patient, onClose, onMove }) => {
  const [vitals, setVitals] = useState<VitalsRecord | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const { selectedClinic } = useAppStore();

  useEffect(() => {
    if (patient) {
      setLoading(true);
      Promise.all([
        getVitalsByEncounter(patient.encounterId),
        getDiagnosisByEncounter(patient.encounterId)
      ]).then(([v, d]) => {
        setVitals(v);
        setDiagnosis(d);
        setLoading(false);
      }).catch(err => {
        console.error("Error fetching patient details:", err);
        setLoading(false);
      });
    } else {
      setVitals(null);
      setDiagnosis(null);
    }
  }, [patient]);

  const handleMove = async (newStatus: string) => {
    if (!patient || !selectedClinic) return;
    try {
      if (patient.queueId) {
        await updateQueueStatus(patient.queueId, newStatus as any);
      }
      await updateEncounterStatus(patient.encounterId, newStatus as any);
      
      onMove(patient.encounterId, newStatus);
      onClose();
    } catch (err) {
      console.error("Error moving patient:", err);
    }
  };

  if (!patient) return null;

  return (
    <Dialog open={!!patient} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Patient Details
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar src={patient.photoUrl} sx={{ width: 80, height: 80, mr: 3, border: '3px solid', borderColor: 'primary.light' }}>
            {patient.patientName.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight="900" gutterBottom>{patient.patientName}</Typography>
            <Typography variant="body1" color="text.secondary" fontWeight="bold">
              Age: {patient.age} | {patient.gender.toUpperCase()} | Village: {patient.village || 'N/A'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Typography variant="body2" sx={{ bgcolor: 'warning.light', px: 1, py: 0.5, borderRadius: 1, fontWeight: 'bold' }}>
                Triage: {patient.triageLevel?.toUpperCase() || 'STANDARD'}
              </Typography>
              <Typography variant="body2" sx={{ bgcolor: 'info.light', px: 1, py: 0.5, borderRadius: 1, fontWeight: 'bold' }}>
                Status: {patient.encounterStatus.replace(/_/g, ' ')}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" color="primary" fontWeight="bold" gutterBottom sx={{ textTransform: 'uppercase' }}>
                Vitals Snapshot
              </Typography>
              {vitals ? (
                <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2"><strong>BP:</strong> {vitals.systolic}/{vitals.diastolic} mmHg</Typography>
                  <Typography variant="body2"><strong>HR:</strong> {vitals.heartRate} bpm</Typography>
                  <Typography variant="body2"><strong>Temp:</strong> {vitals.temperature} °C</Typography>
                  <Typography variant="body2"><strong>Weight:</strong> {vitals.weight} kg</Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">No vitals recorded yet.</Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" color="primary" fontWeight="bold" gutterBottom sx={{ textTransform: 'uppercase' }}>
                Recent Diagnosis
              </Typography>
              {diagnosis ? (
                <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" fontWeight="bold">{diagnosis.diagnosis}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{diagnosis.chief_complaint}</Typography>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">No diagnosis recorded yet.</Typography>
              )}
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, bgcolor: 'grey.100', justifyContent: 'space-between' }}>
        <Button onClick={onClose} color="inherit" sx={{ fontWeight: 'bold' }}>Close</Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {patient.encounterStatus === 'REGISTERED' && (
            <Button variant="contained" color="secondary" onClick={() => handleMove('WAITING_FOR_VITALS')}>Send to Vitals</Button>
          )}
          {patient.encounterStatus === 'WAITING_FOR_VITALS' && (
            <Button variant="contained" color="primary" onClick={() => handleMove('READY_FOR_DOCTOR')}>Send to Doctor</Button>
          )}
          {(patient.encounterStatus === 'READY_FOR_DOCTOR' || patient.encounterStatus === 'IN_CONSULTATION') && (
            <Button variant="contained" color="warning" onClick={() => handleMove('WAITING_FOR_PHARMACY')}>Send to Pharmacy</Button>
          )}
          {patient.encounterStatus === 'WAITING_FOR_PHARMACY' && (
            <Button variant="contained" color="success" onClick={() => handleMove('COMPLETED')}>Mark Complete</Button>
          )}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default QueuePatientDetailDrawer;
