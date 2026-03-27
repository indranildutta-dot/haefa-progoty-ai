import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, TextField, Button, IconButton, Paper, Stack, 
  Autocomplete, Grid, InputAdornment, Divider, CircularProgress, 
  MenuItem, Select, FormControl, InputLabel, FormHelperText
} from '@mui/material';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';

// Icons
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CalculateIcon from '@mui/icons-material/Calculate';
import MedicationIcon from '@mui/icons-material/Medication';
import InfoIcon from '@mui/icons-material/Info';

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

  // 1. Live Inventory Listener: Ensures the Doctor only sees what the Pharmacy has
  useEffect(() => {
    if (!selectedClinic?.id) {
      setLoadingInventory(false);
      return;
    }

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
    }, (error) => {
      console.error("Firestore Inventory Error:", error);
      setLoadingInventory(false);
    });

    return () => unsubscribe();
  }, [selectedClinic]);

  // 2. Safety Sync with Parent (ConsultationPanel)
  useEffect(() => {
    if (typeof onPrescriptionChange === 'function') {
      onPrescriptionChange(prescriptions);
    }
  }, [prescriptions, onPrescriptionChange]);

  const handleAddMedication = () => {
    setPrescriptions([...prescriptions, {
      medicationId: '', medicationName: '', dosageValue: '', dosageUnit: 'mg',
      frequencyValue: 1, frequencyUnit: 'daily', durationValue: 7, durationUnit: 'days',
      quantity: 7, instructions: ''
    }]);
  };

  const updateMedication = (index: number, field: keyof Prescription, value: any) => {
    const updatedList = [...prescriptions];
    const med = { ...updatedList[index] };
    (med as any)[field] = value;

    // Medication Auto-Fill Logic
    if (field === 'medicationName') {
      const match = inventoryMeds.find(m => m.name === value);
      if (match) {
        med.medicationId = match.id;
        // Attempt to parse existing dosage string (e.g., "500mg" -> 500 and mg)
        const dosageMatch = match.dosage?.match(/(\d+)\s*([a-zA-Z]+)/);
        if (dosageMatch) {
          med.dosageValue = dosageMatch[1];
          med.dosageUnit = dosageMatch[2];
        } else {
          med.dosageValue = match.dosage || '';
        }
      }
    }

    // Calculation Logic: Frequency * Duration = Quantity
    // This ensures no math errors between doctor and pharmacist
    const freq = Number(med.frequencyValue) || 0;
    const dur = Number(med.durationValue) || 0;
    med.quantity = freq * dur;

    updatedList[index] = med;
    setPrescriptions(updatedList);
  };

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h5" fontWeight="900" color="primary" sx={{ letterSpacing: -0.5 }}>
            PRESCRIPTION BUILDER
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Authorized Inventory for: <strong>{selectedClinic?.name || 'Searching...'}</strong>
          </Typography>
        </Box>
        <Button 
          variant="contained" startIcon={<AddCircleIcon />} onClick={handleAddMedication}
          sx={{ borderRadius: 3, fontWeight: 800, px: 4, height: '48px', boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)' }}
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
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: 'primary.main', bgcolor: '#fcfdff' }
            }}
          >
            {/* Delete Button */}
            <IconButton 
              onClick={() => setPrescriptions(prescriptions.filter((_, i) => i !== index))}
              sx={{ position: 'absolute', top: 16, right: 16, color: 'error.main', bgcolor: '#fff1f1', '&:hover': { bgcolor: '#ffe0e0' } }}
            >
              <DeleteIcon />
            </IconButton>

            <Grid container spacing={3}>
              {/* ROW 1: MEDICATION SEARCH (FULL WIDTH ON TABLET) */}
              <Grid item xs={12} md={7}>
                <Autocomplete
                  fullWidth
                  options={inventoryMeds.map(m => m.name)}
                  loading={loadingInventory}
                  value={med.medicationName}
                  onInputChange={(_, val) => updateMedication(index, 'medicationName', val)}
                  ListboxProps={{ style: { width: '100%' } }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} label="Search Clinic Inventory" variant="filled"
                      placeholder={loadingInventory ? "Syncing..." : "e.g. Tylenol, Amoxicillin"}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <InputAdornment position="start"><MedicationIcon color="primary" /></InputAdornment>,
                        disableUnderline: true, sx: { borderRadius: 2 }
                      }}
                    />
                  )}
                />
              </Grid>

              {/* DOSAGE SPLIT */}
              <Grid item xs={7} md={3}>
                <TextField
                  fullWidth label="Dosage Strength" type="number" value={med.dosageValue}
                  onChange={(e) => updateMedication(index, 'dosageValue', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>
              
              <Grid item xs={5} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={med.dosageUnit} label="Unit"
                    onChange={(e) => updateMedication(index, 'dosageUnit', e.target.value)}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="mg">mg</MenuItem>
                    <MenuItem value="ml">ml</MenuItem>
                    <MenuItem value="tablet">tablet</MenuItem>
                    <MenuItem value="capsule">capsule</MenuItem>
                    <MenuItem value="IU">IU</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}><Divider sx={{ borderStyle: 'dashed', my: 1 }} /></Grid>

              {/* ROW 2: FREQUENCY & DURATION SPLITS */}
              <Grid item xs={4} md={2}>
                <TextField 
                  fullWidth type="number" label="Freq" value={med.frequencyValue}
                  onChange={(e) => updateMedication(index, 'frequencyValue', e.target.value)}
                />
              </Grid>
              <Grid item xs={8} md={2.5}>
                <FormControl fullWidth>
                  <InputLabel>Frequency Unit</InputLabel>
                  <Select
                    value={med.frequencyUnit} label="Frequency Unit"
                    onChange={(e) => updateMedication(index, 'frequencyUnit', e.target.value)}
                  >
                    <MenuItem value="daily">times daily</MenuItem>
                    <MenuItem value="weekly">times weekly</MenuItem>
                    <MenuItem value="monthly">times monthly</MenuItem>
                    <MenuItem value="as needed">as needed (PRN)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={4} md={2}>
                <TextField 
                  fullWidth type="number" label="Duration" value={med.durationValue}
                  onChange={(e) => updateMedication(index, 'durationValue', e.target.value)}
                />
              </Grid>
              <Grid item xs={8} md={2.5}>
                <FormControl fullWidth>
                  <InputLabel>Duration Unit</InputLabel>
                  <Select
                    value={med.durationUnit} label="Duration Unit"
                    onChange={(e) => updateMedication(index, 'durationUnit', e.target.value)}
                  >
                    <MenuItem value="days">days</MenuItem>
                    <MenuItem value="weeks">weeks</MenuItem>
                    <MenuItem value="months">months</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth disabled label="Total Quantity" value={med.quantity}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><CalculateIcon color="primary" sx={{ opacity: 0.6 }} /></InputAdornment>,
                    sx: { fontWeight: 900, bgcolor: '#f0f7ff', borderRadius: 2 }
                  }}
                  helperText="Auto-calculated quantity"
                />
              </Grid>

              {/* ROW 3: PHARMACIST INSTRUCTIONS (WIDE) */}
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline rows={2} label="Pharmacist Instructions (Optional)"
                  placeholder="e.g. Take after food. Avoid dairy for 2 hours. Complete full course."
                  value={med.instructions} onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>

      <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', bgcolor: '#f9f9f9', p: 2, borderRadius: 2, border: '1px solid #eee' }}>
        <InfoIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" fontWeight="600">
          The Medication list is filtered by live inventory at {selectedClinic?.name || 'the clinic'}.
        </Typography>
      </Box>
    </Box>
  );
};

export default PrescriptionBuilder;