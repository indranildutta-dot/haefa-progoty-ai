import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem, FormControl, InputLabel, OutlinedInput, Chip, Switch, FormControlLabel } from '@mui/material';
import { collection, query, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { countries } from '../config/countries';

const AdminUserManagement = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('nurse');
  const [selectedClinicIds, setSelectedClinicIds] = useState<string[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);
    setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const selectedCountry = countries.find(c => c.id === selectedCountryId);
  const availableClinics = selectedCountry ? selectedCountry.clinics : [];

  const handleSync = async () => {
    const functions = getFunctions();
    const syncUserPermissions = httpsCallable(functions, 'syncUserPermissions');
    try {
      await syncUserPermissions({ 
        email, 
        role, 
        assignedClinics: selectedClinicIds, 
        countryCode: selectedCountryId,
        isApproved
      });
      alert('User permissions synced!');
      fetchUsers();
    } catch (error) {
      console.error('Error syncing permissions:', error);
      alert('Failed to sync permissions.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>User Management</Typography>
      
      <Box sx={{ mb: 4, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
        <Typography variant="h6">Invite/Update Staff</Typography>
        <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth margin="normal" />
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Country</InputLabel>
          <Select value={selectedCountryId} onChange={(e) => { setSelectedCountryId(e.target.value); setSelectedClinicIds([]); }}>
            {countries.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal" disabled={!selectedCountryId}>
          <InputLabel>Clinics</InputLabel>
          <Select 
            multiple 
            value={selectedClinicIds} 
            onChange={(e) => setSelectedClinicIds(e.target.value as string[])}
            input={<OutlinedInput label="Clinics" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={availableClinics.find(c => c.id === value)?.name} />
                ))}
              </Box>
            )}
          >
            {availableClinics.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth margin="normal">
          <InputLabel>Role</InputLabel>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <MenuItem value="nurse">Nurse</MenuItem>
            <MenuItem value="doctor">Doctor</MenuItem>
            <MenuItem value="pharmacist">Pharmacist</MenuItem>
            <MenuItem value="country_admin">Country Admin</MenuItem>
            <MenuItem value="global_admin">Global Admin</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={<Switch checked={isApproved} onChange={(e) => setIsApproved(e.target.checked)} />}
          label="Is Approved"
        />
        
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" onClick={handleSync}>Save Permissions</Button>
        </Box>
      </Box>

      <TextField 
        label="Search Users" 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)} 
        fullWidth 
        margin="normal" 
      />

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Clinics</TableCell>
              <TableCell>Country ID</TableCell>
              <TableCell>Approved</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell>{Array.isArray(user.assignedClinics) ? user.assignedClinics.join(', ') : ''}</TableCell>
                <TableCell>{user.countryCode}</TableCell>
                <TableCell>{user.isApproved ? 'Yes' : 'No'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AdminUserManagement;
