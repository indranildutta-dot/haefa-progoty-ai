import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip
} from '@mui/material';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Encounter } from '../types';

interface PatientHistoryTimelineProps {
  patientId: string;
}

const PatientHistoryTimeline: React.FC<PatientHistoryTimelineProps> = ({ patientId }) => {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "encounters"),
          where("patient_id", "==", patientId),
          where("encounter_status", "==", "completed"),
          orderBy("created_at", "desc")
        );
        const querySnapshot = await getDocs(q);
        const history = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Encounter[];
        setEncounters(history);
      } catch (err) {
        console.error("Error fetching history:", err);
      } finally {
        setLoading(false);
      }
    };

    if (patientId) fetchHistory();
  }, [patientId]);

  if (loading) return <CircularProgress size={24} />;

  if (encounters.length === 0) {
    return (
      <Box p={2} textAlign="center">
        <Typography color="textSecondary">No previous medical history found.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <List>
        {encounters.map((encounter, index) => (
          <React.Fragment key={encounter.id}>
            <ListItem alignItems="flex-start" sx={{ px: 0 }}>
              <ListItemText
                primary={
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" fontWeight="bold">
                      {encounter.created_at?.toDate().toLocaleDateString()}
                    </Typography>
                    <Chip label="Completed" size="small" variant="outlined" color="success" />
                  </Box>
                }
                secondary={
                  <Box mt={1}>
                    <Typography variant="body2" color="textPrimary" sx={{ fontWeight: 'medium' }}>
                      Diagnosis: {encounter.diagnosis || 'N/A'}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
                      Vitals: BP {encounter.vitals?.systolic}/{encounter.vitals?.diastolic} | HR {encounter.vitals?.heartRate} | Temp {encounter.vitals?.temperature}°C
                    </Typography>
                    {encounter.prescriptions && encounter.prescriptions.length > 0 && (
                      <Box mt={1}>
                        <Typography variant="caption" fontWeight="bold">Prescriptions:</Typography>
                        <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                          {encounter.prescriptions.map((p, i) => (
                            <Chip key={i} label={p.medicationName} size="small" />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                }
              />
            </ListItem>
            {index < encounters.length - 1 && <Divider component="li" />}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default PatientHistoryTimeline;
