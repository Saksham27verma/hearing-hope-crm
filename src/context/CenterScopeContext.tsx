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
  getAllowedCenterIds,
  getLockedCenterId,
  isSuperAdminViewer,
} from '@/lib/tenant/centerScope';

const STORAGE_KEY = 'crm-scope-view-center-v1';

export type CenterScopeContextValue = {
  /** Center the user cannot leave when exactly one center is assigned (banner + no switcher). */
  lockedCenterId: string | null;
  /** Centers this user may access (`null` = all centers, e.g. super admin). */
  allowedCenterIds: string[] | null;
  /** May switch “All” vs one center: super admins, or users with multiple assigned centers. */
  canOverrideScope: boolean;
  /** Pass to Firestore queries — `null` with non-null `allowedCenterIds` means union of those centers. */
  effectiveScopeCenterId: string | null;
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

  const allowedCenterIds = useMemo(() => getAllowedCenterIds(userProfile), [userProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v !== 'all') setViewState(v);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (allowedCenterIds && allowedCenterIds.length > 1) {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && v !== 'all' && !allowedCenterIds.includes(v)) {
        setViewState('all');
        localStorage.setItem(STORAGE_KEY, 'all');
      }
    }
  }, [allowedCenterIds]);

  const lockedCenterId = useMemo(() => getLockedCenterId(userProfile), [userProfile]);

  const canOverrideScope = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin' && isSuperAdminViewer(userProfile)) return true;
    return allowedCenterIds !== null && allowedCenterIds.length > 1;
  }, [userProfile, allowedCenterIds]);

  const effectiveScopeCenterId = useMemo(() => {
    if (allowedCenterIds === null) {
      return viewCenterMode === 'all' ? null : viewCenterMode;
    }
    if (allowedCenterIds.length === 1) {
      return allowedCenterIds[0];
    }
    return viewCenterMode === 'all' ? null : viewCenterMode;
  }, [allowedCenterIds, viewCenterMode]);

  const displayViewMode = useMemo(() => {
    if (lockedCenterId) return lockedCenterId;
    return viewCenterMode;
  }, [lockedCenterId, viewCenterMode]);

  const setViewCenterMode = useCallback(
    (mode: 'all' | string) => {
      if (lockedCenterId) return;
      if (!canOverrideScope) return;
      if (mode !== 'all' && allowedCenterIds !== null && allowedCenterIds.length > 1 && !allowedCenterIds.includes(mode)) {
        return;
      }
      if (mode !== 'all' && allowedCenterIds === null) {
        // super admin: any center id is ok
      }
      setViewState(mode);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, mode);
      }
    },
    [lockedCenterId, canOverrideScope, allowedCenterIds],
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
      allowedCenterIds,
      canOverrideScope,
      effectiveScopeCenterId,
      viewCenterMode: displayViewMode,
      setViewCenterMode,
      centers,
      centersLoading,
    }),
    [
      lockedCenterId,
      allowedCenterIds,
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
