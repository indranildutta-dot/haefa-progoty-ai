import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, TextField, Button, IconButton, Paper, Stack, 
  Autocomplete, Grid, Tooltip, Alert, InputAdornment, Divider, CircularProgress
} from '@mui/material';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';

// Icons
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CalculateIcon from '@mui/icons-material/Calculate';
import MedicationIcon from '@mui/icons-material/Medication';
import InventoryIcon from '@mui/icons-material/Inventory';
import InfoIcon from '@mui/icons-material/Info';

// --- Clinical Math Helpers ---
const parseFrequencyToNumber = (freq: string): number => {
  const f = freq.toLowerCase();
  if (f.includes('4') || f.includes('four')) return 4;
  if (f.includes('3') || f.includes('three')) return 3;
  if (f.includes('2') || f.includes('twice')) return 2;
  if (f.includes('1') || f.includes('once') || f.includes('daily')) return 1;
  return 1;
};

const parseDurationToDays = (dur: string): number => {
  const d = dur.toLowerCase();
  const numericMatch = d.match(/\d+/);
  const num = numericMatch ? parseInt(numericMatch[0]) : 1;
  if (d.includes('week')) return num * 7;
  if (d.includes('month')) return num * 30;
  return num; 
};

interface Prescription {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
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
  const [inventoryMeds, setInventoryMeds] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);

  // 1. Live Inventory Listener (Filtered by Clinic and Stock)
  useEffect(() => {
    if (!selectedClinic?.id) return;

    const q = query(
      collection(db, "inventory"),
      where("clinic_id", "==", selectedClinic.id),
      where("quantity", ">", 0)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInventoryMeds(items);
      setLoadingInventory(false);
    });

    return () => unsubscribe();
  }, [selectedClinic]);

  // 2. Safety Sync with Parent (prevents "not a function" crash)
  useEffect(() => {
    if (typeof onPrescriptionChange === 'function') {
      onPrescriptionChange(prescriptions);
    }
  }, [prescriptions, onPrescriptionChange]);

  const handleAddMedication = () => {
    setPrescriptions([...prescriptions, {
      medicationId: '', medicationName: '', dosage: '',
      frequency: '1 time daily', duration: '7 days', quantity: 7, instructions: ''
    }]);
  };

  const handleRemoveMedication = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof Prescription, value: any) => {
    const updatedList = [...prescriptions];
    const currentMed = { ...updatedList[index] };
    (currentMed as any)[field] = value;

    // Auto-fill Dosage from Inventory Match
    if (field === 'medicationName') {
      const match = inventoryMeds.find(m => m.name === value);
      if (match) {
        currentMed.medicationId = match.medication_id || match.id;
        currentMed.dosage = match.dosage || '';
      }
    }

    // Safety Math Logic
    const freqVal = parseFrequencyToNumber(currentMed.frequency);
    const daysVal = parseDurationToDays(currentMed.duration);
    const minCalculated = freqVal * daysVal;

    if (field === 'frequency' || field === 'duration') {
      currentMed.quantity = minCalculated;
    }
    if (field === 'quantity') {
      currentMed.quantity = value < minCalculated ? minCalculated : value;
    }

    updatedList[index] = currentMed;
    setPrescriptions(updatedList);
  };

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h5" fontWeight="900" color="primary">PRESCRIPTION BUILDER</Typography>
          <Typography variant="body2" color="text.secondary">
            Syncing stock for <strong>{selectedClinic?.name || 'Current Clinic'}</strong>
          </Typography>
        </Box>
        <Button 
          variant="contained" startIcon={<AddCircleIcon />} onClick={handleAddMedication}
          sx={{ borderRadius: 3, fontWeight: 800, px: 4, height: '48px' }}
        >
          Add Medicine
        </Button>
      </Stack>

      <Stack spacing={4}>
        {prescriptions.map((med, index) => (
          <Paper 
            key={index} elevation={0}
            sx={{ 
              p: 4, borderRadius: 4, border: '1px solid #e0e0e0', position: 'relative',
              transition: '0.2s ease-in-out',
              '&:hover': { borderColor: 'primary.main', bgcolor: '#fcfdff' }
            }}
          >
            <IconButton 
              onClick={() => handleRemoveMedication(index)}
              sx={{ position: 'absolute', top: 16, right: 16, color: 'error.main', bgcolor: '#fff1f1' }}
            >
              <DeleteIcon />
            </IconButton>

            <Grid container spacing={3}>
              {/* Row 1: Search & Dosage */}
              <Grid item xs={12} md={8}>
                <Autocomplete
                  fullWidth
                  freeSolo
                  options={inventoryMeds.map(m => m.name)}
                  loading={loadingInventory}
                  value={med.medicationName}
                  onInputChange={(_, val) => updateMedication(index, 'medicationName', val)}
                  ListboxProps={{ style: { width: '100%', maxWidth: 'none' } }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Search Clinic Inventory" 
                      variant="filled"
                      placeholder={loadingInventory ? "Syncing..." : "Search Tylenol, Amoxicillin..."}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <InputAdornment position="start"><InventoryIcon color="primary" /></InputAdornment>,
                        disableUnderline: true,
                        sx: { borderRadius: 2 }
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth label="Dosage Strength" variant="outlined" value={med.dosage}
                  onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              <Grid item xs={12}><Divider sx={{ borderStyle: 'dashed' }} /></Grid>

              {/* Row 2: Timing & Quantity */}
              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo options={['1 time daily', '2 times daily', '3 times daily', '4 times daily']}
                  value={med.frequency} onInputChange={(_, val) => updateMedication(index, 'frequency', val)}
                  renderInput={(params) => <TextField {...params} label="Frequency" variant="outlined" />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo options={['3 days', '5 days', '7 days', '2 weeks', '1 month']}
                  value={med.duration} onInputChange={(_, val) => updateMedication(index, 'duration', val)}
                  renderInput={(params) => <TextField {...params} label="Duration" variant="outlined" />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth type="number" label="Total Quantity" value={med.quantity}
                  onChange={(e) => updateMedication(index, 'quantity', Number(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><CalculateIcon color="primary" /></InputAdornment>,
                    sx: { fontWeight: 900, borderRadius: 2, bgcolor: '#f0f7ff' }
                  }}
                  helperText={`Minimum Required: ${parseFrequencyToNumber(med.frequency) * parseDurationToDays(med.duration)}`}
                />
              </Grid>

              {/* Row 3: Instructions */}
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline rows={2} label="Pharmacist Instructions"
                  placeholder="e.g., Take after meals, complete the full course..."
                  value={med.instructions} onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>

      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', bgcolor: '#f8f9fa', p: 2, borderRadius: 2 }}>
        <InfoIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" fontWeight="500">
          The Total Quantity is automatically calculated based on the therapeutic window to prevent dispensing errors.
        </Typography>
      </Box>
    </Box>
  );
};

export default PrescriptionBuilder;