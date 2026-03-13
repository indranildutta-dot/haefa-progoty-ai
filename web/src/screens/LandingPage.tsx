import React from 'react';
import { 
  Typography, 
  Grid, 
  Card, 
  CardActionArea, 
  Box,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import { motion } from 'motion/react';
import { countries, CountryConfig } from '../config/countries';
import PublicIcon from '@mui/icons-material/Public';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface LandingPageProps {
  onSelectCountry: (country: CountryConfig) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectCountry }) => {
  const theme = useTheme();

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: { xs: 'column', md: 'row' },
      bgcolor: 'background.default',
      overflow: 'hidden'
    }}>
      {/* Left Side: Branding & Hero */}
      <Box sx={{ 
        flex: { xs: 'none', md: 1 }, 
        bgcolor: 'primary.main', 
        color: 'white',
        p: { xs: 4, md: 8, lg: 12 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative background element */}
        <Box sx={{ 
          position: 'absolute', 
          top: -100, 
          right: -100, 
          width: 400, 
          height: 400, 
          borderRadius: '50%', 
          bgcolor: alpha(theme.palette.secondary.main, 0.1),
          filter: 'blur(80px)'
        }} />

        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <Typography 
            variant="overline" 
            sx={{ 
              fontWeight: 800, 
              letterSpacing: 4, 
              color: 'secondary.main',
              mb: 2,
              display: 'block'
            }}
          >
            GLOBAL HEALTH PORTAL
          </Typography>
          <Typography 
            variant="h1" 
            sx={{ 
              fontWeight: 900, 
              fontSize: { xs: '3rem', md: '4.5rem', lg: '5.5rem' },
              lineHeight: 0.9,
              mb: 4,
              letterSpacing: '-0.04em'
            }}
          >
            HAEFA <br />
            <Box component="span" sx={{ color: 'secondary.main' }}>PROGOTY</Box>
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 400, 
              opacity: 0.8, 
              maxWidth: 500,
              lineHeight: 1.6,
              mb: 6
            }}
          >
            A unified clinical operating system for high-impact healthcare delivery across borders. Select your region to begin.
          </Typography>

          <Stack direction="row" spacing={4}>
            <Box>
              <Typography variant="h4" fontWeight="900">2+</Typography>
              <Typography variant="caption" sx={{ opacity: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Countries</Typography>
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="900">10k+</Typography>
              <Typography variant="caption" sx={{ opacity: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Patients</Typography>
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="900">24/7</Typography>
              <Typography variant="caption" sx={{ opacity: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Operations</Typography>
            </Box>
          </Stack>
        </motion.div>
      </Box>

      {/* Right Side: Country Selection */}
      <Box sx={{ 
        flex: { xs: 'none', md: 1.2 }, 
        p: { xs: 4, md: 8, lg: 10 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        bgcolor: '#f8fafc'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Box sx={{ mb: 6 }}>
            <Typography variant="h4" fontWeight="900" gutterBottom color="primary">
              Select Region
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Clinical protocols and workflows will be tailored to your selection.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {countries.map((country, index) => (
              <Grid item xs={12} sm={6} key={country.id}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (index * 0.1) }}
                >
                  <Card 
                    sx={{ 
                      borderRadius: 4, 
                      border: '2px solid transparent',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                      transition: 'all 0.3s ease',
                      overflow: 'hidden',
                      '&:hover': {
                        borderColor: 'secondary.main',
                        boxShadow: '0 12px 40px rgba(245, 158, 11, 0.15)',
                        '& .arrow-icon': {
                          transform: 'translateX(8px)',
                          color: 'secondary.main'
                        }
                      }
                    }}
                  >
                    <CardActionArea 
                      onClick={() => onSelectCountry(country)} 
                      sx={{ p: 4 }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Box sx={{ 
                            fontSize: '4rem', 
                            lineHeight: 1,
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
                          }}>
                            {country.flag}
                          </Box>
                          <Box>
                            <Typography variant="h5" fontWeight="900" color="primary">
                              {country.name}
                            </Typography>
                            <Typography variant="caption" sx={{ 
                              color: 'text.secondary', 
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 1
                            }}>
                              {country.language} • {country.currency}
                            </Typography>
                          </Box>
                        </Box>
                        <ArrowForwardIcon 
                          className="arrow-icon"
                          sx={{ 
                            transition: 'all 0.3s ease', 
                            color: 'divider',
                            fontSize: 32
                          }} 
                        />
                      </Stack>
                    </CardActionArea>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 8, pt: 4, borderTop: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
            <PublicIcon sx={{ color: 'text.disabled' }} />
            <Typography variant="body2" color="text.disabled" fontWeight="500">
              HAEFA Global Network • Secure Clinical Access
            </Typography>
          </Box>
        </motion.div>
      </Box>
    </Box>
  );
};

export default LandingPage;
