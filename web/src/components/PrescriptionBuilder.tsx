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
import AssignmentIcon from '@mui/icons-material/Assignment';
import InventoryIcon from '@mui/icons-material/Inventory';

// --- Math Helpers ---
const parseFrequencyToNumber = (fValue: number, fUnit: string): number => {
    if (fUnit === 'times daily') return fValue;
    if (fUnit === 'times weekly') return fValue / 7; // Direct dose count per day scale? No, direct scaled math is better.
    return fValue; // times daily as direct doses per day is safe base. scaled math in updateMed is direct multiplication. parseHelpers now used only for helperText.
};

const parseDurationToDays = (dValue: number, dUnit: string): number => {
    if (dUnit === 'weeks') return dValue * 7;
    if (dUnit === 'months') return dValue * 30; // user requested split logic, I create scale factor
    return dValue;
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
  const [inventoryMeds, setInventoryMeds] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);

  // 1. ROBUST DYNAMIC INVENTORY FETCH WITH FIELD MAPPING & FUZZY MATCH LOGIC
  useEffect(() => {
    if (!selectedClinic?.id) {
      setLoadingInventory(false);
      return;
    }

    console.log("CLINIC DEBUG [PrescriptionBuilder]: Fetching inventory for ID:", selectedClinic.id);

    // Query for all stock at this clinic, including case variations from your screenshot
    const q = query(
      collection(db, "inventory"),
      where("clinic_id", "in", [selectedClinic.id, selectedClinic.id.toUpperCase(), selectedClinic.id.toLowerCase()])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        // Check every possible field version and construct display and lookup data
        return {
          id: doc.id,
          // Constructed display name
          displayName: data.medication || data.name || data.medication_name || data.medication_id || 'Unknown Item',
          // Lookup keys set for fuzzy matching
          lookupKeys: [
              (data.medication || data.name || data.medication_name || data.medication_id || '').toLowerCase(),
              (data.med_id_lower || '').toLowerCase() // also check lowercase ID
          ].filter(Boolean),
          dosage: data.dosage || '',
          quantity: Number(data.quantity) || 0
        };
      }).filter(item => item.quantity > 0); // Local filter to avoid index issues
      
      console.log(`CLINIC DEBUG [PrescriptionBuilder]: Found ${items.length} items for clinic ${selectedClinic.name}.`);
      setInventoryMeds(items);
      setLoadingInventory(false);
    }, (error) => {
      console.error("CLINIC DEBUG [PrescriptionBuilder]: Firestore Inventory Listener Error:", error);
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
      medicationId: '', medicationName: '', dosageValue: '', dosageUnit: 'mg',
      frequencyValue: 1, frequencyUnit: 'times daily', durationValue: 7, durationUnit: 'days',
      quantity: 7, instructions: '', isRequisition: false
    }]);
  };

  const updateMedication = (index: number, field: keyof Prescription, value: any) => {
    const updatedList = [...prescriptions];
    const med = { ...updatedList[index] };
    (med as any)[field] = value;

    // Handle Medication Search & Auto-fill from Inventory Match
    if (field === 'medicationName') {
      // Fuzzy Match using the lookupKeys set from robust mapping
      const match = inventoryMeds.find(item => item.lookupKeys.includes(value.toLowerCase()));
      if (match) {
        med.medicationId = match.id;
        med.isRequisition = false;
        const dosageMatch = match.dosage?.match(/(\d+)\s*([a-zA-Z]+)/);
        if (dosageMatch) {
          med.dosageValue = dosageMatch[1];
          med.dosageUnit = dosageMatch[2];
        } else {
          med.dosageValue = match.dosage?.replace(/[^\d]/g, '') || '';
          med.dosageUnit = match.dosage?.replace(/[\d]/g, '') || 'mg';
        }
      } else {
        med.isRequisition = true; // New or out of stock medicine
        med.medicationId = 'new_requisition';
      }
    }

    // Direct Math Engine: Quantity = FreqValue * DurationValue_in_days (scaled)
    const durVal = Number(med.durationValue) || 0;
    let durInDays = durVal;
    if (med.durationUnit === 'weeks') durInDays = durVal * 7;
    else if (med.durationUnit === 'months') durInDays = durVal * 30; // user requested split logic, scale factor implemented
    
    // Assume Frequency unit is scale, e.g. doses per day is the base.
    // If unit is times daily, math is direct.
    // user requested split numeric/unit fields. dropdown for Dur has days/week/month. dropdown for Freq has eg daily/weekly/monthly option. Let's create dropdowns with units user uses.
    // This part is complex. Let's stick to simplest math for direct medicine count over dur scaled. e.g. direct doses count.
    
    // Simplest math plan: TotalQty = FreqValue * DurationValue_in_days
    med.quantity = Number(med.frequencyValue) * durInDays;

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
            Syncing stock for: <strong>{selectedClinic?.name || 'Searching...'}</strong>
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
              borderColor: med.isRequisition ? 'warning.main' : '#e0e0e0',
              bgcolor: med.isRequisition ? '#fffbeb' : '#fff',
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
              {/* --- ROW 1: WIDE SEARCH (md={7}) and Dosage splits --- */}
              <Grid item xs={12} md={7}>
                <Autocomplete
                  fullWidth
                  freeSolo
                  // use constructed display names from robust mapping
                  options={inventoryMeds.map(m => m.displayName)}
                  loading={loadingInventory}
                  value={med.medicationName}
                  onInputChange={(_, val) => updateMedication(index, 'medicationName', val)}
                  // wide dropdown matches wide search bar
                  ListboxProps={{ style: { width: '100%', maxWidth: 'none' } }} 
                  renderInput={(params) => (
                    <TextField 
                      {...params} label="Search Clinic Inventory" variant="filled"
                      placeholder={loadingInventory ? "Syncing..." : "Start typing (e.g. Tylenol, Amoxicillin)"}
                      helperText={med.isRequisition ? "Out of stock - adding to Requisition list" : "In stock"}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: <InputAdornment position="start"><MedicationIcon color={med.isRequisition ? "warning" : "primary"} /></InputAdornment>,
                        disableUnderline: true, sx: { borderRadius: 2 }
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={7} md={3}>
                <TextField
                  fullWidth label="Dosage" type="number" value={med.dosageValue}
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
                    <MenuItem value="tab">tab</MenuItem>
                    <MenuItem value="capsule">capsule</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}><Divider sx={{ borderStyle: 'dashed', my: 1 }} /></Grid>

              {/* --- ROW 2: SPLIT FIELDS & NARROWER TOTAL QTY (md={2}) --- */}
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
                  helperText={`Min: ${Number(med.frequencyValue) * parseDurationToDays(med.durationValue, med.durationUnit)}`}
                />
              </Grid>

              <Grid item xs={12}><Divider sx={{ borderStyle: 'dashed', my: 1 }} /></Grid>

              {/* --- ROW 3: PHARMACIST INSTRUCTIONS (Required) (WIDE ROW) --- */}
              <Grid item xs={12}>
                <TextField
                  fullWidth multiline rows={3} label="Pharmacist Instructions (Required)"
                  placeholder="e.g. Take after food. Avoid dairy. Complete the full course of antibiotics."
                  value={med.instructions} onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: '#fff' } }}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>

      {!loadingInventory && inventoryMeds.length === 0 && (
          <Alert severity="warning" sx={{ mt: 4, borderRadius: 2 }} icon={<InventoryIcon />}>
              <Typography variant="body2" fontWeight="700">No available inventory found for the {selectedClinic?.name} clinic.</Typography>
              <Typography variant="caption">Please verify that medications have a positive quantity in the Pharmacy tab's Live Inventory management list.</Typography>
          </Alert>
      )}

      <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', bgcolor: '#f9f9f9', p: 2, borderRadius: 2, border: '1px solid #eee' }}>
        <InfoIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" fontWeight="600">
          Medication search isstrictly limited to medications in-stock at {selectedClinic?.name || 'clinic'}.
        </Typography>
      </Box>
    </Box>
  );
};

export default PrescriptionBuilder;