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
        p: { xs: 1.25, sm: 1.5, md: 1.75 },
        background: (t) =>
          t.palette.mode === 'dark'
            ? `linear-gradient(150deg, ${alpha(t.palette.background.paper, 0.98)} 0%, ${alpha(t.palette.primary.dark, 0.22)} 100%)`
            : 'linear-gradient(150deg, #ffffff 0%, #f6f9ff 100%)',
        borderRadius: 3.5,
        border: 1,
        borderColor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.38 : 0.14),
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 12px 28px rgba(0,0,0,0.35)' : '0 16px 36px rgba(15, 23, 42, 0.08)',
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.05rem', sm: '1.25rem' }, mb: 0.15 }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {subtitle}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          {actions.map((action) => (
            <Button
              key={action.key}
              size="small"
              variant={action.variant ?? 'outlined'}
              disabled={action.disabled}
              onClick={action.onClick}
              startIcon={action.icon}
              sx={{
                borderRadius: 2.5,
                textTransform: 'none',
                fontWeight: 700,
                px: 1.8,
                py: 0.6,
                ...(action.variant === 'contained'
                  ? {
                      boxShadow: '0 10px 20px rgba(25, 118, 210, 0.26)',
                    }
                  : {
                      borderColor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.36 : 0.24),
                      bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.1 : 0.02),
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
