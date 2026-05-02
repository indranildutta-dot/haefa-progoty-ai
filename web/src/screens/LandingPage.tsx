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
import { useNavigate } from 'react-router-dom';
import { countries, CountryConfig } from '../config/countries';
import { useAppStore } from '../store/useAppStore';
import PublicIcon from '@mui/icons-material/Public';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const LandingPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { setSelectedCountry } = useAppStore();
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSelect = (country: CountryConfig) => {
    // Logic: Initialize session state and move to login
    setSelectedCountry(country);
    navigate('/login');
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: { xs: 'column', md: 'row' },
      bgcolor: 'background.default',
      overflow: 'hidden'
    }}>
      {/* LEFT SIDE: Branding & Hero */}
      <Box sx={{ 
        flex: { xs: 'none', md: 0.7 }, 
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`, 
        color: 'white',
        p: { xs: 4, md: 6, lg: 10 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        borderRight: '1px solid',
        borderColor: alpha('#fff', 0.1)
      }}>
        {/* Decorative background element */}
        <Box sx={{ 
          position: 'absolute', 
          top: -100, 
          right: -100, 
          width: 400, 
          height: 400, 
          borderRadius: '50%', 
          bgcolor: alpha('#4fd1c5', 0.15),
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
              color: '#4fd1c5', 
              mb: 1,
              display: 'block',
              fontSize: '0.9rem'
            }}
          >
            GLOBAL HEALTH PORTAL
          </Typography>
          <Typography 
            variant="h1" 
            sx={{ 
              fontWeight: 900, 
              fontSize: { xs: '3rem', md: '4.5rem', lg: '5.5rem' },
              lineHeight: 1.1,
              mb: 3,
              letterSpacing: '-0.04em',
              textShadow: '0 10px 30px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box component="span">HAEFA</Box>
            <Box component="span" sx={{ 
              color: '#4fd1c5',
              mt: -1,
              filter: 'drop-shadow(0 0 20px rgba(79, 209, 197, 0.3))'
            }}>
              PROGOTY
            </Box>
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 400, 
              opacity: 0.9, 
              maxWidth: 480,
              lineHeight: 1.6,
              mb: 6,
              fontSize: '1.1rem'
            }}
          >
            A unified clinical operating system for high-impact healthcare delivery across borders. Select your region to begin.
          </Typography>

          <Stack direction="row" spacing={6}>
            <Box>
              <Typography variant="h3" fontWeight="900" sx={{ color: '#4fd1c5' }}>3</Typography>
              <Typography variant="overline" sx={{ opacity: 0.7, fontWeight: 800, letterSpacing: 2 }}>Countries</Typography>
            </Box>
            <Box>
              <Typography variant="h3" fontWeight="900" sx={{ color: '#4fd1c5' }}>250K+</Typography>
              <Typography variant="overline" sx={{ opacity: 0.7, fontWeight: 800, letterSpacing: 2 }}>Patients</Typography>
            </Box>
          </Stack>
        </motion.div>
      </Box>

      {/* RIGHT SIDE: Country Selection */}
      <Box sx={{ 
        flex: { xs: 'none', md: 1.3 }, 
        p: { xs: 4, md: 6, lg: 8 },
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
              <Grid size={{ xs: 12 }} key={country.id}>
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (index * 0.1) }}
                >
                  <Card 
                    sx={{ 
                      borderRadius: 4, 
                      border: '1px solid',
                      borderColor: '#e2e8f0',
                      background: '#fff',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      transition: 'all 0.3s ease',
                      overflow: 'hidden',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: '0 12px 24px rgba(0,0,0,0.08)',
                        '& .arrow-icon': {
                          transform: 'translateX(8px)',
                          color: 'primary.main'
                        }
                      }
                    }}
                  >
                    <CardActionArea 
                      onClick={() => handleSelect(country)} 
                      sx={{ p: { xs: 3, md: 4 } }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={4}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 3, md: 5 }, flexGrow: 1, minWidth: 0 }}>
                          <Box sx={{ 
                            fontSize: { xs: '2.5rem', md: '3.5rem' }, 
                            lineHeight: 1,
                            flexShrink: 0
                          }}>
                            {country.flag}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography 
                              variant="h5" 
                              fontWeight="900" 
                              color="primary"
                              sx={{ 
                                fontSize: { xs: '1.25rem', md: '1.75rem' },
                                lineHeight: 1.2,
                                mb: 0.5
                              }}
                            >
                              {country.name}
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              color: 'text.secondary', 
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: 1.5,
                              fontSize: '0.75rem'
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
                            fontSize: 32,
                            flexShrink: 0
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
                bgcolor: isOnline ? '#10b981' : '#f59e0b', 
                borderRadius: '50%',
                boxShadow: isOnline ? '0 0 0 rgba(16, 185, 129, 0.4)' : 'none',
                animation: isOnline ? 'pulse 2s infinite' : 'none'
              }} />
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 700, textTransform: 'uppercase' }}>
                {isOnline ? 'System Live' : 'Offline Mode'}
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