import { alpha, createTheme, responsiveFontSizes } from '@mui/material/styles';

/** Extend later with e.g. `'highContrast'` without rewiring consumers. */
export type AppColorMode = 'light' | 'dark';

const PRIMARY_ORANGE = '#EE6417';
const PRIMARY_GREEN = '#3aa986';

const sharedTypography = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  h1: { fontWeight: 600 },
  h2: { fontWeight: 600 },
  h3: { fontWeight: 600 },
  h4: { fontWeight: 500 },
  h5: { fontWeight: 500 },
  h6: { fontWeight: 500 },
} as const;

export function createAppTheme(mode: AppColorMode) {
  const base = createTheme({
    palette: {
      mode,
      primary: {
        main: PRIMARY_ORANGE,
        dark: '#B84312',
        light: '#FF8F57',
        contrastText: '#ffffff',
      },
      secondary: {
        main: PRIMARY_GREEN,
        dark: '#2a9775',
        light: '#5bc4a3',
        contrastText: '#ffffff',
      },
      ...(mode === 'light'
        ? {
            background: {
              default: '#fafafa',
              paper: '#ffffff',
            },
            text: {
              primary: '#0f172a',
              secondary: 'rgba(15, 23, 42, 0.65)',
            },
            divider: alpha('#0f172a', 0.08),
          }
        : {
            background: {
              default: '#000000',
              paper: '#121212',
            },
            text: {
              primary: '#f1f5f9',
              secondary: 'rgba(241, 245, 249, 0.65)',
            },
            divider: alpha('#ffffff', 0.12),
          }),
    },
    typography: sharedTypography,
    transitions: {
      duration: {
        shortest: 150,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            transition: 'background-color 0.28s ease, color 0.28s ease',
          },
          body: {
            transition: 'background-color 0.28s ease, color 0.28s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 600,
            padding: '8px 16px',
            transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
          },
          containedPrimary: ({ theme }) => ({
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
            },
          }),
          containedSecondary: ({ theme }) => ({
            '&:hover': {
              backgroundColor: theme.palette.secondary.dark,
            },
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 12,
            boxShadow:
              theme.palette.mode === 'light'
                ? '0px 4px 20px rgba(0, 0, 0, 0.05)'
                : '0px 4px 24px rgba(0, 0, 0, 0.45)',
            transition: 'background-color 0.28s ease, box-shadow 0.28s ease',
          }),
        },
      },
      MuiTable: {
        styleOverrides: {
          root: {
            borderCollapse: 'separate',
            borderSpacing: '0 8px',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: '16px',
          },
          head: ({ theme }) => ({
            fontWeight: 600,
            backgroundColor:
              theme.palette.mode === 'light'
                ? theme.palette.grey[100]
                : alpha(theme.palette.common.white, 0.06),
            color: theme.palette.text.primary,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiInputBase-root': {
              borderRadius: 8,
            },
            '& .MuiOutlinedInput-root': {
              transition: 'border-color 0.2s ease, background-color 0.2s ease',
              '& fieldset': {
                borderColor:
                  theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.15)' : alpha(theme.palette.common.white, 0.16),
              },
              '&:hover fieldset': {
                borderColor:
                  theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.25)' : alpha(theme.palette.common.white, 0.24),
              },
            },
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 2,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontWeight: 500,
          },
        },
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            '& .MuiInputBase-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 12,
            backgroundImage: 'none',
            transition: 'background-color 0.28s ease, box-shadow 0.28s ease',
          }),
          outlined: ({ theme }) => ({
            borderColor:
              theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : alpha(theme.palette.common.white, 0.12),
          }),
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 16,
            boxShadow:
              theme.palette.mode === 'light'
                ? '0px 8px 30px rgba(0, 0, 0, 0.12)'
                : '0px 12px 48px rgba(0, 0, 0, 0.55)',
          }),
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderColor:
              theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.08)' : alpha(theme.palette.common.white, 0.1),
          }),
        },
      },
      MuiTablePagination: {
        styleOverrides: {
          root: {
            '& .MuiTablePagination-select': {
              paddingLeft: 8,
              paddingRight: 24,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            fontWeight: 500,
          },
        },
      },
    },
  });

  return responsiveFontSizes(base);
}
