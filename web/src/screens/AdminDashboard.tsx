import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const runBootstrap = async () => {
    const functions = getFunctions();
    const bootstrap = httpsCallable(functions, 'bootstrapAdmins');
    try {
      console.log("Running bootstrapAdmins...");
      await bootstrap();
      alert('Bootstrap successful! Please log out and log back in.');
    } catch (e) {
      console.error("Bootstrap error:", e);
      alert('Bootstrap failed. Check console for details.');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Admin Dashboard</Typography>
      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6">User Management</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Manage staff, roles, and clinic assignments.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={() => navigate('/admin/users')}>
            Go to User Management
          </Button>
          <Button onClick={runBootstrap} variant="outlined" color="secondary">
            Run Bootstrap Admins
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AdminDashboard;
