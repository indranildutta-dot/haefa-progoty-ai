import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, TextField, Button, IconButton, Paper, Stack, 
  Autocomplete, Grid, InputAdornment, Divider, MenuItem, Select, 
  FormControl, InputLabel, Alert 
} from '@mui/material'; // Verified Paper is included here
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';

// Icons
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CalculateIcon from '@mui/icons-material/Calculate';
import MedicationIcon from '@mui/icons-material/Medication';
import InventoryIcon from '@mui/icons-material/Inventory';

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
  isRequisition?: boolean;
}

const PrescriptionBuilder: React.FC<{ 
  onPrescriptionChange?: (p: Prescription[]) => void; 
  initialData?: Prescription[]; 
}> = ({ onPrescriptionChange, initialData = [] }) => {
  const { selectedClinic } = useAppStore();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialData);
  const [inventoryMeds, setInventoryMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync internal state if initialData changes (e.g., when a patient is selected)
  useEffect(() => {
    if (initialData.length > 0) {
      setPrescriptions(initialData);
    }
  }, [initialData]);

  // 1. Inventory Listener: Fetches stock from the specific clinic path
  useEffect(() => {
    if (!selectedClinic?.id) return;

    const inventoryRef = collection(db, "clinics", selectedClinic.id, "inventory");
    
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.medication_id || data.medication || data.name || 'Unknown Item',
          dosage: data.dosage || '',
          quantity: Number(data.quantity) || 0
        };
      }).filter(item => item.quantity > 0);
      
      setInventoryMeds(items);
      setLoading(false);
    }, (err) => {
      console.error("Inventory Fetch Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedClinic]);

  // 2. Notify Parent of Changes
  useEffect(() => {
    onPrescriptionChange?.(prescriptions);
  }, [prescriptions, onPrescriptionChange]);

  const updateMed = (index: number, field: keyof Prescription, value: any) => {
    const updated = [...prescriptions];
    const med = { ...updated[index], [field]: value };

    // Stock Check Logic
    if (field === 'medicationName') {
      const match = inventoryMeds.find(m => m.name.toLowerCase() === value.toLowerCase());
      if (match) {
        med.medicationId = match.id;
        med.isRequisition = false;
        // Auto-fill dosage if found in inventory string (e.g., "500mg")
        const dMatch = match.dosage?.match(/(\d+)\s*([a-zA-Z]+)/);
        if (dMatch) { 
          med.dosageValue = dMatch[1]; 
          med.dosageUnit = dMatch[2]; 
        }
      } else {
        med.isRequisition = true; 
        med.medicationId = 'REQUISITION_ITEM';
      }
    }

    // Auto-Calculate Total Quantity: Frequency * Duration
    const durVal = Number(med.durationValue) || 0;
    let days = durVal;
    if (med.durationUnit === 'weeks') days = durVal * 7;
    if (med.durationUnit === 'months') days = durVal * 30;
    
    med.quantity = (Number(med.frequencyValue) || 0) * days;

    updated[index] = med;
    setPrescriptions(updated);
  };

  const addMedication = () => {
    setPrescriptions([
      ...prescriptions, 
      { 
        medicationId: '', 
        medicationName: '', 
        dosageValue: '', 
        dosageUnit: 'mg', 
        frequencyValue: 1, 
        frequencyUnit: 'times daily', 
        durationValue: 7, 
        durationUnit: 'days', 
        quantity: 7, 
        instructions: '' 
      }
    ]);
  };

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
            Section 4 — Prescribed Medicines
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Syncing from: clinics/<strong>{selectedClinic?.id}</strong>/inventory
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddCircleIcon />} 
          onClick={addMedication}
          sx={{ borderRadius: 3, fontWeight: 800, px: 3 }}
        >
          Add Medicine
        </Button>
      </Stack>

      <Stack spacing={4}>
        {prescriptions.map((med, i) => (
          <Paper 
            key={i} 
            elevation={0} 
            sx={{ 
              p: 4, 
              borderRadius: 4, 
              border: '2px solid',
              borderColor: med.isRequisition ? '#ff9800' : '#e0e0e0', // Highlight requisitions in orange
              position: 'relative', 
              bgcolor: med.isRequisition ? '#fffcf5' : '#fff' 
            }}
          >
            <IconButton 
              onClick={() => setPrescriptions(prescriptions.filter((_, idx) => idx !== i))} 
              sx={{ position: 'absolute', top: 8, right: 8 }}
            >
              <DeleteIcon color="error"/>
            </IconButton>

            <Grid container spacing={3}>
              {/* Medicine Search */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo 
                  options={inventoryMeds.map(m => m.name)} 
                  value={med.medicationName}
                  onInputChange={(_, v) => updateMed(i, 'medicationName', v)}
                  renderInput={(p) => (
                    <TextField 
                      {...p} 
                      label="Medicine Name" 
                      variant="filled" 
                      helperText={med.isRequisition ? "Out of stock - will trigger Requisition" : "In Stock"}
                      InputProps={{ 
                        ...p.InputProps, 
                        startAdornment: (
                          <InputAdornment position="start">
                            <MedicationIcon color={med.isRequisition ? "warning" : "primary"}/>
                          </InputAdornment>
                        )
                      }}
                    />
                  )}
                />
              </Grid>

              {/* Dosage */}
              <Grid item xs={6} md={3}>
                <TextField 
                  fullWidth label="Dosage" type="number" 
                  value={med.dosageValue} 
                  onChange={(e) => updateMed(i, 'dosageValue', e.target.value)} 
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Unit</InputLabel>
                  <Select 
                    value={med.dosageUnit} 
                    label="Unit" 
                    onChange={(e) => updateMed(i, 'dosageUnit', e.target.value)}
                  >
                    <MenuItem value="mg">mg</MenuItem>
                    <MenuItem value="ml">ml</MenuItem>
                    <MenuItem value="tab">tab</MenuItem>
                    <MenuItem value="cap">cap</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Frequency */}
              <Grid item xs={4} md={2}>
                <TextField 
                  fullWidth label="Freq" type="number" 
                  value={med.frequencyValue} 
                  onChange={(e) => updateMed(i, 'frequencyValue', e.target.value)}
                />
              </Grid>
              <Grid item xs={8} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Freq Unit</InputLabel>
                  <Select 
                    value={med.frequencyUnit} 
                    label="Freq Unit" 
                    onChange={(e) => updateMed(i, 'frequencyUnit', e.target.value)}
                  >
                    <MenuItem value="times daily">times daily</MenuItem>
                    <MenuItem value="times weekly">times weekly</MenuItem>
                    <MenuItem value="as needed">as needed (PRN)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Duration */}
              <Grid item xs={4} md={2}>
                <TextField 
                  fullWidth label="Dur" type="number" 
                  value={med.durationValue} 
                  onChange={(e) => updateMed(i, 'durationValue', e.target.value)}
                />
              </Grid>
              <Grid item xs={8} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Dur Unit</InputLabel>
                  <Select 
                    value={med.durationUnit} 
                    label="Dur Unit" 
                    onChange={(e) => updateMed(i, 'durationUnit', e.target.value)}
                  >
                    <MenuItem value="days">days</MenuItem>
                    <MenuItem value="weeks">weeks</MenuItem>
                    <MenuItem value="months">months</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Total Qty (Calculated) */}
              <Grid item xs={12} md={2}>
                <TextField 
                  fullWidth disabled label="Total Qty" 
                  value={med.quantity} 
                  InputProps={{ 
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalculateIcon color="primary" />
                      </InputAdornment>
                    ), 
                    sx: { fontWeight: 900, bgcolor: '#f5f9ff' } 
                  }} 
                />
              </Grid>

              {/* Instructions */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
                <Typography variant="caption" fontWeight="900" color="primary" sx={{ display: 'block', mb: 1 }}>
                  PHARMACIST INSTRUCTIONS
                </Typography>
                <TextField 
                  fullWidth multiline rows={2} 
                  placeholder="Notes for the pharmacist regarding dispensing..." 
                  value={med.instructions} 
                  onChange={(e) => updateMed(i, 'instructions', e.target.value)}
                  sx={{ bgcolor: '#fff', borderRadius: 2 }}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>

      {!loading && inventoryMeds.length === 0 && (
        <Alert severity="warning" sx={{ mt: 4, borderRadius: 2 }} icon={<InventoryIcon />}>
          No inventory found for <strong>{selectedClinic?.id}</strong>. Verify Dhaka clinic setup in Firestore.
        </Alert>
      )}
    </Box>
  );
};

export default PrescriptionBuilder;