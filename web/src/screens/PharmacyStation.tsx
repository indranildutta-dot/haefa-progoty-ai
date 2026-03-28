import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, Chip, Stack, Card, CardContent, Container, Alert, Divider, Grid 
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { getPatientById } from '../services/patientService';
import { getVitalsByEncounter } from '../services/encounterService';
import { useAppStore } from '../store/useAppStore';
import StationLayout from '../components/StationLayout';
import PatientContextBar from '../components/PatientContextBar'; 

const PharmacyStation: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { notify, selectedClinic, setSelectedPatient } = useAppStore();
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patientVitals, setPatientVitals] = useState<any>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedClinic) return;
    return subscribeToQueue('WAITING_FOR_PHARMACY' as any, setWaitingList, (err) => console.error(err));
  }, [selectedClinic]);

  const formatWaitTime = (createdAt: any) => {
    if (!createdAt) return '0m';
    const totalMinutes = Math.floor((Date.now() - createdAt.toDate().getTime()) / 60000);
    return totalMinutes < 60 ? `${totalMinutes}m` : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  };

  const handleSelectPatient = async (item: any) => {
    try {
      setSelectedItem(item);
      const [patient, medsSnapshot, vitals] = await Promise.all([
        getPatientById(item.patient_id),
        getDocs(query(collection(db, "prescriptions"), where("encounter_id", "==", item.encounter_id))),
        getVitalsByEncounter(item.encounter_id)
      ]);
      setPatientVitals(vitals);
      const meds = medsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSelectedPatient({ ...patient, currentVitals: vitals, triage_level: item.triage_level });
      setPrescriptions(meds);
      const initialChecks: Record<string, boolean> = {};
      meds.forEach(m => initialChecks[m.id!] = false);
      setChecklist(initialChecks);
    } catch (e) { notify("Error loading dispense data", "error"); }
  };

  const handleFinalize = async () => {
    if (!Object.values(checklist).every(v => v === true)) {
      return notify("Please verify all medications.", "warning");
    }
    try {
      await Promise.all(prescriptions.map(m => updateDoc(doc(db, "prescriptions", m.id!), { status: 'DISPENSED' })));
      await updateQueueStatus(selectedItem.id, 'COMPLETED' as any);
      setSelectedItem(null);
      setSelectedPatient(null);
      notify("Dispensing complete", "success");
    } catch (e) { notify("Error finalizing", "error"); }
  };

  return (
    <StationLayout title="Pharmacy Dispensing" stationName="Pharmacy" showPatientContext={!!selectedItem}>
      {!selectedItem ? (
        <TableContainer component={Paper} elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid #e2e8f0' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}><TableRow><TableCell>Wait Time</TableCell><TableCell>Patient Name</TableCell><TableCell align="right">Action</TableCell></TableRow></TableHead>
            <TableBody>
              {waitingList.map(item => (
                <TableRow key={item.id} hover>
                  <TableCell>{formatWaitTime(item.created_at)}</TableCell>
                  <TableCell fontWeight="bold">{item.patient_name}</TableCell>
                  <TableCell align="right"><Button variant="contained" onClick={() => handleSelectPatient(item)}>Dispense Meds</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100vh' }}>
          <PatientContextBar />
          <Container maxWidth="lg" sx={{ py: 3 }}>
            <Stack spacing={2} sx={{ mb: 4 }}>
                {patientVitals?.allergies && <Alert severity="error" variant="filled" icon={<WarningIcon />}><strong>ALLERGY ALERT:</strong> {patientVitals.allergies}</Alert>}
                {patientVitals?.is_pregnant === 'yes' && <Alert severity="warning" variant="filled" icon={<ErrorIcon />}><strong>PREGNANCY ALERT:</strong> Patient is {patientVitals.pregnancy_months} months pregnant.</Alert>}
                {patientVitals?.tobacco_use !== 'none' && <Alert severity="info" variant="outlined"><strong>Substance History:</strong> {patientVitals.tobacco_use.toUpperCase()}</Alert>}
            </Stack>

            <Paper sx={{ p: 4, borderRadius: 5 }}>
              <Typography variant="h5" fontWeight="900" mb={3}>Dispensing Verification</Typography>
              <Stack spacing={2}>
                {prescriptions.map((med, idx) => (
                  <Card key={idx} variant="outlined" sx={{ borderRadius: 4, border: checklist[med.id] ? '2px solid #10b981' : '1px solid #e2e8f0' }}>
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={8}>
                          <Typography variant="h6" color="primary" fontWeight="bold">{med.medicationName}</Typography>
                          <Typography variant="body1">{med.dosageValue}{med.dosageUnit} x {med.quantity} Total</Typography>
                          {med.instructions && (
                            <Box sx={{ mt: 1, p: 2, bgcolor: '#f0fdf4', borderRadius: 2, borderLeft: '4px solid #10b981' }}>
                                <Typography variant="caption" fontWeight="900" color="#166534">NOTES:</Typography>
                                <Typography variant="body2">{med.instructions}</Typography>
                            </Box>
                          )}
                        </Grid>
                        <Grid item xs={4} textAlign="right">
                          <Button 
                            variant={checklist[med.id] ? "contained" : "outlined"} 
                            color="success" 
                            onClick={() => setChecklist({...checklist, [med.id]: !checklist[med.id]})}
                          >
                            {checklist[med.id] ? "VERIFIED" : "VERIFY"}
                          </Button>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
              <Divider sx={{ my: 4 }} />
              <Button fullWidth size="large" variant="contained" color="success" sx={{ height: 75, fontWeight: 900, borderRadius: 4 }} onClick={handleFinalize}>COMPLETE & FINALIZE VISIT</Button>
            </Paper>
          </Container>
        </Box>
      )}
    </StationLayout>
  );
};
export default PharmacyStation;