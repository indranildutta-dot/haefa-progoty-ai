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
  IconButton,
  Chip
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
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box sx={{ mb: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={onBack} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary">
            Select Clinic
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {selectedCountry.name} {selectedCountry.flag}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {selectedCountry.clinics.map((clinic) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={clinic.id}>
            <Card 
              sx={{ 
                borderRadius: 4, 
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }
              }}
            >
              <CardActionArea onClick={() => onSelectClinic(clinic)} sx={{ p: 3, textAlign: 'left' }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>{clinic.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>ID: {clinic.id}</Typography>
                <Chip label="Active" size="small" color="success" variant="outlined" />
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default ClinicSelection;
