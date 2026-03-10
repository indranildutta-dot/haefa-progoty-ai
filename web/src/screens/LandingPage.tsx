import React from 'react';
import { 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardActionArea, 
  Box,
  Paper
} from '@mui/material';
import { countries, CountryConfig } from '../config/countries';

interface LandingPageProps {
  onSelectCountry: (country: CountryConfig) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectCountry }) => {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, bgcolor: 'transparent' }}>
        <Typography variant="h2" fontWeight={800} gutterBottom color="primary">
          Welcome to HAEFA PROGOTY
        </Typography>
        <Typography variant="h5" color="text.secondary" sx={{ mb: 6 }}>
          Please select your country to continue
        </Typography>

        <Grid container spacing={4} justifyContent="center">
          {countries.map((country) => (
            <Grid size={{ xs: 12, sm: 4 }} key={country.id}>
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
                <CardActionArea onClick={() => onSelectCountry(country)} sx={{ p: 2 }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h1" sx={{ mb: 2 }}>
                      {country.flag}
                    </Typography>
                    <Typography variant="h5" fontWeight={700}>
                      {country.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {country.language} | {country.currency}
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

export default LandingPage;
