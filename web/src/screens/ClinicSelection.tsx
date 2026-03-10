import React from 'react';
import { 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardActionArea, 
  Box,
  Paper,
  IconButton
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { CountryConfig, ClinicConfig } from '../config/countries';

interface ClinicSelectionProps {
  selectedCountry: CountryConfig;
  onSelectClinic: (clinic: ClinicConfig) => void;
  onBack: () => void;
}

const ClinicSelection: React.FC<ClinicSelectionProps> = ({ selectedCountry, onSelectClinic, onBack }) => {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, bgcolor: 'transparent' }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconButton onClick={onBack} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h3" fontWeight={800} color="primary">
            Select Clinic in {selectedCountry.name} {selectedCountry.flag}
          </Typography>
        </Box>
        
        <Typography variant="h6" color="text.secondary" sx={{ mb: 6 }}>
          Please choose the facility you are currently working at
        </Typography>

        <Grid container spacing={4} justifyContent="center">
          {selectedCountry.clinics.map((clinic) => (
            <Grid size={{ xs: 12, sm: 6 }} key={clinic.id}>
              <Card 
                elevation={0} 
                sx={{ 
                  borderRadius: 4, 
                  border: '2px solid transparent',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: 'secondary.main',
                    transform: 'translateY(-8px)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
                  }
                }}
              >
                <CardActionArea onClick={() => onSelectClinic(clinic)} sx={{ p: 4 }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" fontWeight={700}>
                      {clinic.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      ID: {clinic.id}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Container>
  );
};

export default ClinicSelection;
