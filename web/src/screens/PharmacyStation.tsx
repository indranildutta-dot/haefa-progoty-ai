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
  IconButton,
  Tabs,
  Tab
} from '@mui/material';

// Icons
import MedicationIcon from '@mui/icons-material/Medication';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// Services & Context
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { 
  getDiagnosisByEncounter, 
  getPrescriptionByEncounter, 
  getVitalsByEncounter,
  getEncounterById
} from '../services/encounterService';
import { getTriageAssessmentByEncounter } from '../services/triageService';
import { getPatientById } from '../services/patientService';
import { getPatientByQrToken } from '../services/qrService';
import { dispenseMedication } from '../services/pharmacyService';

// Firestore
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { db } from "../firebase";

// Components & Hooks
import { QueueItem, DiagnosisRecord, PrescriptionRecord, Patient, VitalsRecord, TriageAssessment, Encounter } from '../types';
import { useAppStore } from '../store/useAppStore';
import QrScannerModal from '../components/QrScannerModal';
import StationLayout from '../components/StationLayout';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import PrescriptionPrintView from '../components/PrescriptionPrintView';
import InventoryView from '../components/InventoryView';
import BatchEntry from '../components/BatchEntry';

interface PharmacyStationProps {
  countryId: string;
}

const PharmacyStation: React.FC<PharmacyStationProps> = ({ countryId }) => {
  const { notify, selectedCountry, selectedClinic, userProfile } = useAppStore();
  const { isMobile, isTablet } = useResponsiveLayout();
  
  // -- Queue & Permissions State --
  const [waitingList, setWaitingList] = useState<QueueItem[]>([]);
  const [permissionError, setPermissionError] = useState(false);
  
  // -- Clinical Context State --
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [currentDiagnosis, setCurrentDiagnosis] = useState<DiagnosisRecord | null>(null);
  const [currentPrescription, setCurrentPrescription] = useState<PrescriptionRecord | null>(null);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [currentVitals, setCurrentVitals] = useState<VitalsRecord | null>(null);
  const [currentTriage, setCurrentTriage] = useState<TriageAssessment | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  
  // -- Dispensing Transaction State --
  const [openDispenseDialog, setOpenDispenseDialog] = useState(false);
  const [openBatchDialog, setOpenBatchDialog] = useState(false);
  const [dispensedItems, setDispensedItems] = useState<Record<number, boolean>>({});
  const [dispensedQuantities, setDispensedQuantities] = useState<Record<number, number>>({});
  const [dispenseSummary, setDispenseSummary] = useState<any>(null);
  const [openSummaryDialog, setOpenSummaryDialog] = useState(false);
  
  // -- UI Feedback & Controls --
  const [dispensedCount, setDispensedCount] = useState(0);
  const [pharmacyNote, setPharmacyNote] = useState('');
  const [pharmacyAction, setPharmacyAction] = useState<'DISPENSE' | 'HOLD' | 'CANCEL'>('DISPENSE');
  const [returnDate, setReturnDate] = useState<string>('');
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Hook: Fetch Daily Dispensing Statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!selectedCountry || !selectedClinic || !userProfile?.isApproved) return;
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const q = query(
          collection(db, "prescriptions"),
          where("clinic_id", "==", selectedClinic.id),
          where("status", "==", "DISPENSED"),
          where("created_at", ">=", startOfDay)
        );
        const snapshot = await getDocs(q);
        setDispensedCount(snapshot.size);
      } catch (err) {
        console.error("Error fetching daily stats:", err);
      }
    };
    fetchStats();
  }, [selectedCountry, selectedClinic, userProfile]);

  // 2. Hook: Real-time Listener for the Pharmacy Queue
  useEffect(() => {
    if (!selectedClinic || !userProfile?.isApproved) return;

    const unsubscribe = subscribeToQueue('WAITING_FOR_PHARMACY', (items) => {
      setWaitingList(items);
      setPermissionError(false);
    }, (error) => {
      if (error.message.includes('permission-denied')) {
        setPermissionError(true);
      }
    });
    return () => unsubscribe();
  }, [selectedClinic, userProfile]);

  // 3. Logic: Fetch Full Clinical Context for Selection
  const handleOpenDispense = async (item: QueueItem) => {
    setSelectedItem(item);
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      // Parallel fetch for speed - critical for high-volume clinics
      const [diag, pres, pat, vit, tri, enc] = await Promise.all([
        getDiagnosisByEncounter(item.encounter_id),
        getPrescriptionByEncounter(item.encounter_id),
        getPatientById(item.patient_id),
        getVitalsByEncounter(item.encounter_id),
        getTriageAssessmentByEncounter(item.encounter_id),
        getEncounterById(item.encounter_id)
      ]);
      
      setCurrentDiagnosis(diag);
      setCurrentPrescription(pres);
      setCurrentPatient(pat);
      setCurrentVitals(vit);
      setCurrentTriage(tri);
      setCurrentEncounter(enc);
      
      // Setup initial dispensing quantities based on prescription
      const initialQtys: Record<number, number> = {};
      pres?.prescriptions.forEach((p, idx) => {
        initialQtys[idx] = p.quantity || 0;
      });
      
      setDispensedQuantities(initialQtys);
      setDispensedItems({});
      setPharmacyNote('');
      setReturnDate('');
      setPharmacyAction('DISPENSE');
      setOpenDispenseDialog(true);
    } catch (err) {
      console.error("Critical error loading patient context:", err);
      setErrorMsg("Failed to load patient records. Check internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDispense = (index: number) => {
    setDispensedItems(prev => ({ 
      ...prev, 
      [index]: !prev[index] 
    }));
  };

  const handleQtyChange = (index: number, qty: number) => {
    setDispensedQuantities(prev => ({ 
      ...prev, 
      [index]: qty 
    }));
  };

  // 4. Logic: Finalize Dispensing & Handle IOUs
  const handleCompleteDispensing = async () => {
    if (!currentPrescription || !selectedItem || !selectedClinic) return;
    
    setIsLoading(true);
    try {
      if (pharmacyAction === 'DISPENSE') {
        const medsPayload = currentPrescription.prescriptions.map((p, idx) => {
          const dispensed = dispensedQuantities[idx] || 0;
          
          // Safety Check: Prevent over-dispensing beyond prescribed amount
          if (dispensed > (p.quantity || 0)) {
            throw new Error(`Dispensed quantity for ${p.medicationName} exceeds doctor's order.`);
          }
          
          return {
            medication_id: p.medicationId,
            dosage: p.dosage,
            quantity: p.quantity || 0,
            dispensed_qty: dispensed
          };
        });

        // Determine if any medicine resulted in a shortfall
        const hasShortfall = medsPayload.some(m => m.dispensed_qty < m.quantity);
        
        const result = await dispenseMedication(
          selectedClinic.id, 
          selectedItem.patient_id, 
          selectedItem.encounter_id, 
          medsPayload, 
          hasShortfall ? returnDate : undefined
        );
        
        setDispenseSummary(result);
        setOpenSummaryDialog(true);
        
        // Mark station as completed in the queue
        await updateQueueStatus(selectedItem.id!, 'COMPLETED' as any);
        notify(`Successfully dispensed to ${selectedItem.patient_name}`, 'success');
        
      } else if (pharmacyAction === 'HOLD') {
        await updateQueueStatus(selectedItem.id!, 'WAITING_FOR_PHARMACY');
        notify(`Patient ${selectedItem.patient_name} remains in queue (On Hold).`, 'info');
      } else if (pharmacyAction === 'CANCEL') {
        await updateQueueStatus(selectedItem.id!, 'COMPLETED' as any);
        notify(`Prescription cancelled for ${selectedItem.patient_name}.`, 'warning');
      }
      
      setOpenDispenseDialog(false);
      setSelectedItem(null);
    } catch (err: any) {
      console.error("Dispensing failed:", err);
      notify(err.message || "Dispensing error. Try again.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const allDispensed = currentPrescription?.prescriptions?.every((_, i) => dispensedItems[i]) ?? false;

  // -- UI Component: Responsive Queue Item --
  const renderQueueItem = (item: QueueItem) => {
    const arrivalTime = item.created_at?.toDate();
    const waitTime = arrivalTime ? Math.floor((Date.now() - arrivalTime.getTime()) / 60000) : 0;
    
    // Triage color logic for quick visual identification
    const getTriageColor = (level?: string) => {
      switch (level?.toLowerCase()) {
        case 'emergency': return 'error';
        case 'urgent': return 'warning';
        case 'stable': return 'success';
        default: return 'default';
      }
    };

    if (isMobile || isTablet) {
      return (
        <Card key={item.id} sx={{ mb: 2, borderRadius: 3, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
          <CardContent sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
              <Box display="flex" alignItems="center">
                <PersonIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight="700">
                  {item.patient_name}
                </Typography>
              </Box>
              <Chip 
                label={item.triage_level?.toUpperCase() || 'STANDARD'} 
                size="small" 
                color={getTriageColor(item.triage_level) as any}
                sx={{ fontWeight: 800, borderRadius: 1 }}
              />
            </Box>
            
            <Stack direction="row" spacing={2} mb={2}>
              <Box display="flex" alignItems="center">
                <AccessTimeIcon sx={{ color: 'text.secondary', mr: 0.5, fontSize: 16 }} />
                <Typography variant="body2" color="text.secondary">
                  {waitTime}m in queue
                </Typography>
              </Box>
            </Stack>
            
            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => handleOpenDispense(item)}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, minHeight: '48px' }}
            >
              Dispense Medication
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <TableRow key={item.id} hover>
        <TableCell sx={{ fontWeight: '600' }}>{item.patient_name}</TableCell>
        <TableCell>{arrivalTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ color: waitTime > 30 ? 'error.main' : 'text.primary', fontWeight: 'bold' }}>
            {waitTime} mins
          </Typography>
        </TableCell>
        <TableCell>
          <Chip 
            label={item.triage_level?.toUpperCase() || 'STANDARD'} 
            size="small" 
            color={getTriageColor(item.triage_level) as any}
            sx={{ fontWeight: 800 }}
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

  // --- Main Render Logic ---

  if (!selectedClinic) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="textSecondary">Please select a clinic to begin dispensing.</Typography>
      </Box>
    );
  }

  return (
    <StationLayout
      title="Medication Dispensing"
      stationName="Pharmacy"
      showPatientContext={false}
    >
      <Box sx={{ mb: isMobile ? 2 : 4 }}>
        <Typography variant="h4" fontWeight="900" sx={{ color: 'primary.main', mb: 1 }}>
          PHARMACY STATION
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Confirm prescriptions, manage stock levels, and dispense to patients.
        </Typography>
        
        <Tabs 
          value={tabValue} 
          onChange={(_, newValue) => setTabValue(newValue)} 
          sx={{ mt: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Dispensing Queue" sx={{ fontWeight: 700 }} />
          <Tab label="Inventory Management" sx={{ fontWeight: 700 }} />
        </Tabs>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{errorMsg}</Alert>}

      {tabValue === 0 ? (
        <Grid container spacing={3}>
          {/* Main Queue Content */}
          <Grid item xs={12} lg={9}>
            <Card sx={{ borderRadius: 3, border: '1px solid #efefef', boxShadow: 'none' }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                  <Box display="flex" alignItems="center">
                    <MedicationIcon color="primary" sx={{ mr: 1.5 }} />
                    <Typography variant="h6" fontWeight="800">Patients Waiting</Typography>
                  </Box>
                  
                  <Stack direction="row" spacing={1}>
                    <Button 
                      variant="outlined" 
                      onClick={() => setOpenBatchDialog(true)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                    >
                      Batch Update
                    </Button>
                    <QrScannerModal onScan={async (token) => {
                      const patient = await getPatientByQrToken(token);
                      const item = waitingList.find(i => i.patient_id === patient?.id);
                      if (item) handleOpenDispense(item); else notify("Patient not in queue", "error");
                    }} />
                  </Stack>
                </Box>
                
                {isMobile || isTablet ? (
                  <Box>
                    {waitingList.length === 0 ? (
                      <Typography align="center" color="textSecondary" sx={{ py: 6 }}>
                        No patients currently waiting.
                      </Typography>
                    ) : (
                      waitingList.map(renderQueueItem)
                    )}
                  </Box>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead sx={{ bgcolor: '#f8f9fa' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Patient Name</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Registered</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Wait Time</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {waitingList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography color="textSecondary" sx={{ py: 4 }}>
                                Queue is currently empty.
                              </Typography>
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

          {/* Stats Sidebar */}
          <Grid item xs={12} lg={3}>
            <Stack spacing={3}>
              <Card sx={{ borderRadius: 3, bgcolor: 'primary.main', color: 'white', p: 1 }}>
                <CardContent>
                  <Typography variant="overline" sx={{ opacity: 0.8, fontWeight: 800 }}>COMPLETED TODAY</Typography>
                  <Typography variant="h2" fontWeight="900">{dispensedCount}</Typography>
                  <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                    Total prescriptions filled since opening.
                  </Typography>
                </CardContent>
              </Card>
              
              <Alert severity="info" icon={<HistoryIcon />} sx={{ borderRadius: 3 }}>
                Records older than 18 months are automatically archived.
              </Alert>
            </Stack>
          </Grid>
        </Grid>
      ) : (
        <InventoryView />
      )}

      {/* --- PHARMACY DISPENSING DIALOG --- */}
      <Dialog 
        open={openDispenseDialog} 
        onClose={() => setOpenDispenseDialog(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.4rem', pt: 3, pb: 1 }}>
          DISPENSING SESSION: {selectedItem?.patient_name}
        </DialogTitle>
        
        <DialogContent dividers sx={{ pt: 3 }}>
          <Grid container spacing={4}>
            
            {/* Left Column: Clinical Context */}
            <Grid item xs={12} md={5}>
              <Stack spacing={3}>
                <Box sx={{ p: 2, bgcolor: '#f4f6f8', borderRadius: 2 }}>
                  <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ letterSpacing: 1 }}>
                    CLINICAL DIAGNOSIS
                  </Typography>
                  <Typography variant="h6" fontWeight="700" color="primary" sx={{ mt: 0.5 }}>
                    {currentDiagnosis?.diagnosis || 'N/A'}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ letterSpacing: 1 }}>
                    VITALS OVERVIEW
                  </Typography>
                  <Grid container spacing={1} sx={{ mt: 0.5 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" display="block">BP: {currentVitals?.blood_pressure || '--'}</Typography>
                      <Typography variant="caption" display="block">Temp: {currentVitals?.temperature || '--'}°C</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" display="block">Weight: {currentVitals?.weight || '--'}kg</Typography>
                      <Typography variant="caption" display="block">Pulse: {currentVitals?.heart_rate || '--'}bpm</Typography>
                    </Grid>
                  </Grid>
                </Box>
                
                <Divider />
                
                <Box>
                  <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ letterSpacing: 1 }}>
                    PHARMACY NOTES
                  </Typography>
                  <TextField 
                    fullWidth 
                    multiline 
                    rows={3} 
                    placeholder="Enter any notes for follow-up..." 
                    variant="filled"
                    value={pharmacyNote}
                    onChange={(e) => setPharmacyNote(e.target.value)}
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Stack>
            </Grid>

            {/* Right Column: Prescription Fulfillment */}
            <Grid item xs={12} md={7}>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Station Action</InputLabel>
                <Select 
                  value={pharmacyAction} 
                  onChange={(e) => setPharmacyAction(e.target.value as any)} 
                  label="Station Action"
                >
                  <MenuItem value="DISPENSE">Confirm & Dispense All</MenuItem>
                  <MenuItem value="HOLD">Place on Temporary Hold</MenuItem>
                  <MenuItem value="CANCEL">Cancel Prescription Order</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="subtitle1" fontWeight="900" gutterBottom>
                MEDICATION LIST
              </Typography>
              
              <FormGroup>
                {currentPrescription?.prescriptions.map((p, idx) => (
                  <Paper 
                    key={idx} 
                    variant="outlined" 
                    sx={{ 
                      p: 2, mb: 2, borderRadius: 2,
                      bgcolor: dispensedItems[idx] ? '#f0f9f0' : 'white',
                      borderColor: dispensedItems[idx] ? 'success.main' : 'divider'
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <FormControlLabel
                        sx={{ m: 0, flex: 1 }}
                        control={
                          <Checkbox 
                            checked={!!dispensedItems[idx]} 
                            onChange={() => handleToggleDispense(idx)} 
                            color="success" 
                          />
                        }
                        label={
                          <Box sx={{ ml: 1 }}>
                            <Typography variant="body1" fontWeight="800">{p.medicationName}</Typography>
                            <Typography variant="body2" color="textSecondary">
                              Order: {p.quantity} ({p.dosage})
                            </Typography>
                            <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                              {p.frequency} | {p.duration}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box sx={{ width: 100 }}>
                        <TextField 
                          label="Dispense" 
                          type="number" 
                          size="small"
                          value={dispensedQuantities[idx] ?? ''}
                          onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                          disabled={pharmacyAction !== 'DISPENSE'}
                        />
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </FormGroup>

              {/* Dynamic IOU / Return Date logic */}
              {pharmacyAction === 'DISPENSE' && currentPrescription?.prescriptions.some((p, i) => (dispensedQuantities[i] || 0) < (p.quantity || 0)) && (
                <Box sx={{ mt: 3, p: 2, bgcolor: '#fff4e5', borderRadius: 2, border: '1px solid #ffe2b7' }}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <WarningAmberIcon sx={{ color: 'warning.dark', mr: 1, fontSize: 20 }} />
                    <Typography variant="subtitle2" color="warning.dark" fontWeight="900">
                      MEDICATION SHORTFALL (IOU)
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Please specify when the patient should return to collect the remainder.
                  </Typography>
                  <TextField 
                    fullWidth 
                    type="date" 
                    label="Patient Return Date" 
                    InputLabelProps={{ shrink: true }}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    sx={{ bgcolor: 'white' }}
                  />
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, bgcolor: '#f9fafb', justifyContent: 'space-between' }}>
          <Button 
            startIcon={<LocalPrintshopIcon />} 
            variant="outlined"
            onClick={() => window.print()}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Generate Print Template
          </Button>
          
          <Box>
            <Button onClick={() => setOpenDispenseDialog(false)} color="inherit" sx={{ mr: 2 }}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handleCompleteDispensing} 
              startIcon={<CheckCircleIcon />} 
              disabled={isLoading || (pharmacyAction === 'DISPENSE' && !allDispensed)}
              sx={{ fontWeight: 900, px: 4, minHeight: '48px', borderRadius: 2 }}
            >
              Finalize Session
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* --- DISPENSING SUMMARY DIALOG --- */}
      <Dialog 
        open={openSummaryDialog} 
        onClose={() => setOpenSummaryDialog(false)} 
        maxWidth="xs" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, textAlign: 'center' }}>
          SESSION COMPLETED
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 3 }}>
            The following items have been logged and stock levels updated.
          </Typography>
          
          {dispenseSummary?.summary.map((s: any, i: number) => (
            <Box 
              key={i} 
              sx={{ 
                mb: 1.5, p: 2, 
                bgcolor: s.shortfall > 0 ? '#fff4e5' : '#f0f9f0', 
                borderRadius: 2,
                border: '1px solid',
                borderColor: s.shortfall > 0 ? '#ffe2b7' : '#c3e6cb'
              }}
            >
              <Typography variant="body2" fontWeight="800" color="primary">
                {s.medication}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                Dispensed: {s.dispensed} | <strong>Owed: {s.shortfall}</strong>
              </Typography>
            </Box>
          ))}
          
          {returnDate && (
            <Box sx={{ mt: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 2, textAlign: 'center' }}>
              <Typography variant="caption" fontWeight="900" color="primary">
                IOU RETURN DATE
              </Typography>
              <Typography variant="h6" fontWeight="800">
                {new Date(returnDate).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setOpenSummaryDialog(false)} 
            fullWidth 
            variant="contained" 
            size="large"
            sx={{ borderRadius: 2, fontWeight: 800, minHeight: '48px' }}
          >
            Confirm & Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* External Modal Components */}
      <BatchEntry 
        open={openBatchDialog} 
        onClose={() => setOpenBatchDialog(false)} 
        onSuccess={() => notify("Clinic inventory updated successfully.", "success")} 
      />

      {/* --- HIDDEN PRINT VIEW (Accessed via window.print) --- */}
      {currentPatient && currentEncounter && (
        <Box sx={{ display: 'none' }}>
          <PrescriptionPrintView 
            patient={currentPatient} 
            encounter={currentEncounter} 
            vitals={currentVitals} 
            diagnosis={currentDiagnosis} 
            prescription={currentPrescription} 
            triage={currentTriage}
            countryCode={selectedCountry?.id || 'BD'} 
            clinicName={selectedClinic?.name} 
          />
        </Box>
      )}
    </StationLayout>
  );
};

export default PharmacyStation;