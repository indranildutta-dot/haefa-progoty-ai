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

  const updateMed = (index: number, updates: Partial<Prescription>) => {
    const updated = [...prescriptions];
    let med = { ...updated[index], ...updates };

    if (updates.medicationName !== undefined && !med.isCustom) {
      const variants = groupedInventory[med.medicationName] || [];
      if (variants.length === 1) {
        med.dosageValue = variants[0].dosage.replace(/[a-zA-Z]/g, '').trim();
        med.dosageUnit = variants[0].dosage.replace(/[0-9]/g, '').trim() || 'mg';
        med.medicationId = variants[0].id;
      } else {
        med.dosageValue = ''; 
        med.dosageUnit = 'mg';
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
          Add Not in Medicine Inventory
        </Button>
      </Stack>

      <Stack spacing={4}>
        {prescriptions.map((med, i) => {
          const variants = (groupedInventory[med.medicationName] || []).map(v => ({
            ...v,
            dosage: (v.dosage || '').trim()
          }));
          const uniqueDosages: string[] = Array.from(new Set(variants.map(v => v.dosage)));
          const hasMultipleDosages = uniqueDosages.length > 1;

          return (
            <Paper key={i} elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid #e2e8f0', position: 'relative', bgcolor: 'white' }}>
              <IconButton 
                onClick={() => setPrescriptions(prescriptions.filter((_, idx) => idx !== i))} 
                sx={{ position: 'absolute', top: 8, right: 8, color: '#94a3b8', '&:hover': { color: '#ef4444' } }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>

              <Grid container spacing={2} alignItems="flex-start">
                {/* Row 1: Medicine Search */}
                <Grid size={{ xs: 12, md: 5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', mb: 0.5, display: 'block' }}>MEDICATION</Typography>
                  {med.isCustom ? (
                    <TextField 
                      fullWidth variant="outlined" size="small"
                      placeholder="Enter medicine name..."
                      value={med.medicationName} 
                      onChange={(e) => updateMed(i, { medicationName: e.target.value })} 
                    />
                  ) : (
                    <Autocomplete
                      size="small"
                      options={medicineNames}
                      value={med.medicationName}
                      onChange={(_, v) => updateMed(i, { medicationName: v || '' })}
                      renderInput={(p) => (
                        <TextField 
                          {...p} 
                          variant="outlined" 
                          placeholder="Search medicine..."
                          InputProps={{ ...p.InputProps, startAdornment: <MedicationIcon sx={{ mr: 1, fontSize: 20 }} color="primary" /> }} 
                        />
                      )}
                    />
                  )}
                </Grid>

                {/* Dosage */}
                <Grid size={{ xs: 6, md: 2.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', mb: 0.5, display: 'block' }}>DOSAGE</Typography>
                  {hasMultipleDosages && !med.isCustom ? (
                    <FormControl fullWidth size="small">
                      <Select 
                        value={med.dosageValue + med.dosageUnit} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const num = val.replace(/[a-zA-Z]/g, '').trim();
                          const unit = val.replace(/[0-9]/g, '').trim() || 'mg';
                          const match = variants.find(v => v.dosage === val);
                          updateMed(i, { dosageValue: num, dosageUnit: unit, medicationId: match?.id || '' });
                        }}
                      >
                        {uniqueDosages.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField 
                      fullWidth size="small"
                      value={med.dosageValue} 
                      disabled={!med.isCustom && variants.length === 1} 
                      onChange={(e) => updateMed(i, { dosageValue: e.target.value })} 
                      variant="outlined" 
                    />
                  )}
                </Grid>

                {/* Unit */}
                <Grid size={{ xs: 6, md: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: 'text.secondary', mb: 0.5, display: 'block' }}>UNIT</Typography>
                  <FormControl fullWidth size="small">
                    <Select value={med.dosageUnit} onChange={(e) => updateMed(i, { dosageUnit: e.target.value })}>
                      <MenuItem value="mg">mg</MenuItem>
                      <MenuItem value="ml">ml</MenuItem>
                      <MenuItem value="tab">tab</MenuItem>
                      <MenuItem value="cap">cap</MenuItem>
                      <MenuItem value="g">g</MenuItem>
                      <MenuItem value="puff">puff</MenuItem>
                      <MenuItem value="drop">drop</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Total Qty */}
                <Grid size={{ xs: 12, md: 2.5 }}>
                  <Box sx={{ bgcolor: '#f0f9ff', p: 1, borderRadius: 2, border: '1px solid #bae6fd', textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 900, display: 'block', fontSize: '0.65rem' }}>TOTAL QUANTITY</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: '#0369a1' }}>{med.quantity}</Typography>
                  </Box>
                </Grid>

                {/* Row 2: Schedule */}
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid size={{ xs: 6, md: 2 }}>
                        <TextField 
                          fullWidth label="Freq" size="small" type="number" 
                          value={isNaN(med.frequencyValue) ? '' : med.frequencyValue} 
                          onChange={(e) => updateMed(i, { frequencyValue: e.target.value === '' ? NaN : Number(e.target.value) })} 
                        />
                      </Grid>
                      <Grid size={{ xs: 6, md: 3 }}>
                        <FormControl fullWidth size="small">
                          <Select value={med.frequencyUnit} onChange={(e) => updateMed(i, { frequencyUnit: e.target.value })}>
                            <MenuItem value="times daily">times daily</MenuItem>
                            <MenuItem value="times weekly">times weekly</MenuItem>
                            <MenuItem value="as needed">as needed</MenuItem>
                            <MenuItem value="at night">at night</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 6, md: 2 }}>
                        <TextField 
                          fullWidth label="Dur" size="small" type="number" 
                          value={isNaN(med.durationValue) ? '' : med.durationValue} 
                          onChange={(e) => updateMed(i, { durationValue: e.target.value === '' ? NaN : Number(e.target.value) })} 
                        />
                      </Grid>
                      <Grid size={{ xs: 6, md: 3 }}>
                        <FormControl fullWidth size="small">
                          <Select value={med.durationUnit} onChange={(e) => updateMed(i, { durationUnit: e.target.value })}>
                            <MenuItem value="days">days</MenuItem>
                            <MenuItem value="weeks">weeks</MenuItem>
                            <MenuItem value="months">months</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 12, md: 2 }}>
                         <Stack direction="row" alignItems="center" spacing={1} sx={{ color: 'text.secondary' }}>
                            <CalculateIcon fontSize="small" />
                            <Typography variant="caption" fontWeight="bold">Auto-calc</Typography>
                         </Stack>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>

                {/* Row 3: Instructions */}
                <Grid size={{ xs: 12 }}>
                  <TextField 
                    fullWidth multiline rows={2} size="small"
                    label="Pharmacist Instructions"
                    placeholder="Notes for the pharmacist..."
                    value={med.instructions} onChange={(e) => updateMed(i, { instructions: e.target.value })}
                    sx={{ bgcolor: '#f0fdf4', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
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