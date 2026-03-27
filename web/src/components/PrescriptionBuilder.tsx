import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  IconButton, 
  Paper, 
  Stack, 
  Autocomplete, 
  Grid,
  Tooltip,
  Alert,
  InputAdornment,
  Divider
} from '@mui/material';

// Icons
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CalculateIcon from '@mui/icons-material/Calculate';
import MedicationIcon from '@mui/icons-material/Medication';
import InfoIcon from '@mui/icons-material/Info';

// --- Medication Database ---
// In a production environment, this could be fetched from a global 'medicines' collection.
const MEDICATION_DATABASE = [
  { id: 'PARA-500', name: 'Paracetamol', defaultDosage: '500mg' },
  { id: 'AMOX-250', name: 'Amoxicillin', defaultDosage: '250mg' },
  { id: 'METF-500', name: 'Metformin', defaultDosage: '500mg' },
  { id: 'ATOR-20', name: 'Atorvastatin', defaultDosage: '20mg' },
  { id: 'OMEP-20', name: 'Omeprazole', defaultDosage: '20mg' },
  { id: 'LOSA-50', name: 'Losartan', defaultDosage: '50mg' },
  { id: 'AZIT-500', name: 'Azithromycin', defaultDosage: '500mg' },
  { id: 'IBUP-400', name: 'Ibuprofen', defaultDosage: '400mg' },
  { id: 'SALB-100', name: 'Salbutamol Inhaler', defaultDosage: '100mcg' },
  { id: 'CETI-10', name: 'Cetirizine', defaultDosage: '10mg' },
  // Add more as needed for HAEFA clinical standards
];

// --- Clinical Calculation Utilities ---

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
  return num; // Default to days
};

// --- Component Definition ---

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
  onPrescriptionChange: (prescriptions: Prescription[]) => void;
  initialData?: Prescription[];
}

const PrescriptionBuilder: React.FC<PrescriptionBuilderProps> = ({ 
  onPrescriptionChange, 
  initialData = [] 
}) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialData);

  // Sync with parent component
  useEffect(() => {
    onPrescriptionChange(prescriptions);
  }, [prescriptions]);

  const handleAddMedication = () => {
    const newEntry: Prescription = {
      medicationId: '',
      medicationName: '',
      dosage: '',
      frequency: '1 time daily',
      duration: '7 days',
      quantity: 7,
      instructions: ''
    };
    setPrescriptions([...prescriptions, newEntry]);
  };

  const handleRemoveMedication = (index: number) => {
    const filtered = prescriptions.filter((_, i) => i !== index);
    setPrescriptions(filtered);
  };

  const updateMedication = (index: number, field: keyof Prescription, value: any) => {
    const updatedList = [...prescriptions];
    const currentMed = { ...updatedList[index] };

    // Update the specific field
    (currentMed as any)[field] = value;

    // Logic for Medication Database Selection
    if (field === 'medicationName') {
      const match = MEDICATION_DATABASE.find(m => m.name === value);
      if (match) {
        currentMed.medicationId = match.id;
        currentMed.dosage = match.defaultDosage;
      }
    }

    // Logic for Auto-Calculation (Freq x Duration)
    const freqVal = parseFrequencyToNumber(currentMed.frequency);
    const daysVal = parseDurationToDays(currentMed.duration);
    const minCalculated = freqVal * daysVal;

    if (field === 'frequency' || field === 'duration') {
      // Auto-set the total quantity whenever timing changes
      currentMed.quantity = minCalculated;
    }

    if (field === 'quantity') {
      // ENFORCE FLOOR: Cannot prescribe less than therapeutic course
      // Allows professional override for MORE (buffer), but not LESS.
      currentMed.quantity = value < minCalculated ? minCalculated : value;
    }

    updatedList[index] = currentMed;
    setPrescriptions(updatedList);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Area */}
      <Stack 
        direction="row" 
        justifyContent="space-between" 
        alignItems="center" 
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h6" fontWeight="900" sx={{ color: 'primary.main' }}>
            PRESCRIPTION BUILDER
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Calculate dosage and fulfillment for the pharmacy.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddCircleIcon />}
          onClick={handleAddMedication}
          sx={{ 
            borderRadius: 2, 
            fontWeight: 800, 
            px: 3,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
          }}
        >
          Add Medication
        </Button>
      </Stack>

      {prescriptions.length === 0 && (
        <Alert 
          severity="info" 
          sx={{ borderRadius: 3, border: '1px dashed', borderColor: 'info.main' }}
        >
          No medications added. Please click 'Add Medication' to begin prescribing.
        </Alert>
      )}

      {/* Medication Entry Cards */}
      <Stack spacing={3}>
        {prescriptions.map((med, index) => (
          <Paper 
            key={index} 
            variant="outlined" 
            sx={{ 
              p: 3, 
              borderRadius: 4, 
              position: 'relative', 
              transition: 'all 0.2s',
              '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }
            }}
          >
            {/* Remove Button */}
            <Tooltip title="Remove Medication">
              <IconButton 
                onClick={() => handleRemoveMedication(index)}
                sx={{ 
                  position: 'absolute', 
                  top: 12, 
                  right: 12, 
                  color: 'error.light',
                  '&:hover': { bgcolor: 'error.50' } 
                }}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>

            <Grid container spacing={3}>
              {/* Row 1: Medicine Selection & Dosage */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={MEDICATION_DATABASE.map(m => m.name)}
                  value={med.medicationName}
                  onInputChange={(_, newVal) => updateMedication(index, 'medicationName', newVal)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Medication Name" 
                      placeholder="Search or type name..."
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <MedicationIcon color="primary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Dosage Strength"
                  placeholder="e.g., 500mg or 5ml"
                  value={med.dosage}
                  onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                />
              </Grid>

              <Grid item xs={12}><Divider sx={{ borderStyle: 'dashed' }} /></Grid>

              {/* Row 2: Frequency, Duration, and Total Quantity */}
              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo
                  options={['1 time daily', '2 times daily', '3 times daily', '4 times daily', 'Once weekly']}
                  value={med.frequency}
                  onInputChange={(_, val) => updateMedication(index, 'frequency', val)}
                  renderInput={(params) => <TextField {...params} label="Frequency" />}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo
                  options={['3 days', '5 days', '7 days', '2 weeks', '1 month']}
                  value={med.duration}
                  onInputChange={(_, val) => updateMedication(index, 'duration', val)}
                  renderInput={(params) => <TextField {...params} label="Duration" />}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Total Quantity to Prescribe"
                  value={med.quantity}
                  onChange={(e) => updateMedication(index, 'quantity', Number(e.target.value))}
                  helperText={`Course minimum: ${parseFrequencyToNumber(med.frequency) * parseDurationToDays(med.duration)}`}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalculateIcon color="primary" />
                      </InputAdornment>
                    ),
                    sx: { fontWeight: 900, color: 'primary.dark' }
                  }}
                />
              </Grid>

              {/* Row 3: Patient Instructions */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Pharmacist/Patient Instructions"
                  placeholder="e.g., Take after meals, complete the full course even if feeling better..."
                  value={med.instructions}
                  onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                  sx={{ bgcolor: '#fafafa' }}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>
      
      {/* Footer Disclaimer */}
      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
        <InfoIcon sx={{ fontSize: 16, mr: 1 }} />
        <Typography variant="caption" fontWeight="500">
          The 'Total Quantity' is automatically calculated based on Frequency and Duration to prevent dispensing errors.
        </Typography>
      </Box>
    </Box>
  );
};

export default PrescriptionBuilder;