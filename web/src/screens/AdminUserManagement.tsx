import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Select, MenuItem, FormControl, InputLabel, OutlinedInput, Chip, Switch, FormControlLabel, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import { db } from '../firebase';
import { countries } from '../config/countries';
import { useAppStore } from '../store/useAppStore';
import { deleteUser } from '../services/adminService';

const AdminUserManagement = () => {
  const navigate = useNavigate();
  const { userProfile } = useAppStore();
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('nurse');
  const [selectedClinicIds, setSelectedClinicIds] = useState<string[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [professionalRegNo, setProfessionalRegNo] = useState('');
  const [professionalBody, setProfessionalBody] = useState('');
  const [designation, setDesignation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  useEffect(() => {
    if (userProfile?.isApproved && (userProfile?.role === 'global_admin' || userProfile?.role === 'country_admin')) {
      fetchUsers();
    }
  }, [userProfile]);

  const fetchUsers = async () => {
    try {
      let q = query(collection(db, 'users'));
      if (userProfile?.role === 'country_admin' && userProfile?.assignedCountries?.length) {
        q = query(q, where('countryCode', 'in', userProfile.assignedCountries));
      }
      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const selectedCountry = countries.find(c => c.id === selectedCountryId);
  const availableClinics = selectedCountry ? selectedCountry.clinics : [];

  const handleEditUser = (user: any) => {
    setEmail(user.email);
    setRole(user.role);
    setSelectedClinicIds(user.assignedClinics || []);
    setSelectedCountryId(user.countryCode || '');
    setIsApproved(user.isApproved || false);
    setProfessionalRegNo(user.professional_reg_no || '');
    setProfessionalBody(user.professional_body || '');
    setDesignation(user.designation || '');
  };

  const handleClear = () => {
    setEmail('');
    setRole('nurse');
    setSelectedClinicIds([]);
    setSelectedCountryId('');
    setIsApproved(false);
    setProfessionalRegNo('');
    setProfessionalBody('');
    setDesignation('');
  };

  const handleSync = async () => {
    const functions = getFunctions();
    const syncUserPermissions = httpsCallable(functions, 'syncUserPermissions');
    try {
      await syncUserPermissions({ 
        email, 
        role, 
        assignedClinics: selectedClinicIds, 
        countryCode: selectedCountryId,
        isApproved,
        professional_reg_no: professionalRegNo,
        professional_body: professionalBody,
        designation: designation
      });
      alert('User permissions synced!');
      fetchUsers();
      handleClear();
    } catch (error) {
      console.error('Error syncing permissions:', error);
      alert('Failed to sync permissions.');
    }
  };

  const handleDeleteClick = (user: any) => {
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.id);
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/admin')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">User Management</Typography>
      </Box>
      
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

        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <TextField 
            label="Professional Reg No" 
            value={professionalRegNo} 
            onChange={(e) => setProfessionalRegNo(e.target.value)} 
            fullWidth 
          />
          <FormControl fullWidth>
            <InputLabel>Professional Body</InputLabel>
            <Select 
              value={professionalBody} 
              onChange={(e) => setProfessionalBody(e.target.value)}
              label="Professional Body"
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="BMDC">BMDC (Bangladesh Medical & Dental Council)</MenuItem>
              <MenuItem value="BNMC">BNMC (Bangladesh Nursing & Midwifery Council)</MenuItem>
              <MenuItem value="PCB">PCB (Pharmacy Council of Bangladesh)</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField 
            label="Designation" 
            value={designation} 
            onChange={(e) => setDesignation(e.target.value)} 
            fullWidth 
          />
        </Box>
        
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={handleSync}>Save Permissions</Button>
          <Button variant="outlined" onClick={handleClear}>Clear Form</Button>
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
              <TableCell>Actions</TableCell>
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
                <TableCell>
                  <Button size="small" onClick={() => handleEditUser(user)}>Edit</Button>
                  {userProfile?.role === 'global_admin' && (
                    <IconButton size="small" color="error" onClick={() => handleDeleteClick(user)}>
                      <DeleteIcon />
                    </IconButton>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm User Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to fully remove user <strong>{userToDelete?.email}</strong>? 
            This will delete them from both Authentication and the database. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete Permanently
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminUserManagement;
