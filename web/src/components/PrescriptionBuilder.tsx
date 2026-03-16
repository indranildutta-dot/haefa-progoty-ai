import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Grid, 
  Paper, 
  IconButton,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { Prescription } from '../types';

interface PrescriptionBuilderProps {
  prescriptions: Prescription[];
  onChange: (prescriptions: Prescription[]) => void;
}

const DOSAGE_UNITS = ['mg', 'g', 'ml', 'units', 'tablets', 'capsules'];
const DURATION_UNITS = ['days', 'weeks', 'months'];

const PrescriptionBuilder: React.FC<PrescriptionBuilderProps> = ({ prescriptions, onChange }) => {
  const [newMed, setNewMed] = useState<Prescription>({
    medicationId: '',
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: ''
  });
  const [dosageUnit, setDosageUnit] = useState(DOSAGE_UNITS[0]);
  const [durationUnit, setDurationUnit] = useState(DURATION_UNITS[0]);
  const [durationValue, setDurationValue] = useState('');

  const handleAdd = () => {
    if (newMed.medicationName && newMed.dosage && newMed.frequency && durationValue) {
      const fullDosage = `${newMed.dosage} ${dosageUnit}`;
      const fullDuration = `${durationValue} ${durationUnit}`;
      
      onChange([...prescriptions, { ...newMed, dosage: fullDosage, duration: fullDuration }]);
      setNewMed({
        medicationId: '',
        medicationName: '',
        dosage: '',
        frequency: '',
        duration: '',
        instructions: ''
      });
      setDurationValue('');
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
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Medication Name" 
              value={newMed.medicationName} 
              onChange={(e) => setNewMed({ ...newMed, medicationName: e.target.value, medicationId: e.target.value.toLowerCase().replace(/\s+/g, '-') })} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Dose" 
              type="number"
              value={newMed.dosage} 
              onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })} 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Unit</InputLabel>
              <Select value={dosageUnit} onChange={(e) => setDosageUnit(e.target.value)} label="Unit">
                {DOSAGE_UNITS.map(unit => <MenuItem key={unit} value={unit}>{unit}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField 
              fullWidth 
              size="small" 
              label="Frequency (e.g., 3 times daily)" 
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
              disabled={!newMed.medicationName || !newMed.dosage || !newMed.frequency || !durationValue}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Add Medication
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {prescriptions.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="textSecondary" fontWeight="bold" sx={{ mb: 1 }}>
            Current Prescriptions ({prescriptions.length})
          </Typography>
          {prescriptions.map((p, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'secondary.main' }}>
              <Box>
                <Typography variant="body1" fontWeight="bold" color="secondary.main">{p.medicationName}</Typography>
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
