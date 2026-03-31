'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { User } from 'firebase/auth';

/** Heartbeat every 25s; consider online if lastSeen within this window */
const ONLINE_MS = 75_000;

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
    const id = window.setInterval(pulse, 20_000);
    return () => window.clearInterval(id);
  }, [authUser, enabled]);
}

/** Subscribes to `userPresence/{uid}` for a bounded list of user ids. */
export function usePresenceOnlineMap(userIds: string[]): Record<string, boolean> {
  const [map, setMap] = useState<Record<string, boolean>>({});
  const idKey = useMemo(() => [...userIds].sort().join('|'), [userIds]);

  useEffect(() => {
    if (!db || userIds.length === 0) {
      setMap({});
      return;
    }
    const unsubs = userIds.map((uid) =>
      onSnapshot(
        doc(db, 'userPresence', uid),
        { includeMetadataChanges: true },
        (snap) => {
          if (!snap.exists()) {
            setMap((m) => ({ ...m, [uid]: false }));
            return;
          }
          const d = snap.data() as { lastSeen?: unknown };
          const ms = lastSeenMs(d.lastSeen);
          // Local pending writes (e.g. your own heartbeat) may not have lastSeen resolved yet
          const pending = snap.metadata.hasPendingWrites;
          const alive = pending || (ms > 0 && Date.now() - ms < ONLINE_MS);
          setMap((m) => ({ ...m, [uid]: alive }));
        },
        (err) => {
          console.warn('userPresence snapshot error', uid, err);
          setMap((m) => ({ ...m, [uid]: false }));
        },
      ),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [idKey]);

  return map;
}
