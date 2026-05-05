import React from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Refresh as RefreshIcon,
  TableView as TableViewIcon,
  ViewColumn as ViewColumnIcon,
} from '@mui/icons-material';

type HeaderAction = {
  key: string;
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  variant?: 'contained' | 'outlined';
};

type Props = {
  title: string;
  subtitle: string;
  actions: HeaderAction[];
};

export const headerIcons = {
  refresh: <RefreshIcon sx={{ fontSize: '1rem' }} />,
  columns: <ViewColumnIcon sx={{ fontSize: '1rem' }} />,
  exportCsv: <TableViewIcon sx={{ fontSize: '1rem' }} />,
  exportPdf: <PictureAsPdfIcon sx={{ fontSize: '1rem' }} />,
  add: <AddIcon sx={{ fontSize: '1rem' }} />,
};

export default function EnquiriesPageHeader({ title, subtitle, actions }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5, md: 3 },
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: 1,
        borderColor: 'divider',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 2px 12px rgba(0,0,0,0.35)' : '0 6px 16px rgba(15, 23, 42, 0.06)',
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.3rem', sm: '1.7rem' }, mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
          {actions.map((action) => (
            <Button
              key={action.key}
              size="small"
              variant={action.variant ?? 'outlined'}
              disabled={action.disabled}
              onClick={action.onClick}
              startIcon={action.icon}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                px: 1.75,
                ...(action.variant === 'contained'
                  ? {
                      boxShadow: '0 8px 18px rgba(25, 118, 210, 0.24)',
                    }
                  : {
                      borderColor: 'divider',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.2 : 0.08),
                      },
                    }),
              }}
            >
              {action.label}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
