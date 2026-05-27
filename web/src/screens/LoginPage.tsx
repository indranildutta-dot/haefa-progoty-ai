import React, { useState } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  Box, 
  Button, 
  Alert,
  CircularProgress,
  IconButton,
  TextField,
  InputAdornment
} from '@mui/material';
import { ArrowBack, Email, Lock, Visibility, VisibilityOff, Login } from '@mui/icons-material';
import { loginWithEmailAndPassword } from '../services/authService';
import { CountryConfig } from '../config/countries';

interface LoginPageProps {
  selectedCountry: CountryConfig;
  onBack: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ selectedCountry, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email/username and password.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await loginWithEmailAndPassword(email.trim(), password.trim());
    } catch (err: any) {
      console.error(err);
      let friendlyMessage = err.message || 'Failed to authenticate.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        friendlyMessage = 'Invalid email or password. Please try again.';
      } else if (err.code === 'auth/network-request-failed') {
        friendlyMessage = 'Network connection issue. Please check your internet connection.';
      }
      setError(friendlyMessage);
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

        <Box component="form" onSubmit={handleLogin} noValidate>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email or Username"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />

          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Login />}
            sx={{ mt: 4, py: 2, fontWeight: 700, borderRadius: 2, fontSize: '1.1rem', textTransform: 'none' }}
          >
            {loading ? 'Signing In...' : 'Sign In to Clinic'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default LoginPage;
