'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import FieldOptionsSettings from '@/components/settings/FieldOptionsSettings';
import StaffPaymentNotifySettings from '@/components/settings/StaffPaymentNotifySettings';
import DueCallsNotifySettings from '@/components/settings/DueCallsNotifySettings';

export default function SettingsPage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default', minHeight: '100%' }}>
      <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <SettingsIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700}>
            Settings
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Configure enquiry dropdowns (reference, visit status, payments, filters, and more). Invoice fields still use the
          same Firestore collection but are managed from code for now — this page is Enquiries-only.
        </Typography>
        <DueCallsNotifySettings />
        <StaffPaymentNotifySettings />
        <Box sx={{ mt: 3 }}>
          <FieldOptionsSettings />
        </Box>
      </Box>
    </Box>
  );
}
