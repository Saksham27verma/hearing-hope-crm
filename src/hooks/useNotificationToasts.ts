'use client';

import { useEffect, useRef } from 'react';
import { useSnackbar } from 'notistack';
import type { NotificationWithId } from '@/lib/notifications/types';

export function useNotificationToasts(notifications: NotificationWithId[]) {
  const { enqueueSnackbar } = useSnackbar();
  const initializedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!initializedRef.current) {
      notifications.forEach((n) => seenIdsRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }

    for (const n of notifications) {
      if (seenIdsRef.current.has(n.id)) continue;
      seenIdsRef.current.add(n.id);
      if (n.is_read) continue;

      const title = String(n.title || 'Notification').trim() || 'Notification';
      const msg = String(n.message || '').trim();
      enqueueSnackbar(msg ? `${title} — ${msg}` : title, { variant: 'info' });
    }
  }, [enqueueSnackbar, notifications]);
}

