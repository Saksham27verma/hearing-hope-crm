import type { SaleRecord } from './types';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';

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

/** User deleted the invoice from Sales & Invoicing — exclude visit from revenue / uninvoiced rows. */
export function isVisitSaleInvoiceDeleted(visit: Record<string, unknown> | null | undefined): boolean {
  if (!visit || typeof visit !== 'object') return false;
  return visit.saleInvoiceDeleted === true || visit.saleInvoiceDeleted === 'true';
}

/** Visit still stores an invoice # after the `sales` doc was deleted or voided. */
export function visitHasBillableInvoiceNumber(visit: Record<string, unknown> | null | undefined): boolean {
  if (!visit || typeof visit !== 'object') return false;
  const raw =
    visit.invoiceNumber ?? visit.salesInvoiceNumber ?? visit.salesInvoiceNo ?? visit.invoiceNo;
  return saleHasBillableInvoiceNumber(raw);
}

/**
 * Exclude enquiry visit rows from sales aggregates when voided, already invoiced,
 * or the visit still references an invoice whose `sales` doc was removed.
 */
export function isDerivedEnquiryVisitExcludedFromSales(
  derived: { enquiryId?: string; visitorId?: string; visitIndex: number },
  voidedKeys: Set<string>,
  activeInvoicedKeys: Set<string>,
  visit?: Record<string, unknown> | null,
): boolean {
  if (isVisitSaleInvoiceDeleted(visit)) return true;
  const k = enquiryVisitKey(derived.enquiryId, derived.visitorId, derived.visitIndex);
  if (k && voidedKeys.has(k)) return true;
  if (k && activeInvoicedKeys.has(k)) return true;
  if (visitHasBillableInvoiceNumber(visit)) {
    if (!k || !activeInvoicedKeys.has(k)) return true;
  }
  return false;
}
