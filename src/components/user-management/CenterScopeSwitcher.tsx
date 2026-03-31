'use client';

import PublicIcon from '@mui/icons-material/Public';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CloseIcon from '@mui/icons-material/Close';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCenterScope } from '@/hooks/useCenterScope';
import { useEffect, useMemo, useState } from 'react';

const BAR_PAPER_SX = {
  elevation: 0,
  border: '1px solid #e0e2e6',
  boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.03)',
  bgcolor: '#ffffff',
  borderRadius: 2,
  px: 2.5,
  py: 2,
};

const DISMISS_STORAGE_KEY = 'crm-data-scope-lock-banner-dismissed-v1';

/**
 * Master data-scope control for the CRM. Super-admins can switch centers; multi-center users
 * switch within assigned centers; single-center users see a compact lock line (dismissible).
 */
export default function CenterScopeSwitcher() {
  const {
    lockedCenterId,
    allowedCenterIds,
    canOverrideScope,
    effectiveScopeCenterId,
    viewCenterMode,
    setViewCenterMode,
    centers,
    centersLoading,
  } = useCenterScope();

  const [lockBannerDismissed, setLockBannerDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setLockBannerDismissed(localStorage.getItem(DISMISS_STORAGE_KEY) === '1');
  }, []);

  const scopeCenters = useMemo(() => {
    if (!allowedCenterIds) return centers;
    return centers.filter((c) => allowedCenterIds.includes(c.id));
  }, [centers, allowedCenterIds]);

  const lockedName = lockedCenterId
    ? centers.find((c) => c.id === lockedCenterId)?.name ?? lockedCenterId
    : '';

  const readOnlyLabel = (() => {
    if (!effectiveScopeCenterId) return 'All assigned centers';
    return centers.find((c) => c.id === effectiveScopeCenterId)?.name ?? effectiveScopeCenterId;
  })();

  const dismissLockBanner = () => {
    setLockBannerDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISS_STORAGE_KEY, '1');
    }
  };

  if (centersLoading) {
    return (
      <Paper elevation={0} sx={BAR_PAPER_SX}>
        <Skeleton variant="rounded" width={280} height={40} sx={{ borderRadius: 1 }} />
      </Paper>
    );
  }

  if (lockedCenterId) {
    if (lockBannerDismissed) {
      return (
        <Paper elevation={0} sx={{ ...BAR_PAPER_SX, py: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <LockOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
              <Tooltip title="Your account is locked to this center across all modules.">
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', truncate: true }}>
                  Data scope: {lockedName}
                </Typography>
              </Tooltip>
            </Box>
            <Tooltip title="Show details">
              <IconButton
                size="small"
                aria-label="Expand data scope info"
                onClick={() => {
                  setLockBannerDismissed(false);
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem(DISMISS_STORAGE_KEY);
                  }
                }}
              >
                <UnfoldMoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      );
    }

    return (
      <Paper elevation={0} sx={BAR_PAPER_SX}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <LockOutlinedIcon sx={{ fontSize: 22, color: 'text.secondary', mt: 0.25, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              Data scope
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', mt: 0.25 }}>
              {lockedName}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ m: 0, mt: 0.5 }}>
              Your account is locked to this center across all modules.
            </Typography>
          </Box>
          <IconButton
            size="small"
            aria-label="Dismiss"
            onClick={dismissLockBanner}
            sx={{ flexShrink: 0, mt: -0.5 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Paper>
    );
  }

  if (canOverrideScope) {
    return (
      <Paper elevation={0} sx={BAR_PAPER_SX}>
        <TextField
          select
          fullWidth
          label="Data scope"
          value={viewCenterMode === 'all' ? 'all' : viewCenterMode}
          onChange={(e) => {
            const v = e.target.value;
            setViewCenterMode(v === 'all' ? 'all' : v);
          }}
          variant="outlined"
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PublicIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            maxWidth: 420,
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
              bgcolor: '#fafbfc',
            },
          }}
        >
          <MenuItem value="all">
            {allowedCenterIds && allowedCenterIds.length > 1 ? 'All assigned centers' : 'All centers'}
          </MenuItem>
          {scopeCenters.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={BAR_PAPER_SX}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <PublicIcon sx={{ fontSize: 22, color: 'text.secondary', mt: 0.25 }} />
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
            Data scope
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', mt: 0.25 }}>
            {readOnlyLabel}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
