'use client';

import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';
import Link from 'next/link';
import ContactsIcon from '@mui/icons-material/Contacts';
import MailIcon from '@mui/icons-material/Mail';

export default function InteractionPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Interaction Management
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Paper
            component={Link}
            href="/interaction/visitors"
            sx={{ 
              p: 3, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit',
              transition: '0.3s',
              '&:hover': { 
                boxShadow: 6,
                transform: 'translateY(-5px)'
              }
            }}
          >
            <ContactsIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6">Visitors</Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Manage walk-in visitors and appointments
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} sm={6} md={4}>
          <Paper
            component={Link}
            href="/interaction/enquiries"
            sx={{ 
              p: 3, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              textDecoration: 'none',
              color: 'inherit',
              transition: '0.3s',
              '&:hover': { 
                boxShadow: 6,
                transform: 'translateY(-5px)'
              }
            }}
          >
            <MailIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6">Enquiries</Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Track and respond to customer enquiries
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
} 