import {
  collection,
  doc,
  getDoc,
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
import {
  enquiryVisitKey,
  isSaleCancelled,
  normalizeEnquiryVisitIndex,
} from '@/lib/sales-invoicing/saleCancelled';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';
import { notifyLifecycleSaleSync } from '@/lib/lifecycle/notifyLifecycleSaleSync';
import { filterSalesForExchangeUpgradeVisit } from '@/lib/sales-invoicing/exchangePriorSale';
import {
  collectVisitSaleClaims,
  isInvoiceOwnedByAnotherVisit,
  isSaleOwnedByAnotherVisit,
} from '@/lib/sales-invoicing/visitSaleClaims';
import {
  productSerialSetFromVisit,
  productSerialsOverlap,
  readExchangeFieldsFromVisit,
  saleLooselyMatchesEnquiryVisit,
  saleRecordMatchesVisitMirror,
  visitInvoiceNumberFromVisit,
  visitLinkedSaleIdFromVisit,
} from '@/lib/sales-invoicing/enquiryVisitSaleMirror';

function timestampScore(ts: { seconds?: number; nanoseconds?: number } | null | undefined): number {
  if (!ts || typeof ts.seconds !== 'number') return 0;
  return ts.seconds * 1_000_000_000 + (typeof ts.nanoseconds === 'number' ? ts.nanoseconds : 0);
}

function mergeSalesById(...groups: SaleRecord[][]): SaleRecord[] {
  const map = new Map<string, SaleRecord>();
  for (const group of groups) {
    for (const s of group) {
      if (s.id) map.set(s.id, s);
    }
  }
  return Array.from(map.values());
}

function collectInvoiceCandidates(
  visit: Record<string, unknown>,
  extra: unknown[] = [],
  isForeign: (invoiceNumber: string) => boolean = () => false,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: unknown) => {
    const n = normalizeInvoiceNumberString(raw);
    if (!saleHasBillableInvoiceNumber(n) || seen.has(n) || isForeign(n)) return;
    seen.add(n);
    out.push(n);
  };
  add(visitInvoiceNumberFromVisit(visit));
  for (const raw of extra) add(raw);
  return out;
}

function hasStoredVisitIndex(sale: SaleRecord): boolean {
  const raw: unknown = sale.enquiryVisitIndex;
  if (raw === null || raw === undefined) return false;
  return String(raw).trim() !== '';
}

