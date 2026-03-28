import React, { useState, useEffect } from 'react';
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

interface PrescriptionBuilderProps {
  onPrescriptionChange?: (p: Prescription[]) => void;
  initialData?: Prescription[];
}

const PrescriptionBuilder: React.FC<PrescriptionBuilderProps> = ({ 
  onPrescriptionChange, 
  initialData = [] 
}) => {
  const { selectedClinic } = useAppStore();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialData);
  const [inventoryMeds, setInventoryMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync internal state if initialData changes externally (e.g. switching patients)
  useEffect(() => {
    setPrescriptions(initialData);
  }, [initialData.length === 0]); 

  // Load Inventory from Firestore
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

  // Unified update handler to prevent flickering loops
  const handleUpdate = (newList: Prescription[]) => {
    setPrescriptions(newList);
    if (onPrescriptionChange) {
      onPrescriptionChange(newList);
    }
  };

  const updateMed = (index: number, field: keyof Prescription, value: any) => {
    const updated = [...prescriptions];
    const med = { ...updated[index], [field]: value };

    if (field === 'medicationName') {
      const match = inventoryMeds.find(m => m.name.toLowerCase() === (value || "").toLowerCase());
      if (match) {
        med.medicationId = match.id;
        med.isRequisition = false;
        const dMatch = match.dosage?.match(/(\d+)\s*([a-zA-Z]+)/);
        if (dMatch) { med.dosageValue = dMatch[1]; med.dosageUnit = dMatch[2]; }
      } else {
        med.isRequisition = true; 
        med.medicationId = 'REQUISITION_ITEM';
      }
    }

    // Auto-calculate Total Quantity
    const durVal = Number(med.durationValue) || 0;
    let days = durVal;
    if (med.durationUnit === 'weeks') days = durVal * 7;
    if (med.durationUnit === 'months') days = durVal * 30;
    med.quantity = (Number(med.frequencyValue) || 0) * days;

    updated[index] = med;
    handleUpdate(updated);
  };

  const addMedication = () => {
    const newList = [...prescriptions, { 
      medicationId: '', medicationName: '', dosageValue: '', dosageUnit: 'mg', 
      frequencyValue: 1, frequencyUnit: 'times daily', durationValue: 7, 
      durationUnit: 'days', quantity: 7, instructions: '' 
    }];
    handleUpdate(newList);
  };

  const removeMed = (index: number) => {
    const newList = prescriptions.filter((_, idx) => idx !== index);
    handleUpdate(newList);
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
          variant="contained" startIcon={<AddCircleIcon />} 
          onClick={addMedication}
          sx={{ borderRadius: 3, fontWeight: 800, px: 3, height: 48 }}
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
              p: 4, borderRadius: 4, border: '2px solid',
              borderColor: med.isRequisition ? '#ff9800' : '#e0e0e0',
              position: 'relative', bgcolor: med.isRequisition ? '#fffcf5' : '#fff' 
            }}
          >
            <IconButton onClick={() => removeMed(i)} sx={{ position: 'absolute', top: 12, right: 12 }}>
              <DeleteIcon color="error"/>
            </IconButton>

            <Grid container spacing={3}>
              {/* Medicine Name (Expanded horizontally) */}
              <Grid item xs={12} md={9}>
                <Autocomplete
                  freeSolo options={inventoryMeds.map(m => m.name)} value={med.medicationName || ""}
                  onInputChange={(_, v) => updateMed(i, 'medicationName', v)}
                  renderInput={(p) => (
                    <TextField {...p} label="Medicine Name" variant="filled" 
                      helperText={med.isRequisition ? "Out of stock - this will trigger a Requisition order" : "In Stock"}
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

              {/* Dosage Split */}
              <Grid item xs={6} md={1.5}>
                <TextField fullWidth label="Dosage" type="number" value={med.dosageValue} onChange={(e) => updateMed(i, 'dosageValue', e.target.value)} />
              </Grid>
              <Grid item xs={6} md={1.5}>
                <FormControl fullWidth><InputLabel>Unit</InputLabel>
                  <Select value={med.dosageUnit} label="Unit" onChange={(e) => updateMed(i, 'dosageUnit', e.target.value)}>
                    <MenuItem value="mg">mg</MenuItem>
                    <MenuItem value="ml">ml</MenuItem>
                    <MenuItem value="tab">tab</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 2: Freq & Dur */}
              <Grid item xs={4} md={2}><TextField fullWidth label="Freq" type="number" value={med.frequencyValue} onChange={(e) => updateMed(i, 'frequencyValue', e.target.value)}/></Grid>
              <Grid item xs={8} md={3}>
                <FormControl fullWidth><InputLabel>Freq Unit</InputLabel>
                  <Select value={med.frequencyUnit} label="Freq Unit" onChange={(e) => updateMed(i, 'frequencyUnit', e.target.value)}>
                    <MenuItem value="times daily">times daily</MenuItem>
                    <MenuItem value="times weekly">times weekly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4} md={2}><TextField fullWidth label="Dur" type="number" value={med.durationValue} onChange={(e) => updateMed(i, 'durationValue', e.target.value)}/></Grid>
              <Grid item xs={8} md={3}>
                <FormControl fullWidth><InputLabel>Dur Unit</InputLabel>
                  <Select value={med.durationUnit} label="Dur Unit" onChange={(e) => updateMed(i, 'durationUnit', e.target.value)}>
                    <MenuItem value="days">days</MenuItem>
                    <MenuItem value="weeks">weeks</MenuItem>
                    <MenuItem value="months">months</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Total Quantity Display */}
              <Grid item xs={12} md={2}>
                <TextField 
                  fullWidth disabled label="Total Qty" value={med.quantity} 
                  InputProps={{ 
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalculateIcon color="primary" />
                      </InputAdornment>
                    ), 
                    sx: { fontWeight: 900, bgcolor: '#f0f7ff' } 
                  }} 
                />
              </Grid>

              {/* ROW 3: PHARMACIST INSTRUCTIONS (Dedicated horizontal row) */}
              <Grid item xs={12}>
                <Box sx={{ mt: 1 }}>
                  <Divider sx={{ mb: 2, borderStyle: 'dashed' }} />
                  <Typography variant="caption" fontWeight="900" color="primary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
                    Pharmacist Instructions
                  </Typography>
                  <TextField 
                    fullWidth multiline rows={3} variant="outlined" 
                    placeholder="Provide specific instructions for the pharmacist regarding dispensing..." 
                    value={med.instructions} onChange={(e) => updateMed(i, 'instructions', e.target.value)}
                    sx={{ bgcolor: '#fff', borderRadius: 2 }}
                  />
                </Box>
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>

      {!loading && inventoryMeds.length === 0 && (
        <Alert severity="warning" sx={{ mt: 4, borderRadius: 2 }} icon={<InventoryIcon />}>
          No inventory found. Requisitions will be created for all items.
        </Alert>
      )}
    </Box>
  );
};

export default PrescriptionBuilder;