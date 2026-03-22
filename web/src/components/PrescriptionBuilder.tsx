import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Grid, 
  Paper, 
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Autocomplete,
  CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { Prescription } from '../types';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';

interface PrescriptionBuilderProps {
  prescriptions: Prescription[];
  onChange: (prescriptions: Prescription[]) => void;
}

interface InventoryItem {
  medication_id: string;
  med_id_lower: string;
  dosage: string;
  dosage_normalized: string;
  quantity: number;
}

const DOSAGE_UNITS = ['mg', 'g', 'ml', 'units', 'tablets', 'capsules'];
const DURATION_UNITS = ['days', 'weeks', 'months'];

const PrescriptionBuilder: React.FC<PrescriptionBuilderProps> = ({ prescriptions, onChange }) => {
  const { selectedClinic } = useAppStore();
  const [newMed, setNewMed] = useState<Prescription>({
    medicationId: '',
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
    quantity: 0
  });
  
  const [dosageUnit, setDosageUnit] = useState(DOSAGE_UNITS[0]);
  const [durationUnit, setDurationUnit] = useState(DURATION_UNITS[0]);
  const [durationValue, setDurationValue] = useState('');
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [isNewMedicine, setIsNewMedicine] = useState(false);
  const [availableDosages, setAvailableDosages] = useState<string[]>([]);

  // 1. Fetch Inventory for the specific clinic
  useEffect(() => {
    const fetchInventory = async () => {
      if (!selectedClinic) return;
      setLoadingInventory(true);
      try {
        const q = query(collection(db, `clinics/${selectedClinic.id}/inventory`));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => doc.data() as InventoryItem);
        setInventory(items);
      } catch (err) {
        console.error("Error fetching inventory:", err);
      } finally {
        setLoadingInventory(false);
      }
    };
    fetchInventory();
  }, [selectedClinic]);

  // 2. Group inventory by medication name to handle multiple dosages
  const groupedInventory = inventory.reduce((acc, item) => {
    if (!acc[item.med_id_lower]) {
      acc[item.med_id_lower] = {
        name: item.medication_id,
        dosages: new Set<string>()
      };
    }
    acc[item.med_id_lower].dosages.add(item.dosage);
    return acc;
  }, {} as Record<string, { name: string, dosages: Set<string> }>);

  const inventoryOptions = Object.keys(groupedInventory).map(key => ({
    id: key,
    label: groupedInventory[key].name,
    dosages: Array.from(groupedInventory[key].dosages)
  }));

  const handleAdd = () => {
    if (newMed.medicationName && newMed.dosage && newMed.frequency && durationValue) {
      const fullDosage = isNewMedicine ? `${newMed.dosage} ${dosageUnit}` : newMed.dosage;
      const fullDuration = `${durationValue} ${durationUnit}`;
      
      onChange([...prescriptions, { ...newMed, dosage: fullDosage, duration: fullDuration }]);
      
      // Reset State
      setNewMed({
        medicationId: '',
        medicationName: '',
        dosage: '',
        frequency: '',
        duration: '',
        instructions: '',
        quantity: 0
      });
      setDurationValue('');
      setIsNewMedicine(false);
      setAvailableDosages([]);
    }
  };

  const handleRemove = (index: number) => {
    const updated = [...prescriptions];
    updated.splice(index, 1);
    onChange(updated);
  };

  return (
    <Box>
      <Typography variant="subtitle2" color="primary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
        Section 4 — Prescribed Medicines
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 3, bgcolor: 'grey.50' }}>
        <Grid container spacing={2}>
          
          {/* SEARCH FIELD */}
          <Grid size={{ xs: 12 }}>
            {!isNewMedicine ? (
              <Autocomplete
                options={inventoryOptions}
                loading={loadingInventory}
                getOptionLabel={(option) => option.label}
                onChange={(_, newValue) => {
                  if (newValue) {
                    const dosages = newValue.dosages;
                    setAvailableDosages(dosages);
                    setNewMed({
                      ...newMed,
                      medicationName: newValue.label,
                      medicationId: newValue.id,
                      dosage: dosages.length === 1 ? dosages[0] : '',
                      quantity: 0 // Initialize fresh
                    });
                  } else {
                    // RESET FIX: Ensure quantity returns to 0 when search is cleared
                    setAvailableDosages([]);
                    setNewMed({ ...newMed, medicationName: '', medicationId: '', dosage: '', quantity: 0 });
                  }
                }}
                noOptionsText={
                  <Button 
                    color="primary" 
                    onMouseDown={() => setIsNewMedicine(true)}
                    sx={{ fontWeight: 'bold' }}
                  >
                    + New Medicine
                  </Button>
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Clinic Inventory"
                    size="small"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <React.Fragment>
                          {loadingInventory ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </React.Fragment>
                      ),
                    }}
                  />
                )}
              />
            ) : (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Manual Medication Name" 
                  value={newMed.medicationName} 
                  onChange={(e) => setNewMed({ ...newMed, medicationName: e.target.value, medicationId: e.target.value.toLowerCase().replace(/\s+/g, '-') })} 
                />
                <Button size="small" onClick={() => setIsNewMedicine(false)}>Cancel</Button>
              </Box>
            )}
          </Grid>

          {/* DOSAGE FIELD */}
          <Grid size={{ xs: 12, sm: 6 }}>
            {isNewMedicine ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField 
                  fullWidth 
                  size="small" 
                  label="Dose" 
                  type="number"
                  value={newMed.dosage} 
                  onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })} 
                />
                <FormControl sx={{ minWidth: 80 }} size="small">
                  <InputLabel>Unit</InputLabel>
                  <Select value={dosageUnit} onChange={(e) => setDosageUnit(e.target.value)} label="Unit">
                    {DOSAGE_UNITS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            ) : (
              <FormControl fullWidth size="small" disabled={availableDosages.length <= 1}>
                <InputLabel>Dosage</InputLabel>
                <Select 
                  value={newMed.dosage} 
                  onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })} 
                  label="Dosage"
                >
                  {availableDosages.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                </Select>
              </FormControl>
            )}
          </Grid>

          {/* QUANTITY FIELD */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Total Quantity to Prescribe" 
              type="number"
              value={newMed.quantity || ''} 
              onChange={(e) => setNewMed({ ...newMed, quantity: Number(e.target.value) })} 
            />
          </Grid>

          {/* FREQUENCY & DURATION */}
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Frequency (e.g., 3x daily)" 
              value={newMed.frequency} 
              onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Duration" 
              type="number"
              value={durationValue} 
              onChange={(e) => setDurationValue(e.target.value)} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Unit</InputLabel>
              <Select value={durationUnit} onChange={(e) => setDurationUnit(e.target.value)} label="Unit">
                {DURATION_UNITS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>

          {/* INSTRUCTIONS */}
          <Grid size={{ xs: 12 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Instructions (e.g., After meals)" 
              value={newMed.instructions} 
              onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })} 
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Button 
              variant="contained" 
              color="secondary" 
              startIcon={<AddIcon />} 
              onClick={handleAdd}
              disabled={!newMed.medicationName || !newMed.dosage || !newMed.frequency || !durationValue || !newMed.quantity}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Add to Prescription
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* DISPLAY LIST */}
      {prescriptions.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="textSecondary" fontWeight="bold" sx={{ mb: 1 }}>
            Current Prescriptions ({prescriptions.length})
          </Typography>
          {prescriptions.map((p, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'secondary.main' }}>
              <Box>
                <Typography variant="body1" fontWeight="bold" color="secondary.main">{p.medicationName} ({p.quantity} units)</Typography>
                <Typography variant="body2" color="textSecondary">
                  {p.dosage} | {p.frequency} | {p.duration}
                </Typography>
                {p.instructions && (
                  <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                    Note: {p.instructions}
                  </Typography>
                )}
              </Box>
              <IconButton color="error" onClick={() => handleRemove(idx)} size="small">
                <DeleteIcon />
              </IconButton>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default PrescriptionBuilder;