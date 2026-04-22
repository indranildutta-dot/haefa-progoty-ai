import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button, Chip, Stack, Card, CardContent, Container, Alert, Divider, Grid,
  IconButton, Tooltip, Tabs, Tab, TextField, ToggleButtonGroup, ToggleButton, CircularProgress, Autocomplete
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InventoryIcon from '@mui/icons-material/Inventory';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { subscribeToQueue, updateQueueStatus, cancelQueueItem } from '../services/queueService';
import { getPatientById } from '../services/patientService';
import { getVitalsByEncounter } from '../services/encounterService';
import { useAppStore } from '../store/useAppStore';
import StationLayout from '../components/StationLayout';
import StationSearchHeader from '../components/StationSearchHeader';
import PatientContextBar from '../components/PatientContextBar'; 
import CancelQueueDialog from '../components/CancelQueueDialog';
import PrintPrescriptionDialog from '../components/PrintPrescriptionDialog';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';

interface InventoryItem {
  id: string;
  medication_id: string;
  dosage: string;
  quantity: number;
  expiry_date?: any;
}

const PharmacyStation: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { notify, selectedClinic, setSelectedPatient, userProfile } = useAppStore();
  const [activeTab, setActiveTab] = useState(0);
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patientVitals, setPatientVitals] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [highlightedPatientIds, setHighlightedPatientIds] = useState<string[]>([]);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [lastEncounterId, setLastEncounterId] = useState<string | null>(null);
  
  // History State
  const [historyFromDate, setHistoryFromDate] = useState<Dayjs | null>(dayjs().subtract(7, 'day'));
  const [historyToDate, setHistoryToDate] = useState<Dayjs | null>(dayjs());
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  // Dispensing State
  const [dispensingModes, setDispensingModes] = useState<Record<string, string>>({});
  const [returnDates, setReturnDates] = useState<Record<string, Dayjs | null>>({});
  const [partialQty, setPartialQty] = useState<Record<string, number | ''>>({});
  const [substitutionMeds, setSubstitutionMeds] = useState<Record<string, string | null>>({});
  const [substitutionReasons, setSubstitutionReasons] = useState<Record<string, string>>({});
  const [substitutionDosage, setSubstitutionDosage] = useState<Record<string, string>>({});
  const [substitutionQty, setSubstitutionQty] = useState<Record<string, number | ''>>({});
  
  // Inventory State
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);

  useEffect(() => {
    if (!selectedClinic) return;
    return subscribeToQueue('WAITING_FOR_PHARMACY' as any, setWaitingList, (err) => console.error(err));
  }, [selectedClinic]);

  useEffect(() => {
    if (!selectedClinic) return;
    
    setIsInventoryLoading(true);
    const inventoryRef = collection(db, `clinics/${selectedClinic.id}/inventory`);
    const q = query(inventoryRef, orderBy('medication_id', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setInventory(items);
      setIsInventoryLoading(false);
    }, (err) => {
      console.error("Inventory error:", err);
      setIsInventoryLoading(false);
    });
    
    return () => unsubscribe();
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
      const vitalsResult = await getVitalsByEncounter(item.encounter_id);
      setPatientVitals(vitalsResult);

      const allMeds: any[] = [];
      medsSnapshot.forEach(presDoc => {
        const presData = presDoc.data() as any;
        if (Array.isArray(presData.prescriptions)) {
          presData.prescriptions.forEach((med: any, index: number) => {
            allMeds.push({
              ...med,
              id: `${presDoc.id}-${index}`, // Unique key for local state
              presDocId: presDoc.id,
              originalIndex: index
            });
          });
        }
      });

      setSelectedPatient({ ...patient, currentVitals: vitalsResult, triage_level: item.triage_level });
      setPrescriptions(allMeds);
      
      // Initialize dispensing modes for each individual medication
      const initialModes: Record<string, string> = {};
      const initialDates: Record<string, Dayjs | null> = {};
      const initialPartialQty: Record<string, number | ''> = {};
      const initialSubMeds: Record<string, string | null> = {};
      const initialSubReasons: Record<string, string> = {};
      const initialSubDosages: Record<string, string> = {};
      const initialSubQty: Record<string, number | ''> = {};
      
      allMeds.forEach(m => {
        initialModes[m.id] = 'FULL';
        initialDates[m.id] = null;
        initialPartialQty[m.id] = '';
        initialSubMeds[m.id] = null;
        initialSubReasons[m.id] = '';
        initialSubDosages[m.id] = '';
        initialSubQty[m.id] = '';
      });
      
      setDispensingModes(initialModes);
      setReturnDates(initialDates);
      setPartialQty(initialPartialQty);
      setSubstitutionMeds(initialSubMeds);
      setSubstitutionReasons(initialSubReasons);
      setSubstitutionDosage(initialSubDosages);
      setSubstitutionQty(initialSubQty);
    } catch (e) { 
      notify("Error loading dispensing data", "error"); 
    }
  };

  const handleFinalize = async () => {
    // Validation
    for (const med of prescriptions) {
      const mode = dispensingModes[med.id];
      if (mode === 'SUBSTITUTE') {
        if (!substitutionMeds[med.id] || !substitutionReasons[med.id] || !substitutionQty[med.id]) {
          return notify(`Please provide substitute medication, quantity, and reason for ${med.medicationName}`, "warning");
        }
      }
      if (mode === 'PARTIAL') {
        if (!partialQty[med.id]) {
          return notify(`Please specify how many units were dispensed for partial fulfilment of ${med.medicationName}`, "warning");
        }
      }
      if ((mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') && !returnDates[med.id]) {
        return notify(`Please provide a return date for ${med.medicationName}`, "warning");
      }
    }

    setIsFinalizing(true);
    try {
      const dispense = httpsCallable(functions, 'dispenseMedication');
      
      const medsToDispense = prescriptions.map(med => {
        const mode = dispensingModes[med.id];
        let inventoryId: string | undefined = undefined;

        if (mode === 'SUBSTITUTE') {
          inventoryId = substitutionMeds[med.id] || undefined;
        } else if (mode === 'FULL' || mode === 'PARTIAL') {
          // Priority 1: Use medicationId directly from Doctor's selection in PrescriptionBuilder
          inventoryId = med.medicationId;
          
          // Priority 2: Fallback to matching medication name in inventory (for older or custom entries)
          if (!inventoryId) {
            const medNameLower = med.medicationName.toLowerCase().replace(/\s+/g, '');
            const match = inventory.find(i => i.medication_id.toLowerCase().replace(/\s+/g, '') === medNameLower);
            inventoryId = match?.id;
          }
        }

        return {
          medication_name: med.medicationName,
          mode,
          qty: mode === 'SUBSTITUTE' && substitutionQty[med.id] ? Number(substitutionQty[med.id]) : (mode === 'PARTIAL' && partialQty[med.id] ? Number(partialQty[med.id]) : med.quantity),
          inventoryId,
          substitution: mode === 'SUBSTITUTE' ? inventory.find(i => i.id === substitutionMeds[med.id])?.medication_id : null,
          substitution_reason: mode === 'SUBSTITUTE' ? substitutionReasons[med.id] : null,
          return_on: (mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') 
            ? returnDates[med.id]?.toISOString() 
            : null
        };
      });

      await dispense({
        clinicId: selectedClinic?.id,
        encounterId: selectedItem.encounter_id,
        patientId: selectedItem.patient_id,
        medications: medsToDispense
      });

      setLastEncounterId(selectedItem.encounter_id);
      setShowPrintDialog(true);

      notify("Patient visit finalized. Medications dispensed.", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
    } catch (e: any) { 
      console.error("Dispensing error completely captured:", e);
      notify(`Error finalizing dispensing session: ${e.message}`, "error"); 
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const getTemplate = httpsCallable(functions, 'getInventoryTemplate');
      const result = await getTemplate();
      const { fileBase64 } = result.data as any;
      
      const link = document.createElement('a');
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${fileBase64}`;
      link.download = 'Inventory_Template.xlsx';
      link.click();
      notify("Template downloaded", "success");
    } catch (err) {
      notify("Error downloading template", "error");
    }
  };

  const fetchDispensingHistory = async () => {
    if (!selectedClinic || !historyFromDate || !historyToDate) return;
    
    setIsHistoryLoading(true);
    setHistoryRecords([]);
    
    try {
      const start = historyFromDate.startOf('day').toDate();
      const end = historyToDate.endOf('day').toDate();
      
      // Query prescriptions that have been dispensed within the date range
      const q = query(
        collection(db, "prescriptions"),
        where("status", "==", "DISPENSED"),
        where("updated_at", ">=", start),
        where("updated_at", "<=", end)
      );
      
      const snapshot = await getDocs(q);
      const records: any[] = [];
      
      for (const d of snapshot.docs) {
        const data = d.data();
        
        // Since we need to show patient name, we need to fetch the patient or use existing data if available
        // To be safe we fetch the patient name if it's not readily available.
        // It's better to fetch it to have accurate names for history
        let patientName = "Unknown";
        try {
            const pData = await getPatientById(data.patient_id);
            patientName = `${pData.given_name} ${pData.family_name}`;
        } catch(e) {
            console.error("Could not fetch patient name for history", e);
        }

        if (data.dispensation_details && Array.isArray(data.dispensation_details)) {
          data.dispensation_details.forEach((detail: any) => {
             records.push({
               ...detail,
               id: `${d.id}-${records.length}`,
               date: data.updated_at?.toDate(),
               patientName,
               pharmacist: data.dispenser_name,
               encounterId: data.encounter_id
             });
          });
        }
      }
      
      // Sort in memory by date descending
      records.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setHistoryRecords(records);
    } catch (err) {
      console.error("Error fetching dispensing history", err);
      notify("Failed to fetch dispensing history", "error");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const repairLostTimestamps = async () => {
    try {
      const q = query(
        collection(db, "prescriptions"),
        where("status", "==", "DISPENSED")
      );
      const snapshot = await getDocs(q);
      let count = 0;
      for (const d of snapshot.docs) {
        const data = d.data();
        const isBad = !data.updated_at || (typeof data.updated_at === 'object' && Object.keys(data.updated_at).length === 0);
        if (isBad) {
            await updateDoc(doc(db, "prescriptions", d.id), {
                updated_at: serverTimestamp()
            });
            count++;
        }
      }
      if (count > 0) {
        notify(`Repaired ${count} missing timestamps. You can now search!`, "success");
      } else {
        notify(`No missing timestamps found.`, "info");
      }
    } catch (err) {
      console.error("Repair failed", err);
      notify("Failed to repair timestamps", "error");
    }
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedClinic) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(',')[1];
        const upload = httpsCallable(functions, 'bulkUpload');
        await upload({ clinicId: selectedClinic.id, fileBase64: base64 });
        notify("Inventory uploaded successfully", "success");
        // Reset input
        event.target.value = '';
      } catch (err) {
        console.error("Upload error:", err);
        notify("Error uploading inventory", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCancelQueueItem = async (reason: string) => {
    if (!cancelTarget) return;
    try {
      await cancelQueueItem(cancelTarget.id!, reason);
      notify(`Visit cancelled for ${cancelTarget.patient_name}`, 'info');
      setCancelTarget(null);
    } catch (err) {
      console.error("Cancel Error:", err);
      notify("Failed to cancel visit", "error");
    }
  };

  const renderDispensingView = () => (
    <Box>
      {!selectedItem ? (
        <Box>
          <StationSearchHeader 
            stationStatus="WAITING_FOR_PHARMACY"
            onPatientFound={(p, item) => item ? handleSelectPatient(item) : null}
            waitingList={waitingList}
            highlightedPatientIds={highlightedPatientIds}
            setHighlightedPatientIds={setHighlightedPatientIds}
          />

          <TableContainer component={Paper} elevation={0} sx={{ p: 2, borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell>Wait Time</TableCell>
                  <TableCell>Patient Name</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {waitingList.map(item => {
                  const isHighlighted = highlightedPatientIds.includes(item.patient_id);
                  return (
                    <TableRow 
                      key={item.id} 
                      hover
                      sx={{ 
                        bgcolor: isHighlighted ? '#fef9c3' : 'inherit',
                        transition: 'background-color 0.3s ease',
                        borderLeft: isHighlighted ? '6px solid #facc15' : 'none'
                      }}
                    >
                      <TableCell>{formatWaitTime(item.created_at)}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>
                        {item.patient_name}
                        {isHighlighted && (
                          <Chip label="MATCH" size="small" color="warning" sx={{ ml: 2, fontWeight: 900, height: 20 }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <Tooltip title="Cancel Visit">
                            <IconButton 
                              color="error" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setCancelTarget(item);
                              }}
                              sx={{ mr: 1 }}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                          <Button 
                            variant="contained" 
                            color={isHighlighted ? "warning" : "primary"}
                            onClick={() => handleSelectPatient(item)}
                          >
                            Dispense Meds
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {waitingList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 8 }}>
                      <Typography color="text.secondary">No prescriptions pending in queue.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          <Container maxWidth="lg">
            <Stack spacing={2} sx={{ mb: 4 }}>
                {patientVitals?.allergies && patientVitals.allergies.length > 0 && (
                  <Alert severity="error" variant="filled" icon={<WarningIcon />}>
                    <strong>CRITICAL ALLERGY ALERT:</strong> {Array.isArray(patientVitals.allergies) ? patientVitals.allergies.join(', ') : patientVitals.allergies}
                  </Alert>
                )}
                {patientVitals?.is_pregnant && (
                  <Alert severity="warning" variant="filled" icon={<ErrorIcon />}>
                    <strong>PREGNANCY ALERT:</strong> Patient is {patientVitals.pregnancy_months} months pregnant. Check drug safety.
                  </Alert>
                )}
            </Stack>

            <Paper sx={{ p: 4, borderRadius: 5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="900">Dispensary Verification</Typography>
                <Button variant="outlined" onClick={() => {
                  setSelectedItem(null);
                  setSelectedPatient(null);
                }}>Back to Queue</Button>
              </Stack>
              
              <Stack spacing={3}>
                {prescriptions.map((med, idx) => (
                  <Card key={idx} variant="outlined" sx={{ borderRadius: 4, border: '1px solid #e2e8f0' }}>
                    <CardContent>
                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Typography variant="caption" fontWeight="900" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Prescribed By Doctor</Typography>
                          <Typography variant="h6" color="primary" fontWeight="900" mt={0.5}>
                            {med.medicationName || "Unspecified"}
                          </Typography>
                          <Typography variant="body1" fontWeight="700">
                            {med.dosageValue}{med.dosageUnit} x {med.quantity} Total
                          </Typography>
                          {med.instructions && (
                            <Box sx={{ mt: 1.5, p: 2, bgcolor: '#f8fafc', borderRadius: 2, borderLeft: '4px solid #3b82f6' }}>
                                <Typography variant="caption" fontWeight="900" color="#1e40af" sx={{ textTransform: 'uppercase' }}>Doctor's Notes:</Typography>
                                <Typography variant="body2">{med.instructions}</Typography>
                            </Box>
                          )}
                          <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f0f9ff', borderRadius: 2, border: '1px solid #e0f2fe' }}>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                              Dispensed by: <strong>{userProfile?.name}</strong> ({userProfile?.professional_body || 'PCB'}: {userProfile?.professional_reg_no || 'PENDING'})
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Typography variant="subtitle2" fontWeight="bold" mb={1}>Dispensing Mode:</Typography>
                          <ToggleButtonGroup
                            value={dispensingModes[med.id] || 'FULL'}
                            exclusive
                            onChange={(_, val) => val && setDispensingModes(prev => ({ ...prev, [med.id]: val }))}
                            fullWidth
                            color="primary"
                            sx={{ mb: 2 }}
                          >
                            <ToggleButton value="FULL" sx={{ py: 1.5 }}>FULL</ToggleButton>
                            <ToggleButton value="PARTIAL" sx={{ py: 1.5 }}>PARTIAL</ToggleButton>
                            <ToggleButton value="OUT_OF_STOCK" sx={{ py: 1.5 }}>OOS</ToggleButton>
                            <ToggleButton value="SUBSTITUTE" sx={{ py: 1.5 }}>SUB</ToggleButton>
                          </ToggleButtonGroup>

                          {(dispensingModes[med.id] === 'PARTIAL' || dispensingModes[med.id] === 'OUT_OF_STOCK') && (
                            <Box sx={{ mt: 2 }}>
                              <Stack spacing={2}>
                                {dispensingModes[med.id] === 'PARTIAL' && (
                                  <TextField 
                                    label="Quantity Dispensed"
                                    type="number"
                                    required
                                    value={partialQty[med.id] || ''}
                                    onChange={(e) => setPartialQty(prev => ({ ...prev, [med.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                  />
                                )}
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                  <DatePicker
                                    label="Return Date for IOU"
                                    value={returnDates[med.id]}
                                    onChange={(val) => setReturnDates(prev => ({ ...prev, [med.id]: val }))}
                                    slotProps={{ textField: { fullWidth: true } }}
                                    minDate={dayjs()}
                                  />
                                </LocalizationProvider>
                              </Stack>
                            </Box>
                          )}

                          {dispensingModes[med.id] === 'SUBSTITUTE' && (
                            <Stack spacing={2} sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                              <Typography variant="subtitle2" fontWeight="800" color="primary">Substitute Medication Details</Typography>
                              <Autocomplete
                                options={inventory.filter(i => i.quantity > 0)}
                                getOptionLabel={(option) => `${option.medication_id} (${option.dosage}) - Stock: ${option.quantity}`}
                                value={inventory.find(i => i.id === substitutionMeds[med.id]) || null}
                                onChange={(_, newValue) => {
                                  setSubstitutionMeds(prev => ({ ...prev, [med.id]: newValue ? newValue.id : null }));
                                  if (newValue) {
                                    setSubstitutionDosage(prev => ({ ...prev, [med.id]: newValue.dosage || '' }));
                                  } else {
                                    setSubstitutionDosage(prev => ({ ...prev, [med.id]: '' }));
                                  }
                                }}
                                renderInput={(params) => <TextField {...params} label="Select Substitute from Inventory" size="small" required />}
                              />
                              <Stack direction="row" spacing={2}>
                                <TextField
                                  label="Dosage"
                                  size="small"
                                  value={substitutionDosage[med.id] || ''}
                                  fullWidth
                                  disabled
                                />
                                <TextField
                                  label="Dispensing Qty"
                                  type="number"
                                  size="small"
                                  fullWidth
                                  value={substitutionQty[med.id] || ''}
                                  onChange={(e) => setSubstitutionQty(prev => ({ ...prev, [med.id]: e.target.value === '' ? '' : Number(e.target.value) }))}
                                  required
                                />
                              </Stack>
                              <TextField
                                label="Reason for Substitution"
                                fullWidth
                                size="small"
                                required
                                multiline
                                rows={2}
                                value={substitutionReasons[med.id] || ''}
                                onChange={(e) => setSubstitutionReasons(prev => ({ ...prev, [med.id]: e.target.value }))}
                              />
                            </Stack>
                          )}
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
              
              <Divider sx={{ my: 4 }} />
              
              <Box sx={{ mt: 8, pt: 4, borderTop: '2px dashed #e2e8f0' }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Button 
                      fullWidth variant="outlined" color="inherit" size="large" 
                      onClick={() => setSelectedItem(null)}
                      sx={{ height: 60, borderRadius: 3, fontWeight: 800 }}
                    >
                      Cancel
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Button 
                      fullWidth variant="contained" color="primary" size="large" 
                      onClick={handleFinalize}
                      disabled={isFinalizing || prescriptions.some(med => dispensingModes[med.id] === 'PARTIAL' || dispensingModes[med.id] === 'OUT_OF_STOCK')}
                      sx={{ height: 60, borderRadius: 3, fontWeight: 900 }}
                    >
                      {isFinalizing ? <CircularProgress size={24} color="inherit" /> : "Dispense"}
                    </Button>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Button 
                      fullWidth variant="contained" color="warning" size="large" 
                      onClick={handleFinalize}
                      disabled={isFinalizing || !prescriptions.some(med => dispensingModes[med.id] === 'PARTIAL' || dispensingModes[med.id] === 'OUT_OF_STOCK')}
                      sx={{ height: 60, borderRadius: 3, fontWeight: 900 }}
                    >
                      {isFinalizing ? <CircularProgress size={24} color="inherit" /> : "IOU"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Container>
        </Box>
      )}
    </Box>
  );

  const renderInventoryView = () => (
    <Box>
      <Stack direction="row" spacing={2} justifyContent="flex-end" mb={3}>
        <Button 
          variant="outlined" 
          startIcon={<DownloadIcon />} 
          onClick={handleDownloadTemplate}
        >
          Download Template
        </Button>
        <Button 
          variant="contained" 
          component="label" 
          startIcon={<UploadFileIcon />}
        >
          Bulk Upload
          <input type="file" hidden accept=".xlsx" onChange={handleBulkUpload} />
        </Button>
      </Stack>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Medication Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Dosage</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Current Stock</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Expiry Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isInventoryLoading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : inventory.length > 0 ? (
              inventory.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ fontWeight: 'bold' }}>{item.medication_id}</TableCell>
                  <TableCell>{item.dosage}</TableCell>
                  <TableCell>
                    <Chip 
                      label={item.quantity} 
                      color={item.quantity < 50 ? "error" : item.quantity < 200 ? "warning" : "success"}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell>
                    {item.expiry_date ? (
                      item.expiry_date.toDate ? dayjs(item.expiry_date.toDate()).format('DD/MM/YYYY') : 'N/A'
                    ) : 'N/A'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                  <Typography color="text.secondary">No inventory records found for this clinic.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderHistoryView = () => (
    <Box>
      <Paper sx={{ p: 3, mb: 4, borderRadius: 4 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="From Date"
                value={historyFromDate}
                onChange={(val) => setHistoryFromDate(val)}
                slotProps={{ textField: { fullWidth: true } }}
                maxDate={historyToDate || dayjs()}
              />
            </LocalizationProvider>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="To Date"
                value={historyToDate}
                onChange={(val) => setHistoryToDate(val)}
                slotProps={{ textField: { fullWidth: true } }}
                minDate={historyFromDate || undefined}
                maxDate={dayjs()}
              />
            </LocalizationProvider>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<SearchIcon />}
                onClick={fetchDispensingHistory}
                disabled={isHistoryLoading || !historyFromDate || !historyToDate}
                sx={{ height: 56, flex: 1, fontWeight: 700 }}
              >
                Search History
              </Button>
              <Tooltip title="If records from before to this update are missing, click this to repair their invisible timestamps.">
                <Button 
                  variant="outlined" 
                  color="warning"
                  onClick={repairLostTimestamps}
                  sx={{ height: 56, minWidth: '40px' }}
                >
                  <WarningIcon />
                </Button>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 4, border: '1px solid #e2e8f0' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Date & Time</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Medication</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Dispensing Mode</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Qty Dispensed</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Pharmacist</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isHistoryLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : historyRecords.length > 0 ? (
              historyRecords.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    {item.date ? dayjs(item.date).format('DD/MM/YYYY HH:mm') : 'N/A'}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{item.patientName}</TableCell>
                  <TableCell>
                    {item.medication}
                    {item.substitution && <Typography variant="caption" display="block" color="text.secondary">Sub for: {item.substitution}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.mode} 
                      size="small" 
                      color={item.mode === 'FULL' ? 'success' : item.mode === 'OUT_OF_STOCK' ? 'error' : 'warning'} 
                      sx={{ fontWeight: 'bold', height: 24 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>{item.dispensed || 0}</TableCell>
                  <TableCell>{item.pharmacist || 'Unknown'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                  <Typography color="text.secondary">
                    {historyRecords.length === 0 && !isHistoryLoading 
                      ? "Search a date range to view dispensing history." 
                      : "No records found for this period."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <StationLayout title="Pharmacy & Inventory" stationName="Pharmacy" showPatientContext={!!selectedItem}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {!selectedItem && (
          <Box sx={{ mb: 4 }}>
            <Tabs 
              value={activeTab} 
              onChange={(_, val) => setActiveTab(val)} 
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
            >
              <Tab icon={<LocalPharmacyIcon />} label="Dispensing Queue" iconPosition="start" />
              <Tab icon={<InventoryIcon />} label="Medicine Inventory" iconPosition="start" />
              <Tab icon={<HistoryIcon />} label="Dispensing History" iconPosition="start" />
            </Tabs>
          </Box>
        )}

        {activeTab === 0 ? renderDispensingView() : activeTab === 1 ? renderInventoryView() : renderHistoryView()}
      </Container>

      <CancelQueueDialog 
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelQueueItem}
        patientName={cancelTarget?.patient_name || ''}
      />
      {lastEncounterId && (
        <PrintPrescriptionDialog 
          open={showPrintDialog} 
          onClose={() => setShowPrintDialog(false)} 
          encounterId={lastEncounterId} 
        />
      )}
    </StationLayout>
  );
};

export default PharmacyStation;
