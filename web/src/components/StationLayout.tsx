import { 
  Box, 
  Container, 
  CssBaseline, 
  ThemeProvider, 
  createTheme, 
  Typography,
  BottomNavigation,
  BottomNavigationAction,
  Paper
} from '@mui/material';
import { 
  PersonAdd as PersonAddIcon,
  LocalHospital as LocalHospitalIcon,
  Medication as MedicationIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Reg', to: '/', icon: <PersonAddIcon /> },
    { label: 'Vitals', to: '/vitals', icon: <LocalHospitalIcon /> },
    { label: 'Doctor', to: '/doctor', icon: <MedicationIcon /> },
    { label: 'Pharmacy', to: '/pharmacy', icon: <MedicationIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <TopNavigation />
      
      {showPatientContext && <PatientContextBar />}
      
      <Box component="main" sx={{ flexGrow: 1, pb: (isMobile || isTablet) ? 12 : 10 }}>
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

      {(isMobile || isTablet) && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }} elevation={3}>
          <BottomNavigation
            showLabels
            value={location.pathname}
            onChange={(event, newValue) => {
              navigate(newValue);
            }}
            sx={{ height: 72 }}
          >
            {navItems.map((item) => (
              <BottomNavigationAction 
                key={item.to}
                label={item.label} 
                value={item.to} 
                icon={item.icon} 
                sx={{
                  '&.Mui-selected': {
                    color: 'primary.main',
                    '& .MuiBottomNavigationAction-label': {
                      fontWeight: 800
                    }
                  }
                }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
};

export default StationLayout;
