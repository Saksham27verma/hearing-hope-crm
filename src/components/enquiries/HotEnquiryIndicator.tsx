'use client';

import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { Chip, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

const flameMotion: SxProps<Theme> = {
  '@keyframes hhHotFlame': {
    '0%, 100%': {
      transform: 'scale(1) translateY(0)',
      filter: 'drop-shadow(0 0 3px rgba(255,87,34,0.55))',
    },
    '50%': {
      transform: 'scale(1.12) translateY(-2px)',
      filter: 'drop-shadow(0 0 10px rgba(255,109,0,0.95))',
    },
  },
  animation: 'hhHotFlame 1.15s ease-in-out infinite',
  color: '#e65100',
};

export function HotEnquiryFlameIcon({
  size = 22,
  title = 'Hot enquiry — priority lead',
  sx,
}: {
  size?: number;
  title?: string;
  sx?: SxProps<Theme>;
}) {
  return (
    <Tooltip title={title}>
      <LocalFireDepartmentIcon sx={{ ...flameMotion, fontSize: size, ...sx }} aria-hidden />
    </Tooltip>
  );
}

export function HotEnquiryBadgeChip() {
  return (
    <Chip
      icon={
        <LocalFireDepartmentIcon
          sx={{
            fontSize: '1.05rem !important',
            color: '#e65100 !important',
            ...flameMotion,
          }}
        />
      }
      label="Hot"
      size="small"
      sx={{
        fontWeight: 800,
        letterSpacing: 0.02,
        bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(255,112,67,0.22)' : 'rgba(255,183,77,0.38)'),
        color: (t) => (t.palette.mode === 'dark' ? '#ffab91' : '#bf360c'),
        border: '1px solid rgba(230,81,0,0.45)',
      }}
    />
  );
}
