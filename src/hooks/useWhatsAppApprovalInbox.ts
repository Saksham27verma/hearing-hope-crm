'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useCenterScope } from '@/hooks/useCenterScope';
import { resolveDataScope } from '@/lib/tenant/centerScope';
import {
  INVOICE_WHATSAPP_REQUESTS_COLLECTION,
  type InvoiceWhatsAppRequestWithId,
} from '@/lib/invoices/invoiceWhatsAppRequestTypes';

function requestVisibleInScope(args: {
  centerId: string | null;
  effectiveScopeCenterId: string | null;
  viewerAllowedCenterIds: string[] | null;
}): boolean {
  const { centerId, effectiveScopeCenterId, viewerAllowedCenterIds } = args;
  if (!centerId) return true;
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  if (mode.type === 'single') return centerId === mode.centerId;
  return mode.centerIds.includes(centerId);
}

export function useWhatsAppApprovalInbox() {
  const { userProfile } = useAuth();
  const { effectiveScopeCenterId, allowedCenterIds } = useCenterScope();
  const isAdmin = userProfile?.role === 'admin' || userProfile?.isSuperAdmin === true;

  const [all, setAll] = useState<InvoiceWhatsAppRequestWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !db) {
      setAll([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, INVOICE_WHATSAPP_REQUESTS_COLLECTION),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as object) }) as InvoiceWhatsAppRequestWithId,
        );
        setAll(rows);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.warn('whatsapp approval inbox:', err);
        setError(err.message || 'Failed to load approval requests');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [isAdmin]);

  const pending = useMemo(
    () =>
      all.filter((r) =>
        requestVisibleInScope({
          centerId: r.centerId ?? null,
          effectiveScopeCenterId,
          viewerAllowedCenterIds: allowedCenterIds,
        }),
      ),
    [all, effectiveScopeCenterId, allowedCenterIds],
  );

  return {
    pending,
    pendingCount: pending.length,
    loading,
    error,
    isAdmin,
  };
}
