import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import { 
  getPatientHistory,
  getVitalsByEncounter, 
  getDiagnosisByEncounter, 
  getPrescriptionByEncounter 
} from '../services/encounterService';
import { Encounter, VitalsRecord, DiagnosisRecord, PrescriptionRecord } from '../types';

interface PatientHistoryTimelineProps {
  patientId: string;
}

interface HistoryItem {
  encounter: Encounter;
  vitals: VitalsRecord | null;
  diagnosis: DiagnosisRecord | null;
  prescription: PrescriptionRecord | null;
}

const PatientHistoryTimeline: React.FC<PatientHistoryTimelineProps> = ({ patientId }) => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [fullHistoryItems, setFullHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFull, setLoadingFull] = useState(false);
  const [openFullHistory, setOpenFullHistory] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const encounters = await getPatientHistory(patientId);
        const completedEncounters = encounters
          .filter(e => e.encounter_status === 'COMPLETED');
        
        const items = await Promise.all(completedEncounters.slice(0, 5).map(async (encounter) => {
          const [vitals, diagnosis, prescription] = await Promise.all([
            getVitalsByEncounter(encounter.id!),
            getDiagnosisByEncounter(encounter.id!),
            getPrescriptionByEncounter(encounter.id!)
          ]);
          return { encounter, vitals, diagnosis, prescription };
        }));
        
        setHistoryItems(items);
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    };

    if (patientId) fetchHistory();
  }, [patientId]);

  const handleViewFullHistory = async () => {
    setOpenFullHistory(true);
    if (fullHistoryItems.length > 0) return; // Already loaded

    setLoadingFull(true);
    try {
      const encounters = await getPatientHistory(patientId);
      const completedEncounters = encounters
        .filter(e => e.encounter_status === 'COMPLETED');
      
      const items = await Promise.all(completedEncounters.map(async (encounter) => {
        const [vitals, diagnosis, prescription] = await Promise.all([
          getVitalsByEncounter(encounter.id!),
          getDiagnosisByEncounter(encounter.id!),
          getPrescriptionByEncounter(encounter.id!)
        ]);
        return { encounter, vitals, diagnosis, prescription };
      }));
      
      setFullHistoryItems(items);
    } catch (err) {
      console.error("Error fetching full history:", err);
    } finally {
      setLoadingFull(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} /></Box>;

  if (historyItems.length === 0) {
    return (
      <Box p={2} textAlign="center">
        <Typography color="textSecondary">No previous medical history found.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
        Recent Encounters
      </Typography>
      {historyItems.map((item, index) => {
        const dateStr = item.encounter.created_at?.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const isAbnormalTemp = item.vitals?.temperature && (item.vitals.temperature > 37.5 || item.vitals.temperature < 35.0);

        return (
          <Card key={item.encounter.id} sx={{ mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {dateStr}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>Diagnosis:</strong> {item.diagnosis?.diagnosis || 'N/A'}
              </Typography>
              {item.vitals?.temperature && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>Temp:</strong> <span style={{ color: isAbnormalTemp ? '#ef4444' : 'inherit', fontWeight: isAbnormalTemp ? 'bold' : 'normal' }}>{item.vitals.temperature}°C</span>
                </Typography>
              )}
              {item.prescription && item.prescription.prescriptions.length > 0 && (
                <Typography variant="body2">
                  <strong>Medications:</strong> {item.prescription.prescriptions.map(p => p.medicationName).join(', ')}
                </Typography>
              )}
            </CardContent>
          </Card>
        );
      })}
      {historyItems.length > 0 && (
        <Button variant="outlined" fullWidth onClick={handleViewFullHistory} sx={{ mt: 1, borderRadius: 2, fontWeight: 700 }}>
          View Full History
        </Button>
      )}

      <Dialog open={openFullHistory} onClose={() => setOpenFullHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, textTransform: 'uppercase' }}>Full Patient History</DialogTitle>
        <DialogContent dividers>
          {loadingFull ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} /></Box>
          ) : (
            fullHistoryItems.map((item, index) => {
              const dateStr = item.encounter.created_at?.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              return (
                <Box key={item.encounter.id} sx={{ mb: 3 }}>
                  <Typography variant="h6" fontWeight="bold" color="primary.main">{dateStr}</Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>Encounter ID: {item.encounter.id}</Typography>
                  
                  <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'primary.main', mb: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>Diagnosis</Typography>
                    <Typography variant="body2">{item.diagnosis?.diagnosis || 'None recorded'}</Typography>
                    {item.diagnosis?.notes && <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>{item.diagnosis.notes}</Typography>}

                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>Vitals</Typography>
                    {item.vitals ? (
                      <Typography variant="body2">
                        BP: {item.vitals.systolic}/{item.vitals.diastolic} | HR: {item.vitals.heartRate} | Temp: {item.vitals.temperature}°C | SpO2: {item.vitals.oxygenSaturation}%
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="textSecondary">None recorded</Typography>
                    )}

                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mt: 1 }}>Prescriptions</Typography>
                    {item.prescription && item.prescription.prescriptions.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {item.prescription.prescriptions.map((p, i) => (
                          <li key={i}>
                            <Typography variant="body2">{p.medicationName} - {p.dosage} ({p.frequency} for {p.duration})</Typography>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Typography variant="body2" color="textSecondary">None recorded</Typography>
                    )}
                  </Box>
                  {index < fullHistoryItems.length - 1 && <Divider />}
                </Box>
              );
            })
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenFullHistory(false)} variant="contained" sx={{ borderRadius: 2, fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientHistoryTimeline;
