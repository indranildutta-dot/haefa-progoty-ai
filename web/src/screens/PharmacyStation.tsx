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
import { getLatestEncounter, updateEncounterStatus } from '../services/encounterService';
import { QueueItem, Encounter, Prescription } from '../types';

interface PharmacyStationProps {
  countryId: string;
}

const PharmacyStation: React.FC<PharmacyStationProps> = ({ countryId }) => {
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  const [openDispenseDialog, setOpenDispenseDialog] = useState(false);
  const [dispensedItems, setDispensedItems] = useState<Record<number, boolean>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToQueue('WAITING_FOR_PHARMACY', countryId, (items) => {
      setWaitingList(items);
    });
    return () => unsubscribe();
  }, [countryId]);

  const handleOpenDispense = async (item: QueueItem) => {
    setSelectedItem(item);
    try {
      const encounter = await getLatestEncounter(item.patient_id);
      setCurrentEncounter(encounter);
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
    if (!currentEncounter || !selectedItem) return;
    try {
      await updateEncounterStatus(currentEncounter.id!, 'COMPLETED' as any);
      await updateQueueStatus(selectedItem.id!, 'COMPLETED' as any);
      
      setSuccessMsg(`Medication dispensed. Encounter completed.`);
      setOpenDispenseDialog(false);
      setSelectedItem(null);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to complete dispensing.");
    }
  };

  const allDispensed = currentEncounter?.prescriptions?.every((_, i) => dispensedItems[i]) ?? false;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Pharmacy Station
      </Typography>

      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 9 }}>
          <Paper sx={{ p: 3, borderRadius: 2 }}>
            <Box display="flex" alignItems="center" mb={2}>
              <MedicationIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Prescriptions Waiting for Dispensing</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Patient Name</TableCell>
                    <TableCell>Wait Time</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {waitingList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography color="textSecondary" sx={{ py: 4 }}>
                          No patients waiting for medication.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    waitingList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_id}</TableCell>
                        <TableCell>
                          {item.created_at ? Math.floor((Date.now() - item.created_at.toDate().getTime()) / 60000) : '??'} mins
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label="Normal" 
                            size="small" 
                            color="default" 
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button 
                            variant="contained" 
                            size="small" 
                            onClick={() => handleOpenDispense(item)}
                          >
                            Dispense
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ borderRadius: 2, mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" color="textSecondary">Dispensed Today</Typography>
              <Typography variant="h3" fontWeight="bold">42</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dispensing Dialog */}
      <Dialog open={openDispenseDialog} onClose={() => setOpenDispenseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          Dispense Medication
        </DialogTitle>
        <DialogContent dividers>
          <Box mb={3}>
            <Typography variant="subtitle2" color="textSecondary">Diagnosis</Typography>
            <Typography variant="body1" fontWeight="medium">{currentEncounter?.diagnosis || 'N/A'}</Typography>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" color="primary" gutterBottom fontWeight="bold">
            Prescribed Medications
          </Typography>
          
          {currentEncounter?.prescriptions && currentEncounter.prescriptions.length > 0 ? (
            <FormGroup>
              {currentEncounter.prescriptions.map((p, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2, mb: 1, bgcolor: dispensedItems[index] ? '#f1f8e9' : 'white' }}>
                  <FormControlLabel
                    control={
                      <Checkbox 
                        checked={!!dispensedItems[index]} 
                        onChange={() => handleToggleDispense(index)} 
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight="bold">{p.medicationName}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {p.dosage} | {p.frequency} | {p.duration}
                        </Typography>
                        {p.instructions && (
                          <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
                            Note: {p.instructions}
                          </Typography>
                        )}
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
          <Button 
            variant="contained" 
            onClick={handleCompleteDispensing} 
            size="large"
            startIcon={<CheckCircleIcon />}
            disabled={!allDispensed}
          >
            Complete & Finalize
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PharmacyStation;
