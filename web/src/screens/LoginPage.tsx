import React, { useState } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  Box, 
  Button, 
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import { ArrowBack, Google } from '@mui/icons-material';
import { loginWithGoogle } from '../services/authService';
import { CountryConfig } from '../config/countries';

interface LoginPageProps {
  selectedCountry: CountryConfig;
  onBack: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ selectedCountry, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to login with Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
          <IconButton onClick={onBack} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight={800}>
              Sign In
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Accessing HAEFA PROGOTY - {selectedCountry.name} {selectedCountry.flag}
            </Typography>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleLogin}
          disabled={loading}
          startIcon={<Google />}
          sx={{ mt: 4, py: 2, fontWeight: 700, borderRadius: 2, fontSize: '1.1rem' }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Login with Haefa.org'}
        </Button>
      </Paper>
    </Container>
  );
};

export default LoginPage;
