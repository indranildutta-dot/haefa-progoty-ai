import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Container, 
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme
} from '@mui/material';
import RegistrationStation from './screens/RegistrationStation';
import VitalsStation from './screens/VitalsStation';
import DoctorDashboard from './screens/DoctorDashboard';
import PharmacyStation from './screens/PharmacyStation';
import { isFirebaseConfigValid } from './firebase';
import { Alert, AlertTitle, Paper } from '@mui/material';

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
  const countryId = 'BD'; // Default country for now

  if (!isFirebaseConfigValid) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
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
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
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
                <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
                  <Button component={Link} to="/" sx={{ fontWeight: 600 }}>Registration</Button>
                  <Button component={Link} to="/vitals" sx={{ fontWeight: 600 }}>Vitals</Button>
                  <Button component={Link} to="/doctor" sx={{ fontWeight: 600 }}>Doctor</Button>
                  <Button component={Link} to="/pharmacy" sx={{ fontWeight: 600 }}>Pharmacy</Button>
                </Box>
              </Toolbar>
            </Container>
          </AppBar>

          <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Routes>
              <Route path="/" element={<RegistrationStation countryId={countryId} />} />
              <Route path="/vitals" element={<VitalsStation countryId={countryId} />} />
              <Route path="/doctor" element={<DoctorDashboard countryId={countryId} />} />
              <Route path="/pharmacy" element={<PharmacyStation countryId={countryId} />} />
            </Routes>
          </Container>
        </Box>
      </Router>
    </ThemeProvider>
  );
};

export default App;
