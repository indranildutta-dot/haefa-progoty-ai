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
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" fontWeight={800} gutterBottom color="primary">
          HAEFA PROGOTY
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
          Choose your operating country to load the correct clinical workflow configuration
        </Typography>
      </Box>

      <Grid container spacing={3} justifyContent="center">
        {countries.map((country) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={country.id}>
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
              <CardActionArea onClick={() => onSelectCountry(country)} sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h2">{country.flag}</Typography>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="h6" fontWeight={700}>{country.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {country.language} • {country.currency}
                    </Typography>
                  </Box>
                </Box>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default LandingPage;
