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

const TOAST_MS = 20_000;
const MAX_VISIBLE = 3;
const WATCH_LIMIT = 15;

export function useWhatsAppInboundLiveAlerts(enabled: boolean) {
  const bootstrappedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const [messages, setMessages] = useState<WhatsAppInboundMessageWithId[]>([]);
  const [visible, setVisible] = useState<WhatsAppInboundAlertItem[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!enabled || !db) {
      bootstrappedRef.current = false;
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
      setMessages(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<WhatsAppInboundMessageWithId, 'id'>),
        })),
      );
    });
  }, [enabled]);

  const dismiss = useCallback((toastId: string) => {
    setExitingIds((prev) => new Set(prev).add(toastId));
    const existing = timersRef.current.get(toastId);
    if (existing) clearTimeout(existing);
    timersRef.current.set(
      toastId,
      setTimeout(() => {
        setVisible((v) => v.filter((item) => item.toastId !== toastId));
        setExitingIds((prev) => {
          const next = new Set(prev);
          next.delete(toastId);
          return next;
        });
        timersRef.current.delete(toastId);
      }, 420),
    );
  }, []);

  const pushOne = useCallback(
    (message: WhatsAppInboundMessageWithId) => {
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
    if (!enabled) return;

    if (!bootstrappedRef.current) {
      messages.forEach((m) => seenRef.current.add(m.id));
      bootstrappedRef.current = true;
      return;
    }

    for (const m of messages) {
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
