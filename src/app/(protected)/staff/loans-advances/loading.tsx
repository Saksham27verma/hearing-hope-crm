'use client';

import React from 'react';
import { Box, CircularProgress, Typography, Paper } from '@mui/material';

export default function LoadingLoansAdvances() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={1}>
        Staff Loans & Advances
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Manage staff loans, advances, and repayment schedules
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Paper
          elevation={0}
          sx={{ 
            p: 4, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <CircularProgress size={48} color="primary" />
          <Typography mt={2} color="text.secondary">
            Loading loans and advances data...
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
} 