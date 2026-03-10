import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, IconButton, TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { PatientAllergy } from '../types';
import { useAppStore } from '../store/useAppStore';

interface PatientAllergiesProps {
  patientId: string;
}

const PatientAllergies: React.FC<PatientAllergiesProps> = ({ patientId }) => {
  const { notify } = useAppStore();
  const [allergies, setAllergies] = useState<PatientAllergy[]>([]);
  const [open, setOpen] = useState(false);
  const [newAllergy, setNewAllergy] = useState({ medicationName: '', severity: 'moderate', notes: '' });

  const fetchAllergies = async () => {
    try {
      const q = query(collection(db, "patient_allergies"), where("patient_id", "==", patientId));
      const snap = await getDocs(q);
      setAllergies(snap.docs.map(d => ({ id: d.id, ...d.data() } as PatientAllergy)));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAllergies();
  }, [patientId]);

  const handleAdd = async () => {
    if (!newAllergy.medicationName) return;
    try {
      const { selectedCountry, selectedClinic } = useAppStore.getState();
      await addDoc(collection(db, "patient_allergies"), {
        patient_id: patientId,
        medicationName: newAllergy.medicationName,
        severity: newAllergy.severity,
        notes: newAllergy.notes,
        country_code: selectedCountry?.id || '',
        clinic_id: selectedClinic?.id || ''
      });
      notify("Allergy added", "success");
      setOpen(false);
      setNewAllergy({ medicationName: '', severity: 'moderate', notes: '' });
      fetchAllergies();
    } catch (err) {
      console.error(err);
      notify("Failed to add allergy", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "patient_allergies", id));
      notify("Allergy removed", "success");
      fetchAllergies();
    } catch (err) {
      console.error(err);
      notify("Failed to remove allergy", "error");
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2" fontWeight="bold" color="error">Allergies</Typography>
        <IconButton size="small" onClick={() => setOpen(true)}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
      
      {allergies.length === 0 ? (
        <Typography variant="caption" color="textSecondary">No known allergies.</Typography>
      ) : (
        <Box display="flex" flexWrap="wrap" gap={1}>
          {allergies.map(a => (
            <Chip 
              key={a.id} 
              label={a.medicationName} 
              color={a.severity === 'high' ? 'error' : 'warning'} 
              size="small" 
              onDelete={() => handleDelete(a.id!)}
            />
          ))}
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Add Allergy</DialogTitle>
        <DialogContent>
          <TextField 
            fullWidth 
            label="Medication Name" 
            size="small" 
            sx={{ mt: 2, mb: 2 }}
            value={newAllergy.medicationName}
            onChange={e => setNewAllergy({ ...newAllergy, medicationName: e.target.value })}
          />
          <TextField 
            fullWidth 
            label="Notes (Optional)" 
            size="small" 
            value={newAllergy.notes}
            onChange={e => setNewAllergy({ ...newAllergy, notes: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd}>Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PatientAllergies;
