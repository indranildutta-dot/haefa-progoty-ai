import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let isFirestoreError = false;
      
      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore Permission Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
          <Paper sx={{ p: 4, maxWidth: 600, width: '100%', borderRadius: 4, textAlign: 'center' }}>
            <Typography variant="h5" color="error" gutterBottom fontWeight="bold">
              Oops! Something went wrong.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
              {errorMessage}
            </Typography>
            {isFirestoreError && (
              <Typography variant="body2" sx={{ mb: 3, p: 2, bgcolor: '#fff5f5', borderRadius: 2, textAlign: 'left', fontFamily: 'monospace' }}>
                This usually means your Firebase Security Rules are blocking this action. Please ensure the rules are correctly configured in your Firebase Console.
              </Typography>
            )}
            <Button 
              variant="contained" 
              onClick={() => window.location.reload()}
              sx={{ borderRadius: 2 }}
            >
              Reload Application
            </Button>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
