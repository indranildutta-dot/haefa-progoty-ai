import React, { Component, ErrorInfo, ReactNode } from 'react';

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

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isFirestoreError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore Error: ${parsed.error}`;
            isFirestoreError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div style={{ 
          padding: '40px 20px', 
          textAlign: 'center', 
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#fef2f2',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '48px', 
            borderRadius: '24px', 
            border: '2px solid #ef4444',
            maxWidth: '600px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <svg 
              width="80" 
              height="80" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#ef4444" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ marginBottom: '24px' }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#991b1b', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
              SYSTEM ERROR
            </h1>
            <p style={{ fontSize: '18px', color: '#b91c1c', margin: '0 0 32px 0', fontWeight: '500' }}>
              {errorMessage}
            </p>
            
            {isFirestoreError && (
              <div style={{ 
                marginBottom: '32px', 
                padding: '16px', 
                backgroundColor: '#fff', 
                borderRadius: '8px', 
                textAlign: 'left', 
                border: '1px solid #fee2e2',
                overflowX: 'auto'
              }}>
                <span style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>
                  DIAGNOSTIC INFO:
                </span>
                <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#7f1d1d', fontFamily: 'monospace' }}>
                  {this.state.error?.message}
                </pre>
              </div>
            )}

            <button 
              onClick={this.handleReset}
              style={{ 
                height: '60px', 
                padding: '0 48px', 
                borderRadius: '12px', 
                fontWeight: '900', 
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ef4444')}
            >
              RESTART APPLICATION
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
