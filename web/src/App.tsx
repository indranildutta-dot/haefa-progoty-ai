import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { 
  CssBaseline,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import AdminDashboard from './screens/AdminDashboard';
import AdminUserManagement from './screens/AdminUserManagement';
import RegistrationStation from './screens/RegistrationStation';
import VitalsStation from './screens/VitalsStation';
import DoctorDashboard from './screens/DoctorDashboard';
import PharmacyStation from './screens/PharmacyStation';
import QueueBoard from './screens/QueueBoard';
import ClinicOperationsDashboard from './screens/ClinicOperationsDashboard';
import LandingPage from './screens/LandingPage';
import LoginPage from './screens/LoginPage';
import ClinicSelection from './screens/ClinicSelection';
import { useAuth } from './hooks/useAuth';
import { useAppStore } from './store/useAppStore';
import { Snackbar, Alert as MuiAlert } from '@mui/material';
import ErrorBoundary from './components/ErrorBoundary';

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
  const { selectedCountry, selectedClinic, clearCountry, setUser: setStoreUser } = useAppStore();
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    setStoreUser(user, userProfile);
  }, [user, userProfile, setStoreUser]);

  const handleClearCountry = () => clearCountry();

  const router = React.useMemo(() => createBrowserRouter([
    {
      path: '/',
      element: (
        <ErrorBoundary>
          {!selectedCountry ? (
            <LandingPage onSelectCountry={(c) => useAppStore.getState().setSession(c, null)} />
          ) : !user ? (
            <LoginPage selectedCountry={selectedCountry} onBack={handleClearCountry} />
          ) : !selectedClinic ? (
            <ClinicSelection 
              selectedCountry={selectedCountry} 
              onSelectClinic={(c) => useAppStore.getState().setSession(selectedCountry, c)} 
              onBack={handleClearCountry} 
            />
          ) : (
            <Outlet />
          )}
        </ErrorBoundary>
      ),
      children: [
        { index: true, element: <RegistrationStation countryId={selectedCountry?.id || ''} /> },
        { path: 'admin', element: <AdminDashboard /> },
        { path: 'admin/users', element: <AdminUserManagement /> },
        { path: 'clinic-dashboard', element: <ClinicOperationsDashboard countryId={selectedCountry?.id || ''} /> },
        { path: 'vitals', element: <VitalsStation countryId={selectedCountry?.id || ''} /> },
        { path: 'doctor', element: <DoctorDashboard countryId={selectedCountry?.id || ''} /> },
        { path: 'pharmacy', element: <PharmacyStation countryId={selectedCountry?.id || ''} /> },
        { path: 'queue', element: <QueueBoard countryId={selectedCountry?.id || ''} /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ]
    }
  ]), [selectedCountry, selectedClinic, user, userProfile, loading]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
      <NotificationSystem />
    </ThemeProvider>
  );
};

export default App;
