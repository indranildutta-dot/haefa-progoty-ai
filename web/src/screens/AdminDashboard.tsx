import React from 'react';
import { Box, Typography, Button, Paper, Container, Stack, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import TopNavigation from '../components/TopNavigation';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <TopNavigation />
      <Container maxWidth="xl" sx={{ py: 4, mt: 8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
          <IconButton sx={{ mr: 2 }} onClick={() => navigate('/dashboard')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight="900" sx={{ color: '#0f172a', textTransform: 'uppercase' }}>
            Admin Dashboard
          </Typography>
        </Box>

        <Stack spacing={3}>
          <Paper 
            elevation={0} 
            sx={{ p: 4, borderRadius: 3, border: '1px solid #e2e8f0', cursor: 'pointer', '&:hover': { borderColor: '#3b82f6' } }} 
            onClick={() => navigate('/users')}
          >
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              User Management
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Manage staff, roles, and clinic assignments.
            </Typography>
            <Button variant="contained" color="primary" onClick={(e) => { e.stopPropagation(); navigate('/users'); }}>
              Go To User Management
            </Button>
          </Paper>

          <Paper 
            elevation={0} 
            sx={{ 
              p: 4, 
              borderRadius: 3, 
              border: '1px solid #e2e8f0', 
              bgcolor: '#f0fdfa', 
              cursor: 'pointer', 
              '&:hover': { borderColor: '#10b981' }, 
              borderLeft: '6px solid #10b981' 
            }} 
            onClick={() => navigate('/analytics')}
          >
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, color: '#4338ca' }}>
              HAEFA Progoty Advanced Analytics & Reporting
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Enterprise-grade population health insights, clinical throughput analysis, and AI-driven supply intelligence.
            </Typography>
            <Button variant="contained" sx={{ bgcolor: '#8b5cf6', '&:hover': { bgcolor: '#7c3aed' } }} onClick={(e) => { e.stopPropagation(); navigate('/analytics'); }}>
              Launch Analytics Portal
            </Button>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
};

export default AdminDashboard;
