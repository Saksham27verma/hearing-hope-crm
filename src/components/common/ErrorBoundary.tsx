'use client';

import React from 'react';
import { Box, Typography, Button, Paper, Alert, AlertTitle } from '@mui/material';
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{error?: Error; retry: () => void}>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { 
      hasError: true,
      error 
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // In production, you might want to log this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
      console.error('Production error:', error.message);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} retry={this.handleRetry} />;
      }

      return (
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
          p={3}
        >
          <Paper 
            elevation={3} 
            sx={{ 
              p: 4, 
              maxWidth: 600, 
              width: '100%',
              textAlign: 'center'
            }}
          >
            <ErrorIcon 
              sx={{ 
                fontSize: 64, 
                color: 'error.main', 
                mb: 2 
              }} 
            />
            
            <Typography variant="h5" gutterBottom color="error">
              Something went wrong
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              We apologize for the inconvenience. An unexpected error has occurred.
            </Typography>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
                <AlertTitle>Development Error Details</AlertTitle>
                <Typography variant="body2" component="pre" sx={{ 
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: 200
                }}>
                  {this.state.error.message}
                  {this.state.error.stack && (
                    <details>
                      <summary>Stack Trace</summary>
                      {this.state.error.stack}
                    </details>
                  )}
                </Typography>
              </Alert>
            )}

            <Box display="flex" gap={2} justifyContent="center">
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={this.handleRetry}
              >
                Try Again
              </Button>
              
              <Button
                variant="outlined"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { handleError, clearError, hasError: !!error };
}

// Higher-Order Component version
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

export default ErrorBoundary;
