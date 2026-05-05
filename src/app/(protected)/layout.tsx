'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import UniversalSearch from '@/components/universal-search/UniversalSearch';
import { LazyHopeAIDrawer } from '@/components/common/LazyComponents';
import CrmSidebar from '@/components/Layout/CrmSidebar';
import CrmHeader from '@/components/Layout/CrmHeader';
import { filterCrmNavForUser } from '@/components/Layout/crm-nav-config';
import { HEADER_HEIGHT, mainOffsetLeftPx } from '@/components/Layout/crm-theme';
import { useTheme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { useCenterScope } from '@/hooks/useCenterScope';
import CenterScopeToolbar from '@/components/Layout/CenterScopeToolbar';

/** Reserved space below header for fixed scope bar (expanded vs collapsed strip). */
const SCOPE_TOOLBAR_HEIGHT_EXPANDED = 88;
const SCOPE_TOOLBAR_HEIGHT_COLLAPSED = 40;
import SqueezeLoader from '@/components/ui/loading-indicator';

/** v1: flat JSON arrays only (legacy). v2: `{ order, updatedAt }` for conflict resolution with Firestore. */
const SIDEBAR_ORDER_STORAGE_PREFIX = 'crm_sidebar_order_v1_';
const SIDEBAR_ORDER_V2_PREFIX = 'crm_sidebar_order_v2_';

function mergeSidebarOrderWithBaseKeys(order: string[], baseKeys: string[]): string[] {
  const normalized = order.filter((key) => baseKeys.includes(key));
  const missing = baseKeys.filter((key) => !normalized.includes(key));
  return [...normalized, ...missing];
}

function readSidebarOrderV1Only(uid: string): string[] {
  if (typeof window === 'undefined' || !uid) return [];
  const legacyRoleKeys = ['guest', 'staff', 'audiologist', 'admin'].map(
    (role) => `${SIDEBAR_ORDER_STORAGE_PREFIX}${role}_${uid}`,
  );
  const keysToTry = [`${SIDEBAR_ORDER_STORAGE_PREFIX}${uid}`, ...legacyRoleKeys];
  for (const key of keysToTry) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;
      const filtered = parsed.filter((item): item is string => typeof item === 'string');
      if (filtered.length > 0) return filtered;
    } catch {
      /* try next key */
    }
  }
  return [];
}

function readSidebarBundleFromLocalStorage(uid: string): { order: string[]; updatedAt: number } {
  if (typeof window === 'undefined' || !uid) return { order: [], updatedAt: 0 };
  try {
    const rawV2 = window.localStorage.getItem(`${SIDEBAR_ORDER_V2_PREFIX}${uid}`);
    if (rawV2) {
      const data = JSON.parse(rawV2) as { order?: unknown; updatedAt?: unknown };
      if (data && Array.isArray(data.order)) {
        const order = data.order.filter((item): item is string => typeof item === 'string');
        const updatedAt =
          typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : 0;
        return { order, updatedAt };
      }
    }
  } catch {
    /* fall through to v1 */
  }
  const legacy = readSidebarOrderV1Only(uid);
  return { order: legacy, updatedAt: legacy.length > 0 ? 1 : 0 };
}

