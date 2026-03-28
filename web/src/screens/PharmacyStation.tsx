import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Grid, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Button, Chip, Stack,
  Card, CardContent, Divider, CircularProgress, Container
} from '@mui/material';
import { 
  LocalPharmacy as PharmacyIcon, 
  CheckCircle as CheckIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// Firebase Imports
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Service & Store Imports
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { getPatientById } from '../services/patientService';
import { getVitalsByEncounter } from '../services/encounterService';
import { useAppStore } from '../store/useAppStore';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

// Component Imports
import StationLayout from '../components/StationLayout';
import PatientContextBar from '../components/PatientContextBar'; 
import { Prescription } from '../types';

interface PharmacyStationProps {
  countryId: string;
}

const PharmacyStation: React.FC<PharmacyStationProps> = ({ countryId }) => {
  const { notify, selectedClinic, setSelectedPatient } = useAppStore();
  const { isMobile } = useResponsiveLayout();
  
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [dispensedItems, setDispensedItems] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1. Subscribe to Pharmacy Queue
  useEffect(() => {
    if (!selectedClinic) return;
    const unsubscribe = subscribeToQueue('WAITING_FOR_PHARMACY' as any, setWaitingList, (err) => console.error(err));
    return () => unsubscribe();
  }, [selectedClinic]);

  // 2. Open Dispensing Workspace
  const handleSelectPatient = async (item: any) => {
    setLoading(true);
    try {
      setSelectedItem(item);
      
      // Direct Fetch Logic to avoid Service Import Errors
      const [patient, medsSnapshot, vitals] = await Promise.all([
        getPatientById(item.patient_id),
        getDocs(query(collection(db, "prescriptions"), where("encounter_id", "==", item.encounter_id))),
        getVitalsByEncounter(item.encounter_id)
      ]);

      const meds = medsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription));

      // Sync risk data for the PatientContextBar
      const patientWithRisk = { ...patient, currentVitals: vitals, triage_level: item.triage_level };
      setSelectedPatient(patientWithRisk);
      setPrescriptions(meds);
      
      // Reset dispensing checklist
      const initialChecklist: Record<string, boolean> = {};
      meds.forEach(m => initialChecklist[m.id!] = false);
      setDispensedItems(initialChecklist);

    } catch (e) {
      notify("Error loading data", "error");
    } finally {
      setLoading(false);
    }
  };

  // 3. Complete Dispensing & Finalize Visit
  const handleFinalizeDispensing = async () => {
    const allChecked = Object.values(dispensedItems).every(v => v === true);
    if (!allChecked) {
      notify("Please verify all medications before finalizing.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      // Direct update to Firestore to maintain dispensing functionality
      await Promise.all(prescriptions.map(m => 
        updateDoc(doc(db, "prescriptions", m.id!), { status: 'DISPENSED' })
      ));
      
      await updateQueueStatus(selectedItem.id, 'COMPLETED' as any);
      
      notify("Dispensing complete.", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
    } catch (e) {
      notify("Error finalizing visit.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDispense = (id: string) => {
    setDispensedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderQueueList = () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight="900" mb={3}>Pharmacy Queue</Typography>
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>Patient Name</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Triage</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {waitingList.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{item.patient_name}</TableCell>
                <TableCell>
                  <Chip 
                    label={item.triage_level?.toUpperCase()} 
                    size="small" 
                    sx={{ fontWeight: 900, bgcolor: item.triage_level === 'emergency' ? '#ef4444' : '#e2e8f0', color: item.triage_level === 'emergency' ? 'white' : 'black' }} 
                  />
                </TableCell>
                <TableCell align="right">
                  <Button variant="contained" size="small" onClick={() => handleSelectPatient(item)}>Dispense</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <StationLayout title="Pharmacy Station" stationName="Pharmacy" showPatientContext={!!selectedItem}>
      {loading ? (
        <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>
      ) : (
        !selectedItem ? renderQueueList() : (
          <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100vh' }}>
            <PatientContextBar /> 
            <Container maxWidth="lg" sx={{ py: 3 }}>
              <Paper sx={{ p: 4, borderRadius: 5 }}>
                <Typography variant="h5" fontWeight="900" mb={4}>Dispensing Checklist</Typography>
                <Stack spacing={3}>
                  {prescriptions.map((med, idx) => (
                    <Card key={idx} variant="outlined" sx={{ borderRadius: 4, border: dispensedItems[med.id!] ? '2px solid #10b981' : '1px solid #e2e8f0' }}>
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={8}>
                            <Typography variant="h6" fontWeight="900">{med.medicationName}</Typography>
                            <Typography variant="body1">
                              {med.dosageValue}{med.dosageUnit} • {med.frequencyValue} {med.frequencyUnit} • {med.durationValue} {med.durationUnit}
                            </Typography>
                            {med.instructions && (
                              <Box sx={{ mt: 2, p: 2, bgcolor: '#ecfdf5', borderRadius: 2, borderLeft: '4px solid #10b981' }}>
                                <Typography variant="caption" sx={{ fontWeight: 900, color: '#047857' }}>DOCTOR'S INSTRUCTIONS:</Typography>
                                <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#065f46' }}>{med.instructions}</Typography>
                              </Box>
                            )}
                          </Grid>
                          <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
                            <Typography variant="h4" fontWeight="900" color="secondary.main">{med.quantity} Units</Typography>
                            <Button 
                              variant={dispensedItems[med.id!] ? "contained" : "outlined"} 
                              color="success" onClick={() => toggleDispense(med.id!)}
                              sx={{ mt: 1, borderRadius: 2 }}
                            >
                              {dispensedItems[med.id!] ? "VERIFIED" : "MARK READY"}
                            </Button>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
                <Divider sx={{ my: 4 }} />
                <Box display="flex" justifyContent="center">
                  <Button 
                    size="large" variant="contained" color="success"
                    onClick={handleFinalizeDispensing}
                    disabled={isSaving || !Object.values(dispensedItems).every(v => v === true)}
                    sx={{ height: 60, px: 6, borderRadius: 3, fontWeight: 900 }}
                  >
                    {isSaving ? "SAVING..." : "FINALIZE VISIT"}
                  </Button>
                </Box>
              </Paper>
            </Container>
          </Box>
        )
      )}
    </StationLayout>
  );
};

export default PharmacyStation;