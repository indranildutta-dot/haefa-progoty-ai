import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  IconButton, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Grid
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { Prescription } from '../types';

interface PrescriptionFormProps {
  prescriptions: Prescription[];
  onChange: (prescriptions: Prescription[]) => void;
}

const PrescriptionForm: React.FC<PrescriptionFormProps> = ({ prescriptions, onChange }) => {
  const [newMed, setNewMed] = useState<Prescription>({
    medicationId: '',
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: ''
  });

  const handleAdd = () => {
    if (!newMed.medicationName) return;
    onChange([...prescriptions, { ...newMed, medicationId: Date.now().toString() }]);
    setNewMed({
      medicationId: '',
      medicationName: '',
      dosage: '',
      frequency: '',
      duration: '',
      instructions: ''
    });
  };

  const handleRemove = (index: number) => {
    const updated = [...prescriptions];
    updated.splice(index, 1);
    onChange(updated);
  };

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Add Medication
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Medication Name"
            size="small"
            value={newMed.medicationName}
            onChange={(e) => setNewMed({ ...newMed, medicationName: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            fullWidth
            label="Dosage"
            size="small"
            value={newMed.dosage}
            onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            fullWidth
            label="Frequency"
            size="small"
            value={newMed.frequency}
            onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <TextField
            fullWidth
            label="Duration"
            size="small"
            value={newMed.duration}
            onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 7 }}>
          <TextField
            fullWidth
            label="Instructions"
            size="small"
            value={newMed.instructions}
            onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 2 }}>
          <Button 
            fullWidth 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={handleAdd}
            sx={{ height: '40px' }}
          >
            Add
          </Button>
        </Grid>
      </Grid>

      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Current Prescriptions
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f8f9fa' }}>
            <TableRow>
              <TableCell>Medication</TableCell>
              <TableCell>Dosage</TableCell>
              <TableCell>Freq</TableCell>
              <TableCell>Dur</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {prescriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography variant="body2" color="textSecondary" sx={{ py: 2 }}>
                    No medications added yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              prescriptions.map((p, index) => (
                <TableRow key={index}>
                  <TableCell>{p.medicationName}</TableCell>
                  <TableCell>{p.dosage}</TableCell>
                  <TableCell>{p.frequency}</TableCell>
                  <TableCell>{p.duration}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="error" onClick={() => handleRemove(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default PrescriptionForm;
