import React from 'react';
import { Box, Typography, Button, Container, Paper, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const AdminDashboard = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Admin Dashboard</Typography>
      </Box>
      
      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6">User Management</Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Manage staff, roles, and clinic assignments.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={() => navigate('/admin/users')}>
            Go to User Management
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AdminDashboard;
