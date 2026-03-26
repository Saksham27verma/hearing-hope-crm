import { createTheme } from '@mui/material/styles';

/** Nested theme for Sales & Invoicing page only (slate / indigo SaaS look). */
export const salesInvoicingTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#4F46E5', dark: '#4338CA', light: '#818CF8' },
    secondary: { main: '#64748B' },
    background: { default: '#F1F5F9', paper: '#FFFFFF' },
    text: { primary: '#0F172A', secondary: '#64748B' },
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
