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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Stack,
  IconButton
} from '@mui/material';
import MedicationIcon from '@mui/icons-material/Medication';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { 
  getDiagnosisByEncounter, 
  getPrescriptionByEncounter, 
  markPrescriptionDispensed 
} from '../services/encounterService';
import { getPatientByQrToken } from '../services/qrService';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { db } from "../firebase";
import { QueueItem, DiagnosisRecord, PrescriptionRecord } from '../types';
import { useAppStore } from '../store/useAppStore';
import QrScannerModal from '../components/QrScannerModal';
import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface PharmacyStationProps {
  countryId: string;
}

const PharmacyStation: React.FC<PharmacyStationProps> = ({ countryId }) => {
  const { notify, selectedCountry, selectedClinic } = useAppStore();
  const { isMobile, isTablet } = useResponsiveLayout();
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

  const renderQueueItem = (item: QueueItem) => {
    const waitTime = item.created_at ? Math.floor((Date.now() - item.created_at.toDate().getTime()) / 60000) : 0;
    const waitTimeColor = waitTime < 15 ? 'success.main' : waitTime < 30 ? 'warning.main' : 'error.main';

    if (isMobile || isTablet) {
      return (
        <Card key={item.id} sx={{ mb: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
              <Box display="flex" alignItems="center">
                <PersonIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight="700">
                  {item.patient_name || item.patient_id}
                </Typography>
              </Box>
              <Chip 
                label={item.triage_level?.toUpperCase() || 'STANDARD'} 
                size="small" 
                color={
                  item.triage_level === 'emergency' ? 'error' :
                  item.triage_level === 'urgent' ? 'warning' :
                  item.triage_level === 'low' ? 'success' : 'default'
                }
                sx={{ fontWeight: 700, borderRadius: 1, height: 24 }}
              />
            </Box>
            
            <Stack direction="row" spacing={2} mb={2}>
              <Box display="flex" alignItems="center">
                <AccessTimeIcon sx={{ color: 'text.secondary', mr: 0.5, fontSize: 16 }} />
                <Typography variant="body2" color="text.secondary">
                  {item.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center">
                <Typography variant="body2" sx={{ color: waitTimeColor, fontWeight: 'bold' }}>
                  {waitTime} mins wait
                </Typography>
              </Box>
            </Stack>
            
            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => handleOpenDispense(item)}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              Dispense Medication
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <TableRow key={item.id} hover>
        <TableCell sx={{ fontWeight: 'medium' }}>{item.patient_name || item.patient_id}</TableCell>
        <TableCell>{item.created_at?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ color: waitTimeColor, fontWeight: 'bold' }}>
            {waitTime} mins
          </Typography>
        </TableCell>
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
    );
  };

  return (
    <StationLayout
      title="Medication Dispensing"
      stationName="Pharmacy"
      showPatientContext={false}
    >
      <Box sx={{ mb: isMobile ? 2 : 4 }}>
        <Typography variant="subtitle1" color="text.secondary">
          Dispense prescribed medications to patients.
        </Typography>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: 3 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{errorMsg}</Alert>}

      <Grid container spacing={isMobile ? 2 : 3}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box display="flex" alignItems="center">
                  <MedicationIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6" fontWeight="800">
                    {isMobile ? 'Queue' : 'Prescriptions Waiting'}
                  </Typography>
                </Box>
                <QrScannerModal onScan={async (token) => {
                  const patient = await getPatientByQrToken(token);
                  if (patient) {
                    const item = waitingList.find(i => i.patient_id === patient.id);
                    if (item) {
                      handleOpenDispense(item);
                    } else {
                      notify("Patient not found in queue.", "error");
                    }
                  } else {
                    notify("Patient not found.", "error");
                  }
                }} />
              </Box>
              
              {isMobile || isTablet ? (
                <Box>
                  {waitingList.length === 0 ? (
                    <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                      No patients waiting for medication.
                    </Typography>
                  ) : (
                    waitingList.map(renderQueueItem)
                  )}
                </Box>
              ) : (
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Table>
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Patient Name</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Registration Time</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Wait Time</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {waitingList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography color="textSecondary" sx={{ py: 4 }}>No patients waiting for medication.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        waitingList.map(renderQueueItem)
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 3 }}>
          <Card sx={{ 
            borderRadius: 3, 
            border: '1px solid', 
            borderColor: 'divider', 
            boxShadow: 'none', 
            bgcolor: 'warning.light', 
            color: 'warning.contrastText',
            height: '100%'
          }}>
            <CardContent sx={{ textAlign: { xs: 'center', lg: 'left' } }}>
              <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: 'bold', textTransform: 'uppercase' }}>
                Dispensed Today
              </Typography>
              <Typography variant="h3" fontWeight="800">
                {dispensedCount}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 1 }}>
                Patients served since morning
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dispensing Dialog */}
      <Dialog 
        open={openDispenseDialog} 
        onClose={() => setOpenDispenseDialog(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontWeight: '900', pb: 0, textTransform: 'uppercase', fontSize: { xs: '1.1rem', md: '1.25rem' } }}>
          Dispense: {selectedItem?.patient_name}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box mb={3} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="subtitle2" color="textSecondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>Diagnosis</Typography>
            <Typography variant="body1" fontWeight="medium">{currentDiagnosis?.diagnosis || 'N/A'}</Typography>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ mb: 3 }}>
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
              placeholder="Add any internal notes here..."
            />
          </Box>

          <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
            Prescribed Medications
          </Typography>
          
          {currentPrescription?.prescriptions && currentPrescription.prescriptions.length > 0 ? (
            <FormGroup>
              {currentPrescription.prescriptions.map((p, index) => (
                <Paper 
                  key={index} 
                  variant="outlined" 
                  sx={{ 
                    p: 2, 
                    mb: 1.5, 
                    borderRadius: 2, 
                    bgcolor: dispensedItems[index] ? 'success.50' : 'white', 
                    borderColor: dispensedItems[index] ? 'success.main' : 'divider',
                    transition: 'all 0.2s'
                  }}
                >
                  <FormControlLabel
                    sx={{ width: '100%', m: 0 }}
                    control={
                      <Checkbox 
                        checked={!!dispensedItems[index]} 
                        onChange={() => handleToggleDispense(index)} 
                        color="success" 
                        disabled={pharmacyAction !== 'DISPENSE'} 
                      />
                    }
                    label={
                      <Box sx={{ ml: 1 }}>
                        <Typography variant="body1" fontWeight="bold">{p.medicationName}</Typography>
                        <Typography variant="body2" color="textSecondary">{p.dosage} | {p.frequency} | {p.duration}</Typography>
                        {p.instructions && (
                          <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5, color: 'primary.main' }}>
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
        <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
          <Button onClick={() => setOpenDispenseDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCompleteDispensing} 
            startIcon={<CheckCircleIcon />} 
            disabled={pharmacyAction === 'DISPENSE' && !allDispensed} 
            sx={{ fontWeight: 700, borderRadius: 2, px: 3 }}
          >
            {pharmacyAction === 'DISPENSE' ? 'Finalize Dispensing' : 'Submit Action'}
          </Button>
        </DialogActions>
      </Dialog>
    </StationLayout>
  );
};

export default PharmacyStation;
