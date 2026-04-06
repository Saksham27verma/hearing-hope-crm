'use client';

import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { useCenterScope } from '@/hooks/useCenterScope';
import CenterScopeSwitcher from '@/components/user-management/CenterScopeSwitcher';

/**
 * Super-admin global vs center-scoped data view. Fixed below the main CRM header.
 * Can be collapsed to a single line to reduce visual noise; expand when changing scope.
 */
export default function CenterScopeToolbar() {
  const {
    canOverrideScope,
    lockedCenterId,
    scopeToolbarExpanded,
    setScopeToolbarExpanded,
    centers,
    viewCenterMode,
    effectiveScopeCenterId,
    allowedCenterIds,
  } = useCenterScope();

  if (!canOverrideScope && !lockedCenterId) return null;

  const summaryLabel = useMemo(() => {
    if (lockedCenterId) {
      return centers.find((c) => c.id === lockedCenterId)?.name ?? lockedCenterId;
    }
    if (viewCenterMode === 'all' || !effectiveScopeCenterId) {
      return allowedCenterIds && allowedCenterIds.length > 1 ? 'All assigned centers' : 'All centers';
    }
    return centers.find((c) => c.id === effectiveScopeCenterId)?.name ?? effectiveScopeCenterId;
  }, [
    lockedCenterId,
    viewCenterMode,
    effectiveScopeCenterId,
    allowedCenterIds,
    centers,
  ]);

  return (
    <Box
      sx={{
        borderBottom: '1px solid #e8eaed',
        bgcolor: '#f8f9fa',
        px: { xs: 2, md: 3 },
        py: scopeToolbarExpanded ? 1.5 : 0.75,
      }}
    >
      {scopeToolbarExpanded ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <CenterScopeSwitcher />
          </Box>
          <Tooltip title="Collapse data scope bar">
            <IconButton
              size="small"
              aria-label="Collapse data scope bar"
              onClick={() => setScopeToolbarExpanded(false)}
              sx={{ mt: 0.25, flexShrink: 0 }}
            >
              <ExpandLessIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            minHeight: 32,
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontWeight: 600, fontSize: '0.8125rem', minWidth: 0 }}
          >
            Data scope:{' '}
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
              {summaryLabel}
            </Box>
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setScopeToolbarExpanded(true)}
            sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0 }}
          >
            Expand
          </Button>
        </Box>
      )}
    </Box>
  );
}
