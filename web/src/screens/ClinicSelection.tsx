import React, { useState, useMemo } from 'react';
import { 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardActionArea, 
  Box,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Alert,
  AlertTitle
} from '@mui/material';
import { ArrowBack, DeleteOutline, LockClock, CheckCircle } from '@mui/icons-material';
import { CountryConfig, ClinicConfig } from '../config/countries';
import { clearBangladeshData } from '../services/adminService';
import { useAppStore } from '../store/useAppStore';

interface ClinicSelectionProps {
  selectedCountry: CountryConfig;
  onSelectClinic: (clinic: ClinicConfig) => void;
  onBack: () => void;
}

const ClinicSelection: React.FC<ClinicSelectionProps> = ({ selectedCountry, onSelectClinic, onBack }) => {
  const { userProfile } = useAppStore();
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // RBAC Filter Logic based on Firestore "assignedClinics" and "role"
  const authorizedClinics = useMemo(() => {
    if (!userProfile) return [];
    
    // Global Admins see all clinics
    if (userProfile.role === 'global_admin') return selectedCountry.clinics;

    // Others see only what is in their assignedClinics array
    return selectedCountry.clinics.filter(clinic => 
      userProfile.assignedClinics?.includes(clinic.id)
    );
  }, [selectedCountry, userProfile]);

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await clearBangladeshData();
    } finally {
      setIsClearing(false);
      setOpenClearDialog(false);
    }
  };

  // 1. Check for staged (non-approved) status
  if (userProfile && !userProfile.isApproved && userProfile.role !== 'global_admin') {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Alert severity="warning" variant="filled" icon={<LockClock sx={{ fontSize: 40 }} />} sx={{ borderRadius: 4, p: 3 }}>
          <AlertTitle sx={{ fontWeight: 900, fontSize: '1.2rem' }}>ACCOUNT STAGED</AlertTitle>
          Your account is currently in the <strong>Staged</strong> phase. You cannot access patient data or start clinical work until a Global Admin approves your profile.
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" color="inherit" onClick={onBack} sx={{ color: 'black', fontWeight: 900 }}>
              Return to Country Selection
            </Button>
          </Box>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button onClick={onBack} startIcon={<ArrowBack />} variant="outlined" color="inherit" sx={{ borderRadius: 2 }}>
            Back
          </Button>
          <Box>
            <Typography variant="h4" fontWeight={900} color="primary">
              Select Clinic
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" fontWeight={700}>
              {selectedCountry.name} {selectedCountry.flag}
            </Typography>
          </Box>
        </Box>
        
        {selectedCountry.id === 'BD' && userProfile?.role === 'global_admin' && (
          <Button 
            variant="outlined" 
            color="error" 
            startIcon={<DeleteOutline />}
            onClick={() => setOpenClearDialog(true)}
            size="small"
          >
            Clear BD Data
          </Button>
        )}
      </Box>

      {authorizedClinics.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '2px dashed #cbd5e1' }}>
          <Typography variant="h6" fontWeight={800} color="text.secondary">
            No Clinics Assigned
          </Typography>
          <Typography variant="body2" color="text.disabled">
            You do not have any clinics assigned in this country. Please contact support.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {authorizedClinics.map((clinic) => (
            <Grid item xs={12} sm={6} md={4} key={clinic.id}>
              <Card 
                sx={{ 
                  borderRadius: 4, 
                  border: '1px solid',
                  borderColor: 'divider',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <CardActionArea onClick={() => onSelectClinic(clinic)} sx={{ p: 3 }}>
                  <Typography variant="subtitle1" fontWeight={900} gutterBottom>{clinic.name}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>ID: {clinic.id}</Typography>
                  <Chip 
                    label="Authorized" 
                    size="small" 
                    color="success" 
                    icon={<CheckCircle sx={{ fontSize: '14px !important' }} />}
                    sx={{ borderRadius: 1.5, fontWeight: 900, height: 24 }} 
                  />
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={openClearDialog} onClose={() => !isClearing && setOpenClearDialog(false)}>
        <DialogTitle sx={{ fontWeight: 900 }}>Clear Bangladesh Data</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete all clinical records for Bangladesh? This action is permanent.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpenClearDialog(false)} disabled={isClearing}>Cancel</Button>
          <Button onClick={handleClearData} color="error" variant="contained" disabled={isClearing}>
            {isClearing ? <CircularProgress size={24} color="inherit" /> : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ClinicSelection;