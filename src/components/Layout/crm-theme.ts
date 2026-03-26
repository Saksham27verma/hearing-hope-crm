/** Brand + shell tokens for CRM chrome (sidebar, header). */
export const CRM_ACCENT = '#F17336';
export const CRM_ACCENT_DEEP = '#B84312';
export const CRM_PAGE_BG = '#FAFAFA';
/** Sidebar panel surface (light chrome). */
export const CRM_SIDEBAR_PANEL_BG = '#ffffff';
export const CRM_SIDEBAR_BG = CRM_SIDEBAR_PANEL_BG;
/** Orange glow + soft depth around the floating sidebar. */
export const CRM_SIDEBAR_OUTLINE_GLOW =
  '0 0 0 1px rgba(241, 115, 54, 0.4), 0 0 20px rgba(241, 115, 54, 0.22), 0 0 44px rgba(241, 115, 54, 0.12), 0 10px 28px rgba(15, 23, 42, 0.08)';
export const CRM_ORANGE_GHOST = 'rgba(241, 115, 54, 0.12)';
export const CRM_ORANGE_GHOST_HOVER = 'rgba(241, 115, 54, 0.08)';
export const CRM_SIDEBAR_TEXT = '#334155';
export const CRM_SIDEBAR_TEXT_MUTED = '#64748b';
/** Nested nav on light sidebar */
export const CRM_SIDEBAR_SUBNAV_BG = 'rgba(15, 23, 42, 0.04)';

export const SIDEBAR_EXPANDED_W = 216;
export const SIDEBAR_COLLAPSED_W = 56;
export const LAYOUT_GUTTER = 12;
export const HEADER_HEIGHT = 56;
export const RADIUS_XL = 12;
export const RADIUS_2XL = 16;

export function sidebarOuterWidthPx(expanded: boolean): number {
  return expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;
}

export function mainOffsetLeftPx(shouldHideSidebar: boolean, isDesktop: boolean, expanded: boolean): number {
  if (shouldHideSidebar || !isDesktop) return LAYOUT_GUTTER;
  return LAYOUT_GUTTER + sidebarOuterWidthPx(expanded) + LAYOUT_GUTTER;
}
