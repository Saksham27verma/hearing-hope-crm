'use client';

import { alpha } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Fade from '@mui/material/Fade';
import WbSunny from '@mui/icons-material/WbSunny';
import NightsStay from '@mui/icons-material/NightsStay';
import { useCrmTheme } from '@/theme/ThemeContext';

export default function ThemeToggle() {
  const { mode, toggleMode } = useCrmTheme();
  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} arrow>
      <IconButton
        onClick={toggleMode}
        color="inherit"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        sx={{
          borderRadius: 1.5,
          border: 1,
          borderColor: 'divider',
          bgcolor: (t) =>
            alpha(t.palette.background.paper, t.palette.mode === 'light' ? 0.92 : 0.45),
          color: 'text.primary',
          transition: 'transform 0.22s ease, background-color 0.28s ease, border-color 0.28s ease',
          '&:hover': {
            transform: 'scale(1.06)',
            borderColor: 'primary.main',
            bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.12 : 0.22),
          },
        }}
      >
        <Fade in timeout={220} key={isDark ? 'sun' : 'moon'}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isDark ? (
              <WbSunny sx={{ fontSize: 22, transition: 'opacity 0.22s ease, transform 0.22s ease' }} />
            ) : (
              <NightsStay sx={{ fontSize: 22, transition: 'opacity 0.22s ease, transform 0.22s ease' }} />
            )}
          </span>
        </Fade>
      </IconButton>
    </Tooltip>
  );
}
