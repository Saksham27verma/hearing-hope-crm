import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

export default function StaffLoading() {
  return (
    <Box 
      display="flex" 
      flexDirection="column"
      justifyContent="center" 
      alignItems="center" 
      minHeight="80vh"
    >
      <CircularProgress color="primary" size={50} />
      <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
        Loading staff management...
      </Typography>
    </Box>
  );
} 