import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Grid, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Button, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert, Divider,
  Card, CardContent, Checkbox, FormControlLabel, FormGroup,
  Select, MenuItem, FormControl, InputLabel, TextField, Stack,
  IconButton, Tabs, Tab, Tooltip
} from '@mui/material';

// --- Icons (Fixed missing CloudUploadIcon) ---
import MedicationIcon from '@mui/icons-material/Medication';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

// --- Services & Logic ---
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

// --- Components ---
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
  const { isMobile, isTablet } = useResponsiveLayout();
  
  // State Management
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [currentDiagnosis, setCurrentDiagnosis] = useState<DiagnosisRecord | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<PrescriptionRecord | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentVitals, setCurrentVitals] = useState<VitalsRecord | null>(null);
  const [currentTriage, setCurrentTriage] = useState<TriageAssessment | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  
  const [openDispenseDialog, setOpenDispenseDialog] = useState(false);
  const [openBatchDialog, setOpenBatchDialog] = useState(false);
  const [dispensedQuantities, setDispensedQuantities] = useState<Record<number, number>>({});
  const [dispenseSummary, setDispenseSummary] = useState<any>(null);
  const [openSummaryDialog, setOpenSummaryDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Real-time Queue Subscription
  useEffect(() => {
    if (!selectedClinic?.id) return;
    const unsubscribe = subscribeToQueue('WAITING_FOR_PHARMACY', (items) => setWaitingList(items), (err) => notify(err.message, "error"));
    return () => unsubscribe();
  }, [selectedClinic]);

  // 2. Load Clinical Context for Fulfillment
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
    } catch (err) { notify("Critical: Patient data failed to load.", "error"); } 
    finally { setIsLoading(false); }
  };

  const handleFinalize = async () => {
    if (!currentPrescription || !selectedItem || !selectedClinic) return;
    try {
      const medsPayload = currentPrescription.prescriptions.map((p, i) => {
        const dispensed = dispensedQuantities[i] || 0;
        // SMART OVERRIDE Logic for Math Errors
        if (dispensed > (p.quantity || 0) && !window.confirm(`Alert: Dispensing ${dispensed} but record shows only ${p.quantity} prescribed. Proceed anyway?`)) {
          throw new Error("Cancelled for verification");
        }
        return { medication_id: p.medicationId, dosage: p.dosage, quantity: p.quantity || 0, dispensed_qty: dispensed };
      });
      const result = await dispenseMedication(selectedClinic.id, selectedItem.patient_id, selectedItem.encounter_id, medsPayload);
      setDispenseSummary(result); setOpenSummaryDialog(true);
      await updateQueueStatus(selectedItem.id!, 'COMPLETED' as any);
      setOpenDispenseDialog(false);
    } catch (err: any) { notify(err.message, "error"); }
  };

  const renderQueueItem = (item: QueueItem) => (
    <TableRow key={item.id} hover>
      <TableCell sx={{ fontWeight: 700 }}>{item.patient_name}</TableCell>
      <TableCell>
        <Chip label={item.triage_level || 'Stable'} size="small" color={item.triage_level === 'Emergency' ? 'error' : 'default'} />
      </TableCell>
      <TableCell align="right">
        <Button variant="contained" onClick={() => handleOpenDispense(item)} sx={{ borderRadius: 2 }}>Fulfill</Button>
      </TableCell>
    </TableRow>
  );

  return (
    <StationLayout title="Pharmacy Station" stationName="Pharmacy" showPatientContext={false}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="900" color="primary">PHARMACY OPERATIONS</Typography>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mt: 3 }}>
          <Tab label="Patient Queue" sx={{ fontWeight: 800 }} />
          <Tab label="Live Inventory" sx={{ fontWeight: 800 }} />
        </Tabs>
      </Box>

      {tabValue === 0 ? (
        <Grid container spacing={4}>
          <Grid item xs={12} lg={9}>
            <Paper sx={{ p: 4, borderRadius: 4, boxShadow: 'none', border: '1px solid #eee' }}>
              <Box display="flex" justifyContent="space-between" mb={4}>
                <Typography variant="h6" fontWeight="900">Dispensing Queue</Typography>
                <Stack direction="row" spacing={2}>
                  <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => setOpenBatchDialog(true)} sx={{ borderRadius: 2 }}>Batch Upload</Button>
                  <QrScannerModal onScan={async (t) => {
                    const p = await getPatientByQrToken(t);
                    const i = waitingList.find(w => w.patient_id === p?.id);
                    if (i) handleOpenDispense(i);
                  }} />
                </Stack>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>PATIENT</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>TRIAGE</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>ACTION</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {waitingList.length === 0 ? (
                      <TableRow><TableCell colSpan={3} align="center">Queue is empty.</TableCell></TableRow>
                    ) : (
                      waitingList.map(renderQueueItem)
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} lg={3}>
             <Card sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 4 }}>
                <CardContent>
                  <Typography variant="overline" sx={{ fontWeight: 800, opacity: 0.8 }}>ACTIVE QUEUE</Typography>
                  <Typography variant="h2" fontWeight="900">{waitingList.length}</Typography>
                </CardContent>
             </Card>
          </Grid>
        </Grid>
      ) : <InventoryView />}

      <Dialog open={openDispenseDialog} onClose={() => setOpenDispenseDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>FULFILLMENT SESSION: {selectedItem?.patient_name}</DialogTitle>
        <DialogContent dividers sx={{ p: 4 }}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Box sx={{ p: 3, bgcolor: '#f4f6f8', borderRadius: 3, mb: 3 }}>
                <Typography variant="caption" fontWeight="900" color="textSecondary">DIAGNOSIS</Typography>
                <Typography variant="h6" fontWeight="800" color="primary" gutterBottom>{currentDiagnosis?.diagnosis || 'N/A'}</Typography>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" fontWeight="900" color="textSecondary">VITALS LOG</Typography>
                <Typography variant="body2" display="block">BP: {currentVitals?.blood_pressure || '--'}</Typography>
                <Typography variant="body2" display="block">Pulse: {currentVitals?.heart_rate || '--'} bpm</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={7}>
              <Typography variant="subtitle2" fontWeight="900" color="primary" sx={{ mb: 2 }}>PRESCRIBED REGIMEN</Typography>
              {currentPrescription?.prescriptions.map((p, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body2" fontWeight="800">{p.medicationName}</Typography>
                    <Typography variant="caption" color="textSecondary">{p.dosage} | {p.frequency}</Typography>
                  </Box>
                  <TextField 
                    size="small" type="number" label="Dispensed"
                    value={dispensedQuantities[i] ?? ''} 
                    onChange={(e) => setDispensedQuantities({...dispensedQuantities, [i]: Number(e.target.value)})} 
                    sx={{ width: 100 }} 
                  />
                </Paper>
              ))}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 4 }}>
           <Button onClick={() => setOpenDispenseDialog(false)} sx={{ fontWeight: 700 }}>Cancel</Button>
           <Button variant="contained" onClick={handleFinalize} sx={{ fontWeight: 900, px: 6, borderRadius: 2 }}>Complete Session</Button>
        </DialogActions>
      </Dialog>
      
      <BatchEntry open={openBatchDialog} onClose={() => setOpenBatchDialog(false)} onSuccess={() => setOpenBatchDialog(false)} />
      
      <Dialog open={openSummaryDialog} onClose={() => setOpenSummaryDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>SESSION SUMMARY</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Medications updated successfully in clinic inventory.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button fullWidth variant="contained" onClick={() => setOpenSummaryDialog(false)} sx={{ fontWeight: 800 }}>Done</Button>
        </DialogActions>
      </Dialog>
    </StationLayout>
  );
};
export default PharmacyStation;