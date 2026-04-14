'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { User } from 'firebase/auth';
import { DEFAULT_FIRESTORE_POLL_MS } from '@/lib/firestore/pollingSubscribe';

/** Heartbeat every 25s; consider online if lastSeen within this window */
const ONLINE_MS = 75_000;
const ONLINE_RECHECK_MS = 10_000;

function lastSeenMs(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'number') return value;
  return 0;
}

/** Writes periodic heartbeats so other clients can show “live” status. */
export function useUserPresenceHeartbeat(authUser: User | null, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !authUser || !db) return;
    const ref = doc(db, 'userPresence', authUser.uid);
    const pulse = () => {
      void setDoc(
        ref,
        {
          uid: authUser.uid,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    };
    pulse();
    const onVisible = () => {
      if (document.visibilityState === 'visible') pulse();
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(pulse, 20_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [authUser, enabled]);
}

/** Subscribes to `userPresence/{uid}` for a bounded list of user ids. */
export function usePresenceOnlineMap(userIds: string[]): Record<string, boolean> {
  const [presence, setPresence] = useState<Record<string, { lastSeen: number; pending: boolean }>>({});
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const idKey = useMemo(() => [...userIds].sort().join('|'), [userIds]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), ONLINE_RECHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!db || userIds.length === 0) {
      setPresence({});
      return;
    }
    let cancelled = false;

    const poll = async () => {
      try {
        const pairs = await Promise.all(
          userIds.map(async (uid) => {
            const snap = await getDoc(doc(db, 'userPresence', uid));
            return { uid, snap };
          }),
        );
        if (cancelled) return;
        setPresence((m) => {
          const next = { ...m };
          for (const { uid, snap } of pairs) {
            if (!snap.exists()) {
              next[uid] = { lastSeen: 0, pending: false };
            } else {
              const d = snap.data() as { lastSeen?: unknown };
              next[uid] = { lastSeen: lastSeenMs(d.lastSeen), pending: false };
            }
          }
          return next;
        });
      } catch (err) {
        if (!cancelled) console.warn('userPresence poll error', err);
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), DEFAULT_FIRESTORE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // idKey is a stable serialization of `userIds` (sorted join).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-subscribing on array identity churn
  }, [idKey]);

  return useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const uid of userIds) {
      const entry = presence[uid];
      out[uid] = Boolean(entry && (entry.pending || (entry.lastSeen > 0 && nowMs - entry.lastSeen < ONLINE_MS)));
    }
    return out;
  }, [userIds, presence, nowMs]);
}
