'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import { Menu, PanelLeftClose, Sparkles, LogOut, Search } from 'lucide-react';
import type { UserProfile } from '@/context/AuthContext';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { getCrmBreadcrumbs } from './crm-breadcrumbs';
import { getCrmShellTokens, HEADER_HEIGHT, RADIUS_XL, RADIUS_2XL } from './crm-theme';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export type CrmHeaderProps = {
  shouldHideSidebar: boolean;
  isDesktop: boolean;
  sidebarExpanded: boolean;
  leftOffsetPx: number;
  pathname: string | null;
  enquiryModeTitle?: string;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onOpenHopeAi: () => void;
  onProfileToggle: () => void;
  onCloseProfileMenu: () => void;
  profileMenuOpen: boolean;
  userProfile: UserProfile | null;
  userPhotoURL?: string | null;
  onSignOut: () => void;
};

export default function CrmHeader({
  shouldHideSidebar,
  isDesktop,
  sidebarExpanded,
  leftOffsetPx,
  pathname,
  enquiryModeTitle,
  onToggleSidebar,
  onOpenSearch,
  onOpenHopeAi,
  onProfileToggle,
  onCloseProfileMenu,
  profileMenuOpen,
  userProfile,
  userPhotoURL,
  onSignOut,
}: CrmHeaderProps) {
  const muiTheme = useTheme();
  const shell = useMemo(() => getCrmShellTokens(muiTheme), [muiTheme]);
  const [searchHint, setSearchHint] = useState('⌘K');

  useEffect(() => {
    const isApple =
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || navigator.platform || '');
    setSearchHint(isApple ? '⌘K' : 'Ctrl K');
  }, []);

  const crumbs = getCrmBreadcrumbs(pathname);
  const displayCrumbs = enquiryModeTitle
    ? [
        { href: '/dashboard', label: 'Home' },
        { href: pathname || '#', label: enquiryModeTitle },
      ]
    : crumbs;

  const showSidebarToggle = !shouldHideSidebar;

  const headerStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: shouldHideSidebar ? 0 : isDesktop ? leftOffsetPx : 0,
    right: 0,
    height: HEADER_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '0 20px',
    zIndex: 1150,
    transition:
      'left 0.32s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.28s ease, border-color 0.28s ease, box-shadow 0.28s ease',
    backgroundColor: shell.headerGlass,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${shell.headerBorderBottom}`,
    boxShadow: shell.headerShadow,
  };

  const displayName = userProfile?.displayName || userProfile?.email?.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const searchFieldStyle: CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    borderRadius: RADIUS_XL,
    border: `1px solid ${shell.surfaceBorder}`,
    backgroundColor: alpha(muiTheme.palette.background.paper, muiTheme.palette.mode === 'light' ? 0.85 : 0.55),
    boxShadow: shell.surfaceShadowSm,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease, background-color 0.28s ease',
  };

  const showDesktopSearch = isDesktop && !enquiryModeTitle;
  /** Keeps universal search from overlapping the theme toggle when the sidebar is expanded. */
  const searchColumnMaxWidth = `min(420px, max(140px, calc(100vw - ${leftOffsetPx}px - 300px)))`;

  return (
    <header style={headerStyle}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minWidth: 0,
          width: '100%',
        }}
      >
      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          minWidth: 0,
        }}
      >
        {showSidebarToggle && (
          <button
            type="button"
            aria-label={isDesktop ? 'Toggle sidebar width' : 'Open navigation menu'}
            onClick={onToggleSidebar}
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS_XL,
              border: `1px solid ${shell.surfaceBorder}`,
              background: muiTheme.palette.background.paper,
              color: shell.sidebarText,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition:
                'transform 0.2s ease, box-shadow 0.2s ease, background-color 0.28s ease, border-color 0.28s ease',
              boxShadow: shell.surfaceShadowSm,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.04)';
              e.currentTarget.style.boxShadow =
                muiTheme.palette.mode === 'light'
                  ? '0 4px 12px rgba(15, 23, 42, 0.08)'
                  : '0 4px 12px rgba(0, 0, 0, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = shell.surfaceShadowSm;
            }}
          >
            {isDesktop && sidebarExpanded ? (
              <PanelLeftClose size={20} strokeWidth={1.75} />
            ) : (
              <Menu size={20} strokeWidth={1.75} />
            )}
          </button>
        )}

        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {displayCrumbs.map((c, i) => {
            const isLast = i === displayCrumbs.length - 1;
            return (
              <span key={`${c.href}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                {i > 0 && (
                  <span style={{ color: shell.crumbSeparator, fontSize: 12, fontWeight: 500 }}>/</span>
                )}
                {isLast ? (
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: shell.crumbCurrent,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      transition: 'color 0.28s ease',
                    }}
                  >
                    {c.label}
                  </span>
                ) : (
                  <Link
                    href={c.href}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: shell.crumbLink,
                      whiteSpace: 'nowrap',
                      transition: 'color 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = shell.crumbLinkHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = shell.crumbLink;
                    }}
                  >
                    {c.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
      </div>

      {showDesktopSearch && (
        <div
          style={{
            flex: '0 1 420px',
            minWidth: 120,
            maxWidth: searchColumnMaxWidth,
          }}
        >
          <button
            type="button"
            onClick={onOpenSearch}
            style={{ ...searchFieldStyle, width: '100%', maxWidth: '100%' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = alpha(shell.accent, 0.35);
              e.currentTarget.style.boxShadow = `0 4px 16px ${alpha(shell.accent, 0.12)}`;
              e.currentTarget.style.transform = 'scale(1.01)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = shell.surfaceBorder;
              e.currentTarget.style.boxShadow = shell.surfaceShadowSm;
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <span style={{ fontSize: 14, color: shell.crumbMuted, fontWeight: 500 }}>Search CRM…</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                fontWeight: 600,
                color: shell.crumbMuted,
                padding: '4px 8px',
                borderRadius: 8,
                border: `1px solid ${shell.surfaceBorder}`,
                background: shell.pageBg,
                letterSpacing: '0.02em',
                transition: 'background-color 0.28s ease, border-color 0.28s ease',
                flexShrink: 0,
              }}
            >
              {searchHint}
            </span>
          </button>
        </div>
      )}

      <div
        style={{
          flex: showDesktopSearch ? '1 1 0' : '0 0 auto',
          minWidth: 0,
          marginLeft: showDesktopSearch ? undefined : 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          flexShrink: 0,
        }}
      >
        {!isDesktop && !enquiryModeTitle ? (
          <button
            type="button"
            aria-label={`Open search (${searchHint})`}
            onClick={onOpenSearch}
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS_XL,
              border: `1px solid ${shell.surfaceBorder}`,
              background: muiTheme.palette.background.paper,
              color: shell.sidebarText,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s ease, background-color 0.28s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Search size={20} strokeWidth={1.75} />
          </button>
        ) : null}

        <ThemeToggle />

        <NotificationBell />

        <button
          type="button"
          onClick={onOpenHopeAi}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 16px',
            borderRadius: RADIUS_XL,
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            background: `linear-gradient(135deg, ${shell.accent} 0%, ${shell.accentDeep} 100%)`,
            boxShadow: `0 4px 14px ${alpha(shell.accent, 0.35)}, 0 1px 2px rgba(0,0,0,0.06)`,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.03)';
            e.currentTarget.style.boxShadow = `0 8px 22px ${alpha(shell.accent, 0.4)}, 0 2px 4px rgba(0,0,0,0.06)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = `0 4px 14px ${alpha(shell.accent, 0.35)}, 0 1px 2px rgba(0,0,0,0.06)`;
          }}
        >
          <Sparkles size={17} strokeWidth={1.75} />
          Hope AI
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onProfileToggle();
          }}
          aria-expanded={profileMenuOpen}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 4px 4px 4px',
            paddingRight: 12,
            borderRadius: RADIUS_2XL,
            border: `1px solid ${shell.surfaceBorder}`,
            background: muiTheme.palette.background.paper,
            cursor: 'pointer',
            boxShadow: shell.surfaceShadowSm,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, background-color 0.28s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.boxShadow =
              muiTheme.palette.mode === 'light'
                ? '0 4px 14px rgba(15, 23, 42, 0.1)'
                : '0 4px 14px rgba(0, 0, 0, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = shell.surfaceShadowSm;
          }}
        >
          <span style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
            {userPhotoURL ? (
              // eslint-disable-next-line @next/next/no-img-element -- Google/OAuth URLs; avoid remotePatterns config
              <img
                src={userPhotoURL}
                alt=""
                width={36}
                height={36}
                style={{ borderRadius: 12, objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(145deg, ${shell.accent}, ${shell.accentDeep})`,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {initial}
              </span>
            )}
            <span
              style={{
                position: 'absolute',
                right: -1,
                bottom: -1,
                width: 11,
                height: 11,
                borderRadius: '50%',
                background: '#22c55e',
                border: `2px solid ${muiTheme.palette.background.paper}`,
                boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.25)',
              }}
              title="Online"
              aria-hidden
            />
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: shell.crumbCurrent,
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: isDesktop ? 'inline' : 'none',
              transition: 'color 0.28s ease',
            }}
          >
            {displayName}
          </span>
        </button>
      </div>
      </div>

      {profileMenuOpen && (
        <>
          <div
            role="presentation"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1190,
            }}
            onClick={onCloseProfileMenu}
          />
          <div
            style={{
              position: 'fixed',
              top: HEADER_HEIGHT + 8,
              right: 16,
              zIndex: 1300,
              minWidth: 240,
              borderRadius: RADIUS_2XL,
              background: muiTheme.palette.background.paper,
              border: `1px solid ${shell.surfaceBorder}`,
              boxShadow:
                muiTheme.palette.mode === 'light'
                  ? '0 12px 40px rgba(15, 23, 42, 0.12), 0 4px 12px rgba(15, 23, 42, 0.06)'
                  : '0 12px 40px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden',
              transition: 'background-color 0.28s ease, border-color 0.28s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${shell.headerBorderBottom}` }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: shell.crumbCurrent }}>
                {userProfile?.displayName || 'User'}
              </div>
              <div style={{ fontSize: 13, color: shell.crumbMuted, marginTop: 4 }}>{userProfile?.email}</div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: shell.accent,
                }}
              >
                {userProfile?.role} access
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 18px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                color: shell.accent,
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = alpha(shell.accent, 0.08);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <LogOut size={18} strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </>
      )}
    </header>
  );
}
