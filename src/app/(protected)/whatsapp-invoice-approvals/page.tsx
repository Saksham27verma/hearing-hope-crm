'use client';

import React, { Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import WhatsAppInvoiceApprovalsPage from '@/components/whatsapp-approvals/WhatsAppInvoiceApprovalsPage';

export default function WhatsAppInvoiceApprovalsRoute() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      }
    >
      <WhatsAppInvoiceApprovalsPage />
    </Suspense>
  );
}
