import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, TextField, Button, IconButton, Paper, Stack, 
  Autocomplete, Grid, InputAdornment, Divider, MenuItem, Select, FormControl, InputLabel, Alert
} from '@mui/material';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';

// Icons
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CalculateIcon from '@mui/icons-material/Calculate';
import MedicationIcon from '@mui/icons-material/Medication';
import AssignmentIcon from '@mui/icons-material/Assignment';

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
  onPrescriptionChange?: (prescriptions: Prescription[]) => void;
  initialData?: Prescription[];
}

const PrescriptionBuilder: React.FC<PrescriptionBuilderProps> = ({ 
  onPrescriptionChange, 
  initialData = [] 
}) => {
  const { selectedClinic } = useAppStore();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialData);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Live Inventory Listener (Mapped to your Firestore screenshot)
  useEffect(() => {
    if (!selectedClinic?.id) return;
    
    // Check both clinic_id and clinic_ID as seen in your DB screenshot
    const q = query(
      collection(db, "inventory"), 
      where("clinic_id", "in", [selectedClinic.id, selectedClinic.id.toUpperCase(), selectedClinic.id.toLowerCase()])
    );
    
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.medication || d.name || d.medication_name || 'Unknown',
          dosage: d.dosage || '',
          quantity: Number(d.quantity) || 0
        };
      });
      setInventory(items);
      setLoading(false);
    }, () => setLoading(false));
  }, [selectedClinic]);

  // 2. Sync with Consultation Panel
  useEffect(() => {
    onPrescriptionChange?.(prescriptions);
  }, [prescriptions, onPrescriptionChange]);

  const updateMed = (index: number, field: keyof Prescription, value: any) => {
    const updated = [...prescriptions];
    const med = { ...updated[index], [field]: value };

    // Auto-fill and Requisition Logic
    if (field === 'medicationName') {
      const match = inventory.find(i => i.name.toLowerCase() === value.toLowerCase());
      if (match) {
        med.medicationId = match.id;
        med.isRequisition = false;
        // Parse "500mg" into 500 and mg
        const dMatch = match.dosage?.match(/(\d+)\s*([a-zA-Z]+)/);
        if (dMatch) {
          med.dosageValue = dMatch[1];
          med.dosageUnit = dMatch[2];
        }
      } else {
        med.isRequisition = true; // Not found in clinic inventory
        med.medicationId = 'new_requisition';
      }
    }

    // Math: Quantity = Freq * Duration
    const freq = Number(med.frequencyValue) || 0;
    const dur = Number(med.durationValue) || 0;
    med.quantity = freq * dur;

    updated[index] = med;
    setPrescriptions(updated);
  };

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Stack direction="row" justifyContent="space-between" mb={4}>
        <Box>
          <Typography variant="h5" fontWeight="900" color="primary">PRESCRIPTION BUILDER</Typography>
          <Typography variant="body2" color="text.secondary">Authorized for: <strong>{selectedClinic?.name}</strong></Typography>
        </Box>
        <Button 
          variant="contained" startIcon={<AddCircleIcon />} 
          onClick={() => setPrescriptions([...prescriptions, { 
            medicationId: '', medicationName: '', dosageValue: '', dosageUnit: 'mg', 
            frequencyValue: 1, frequencyUnit: 'times daily', durationValue: 7, durationUnit: 'days', 
            quantity: 7, instructions: '', isRequisition: false 
          }])}
          sx={{ borderRadius: 3, fontWeight: 800, height: '48px' }}
        >
          Add Medicine
        </Button>
      </Stack>

      <Stack spacing={4}>
        {prescriptions.map((med, i) => (
          <Paper key={i} variant="outlined" sx={{ p: 4, borderRadius: 4, position: 'relative', borderColor: med.isRequisition ? 'warning.main' : '#e0e0e0', bgcolor: med.isRequisition ? '#fffbeb' : '#fff' }}>
            <IconButton onClick={() => setPrescriptions(prescriptions.filter((_, idx) => idx !== i))} sx={{ position: 'absolute', top: 16, right: 16 }}><DeleteIcon color="error"/></IconButton>

            <Grid container spacing={3}>
              <Grid item xs={12} md={7}>
                <Autocomplete
                  freeSolo
                  options={inventory.map(m => m.name)}
                  value={med.medicationName}
                  onInputChange={(_, v) => updateMed(i, 'medicationName', v)}
                  renderInput={(p) => (
                    <TextField {...p} label="Medicine Name" variant="filled" 
                      helperText={med.isRequisition ? "Out of stock - adding to Requisition list" : "Current Stock: Available"}
                      InputProps={{ ...p.InputProps, startAdornment: <MedicationIcon sx={{ mr: 1 }} color={med.isRequisition ? "warning" : "primary"}/> }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={7} md={3}><TextField fullWidth label="Dosage" type="number" value={med.dosageValue} onChange={(e) => updateMed(i, 'dosageValue', e.target.value)} /></Grid>
              <Grid item xs={5} md={2}>
                <FormControl fullWidth><InputLabel>Unit</InputLabel>
                  <Select value={med.dosageUnit} label="Unit" onChange={(e) => updateMed(i, 'dosageUnit', e.target.value)}><MenuItem value="mg">mg</MenuItem><MenuItem value="ml">ml</MenuItem><MenuItem value="tab">tab</MenuItem></Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}><Divider sx={{ borderStyle: 'dashed', my: 1 }} /></Grid>

              <Grid item xs={4} md={2}><TextField fullWidth label="Freq" type="number" value={med.frequencyValue} onChange={(e) => updateMed(i, 'frequencyValue', e.target.value)}/></Grid>
              <Grid item xs={8} md={3}>
                <FormControl fullWidth><InputLabel>Freq Unit</InputLabel>
                  <Select value={med.frequencyUnit} label="Freq Unit" onChange={(e) => updateMed(i, 'frequencyUnit', e.target.value)}><MenuItem value="times daily">times daily</MenuItem><MenuItem value="times weekly">times weekly</MenuItem></Select>
                </FormControl>
              </Grid>
              <Grid item xs={4} md={2}><TextField fullWidth label="Dur" type="number" value={med.durationValue} onChange={(e) => updateMed(i, 'durationValue', e.target.value)}/></Grid>
              <Grid item xs={8} md={3}>
                <FormControl fullWidth><InputLabel>Dur Unit</InputLabel>
                  <Select value={med.durationUnit} label="Dur Unit" onChange={(e) => updateMed(i, 'durationUnit', e.target.value)}><MenuItem value="days">days</MenuItem><MenuItem value="weeks">weeks</MenuItem></Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField fullWidth disabled label="Total Qty" value={med.quantity} InputProps={{ startAdornment: <CalculateIcon sx={{ mr: 1 }} color="primary" />, sx: { fontWeight: 900, bgcolor: '#f0f7ff' } }} />
              </Grid>

              <Grid item xs={12}>
                <TextField fullWidth multiline rows={4} label="Pharmacist Instructions" value={med.instructions} onChange={(e) => updateMed(i, 'instructions', e.target.value)} placeholder="Type specific instructions for the patient or pharmacist here..." />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

export default PrescriptionBuilder;