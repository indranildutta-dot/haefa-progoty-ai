import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Container, 
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Chip
} from '@mui/material';
import { Logout, AccountCircle } from '@mui/icons-material';
import RegistrationStation from './screens/RegistrationStation';
import VitalsStation from './screens/VitalsStation';
import DoctorDashboard from './screens/DoctorDashboard';
import PharmacyStation from './screens/PharmacyStation';
import QueueBoard from './screens/QueueBoard';
import ClinicOperationsDashboard from './screens/ClinicOperationsDashboard';
import LandingPage from './screens/LandingPage';
import LoginPage from './screens/LoginPage';
import ClinicSelection from './screens/ClinicSelection';
import { isFirebaseConfigValid } from './firebase';
import { Alert, AlertTitle, Paper } from '@mui/material';
import { subscribeToAuthChanges, logout, getUserProfile } from './services/authService';
import { getOrCreateClinicConfig } from './services/clinicService';
import { User } from 'firebase/auth';
import { CountryConfig, ClinicConfig } from './config/countries';
import { useAppStore } from './store/useAppStore';
import { Snackbar, Alert as MuiAlert } from '@mui/material';

const NotificationSystem: React.FC = () => {
  const { notifications, removeNotification } = useAppStore();

  return (
    <>
      {notifications.map((note) => (
        <Snackbar 
          key={note.id} 
          open={true} 
          autoHideDuration={5000} 
          onClose={() => removeNotification(note.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ mb: notifications.indexOf(note) * 8 }}
        >
          <MuiAlert 
            onClose={() => removeNotification(note.id)} 
            severity={note.type} 
            variant="filled" 
            sx={{ width: '100%', borderRadius: 2 }}
          >
            {note.message}
          </MuiAlert>
        </Snackbar>
      ))}
    </>
  );
};

const theme = createTheme({
  palette: {
    primary: {
      main: '#0f172a', // Deep Navy
      light: '#334155',
    },
    secondary: {
      main: '#f59e0b', // Amber
      light: '#fbbf24',
    },
    background: {
      default: '#f1f5f9', // Slate 100
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
    success: { main: '#10b981' },
    warning: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    info: { main: '#3b82f6' },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em' },
    h6: { fontWeight: 700, fontSize: '1.1rem' },
    subtitle1: { fontSize: '0.95rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 12, // Standardized border radius
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '8px 16px', textTransform: 'none' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      },
    },
  },
});

const App: React.FC = () => {
  const { selectedCountry, selectedClinic, clearCountry, clearClinic } = useAppStore();
  const [user, setUser] = useState<User | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    return subscribeToAuthChanges(setUser);
  }, []);

  const handleLogout = async () => {
    await logout();
    setAnchorEl(null);
  };

  const handleClearCountry = () => clearCountry();
  const handleClearClinic = () => clearClinic();

  if (!user) return <LoginPage selectedCountry={selectedCountry || { id: 'default', name: 'Default', flag: '🏳️', currency: 'USD', language: 'en', dateFormat: 'MM/DD/YYYY', clinics: [] }} onBack={() => {}} />;
  if (!selectedCountry) return <LandingPage onSelectCountry={(c) => useAppStore.getState().setSession(c, null)} />;
  if (!selectedClinic) return <ClinicSelection selectedCountry={selectedCountry} onSelectClinic={(c) => useAppStore.getState().setSession(selectedCountry, c)} onBack={handleClearCountry} />;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)', bgcolor: 'white', color: 'text.primary' }}>
          <Container maxWidth="xl">
            <Toolbar disableGutters sx={{ minHeight: 60 }}>
              <Typography
                variant="h6"
                noWrap
                component="div"
                sx={{ mr: 3, fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main' }}
              >
                HAEFA PROGOTY
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 3, borderRight: '1px solid rgba(0,0,0,0.08)', pr: 3 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>Context:</Typography>
                <Chip 
                  label={`${selectedCountry.name} ${selectedCountry.flag}`} 
                  onClick={handleClearCountry}
                  sx={{ fontWeight: 600, cursor: 'pointer', bgcolor: 'grey.100' }}
                  size="small"
                />
                <Chip 
                  label={selectedClinic.name} 
                  onClick={handleClearClinic}
                  sx={{ fontWeight: 600, cursor: 'pointer', bgcolor: 'grey.100' }}
                  size="small"
                  color="secondary"
                />
              </Box>

              <Box sx={{ flexGrow: 1, display: 'flex', gap: 0.5 }}>
                {[
                  { label: 'Operations', to: '/admin' },
                  { label: 'Registration', to: '/' },
                  { label: 'Vitals', to: '/vitals' },
                  { label: 'Doctor', to: '/doctor' },
                  { label: 'Pharmacy', to: '/pharmacy' },
                  { label: 'Queue Board', to: '/queue' },
                ].map((item) => (
                  <Button 
                    key={item.to}
                    component={Link} 
                    to={item.to} 
                    sx={{ 
                      fontWeight: 600, 
                      color: 'text.secondary',
                      '&.active': { color: 'primary.main', bgcolor: 'grey.100' }
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Box>

              <Box sx={{ flexGrow: 0, display: 'flex', alignItems: 'center', gap: 1, borderLeft: '1px solid rgba(0,0,0,0.08)', pl: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{user.email?.split('@')[0]}</Typography>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                    <AccountCircle />
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={() => setAnchorEl(null)}
                  sx={{ mt: 1 }}
                >
                  <MenuItem disabled>
                    <Typography variant="body2">{user.email}</Typography>
                  </MenuItem>
                  <MenuItem onClick={handleLogout}>
                    <Logout fontSize="small" sx={{ mr: 1 }} />
                    Logout
                  </MenuItem>
                </Menu>
              </Box>
            </Toolbar>
          </Container>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
          <Routes>
            <Route path="/admin" element={<ClinicOperationsDashboard countryId={selectedCountry.id} />} />
            <Route path="/" element={<RegistrationStation countryId={selectedCountry.id} />} />
            <Route path="/vitals" element={<VitalsStation countryId={selectedCountry.id} />} />
            <Route path="/doctor" element={<DoctorDashboard countryId={selectedCountry.id} />} />
            <Route path="/pharmacy" element={<PharmacyStation countryId={selectedCountry.id} />} />
            <Route path="/queue" element={<QueueBoard countryId={selectedCountry.id} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Container>
      </Box>
      <NotificationSystem />
    </ThemeProvider>
  );
};

export default App;
