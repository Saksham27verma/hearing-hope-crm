'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, startTransition, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import UniversalSearch from '@/components/universal-search/UniversalSearch';
import { LazyHopeAIDrawer } from '@/components/common/LazyComponents';
import CrmSidebar from '@/components/Layout/CrmSidebar';
import CrmHeader from '@/components/Layout/CrmHeader';
import { filterCrmNavForUser } from '@/components/Layout/crm-nav-config';
import { CRM_ACCENT, CRM_PAGE_BG, HEADER_HEIGHT, mainOffsetLeftPx } from '@/components/Layout/crm-theme';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, userProfile, isAllowedModule, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hopeAiOpen, setHopeAiOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const hasRedirectedRef = useRef<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const shouldHideSidebar = pathname?.includes('/enquiries/new') || pathname?.includes('/enquiries/edit');

  const visibleNav = useMemo(
    () => filterCrmNavForUser(userProfile, isAllowedModule),
    [userProfile, isAllowedModule],
  );

  useEffect(() => {
    if (!pathname) return;
    setOpenMenus((prev) => {
      const next = { ...prev };
      let changed = false;
      visibleNav.forEach((item) => {
        if (item.children?.some((c) => pathname.startsWith(c.path))) {
          if (!next[item.text]) {
            next[item.text] = true;
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [pathname, visibleNav]);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const sync = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      setDrawerOpen(desktop);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setHopeAiOpen(false);
        setProfileMenuOpen(false);
        if (window.matchMedia('(max-width: 899px)').matches) {
          setDrawerOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleMenu = (menuText: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuText]: !prev[menuText],
    }));
  };

  const handleSidebarMouseEnter = () => {
    if (!isDesktop) return;
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setDrawerOpen(true);
  };

  const handleSidebarMouseLeave = () => {
    if (!isDesktop) return;
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    collapseTimeoutRef.current = setTimeout(() => {
      setDrawerOpen(false);
      collapseTimeoutRef.current = null;
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) {
        clearTimeout(collapseTimeoutRef.current);
      }
    };
  }, []);

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    try {
      await signOut();
    } catch (signOutError) {
      console.error('Sign out error:', signOutError);
    }
  };

  const handleToggleSidebar = () => {
    setDrawerOpen((v) => !v);
    setProfileMenuOpen(false);
  };

  useEffect(() => {
    if (loading || !userProfile || shouldHideSidebar) {
      hasRedirectedRef.current = null;
      setIsRedirecting(false);
      return;
    }

    if (userProfile.role === 'admin' || !pathname) {
      setIsRedirecting(false);
      hasRedirectedRef.current = null;
      return;
    }

    if (userProfile.role !== 'staff' && userProfile.role !== 'audiologist') {
      setIsRedirecting(false);
      hasRedirectedRef.current = null;
      return;
    }

    let allowedPaths: string[] = [];

    if (userProfile.role === 'staff') {
      allowedPaths = [
        '/dashboard',
        '/products',
        '/sales',
        '/interaction',
        '/interaction/visitors',
        '/interaction/enquiries',
        '/telecalling-records',
        '/stock-transfer',
        '/cash-register',
        '/appointments',
        '/material-in',
        '/material-out',
        '/inventory',
      ];
    } else if (userProfile.role === 'audiologist') {
      allowedPaths = [
        '/dashboard',
        '/products',
        '/inventory',
        '/appointments',
        '/interaction',
        '/interaction/enquiries',
      ];
    }

    const isAllowed = allowedPaths.some((path) => {
      if (pathname === path) return true;
      if (pathname.startsWith(path + '/')) return true;
      return false;
    });

    if (!isAllowed && pathname !== '/dashboard') {
      const redirectKey = `redirect_${pathname}`;
      if (hasRedirectedRef.current !== redirectKey) {
        hasRedirectedRef.current = redirectKey;
        setIsRedirecting(true);
        startTransition(() => {
          router.push('/dashboard');
        });
      }
    } else if (isAllowed) {
      hasRedirectedRef.current = null;
      setIsRedirecting(false);
    }
  }, [userProfile, pathname, shouldHideSidebar, loading, router]);

  const mainOffset = mainOffsetLeftPx(shouldHideSidebar, isDesktop, drawerOpen);

  const loadingContainer: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh',
    fontSize: 18,
    color: '#64748b',
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
  };

  const errorContainer: React.CSSProperties = {
    backgroundColor: CRM_ACCENT,
    color: 'white',
    padding: 20,
    borderRadius: 16,
    margin: 16,
    textAlign: 'center',
    boxShadow: '0 12px 40px rgba(241, 115, 54, 0.25)',
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
  };

  if (loading) {
    return (
      <div style={loadingContainer}>
        <div>Loading your dashboard…</div>
      </div>
    );
  }

  if (isRedirecting) {
    return (
      <div style={loadingContainer}>
        <div>Redirecting to allowed page…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={errorContainer}>
        <h3>Connection Error</h3>
        <p>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 18px',
            backgroundColor: 'white',
            color: CRM_ACCENT,
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            fontWeight: 700,
            marginTop: 12,
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!loading && !user && !shouldHideSidebar) {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return (
      <div style={loadingContainer}>
        <div>Redirecting to login…</div>
      </div>
    );
  }

  if (loading && !user) {
    return (
      <div style={loadingContainer}>
        <div>Loading your dashboard…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: CRM_PAGE_BG,
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}
    >
      {!shouldHideSidebar && !isDesktop && drawerOpen && (
        <div
          role="presentation"
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            zIndex: 1220,
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {!shouldHideSidebar && (
        <CrmSidebar
          isDesktop={isDesktop}
          expanded={drawerOpen}
          pathname={pathname}
          items={visibleNav}
          openMenus={openMenus}
          toggleMenu={toggleMenu}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
          mobileOpen={drawerOpen}
          onMobileNavigate={() => {
            if (!isDesktop) setDrawerOpen(false);
          }}
        />
      )}

      <CrmHeader
        shouldHideSidebar={shouldHideSidebar}
        isDesktop={isDesktop}
        sidebarExpanded={drawerOpen}
        leftOffsetPx={mainOffset}
        pathname={pathname}
        enquiryModeTitle={
          shouldHideSidebar ? 'Hearing Hope CRM — Enquiry Form' : undefined
        }
        onToggleSidebar={handleToggleSidebar}
        onOpenSearch={() => {
          setSearchOpen(true);
          setProfileMenuOpen(false);
        }}
        onOpenHopeAi={() => {
          setHopeAiOpen(true);
          setProfileMenuOpen(false);
        }}
        onProfileToggle={() => setProfileMenuOpen((v) => !v)}
        onCloseProfileMenu={() => setProfileMenuOpen(false)}
        profileMenuOpen={profileMenuOpen}
        userProfile={userProfile}
        userPhotoURL={user?.photoURL ?? null}
        onSignOut={handleSignOut}
      />

      <UniversalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <LazyHopeAIDrawer open={hopeAiOpen} onClose={() => setHopeAiOpen(false)} />

      <main
        style={{
          marginLeft: shouldHideSidebar ? 0 : isDesktop ? mainOffset : 0,
          marginTop: HEADER_HEIGHT,
          padding: 28,
          transition: 'margin-left 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </main>
    </div>
  );
}
