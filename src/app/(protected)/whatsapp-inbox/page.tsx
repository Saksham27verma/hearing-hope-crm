'use client';

import React, { Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import WhatsAppInboundInboxPage from '@/components/whatsapp-inbox/WhatsAppInboundInboxPage';

export default function WhatsAppInboxRoute() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      }
    >
      <WhatsAppInboundInboxPage />
    </Suspense>
  );
}
