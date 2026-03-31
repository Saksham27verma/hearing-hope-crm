'use client';

import Box from '@mui/material/Box';
import { useCenterScope } from '@/hooks/useCenterScope';
import CenterScopeSwitcher from '@/components/user-management/CenterScopeSwitcher';

/**
 * Super-admin global vs center-scoped data view. Fixed below the main CRM header.
 * Delegates UI to {@link CenterScopeSwitcher} (MUI).
 */
export default function CenterScopeToolbar() {
  const { canOverrideScope, lockedCenterId } = useCenterScope();

  if (!canOverrideScope && !lockedCenterId) return null;

  return (
    <Box
      sx={{
        borderBottom: '1px solid #e8eaed',
        bgcolor: '#f8f9fa',
        px: { xs: 2, md: 3 },
        py: 1.5,
      }}
    >
      <CenterScopeSwitcher />
    </Box>
  );
}
