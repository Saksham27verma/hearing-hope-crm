'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';

const LoginPage = () => {
  const router = useRouter();
  const { user, loading: authLoading, signIn, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Redirect to dashboard if already logged in
    if (user && !authLoading) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Use auth error from context
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      setLoading(true);
      // Use the signIn from context
      await signIn(email, password);
      // Router redirect is handled by the signIn function
    } catch (err: any) {
      // Error handling is done via context
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          backgroundColor: '#f8f9fa'
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: '#f8f9fa',
        p: 2
      }}
    >
      {/* Logo and App Name */}
      <Box mb={4} textAlign="center">
        <Typography 
          variant="h3" 
          component="h1" 
          fontWeight="bold" 
          color="primary" 
          gutterBottom
        >
          Hearing Hope
        </Typography>
        <Typography variant="h6" color="text.secondary">
          CRM & Inventory Management
        </Typography>
      </Box>
      
      {/* Login Card */}
      <Card sx={{ maxWidth: 400, width: '100%', boxShadow: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" component="h2" gutterBottom align="center">
            Login
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              variant="outlined"
              margin="normal"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
            
            <TextField
              fullWidth
              label="Password"
              variant="outlined"
              margin="normal"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              disabled={loading || authLoading}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
            >
              {loading || authLoading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
            </Button>
          </form>
          
          <Typography variant="body2" align="center" sx={{ mt: 2 }}>
            Forgot password? Contact your administrator.
          </Typography>
        </CardContent>
      </Card>
      
      {/* Footer */}
      <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
        &copy; {new Date().getFullYear()} Hearing Hope. All rights reserved.
      </Typography>
    </Box>
  );
};

export default LoginPage; 