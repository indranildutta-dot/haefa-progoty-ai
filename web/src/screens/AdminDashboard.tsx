import React from 'react';
import { Box, Typography, Button, Container, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Admin Dashboard</Typography>
      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6">User Management</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Manage staff, roles, and clinic assignments.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/admin/users')}>
          Go to User Management
        </Button>
      </Paper>
    </Container>
  );
};

export default AdminDashboard;
