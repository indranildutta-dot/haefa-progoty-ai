import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, TextField, Button, IconButton, Paper, Stack, 
  Autocomplete, Grid, InputAdornment, Divider, CircularProgress, 
  MenuItem, Select, FormControl, InputLabel, Alert
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
import InventoryIcon from '@mui/icons-material/Inventory';

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

  // 1. DYNAMIC INVENTORY FETCH WITH POWERFUL DEBUGGING
  useEffect(() => {
    if (!selectedClinic?.id) {
      setLoadingInventory(false);
      return;
    }

    console.log("DEBUG [PrescriptionBuilder]: Setting up inventory listener for clinic_id:", selectedClinic.id);

    // The query: look for in-stock items (> 0) at the current clinic.
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
      
      console.log(`DEBUG [PrescriptionBuilder]: Snapshot received for ${selectedClinic.name}. Found ${items.length} in-stock medications.`);
      
      if (items.length === 0) {
        console.warn(`DEBUG [PrescriptionBuilder]: Zero in-stock medications found for clinic ID ${selectedClinic.id}. Please check the 'inventory' collection in Firestore for this clinic.`);
      }

      setInventoryMeds(items);
      setLoadingInventory(false);
    }, (error) => {
      console.error("DEBUG [PrescriptionBuilder]: Firestore Inventory Listener Error:", error);
      notify("Firestore database error. See console.", "error");
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
      frequencyValue: 1, frequencyUnit: 'times daily', durationValue: 7, durationUnit: 'days',
      quantity: 7, instructions: ''
    }]);
  };

  const updateMedication = (index: number, field: keyof Prescription, value: any) => {
    const updatedList = [...prescriptions];
    const med = { ...updatedList[index] };
    (med as any)[field] = value;

    // Auto-fill Dosage from Inventory Match
    if (field === 'medicationName') {
      const match = inventoryMeds.find(m => m.name === value);
      if (match) {
        med.medicationId = match.id;
        const dosageMatch = match.dosage?.match(/(\d+)\s*([a-zA-Z]+)/);
        if (dosageMatch) {
          med.dosageValue = dosageMatch[1];
          med.dosageUnit = dosageMatch[2];
        } else {
          med.dosageValue = match.dosage || '';
        }
      }
    }

    // Dynamic Math: Quantity = Freq * Duration
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
              {/* Row 1: Search and Dosage (FULL WIDTH CARD ON TABLET) */}
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

              {/* Row 2: Frequency and Duration splits */}
              <Grid item xs={4} md={2}>
                <TextField 
                  fullWidth type="number" label="Freq" value={med.frequencyValue}
                  onChange={(e) => updateMedication(index, 'frequencyValue', e.target.value)}
                />
              </Grid>
              <Grid item xs={8} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Frequency Unit</InputLabel>
                  <Select
                    value={med.frequencyUnit} label="Frequency Unit"
                    onChange={(e) => updateMedication(index, 'frequencyUnit', e.target.value)}
                  >
                    <MenuItem value="times daily">times daily</MenuItem>
                    <MenuItem value="times weekly">times weekly</MenuItem>
                    <MenuItem value="times monthly">times monthly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={4} md={2}>
                <TextField 
                  fullWidth type="number" label="Duration" value={med.durationValue}
                  onChange={(e) => updateMedication(index, 'durationValue', e.target.value)}
                />
              </Grid>
              <Grid item xs={8} md={3}>
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

              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth disabled label="Total Qty" value={med.quantity}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><CalculateIcon color="primary" sx={{ opacity: 0.6 }} /></InputAdornment>,
                    sx: { fontWeight: 900, bgcolor: '#f0f7ff', borderRadius: 2 }
                  }}
                  helperText="Freq × Dur"
                />
              </Grid>

              <Grid item xs={12}><Divider sx={{ borderStyle: 'dashed', mt: 1 }} /></Grid>

              {/* ROW 3: PHARMACIST INSTRUCTIONS (WIDE, OWN ROW) */}
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline rows={4} label="Pharmacist Instructions (Required)"
                  placeholder="e.g. Take after food. Avoid dairy. Complete the full course of antibiotics."
                  value={med.instructions} onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>
      
      {/* 3. USER-FRIENDLY ERROR MESSAGING */}
      {selectedClinic && !loadingInventory && inventoryMeds.length === 0 && (
          <Alert severity="warning" sx={{ mt: 4, borderRadius: 2 }} icon={<InventoryIcon />}>
              <Typography variant="body2" fontWeight="700">No available inventory found for the {selectedClinic.name} clinic.</Typography>
              <Typography variant="caption">Please verify that you have successfully used the Batch Uploader in the Pharmacy tab to stock this clinic with medications that have a positive quantity.</Typography>
          </Alert>
      )}

      <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', bgcolor: '#f9f9f9', p: 2, borderRadius: 2, border: '1px solid #eee' }}>
        <InfoIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" fontWeight="600">
          The Medication search list is strictly limited to medications currently in-stock at the {selectedClinic?.name || 'clinic'}.
        </Typography>
      </Box>
    </Box>
  );
};

export default PrescriptionBuilder;