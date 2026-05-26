'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/firebase/config';
import {
  WHATSAPP_INBOUND_MESSAGES_COLLECTION,
  type WhatsAppInboundMessageWithId,
} from '@/lib/whatsapp/inboundMessageTypes';

export function useWhatsAppInboundInbox(opts?: { limit?: number }) {
  const take = Math.max(20, Math.min(200, opts?.limit ?? 80));
  const [messages, setMessages] = useState<WhatsAppInboundMessageWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, WHATSAPP_INBOUND_MESSAGES_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(take),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<WhatsAppInboundMessageWithId, 'id'>),
          })),
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.warn('whatsapp inbound inbox:', err);
        setError(err instanceof Error ? err.message : 'Failed to load messages');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [take]);

  return { messages, loading, error };
}
