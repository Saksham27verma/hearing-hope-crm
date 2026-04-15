'use client';

import type { CSSProperties, DragEvent } from 'react';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import type { CrmNavItem } from './crm-nav-config';
import {
  getCrmShellTokens,
  RADIUS_2XL,
  RADIUS_XL,
  SIDEBAR_COLLAPSED_W,
  SIDEBAR_EXPANDED_W,
  LAYOUT_GUTTER,
} from './crm-theme';

function isPathActive(pathname: string | null, basePath: string): boolean {
  if (!pathname) return false;
  if (pathname === basePath) return true;
  if (basePath === '/dashboard') return false;
  return pathname.startsWith(basePath + '/');
}

function isChildActive(pathname: string | null, childPath: string): boolean {
  if (!pathname) return false;
  return pathname === childPath || pathname.startsWith(childPath + '/');
}

export type CrmSidebarProps = {
  isDesktop: boolean;
  expanded: boolean;
  pathname: string | null;
  items: CrmNavItem[];
  openMenus: Record<string, boolean>;
  toggleMenu: (menuText: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  mobileOpen: boolean;
  onMobileNavigate?: () => void;
  onReorderItems?: (fromIndex: number, toIndex: number) => void;
};

export default function CrmSidebar({
  isDesktop,
  expanded,
  pathname,
  items,
  openMenus,
  toggleMenu,
  onMouseEnter,
  onMouseLeave,
  mobileOpen,
  onMobileNavigate,
  onReorderItems,
}: CrmSidebarProps) {
  const theme = useTheme();
  const shell = useMemo(() => getCrmShellTokens(theme), [theme]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const width = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;
  const showLabels = expanded;
  const canReorder = isDesktop && showLabels && typeof onReorderItems === 'function';

  const outerStyle: CSSProperties = isDesktop
    ? {
        position: 'fixed',
        left: LAYOUT_GUTTER,
        top: LAYOUT_GUTTER,
        bottom: LAYOUT_GUTTER,
        width,
        zIndex: 1200,
        transition: 'width 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
      }
    : {
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: 'min(300px, 88vw)',
        zIndex: 1250,
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-105%)',
        transition: 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: LAYOUT_GUTTER,
        paddingRight: 0,
        pointerEvents: mobileOpen ? 'auto' : 'none',
      };

  const panelStyle: CSSProperties = {
    height: '100%',
    backgroundColor: shell.sidebarPanelBg,
    borderRadius: RADIUS_2XL,
    border: `1px solid ${shell.sidebarBorder}`,
    boxShadow: shell.sidebarOutlineGlow,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const rowExpanded: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'flex-start',
    minHeight: 44,
    padding: '10px 14px',
    margin: '2px 10px',
    borderRadius: RADIUS_XL,
    color: shell.sidebarText,
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    transition:
      'transform 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
    border: 'none',
    background: 'transparent',
    width: 'auto',
    textAlign: 'left' as const,
    position: 'relative' as const,
    boxSizing: 'border-box' as const,
  };

  const rowCollapsed: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    minHeight: 44,
    padding: 0,
    margin: '4px 0',
    borderRadius: RADIUS_XL,
    color: shell.sidebarText,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition:
      'transform 0.2s ease, background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
    border: 'none',
    background: 'transparent',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
  };

  const applyActiveRow = (active: boolean): CSSProperties => {
    const base = showLabels ? rowExpanded : rowCollapsed;
    if (showLabels) {
      return {
        ...base,
        color: active ? shell.accent : base.color,
        fontWeight: active ? 600 : 500,
        backgroundColor: active ? shell.orangeGhost : 'transparent',
        boxShadow: active ? `inset 3px 0 0 0 ${shell.accent}` : 'none',
      };
    }
    return {
      ...base,
      color: active ? shell.accent : base.color,
      backgroundColor: active ? shell.orangeGhost : 'transparent',
      boxShadow: active
        ? `0 0 0 2px ${alpha(shell.accent, 0.55)}, 0 4px 14px ${alpha(shell.accent, 0.15)}`
        : 'none',
    };
  };

  const liCollapsedStyle: CSSProperties = showLabels
    ? {}
    : { display: 'flex', justifyContent: 'center', width: '100%' };

  return (
    <aside
      style={outerStyle}
      onMouseEnter={isDesktop ? onMouseEnter : undefined}
      onMouseLeave={isDesktop ? onMouseLeave : undefined}
      aria-hidden={!isDesktop && !mobileOpen}
    >
      <div style={panelStyle}>
        <div
          style={{
            width: '100%',
            padding: showLabels ? '18px 16px' : '14px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: showLabels ? 'flex-start' : 'center',
            gap: showLabels ? 12 : 0,
            borderBottom: `1px solid ${shell.surfaceBorder}`,
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS_XL,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
              background: shell.paper,
              boxShadow: `0 1px 4px ${alpha(shell.sidebarText, 0.08)}, 0 0 0 1px ${alpha(shell.accent, 0.15)}`,
            }}
            aria-hidden
          >
            <Image
              src="/favicon.png"
              alt=""
              width={32}
              height={32}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          {showLabels && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: shell.sidebarTextMuted,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Hearing Hope
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: shell.sidebarText, marginTop: 2 }}>Hope CRM</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 0 16px' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((item, itemIndex) => {
              const Icon = item.icon;
              const hasChildren = Boolean(item.children?.length);
              const childMatch = hasChildren && item.children!.some((c) => isChildActive(pathname, c.path));
              const selfActive = !hasChildren && isPathActive(pathname, item.path);
              const parentRowActive = hasChildren && (childMatch || isPathActive(pathname, item.path));
              const isDraggingRow = draggingIndex === itemIndex;
              const isDropTarget = dropIndex === itemIndex && draggingIndex !== null && draggingIndex !== itemIndex;
              const draggableRowStyle: CSSProperties = {
                ...(isDropTarget ? { boxShadow: `inset 0 2px 0 ${shell.accent}` } : null),
                ...(isDraggingRow ? { opacity: 0.6 } : null),
                borderRadius: RADIUS_XL,
              };

              const rowDnDProps = canReorder
                ? {
                    draggable: true,
                    onDragStart: () => {
                      setDraggingIndex(itemIndex);
                      setDropIndex(itemIndex);
                    },
                    onDragOver: (event: DragEvent<HTMLLIElement>) => {
                      event.preventDefault();
                      if (dropIndex !== itemIndex) {
                        setDropIndex(itemIndex);
                      }
                    },
                    onDrop: (event: DragEvent<HTMLLIElement>) => {
                      event.preventDefault();
                      if (draggingIndex !== null && draggingIndex !== itemIndex) {
                        onReorderItems?.(draggingIndex, itemIndex);
                      }
                      setDraggingIndex(null);
                      setDropIndex(null);
                    },
                    onDragEnd: () => {
                      setDraggingIndex(null);
                      setDropIndex(null);
                    },
                  }
                : {};

              if (hasChildren) {
                return (
                  <li
                    key={item.text}
                    style={{ ...liCollapsedStyle, ...draggableRowStyle }}
                    {...rowDnDProps}
                    title={canReorder ? 'Drag to reorder module' : undefined}
                  >
                    <button
                      type="button"
                      style={applyActiveRow(!!parentRowActive)}
                      onClick={() => {
                        // Collapsed rail: child links only render when `showLabels` is true.
                        // Expand first, then ensure this submenu is open (do not toggle closed if it was already open).
                        if (!showLabels && hasChildren) {
                          onMouseEnter?.();
                          if (!openMenus[item.text]) {
                            toggleMenu(item.text);
                          }
                          return;
                        }
                        toggleMenu(item.text);
                      }}
                      onMouseEnter={(e) => {
                        if (!parentRowActive) {
                          e.currentTarget.style.backgroundColor = shell.orangeGhostHover;
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.backgroundColor = parentRowActive ? shell.orangeGhost : 'transparent';
                      }}
                    >
                      <Icon strokeWidth={1.75} size={20} style={{ flexShrink: 0, opacity: 0.92 }} />
                      {showLabels && <span style={{ flex: 1 }}>{item.text}</span>}
                      {showLabels && (
                        <span style={{ display: 'flex', opacity: 0.55, color: shell.sidebarTextMuted }}>
                          {openMenus[item.text] ? <ChevronDown size={18} strokeWidth={1.75} /> : <ChevronRight size={18} strokeWidth={1.75} />}
                        </span>
                      )}
                    </button>
                    {openMenus[item.text] && showLabels && (
                      <ul
                        style={{
                          listStyle: 'none',
                          margin: '4px 0 8px',
                          padding: '6px 0',
                          backgroundColor: shell.sidebarSubnavBg,
                          borderRadius: RADIUS_XL,
                          marginLeft: 10,
                          marginRight: 10,
                        }}
                      >
                        {item.children!.map((child) => {
                          const cActive = isChildActive(pathname, child.path);
                          return (
                            <li key={child.path}>
                              <Link
                                href={child.path}
                                onClick={() => onMobileNavigate?.()}
                                style={{
                                  display: 'block',
                                  padding: '9px 14px 9px 16px',
                                  fontSize: 13,
                                  fontWeight: cActive ? 600 : 500,
                                  color: cActive ? shell.accent : shell.sidebarText,
                                  borderRadius: 10,
                                  margin: '2px 8px',
                                  transition: 'background-color 0.2s ease, transform 0.2s ease',
                                  position: 'relative',
                                  backgroundColor: cActive ? shell.orangeGhost : 'transparent',
                                  boxShadow: cActive ? `inset 3px 0 0 0 ${shell.accent}` : 'none',
                                }}
                                onMouseEnter={(e) => {
                                  if (!cActive) {
                                    e.currentTarget.style.backgroundColor = shell.orangeGhostHover;
                                    e.currentTarget.style.transform = 'scale(1.01)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.backgroundColor = cActive ? shell.orangeGhost : 'transparent';
                                }}
                              >
                                {child.text}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              }

              return (
                <li
                  key={item.path}
                  style={{ ...liCollapsedStyle, ...draggableRowStyle }}
                  {...rowDnDProps}
                  title={canReorder ? 'Drag to reorder module' : undefined}
                >
                  <Link
                    href={item.path}
                    onClick={() => onMobileNavigate?.()}
                    style={applyActiveRow(selfActive)}
                    onMouseEnter={(e) => {
                      if (!selfActive) {
                        e.currentTarget.style.backgroundColor = shell.orangeGhostHover;
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.backgroundColor = selfActive ? shell.orangeGhost : 'transparent';
                    }}
                  >
                    <Icon strokeWidth={1.75} size={20} style={{ flexShrink: 0, opacity: 0.92 }} />
                    {showLabels && <span>{item.text}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
