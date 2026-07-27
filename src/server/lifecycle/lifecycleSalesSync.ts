import { adminDb } from '@/server/firebaseAdmin';

export type LifecycleSalePayload = {
  crmSaleId: string;
  customerName: string;
  phone: string;
  saleDate: string;
  address?: string;
  reference?: string;
  centerId?: string;
  notes?: string;
  cancelled?: boolean;
};

function toYmd(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value === 'object' && value !== null) {
    const anyVal = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof anyVal.toDate === 'function') {
      try {
        return anyVal.toDate().toISOString().slice(0, 10);
      } catch {}
    }
    const secs = anyVal.seconds ?? anyVal._seconds;
    if (typeof secs === 'number') {
      return new Date(secs * 1000).toISOString().slice(0, 10);
    }
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return '';
}

/** Load a sale doc + related enquiry (for reference) and build the lifecycle payload. */
export async function buildLifecyclePayloadFromSaleId(
  saleId: string,
): Promise<LifecycleSalePayload | null> {
  const db = adminDb();
  const snap = await db.collection('sales').doc(saleId).get();
  if (!snap.exists) return null;
  const sale = snap.data() as Record<string, unknown>;

  const customerName = String(sale.patientName || '').trim();
  const phone = String(sale.phone || '').trim();
  const saleDate = toYmd(sale.saleDate);
  if (!customerName || !phone || !saleDate) return null;

  let reference = '';
  const enquiryId = sale.enquiryId ? String(sale.enquiryId) : '';
  if (enquiryId) {
    try {
      const enquirySnap = await db.collection('enquiries').doc(enquiryId).get();
      if (enquirySnap.exists) {
        const enquiry = enquirySnap.data() as Record<string, unknown>;
        const refField = enquiry.reference;
        if (Array.isArray(refField)) {
          reference = refField.map((r) => String(r).trim()).filter(Boolean).join(', ');
        } else if (typeof refField === 'string') {
          reference = refField.trim();
        }
      }
    } catch (err) {
      console.warn('[lifecycleSalesSync] failed to load enquiry for reference', err);
    }
  }
  if (!reference) {
    const doctor = sale.referenceDoctor as { name?: string } | undefined;
    reference = String(doctor?.name || '').trim();
  }

  return {
    crmSaleId: saleId,
    customerName,
    phone,
    saleDate,
    address: String(sale.address || '').trim() || undefined,
    reference: reference || undefined,
    centerId: String(sale.centerId || '').trim() || undefined,
    notes: String(sale.notes || '').trim() || undefined,
    cancelled: sale.cancelled === true,
  };
}

/** POST payload to lifecycle ingest endpoint. Errors are logged, not thrown. */
export async function postToLifecycleIngest(payload: LifecycleSalePayload): Promise<boolean> {
  const base = (process.env.LIFECYCLE_APP_URL || '').replace(/\/+$/, '');
  const secret = (process.env.LIFECYCLE_WEBHOOK_SECRET || '').trim();
  if (!base || !secret) {
    console.warn('[lifecycleSalesSync] LIFECYCLE_APP_URL or LIFECYCLE_WEBHOOK_SECRET not set; skipping');
    return false;
  }
  try {
    const res = await fetch(`${base}/api/ingest/crm-sale`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(
        `[lifecycleSalesSync] ingest failed (${res.status}) for sale ${payload.crmSaleId}: ${text}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error('[lifecycleSalesSync] ingest network error', err);
    return false;
  }
}

/** Convenience: build payload from Firestore + POST it. Never throws. */
export async function syncSaleToLifecycleById(saleId: string): Promise<boolean> {
  try {
    const payload = await buildLifecyclePayloadFromSaleId(saleId);
    if (!payload) {
      console.warn(`[lifecycleSalesSync] sale ${saleId} missing required fields; skipping`);
      return false;
    }
    return await postToLifecycleIngest(payload);
  } catch (err) {
    console.error('[lifecycleSalesSync] unexpected error', err);
    return false;
  }
}
