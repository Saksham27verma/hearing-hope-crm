'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useCenterScope } from '@/hooks/useCenterScope';
import { resolveDataScope } from '@/lib/tenant/centerScope';
import type { NotificationWithId } from '@/lib/notifications/types';

function notificationVisibleInScope(args: {
  centerId: string | null;
  effectiveScopeCenterId: string | null;
  viewerAllowedCenterIds: string[] | null;
}): boolean {
  const { centerId, effectiveScopeCenterId, viewerAllowedCenterIds } = args;
  if (!centerId) return true; // unscoped notifications are always visible
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  if (mode.type === 'single') return centerId === mode.centerId;
  return mode.centerIds.includes(centerId);
}

export function useNotifications(opts?: { limit?: number }) {
  const { user } = useAuth();
  const { effectiveScopeCenterId, allowedCenterIds } = useCenterScope();
  const take = Math.max(10, Math.min(200, opts?.limit || 50));

  const [all, setAll] = useState<NotificationWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid || !db) {
      setAll([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);

    const qIndexed = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(take),
    );

    const unsub = onSnapshot(
      qIndexed,
      (snap) => {
        setAll(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationWithId, 'id'>) })),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.warn('notifications snapshot error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user?.uid, take]);

  const notifications = useMemo(() => {
    return all.filter((n) =>
      notificationVisibleInScope({
        centerId: (n.centerId ?? null) as string | null,
        effectiveScopeCenterId,
        viewerAllowedCenterIds: allowedCenterIds,
      }),
    );
  }, [all, effectiveScopeCenterId, allowedCenterIds]);

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.is_read ? 0 : 1), 0),
    [notifications],
  );

  const markAsRead = useCallback(async (id: string) => {
    if (!db) return;
    const clean = String(id || '').trim();
    if (!clean) return;
    await updateDoc(doc(db, 'notifications', clean), {
      is_read: true,
      readAt: serverTimestamp(),
    });
  }, []);

  const markAllAsRead = useCallback(async (ids: string[]) => {
    if (!db) return;
    const cleanIds = Array.from(new Set((ids || []).map((id) => String(id || '').trim()).filter(Boolean)));
    if (cleanIds.length === 0) return;
    await Promise.all(
      cleanIds.map((id) =>
        updateDoc(doc(db, 'notifications', id), {
          is_read: true,
          readAt: serverTimestamp(),
        }),
      ),
    );
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  };
}

