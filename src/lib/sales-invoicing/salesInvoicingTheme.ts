import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

/** Nested theme for Sales & Invoicing — indigo primary, inherits `palette.mode` from the global CRM theme. */
export function createSalesInvoicingTheme(baseTheme: Theme): Theme {
  const mode = baseTheme.palette.mode;

  return createTheme(baseTheme, {
    palette: {
      primary: { main: '#4F46E5', dark: '#4338CA', light: '#818CF8', contrastText: '#ffffff' },
      secondary: { main: '#64748B', contrastText: '#ffffff' },
      background:
        mode === 'light'
          ? { default: '#F1F5F9', paper: '#FFFFFF' }
          : { default: '#000000', paper: '#121212' },
      text:
        mode === 'light'
          ? { primary: '#0F172A', secondary: '#64748B' }
          : { primary: '#f1f5f9', secondary: 'rgba(241, 245, 249, 0.65)' },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.15s ease',
            '&:hover': { backgroundColor: 'rgba(79, 70, 229, 0.06)' },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600 },
        },
      },
    },
  });
}
