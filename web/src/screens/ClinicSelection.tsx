import React, { useMemo } from 'react';
import { 
  Container, Typography, Grid, Card, CardActionArea, 
  Box, Paper, Chip, Button, Alert, AlertTitle 
} from '@mui/material';
import { ArrowBack, CheckCircle, LockClock, Business } from '@mui/icons-material';
import { countries, CountryConfig, ClinicConfig } from '../config/countries';
import { useAppStore } from '../store/useAppStore';
import { useNavigate } from 'react-router-dom';

interface ClinicSelectionProps {
  selectedCountry: CountryConfig;
  onSelectClinic: (country: CountryConfig, clinic: ClinicConfig) => void;
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

    // Country Admins see all clinics in their assigned countries
    if (userProfile.role === 'country_admin' && Array.isArray(userProfile.assignedCountries) && userProfile.assignedCountries.includes(selectedCountry.id)) {
      return selectedCountry.clinics;
    }

    // Others see only clinics listed in their 'assignedClinics' array
    return selectedCountry.clinics.filter(clinic => 
      userProfile.assignedClinics?.includes(clinic.id)
    );
  }, [selectedCountry, userProfile]);

  // Find clinics in other countries that are in the user's assignedClinics list or assignedCountries list for Country Admins
  const otherAuthorizedClinics = useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.role === 'global_admin') return [];

    const list: Array<{ clinic: ClinicConfig; country: CountryConfig }> = [];
    const otherCountries = countries.filter(c => c.id !== selectedCountry.id);

    otherCountries.forEach(country => {
      const isCountryAdminForOther = userProfile.role === 'country_admin' && Array.isArray(userProfile.assignedCountries) && userProfile.assignedCountries.includes(country.id);
      country.clinics.forEach(clinic => {
        if (isCountryAdminForOther || userProfile.assignedClinics?.includes(clinic.id)) {
          list.push({ clinic, country });
        }
      });
    });

    return list;
  }, [selectedCountry, userProfile]);

  const handleSelect = (clinic: ClinicConfig) => {
    onSelectClinic(selectedCountry, clinic);
    navigate('/dashboard'); // Direct entry to dashboard upon selection
  };

  const handleSelectOther = (country: CountryConfig, clinic: ClinicConfig) => {
    onSelectClinic(country, clinic);
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
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button onClick={onBack} startIcon={<ArrowBack />} variant="outlined" sx={{ borderRadius: 2, fontWeight: 700 }}>
          Back
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight={900} color="primary">Select Clinic</Typography>
          <Typography variant="subtitle1" color="text.secondary" fontWeight={700}>
            {selectedCountry.name} {selectedCountry.flag}
          </Typography>
        </Box>
      </Box>

      {authorizedClinics.length === 0 ? (
        <Box>
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '2px dashed #cbd5e1', mb: 4 }}>
            <Typography variant="h6" fontWeight={800} color="text.secondary">No Access Found</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              You do not have any clinics assigned for {selectedCountry.name} in your Firestore profile.
            </Typography>
          </Paper>

          {otherAuthorizedClinics.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h5" fontWeight={900} color="primary" sx={{ mb: 1 }}>
                Your Assigned Clinics In Other Countries
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 4, fontWeight: 600 }}>
                We found clinics assigned to you in another country. Please click on a clinic below to select it and switch your session automatically:
              </Typography>
              <Grid container spacing={3}>
                {otherAuthorizedClinics.map(({ clinic, country }) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={clinic.id}>
                    <Card 
                      id={`cliniccard-${clinic.id}`}
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
                      <CardActionArea onClick={() => handleSelectOther(country, clinic)} sx={{ p: 4 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Business color="primary" sx={{ fontSize: 40 }} />
                          <Chip 
                            label={`${country.name} ${country.flag}`} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 800 }} 
                          />
                        </Box>
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
            </Box>
          )}
        </Box>
      ) : (
        <Box>
          <Grid container spacing={3}>
            {authorizedClinics.map((clinic) => (
              <Grid size={{ xs: 12, sm: 6 }} key={clinic.id}>
                <Card 
                  id={`cliniccard-${clinic.id}`}
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

          {otherAuthorizedClinics.length > 0 && (
            <Box sx={{ mt: 6 }}>
              <Typography variant="h6" fontWeight={800} color="text.secondary" sx={{ mb: 2 }}>
                Clinics In Other Countries
              </Typography>
              <Grid container spacing={3}>
                {otherAuthorizedClinics.map(({ clinic, country }) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={clinic.id}>
                    <Card 
                      id={`cliniccard-${clinic.id}`}
                      sx={{ 
                        borderRadius: 4, 
                        border: '2px solid transparent',
                        transition: '0.2s',
                        opacity: 0.8,
                        '&:hover': {
                          borderColor: 'primary.main',
                          boxShadow: '0 12px 24px rgba(0,0,0,0.1)',
                          transform: 'translateY(-4px)',
                          opacity: 1
                        }
                      }}
                    >
                      <CardActionArea onClick={() => handleSelectOther(country, clinic)} sx={{ p: 4 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Business color="primary" sx={{ fontSize: 32 }} />
                          <Chip 
                            label={`${country.name} ${country.flag}`} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                            sx={{ fontWeight: 800 }} 
                          />
                        </Box>
                        <Typography variant="h6" fontWeight={800}>{clinic.name}</Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ letterSpacing: 1 }}>ID: {clinic.id}</Typography>
                        <Box sx={{ mt: 2 }}>
                          <Chip label="AUTHORIZED" color="success" size="small" icon={<CheckCircle sx={{ fontSize: 12 }} />} sx={{ fontWeight: 900, borderRadius: 1.5 }} />
                        </Box>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}
    </Container>
  );
};

export default ClinicSelection;