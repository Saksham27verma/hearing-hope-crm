'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CrmNavItem } from './crm-nav-config';
import {
  CRM_ACCENT,
  CRM_ORANGE_GHOST,
  CRM_ORANGE_GHOST_HOVER,
  CRM_SIDEBAR_OUTLINE_GLOW,
  CRM_SIDEBAR_PANEL_BG,
  CRM_SIDEBAR_SUBNAV_BG,
  CRM_SIDEBAR_TEXT,
  CRM_SIDEBAR_TEXT_MUTED,
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
}: CrmSidebarProps) {
  const width = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W;
  const showLabels = expanded;

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
    backgroundColor: CRM_SIDEBAR_PANEL_BG,
    borderRadius: RADIUS_2XL,
    border: '1px solid rgba(241, 115, 54, 0.35)',
    boxShadow: CRM_SIDEBAR_OUTLINE_GLOW,
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
    color: CRM_SIDEBAR_TEXT,
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
    color: CRM_SIDEBAR_TEXT,
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
        color: active ? CRM_ACCENT : base.color,
        fontWeight: active ? 600 : 500,
        backgroundColor: active ? CRM_ORANGE_GHOST : 'transparent',
        boxShadow: active ? `inset 3px 0 0 0 ${CRM_ACCENT}` : 'none',
      };
    }
    return {
      ...base,
      color: active ? CRM_ACCENT : base.color,
      backgroundColor: active ? CRM_ORANGE_GHOST : 'transparent',
      boxShadow: active
        ? `0 0 0 2px rgba(241, 115, 54, 0.55), 0 4px 14px rgba(241, 115, 54, 0.15)`
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
            borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
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
              background: '#fff',
              boxShadow: '0 1px 4px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(241, 115, 54, 0.15)',
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
                  color: CRM_SIDEBAR_TEXT_MUTED,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Hearing Hope
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>Hope CRM</div>
            </div>
          )}
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 0 16px' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((item) => {
              const Icon = item.icon;
              const hasChildren = Boolean(item.children?.length);
              const childMatch = hasChildren && item.children!.some((c) => isChildActive(pathname, c.path));
              const selfActive = !hasChildren && isPathActive(pathname, item.path);
              const parentRowActive = hasChildren && (childMatch || isPathActive(pathname, item.path));

              if (hasChildren) {
                return (
                  <li key={item.text} style={liCollapsedStyle}>
                    <button
                      type="button"
                      style={applyActiveRow(!!parentRowActive)}
                      onClick={() => toggleMenu(item.text)}
                      onMouseEnter={(e) => {
                        if (!parentRowActive) {
                          e.currentTarget.style.backgroundColor = CRM_ORANGE_GHOST_HOVER;
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.backgroundColor = parentRowActive ? CRM_ORANGE_GHOST : 'transparent';
                      }}
                    >
                      <Icon strokeWidth={1.75} size={20} style={{ flexShrink: 0, opacity: 0.92 }} />
                      {showLabels && <span style={{ flex: 1 }}>{item.text}</span>}
                      {showLabels && (
                        <span style={{ display: 'flex', opacity: 0.55, color: CRM_SIDEBAR_TEXT_MUTED }}>
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
                          backgroundColor: CRM_SIDEBAR_SUBNAV_BG,
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
                                  color: cActive ? CRM_ACCENT : CRM_SIDEBAR_TEXT,
                                  borderRadius: 10,
                                  margin: '2px 8px',
                                  transition: 'background-color 0.2s ease, transform 0.2s ease',
                                  position: 'relative',
                                  backgroundColor: cActive ? CRM_ORANGE_GHOST : 'transparent',
                                  boxShadow: cActive ? `inset 3px 0 0 0 ${CRM_ACCENT}` : 'none',
                                }}
                                onMouseEnter={(e) => {
                                  if (!cActive) {
                                    e.currentTarget.style.backgroundColor = CRM_ORANGE_GHOST_HOVER;
                                    e.currentTarget.style.transform = 'scale(1.01)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.backgroundColor = cActive ? CRM_ORANGE_GHOST : 'transparent';
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
                <li key={item.path} style={liCollapsedStyle}>
                  <Link
                    href={item.path}
                    onClick={() => onMobileNavigate?.()}
                    style={applyActiveRow(selfActive)}
                    onMouseEnter={(e) => {
                      if (!selfActive) {
                        e.currentTarget.style.backgroundColor = CRM_ORANGE_GHOST_HOVER;
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.backgroundColor = selfActive ? CRM_ORANGE_GHOST : 'transparent';
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
