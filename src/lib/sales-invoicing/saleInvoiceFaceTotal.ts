import type { SaleRecord } from './types';

/**
 * Tax invoice face value: taxable amount + GST from stored sale fields (always gross of trade-in).
 * Firestore `grandTotal` is net payable when `exchangeCreditInr` is set — do not use it for invoice totals.
 */
export function saleInvoiceFaceTotal(s: Pick<SaleRecord, 'totalAmount' | 'gstAmount' | 'grandTotal'>): number {
  const fromParts = Math.round((Number(s.totalAmount) || 0) + (Number(s.gstAmount) || 0));
  if (fromParts > 0) return fromParts;
  const g = s.grandTotal;
  if (typeof g === 'number' && !Number.isNaN(g)) return Math.round(g);
  return 0;
}

/**
 * Grand total printed on PDF/HTML invoice — must match line items + GST (patient profile / enquiry path).
 * When the sale is netted for exchange, `sale.grandTotal` is net; pass line-computed total to recover gross.
 */
export function resolveInvoicePdfGrandTotal(
  sale: {
    totalAmount?: unknown;
    gstAmount?: unknown;
    grandTotal?: unknown;
    exchangeCreditInr?: unknown;
  },
  lineComputedGrand: number
): number {
  const ex = Math.max(0, Number(sale.exchangeCreditInr) || 0);
  const fromParts = Math.round((Number(sale.totalAmount) || 0) + (Number(sale.gstAmount) || 0));
  const lines = Math.round(lineComputedGrand);

  if (ex > 0) {
    if (fromParts > 0) return fromParts;
    if (lines > 0) return lines;
    const net = Number(sale.grandTotal);
    if (!Number.isNaN(net)) return Math.round(net + ex);
    return 0;
  }

  const stored = sale.grandTotal;
  if (typeof stored === 'number' && !Number.isNaN(stored)) return Math.round(stored);
  if (fromParts > 0) return fromParts;
  return lines;
}
