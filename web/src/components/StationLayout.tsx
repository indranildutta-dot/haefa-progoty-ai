import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Snackbar,
  Alert,
  Stack
} from '@mui/material';
import { 
  PersonAdd as PersonAddIcon,
  LocalHospital as LocalHospitalIcon,
  Medication as MedicationIcon,
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import TopNavigation from './TopNavigation';
import PatientContextBar from './PatientContextBar';
import ClinicalSidebar from './ClinicalSidebar';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useAppStore } from '../store/useAppStore';

interface StationLayoutProps {
  children: React.ReactNode;
  showPatientContext?: boolean;
  hideSidebar?: boolean;
  title?: string;
  stationName?: string;
  actions?: React.ReactNode;
}

const StationLayout: React.FC<StationLayoutProps> = ({ 
  children, 
  showPatientContext = true,
  hideSidebar = false,
  title,
  stationName,
  actions
}) => {
  const { isMobile, isTablet, isDesktop } = useResponsiveLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { notifications, selectedPatient } = useAppStore();
  const [open, setOpen] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<any>(null);

  useEffect(() => {
    if (notifications.length > 0) {
      setCurrentNotification(notifications[notifications.length - 1]);
      setOpen(true);
    }
  }, [notifications]);

  const handleClose = () => {
    setOpen(false);
  };

  // Navigation Items including the Queue overview
  const navItems = [
    { label: 'Reg', to: '/registration', icon: <PersonAddIcon /> },
    { label: 'Queue', to: '/queue', icon: <DashboardIcon /> },
    { label: 'Body Measures', to: '/vitals-1', icon: <LocalHospitalIcon /> },
    { label: 'Vitals', to: '/vitals-2', icon: <LocalHospitalIcon /> },
    { label: 'Labs', to: '/labs-and-risk', icon: <LocalHospitalIcon /> },
    { label: 'Doc', to: '/doctor', icon: <AssignmentIcon /> },
    { label: 'Pharmacy', to: '/pharmacy', icon: <MedicationIcon /> },
  ];

  const showSidebar = showPatientContext && selectedPatient && !isMobile && !hideSidebar;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <TopNavigation />
      
      {/* Sticky Patient Alert Bar */}
      {showPatientContext && <PatientContextBar />}
      
      <Box component="main" sx={{ flexGrow: 1, pb: isMobile ? 14 : 10 }}>
        <Container maxWidth="xl" sx={{ mt: isMobile ? 2 : 4 }}>
          {(title || stationName) && (
            <Box sx={{ 
              mb: isMobile ? 3 : 5, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexDirection: isMobile && actions ? 'column' : 'row',
              gap: 2
            }}>
              <Box>
                {stationName && (
                  <Typography 
                    variant="overline" 
                    sx={{ 
                      fontWeight: 900, 
                      color: 'primary.main', 
                      letterSpacing: 2,
                      display: 'block',
                      mb: 0
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
                      color: '#0f172a',
                      fontSize: isMobile ? '1.5rem' : '2rem',
                      textTransform: 'uppercase',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    {title}
                  </Typography>
                )}
              </Box>
              {actions && (
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1.5, 
                  width: isMobile ? '100%' : 'auto', 
                  justifyContent: isMobile ? 'flex-start' : 'flex-end' 
                }}>
                  {actions}
                </Box>
              )}
            </Box>
          )}
          
          {/* Dashboard/Workspace Content with Sidebar */}
          <Stack direction="row" spacing={4} alignItems="flex-start">
            <Box sx={{ flexGrow: 1 }}>
              {children}
            </Box>
            {showSidebar && <ClinicalSidebar />}
          </Stack>
        </Container>
      </Box>

      {/* Notification Snackbar */}
      <Snackbar open={open} autoHideDuration={6000} onClose={handleClose}>
        <Alert onClose={handleClose} severity={currentNotification?.type || 'info'} sx={{ width: '100%' }}>
          {currentNotification?.message}
        </Alert>
      </Snackbar>

      {/* Mobile Persistent Footer Navigation */}
      {isMobile && (
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200, borderTop: '1px solid #e2e8f0' }} elevation={10}>
          <BottomNavigation
            showLabels
            value={location.pathname}
            onChange={(event, newValue) => {
              navigate(newValue);
            }}
            sx={{ height: 80, bgcolor: 'white' }}
          >
            {navItems.map((item) => (
              <BottomNavigationAction 
                key={item.to}
                label={item.label} 
                value={item.to} 
                icon={item.icon} 
                sx={{
                  color: '#64748b',
                  '&.Mui-selected': {
                    color: 'primary.main',
                    '& .MuiBottomNavigationAction-label': {
                      fontWeight: 900,
                      fontSize: '0.75rem'
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