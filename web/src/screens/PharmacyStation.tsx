import React, { useState, useEffect } from 'react';
import { 
  Typography, Box, Paper, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack, IconButton, Tabs, Tab,
  Select, MenuItem, FormControl, InputLabel, Autocomplete, Divider, Alert
} from '@mui/material';
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Icons
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';

// Services
import { subscribeToQueue, updateQueueStatus } from '../services/queueService';
import { getDiagnosisByEncounter, getPrescriptionByEncounter, getVitalsByEncounter } from '../services/encounterService';
import { dispenseMedication } from '../services/pharmacyService';
import { useAppStore } from '../store/useAppStore';
import StationLayout from '../components/StationLayout';
import InventoryView from '../components/InventoryView';
import BatchEntry from '../components/BatchEntry';

const PharmacyStation: React.FC<{ countryId: string }> = ({ countryId }) => {
  const { notify, selectedClinic } = useAppStore();
  const [waitingList, setWaitingList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [currentPrescription, setCurrentPrescription] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  
  // Fulfillment States
  const [openDispenseDialog, setOpenDispenseDialog] = useState(false);
  const [openBatchDialog, setOpenBatchDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // Per-medication Dispensing States
  const [dispenseModes, setDispenseModes] = useState<Record<number, string>>({});
  const [dispensedQtys, setDispensedQtys] = useState<Record<number, number>>({});
  const [subsMeds, setSubsMeds] = useState<Record<number, string>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [returnDates, setReturnDates] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!selectedClinic?.id) return;
    const q = query(collection(db, "inventory"), where("clinic_id", "==", selectedClinic.id));
    return onSnapshot(q, (snap) => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [selectedClinic]);

  useEffect(() => {
    if (!selectedClinic?.id) return;
    return subscribeToQueue('WAITING_FOR_PHARMACY', (items) => setWaitingList(items), (err) => notify(err.message, "error"));
  }, [selectedClinic]);

  const handleOpenDispense = async (item: any) => {
    setSelectedItem(item);
    const pres = await getPrescriptionByEncounter(item.encounter_id);
    setCurrentPrescription(pres);
    
    // Initialize defaults
    const modes: Record<number, string> = {};
    const qtys: Record<number, number> = {};
    pres?.prescriptions.forEach((p: any, i: number) => {
      modes[i] = 'FULL';
      qtys[i] = p.quantity;
    });
    setDispenseModes(modes);
    setDispensedQtys(qtys);
    setOpenDispenseDialog(true);
  };

  const handleFinalize = async () => {
    try {
      const payload = currentPrescription.prescriptions.map((p: any, i: number) => ({
        original_medication: p.medicationName,
        dispense_mode: dispenseModes[i],
        dispensed_qty: dispensedQtys[i],
        substitution: subsMeds[i] || null,
        reason: reasons[i] || '',
        return_date: returnDates[i] || null,
        needs_requisition: (inventory.find(inv => inv.medication === p.medicationName)?.quantity - dispensedQtys[i]) < 500
      }));
      
      await dispenseMedication(selectedClinic!.id, selectedItem.patient_id, selectedItem.encounter_id, payload);
      await updateQueueStatus(selectedItem.id, 'COMPLETED' as any);
      setOpenDispenseDialog(false);
      notify("Dispensing session finalized", "success");
    } catch (err: any) { notify(err.message, "error"); }
  };

  return (
    <StationLayout title="Pharmacy" stationName="Pharmacy" showPatientContext={false}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="900" color="primary">PHARMACY OPERATIONS</Typography>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mt: 3 }}>
          <Tab label="Patient Queue" sx={{ fontWeight: 800 }} />
          <Tab label="Inventory Management" sx={{ fontWeight: 800 }} />
        </Tabs>
      </Box>

      {tabValue === 0 ? (
        <Paper sx={{ p: 4, borderRadius: 4 }}>
          <Box display="flex" justifyContent="space-between" mb={4}>
            <Typography variant="h6" fontWeight="900">Current Queue</Typography>
            <Button variant="outlined" startIcon={<CloudUploadIcon />} onClick={() => setOpenBatchDialog(true)}>Batch Update</Button>
          </Box>
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell sx={{ fontWeight: 800 }}>PATIENT</TableCell><TableCell align="right">ACTION</TableCell></TableRow></TableHead>
              <TableBody>
                {waitingList.map(item => (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ fontWeight: 700 }}>{item.patient_name}</TableCell>
                    <TableCell align="right"><Button variant="contained" onClick={() => handleOpenDispense(item)}>Process</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : <InventoryView />}

      <Dialog open={openDispenseDialog} onClose={() => setOpenDispenseDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>PHARMACY FULFILLMENT: {selectedItem?.patient_name}</DialogTitle>
        <DialogContent dividers sx={{ p: 4 }}>
          <Stack spacing={4}>
            {currentPrescription?.prescriptions.map((p: any, i: number) => (
              <Paper key={i} variant="outlined" sx={{ p: 3, borderRadius: 3, bgcolor: '#fcfdff' }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <Typography variant="body1" fontWeight="800">{p.medicationName}</Typography>
                    <Typography variant="caption" color="textSecondary">Order: {p.quantity} units | {p.instructions}</Typography>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select value={dispenseModes[i]} label="Status" onChange={(e) => setDispenseModes({...dispenseModes, [i]: e.target.value})}>
                        <MenuItem value="FULL">Dispense Full</MenuItem>
                        <MenuItem value="PARTIAL">Partial Dispense</MenuItem>
                        <MenuItem value="OUT_OF_STOCK">Out of Stock</MenuItem>
                        <MenuItem value="SUBSTITUTE">Substitute Item</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Grid container spacing={2}>
                      {dispenseModes[i] === 'PARTIAL' && (
                        <>
                          <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Qty Available" onChange={(e) => setDispensedQtys({...dispensedQtys, [i]: Number(e.target.value)})}/></Grid>
                          <Grid item xs={6}><TextField fullWidth size="small" type="date" label="Return Date" InputLabelProps={{ shrink: true }} onChange={(e) => setReturnDates({...returnDates, [i]: e.target.value})}/></Grid>
                        </>
                      )}
                      {dispenseModes[i] === 'SUBSTITUTE' && (
                        <>
                          <Grid item xs={6}><Autocomplete options={inventory.map(m => m.medication)} size="small" renderInput={(p) => <TextField {...p} label="Select Generic"/>} onChange={(_, v) => setSubsMeds({...subsMeds, [i]: v || ''})}/></Grid>
                          <Grid item xs={6}><TextField fullWidth size="small" label="Reason" onChange={(e) => setReasons({...reasons, [i]: e.target.value})}/></Grid>
                        </>
                      )}
                      {dispenseModes[i] === 'OUT_OF_STOCK' && (
                        <Grid item xs={12}><TextField fullWidth size="small" type="date" label="Instruction: Come back on" InputLabelProps={{ shrink: true }} onChange={(e) => setReturnDates({...returnDates, [i]: e.target.value})}/></Grid>
                      )}
                    </Grid>
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}><Button onClick={() => setOpenDispenseDialog(false)}>Cancel</Button><Button variant="contained" onClick={handleFinalize} sx={{ fontWeight: 900, px: 6 }}>Process Order</Button></DialogActions>
      </Dialog>
      <BatchEntry open={openBatchDialog} onClose={() => setOpenBatchDialog(false)} onSuccess={() => setOpenBatchDialog(false)} />
    </StationLayout>
  );
};
export default PharmacyStation;