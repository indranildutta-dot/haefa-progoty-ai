import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, TextField, Button, IconButton, Paper, Stack, 
  Autocomplete, Grid, InputAdornment, Divider, MenuItem, Select, FormControl, InputLabel, Alert
} from '@mui/material';
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

const PrescriptionBuilder: React.FC<{ onPrescriptionChange?: (p: Prescription[]) => void; initialData?: Prescription[]; }> = ({ onPrescriptionChange, initialData = [] }) => {
  const { selectedClinic } = useAppStore();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialData);
  const [inventoryMeds, setInventoryMeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Corrected Sub-collection Listener (clinics/{id}/inventory)
  useEffect(() => {
    if (!selectedClinic?.id) return;

    // Direct path based on your Firestore breadcrumbs
    const inventoryRef = collection(db, "clinics", selectedClinic.id, "inventory");
    
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          // Field mapping from your screenshot: medication_id is the primary name
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

  useEffect(() => {
    onPrescriptionChange?.(prescriptions);
  }, [prescriptions, onPrescriptionChange]);

  const updateMed = (index: number, field: keyof Prescription, value: any) => {
    const updated = [...prescriptions];
    const med = { ...updated[index], [field]: value };

    if (field === 'medicationName') {
      const match = inventoryMeds.find(m => m.name.toLowerCase() === value.toLowerCase());
      if (match) {
        med.medicationId = match.id;
        med.isRequisition = false;
        // Basic parsing for dosage strings
        const dMatch = match.dosage?.match(/(\d+)\s*([a-zA-Z]+)/);
        if (dMatch) { med.dosageValue = dMatch[1]; med.dosageUnit = dMatch[2]; }
      } else {
        med.isRequisition = true; 
      }
    }

    // Calculation Logic: Frequency * Duration (converted to days)
    const durVal = Number(med.durationValue) || 0;
    let days = durVal;
    if (med.durationUnit === 'weeks') days = durVal * 7;
    if (med.durationUnit === 'months') days = durVal * 30;
    
    med.quantity = (Number(med.frequencyValue) || 0) * days;

    updated[index] = med;
    setPrescriptions(updated);
  };

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h5" fontWeight="900" color="primary">PRESCRIPTION BUILDER</Typography>
          <Typography variant="body2" color="text.secondary">Path: clinics/<strong>{selectedClinic?.id}</strong>/inventory</Typography>
        </Box>
        <Button 
          variant="contained" startIcon={<AddCircleIcon />} 
          onClick={() => setPrescriptions([...prescriptions, { medicationId: '', medicationName: '', dosageValue: '', dosageUnit: 'mg', frequencyValue: 1, frequencyUnit: 'times daily', durationValue: 7, durationUnit: 'days', quantity: 7, instructions: '' }])}
          sx={{ borderRadius: 3, fontWeight: 800, height: '48px' }}
        >
          Add Medicine
        </Button>
      </Stack>

      <Stack spacing={4}>
        {prescriptions.map((med, i) => (
          <Paper key={i} elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #e0e0e0', position: 'relative', bgcolor: med.isRequisition ? '#fffbeb' : '#fff' }}>
            <IconButton onClick={() => setPrescriptions(prescriptions.filter((_, idx) => idx !== i))} sx={{ position: 'absolute', top: 16, right: 16 }}><DeleteIcon color="error"/></IconButton>

            <Grid container spacing={3}>
              {/* ROW 1: SEARCH & DOSAGE */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo options={inventoryMeds.map(m => m.name)} value={med.medicationName}
                  onInputChange={(_, v) => updateMed(i, 'medicationName', v)}
                  renderInput={(p) => (
                    <TextField {...p} label="Medicine Name" variant="filled" 
                      helperText={med.isRequisition ? "Out of stock - this will trigger a Requisition order" : "In Stock"}
                      InputProps={{ ...p.InputProps, startAdornment: <MedicationIcon sx={{ mr: 1 }} color={med.isRequisition ? "warning" : "primary"}/> }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={6} md={3}><TextField fullWidth label="Dosage" type="number" value={med.dosageValue} onChange={(e) => updateMed(i, 'dosageValue', e.target.value)} /></Grid>
              <Grid item xs={6} md={3}>
                <FormControl fullWidth><InputLabel>Unit</InputLabel>
                  <Select value={med.dosageUnit} label="Unit" onChange={(e) => updateMed(i, 'dosageUnit', e.target.value)}><MenuItem value="mg">mg</MenuItem><MenuItem value="ml">ml</MenuItem><MenuItem value="tab">tab</MenuItem></Select>
                </FormControl>
              </Grid>

              {/* ROW 2: FREQ, DUR, TOTAL QTY (NARROW) */}
              <Grid item xs={4} md={2}><TextField fullWidth label="Freq" type="number" value={med.frequencyValue} onChange={(e) => updateMed(i, 'frequencyValue', e.target.value)}/></Grid>
              <Grid item xs={8} md={3}>
                <FormControl fullWidth><InputLabel>Freq Unit</InputLabel>
                  <Select value={med.frequencyUnit} label="Freq Unit" onChange={(e) => updateMed(i, 'frequencyUnit', e.target.value)}><MenuItem value="times daily">times daily</MenuItem><MenuItem value="times weekly">times weekly</MenuItem></Select>
                </FormControl>
              </Grid>
              <Grid item xs={4} md={2}><TextField fullWidth label="Dur" type="number" value={med.durationValue} onChange={(e) => updateMed(i, 'durationValue', e.target.value)}/></Grid>
              <Grid item xs={8} md={3}>
                <FormControl fullWidth><InputLabel>Dur Unit</InputLabel>
                  <Select value={med.durationUnit} label="Dur Unit" onChange={(e) => updateMed(i, 'durationUnit', e.target.value)}><MenuItem value="days">days</MenuItem><MenuItem value="weeks">weeks</MenuItem><MenuItem value="months">months</MenuItem></Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth disabled label="Total Qty" value={med.quantity} InputProps={{ startAdornment: <CalculateIcon sx={{ mr: 1 }} color="primary" />, sx: { fontWeight: 900, bgcolor: '#f0f7ff' } }} />
              </Grid>

              {/* ROW 3: PHARMACIST INSTRUCTIONS (FULL WIDTH) */}
              <Grid item xs={12}>
                <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
                <Typography variant="caption" fontWeight="900" color="primary" sx={{ display: 'block', mb: 1, mt: 1 }}>PHARMACIST INSTRUCTIONS</Typography>
                <TextField 
                  fullWidth multiline rows={3} variant="outlined" 
                  placeholder="Notes for the pharmacist regarding dispensing or patient care..." 
                  value={med.instructions} onChange={(e) => updateMed(i, 'instructions', e.target.value)}
                  sx={{ bgcolor: '#fff', borderRadius: 2 }}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>

      {!loading && inventoryMeds.length === 0 && (
          <Alert severity="warning" sx={{ mt: 4, borderRadius: 2 }} icon={<InventoryIcon />}>
              No inventory found in <strong>clinics/{selectedClinic?.id}/inventory</strong>. Please verify the Dhaka clinic ID in Firestore.
          </Alert>
      )}
    </Box>
  );
};

export default PrescriptionBuilder;