import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Grid, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Button, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, Divider,
  Card, CardContent, Checkbox, FormControlLabel, FormGroup,
  Select, MenuItem, FormControl, InputLabel, TextField, Stack,
  IconButton, Tabs, Tab, Tooltip
} from '@mui/material';

// Icons
import MedicationIcon from '@mui/icons-material/Medication';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

// Services
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { 
  getDiagnosisByEncounter, getPrescriptionByEncounter, 
  getVitalsByEncounter, getEncounterById
} from '../services/encounterService';
import { getTriageAssessmentByEncounter } from '../services/triageService';
import { getPatientById } from '../services/patientService';
import { getPatientByQrToken } from '../services/qrService';
import { dispenseMedication } from '../services/pharmacyService';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Components
import { QueueItem, DiagnosisRecord, PrescriptionRecord, Patient, VitalsRecord, TriageAssessment, Encounter } from '../types';
import { useAppStore } from '../store/useAppStore';
import QrScannerModal from '../components/QrScannerModal';
import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import PrescriptionPrintView from '../components/PrescriptionPrintView';
import InventoryView from '../components/InventoryView';
import BatchEntry from '../components/BatchEntry';

const PharmacyStation: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { notify, selectedClinic } = useAppStore();
  const { isMobile } = useResponsiveLayout();
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  
  // Clinical States
  const [currentDiagnosis, setCurrentDiagnosis] = useState<DiagnosisRecord | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<PrescriptionRecord | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentVitals, setCurrentVitals] = useState<VitalsRecord | null>(null);
  const [currentTriage, setCurrentTriage] = useState<TriageAssessment | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  
  // Dialog States
  const [openDispenseDialog, setOpenDispenseDialog] = useState(false);
  const [openBatchDialog, setOpenBatchDialog] = useState(false);
  const [dispensedQuantities, setDispensedQuantities] = useState<Record<number, number>>({});
  const [dispensedCount, setDispensedCount] = useState(0);
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!selectedClinic?.id) return;
    const unsubscribe = subscribeToQueue('WAITING_FOR_PHARMACY', (items) => setWaitingList(items), (err) => notify(err.message, "error"));
    return () => unsubscribe();
  }, [selectedClinic]);

  const handleOpenDispense = async (item: QueueItem) => {
    setSelectedItem(item); setIsLoading(true);
    try {
      const [diag, pres, pat, vit, tri, enc] = await Promise.all([
        getDiagnosisByEncounter(item.encounter_id), getPrescriptionByEncounter(item.encounter_id),
        getPatientById(item.patient_id), getVitalsByEncounter(item.encounter_id),
        getTriageAssessmentByEncounter(item.encounter_id), getEncounterById(item.encounter_id)
      ]);
      setCurrentDiagnosis(diag); setCurrentPrescription(pres); setCurrentPatient(pat);
      setCurrentVitals(vit); setCurrentTriage(tri); setCurrentEncounter(enc);
      
      const qtys: Record<number, number> = {};
      pres?.prescriptions.forEach((p, i) => qtys[i] = p.quantity || 0);
      setDispensedQuantities(qtys);
      setOpenDispenseDialog(true);
    } catch (err) { notify("Error loading clinical data", "error"); } 
    finally { setIsLoading(false); }
  };

  const handleFinalize = async () => {
    if (!currentPrescription || !selectedItem || !selectedClinic) return;
    try {
      const medsPayload = currentPrescription.prescriptions.map((p, i) => {
        const dispensed = dispensedQuantities[i] || 0;
        if (dispensed > (p.quantity || 0) && !window.confirm(`Dispensing more than prescribed. Proceed?`)) throw new Error("Cancelled");
        return { medication_id: p.medicationId, dosage: p.dosage, quantity: p.quantity || 0, dispensed_qty: dispensed };
      });
      await dispenseMedication(selectedClinic.id, selectedItem.patient_id, selectedItem.encounter_id, medsPayload);
      await updateQueueStatus(selectedItem.id!, 'COMPLETED' as any);
      setOpenDispenseDialog(false);
      notify("Dispensing session complete", "success");
    } catch (err: any) { notify(err.message, "error"); }
  };

  return (
    <StationLayout title="Pharmacy" stationName="Pharmacy" showPatientContext={false}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="900" color="primary">PHARMACY STATION</Typography>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mt: 2 }}>
          <Tab label="Waiting Queue" sx={{ fontWeight: 700 }} />
          <Tab label="Inventory" sx={{ fontWeight: 700 }} />
        </Tabs>
      </Box>

      {tabValue === 0 ? (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={9}>
            <Paper sx={{ p: 4, borderRadius: 4 }}>
              <Box display="flex" justifyContent="space-between" mb={4}>
                <Typography variant="h6" fontWeight="900">Current Queue</Typography>
                <Stack direction="row" spacing={2}>
                  <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => setOpenBatchDialog(true)} sx={{ borderRadius: 2 }}>Batch Update</Button>
                  <QrScannerModal onScan={async (t) => {
                    const p = await getPatientByQrToken(t);
                    const i = waitingList.find(w => w.patient_id === p?.id);
                    if (i) handleOpenDispense(i);
                  }} />
                </Stack>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>PATIENT</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>TRIAGE</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>ACTION</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {waitingList.map(item => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ fontWeight: 700 }}>{item.patient_name}</TableCell>
                        <TableCell><Chip label={item.triage_level || 'Stable'} size="small" /></TableCell>
                        <TableCell align="right">
                          <Button variant="contained" onClick={() => handleOpenDispense(item)} sx={{ borderRadius: 2 }}>Dispense</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} lg={3}>
            <Card sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 4 }}>
              <CardContent><Typography variant="overline" sx={{ fontWeight: 800 }}>SERVED TODAY</Typography><Typography variant="h2" fontWeight="900">{dispensedCount}</Typography></CardContent>
            </Card>
          </Grid>
        </Grid>
      ) : <InventoryView />}

      <Dialog open={openDispenseDialog} onClose={() => setOpenDispenseDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>DISPENSING: {selectedItem?.patient_name}</DialogTitle>
        <DialogContent dividers sx={{ p: 4 }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Box sx={{ p: 3, bgcolor: '#f4f6f8', borderRadius: 3, mb: 3 }}>
                <Typography variant="caption" fontWeight="900" color="textSecondary">DIAGNOSIS</Typography>
                <Typography variant="h6" fontWeight="800" color="primary">{currentDiagnosis?.diagnosis || 'N/A'}</Typography>
              </Box>
              <Typography variant="caption" fontWeight="900">VITALS</Typography>
              <Typography variant="body2">BP: {currentVitals?.blood_pressure || '--'}</Typography>
              <Typography variant="body2">Pulse: {currentVitals?.heart_rate || '--'}</Typography>
            </Grid>
            <Grid item xs={12} md={7}>
              <Typography variant="subtitle2" fontWeight="900" color="primary" sx={{ mb: 2 }}>MEDICATIONS</Typography>
              {currentPrescription?.prescriptions.map((p, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box><Typography variant="body2" fontWeight="800">{p.medicationName}</Typography><Typography variant="caption">{p.dosage} | {p.frequency}</Typography></Box>
                  <TextField size="small" type="number" value={dispensedQuantities[i] ?? ''} onChange={(e) => setDispensedQuantities({...dispensedQuantities, [i]: Number(e.target.value)})} sx={{ width: 90 }} />
                </Paper>
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}><Button onClick={() => setOpenDispenseDialog(false)} sx={{ fontWeight: 700 }}>Close</Button><Button variant="contained" onClick={handleFinalize} sx={{ fontWeight: 900, px: 5, borderRadius: 2 }}>Complete Session</Button></DialogActions>
      </Dialog>
      <BatchEntry open={openBatchDialog} onClose={() => setOpenBatchDialog(false)} onSuccess={() => setOpenBatchDialog(false)} />
    </StationLayout>
  );
};
export default PharmacyStation;