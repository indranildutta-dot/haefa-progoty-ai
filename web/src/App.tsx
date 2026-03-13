import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { 
  CssBaseline,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import RegistrationStation from './screens/RegistrationStation';
import VitalsStation from './screens/VitalsStation';
import DoctorDashboard from './screens/DoctorDashboard';
import PharmacyStation from './screens/PharmacyStation';
import QueueBoard from './screens/QueueBoard';
import ClinicOperationsDashboard from './screens/ClinicOperationsDashboard';
import LandingPage from './screens/LandingPage';
import LoginPage from './screens/LoginPage';
import ClinicSelection from './screens/ClinicSelection';
import { subscribeToAuthChanges } from './services/authService';
import { User } from 'firebase/auth';
import { useAppStore } from './store/useAppStore';
import { Snackbar, Alert as MuiAlert } from '@mui/material';
import StationLayout from './components/StationLayout';

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
    body1: { fontSize: '1rem' }, // Default for tablet/desktop
    button: { textTransform: 'none', fontWeight: 600, fontSize: '1rem' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { 
          borderRadius: 8, 
          padding: '12px 24px', 
          textTransform: 'none',
          minHeight: 48, // Touch friendly
        },
        sizeSmall: {
          minHeight: 40,
          padding: '8px 16px',
        }
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          minHeight: 48, // Touch friendly
        }
      }
    }
  },
});

const App: React.FC = () => {
  const { selectedCountry, selectedClinic, clearCountry, clearClinic } = useAppStore();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return subscribeToAuthChanges(setUser);
  }, []);

  const handleClearCountry = () => clearCountry();

  if (!selectedCountry) return <LandingPage onSelectCountry={(c) => useAppStore.getState().setSession(c, null)} />;
  if (!user) return <LoginPage selectedCountry={selectedCountry} onBack={handleClearCountry} />;
  if (!selectedClinic) return <ClinicSelection selectedCountry={selectedCountry} onSelectClinic={(c) => useAppStore.getState().setSession(selectedCountry, c)} onBack={handleClearCountry} />;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/admin" element={<ClinicOperationsDashboard countryId={selectedCountry.id} />} />
        <Route path="/" element={<RegistrationStation countryId={selectedCountry.id} />} />
        <Route path="/vitals" element={<VitalsStation countryId={selectedCountry.id} />} />
        <Route path="/doctor" element={<DoctorDashboard countryId={selectedCountry.id} />} />
        <Route path="/pharmacy" element={<PharmacyStation countryId={selectedCountry.id} />} />
        <Route path="/queue" element={<QueueBoard countryId={selectedCountry.id} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <NotificationSystem />
    </ThemeProvider>
  );
};

export default App;
