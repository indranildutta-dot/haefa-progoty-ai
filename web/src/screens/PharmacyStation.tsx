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
  FormGroup
} from '@mui/material';
import MedicationIcon from '@mui/icons-material/Medication';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { 
  getDiagnosisByEncounter, 
  getPrescriptionByEncounter, 
  markPrescriptionDispensed 
} from '../services/encounterService';
import { QueueItem, DiagnosisRecord, PrescriptionRecord } from '../types';
import { useAppStore } from '../store/useAppStore';

interface PharmacyStationProps {
  countryId: string;
}

const PharmacyStation: React.FC<PharmacyStationProps> = ({ countryId }) => {
  const { notify } = useAppStore();
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [currentDiagnosis, setCurrentDiagnosis] = useState<DiagnosisRecord | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<PrescriptionRecord | null>(null);
  const [openDispenseDialog, setOpenDispenseDialog] = useState(false);
  const [dispensedItems, setDispensedItems] = useState<Record<number, boolean>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
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
      await markPrescriptionDispensed(currentPrescription.id!);
      await updateQueueStatus(selectedItem.id!, 'COMPLETED' as any);
      
      notify(`Medication dispensed for ${selectedItem.patient_name}`, 'success');
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
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="800" color="primary" gutterBottom>
          Pharmacy Station
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Dispense prescribed medications to patients.
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 9 }}>
          <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <MedicationIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="700">Prescriptions Waiting for Dispensing</Typography>
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
                            <Chip label="Normal" size="small" color="default" sx={{ fontWeight: 700 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Button variant="contained" size="small" onClick={() => handleOpenDispense(item)}>
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
          <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom fontWeight="bold">Dispensed Today</Typography>
              <Typography variant="h4" fontWeight="800">42</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dispensing Dialog */}
      <Dialog open={openDispenseDialog} onClose={() => setOpenDispenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: '800', pb: 0 }}>Dispense Medication: {selectedItem?.patient_name}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box mb={3} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Diagnosis</Typography>
            <Typography variant="body1" fontWeight="medium">{currentDiagnosis?.diagnosis || 'N/A'}</Typography>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prescribed Medications</Typography>
          
          {currentPrescription?.prescriptions && currentPrescription.prescriptions.length > 0 ? (
            <FormGroup>
              {currentPrescription.prescriptions.map((p, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2, mb: 1, borderRadius: 2, bgcolor: dispensedItems[index] ? 'success.50' : 'white', borderColor: dispensedItems[index] ? 'success.main' : 'divider' }}>
                  <FormControlLabel
                    control={<Checkbox checked={!!dispensedItems[index]} onChange={() => handleToggleDispense(index)} color="success" />}
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
          <Button variant="contained" onClick={handleCompleteDispensing} size="large" startIcon={<CheckCircleIcon />} disabled={!allDispensed} sx={{ fontWeight: 700, borderRadius: 2 }}>
            Complete & Finalize
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PharmacyStation;
