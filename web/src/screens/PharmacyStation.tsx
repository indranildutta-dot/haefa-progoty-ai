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
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import { collection, query, where, getDocs, doc, addDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
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
  
  // Dispensing State
  const [dispensingModes, setDispensingModes] = useState<Record<string, string>>({});
  const [returnDates, setReturnDates] = useState<Record<string, Dayjs | null>>({});
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
      setPatientVitals(vitals);
      const meds = medsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSelectedPatient({ ...patient, currentVitals: vitals, triage_level: item.triage_level });
      setPrescriptions(meds);
      
      // Initialize dispensing modes
      const initialModes: Record<string, string> = {};
      const initialDates: Record<string, Dayjs | null> = {};
      const initialSubMeds: Record<string, string | null> = {};
      const initialSubReasons: Record<string, string> = {};
      const initialSubDosages: Record<string, string> = {};
      const initialSubQty: Record<string, number | ''> = {};
      
      meds.forEach(m => {
        initialModes[m.id!] = 'FULL';
        initialDates[m.id!] = null;
        initialSubMeds[m.id!] = null;
        initialSubReasons[m.id!] = '';
        initialSubDosages[m.id!] = '';
        initialSubQty[m.id!] = '';
      });
      
      setDispensingModes(initialModes);
      setReturnDates(initialDates);
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
          // Find first matching batch in inventory for the prescribed medication
          const medNameLower = med.medicationName.toLowerCase().replace(/\s+/g, '');
          const match = inventory.find(i => i.medication_id.toLowerCase().replace(/\s+/g, '') === medNameLower);
          inventoryId = match?.id;
        }

        return {
          medication_name: med.medicationName,
          mode,
          qty: mode === 'SUBSTITUTE' && substitutionQty[med.id] ? Number(substitutionQty[med.id]) : med.quantity,
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

      // Automated Requisitions for PROCUREMENT_NEEDED as requested
      // We check if medicine is in inventory or if partial/out of stock
      for (const med of prescriptions) {
        const mode = dispensingModes[med.id];
        const medNameLower = med.medicationName.toLowerCase().replace(/\s+/g, '');
        const inStock = inventory.some(i => i.medication_id.toLowerCase().replace(/\s+/g, '') === medNameLower);
        
        if (!inStock || mode === 'PARTIAL' || mode === 'OUT_OF_STOCK') {
          await addDoc(collection(db, "requisitions"), {
            clinic_id: selectedClinic?.id,
            patient_id: selectedItem.patient_id,
            medication_name: med.medicationName,
            type: 'PROCUREMENT_NEEDED',
            status: 'PENDING',
            encounter_id: selectedItem.encounter_id,
            created_at: serverTimestamp()
          });
        }
      }

      setLastEncounterId(selectedItem.encounter_id);
      setShowPrintDialog(true);

      notify("Patient visit finalized. Medications dispensed.", "success");
      setSelectedItem(null);
      setSelectedPatient(null);
    } catch (e) { 
      console.error("Dispensing error:", e);
      notify("Error finalizing dispensing session", "error"); 
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
                              <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <DatePicker
                                  label="Return Date for IOU"
                                  value={returnDates[med.id]}
                                  onChange={(val) => setReturnDates(prev => ({ ...prev, [med.id]: val }))}
                                  slotProps={{ textField: { fullWidth: true } }}
                                  minDate={dayjs()}
                                />
                              </LocalizationProvider>
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
            </Tabs>
          </Box>
        )}

        {activeTab === 0 ? renderDispensingView() : renderInventoryView()}
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
