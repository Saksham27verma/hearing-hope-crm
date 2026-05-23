'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InvoiceWhatsAppRequestWithId } from '@/lib/invoices/invoiceWhatsAppRequestTypes';

export type WhatsAppApprovalAlertItem = InvoiceWhatsAppRequestWithId & {
  toastId: string;
  enteredAt: number;
};

const TOAST_MS = 18_000;
const MAX_VISIBLE = 3;

export function useWhatsAppApprovalLiveAlerts(
  pending: InvoiceWhatsAppRequestWithId[],
  enabled: boolean,
) {
  const bootstrappedRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());
  const [visible, setVisible] = useState<WhatsAppApprovalAlertItem[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    (request: InvoiceWhatsAppRequestWithId) => {
      const toastId = `wa-alert:${request.id}:${Date.now()}`;
      const item: WhatsAppApprovalAlertItem = {
        ...request,
        toastId,
        enteredAt: Date.now(),
      };

      setVisible((prev) => {
        const next = [item, ...prev.filter((v) => v.id !== request.id)].slice(0, MAX_VISIBLE);
        return next;
      });

      const existing = timersRef.current.get(toastId);
      if (existing) clearTimeout(existing);
      timersRef.current.set(
        toastId,
        setTimeout(() => dismiss(toastId), TOAST_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    if (!enabled) {
      bootstrappedRef.current = false;
      seenRef.current = new Set();
      setVisible([]);
      return;
    }

    if (!bootstrappedRef.current) {
      pending.forEach((p) => seenRef.current.add(p.id));
      bootstrappedRef.current = true;
      if (pending[0]) pushOne(pending[0]);
      return;
    }

    for (const p of pending) {
      if (seenRef.current.has(p.id)) continue;
      seenRef.current.add(p.id);
      pushOne(p);
    }
  }, [pending, enabled, pushOne]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const dismissByRequestId = useCallback((requestId: string) => {
    setVisible((items) => items.filter((i) => i.id !== requestId));
  }, []);

  return { visible, exitingIds, dismiss, dismissByRequestId };
}
