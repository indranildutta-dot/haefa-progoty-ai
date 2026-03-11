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
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom color="primary">
          Select Operating Country
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto' }}>
          Choose your operating country to load the correct clinical workflow configuration
        </Typography>
      </Box>

      <Grid container spacing={2} justifyContent="center">
        {countries.map((country) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={country.id}>
            <Card 
              sx={{ 
                borderRadius: 3, 
                border: '1px solid',
                borderColor: 'divider',
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }
              }}
            >
              <CardActionArea onClick={() => onSelectCountry(country)} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h3">{country.flag}</Typography>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="subtitle1" fontWeight={700}>{country.name}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {country.id.toUpperCase()} • {country.language} • {country.currency}
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
