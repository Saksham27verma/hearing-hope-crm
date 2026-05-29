import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';
import type { SaleRecord } from '@/lib/sales-invoicing/types';
import { enquiryVisitKey, isSaleCancelled } from '@/lib/sales-invoicing/saleCancelled';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';

function timestampScore(ts: { seconds?: number; nanoseconds?: number } | null | undefined): number {
  if (!ts || typeof ts.seconds !== 'number') return 0;
  return ts.seconds * 1_000_000_000 + (typeof ts.nanoseconds === 'number' ? ts.nanoseconds : 0);
}

/** Pick the single invoice row that should represent an enquiry visit in reports and UI. */
export function chooseCanonicalSaleRecord(sales: SaleRecord[]): SaleRecord | null {
  if (!sales.length) return null;
  const billable = sales.filter((s) => saleHasBillableInvoiceNumber(s.invoiceNumber));
  const pool = billable.length > 0 ? billable : sales;
  const sorted = [...pool].sort((a, b) => {
    const cancelRank = Number(isSaleCancelled(a)) - Number(isSaleCancelled(b));
    if (cancelRank !== 0) return cancelRank;
    const updated = timestampScore(b.updatedAt) - timestampScore(a.updatedAt);
    if (updated !== 0) return updated;
    const created = timestampScore(b.createdAt) - timestampScore(a.createdAt);
    if (created !== 0) return created;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  return sorted[0] ?? null;
}

export function buildCanonicalSaleIdByVisitKey(sales: SaleRecord[]): Map<string, string> {
  const groups = new Map<string, SaleRecord[]>();
  for (const s of sales) {
    const k = enquiryVisitKey(s.enquiryId, s.visitorId, s.enquiryVisitIndex);
    if (!k) continue;
    const prev = groups.get(k) || [];
    prev.push(s);
    groups.set(k, prev);
  }
  const out = new Map<string, string>();
  groups.forEach((arr, k) => {
    const chosen = chooseCanonicalSaleRecord(arr);
    if (chosen?.id) out.set(k, chosen.id);
  });
  return out;
}

export function isCanonicalSaleForVisit(
  sale: SaleRecord,
  canonicalIdByVisitKey: Map<string, string>,
): boolean {
  const k = enquiryVisitKey(sale.enquiryId, sale.visitorId, sale.enquiryVisitIndex);
  if (!k) return true;
  const canonicalId = canonicalIdByVisitKey.get(k);
  if (!canonicalId) return true;
  return sale.id === canonicalId;
}

export async function fetchSalesForEnquiryVisit(
  db: Firestore,
  enquiryId: string,
  visitIndex: number,
): Promise<SaleRecord[]> {
  const snap = await getDocs(
    query(
      collection(db, 'sales'),
      where('enquiryId', '==', enquiryId),
      where('enquiryVisitIndex', '==', visitIndex),
      limit(50),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as SaleRecord[];
}

/** Void duplicate `sales` docs so only one invoice exists per enquiry visit. */
export async function dedupeEnquiryVisitSales(
  db: Firestore,
  enquiryId: string,
  visitIndex: number,
  opts?: { actorUid?: string | null },
): Promise<{ keptId: string | null; voidedIds: string[] }> {
  const sales = await fetchSalesForEnquiryVisit(db, enquiryId, visitIndex);
  const chosen = chooseCanonicalSaleRecord(sales);
  if (!chosen?.id) return { keptId: null, voidedIds: [] };

  const voidedIds: string[] = [];
  for (const s of sales) {
    if (!s.id || s.id === chosen.id || isSaleCancelled(s)) continue;
    await updateDoc(doc(db, 'sales', s.id), {
      cancelled: true,
      cancelledAt: serverTimestamp(),
      cancelledByUid: opts?.actorUid ?? null,
      cancelReason: 'Duplicate invoice for same enquiry visit',
      updatedAt: serverTimestamp(),
    });
    voidedIds.push(s.id);
  }
  return { keptId: chosen.id, voidedIds };
}

export async function findExistingActiveSaleForVisit(
  db: Firestore,
  enquiryId: string,
  visitIndex: number,
): Promise<SaleRecord | null> {
  const sales = await fetchSalesForEnquiryVisit(db, enquiryId, visitIndex);
  const active = sales.filter((s) => !isSaleCancelled(s));
  return chooseCanonicalSaleRecord(active.length > 0 ? active : sales);
}