function writeSidebarBundleToLocalStorage(uid: string, mergedOrder: string[], updatedAt: number) {
  if (typeof window === 'undefined' || !uid) return;
  try {
    window.localStorage.setItem(
      `${SIDEBAR_ORDER_V2_PREFIX}${uid}`,
      JSON.stringify({ order: mergedOrder, updatedAt }),
    );
  } catch {
    /* ignore quota / privacy mode */
  }
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const { user, loading, signOut, userProfile, isAllowedModule, error, patchLocalUserProfile } = useAuth();
  const { canOverrideScope, lockedCenterId, scopeToolbarExpanded } = useCenterScope();
  const showScopeToolbar = canOverrideScope || !!lockedCenterId;
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
  const redirectFailsafeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [sidebarOrder, setSidebarOrder] = useState<string[]>([]);
  const [sidebarSaveStatus, setSidebarSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const shouldHideSidebar = pathname?.includes('/enquiries/new') || pathname?.includes('/enquiries/edit');

  const baseVisibleNav = useMemo(
    () => filterCrmNavForUser(userProfile, isAllowedModule),
    [userProfile, isAllowedModule],
  );

  const sidebarOrderBaseKeys = useMemo(() => baseVisibleNav.map((item) => item.text), [baseVisibleNav]);

  const mergedServerOrderSig = useMemo(() => {
    const profileOrder = Array.isArray(userProfile?.sidebarOrder)
      ? userProfile.sidebarOrder.filter((x): x is string => typeof x === 'string')
      : [];
    return mergeSidebarOrderWithBaseKeys(profileOrder, sidebarOrderBaseKeys).join('|');
  }, [userProfile?.sidebarOrder, sidebarOrderBaseKeys]);

  const mergedLocalOrderSig = useMemo(
    () => mergeSidebarOrderWithBaseKeys(sidebarOrder, sidebarOrderBaseKeys).join('|'),
    [sidebarOrder, sidebarOrderBaseKeys],
  );

  const showSidebarOrderSave =
    isDesktop &&
    drawerOpen &&
    baseVisibleNav.length > 0 &&
    mergedServerOrderSig !== mergedLocalOrderSig;

  useLayoutEffect(() => {
    const uid = user?.uid;
    if (!uid || typeof window === 'undefined') return;
    if (baseVisibleNav.length === 0) return;

    const baseKeys = baseVisibleNav.map((item) => item.text);
    const profileOrder = Array.isArray(userProfile?.sidebarOrder)
      ? userProfile.sidebarOrder.filter((x): x is string => typeof x === 'string')
      : [];
    const profileTs =
      typeof userProfile?.sidebarOrderUpdatedAt === 'number' &&
      Number.isFinite(userProfile.sidebarOrderUpdatedAt)
        ? userProfile.sidebarOrderUpdatedAt
        : 0;

    const mergedProfile = mergeSidebarOrderWithBaseKeys(profileOrder, baseKeys);
    const { order: storageRaw, updatedAt: storageTs } = readSidebarBundleFromLocalStorage(uid);
    const mergedStorage = mergeSidebarOrderWithBaseKeys(storageRaw, baseKeys);

    let next: string[];
    let persistTs: number;

    if (storageTs > profileTs) {
      next = mergedStorage;
      persistTs = storageTs;
    } else if (profileOrder.length > 0) {
      next = mergedProfile;
      persistTs = profileTs;
    } else {
      next = mergedStorage;
      persistTs = storageTs;
    }

    setSidebarOrder((prev) => (prev.join('|') === next.join('|') ? prev : next));
    writeSidebarBundleToLocalStorage(uid, next, persistTs);
  }, [user?.uid, userProfile?.sidebarOrder, userProfile?.sidebarOrderUpdatedAt, baseVisibleNav]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user?.uid) return;
    if (baseVisibleNav.length === 0) return;
    if (sidebarOrder.length === 0) return;

    const baseKeys = baseVisibleNav.map((item) => item.text);
    const normalized = sidebarOrder.filter((key) => baseKeys.includes(key));
    const missing = baseKeys.filter((key) => !normalized.includes(key));
    const merged = [...normalized, ...missing];
    const current = sidebarOrder.join('|');
    const next = merged.join('|');
    if (current !== next) {
      setSidebarOrder(merged);
      return;
    }

    const uid = user.uid;
    const prevBundle = readSidebarBundleFromLocalStorage(uid);
    const prevMerged = mergeSidebarOrderWithBaseKeys(prevBundle.order, baseKeys);
    const prevSig = prevMerged.join('|');
    let updatedAt = prevBundle.updatedAt;
    if (next !== prevSig) {
      updatedAt = Date.now();
    }
    writeSidebarBundleToLocalStorage(uid, merged, updatedAt);
  }, [baseVisibleNav, sidebarOrder, user?.uid]);

  const handleSaveSidebarOrder = useCallback(async () => {
    const uid = user?.uid;
    if (!uid || !userProfile) return;
    setSidebarSaveStatus('saving');
    try {
      const baseKeys = baseVisibleNav.map((item) => item.text);
      const merged = mergeSidebarOrderWithBaseKeys(sidebarOrder, baseKeys);
      const ts = Date.now();
      const { db } = await import('@/firebase/config');
      if (!db) throw new Error('Database not available');
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', uid), {
        sidebarOrder: merged,
        sidebarOrderUpdatedAt: ts,
        updatedAt: ts,
      });
      writeSidebarBundleToLocalStorage(uid, merged, ts);
      patchLocalUserProfile({ sidebarOrder: merged, sidebarOrderUpdatedAt: ts });
      setSidebarOrder(merged);
      setSidebarSaveStatus('saved');
      window.setTimeout(() => setSidebarSaveStatus('idle'), 2500);
    } catch (saveErr) {
      console.error('Save sidebar order failed:', saveErr);
      setSidebarSaveStatus('error');
    }
  }, [user?.uid, userProfile, sidebarOrder, baseVisibleNav, patchLocalUserProfile]);

  const visibleNav = useMemo(() => {
    if (sidebarOrder.length === 0) return baseVisibleNav;
    const navByText = new Map(baseVisibleNav.map((item) => [item.text, item]));
    const ordered = sidebarOrder.map((key) => navByText.get(key)).filter((item): item is NonNullable<typeof item> => !!item);
    const seen = new Set(ordered.map((item) => item.text));
    const remaining = baseVisibleNav.filter((item) => !seen.has(item.text));
    return [...ordered, ...remaining];
  }, [baseVisibleNav, sidebarOrder]);

  const handleReorderItems = (fromIndex: number, toIndex: number) => {
    setSidebarOrder((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

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

  /** Super-admin-only routes (must match `superAdminOnly` in crm-nav-config, e.g. Profit). */
  useEffect(() => {
    if (loading || !userProfile || !pathname) return;
    if (userProfile.role !== 'admin') return;
    if (userProfile.isSuperAdmin === true) return;
    const superAdminPaths = ['/profit', '/expenses'];
    if (!superAdminPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) return;
    router.replace('/dashboard');
  }, [loading, userProfile, pathname, router]);

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
        '/receipts',
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
        '/receipts',
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
        if (redirectFailsafeRef.current) clearTimeout(redirectFailsafeRef.current);
        redirectFailsafeRef.current = setTimeout(() => {
          redirectFailsafeRef.current = null;
          setIsRedirecting(false);
        }, 8000);
        // replace avoids stacking forbidden URLs in history (back-button loops with full-screen "Redirecting…")
        router.replace('/dashboard');
      }
    } else if (isAllowed) {
      hasRedirectedRef.current = null;
      if (redirectFailsafeRef.current) {
        clearTimeout(redirectFailsafeRef.current);
        redirectFailsafeRef.current = null;
      }
      setIsRedirecting(false);
    }
  }, [userProfile, pathname, shouldHideSidebar, loading, router]);

  useEffect(() => {
    return () => {
      if (redirectFailsafeRef.current) clearTimeout(redirectFailsafeRef.current);
    };
  }, []);

  const mainOffset = mainOffsetLeftPx(shouldHideSidebar, isDesktop, drawerOpen);
  const scopeBarOffset = showScopeToolbar
    ? scopeToolbarExpanded
      ? SCOPE_TOOLBAR_HEIGHT_EXPANDED
      : SCOPE_TOOLBAR_HEIGHT_COLLAPSED
    : 0;

  const errorContainer: React.CSSProperties = {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    padding: 20,
    borderRadius: 16,
    margin: 16,
    textAlign: 'center',
    boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.35)}`,
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
  };

  if (loading) {
    return (
      <SqueezeLoader
        caption="Signing you in…"
        subcaption="Checking your account"
        size={64}
        spinDuration={10}
        squeezeDuration={3}
      />
    );
  }

  if (isRedirecting) {
    return (
      <SqueezeLoader
        caption="Opening your workspace…"
        subcaption="This page is not available for your role."
        size={56}
        spinDuration={8}
        squeezeDuration={2.5}
      />
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
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.primary.main,
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
    return <SqueezeLoader caption="Redirecting to login…" subcaption="Please wait" size={56} />;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        bgcolor: 'background.default',
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        transition: 'background-color 0.28s ease',
      }}
    >
      {!shouldHideSidebar && !isDesktop && drawerOpen && (
        <div
          role="presentation"
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: alpha(theme.palette.mode === 'light' ? '#0f172a' : '#000000', 0.45),
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
          onReorderItems={handleReorderItems}
          sidebarOrderSave={
            showSidebarOrderSave
              ? { show: true, status: sidebarSaveStatus, onSave: handleSaveSidebarOrder }
              : undefined
          }
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

      {showScopeToolbar && (
        <div
          style={{
            position: 'fixed',
            top: HEADER_HEIGHT,
            left: shouldHideSidebar ? 0 : isDesktop ? mainOffset : 0,
            right: 0,
            zIndex: 1140,
          }}
        >
          <CenterScopeToolbar />
        </div>
      )}

      <UniversalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <LazyHopeAIDrawer open={hopeAiOpen} onClose={() => setHopeAiOpen(false)} />

      <main
        style={{
          marginLeft: shouldHideSidebar ? 0 : isDesktop ? mainOffset : 0,
          marginTop: HEADER_HEIGHT + scopeBarOffset,
          padding: pathname?.includes('/interaction/enquiries') && !pathname?.includes('/new') && !pathname?.includes('/edit') ? 8 : 28,
          transition: 'margin-left 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: `calc(100vh - ${HEADER_HEIGHT + scopeBarOffset}px)`,
          width: shouldHideSidebar ? '100%' : `calc(100% - ${isDesktop ? mainOffset : 0}px)`,
          maxWidth: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {children}
      </main>
    </Box>
  );
}
