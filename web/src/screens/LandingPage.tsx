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
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`, 
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
              fontWeight: 900, 
              letterSpacing: 6, 
              color: '#4fd1c5', // Vibrant teal/cyan
              mb: 1,
              display: 'block',
              fontSize: '1rem'
            }}
          >
            GLOBAL HEALTH PORTAL
          </Typography>
          <Typography 
            variant="h1" 
            sx={{ 
              fontWeight: 900, 
              fontSize: { xs: '3.5rem', md: '5rem', lg: '6rem' },
              lineHeight: 0.85,
              mb: 4,
              letterSpacing: '-0.05em',
              textShadow: '0 10px 30px rgba(0,0,0,0.2)'
            }}
          >
            HAEFA <br />
            <Box component="span" sx={{ color: 'secondary.main' }}>PROGOTY</Box>
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 400, 
              opacity: 0.9, 
              maxWidth: 520,
              lineHeight: 1.5,
              mb: 8,
              fontSize: '1.25rem'
            }}
          >
            A unified clinical operating system for high-impact healthcare delivery across borders. Select your region to begin.
          </Typography>

          <Stack direction="row" spacing={6}>
            <Box>
              <Typography variant="h3" fontWeight="900" sx={{ color: 'secondary.main' }}>3</Typography>
              <Typography variant="overline" sx={{ opacity: 0.7, fontWeight: 800, letterSpacing: 2 }}>Countries</Typography>
            </Box>
            <Box>
              <Typography variant="h3" fontWeight="900" sx={{ color: 'secondary.main' }}>250K+</Typography>
              <Typography variant="overline" sx={{ opacity: 0.7, fontWeight: 800, letterSpacing: 2 }}>Patients</Typography>
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
        bgcolor: '#f8fafc',
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          opacity: 0.2,
          pointerEvents: 'none'
        }
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
              <Grid size={{ xs: 12, sm: 6 }} key={country.id}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (index * 0.1) }}
                >
                  <Card 
                    sx={{ 
                      borderRadius: 5, 
                      border: '1px solid',
                      borderColor: 'rgba(255, 255, 255, 0.4)',
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      overflow: 'hidden',
                      '&:hover': {
                        borderColor: 'secondary.main',
                        background: '#fff',
                        transform: 'translateY(-8px)',
                        boxShadow: '0 20px 40px rgba(245, 158, 11, 0.15)',
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

          <Box sx={{ 
            mt: 8, 
            pt: 4, 
            borderTop: '1px solid', 
            borderColor: 'divider', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PublicIcon sx={{ color: 'text.disabled' }} />
              <Typography variant="body2" color="text.disabled" fontWeight="600" sx={{ letterSpacing: 0.5 }}>
                HAEFA GLOBAL NETWORK
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ 
                width: 8, 
                height: 8, 
                bgcolor: '#10b981', 
                borderRadius: '50%',
                boxShadow: '0 0 0 rgba(16, 185, 129, 0.4)',
                animation: 'pulse 2s infinite'
              }} />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase' }}>
                System Live
              </Typography>
            </Box>
          </Box>

          <style>
            {`
              @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
                100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
              }
            `}
          </style>
        </motion.div>
      </Box>
    </Box>
  );
};

export default LandingPage;
