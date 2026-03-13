import React from 'react';
import { Box, Container, CssBaseline, ThemeProvider, createTheme, Typography } from '@mui/material';
import TopNavigation from './TopNavigation';
import PatientContextBar from './PatientContextBar';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface StationLayoutProps {
  children: React.ReactNode;
  showPatientContext?: boolean;
  title?: string;
  stationName?: string;
  actions?: React.ReactNode;
}

const StationLayout: React.FC<StationLayoutProps> = ({ 
  children, 
  showPatientContext = true,
  title,
  stationName,
  actions
}) => {
  const { isMobile, isTablet } = useResponsiveLayout();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <TopNavigation />
      
      {showPatientContext && <PatientContextBar />}
      
      <Box component="main" sx={{ flexGrow: 1, pb: 10 }}> {/* pb for footer space */}
        <Container maxWidth="xl" sx={{ mt: isMobile ? 2 : 3 }}>
          {(title || stationName) && (
            <Box sx={{ 
              mb: isMobile ? 2 : 4, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              flexDirection: isMobile && actions ? 'column' : 'row',
              gap: 2
            }}>
              <Box>
                {stationName && (
                  <Typography 
                    variant="overline" 
                    sx={{ 
                      fontWeight: 800, 
                      color: 'info.main', 
                      letterSpacing: 1.5,
                      display: 'block',
                      mb: 0.5
                    }}
                  >
                    {stationName} STATION
                  </Typography>
                )}
                {title && (
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 900, 
                      color: 'primary.main',
                      fontSize: isMobile ? '1.75rem' : '2.25rem',
                      textTransform: 'uppercase',
                      lineHeight: 1.1
                    }}
                  >
                    {title}
                  </Typography>
                )}
              </Box>
              {actions && (
                <Box sx={{ display: 'flex', gap: 1, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                  {actions}
                </Box>
              )}
            </Box>
          )}
          {children}
        </Container>
      </Box>
    </Box>
  );
};

export default StationLayout;
