import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';
import { 
  getEncountersByPatient, 
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const encounters = await getEncountersByPatient(patientId);
        const completedEncounters = encounters.filter(e => e.encounter_status === 'COMPLETED');
        
        const items = await Promise.all(completedEncounters.map(async (encounter) => {
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

  if (loading) return <CircularProgress size={24} />;

  if (historyItems.length === 0) {
    return (
      <Box p={2} textAlign="center">
        <Typography color="textSecondary">No previous medical history found.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <List>
        {historyItems.map((item, index) => (
          <React.Fragment key={item.encounter.id}>
            <ListItem alignItems="flex-start" sx={{ px: 0 }}>
              <ListItemText
                primary={
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" fontWeight="bold">
                      {item.encounter.created_at?.toDate().toLocaleDateString()}
                    </Typography>
                    <Chip label="Completed" size="small" variant="outlined" color="success" />
                  </Box>
                }
                secondary={
                  <Box mt={1}>
                    <Typography variant="body2" color="textPrimary" sx={{ fontWeight: 'medium' }}>
                      Diagnosis: {item.diagnosis?.diagnosis || 'N/A'}
                    </Typography>
                    {item.vitals && (
                      <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
                        Vitals: BP {item.vitals.systolic}/{item.vitals.diastolic} | HR {item.vitals.heartRate} | Temp {item.vitals.temperature}°C
                      </Typography>
                    )}
                    {item.prescription && item.prescription.prescriptions.length > 0 && (
                      <Box mt={1}>
                        <Typography variant="caption" fontWeight="bold">Prescriptions:</Typography>
                        <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                          {item.prescription.prescriptions.map((p, i) => (
                            <Chip key={i} label={p.medicationName} size="small" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                }
              />
            </ListItem>
            {index < historyItems.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default PatientHistoryTimeline;
