'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { AppColorMode } from './theme';
import { createAppTheme } from './theme';

export const CRM_COLOR_MODE_STORAGE_KEY = 'hearing-hope-crm-color-mode';

type CrmThemeContextValue = {
  /** Effective palette mode used for MUI. */
  mode: AppColorMode;
  /** True when no explicit light/dark is stored — OS theme drives `mode`. */
  followsSystem: boolean;
  setMode: (mode: AppColorMode) => void;
  toggleMode: () => void;
};

const CrmThemeContext = createContext<CrmThemeContextValue | null>(null);

function readStoredMode(): AppColorMode | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CRM_COLOR_MODE_STORAGE_KEY);
  if (raw === 'light' || raw === 'dark') return raw;
  return null;
}

function readSystemMode(): AppColorMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function CrmThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppColorMode>('light');
  const [followsSystem, setFollowsSystem] = useState(true);
  useLayoutEffect(() => {
    const stored = readStoredMode();
    if (stored) {
      setModeState(stored);
      setFollowsSystem(false);
    } else {
      setModeState(readSystemMode());
      setFollowsSystem(true);
    }
  }, []);

  useEffect(() => {
    if (!followsSystem) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setModeState(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [followsSystem]);

  const setMode = useCallback((next: AppColorMode) => {
    localStorage.setItem(CRM_COLOR_MODE_STORAGE_KEY, next);
    setModeState(next);
    setFollowsSystem(false);
  }, []);

  const toggleMode = useCallback(() => {
    const next: AppColorMode = mode === 'light' ? 'dark' : 'light';
    setMode(next);
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, followsSystem, setMode, toggleMode }),
    [mode, followsSystem, setMode, toggleMode],
  );

  const muiTheme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <CrmThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </CrmThemeContext.Provider>
  );
}

export function useCrmTheme(): CrmThemeContextValue {
  const ctx = useContext(CrmThemeContext);
  if (!ctx) {
    throw new Error('useCrmTheme must be used within CrmThemeProvider');
  }
  return ctx;
}

/** Safe for components that may render outside the provider (e.g. Storybook). */
export function useCrmThemeOptional(): CrmThemeContextValue | null {
  return useContext(CrmThemeContext);
}

export type { AppColorMode };
