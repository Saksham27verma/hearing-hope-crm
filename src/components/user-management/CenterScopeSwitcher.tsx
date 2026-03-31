'use client';

import PublicIcon from '@mui/icons-material/Public';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCenterScope } from '@/hooks/useCenterScope';

const BAR_PAPER_SX = {
  elevation: 0,
  border: '1px solid #e0e2e6',
  boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.03)',
  bgcolor: '#ffffff',
  borderRadius: 2,
  px: 2.5,
  py: 2,
};

/**
 * Master data-scope control for the CRM. Super-admins can switch centers; locked users
 * see their assigned center only. Updates flow through {@link useCenterScope}.
 */
export default function CenterScopeSwitcher() {
  const {
    lockedCenterId,
    canOverrideScope,
    effectiveScopeCenterId,
    viewCenterMode,
    setViewCenterMode,
    centers,
    centersLoading,
  } = useCenterScope();

  const lockedName = lockedCenterId
    ? centers.find((c) => c.id === lockedCenterId)?.name ?? lockedCenterId
    : '';

  const readOnlyLabel = (() => {
    if (!effectiveScopeCenterId) return 'All centers';
    return centers.find((c) => c.id === effectiveScopeCenterId)?.name ?? effectiveScopeCenterId;
  })();

  if (centersLoading) {
    return (
      <Paper elevation={0} sx={BAR_PAPER_SX}>
        <Skeleton variant="rounded" width={280} height={40} sx={{ borderRadius: 1 }} />
      </Paper>
    );
  }

  if (lockedCenterId) {
    return (
      <Paper elevation={0} sx={BAR_PAPER_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <LockOutlinedIcon sx={{ fontSize: 22, color: 'text.secondary' }} />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
              Data scope
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', mt: 0.25 }}>
              {lockedName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your account is locked to this center across all modules.
            </Typography>
          </Box>
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
          <MenuItem value="all">All centers</MenuItem>
          {centers.map((c) => (
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
