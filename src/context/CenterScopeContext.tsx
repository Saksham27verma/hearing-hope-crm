'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getLockedCenterId,
  isSuperAdminViewer,
  normalizeCenterId,
} from '@/lib/tenant/centerScope';

const STORAGE_KEY = 'crm-scope-view-center-v1';

export type CenterScopeContextValue = {
  /** Center the user cannot leave (non–super-admins). */
  lockedCenterId: string | null;
  /** Super admins may choose all centers or one. */
  canOverrideScope: boolean;
  /** Pass to Firestore queries — `null` means no extra center filter (all centers). */
  effectiveScopeCenterId: string | null;
  /** UI state for super admins (`all` or a center id). Locked users mirror `lockedCenterId`. */
  viewCenterMode: 'all' | string;
  setViewCenterMode: (mode: 'all' | string) => void;
  centers: Array<{ id: string; name: string }>;
  centersLoading: boolean;
};

const CenterScopeContext = createContext<CenterScopeContextValue | null>(null);

export function CenterScopeProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const [centers, setCenters] = useState<Array<{ id: string; name: string }>>([]);
  const [centersLoading, setCentersLoading] = useState(true);
  const [viewCenterMode, setViewState] = useState<'all' | string>('all');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v !== 'all') setViewState(v);
  }, []);

  const lockedCenterId = useMemo(() => getLockedCenterId(userProfile), [userProfile]);

  const canOverrideScope = useMemo(
    () => !!userProfile && userProfile.role === 'admin' && isSuperAdminViewer(userProfile),
    [userProfile],
  );

  const effectiveScopeCenterId = useMemo(() => {
    if (lockedCenterId) return lockedCenterId;
    if (!canOverrideScope) {
      const cid = normalizeCenterId(userProfile);
      return cid;
    }
    return viewCenterMode === 'all' ? null : viewCenterMode;
  }, [lockedCenterId, canOverrideScope, userProfile, viewCenterMode]);

  const displayViewMode = useMemo(() => {
    if (lockedCenterId) return lockedCenterId;
    return viewCenterMode;
  }, [lockedCenterId, viewCenterMode]);

  const setViewCenterMode = useCallback(
    (mode: 'all' | string) => {
      if (lockedCenterId) return;
      if (!canOverrideScope) return;
      setViewState(mode);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, mode);
      }
    },
    [lockedCenterId, canOverrideScope],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { db } = await import('@/firebase/config');
        const { collection, getDocs, orderBy, query } = await import('firebase/firestore');
        if (!db) return;
        const q = query(collection(db, 'centers'), orderBy('name'));
        const snap = await getDocs(q);
        if (cancelled) return;
        setCenters(
          snap.docs.map((d) => {
            const data = d.data() as { name?: string };
            return { id: d.id, name: data.name || d.id };
          }),
        );
      } catch (e) {
        console.warn('CenterScope: failed to load centers', e);
      } finally {
        if (!cancelled) setCentersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    (): CenterScopeContextValue => ({
      lockedCenterId,
      canOverrideScope,
      effectiveScopeCenterId,
      viewCenterMode: displayViewMode,
      setViewCenterMode,
      centers,
      centersLoading,
    }),
    [
      lockedCenterId,
      canOverrideScope,
      effectiveScopeCenterId,
      displayViewMode,
      setViewCenterMode,
      centers,
      centersLoading,
    ],
  );

  return <CenterScopeContext.Provider value={value}>{children}</CenterScopeContext.Provider>;
}

export function useCenterScope(): CenterScopeContextValue {
  const ctx = useContext(CenterScopeContext);
  if (!ctx) {
    throw new Error('useCenterScope must be used within CenterScopeProvider');
  }
  return ctx;
}
