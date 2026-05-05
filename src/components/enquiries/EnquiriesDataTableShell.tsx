import React from 'react';
import { Box, Paper } from '@mui/material';
import { alpha } from '@mui/material/styles';

type Props = {
  children: React.ReactNode;
};

export default function EnquiriesDataTableShell({ children }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: { xs: 400, sm: 500 },
        width: '100%',
        maxWidth: '100%',
        bgcolor: (t) =>
          t.palette.mode === 'dark'
            ? alpha(t.palette.background.paper, 0.95)
            : alpha('#ffffff', 0.94),
        border: 1,
        borderColor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.3 : 0.16),
        borderRadius: 3.5,
        minWidth: 0,
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 16px 28px rgba(0,0,0,0.3)' : '0 18px 30px rgba(15, 23, 42, 0.08)',
      }}
    >
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</Box>
    </Paper>
  );
}
