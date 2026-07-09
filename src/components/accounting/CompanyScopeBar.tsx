'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Chip,
  Stack,
  Typography,
  Button,
  Alert,
  Paper,
  Skeleton,
} from '@mui/material';
import { Business as BusinessIcon, SwapHoriz as SwapIcon } from '@mui/icons-material';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';

export default function CompanyScopeBar() {
  const router = useRouter();
  const { selectedCompanyId, selectedCompanyName, companiesLoading } = useAccountingCompany();

  if (companiesLoading && !selectedCompanyId) {
    return (
      <Paper sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }} elevation={0} variant="outlined">
        <Skeleton variant="text" width={220} />
      </Paper>
    );
  }

  if (!selectedCompanyId) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}
        action={
          <Button color="inherit" size="small" onClick={() => router.push('/accounting')}>
            Select
          </Button>
        }
      >
        Select a company to continue.
      </Alert>
    );
  }

  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={{ p: 1.25, mb: 2, borderRadius: 2 }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap">
        <BusinessIcon color="primary" fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          Accounting for
        </Typography>
        <Chip
          label={selectedCompanyName || selectedCompanyId}
          color="primary"
          size="small"
          sx={{ fontWeight: 600 }}
        />
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<SwapIcon />}
          onClick={() => router.push('/accounting')}
          variant="outlined"
        >
          Switch Company
        </Button>
      </Stack>
    </Paper>
  );
}
