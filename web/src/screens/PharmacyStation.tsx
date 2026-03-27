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
  Tab,
  Tooltip
} from '@mui/material';

// --- Icons ---
import MedicationIcon from '@mui/icons-material/Medication';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import HistoryIcon from '@mui/icons-material/History';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';

// --- Services & Context ---
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

// --- Firestore & Utils ---
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
import { db } from "../firebase";

// --- Components & Types ---
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
  
  // -- Queue State --
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
  
  // -- UI Transactional States --
  const [openDispenseDialog, setOpenDispenseDialog] = useState(false);
  const [openBatchDialog, setOpenBatchDialog] = useState(false);
  const [dispensedItems, setDispensedItems] = useState<Record<number, boolean>>({});
  const [dispensedQuantities, setDispensedQuantities] = useState<Record<number, number>>({});
  const [dispenseSummary, setDispenseSummary] = useState<any>(null);
  const [openSummaryDialog, setOpenSummaryDialog] = useState(false);
  
  // -- Feedbacks & Controls --
  const [dispensedCount, setDispensedCount] = useState(0);
  const [pharmacyNote, setPharmacyNote] = useState('');
  const [pharmacyAction, setPharmacyAction] = useState<'DISPENSE' | 'HOLD' | 'CANCEL'>('DISPENSE');
  const [returnDate, setReturnDate] = useState<string>('');
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Today's Statistics (Clinic Performance)
  useEffect(() => {
    const fetchDailyStats = async () => {
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
    fetchDailyStats();
  }, [selectedCountry, selectedClinic, userProfile]);

  // 2. Real-time Queue Subscription
  useEffect(() => {
    if (!selectedClinic || !userProfile?.isApproved) return;

    const unsubscribe = subscribeToQueue(
      'WAITING_FOR_PHARMACY', 
      (items) => {
        setWaitingList(items);
        setPermissionError(false);
      }, 
      (error) => {
        if (error.message.includes('permission-denied')) {
          setPermissionError(true);
        }
      }
    );
    return () => unsubscribe();
  }, [selectedClinic, userProfile]);

  // 3. Clinical Data Fetching (Parallelization for speed)
  const handleOpenDispense = async (item: QueueItem) => {
    setSelectedItem(item);
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
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
      
      // Setup fulfillment quantities
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
      console.error("Critical error loading clinical context:", err);
      setErrorMsg("Failed to load clinical context. Please refresh and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDispense = (index: number) => {
    setDispensedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleQtyChange = (index: number, qty: number) => {
    setDispensedQuantities((prev) => ({ ...prev, [index]: qty }));
  };

  // 4. Fulfillment & Professional Override Logic
  const handleCompleteDispensing = async () => {
    if (!currentPrescription || !selectedItem || !selectedClinic) return;
    
    setIsLoading(true);
    try {
      if (pharmacyAction === 'DISPENSE') {
        const medsPayload = currentPrescription.prescriptions.map((p, idx) => {
          const dispensed = dispensedQuantities[idx] || 0;
          const prescribed = p.quantity || 0;
          
          // SMART OVERRIDE Logic for Math Mismatches (e.g., 3x daily for 7 days = 21, but record says 1)
          if (dispensed > prescribed) {
            const confirmMsg = `WARNING: You are dispensing ${dispensed} units, but only ${prescribed} units were recorded.\n\n` +
                               `If the doctor's intent was "${p.frequency} for ${p.duration}", click OK to override.`;
            if (!window.confirm(confirmMsg)) {
              throw new Error("Dispensing halted for order verification.");
            }
          }
          
          return {
            medication_id: p.medicationId,
            dosage: p.dosage,
            quantity: prescribed,
            dispensed_qty: dispensed
          };
        });

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
        await updateQueueStatus(selectedItem.id!, 'COMPLETED' as any);
        notify(`Successfully dispensed to ${selectedItem.patient_name}`, 'success');
        
      } else if (pharmacyAction === 'HOLD') {
        await updateQueueStatus(selectedItem.id!, 'WAITING_FOR_PHARMACY');
        notify(`Prescription for ${selectedItem.patient_name} put on hold.`, 'info');
      }
      
      setOpenDispenseDialog(false);
      setSelectedItem(null);
    } catch (err: any) {
      console.error("Dispensing session failed:", err);
      notify(err.message || "Dispensing error. Please retry.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const allDispensed = currentPrescription?.prescriptions?.every((_, i) => dispensedItems[i]) ?? false;

  // -- UI Fragment: Responsive Tablet Cards --
  const renderQueueItem = (item: QueueItem) => {
    const arrivalTime = item.created_at?.toDate();
    const waitTime = arrivalTime ? Math.floor((Date.now() - arrivalTime.getTime()) / 60000) : 0;
    
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
        <Card 
          key={item.id} 
          sx={{ 
            mb: 2, 
            borderRadius: 3, 
            border: '1px solid #e0e0e0', 
            boxShadow: 'none',
            '&:active': { bgcolor: '#f5f5f5' }
          }}
        >
          <CardContent sx={{ p: 2 }}>
            <Box 
              display="flex" 
              justifyContent="space-between" 
              alignItems="flex-start" 
              mb={1.5}
            >
              <Box display="flex" alignItems="center">
                <PersonIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight="800">
                  {item.patient_name}
                </Typography>
              </Box>
              <Chip 
                label={item.triage_level?.toUpperCase() || 'STANDARD'} 
                size="small" 
                color={getTriageColor(item.triage_level) as any}
                sx={{ fontWeight: 900, borderRadius: 1.5 }}
              />
            </Box>
            
            <Stack direction="row" spacing={2} mb={2}>
              <Box display="flex" alignItems="center">
                <AccessTimeIcon sx={{ color: 'text.secondary', mr: 0.5, fontSize: 16 }} />
                <Typography variant="body2" color="text.secondary">
                  {waitTime} mins in queue
                </Typography>
              </Box>
            </Stack>
            
            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => handleOpenDispense(item)}
              sx={{ 
                borderRadius: 2.5, 
                textTransform: 'none', 
                fontWeight: 900, 
                minHeight: '52px',
                fontSize: '1rem' 
              }}
            >
              Start Dispensing
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <TableRow key={item.id} hover>
        <TableCell sx={{ fontWeight: '700' }}>{item.patient_name}</TableCell>
        <TableCell>{arrivalTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
        <TableCell>
          <Typography 
            variant="body2" 
            sx={{ color: waitTime > 30 ? 'error.main' : 'text.primary', fontWeight: 'bold' }}
          >
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
          <Button 
            variant="contained" 
            size="small" 
            onClick={() => handleOpenDispense(item)} 
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Dispense
          </Button>
        </TableCell>
      </TableRow>
    );
  };

  // --- Main Render Architecture ---

  if (!selectedClinic) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="textSecondary" fontWeight="800">
          SELECT A CLINIC TO PROCEED
        </Typography>
      </Box>
    );
  }

  return (
    <StationLayout
      title="Medication Dispensing"
      stationName="Pharmacy"
      showPatientContext={false}
    >
      {/* Header Section */}
      <Box sx={{ mb: isMobile ? 3 : 5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h3" fontWeight="900" sx={{ color: 'primary.main', mb: 0.5, letterSpacing: -1 }}>
              PHARMACY STATION
            </Typography>
            <Typography variant="body1" color="text.secondary" fontWeight="500">
              Confirm doctor's orders and fulfill patient prescriptions.
            </Typography>
          </Box>
          {!isMobile && (
            <Box sx={{ textAlign: 'right' }}>
               <Typography variant="caption" fontWeight="900" color="textSecondary">CURRENT CLINIC</Typography>
               <Typography variant="h6" fontWeight="800">{selectedClinic.name}</Typography>
            </Box>
          )}
        </Stack>
        
        <Tabs 
          value={tabValue} 
          onChange={(_, newValue) => setTabValue(newValue)} 
          sx={{ mt: 4, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Patient Queue" sx={{ fontWeight: 800, px: 4 }} />
          <Tab label="Clinic Inventory" sx={{ fontWeight: 800, px: 4 }} />
        </Tabs>
      </Box>

      {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: 2, fontWeight: 700 }}>{errorMsg}</Alert>}

      {tabValue === 0 ? (
        <Grid container spacing={4}>
          {/* Main List Section */}
          <Grid item xs={12} lg={9}>
            <Card sx={{ borderRadius: 4, border: '1px solid #efefef', boxShadow: 'none' }}>
              <CardContent sx={{ p: { xs: 2, md: 4 } }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                  <Box display="flex" alignItems="center">
                    <MedicationIcon color="primary" sx={{ mr: 2, fontSize: 32 }} />
                    <Typography variant="h5" fontWeight="900">Queue Management</Typography>
                  </Box>
                  
                  <Stack direction="row" spacing={2}>
                    <Button 
                      variant="outlined" 
                      startIcon={<CloudUploadIcon />}
                      onClick={() => setOpenBatchDialog(true)}
                      sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 800, px: 3 }}
                    >
                      Batch Update
                    </Button>
                    <QrScannerModal onScan={async (token) => {
                      const patient = await getPatientByQrToken(token);
                      const item = waitingList.find(i => i.patient_id === patient?.id);
                      if (item) handleOpenDispense(item); else notify("Patient not in queue.", "error");
                    }} />
                  </Stack>
                </Box>
                
                {isMobile || isTablet ? (
                  <Box>
                    {waitingList.length === 0 ? (
                      <Typography align="center" color="textSecondary" sx={{ py: 10, fontWeight: 700 }}>
                        The queue is currently empty.
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
                          <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>PATIENT NAME</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>REGISTERED</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>WAIT TIME</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>TRIAGE LEVEL</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: 'text.secondary' }}>ACTION</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {waitingList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              <Typography color="textSecondary" sx={{ py: 6, fontWeight: 700 }}>
                                No patients currently waiting for dispensing.
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

          {/* Statistics Sidebar */}
          <Grid item xs={12} lg={3}>
            <Stack spacing={4}>
              <Card 
                sx={{ 
                  borderRadius: 4, 
                  bgcolor: 'primary.main', 
                  color: 'white', 
                  p: 1.5,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)' 
                }}
              >
                <CardContent>
                  <Typography variant="overline" sx={{ opacity: 0.8, fontWeight: 900, letterSpacing: 1.5 }}>
                    DISPENSED TODAY
                  </Typography>
                  <Typography variant="h1" fontWeight="900" sx={{ my: 1 }}>
                    {dispensedCount}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                    Patients successfully served since clinic opening.
                  </Typography>
                </CardContent>
              </Card>
              
              <Paper sx={{ p: 3, borderRadius: 4, bgcolor: '#f0f4ff', border: '1px solid #d0d9ff' }}>
                <Box display="flex" alignItems="center" mb={1.5}>
                  <HealthAndSafetyIcon sx={{ color: 'primary.main', mr: 1 }} />
                  <Typography variant="subtitle2" fontWeight="900">CLINIC SAFETY</Typography>
                </Box>
                <Typography variant="caption" color="textSecondary">
                  All dispensing is logged with batch IDs for traceability. Ensure expiration dates are checked on physical packaging.
                </Typography>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      ) : (
        <InventoryView />
      )}

      {/* --- MAIN DISPENSING SESSION DIALOG --- */}
      <Dialog 
        open={openDispenseDialog} 
        onClose={() => !isLoading && setOpenDispenseDialog(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.6rem', pt: 4, px: 4 }}>
          FULFILLMENT: {selectedItem?.patient_name}
        </DialogTitle>
        
        <DialogContent dividers sx={{ p: 4 }}>
          <Grid container spacing={5}>
            
            {/* Left Column: Comprehensive Patient Context */}
            <Grid item xs={12} md={5}>
              <Stack spacing={4}>
                <Box sx={{ p: 3, bgcolor: '#f4f6f8', borderRadius: 3 }}>
                  <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ letterSpacing: 1.5 }}>
                    DOCTOR'S DIAGNOSIS
                  </Typography>
                  <Typography variant="h6" fontWeight="800" color="primary" sx={{ mt: 1 }}>
                    {currentDiagnosis?.diagnosis || 'No Diagnosis Provided'}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ letterSpacing: 1.5 }}>
                    VITALS LOG
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" display="block" color="textSecondary">BLOOD PRESSURE</Typography>
                      <Typography variant="body1" fontWeight="700">{currentVitals?.blood_pressure || '--'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" display="block" color="textSecondary">HEART RATE</Typography>
                      <Typography variant="body1" fontWeight="700">{currentVitals?.heart_rate || '--'} bpm</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" display="block" color="textSecondary">TEMP</Typography>
                      <Typography variant="body1" fontWeight="700">{currentVitals?.temperature || '--'}°C</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" display="block" color="textSecondary">WEIGHT</Typography>
                      <Typography variant="body1" fontWeight="700">{currentVitals?.weight || '--'} kg</Typography>
                    </Grid>
                  </Grid>
                </Box>
                
                <Divider />
                
                <Box>
                  <Typography variant="caption" color="textSecondary" fontWeight="900" sx={{ letterSpacing: 1.5 }}>
                    DISPENSING NOTES
                  </Typography>
                  <TextField 
                    fullWidth 
                    multiline 
                    rows={4} 
                    placeholder="Add internal pharmacy notes for this encounter..." 
                    variant="outlined"
                    value={pharmacyNote}
                    onChange={(e) => setPharmacyNote(e.target.value)}
                    sx={{ mt: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Box>
              </Stack>
            </Grid>

            {/* Right Column: Prescription Fulfillment Logic */}
            <Grid item xs={12} md={7}>
              <FormControl fullWidth sx={{ mb: 4 }}>
                <InputLabel sx={{ fontWeight: 700 }}>Fulfillment Action</InputLabel>
                <Select 
                  value={pharmacyAction} 
                  onChange={(e) => setPharmacyAction(e.target.value as any)} 
                  label="Fulfillment Action"
                  sx={{ borderRadius: 3, fontWeight: 700 }}
                >
                  <MenuItem value="DISPENSE" sx={{ fontWeight: 700 }}>Confirm & Dispense</MenuItem>
                  <MenuItem value="HOLD" sx={{ fontWeight: 700 }}>Place on Temporary Hold</MenuItem>
                  <MenuItem value="CANCEL" sx={{ fontWeight: 700 }}>Void Prescription</MenuItem>
                </Select>
              </FormControl>

              <Typography variant="subtitle1" fontWeight="900" color="primary" sx={{ mb: 2, letterSpacing: 0.5 }}>
                ORDERED MEDICATIONS
              </Typography>
              
              <FormGroup>
                {currentPrescription?.prescriptions.map((p, idx) => (
                  <Paper 
                    key={idx} 
                    variant="outlined" 
                    sx={{ 
                      p: 3, 
                      mb: 2.5, 
                      borderRadius: 3,
                      bgcolor: dispensedItems[idx] ? '#f0fdf4' : 'white',
                      borderColor: dispensedItems[idx] ? 'success.main' : 'divider',
                      transition: 'all 0.2s ease'
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
                          <Box sx={{ ml: 1.5 }}>
                            <Typography variant="body1" fontWeight="900">{p.medicationName}</Typography>
                            <Typography variant="body2" color="textSecondary" fontWeight="600">
                              Order: {p.quantity} Units ({p.dosage})
                            </Typography>
                            <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'primary.main', fontWeight: 700 }}>
                              {p.frequency} | {p.duration}
                            </Typography>
                          </Box>
                        }
                      />
                      <Box sx={{ width: 110 }}>
                        <TextField 
                          label="Dispensed" 
                          type="number" 
                          size="small"
                          value={dispensedQuantities[idx] ?? ''}
                          onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                          disabled={pharmacyAction !== 'DISPENSE'}
                          InputProps={{ sx: { borderRadius: 2, fontWeight: 800 } }}
                        />
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </FormGroup>

              {/* IOU Return Logic */}
              {pharmacyAction === 'DISPENSE' && currentPrescription?.prescriptions.some((p, i) => (dispensedQuantities[i] || 0) < (p.quantity || 0)) && (
                <Box 
                  sx={{ 
                    mt: 4, 
                    p: 3, 
                    bgcolor: '#fff9f0', 
                    borderRadius: 3, 
                    border: '1px solid #ffe2b7',
                    boxShadow: '0 4px 12px rgba(255, 167, 38, 0.1)'
                  }}
                >
                  <Box display="flex" alignItems="center" mb={1.5}>
                    <WarningAmberIcon sx={{ color: 'warning.dark', mr: 1.5, fontSize: 24 }} />
                    <Typography variant="subtitle2" color="warning.dark" fontWeight="900">
                      SHORTFALL DETECTED (IOU)
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2.5, fontWeight: 500 }}>
                    Specify the date when the patient should return to collect the remaining balance.
                  </Typography>
                  <TextField 
                    fullWidth 
                    type="date" 
                    label="Patient Return Date" 
                    InputLabelProps={{ shrink: true }}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    sx={{ bgcolor: 'white', '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                  />
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 4, bgcolor: '#f9fafb', justifyContent: 'space-between' }}>
          <Button 
            startIcon={<LocalPrintshopIcon />} 
            variant="outlined"
            onClick={() => window.print()}
            sx={{ fontWeight: 800, borderRadius: 3, px: 3 }}
          >
            Print Prescription
          </Button>
          
          <Box>
            <Button onClick={() => setOpenDispenseDialog(false)} color="inherit" sx={{ mr: 3, fontWeight: 700 }}>
              Close
            </Button>
            <Button 
              variant="contained" 
              onClick={handleCompleteDispensing} 
              startIcon={isLoading ? null : <CheckCircleIcon />} 
              disabled={isLoading || (pharmacyAction === 'DISPENSE' && !allDispensed)}
              sx={{ 
                fontWeight: 900, 
                px: 5, 
                minHeight: '56px', 
                borderRadius: 3,
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
              }}
            >
              {isLoading ? 'Processing...' : 'Finalize Session'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* --- SESSION SUMMARY DIALOG --- */}
      <Dialog 
        open={openSummaryDialog} 
        onClose={() => setOpenSummaryDialog(false)} 
        maxWidth="xs" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, textAlign: 'center', fontSize: '1.4rem' }}>
          FULFILLMENT COMPLETE
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 4, fontWeight: 500 }}>
            Inventory logs updated. Summarized results:
          </Typography>
          
          {dispenseSummary?.summary.map((s: any, i: number) => (
            <Box 
              key={i} 
              sx={{ 
                mb: 2, 
                p: 2.5, 
                bgcolor: s.shortfall > 0 ? '#fff9f0' : '#f0fdf4', 
                borderRadius: 3,
                border: '1px solid',
                borderColor: s.shortfall > 0 ? '#ffe2b7' : '#c3e6cb'
              }}
            >
              <Typography variant="body1" fontWeight="900" color="primary">
                {s.medication}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                Dispensed: {s.dispensed} | <strong style={{color: s.shortfall > 0 ? '#b76e00' : 'inherit'}}>Owed: {s.shortfall}</strong>
              </Typography>
            </Box>
          ))}
          
          {returnDate && (
            <Box sx={{ mt: 4, p: 3, bgcolor: '#e3f2fd', borderRadius: 3, textAlign: 'center', border: '1px dashed #2196f3' }}>
              <Typography variant="caption" fontWeight="900" color="primary" sx={{ letterSpacing: 1.5 }}>
                IOU RECALL DATE
              </Typography>
              <Typography variant="h5" fontWeight="900">
                {new Date(returnDate).toLocaleDateString(undefined, { dateStyle: 'long' })}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => setOpenSummaryDialog(false)} 
            fullWidth 
            variant="contained" 
            size="large"
            sx={{ borderRadius: 3, fontWeight: 900, minHeight: '56px' }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Internal Component Modals */}
      <BatchEntry 
        open={openBatchDialog} 
        onClose={() => setOpenBatchDialog(false)} 
        onSuccess={() => notify("Inventory synchronization successful.", "success")} 
      />

      {/* --- HIDDEN PRINT VIEW --- */}
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