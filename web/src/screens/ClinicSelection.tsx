import React, { useMemo } from 'react';
import { 
  Container, Typography, Grid, Card, CardActionArea, 
  Box, Paper, Chip, Button, Alert, AlertTitle 
} from '@mui/material';
import { ArrowBack, CheckCircle, LockClock, Business } from '@mui/icons-material';
import { CountryConfig, ClinicConfig } from '../config/countries';
import { useAppStore } from '../store/useAppStore';
import { useNavigate } from 'react-router-dom';

interface ClinicSelectionProps {
  selectedCountry: CountryConfig;
  onSelectClinic: (clinic: ClinicConfig) => void;
  onBack: () => void;
}

const ClinicSelection: React.FC<ClinicSelectionProps> = ({ selectedCountry, onSelectClinic, onBack }) => {
  const { userProfile } = useAppStore();
  const navigate = useNavigate();

  // FILTER LOGIC: Uses 'assignedClinics' array from your Firestore data
  const authorizedClinics = useMemo(() => {
    if (!userProfile) return [];
    
    // Global Admins see everything
    if (userProfile.role === 'global_admin') return selectedCountry.clinics;

    // Others see only clinics listed in their 'assignedClinics' array
    return selectedCountry.clinics.filter(clinic => 
      userProfile.assignedClinics?.includes(clinic.id)
    );
  }, [selectedCountry, userProfile]);

  const handleSelect = (clinic: ClinicConfig) => {
    onSelectClinic(clinic);
    navigate('/dashboard'); // Direct entry to dashboard upon selection
  };

  // Approval Check for Staged Users
  if (userProfile && !userProfile.isApproved && userProfile.role !== 'global_admin') {
    return (
      <Container maxWidth="sm" sx={{ py: 10 }}>
        <Alert severity="warning" variant="filled" icon={<LockClock sx={{ fontSize: 40 }} />} sx={{ borderRadius: 4, p: 3 }}>
          <AlertTitle sx={{ fontWeight: 900, fontSize: '1.2rem' }}>STATION PENDING APPROVAL</AlertTitle>
          Your account is currently <strong>Staged</strong>. Please contact a Global Admin (like Indranil) to set your profile to <strong>isApproved: true</strong>.
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" color="inherit" onClick={onBack} sx={{ color: 'black', fontWeight: 900 }}>
              Return to Countries
            </Button>
          </Box>
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button onClick={onBack} startIcon={<ArrowBack />} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>
          Back
        </Button>
        <Box>
          <Typography variant="h4" fontWeight={900} color="primary">Select Clinic</Typography>
          <Typography variant="subtitle1" color="text.secondary" fontWeight={700}>
            {selectedCountry.name} {selectedCountry.flag}
          </Typography>
        </Box>
      </Box>

      {authorizedClinics.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '2px dashed #cbd5e1' }}>
          <Typography variant="h6" fontWeight={800} color="text.secondary">No Access Found</Typography>
          <Typography variant="body2" color="text.disabled">
            You do not have any clinics assigned for {selectedCountry.name} in your Firestore profile.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {authorizedClinics.map((clinic) => (
            <Grid item xs={12} sm={6} key={clinic.id}>
              <Card 
                sx={{ 
                  borderRadius: 4, 
                  border: '2px solid transparent',
                  transition: '0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
                    transform: 'translateY(-4px)'
                  }
                }}
              >
                <CardActionArea onClick={() => handleSelect(clinic)} sx={{ p: 4 }}>
                  <Business color="primary" sx={{ fontSize: 40, mb: 2 }} />
                  <Typography variant="h5" fontWeight={900}>{clinic.name}</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ letterSpacing: 1 }}>ID: {clinic.id}</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Chip label="AUTHORIZED" color="success" size="small" icon={<CheckCircle sx={{ fontSize: 14 }} />} sx={{ fontWeight: 900, borderRadius: 1.5 }} />
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default ClinicSelection;