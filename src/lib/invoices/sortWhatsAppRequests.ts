import type { InvoiceWhatsAppRequestWithId } from '@/lib/invoices/invoiceWhatsAppRequestTypes';

export function requestedAtToMs(value: unknown): number {
  if (!value) return 0;
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return 0;
}

/** Newest first — avoids Firestore composite index on status + requestedAt. */
export function sortWhatsAppRequestsNewestFirst(
  rows: InvoiceWhatsAppRequestWithId[],
): InvoiceWhatsAppRequestWithId[] {
  return [...rows].sort((a, b) => requestedAtToMs(b.requestedAt) - requestedAtToMs(a.requestedAt));
}
