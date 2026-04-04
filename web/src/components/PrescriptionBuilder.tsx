import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Typography, TextField, Button, IconButton, Paper, Stack, 
  Autocomplete, Grid, InputAdornment, Divider, MenuItem, Select, 
  FormControl, InputLabel, Alert 
} from '@mui/material';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';

// Icons
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CalculateIcon from '@mui/icons-material/Calculate';
import MedicationIcon from '@mui/icons-material/Medication';
import PostAddIcon from '@mui/icons-material/PostAdd';

interface Prescription {
  medicationId: string;
  medicationName: string;
  dosageValue: string;
  dosageUnit: string;
  frequencyValue: number;
  frequencyUnit: string;
  durationValue: number;
  durationUnit: string;
  quantity: number;
  instructions: string;
  isCustom?: boolean; 
}

const PrescriptionBuilder: React.FC<{ onPrescriptionChange?: (p: Prescription[]) => void; initialData?: Prescription[]; }> = ({ onPrescriptionChange, initialData = [] }) => {
  const { selectedClinic } = useAppStore();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialData);
  const [inventoryMeds, setInventoryMeds] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedClinic?.id) return;
    const inventoryRef = collection(db, "clinics", selectedClinic.id, "inventory");
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().medication_id || doc.data().name || 'Unknown',
        dosage: doc.data().dosage || '',
        stock: Number(doc.data().quantity) || 0
      }));
      setInventoryMeds(items);
    });
    return () => unsubscribe();
  }, [selectedClinic]);

  const groupedInventory = useMemo(() => {
    return inventoryMeds.reduce((acc, curr) => {
      if (!acc[curr.name]) acc[curr.name] = [];
      acc[curr.name].push(curr);
      return acc;
    }, {} as Record<string, any[]>);
  }, [inventoryMeds]);

  const medicineNames = useMemo(() => Object.keys(groupedInventory), [groupedInventory]);

  const updateMed = (index: number, field: keyof Prescription, value: any) => {
    const updated = [...prescriptions];
    const med = { ...updated[index], [field]: value };

    if (field === 'medicationName' && !med.isCustom) {
      const variants = groupedInventory[value] || [];
      if (variants.length === 1) {
        med.dosageValue = variants[0].dosage.replace(/[a-zA-Z]/g, '').trim();
        med.dosageUnit = variants[0].dosage.replace(/[0-9]/g, '').trim() || 'mg';
        med.medicationId = variants[0].id;
      } else {
        med.dosageValue = ''; 
        med.medicationId = '';
      }
    }

    const durVal = Number(med.durationValue) || 0;
    let days = durVal;
    if (med.durationUnit === 'weeks') days = durVal * 7;
    if (med.durationUnit === 'months') days = durVal * 30;
    med.quantity = (Number(med.frequencyValue) || 0) * days;

    updated[index] = med;
    setPrescriptions(updated);
    onPrescriptionChange?.(updated);
  };

  const addNewItem = (isCustom: boolean) => {
    const newItem: Prescription = {
      medicationId: '', medicationName: '', dosageValue: '', dosageUnit: 'mg',
      frequencyValue: 1, frequencyUnit: 'times daily', durationValue: 7,
      durationUnit: 'days', quantity: 7, instructions: '', isCustom
    };
    setPrescriptions([...prescriptions, newItem]);
  };

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
        <Button variant="contained" startIcon={<AddCircleIcon />} onClick={() => addNewItem(false)} sx={{ borderRadius: 3, fontWeight: 900, px: 4 }}>
          Prescribe from Inventory
        </Button>
        <Button variant="outlined" color="secondary" startIcon={<PostAddIcon />} onClick={() => addNewItem(true)} sx={{ borderRadius: 3, fontWeight: 800 }}>
          Add New Medicine
        </Button>
      </Stack>

      <Stack spacing={4}>
        {prescriptions.map((med, i) => {
          const variants = groupedInventory[med.medicationName] || [];
          const hasMultipleDosages = variants.length > 1;

          return (
            <Paper key={i} elevation={0} sx={{ p: 4, borderRadius: 5, border: '2px solid #f1f5f9', position: 'relative', bgcolor: 'white' }}>
              <IconButton onClick={() => setPrescriptions(prescriptions.filter((_, idx) => idx !== i))} sx={{ position: 'absolute', top: 12, right: 12 }}>
                <DeleteIcon color="error" />
              </IconButton>

              <Grid container spacing={2}>
                {/* Medicine Search */}
                <Grid size={{ xs: 12, md: 5 }}>
                  {med.isCustom ? (
                    <TextField fullWidth label="Custom Medicine Name" variant="filled" value={med.medicationName} onChange={(e) => updateMed(i, 'medicationName', e.target.value)} />
                  ) : (
                    <Autocomplete
                      options={medicineNames}
                      value={med.medicationName}
                      onChange={(_, v) => updateMed(i, 'medicationName', v || '')}
                      renderInput={(p) => <TextField {...p} label="Select Medicine" variant="filled" InputProps={{ ...p.InputProps, startAdornment: <MedicationIcon sx={{ mr: 1 }} color="primary" /> }} />}
                    />
                  )}
                </Grid>

                {/* Yellow Box: Dosage */}
                <Grid size={{ xs: 6, md: 1.5 }}>
                  <Box sx={{ bgcolor: '#fef3c7', p: 0.5, borderRadius: 2 }}>
                    {hasMultipleDosages && !med.isCustom ? (
                      <FormControl fullWidth variant="filled">
                        <InputLabel>Dosage</InputLabel>
                        <Select value={med.dosageValue} onChange={(e) => updateMed(i, 'dosageValue', e.target.value)}>
                          {variants.map(v => <MenuItem key={v.id} value={v.dosage}>{v.dosage}</MenuItem>)}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField fullWidth label="Dosage" value={med.dosageValue} disabled={!med.isCustom && variants.length === 1} onChange={(e) => updateMed(i, 'dosageValue', e.target.value)} variant="standard" sx={{ px: 1 }} />
                    )}
                  </Box>
                </Grid>

                {/* Brown Box: Unit */}
                <Grid size={{ xs: 6, md: 2.5 }}>
                  <Box sx={{ bgcolor: '#fafaf9', p: 0.5, borderRadius: 2, border: '1px solid #e7e5e4' }}>
                    <FormControl fullWidth variant="standard" sx={{ px: 1 }}>
                      <InputLabel>Unit</InputLabel>
                      <Select value={med.dosageUnit} onChange={(e) => updateMed(i, 'dosageUnit', e.target.value)}>
                        <MenuItem value="mg">mg</MenuItem><MenuItem value="ml">ml</MenuItem><MenuItem value="tab">tab</MenuItem><MenuItem value="cap">cap</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Grid>

                {/* Blue Box: Total Qty (Moved to Right) */}
                <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Box sx={{ bgcolor: '#e0f2fe', p: 1, borderRadius: 3, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', height: '100%' }}>
                    <CalculateIcon sx={{ mr: 2, color: '#0369a1' }} />
                    <Box>
                      <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 900, display: 'block' }}>TOTAL QUANTITY</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: '#0369a1' }}>{med.quantity}</Typography>
                    </Box>
                  </Box>
                </Grid>

                {/* Schedule Row */}
                <Grid size={{ xs: 12, md: 9 }}>
                   <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                      <TextField 
                        label="Freq" 
                        type="number" 
                        sx={{ width: 80 }} 
                        value={isNaN(med.frequencyValue) ? '' : med.frequencyValue} 
                        onChange={(e) => updateMed(i, 'frequencyValue', e.target.value === '' ? NaN : Number(e.target.value))} 
                      />
                      <Select value={med.frequencyUnit} sx={{ flexGrow: 1 }} onChange={(e) => updateMed(i, 'frequencyUnit', e.target.value)}>
                        <MenuItem value="times daily">times daily</MenuItem><MenuItem value="times weekly">times weekly</MenuItem>
                      </Select>
                      <TextField 
                        label="Dur" 
                        type="number" 
                        sx={{ width: 80 }} 
                        value={isNaN(med.durationValue) ? '' : med.durationValue} 
                        onChange={(e) => updateMed(i, 'durationValue', e.target.value === '' ? NaN : Number(e.target.value))} 
                      />
                      <Select value={med.durationUnit} sx={{ flexGrow: 1 }} onChange={(e) => updateMed(i, 'durationUnit', e.target.value)}>
                        <MenuItem value="days">days</MenuItem><MenuItem value="weeks">weeks</MenuItem><MenuItem value="months">months</MenuItem>
                      </Select>
                   </Stack>
                </Grid>

                {/* Green Box: Pharmacist Instructions */}
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ bgcolor: '#f0fdf4', p: 2, borderRadius: 3, border: '1px solid #dcfce7', mt: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 900, color: '#166534', mb: 1, display: 'block' }}>PHARMACIST INSTRUCTIONS</Typography>
                    <TextField 
                      fullWidth multiline rows={3} variant="standard" 
                      placeholder="Notes for the pharmacist regarding dispensing..."
                      value={med.instructions} onChange={(e) => updateMed(i, 'instructions', e.target.value)}
                      InputProps={{ disableUnderline: true, sx: { fontSize: '0.9rem' } }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

export default PrescriptionBuilder;