/** Heuristic matches (serials, totals) may only use rows for this visit index or legacy rows without one. */
function saleMayBelongToVisitIndex(sale: SaleRecord, wantIdx: number): boolean {
  return !hasStoredVisitIndex(sale) || normalizeEnquiryVisitIndex(sale.enquiryVisitIndex) === wantIdx;
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

export async function fetchAllSalesForEnquiry(db: Firestore, enquiryId: string): Promise<SaleRecord[]> {
  const snap = await getDocs(
    query(collection(db, 'sales'), where('enquiryId', '==', enquiryId), limit(100)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as SaleRecord[];
}

export async function fetchSalesForEnquiryVisit(
  db: Firestore,
  enquiryId: string,
  visitIndex: number,
): Promise<SaleRecord[]> {
  const wantIdx = normalizeEnquiryVisitIndex(visitIndex);
  const all = await fetchAllSalesForEnquiry(db, enquiryId);
  return all.filter((s) => normalizeEnquiryVisitIndex(s.enquiryVisitIndex) === wantIdx);
}

export async function fetchSalesByInvoiceNumbers(
  db: Firestore,
  invoiceNumbers: string[],
): Promise<SaleRecord[]> {
  const groups: SaleRecord[][] = [];
  for (const inv of invoiceNumbers) {
    if (!saleHasBillableInvoiceNumber(inv)) continue;
    const snap = await getDocs(
      query(collection(db, 'sales'), where('invoiceNumber', '==', inv), limit(50)),
    );
    groups.push(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as SaleRecord[]);
  }
  return mergeSalesById(...groups);
}

async function loadLinkedSaleRecord(
  db: Firestore,
  linkedId: string,
  enquirySales: SaleRecord[],
): Promise<SaleRecord | null> {
  const fromEnquiry = enquirySales.find((s) => s.id === linkedId);
  if (fromEnquiry) return fromEnquiry;
  try {
    const snap = await getDoc(doc(db, 'sales', linkedId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as object) } as SaleRecord;
  } catch {
    return null;
  }
}

/**
 * Pure merge of every `sales` row that could belong to this enquiry visit.
 * Used by lookup and by unit tests (no Firestore).
 */
export function mergeEnquiryVisitSaleCandidates(args: {
  visitIndex: number;
  visit: Record<string, unknown>;
  enquiry: Record<string, unknown>;
  enquirySales: SaleRecord[];
  linkedSale?: SaleRecord | null;
  globalInvoiceSales?: SaleRecord[];
  priorVisitInvoice?: unknown;
}): SaleRecord[] {
  const wantIdx = normalizeEnquiryVisitIndex(args.visitIndex);
  const active = args.enquirySales.filter((s) => !isSaleCancelled(s));
  // Invoices already issued to other visits of this enquiry are never candidates for this one.
  const claims = collectVisitSaleClaims(args.enquiry?.visits);
  const ownedElsewhere = (s: SaleRecord) => isSaleOwnedByAnotherVisit(claims, s, wantIdx);

  const linkedParts: SaleRecord[] = [];
  if (args.linkedSale && !isSaleCancelled(args.linkedSale)) {
    linkedParts.push(args.linkedSale);
  }

  const byIndex = active.filter((s) => normalizeEnquiryVisitIndex(s.enquiryVisitIndex) === wantIdx);

  const invoiceNums = collectInvoiceCandidates(args.visit, [args.priorVisitInvoice], (inv) =>
    isInvoiceOwnedByAnotherVisit(claims, inv, wantIdx),
  );
  const byInvoice = invoiceNums.flatMap((inv) =>
    active.filter((s) => normalizeInvoiceNumberString(s.invoiceNumber) === inv),
  );
  const globalInvoice = (args.globalInvoiceSales || []).filter(
    (s) => !isSaleCancelled(s) && invoiceNums.includes(normalizeInvoiceNumberString(s.invoiceNumber)),
  );

  const visitSerials = productSerialSetFromVisit(args.visit);
  const bySerials =
    visitSerials.size > 0
      ? active.filter(
          (s) => saleMayBelongToVisitIndex(s, wantIdx) && productSerialsOverlap(visitSerials, s.products),
        )
      : [];

  const { exchangeCredit } = readExchangeFieldsFromVisit(args.visit);
  const byExchange =
    exchangeCredit > 0
      ? active.filter((s) => {
          if (normalizeEnquiryVisitIndex(s.enquiryVisitIndex) !== wantIdx) return false;
          return Math.max(0, Number(s.exchangeCreditInr) || 0) > 0;
        })
      : [];

  const byFingerprint = active.filter((s) =>
    saleRecordMatchesVisitMirror(s, args.visit, args.enquiry, args.visitIndex),
  );

  const byLoose = active.filter((s) =>
    saleLooselyMatchesEnquiryVisit(s, args.visit, args.visitIndex),
  );

  const merged = mergeSalesById(
    linkedParts,
    byIndex,
    byInvoice,
    globalInvoice,
    bySerials,
    byExchange,
    byFingerprint,
    byLoose,
  ).filter((s) => !ownedElsewhere(s));
  return filterSalesForExchangeUpgradeVisit(merged, args.visitIndex, args.visit);
}

/**
 * Find every `sales` row that could belong to this enquiry visit (index, invoice #, serials, exchange, fingerprint).
 * Honors `linkedSaleId` even when `enquiryVisitIndex` is missing, and looks up invoice numbers globally
 * so legacy sales without `enquiryId` are still reused instead of duplicated.
 */
export async function findSalesForEnquiryVisitMirror(
  db: Firestore,
  enquiryId: string,
  visitIndex: number,
  visit: Record<string, unknown>,
  enquiry: Record<string, unknown>,
  opts?: { priorVisitInvoice?: unknown },
): Promise<SaleRecord[]> {
  const all = await fetchAllSalesForEnquiry(db, enquiryId);

  const linkedId = visitLinkedSaleIdFromVisit(visit);
  const linkedSale = linkedId ? await loadLinkedSaleRecord(db, linkedId, all) : null;

  const claims = collectVisitSaleClaims(enquiry?.visits);
  const wantIdx = normalizeEnquiryVisitIndex(visitIndex);
  const invoiceNums = collectInvoiceCandidates(visit, [opts?.priorVisitInvoice], (inv) =>
    isInvoiceOwnedByAnotherVisit(claims, inv, wantIdx),
  );
  // Same invoice # on another patient's sale must never be pulled in; only legacy rows with no link.
  const globalInvoiceSales = (await fetchSalesByInvoiceNumbers(db, invoiceNums)).filter((s) => {
    const eid = String(s.enquiryId || '').trim();
    if (eid) return eid === enquiryId;
    return !String(s.visitorId || '').trim();
  });

  return mergeEnquiryVisitSaleCandidates({
    visitIndex,
    visit,
    enquiry,
    enquirySales: all,
    linkedSale,
    globalInvoiceSales,
    priorVisitInvoice: opts?.priorVisitInvoice,
  });
}

/** Void duplicate `sales` docs so only one invoice exists per enquiry visit. */
export async function dedupeEnquiryVisitSales(
  db: Firestore,
  enquiryId: string,
  visitIndex: number,
  opts?: {
    actorUid?: string | null;
    visit?: Record<string, unknown>;
    enquiry?: Record<string, unknown>;
    priorVisitInvoice?: unknown;
  },
): Promise<{ keptId: string | null; voidedIds: string[] }> {
  const sales =
    opts?.visit && opts?.enquiry
      ? await findSalesForEnquiryVisitMirror(
          db,
          enquiryId,
          visitIndex,
          opts.visit,
          opts.enquiry,
          { priorVisitInvoice: opts.priorVisitInvoice },
        )
      : await fetchSalesForEnquiryVisit(db, enquiryId, visitIndex);
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
  visit?: Record<string, unknown>,
  enquiry?: Record<string, unknown>,
): Promise<SaleRecord | null> {
  const sales =
    visit && enquiry
      ? await findSalesForEnquiryVisitMirror(db, enquiryId, visitIndex, visit, enquiry)
      : await fetchSalesForEnquiryVisit(db, enquiryId, visitIndex);
  const active = sales.filter((s) => !isSaleCancelled(s));
  return chooseCanonicalSaleRecord(active.length > 0 ? active : sales);
}

/** Soft-cancel every active invoice for a sale visit that a sales return is voiding. */
export async function cancelActiveSalesForEnquiryVisitReturn(args: {
  db: Firestore;
  enquiryId: string;
  visitIndex: number;
  visit: Record<string, unknown>;
  enquiry: Record<string, unknown>;
  actorUid?: string | null;
}): Promise<{ cancelledIds: string[] }> {
  const mirrored = await findSalesForEnquiryVisitMirror(
    args.db,
    args.enquiryId,
    args.visitIndex,
    args.visit,
    args.enquiry,
  );
  const claims = collectVisitSaleClaims(args.enquiry?.visits);
  const wantIdx = normalizeEnquiryVisitIndex(args.visitIndex);
  const byIndex = (await fetchSalesForEnquiryVisit(args.db, args.enquiryId, args.visitIndex)).filter(
    (s) => !isSaleOwnedByAnotherVisit(claims, s, wantIdx),
  );
  const sales = mergeSalesById(mirrored, byIndex);
  const cancelledIds: string[] = [];
  for (const s of sales) {
    if (!s.id || isSaleCancelled(s)) continue;
    await updateDoc(doc(args.db, 'sales', s.id), {
      cancelled: true,
      cancelledAt: serverTimestamp(),
      cancelledByUid: args.actorUid ?? null,
      cancelReason: 'Sales return',
      updatedAt: serverTimestamp(),
    });
    cancelledIds.push(s.id);
    notifyLifecycleSaleSync(s.id);
  }
  return { cancelledIds };
}
