'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useCenterScope } from '@/hooks/useCenterScope';
import { resolveDataScope } from '@/lib/tenant/centerScope';
import type { NotificationWithId } from '@/lib/notifications/types';
import { DEFAULT_FIRESTORE_POLL_MS } from '@/lib/firestore/pollingSubscribe';

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

    let cancelled = false;
    const qIndexed = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(take),
    );
    const fallbackQ = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(Math.max(100, take * 3)),
    );

    const mapRows = (snap: Awaited<ReturnType<typeof getDocs>>) =>
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationWithId, 'id'>) }));

    const tick = async () => {
      try {
        const snap = await getDocs(qIndexed);
        if (!cancelled) {
          setAll(mapRows(snap));
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'failed-precondition') {
          try {
            const snap = await getDocs(fallbackQ);
            if (!cancelled) {
              setAll(
                mapRows(snap)
                  .filter((n) => n.userId === user.uid)
                  .slice(0, take),
              );
              setError(null);
              setLoading(false);
            }
          } catch (e2) {
            if (!cancelled) {
              console.warn('notifications poll error:', e2);
              setError(e2 instanceof Error ? e2.message : 'Failed to load notifications');
              setLoading(false);
            }
          }
          return;
        }
        if (!cancelled) {
          console.warn('notifications poll error:', err);
          setError(err instanceof Error ? err.message : 'Failed to load notifications');
          setLoading(false);
        }
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), DEFAULT_FIRESTORE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
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

