import React from 'react';
import { Box, Paper } from '@mui/material';

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
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        minWidth: 0,
      }}
    >
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</Box>
    </Paper>
  );
}
