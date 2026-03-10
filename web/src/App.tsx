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
import AdminDashboard from './screens/AdminDashboard';
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
      main: '#0f172a',
    },
    secondary: {
      main: '#10b981',
    },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
});

const App: React.FC = () => {
  const { 
    user, 
    setUser, 
    selectedCountry, 
    selectedClinic, 
    setSession,
    setClinicConfig,
    notify 
  } = useAppStore();
  
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges(async (u) => {
      if (u) {
        try {
          const profile = await getUserProfile(u.uid);
          setUser(u, profile);
          
          // Fetch clinic config if session is already selected
          const state = useAppStore.getState();
          if (state.selectedCountry && state.selectedClinic) {
            const config = await getOrCreateClinicConfig(
              state.selectedCountry.id,
              state.selectedCountry.name,
              state.selectedClinic.id,
              state.selectedClinic.name
            );
            setClinicConfig(config);
          }
        } catch (err) {
          console.error("Failed to fetch user profile or clinic config:", err);
          setUser(u, null);
        }
      } else {
        setUser(null, null);
        setClinicConfig(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser, setClinicConfig]);

  const handleSelectCountry = (country: CountryConfig) => {
    setSession(country, null);
  };

  const handleSelectClinic = async (clinic: ClinicConfig) => {
    setSession(selectedCountry, clinic);
    if (selectedCountry) {
      try {
        const config = await getOrCreateClinicConfig(
          selectedCountry.id,
          selectedCountry.name,
          clinic.id,
          clinic.name
        );
        setClinicConfig(config);
      } catch (err) {
        console.error("Failed to fetch clinic config:", err);
      }
    }
    notify(`Switched to ${clinic.name}`, 'success');
  };

  const handleLogout = async () => {
    await logout();
    setAnchorEl(null);
    notify('Logged out successfully');
  };

  const handleClearCountry = () => {
    setSession(null, null);
  };

  const handleClearClinic = () => {
    setSession(selectedCountry, null);
  };

  const renderContent = () => {
    if (!isFirebaseConfigValid) {
      return (
        <Container maxWidth="sm" sx={{ mt: 10 }}>
          <Paper elevation={0} sx={{ p: 4, border: '1px solid', borderColor: 'divider', borderRadius: 4 }}>
            <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
              <AlertTitle sx={{ fontWeight: 700 }}>Configuration Required</AlertTitle>
              Firebase API keys are missing. To use this application, you must provide your Firebase configuration in the <strong>Secrets</strong> panel.
            </Alert>
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Please set the following environment variables:
              </Typography>
              <Box component="pre" sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 2, fontSize: '0.75rem', overflow: 'auto' }}>
                VITE_FIREBASE_API_KEY=...<br />
                VITE_FIREBASE_AUTH_DOMAIN=...<br />
                VITE_FIREBASE_PROJECT_ID=...<br />
                VITE_FIREBASE_STORAGE_BUCKET=...<br />
                VITE_FIREBASE_MESSAGING_SENDER_ID=...<br />
                VITE_FIREBASE_APP_ID=...
              </Box>
            </Box>
          </Paper>
        </Container>
      );
    }

    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <Typography variant="h6">Loading HAEFA PROGOTY...</Typography>
        </Box>
      );
    }

    if (!selectedCountry) {
      return <LandingPage onSelectCountry={handleSelectCountry} />;
    }

    if (!selectedClinic) {
      return <ClinicSelection 
        selectedCountry={selectedCountry} 
        onSelectClinic={handleSelectClinic} 
        onBack={handleClearCountry} 
      />;
    }

    if (!user) {
      return <LoginPage selectedCountry={selectedCountry} onBack={handleClearClinic} />;
    }

    return (
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid rgba(0,0,0,0.1)', bgcolor: 'white', color: 'text.primary' }}>
          <Container maxWidth="xl">
            <Toolbar disableGutters>
              <Typography
                variant="h6"
                noWrap
                component="div"
                sx={{ mr: 4, fontWeight: 800, letterSpacing: '-0.02em', color: 'primary.main' }}
              >
                HAEFA PROGOTY
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1, mr: 4 }}>
                <Chip 
                  label={`${selectedCountry.name} ${selectedCountry.flag}`} 
                  onClick={handleClearCountry}
                  sx={{ fontWeight: 600, cursor: 'pointer' }}
                  variant="outlined"
                />
                <Chip 
                  label={selectedClinic.name} 
                  onClick={handleClearClinic}
                  sx={{ fontWeight: 600, cursor: 'pointer' }}
                  variant="outlined"
                  color="secondary"
                />
              </Box>

              <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
                <Button component={Link} to="/admin" sx={{ fontWeight: 600 }}>Admin</Button>
                <Button component={Link} to="/" sx={{ fontWeight: 600 }}>Registration</Button>
                <Button component={Link} to="/vitals" sx={{ fontWeight: 600 }}>Vitals</Button>
                <Button component={Link} to="/doctor" sx={{ fontWeight: 600 }}>Doctor</Button>
                <Button component={Link} to="/pharmacy" sx={{ fontWeight: 600 }}>Pharmacy</Button>
                <Button component={Link} to="/queue" sx={{ fontWeight: 600, color: 'secondary.main' }}>Queue Board</Button>
              </Box>

              <Box sx={{ flexGrow: 0 }}>
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
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

        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Routes>
            <Route path="/admin" element={<AdminDashboard countryId={selectedCountry.id} />} />
            <Route path="/" element={<RegistrationStation countryId={selectedCountry.id} />} />
            <Route path="/vitals" element={<VitalsStation countryId={selectedCountry.id} />} />
            <Route path="/doctor" element={<DoctorDashboard countryId={selectedCountry.id} />} />
            <Route path="/pharmacy" element={<PharmacyStation countryId={selectedCountry.id} />} />
            <Route path="/queue" element={<QueueBoard countryId={selectedCountry.id} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Container>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {renderContent()}
      <NotificationSystem />
    </ThemeProvider>
  );
};

export default App;
