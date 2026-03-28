import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Grid, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Button, Chip, Stack,
  Card, CardContent, Divider, CircularProgress, Alert, Checkbox, 
  FormControlLabel, FormGroup
} from '@mui/material';
import { 
  LocalPharmacy as PharmacyIcon, 
  Assignment as AssignmentIcon,
  CheckCircle as CheckIcon,
  Timer as TimerIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { getPrescriptionsByEncounter, updatePrescriptionStatus } from '../services/prescriptionService';
import { getPatientById } from '../services/patientService';
import { getVitalsByEncounter } from '../services/encounterService';
import { auth } from '../firebase';
import { useAppStore } from '../store/useAppStore';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

import StationLayout from '../components/StationLayout';
import PatientContextBar from '../components/PatientContextBar'; // High-Risk Alerts Sidebar
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
      
      const [patient, meds, vitals] = await Promise.all([
        getPatientById(item.patient_id),
        getPrescriptionsByEncounter(item.encounter_id),
        getVitalsByEncounter(item.encounter_id)
      ]);

      // Bundle risk data for the PatientContextBar
      const patientWithRisk = { ...patient, currentVitals: vitals, triage_level: item.triage_level };
      setSelectedPatient(patientWithRisk);
      setPrescriptions(meds);
      
      // Reset dispensing checklist
      const initialChecklist: Record<string, boolean> = {};
      meds.forEach(m => initialChecklist[m.id!] = false);
      setDispensedItems(initialChecklist);

    } catch (e) {
      notify("Error loading prescriptions", "error");
    } finally {
      setLoading(false);
    }
  };

  // 3. Complete Dispensing Logic
  const handleFinalizeDispensing = async () => {
    const allChecked = Object.values(dispensedItems).every(v => v === true);
    if (!allChecked) {
      notify("Please verify all medications before finalizing.", "warning");
      return;
    }

    setIsSaving(true);
    try {
      // Mark all prescriptions as dispensed in DB
      await Promise.all(prescriptions.map(m => updatePrescriptionStatus(m.id!, 'DISPENSED')));
      
      // Update Queue Status to Completed
      await updateQueueStatus(selectedItem.id, 'COMPLETED' as any);
      
      notify("Dispensing complete. Visit finalized.", "success");
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
      <Typography variant="h6" fontWeight="900" mb={3}>Pharmacy Pending Queue</Typography>
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
                  <Button variant="contained" size="small" onClick={() => handleSelectPatient(item)}>Dispense Meds</Button>
                </TableCell>
              </TableRow>
            ))}
            {waitingList.length === 0 && (
              <TableRow><TableCell colSpan={3} align="center" sx={{ py: 8 }}>No patients waiting for pharmacy.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderDispensingWorkspace = () => (
    <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100vh' }}>
      {/* High-Risk Alerts Bar: Now Pharmacists see Pregnancy/Allergies immediately */}
      <PatientContextBar /> 

      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 4, borderRadius: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
                <Box display="flex" alignItems="center">
                  <PharmacyIcon color="primary" sx={{ mr: 1, fontSize: 32 }} />
                  <Typography variant="h5" fontWeight="900">DISPENSING CHECKLIST</Typography>
                </Box>
                <Button variant="outlined" onClick={() => setSelectedItem(null)}>Back to Queue</Button>
              </Stack>

              <Stack spacing={3}>
                {prescriptions.map((med, idx) => (
                  <Card key={idx} variant="outlined" sx={{ borderRadius: 4, border: dispensedItems[med.id!] ? '2px solid #10b981' : '1px solid #e2e8f0', bgcolor: dispensedItems[med.id!] ? '#f0fdf4' : 'white' }}>
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={8}>
                          <Typography variant="h6" fontWeight="900" color="primary">{med.medicationName}</Typography>
                          <Typography variant="body1" fontWeight="bold">
                            Dosage: {med.dosageValue}{med.dosageUnit} • Freq: {med.frequencyValue} {med.frequencyUnit} • Duration: {med.durationValue} {med.durationUnit}
                          </Typography>
                          
                          {/* Doctor's Pharmacist Instructions (High Visibility Green Box) */}
                          {med.instructions && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: '#ecfdf5', borderRadius: 2, borderLeft: '4px solid #10b981' }}>
                              <Typography variant="caption" sx={{ fontWeight: 900, color: '#047857', display: 'flex', alignItems: 'center' }}>
                                <InfoIcon sx={{ fontSize: 16, mr: 0.5 }} /> DOCTOR'S INSTRUCTIONS:
                              </Typography>
                              <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#065f46', mt: 0.5 }}>
                                {med.instructions}
                              </Typography>
                            </Box>
                          )}
                        </Grid>

                        <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="caption" display="block">TOTAL TO DISPENSE</Typography>
                            <Typography variant="h4" fontWeight="900" color="secondary.main">{med.quantity} Units</Typography>
                          </Box>
                          <Button 
                            variant={dispensedItems[med.id!] ? "contained" : "outlined"} 
                            color={dispensedItems[med.id!] ? "success" : "primary"}
                            onClick={() => toggleDispense(med.id!)}
                            startIcon={dispensedItems[med.id!] ? <CheckIcon /> : null}
                            sx={{ borderRadius: 2, fontWeight: 800 }}
                          >
                            {dispensedItems[med.id!] ? "VERIFIED" : "MARK AS READY"}
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
                  sx={{ height: 70, px: 8, borderRadius: 4, fontWeight: 900, fontSize: '1.2rem', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)' }}
                >
                  {isSaving ? "FINALIZING..." : "COMPLETE DISPENSING & FINALIZE VISIT"}
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );

  return (
    <StationLayout title="Pharmacy Station" stationName="Pharmacy" showPatientContext={!!selectedItem}>
      {loading ? (
        <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>
      ) : (
        !selectedItem ? renderQueueList() : renderDispensingWorkspace()
      )}
    </StationLayout>
  );
};

export default PharmacyStation;