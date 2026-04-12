import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

export const SIDEBAR_EXPANDED_W = 216;
export const SIDEBAR_COLLAPSED_W = 56;
export const LAYOUT_GUTTER = 12;
export const HEADER_HEIGHT = 56;
export const RADIUS_XL = 12;
export const RADIUS_2XL = 16;

/** @deprecated Use `theme.palette` / `getCrmShellTokens(theme)` — kept for gradual migration. */
export const CRM_ACCENT = '#EE6417';
/** @deprecated Use `getCrmShellTokens(theme).accentDeep` */
export const CRM_ACCENT_DEEP = '#B84312';

export function sidebarOuterWidthPx(expanded: boolean): number {
  return expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;
}

export function mainOffsetLeftPx(shouldHideSidebar: boolean, isDesktop: boolean, expanded: boolean): number {
  if (shouldHideSidebar || !isDesktop) return LAYOUT_GUTTER;
  return LAYOUT_GUTTER + sidebarOuterWidthPx(expanded) + LAYOUT_GUTTER;
}

export type CrmShellTokens = {
  pageBg: string;
  paper: string;
  sidebarPanelBg: string;
  sidebarText: string;
  sidebarTextMuted: string;
  accent: string;
  accentDeep: string;
  orangeGhost: string;
  orangeGhostHover: string;
  sidebarSubnavBg: string;
  sidebarBorder: string;
  sidebarOutlineGlow: string;
  headerGlass: string;
  headerBorderBottom: string;
  headerShadow: string;
  crumbMuted: string;
  crumbSeparator: string;
  crumbCurrent: string;
  crumbLink: string;
  crumbLinkHover: string;
  surfaceBorder: string;
  surfaceShadowSm: string;
};

export function getCrmShellTokens(theme: Theme): CrmShellTokens {
  const { palette } = theme;
  const accent = palette.primary.main;
  const accentDeep = palette.primary.dark;
  const isLight = palette.mode === 'light';
  const textPrimary = palette.text.primary;
  const textSecondary = palette.text.secondary;

  const orangeGhost = alpha(accent, isLight ? 0.12 : 0.2);
  const orangeGhostHover = alpha(accent, isLight ? 0.08 : 0.14);

  const sidebarOutlineGlow = isLight
    ? `0 0 0 1px ${alpha(accent, 0.4)}, 0 0 20px ${alpha(accent, 0.22)}, 0 0 44px ${alpha(
        accent,
        0.12,
      )}, 0 10px 28px ${alpha('#0f172a', 0.08)}`
    : `0 0 0 1px ${alpha(accent, 0.45)}, 0 0 24px ${alpha(accent, 0.18)}, 0 0 48px ${alpha(
        accent,
        0.1,
      )}, 0 12px 32px rgba(0,0,0,0.55)`;

  return {
    pageBg: palette.background.default,
    paper: palette.background.paper,
    sidebarPanelBg: palette.background.paper,
    sidebarText: textPrimary,
    sidebarTextMuted: textSecondary,
    accent,
    accentDeep,
    orangeGhost,
    orangeGhostHover,
    sidebarSubnavBg: alpha(textPrimary, isLight ? 0.04 : 0.1),
    sidebarBorder: alpha(accent, isLight ? 0.35 : 0.42),
    sidebarOutlineGlow,
    headerGlass: alpha(palette.background.paper, isLight ? 0.72 : 0.65),
    headerBorderBottom: alpha(textPrimary, isLight ? 0.06 : 0.12),
    headerShadow: isLight ? '0 1px 0 rgba(15, 23, 42, 0.06)' : '0 1px 0 rgba(255, 255, 255, 0.06)',
    crumbSeparator: alpha(textPrimary, 0.25),
    crumbMuted: alpha(textPrimary, 0.45),
    crumbCurrent: textPrimary,
    crumbLink: alpha(textPrimary, 0.45),
    crumbLinkHover: accent,
    surfaceBorder: alpha(textPrimary, isLight ? 0.08 : 0.14),
    surfaceShadowSm: isLight ? '0 1px 2px rgba(15, 23, 42, 0.05)' : '0 1px 2px rgba(0, 0, 0, 0.35)',
  };
}
