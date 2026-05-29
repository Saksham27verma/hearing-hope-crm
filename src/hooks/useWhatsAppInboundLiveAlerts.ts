'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/firebase/config';
import {
  WHATSAPP_INBOUND_MESSAGES_COLLECTION,
  type WhatsAppInboundMessageWithId,
} from '@/lib/whatsapp/inboundMessageTypes';

export type WhatsAppInboundAlertItem = WhatsAppInboundMessageWithId & {
  toastId: string;
  enteredAt: number;
};

const TOAST_MS = 8_000;
const MAX_VISIBLE = 3;
const WATCH_LIMIT = 15;
const DISMISSED_STORAGE_KEY = 'crm_wa_inbound_dismissed_alert_ids';
const DISMISSED_CAP = 200;

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistDismissedIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    const arr = [...ids].slice(-DISMISSED_CAP);
    sessionStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore quota / private mode */
  }
}

export function useWhatsAppInboundLiveAlerts(enabled: boolean) {
  const bootstrappedRef = useRef(false);
  const hydratedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const dismissedRef = useRef<Set<string>>(loadDismissedIds());
  const [messages, setMessages] = useState<WhatsAppInboundMessageWithId[]>([]);
  const [visible, setVisible] = useState<WhatsAppInboundAlertItem[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const rememberDismissed = useCallback((messageId: string) => {
    const cleanId = String(messageId || '').trim();
    if (!cleanId) return;
    dismissedRef.current.add(cleanId);
    seenRef.current.add(cleanId);
    persistDismissedIds(dismissedRef.current);
  }, []);

  useEffect(() => {
    if (!enabled || !db) {
      bootstrappedRef.current = false;
      hydratedRef.current = false;
      seenRef.current = new Set();
      setMessages([]);
      setVisible([]);
      return;
    }

    const q = query(
      collection(db, WHATSAPP_INBOUND_MESSAGES_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(WATCH_LIMIT),
    );

    return onSnapshot(q, (snap) => {
      hydratedRef.current = true;
      setMessages(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WhatsAppInboundMessageWithId, 'id'>),
        })),
      );
    });
  }, [enabled]);

  const dismiss = useCallback(
    (toastId: string, messageId?: string) => {
      if (messageId) rememberDismissed(messageId);

      setExitingIds((prev) => new Set(prev).add(toastId));
      const existing = timersRef.current.get(toastId);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        toastId,
        setTimeout(() => {
          setVisible((v) => {
            const item = v.find((i) => i.toastId === toastId);
            if (item) rememberDismissed(item.id);
            return v.filter((item) => item.toastId !== toastId);
          });
          setExitingIds((prev) => {
            const next = new Set(prev);
            next.delete(toastId);
            return next;
          });
          timersRef.current.delete(toastId);
        }, 420),
      );
    },
    [rememberDismissed],
  );

  const pushOne = useCallback(
    (message: WhatsAppInboundMessageWithId) => {
      if (dismissedRef.current.has(message.id)) return;

      const toastId = `wa-inbound:${message.id}:${Date.now()}`;
      const item: WhatsAppInboundAlertItem = {
        ...message,
        toastId,
        enteredAt: Date.now(),
      };

      setVisible((prev) => {
        const next = [item, ...prev.filter((v) => v.id !== message.id)].slice(0, MAX_VISIBLE);
        return next;
      });

      const existing = timersRef.current.get(toastId);
      if (existing) clearTimeout(existing);
      timersRef.current.set(toastId, setTimeout(() => dismiss(toastId), TOAST_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;

    if (!bootstrappedRef.current) {
      messages.forEach((m) => seenRef.current.add(m.id));
      bootstrappedRef.current = true;
      return;
    }

    for (const m of messages) {
      if (dismissedRef.current.has(m.id)) {
        seenRef.current.add(m.id);
        continue;
      }
      if (seenRef.current.has(m.id)) continue;
      seenRef.current.add(m.id);
      pushOne(m);
    }
  }, [messages, enabled, pushOne]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  return { visible, exitingIds, dismiss };
}
