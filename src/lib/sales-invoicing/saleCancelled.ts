import type { SaleRecord } from './types';

/** Firestore soft-void flag on `sales` documents. */
export function isSaleCancelled(sale: { cancelled?: unknown } | null | undefined): boolean {
  if (!sale) return false;
  const c = sale.cancelled;
  return c === true || c === 'true';
}

/** Stable key for enquiry/visitor visit tied to an invoice (`enquiryVisitIndex`). */
export function enquiryVisitKey(
  enquiryId: string | undefined,
  visitorId: string | undefined,
  visitIndex: number | undefined,
): string | null {
  if (typeof visitIndex !== 'number' || visitIndex < 0) return null;
  const eid = (enquiryId || '').trim();
  const vid = (visitorId || '').trim();
  if (eid) return `e:${eid}:${visitIndex}`;
  if (vid) return `v:${vid}:${visitIndex}`;
  return null;
}

/** Visits voided by a cancelled invoice — exclude from sales/GST aggregates. */
export function buildVoidedEnquiryVisitKeys(sales: SaleRecord[]): Set<string> {
  const keys = new Set<string>();
  for (const s of sales) {
    if (!isSaleCancelled(s)) continue;
    const k = enquiryVisitKey(s.enquiryId, s.visitorId, s.enquiryVisitIndex);
    if (k) keys.add(k);
  }
  return keys;
}

/** Visits with a non-cancelled invoice in `sales` — enquiry visit rows must not double-count. */
export function buildActiveInvoicedEnquiryVisitKeys(sales: SaleRecord[]): Set<string> {
  const keys = new Set<string>();
  for (const s of sales) {
    if (isSaleCancelled(s)) continue;
    const k = enquiryVisitKey(s.enquiryId, s.visitorId, s.enquiryVisitIndex);
    if (k) keys.add(k);
  }
  return keys;
}

export function isDerivedEnquiryVisitExcludedFromSales(
  derived: { enquiryId?: string; visitorId?: string; visitIndex: number },
  voidedKeys: Set<string>,
  activeInvoicedKeys: Set<string>,
): boolean {
  const k = enquiryVisitKey(derived.enquiryId, derived.visitorId, derived.visitIndex);
  if (!k) return false;
  if (voidedKeys.has(k)) return true;
  if (activeInvoicedKeys.has(k)) return true;
  return false;
}
