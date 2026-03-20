import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress
} from '@mui/material';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store/useAppStore';

interface InventoryItem {
  id: string;
  medication_id: string;
  batch_id: string;
  expiry_date: any;
  quantity: number;
  dosage: string;
}

const InventoryView: React.FC = () => {
  const { selectedClinic } = useAppStore();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [dosageFilter, setDosageFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedClinic) return;

    const q = query(collection(db, `clinics/${selectedClinic.id}/inventory`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InventoryItem[];
      setInventory(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedClinic]);

  const medicationOptions = useMemo(() => {
    const meds = new Set(inventory.map(item => item.medication_id));
    return Array.from(meds);
  }, [inventory]);

  const dosageOptions = useMemo(() => {
    if (!searchQuery) return [];
    const dosages = new Set(
      inventory
        .filter(item => item.medication_id === searchQuery)
        .map(item => item.dosage)
    );
    return Array.from(dosages);
  }, [inventory, searchQuery]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesMed = !searchQuery || item.medication_id === searchQuery;
      const matchesDosage = !dosageFilter || item.dosage === dosageFilter;
      return matchesMed && matchesDosage;
    });
  }, [inventory, searchQuery, dosageFilter]);

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">Real-Time Inventory</Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Autocomplete
          options={medicationOptions}
          value={searchQuery}
          onChange={(_, newValue) => {
            setSearchQuery(newValue);
            setDosageFilter(null); // Reset dosage when med changes
          }}
          renderInput={(params) => <TextField {...params} label="Search Medication" />}
          sx={{ width: 300 }}
        />
        
        <Autocomplete
          options={dosageOptions}
          value={dosageFilter}
          onChange={(_, newValue) => setDosageFilter(newValue)}
          disabled={!searchQuery}
          renderInput={(params) => <TextField {...params} label="Filter by Dosage" />}
          sx={{ width: 200 }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Medication</TableCell>
              <TableCell>Dosage</TableCell>
              <TableCell>Batch ID</TableCell>
              <TableCell>Expiry Date</TableCell>
              <TableCell>Quantity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInventory.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.medication_id}</TableCell>
                <TableCell>{item.dosage}</TableCell>
                <TableCell>{item.batch_id}</TableCell>
                <TableCell>{item.expiry_date?.toDate().toLocaleDateString()}</TableCell>
                <TableCell>
                  <Chip label={item.quantity} color={item.quantity < 10 ? 'error' : 'success'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default InventoryView;
