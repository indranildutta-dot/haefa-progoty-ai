import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  Paper, 
  Grid, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Button, 
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Container,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField
} from '@mui/material';
import MedicationIcon from '@mui/icons-material/Medication';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { 
  getDiagnosisByEncounter, 
  getPrescriptionByEncounter, 
  markPrescriptionDispensed 
} from '../services/encounterService';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { db } from "../firebase";
import { QueueItem, DiagnosisRecord, PrescriptionRecord } from '../types';
import { useAppStore } from '../store/useAppStore';

interface PharmacyStationProps {
  countryId: string;
}

const PharmacyStation: React.FC<PharmacyStationProps> = ({ countryId }) => {
  const { notify, selectedCountry, selectedClinic } = useAppStore();
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [currentDiagnosis, setCurrentDiagnosis] = useState<DiagnosisRecord | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<PrescriptionRecord | null>(null);
  const [openDispenseDialog, setOpenDispenseDialog] = useState(false);
  const [dispensedItems, setDispensedItems] = useState<Record<number, boolean>>({});
  const [dispensedCount, setDispensedCount] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pharmacyNote, setPharmacyNote] = useState('');
  const [pharmacyAction, setPharmacyAction] = useState<'DISPENSE' | 'HOLD' | 'CANCEL'>('DISPENSE');

  useEffect(() => {
    const fetchDispensedCount = async () => {
      try {
        if (!selectedCountry || !selectedClinic) return;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const q = query(
          collection(db, "prescriptions"),
          where("country_code", "==", selectedCountry.id),
          where("clinic_id", "==", selectedClinic.id),
          where("status", "==", "DISPENSED"),
          where("created_at", ">=", startOfDay)
        );
        const snapshot = await getDocs(q);
        setDispensedCount(snapshot.size);
      } catch (err) {
        console.error("Error fetching dispensed count:", err);
      }
    };
    fetchDispensedCount();
  }, [selectedCountry, selectedClinic]);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToQueue('WAITING_FOR_PHARMACY', (items) => {
      setWaitingList(items);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenDispense = async (item: QueueItem) => {
    setSelectedItem(item);
    try {
      const [diagnosis, prescription] = await Promise.all([
        getDiagnosisByEncounter(item.encounter_id),
        getPrescriptionByEncounter(item.encounter_id)
      ]);
      setCurrentDiagnosis(diagnosis);
      setCurrentPrescription(prescription);
      setDispensedItems({});
      setPharmacyNote('');
      setPharmacyAction('DISPENSE');
      setOpenDispenseDialog(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load prescription data.");
    }
  };

  const handleToggleDispense = (index: number) => {
    setDispensedItems(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCompleteDispensing = async () => {
    if (!currentPrescription || !selectedItem) return;
    try {
      if (pharmacyAction === 'DISPENSE') {
        await markPrescriptionDispensed(currentPrescription.id!);
        await updateQueueStatus(selectedItem.id!, 'COMPLETED' as any);
        notify(`Medication dispensed for ${selectedItem.patient_name}`, 'success');
      } else if (pharmacyAction === 'HOLD') {
        await updateQueueStatus(selectedItem.id!, 'WAITING_FOR_PHARMACY'); // Keep in queue
        notify(`Prescription for ${selectedItem.patient_name} put on hold: ${pharmacyNote}`, 'info');
      } else if (pharmacyAction === 'CANCEL') {
        await updateQueueStatus(selectedItem.id!, 'COMPLETED' as any); // Or a specific CANCELLED status if supported
        notify(`Prescription for ${selectedItem.patient_name} cancelled: ${pharmacyNote}`, 'warning');
      }
      
      setOpenDispenseDialog(false);
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to complete dispensing.");
      notify("Failed to complete dispensing", "error");
    }
  };

  const allDispensed = currentPrescription?.prescriptions?.every((_, i) => dispensedItems[i]) ?? false;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="900" color="warning.main" gutterBottom sx={{ textTransform: 'uppercase' }}>
          Pharmacy Station
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Dispense prescribed medications to patients.
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 9 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <MedicationIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="800">Prescriptions Waiting for Dispensing</Typography>
              </Box>
              
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'grey.50' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Patient Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Wait Time</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {waitingList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography color="textSecondary" sx={{ py: 4 }}>No patients waiting for medication.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      waitingList.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_name || item.patient_id}</TableCell>
                          <TableCell>{item.created_at ? Math.floor((Date.now() - item.created_at.toDate().getTime()) / 60000) : '??'} mins</TableCell>
                          <TableCell>
                            <Chip 
                              label={item.triage_level?.toUpperCase() || 'STANDARD'} 
                              size="small" 
                              color={
                                item.triage_level === 'emergency' ? 'error' :
                                item.triage_level === 'urgent' ? 'warning' :
                                item.triage_level === 'low' ? 'success' : 'default'
                              }
                              sx={{ fontWeight: 700, borderRadius: 1 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Button variant="contained" size="small" onClick={() => handleOpenDispense(item)} sx={{ borderRadius: 2 }}>
                              Dispense
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: 'bold', textTransform: 'uppercase' }}>Dispensed Today</Typography>
              <Typography variant="h4" fontWeight="800">{dispensedCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dispensing Dialog */}
      <Dialog open={openDispenseDialog} onClose={() => setOpenDispenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: '900', pb: 0, textTransform: 'uppercase' }}>Dispense Medication: {selectedItem?.patient_name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box mb={3} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnosis</Typography>
            <Typography variant="body1" fontWeight="medium">{currentDiagnosis?.diagnosis || 'N/A'}</Typography>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ mb: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Action</InputLabel>
              <Select value={pharmacyAction} onChange={(e) => setPharmacyAction(e.target.value as any)} label="Action">
                <MenuItem value="DISPENSE">Dispense</MenuItem>
                <MenuItem value="HOLD">Put on Hold</MenuItem>
                <MenuItem value="CANCEL">Cancel</MenuItem>
              </Select>
            </FormControl>
            <TextField 
              fullWidth 
              label="Pharmacy Note" 
              value={pharmacyNote} 
              onChange={(e) => setPharmacyNote(e.target.value)} 
              multiline
              rows={2}
            />
          </Box>

          <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prescribed Medications</Typography>
          
          {currentPrescription?.prescriptions && currentPrescription.prescriptions.length > 0 ? (
            <FormGroup>
              {currentPrescription.prescriptions.map((p, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2, mb: 1, borderRadius: 2, bgcolor: dispensedItems[index] ? 'success.50' : 'white', borderColor: dispensedItems[index] ? 'success.main' : 'divider' }}>
                  <FormControlLabel
                    control={<Checkbox checked={!!dispensedItems[index]} onChange={() => handleToggleDispense(index)} color="success" disabled={pharmacyAction !== 'DISPENSE'} />}
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="bold">{p.medicationName}</Typography>
                        <Typography variant="body2" color="textSecondary">{p.dosage} | {p.frequency} | {p.duration}</Typography>
                        {p.instructions && <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>Note: {p.instructions}</Typography>}
                      </Box>
                    }
                  />
                </Paper>
              ))}
            </FormGroup>
          ) : (
            <Typography color="textSecondary">No medications prescribed.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDispenseDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCompleteDispensing} size="large" startIcon={<CheckCircleIcon />} disabled={pharmacyAction === 'DISPENSE' && !allDispensed} sx={{ fontWeight: 700, borderRadius: 2 }}>
            {pharmacyAction === 'DISPENSE' ? 'Complete & Finalize' : 'Submit Action'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PharmacyStation;
