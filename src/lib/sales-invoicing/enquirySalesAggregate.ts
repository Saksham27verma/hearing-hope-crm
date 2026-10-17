/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Single source of truth for "sales" figures shown on the Dashboard (Sales & pipeline),
 * the Sales Report and the Incentive calculator.
 *
 * Rules:
 * - Invoiced sales from the `sales` collection only (enquiry visit sales are mirrored there).
 * - Must be linked to an enquiry (`enquiryId`). Direct / manual invoices created in
 *   Sales & Invoicing without an enquiry are excluded.
 * - Cancelled invoices, duplicate invoices for the same enquiry visit, and invoices whose
 *   enquiry visit was marked deleted are excluded (see `mapUnifiedRowsToRecords`).
 * - Amount = invoice face value (taxable + GST); date = sale date (IST-safe parsing).
 * - Salesperson = enquiry visit "Who Sold", else the invoice salesperson.
 */

import type { SaleRecord } from '@/lib/sales-invoicing/types';
import { buildUnifiedInvoiceRows } from '@/lib/sales-invoicing/mergeUnifiedRows';
import {
  type Center,
  type NormalizedSale,
  buildCenterResolveContext,
  mapUnifiedRowsToRecords,
} from '@/lib/sales-invoicing/salesReportNormalize';
import { saleMatchesDataScope } from '@/lib/tenant/centerScope';

export type EnquirySaleRecord = NormalizedSale & {
  sale: SaleRecord;
  enquiry: Record<string, unknown> | null;
};

export type SalesDataScope = {
  effectiveScopeCenterId: string | null;
  allowedCenterIds: string[] | null;
};

export function isEnquiryLinkedSale(sale: { enquiryId?: unknown } | null | undefined): boolean {
  return !!sale && String(sale.enquiryId ?? '').trim() !== '';
}

export function buildEnquirySaleRecords(args: {
  sales: SaleRecord[];
  enquiries: Array<{ id: string } & Record<string, any>>;
  centers?: Center[];
  scope?: SalesDataScope;
}): EnquirySaleRecord[] {
  const resolveCtx = buildCenterResolveContext(args.centers ?? []);
  const enquiryById = new Map<string, any>(args.enquiries.map((e) => [e.id, e]));
  const saleByRowId = new Map<string, SaleRecord>();
  for (const s of args.sales) {
    if (s.id) saleByRowId.set(`sale-${s.id}`, s);
  }

  const unified = buildUnifiedInvoiceRows(args.sales, []);
  const records = mapUnifiedRowsToRecords(unified, resolveCtx, enquiryById);

  const out: EnquirySaleRecord[] = [];
  for (const r of records) {
    const sale = saleByRowId.get(r.rowId);
    if (!sale || !isEnquiryLinkedSale(sale)) continue;
    if (
      args.scope &&
      !saleMatchesDataScope(
        sale as unknown as Record<string, unknown>,
        args.scope.effectiveScopeCenterId,
        args.scope.allowedCenterIds,
      )
    ) {
      continue;
    }
    const eid = String(sale.enquiryId).trim();
    out.push({ ...r, sale, enquiry: enquiryById.get(eid) ?? null });
  }
  return out;
}

/** Local calendar month bounds — same default range the Sales Report opens with. */
export function currentLocalMonthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function filterRecordsByDate<T extends { date: Date }>(
  records: T[],
  from: Date | null,
  to: Date | null,
): T[] {
  const a = from ? from.getTime() : -Infinity;
  const b = to ? to.getTime() : Infinity;
  return records.filter((r) => {
    const t = r.date.getTime();
    return t >= a && t <= b;
  });
}
