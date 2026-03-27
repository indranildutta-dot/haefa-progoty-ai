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

// --- Icons ---
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CalculateIcon from '@mui/icons-material/Calculate';
import MedicationIcon from '@mui/icons-material/Medication';
import InfoIcon from '@mui/icons-material/Info';

// --- Medication Database (HAEFA Standard) ---
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
  { id: 'VITA-MULT', name: 'Multivitamin', defaultDosage: '1 tab' }
];

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
  // Use '?' to make this optional so the app doesn't crash if the parent isn't ready
  onPrescriptionChange?: (prescriptions: Prescription[]) => void;
  initialData?: Prescription[];
}

const PrescriptionBuilder: React.FC<PrescriptionBuilderProps> = ({ 
  onPrescriptionChange, 
  initialData = [] 
}) => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(initialData);

  // --- SAFETY SYNC ---
  // This useEffect communicates with the Doctor's Page. 
  // The '?' check ensures it only runs if the parent passed a valid function.
  useEffect(() => {
    if (typeof onPrescriptionChange === 'function') {
      onPrescriptionChange(prescriptions);
    }
  }, [prescriptions, onPrescriptionChange]);

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

    (currentMed as any)[field] = value;

    // Logic: Database Auto-Fill
    if (field === 'medicationName') {
      const match = MEDICATION_DATABASE.find(m => m.name === value);
      if (match) {
        currentMed.medicationId = match.id;
        currentMed.dosage = match.defaultDosage;
      }
    }

    // Logic: Auto-Calculation
    const freqVal = parseFrequencyToNumber(currentMed.frequency);
    const daysVal = parseDurationToDays(currentMed.duration);
    const minCalculated = freqVal * daysVal;

    if (field === 'frequency' || field === 'duration') {
      currentMed.quantity = minCalculated;
    }

    if (field === 'quantity') {
      // Professional Override: Minimum Floor Enforcement
      currentMed.quantity = value < minCalculated ? minCalculated : value;
    }

    updatedList[index] = currentMed;
    setPrescriptions(updatedList);
  };

  return (
    <Box sx={{ width: '100%', py: 2 }}>
      {/* Header Area */}
      <Stack 
        direction="row" 
        justifyContent="space-between" 
        alignItems="center" 
        sx={{ mb: 4 }}
      >
        <Box>
          <Typography variant="h5" fontWeight="900" sx={{ color: 'primary.main', letterSpacing: -0.5 }}>
            PRESCRIPTION BUILDER
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select medications and define clinical duration.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddCircleIcon />}
          onClick={handleAddMedication}
          sx={{ 
            borderRadius: 3, 
            fontWeight: 800, 
            px: 4,
            height: '48px',
            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)' 
          }}
        >
          Add Medicine
        </Button>
      </Stack>

      {prescriptions.length === 0 && (
        <Alert 
          severity="info" 
          variant="outlined"
          sx={{ borderRadius: 4, py: 4, borderStyle: 'dashed', textAlign: 'center', justifyContent: 'center' }}
        >
          No medications currently prescribed. Click the button above to start.
        </Alert>
      )}

      {/* Medication Entry Cards */}
      <Stack spacing={4}>
        {prescriptions.map((med, index) => (
          <Paper 
            key={index} 
            elevation={0}
            sx={{ 
              p: 4, 
              borderRadius: 4, 
              border: '1px solid #e0e0e0',
              position: 'relative', 
              transition: 'all 0.3s ease',
              '&:hover': { borderColor: 'primary.main', bgcolor: '#fcfdff' }
            }}
          >
            <IconButton 
              onClick={() => handleRemoveMedication(index)}
              sx={{ 
                position: 'absolute', 
                top: 16, 
                right: 16, 
                color: 'error.main',
                bgcolor: '#fff1f1',
                '&:hover': { bgcolor: '#ffe0e0' } 
              }}
            >
              <DeleteIcon />
            </IconButton>

            <Grid container spacing={3}>
              {/* Row 1: Name & Dosage */}
              <Grid item xs={12} md={7}>
                <Autocomplete
                  freeSolo
                  options={MEDICATION_DATABASE.map(m => m.name)}
                  value={med.medicationName}
                  onInputChange={(_, newVal) => updateMedication(index, 'medicationName', newVal)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Search Medication" 
                      variant="filled"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <MedicationIcon color="primary" />
                          </InputAdornment>
                        ),
                        disableUnderline: true,
                        sx: { borderRadius: 2 }
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="Dosage Strength"
                  variant="outlined"
                  value={med.dosage}
                  onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              </Grid>

              <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

              {/* Row 2: Frequency, Duration, Total (CALCULATION ROW) */}
              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo
                  options={['1 time daily', '2 times daily', '3 times daily', '4 times daily', 'Once weekly']}
                  value={med.frequency}
                  onInputChange={(_, val) => updateMedication(index, 'frequency', val)}
                  renderInput={(params) => <TextField {...params} label="Frequency" variant="outlined" />}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <Autocomplete
                  freeSolo
                  options={['3 days', '5 days', '7 days', '2 weeks', '1 month']}
                  value={med.duration}
                  onInputChange={(_, val) => updateMedication(index, 'duration', val)}
                  renderInput={(params) => <TextField {...params} label="Duration" variant="outlined" />}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Total Quantity"
                  value={med.quantity}
                  onChange={(e) => updateMedication(index, 'quantity', Number(e.target.value))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalculateIcon color="primary" sx={{ opacity: 0.6 }} />
                      </InputAdornment>
                    ),
                    sx: { fontWeight: 900, borderRadius: 2, bgcolor: '#f0f7ff' }
                  }}
                  helperText={`Min course requirement: ${parseFrequencyToNumber(med.frequency) * parseDurationToDays(med.duration)}`}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Special Instructions (Optional)"
                  placeholder="e.g., Take with food, avoid alcohol..."
                  value={med.instructions}
                  onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Stack>

      <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', bgcolor: '#f9f9f9', p: 2, borderRadius: 2 }}>
        <InfoIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary" fontWeight="500">
          Total quantity is automatically locked to the therapeutic minimum based on Frequency and Duration.
        </Typography>
      </Box>
    </Box>
  );
};

export default PrescriptionBuilder;