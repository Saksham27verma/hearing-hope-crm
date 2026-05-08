/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared rules for Sales Report + Profit Report: same unified rows → same normalized sale rows.
 * Product lines: `sale.products` or legacy `sale.items` (matches inventory / older saves).
 */

import type { Timestamp } from 'firebase/firestore';
import type { SaleRecord, UnifiedInvoiceRow } from '@/lib/sales-invoicing/types';
import { saleInvoiceFaceTotal } from '@/lib/sales-invoicing/saleInvoiceFaceTotal';

export type NormalizedSale = {
  rowId: string;
  recordKind: 'invoiced' | 'uninvoiced';
  invoiceNumber: string | null;
  date: Date;
  patientName: string;
  enquiryId?: string;
  centerId: string;
  centerName: string;
  centerKey: string;
  executiveName: string;
  subtotal: number;
  gstAmount: number;
  total: number;
  discountMrpBasis: number;
  discountOffMrp: number;
  referenceKey: string;
  referenceLabel: string;
};

export type Center = {
  id: string;
  name?: string;
  isHeadOffice?: boolean;
  /** Extra labels on some Firestore center docs — all are indexed for matching. */
  displayName?: string;
  centerName?: string;
  title?: string;
  label?: string;
};

const LEGACY_INVENTORY_BRANCHES = new Set([
  'main branch',
  'north branch',
  'south branch',
  'east branch',
  'west branch',
]);

function baseCenterMatchKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+(center|centre|c\.?tr\.?|branch)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip UI suffixes like "Green Park (HDIPL)" so branch strings match center names. */
function normalizeBranchOrCenterLabel(raw: string): string {
  return String(raw || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** All human-readable labels we index for a center document (name / displayName / etc.). */
function centerNameVariants(c: Center): string[] {
  const candidates = [c.name, c.displayName, c.centerName, c.title, c.label]
    .map((x) => (x != null && String(x).trim() !== '' ? String(x).trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(candidates));
}

export type CenterResolveContext = {
  idToName: Map<string, string>;
  nameLowerToId: Map<string, string>;
  baseKeyToId: Map<string, string>;
  headOfficeId: string | null;
};

export function buildCenterResolveContext(centers: Center[]): CenterResolveContext {
  const idToName = new Map<string, string>();
  const nameLowerToId = new Map<string, string>();
  const baseKeyToId = new Map<string, string>();

  centers.forEach((c) => {
    const variants = centerNameVariants(c);
    const label = variants[0] || c.id;
    idToName.set(c.id, label);
    variants.forEach((v) => {
      const low = v.toLowerCase();
      if (low && !nameLowerToId.has(low)) nameLowerToId.set(low, c.id);
      const bk = baseCenterMatchKey(v);
      if (bk && !baseKeyToId.has(bk)) baseKeyToId.set(bk, c.id);
    });
  });

  const headOfficeId = centers.find((c) => !!c.isHeadOffice)?.id ?? null;
  return { idToName, nameLowerToId, baseKeyToId, headOfficeId };
}

export function resolveCenter(
  rawCenterId: string | undefined,
  branchOrName: string,
  ctx: CenterResolveContext,
): { centerKey: string; centerId: string; centerName: string } {
  const id = (rawCenterId || '').toString().trim();
  if (id && ctx.idToName.has(id)) {
    const label = ctx.idToName.get(id)!;
    return { centerKey: id, centerId: id, centerName: label };
  }

  /** If branch is empty, reuse `id` — enquiry.center / legacy rows often store a name in the id slot. */
  const branch = normalizeBranchOrCenterLabel((branchOrName || '').toString().trim() || id);
  const lower = branch.toLowerCase();

  if (LEGACY_INVENTORY_BRANCHES.has(lower) && ctx.headOfficeId && ctx.idToName.has(ctx.headOfficeId)) {
    const hid = ctx.headOfficeId;
    const label = ctx.idToName.get(hid)!;
    return { centerKey: hid, centerId: hid, centerName: label };
  }

  if (lower && ctx.nameLowerToId.has(lower)) {
    const cid = ctx.nameLowerToId.get(lower)!;
    const label = ctx.idToName.get(cid)!;
    return { centerKey: cid, centerId: cid, centerName: label };
  }

  const bk = baseCenterMatchKey(branch);
  if (bk && ctx.baseKeyToId.has(bk)) {
    const cid = ctx.baseKeyToId.get(bk)!;
    const label = ctx.idToName.get(cid)!;
    return { centerKey: cid, centerId: cid, centerName: label };
  }

  if (!branch) {
    return { centerKey: '__unassigned__', centerId: '', centerName: '—' };
  }
  const slug = lower.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unknown';
  return {
    centerKey: `__orphan__:${slug}`,
    centerId: '',
    centerName: branch,
  };
}

function tsToDate(t: Timestamp | undefined): Date {
  if (!t) return new Date();
  return t.toDate ? t.toDate() : new Date();
}

export function saleGrandTotalRecord(s: SaleRecord): number {
  return saleInvoiceFaceTotal(s);
}

/** Catalog / invoice lines: prefer `products`, else legacy `items` (same as inventory sale reads). */
export function getSaleProductLines(s: SaleRecord): unknown[] {
  const products = s.products;
  const items = (s as SaleRecord & { items?: unknown[] }).items;
  if (Array.isArray(products) && products.length > 0) return products;
  if (Array.isArray(items) && items.length > 0) return items;
  return [];
}

export function getProductLinesForUnifiedRow(row: UnifiedInvoiceRow | null | undefined): Record<string, unknown>[] {
  if (!row) return [];
  if (row.kind === 'saved' && row.savedSale) {
    return getSaleProductLines(row.savedSale) as Record<string, unknown>[];
  }
  if (row.kind === 'enquiry_pending' && row.derivedEnquiry) {
    const d = row.derivedEnquiry;
    return Array.isArray(d.products) ? (d.products as Record<string, unknown>[]) : [];
  }
  return [];
}

export function resolveVisitAtIndex(e: any, index: number): any {
  if (!e || typeof index !== 'number' || index < 0) return {};
  const visits: any[] = Array.isArray(e.visits) ? e.visits : [];
  const v = visits[index];
  if (v && typeof v === 'object') return v;
  const sched: any[] = Array.isArray(e.visitSchedules) ? e.visitSchedules : [];
  const s = sched[index];
  return s && typeof s === 'object' ? s : {};
}

export function getWhoSoldFromVisit(visit: any): string {
  if (!visit || typeof visit !== 'object') return '';
  const nested = String(visit.hearingAidDetails?.whoSold || '').trim();
  const flat = String(visit.hearingAidBrand || '').trim();
  return nested || flat || '';
}

function aggregateDiscountFromProductLines(products: unknown[] | undefined): { mrpSum: number; discountSum: number } {
  let mrpSum = 0;
  let discountSum = 0;
  if (!Array.isArray(products)) return { mrpSum, discountSum };
  for (const raw of products) {
    const p = raw as Record<string, unknown>;
    const mrp = Number(p.mrp) || 0;
    if (mrp <= 0) continue;
    const selling = Number(p.sellingPrice ?? p.finalAmount ?? 0) || 0;
    const explicit = Number(p.discount);
    let off = 0;
    if (Number.isFinite(explicit) && explicit >= 0) {
      off = Math.min(explicit, mrp);
    } else {
      const dp = Number(p.discountPercent);
      if (Number.isFinite(dp) && dp >= 0 && dp <= 100) {
        off = Math.min(mrp, (mrp * dp) / 100);
      } else {
        off = Math.max(0, mrp - selling);
      }
    }
    mrpSum += mrp;
    discountSum += off;
  }
  return { mrpSum, discountSum };
}

function humanizeReferenceLabel(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '—';
  return s
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function resolveReferenceSource(
  enquiry: any,
  sale: SaleRecord | null,
): { key: string; label: string } {
  const refs = Array.isArray(enquiry?.reference)
    ? enquiry.reference
    : enquiry?.reference != null && String(enquiry.reference).trim() !== ''
      ? [enquiry.reference]
      : [];
  const refStrs = refs.map((x: unknown) => String(x).trim()).filter(Boolean);
  if (refStrs.length > 0) {
    const primary = refStrs[0];
    const key = `ref:${primary.toLowerCase()}`;
    return { key, label: humanizeReferenceLabel(primary) };
  }
  const doc = sale && String(sale.referenceDoctor?.name || '').trim();
  if (doc) {
    const key = `doc:${doc.toLowerCase()}`;
    return { key, label: `Doctor: ${doc}` };
  }
  if (sale && !sale.enquiryId) {
    return { key: 'direct', label: 'Direct / manual' };
  }
  if (sale?.source === 'manual') {
    return { key: 'direct', label: 'Direct / manual' };
  }
  return { key: '__unspecified__', label: 'Unspecified' };
}

function getSalespersonNameFromSaleDoc(s: SaleRecord): string {
  const sp = (s as any).salesperson;
  if (typeof sp === 'string' && sp.trim()) return sp.trim();
  if (sp && typeof sp === 'object' && typeof sp.name === 'string' && sp.name.trim()) return sp.name.trim();
  const sn = (s as any).salespersonName;
  if (typeof sn === 'string' && sn.trim()) return sn.trim();
  const staffName = (s as any).staffName;
  if (typeof staffName === 'string' && staffName.trim()) return staffName.trim();
  return '';
}

export function mapUnifiedRowsToRecords(
  unified: UnifiedInvoiceRow[],
  resolveCtx: CenterResolveContext,
  enquiryById: Map<string, any>,
): NormalizedSale[] {
  const out: NormalizedSale[] = [];

  for (const r of unified) {
    if (r.kind === 'saved' && r.savedSale) {
      if (r.isCancelled) continue;
      const s = r.savedSale;
      if (s.cancelled) continue;
      const date = tsToDate(s.saleDate);
      const branch = (s.branch || '').toString();
      const eid = s.enquiryId != null ? String(s.enquiryId) : '';
      const vIdx = s.enquiryVisitIndex;
      const enq = eid ? enquiryById.get(eid) : undefined;
      const visit = enq && typeof vIdx === 'number' ? resolveVisitAtIndex(enq, vIdx) : {};
      const visitAny = visit as Record<string, unknown>;
      const enqAny = enq as Record<string, unknown> | undefined;
      const centerFallback = String(
        visitAny.centerId || enqAny?.visitingCenter || enqAny?.center || '',
      ).trim();
      const branchForResolve = branch.trim() || centerFallback;
      const rc = resolveCenter(
        (s.centerId || '').toString().trim() || undefined,
        branchForResolve,
        resolveCtx,
      );
      let exec = getSalespersonNameFromSaleDoc(s);
      if (eid && typeof vIdx === 'number') {
        const fromVisit = getWhoSoldFromVisit(visit);
        if (fromVisit) exec = fromVisit;
      }
      if (!exec) exec = '—';
      const productLines = getSaleProductLines(s);
      const discAgg = aggregateDiscountFromProductLines(productLines);
      const refSrc = resolveReferenceSource(enq, s);
      out.push({
        rowId: r.rowId,
        recordKind: 'invoiced',
        invoiceNumber: s.invoiceNumber || null,
        date,
        patientName: (s.patientName || '—').toString(),
        enquiryId: s.enquiryId ? String(s.enquiryId) : undefined,
        centerId: rc.centerId,
        centerName: rc.centerName,
        centerKey: rc.centerKey,
        executiveName: String(exec),
        subtotal: Number(s.totalAmount || 0),
        gstAmount: Number(s.gstAmount || 0),
        total: saleGrandTotalRecord(s),
        discountMrpBasis: discAgg.mrpSum,
        discountOffMrp: discAgg.discountSum,
        referenceKey: refSrc.key,
        referenceLabel: refSrc.label,
      });
      continue;
    }

    if (r.kind === 'enquiry_pending' && r.derivedEnquiry) {
      const d = r.derivedEnquiry;
      const e = d.enquiryId ? enquiryById.get(d.enquiryId) : undefined;
      const visit = e ? resolveVisitAtIndex(e, d.visitIndex) : {};
      const date = tsToDate(d.visitDate);
      const visitAny = visit as Record<string, unknown>;
      const enqAny = e as Record<string, unknown> | undefined;
      const rawCenter = String(
        visitAny.centerId || enqAny?.visitingCenter || enqAny?.center || '',
      ).trim();
      const rc = resolveCenter(rawCenter || undefined, rawCenter || '', resolveCtx);
      const exec =
        String(d.whoSoldName || '').trim() ||
        getWhoSoldFromVisit(visit) ||
        String(e?.assignedTo || '').trim() ||
        '—';
      const gst = Number(d.gstAmount || 0);
      const total =
        typeof d.grandTotal === 'number' && d.grandTotal > 0
          ? Number(d.grandTotal)
          : Number(d.totalAmount || 0);
      const subtotal = Math.max(0, total - gst);
      const discAgg = aggregateDiscountFromProductLines(d.products as unknown[]);
      const refSrc = resolveReferenceSource(e, null);

      out.push({
        rowId: r.rowId,
        recordKind: 'uninvoiced',
        invoiceNumber: null,
        date,
        patientName: (d.patientName || '—').toString(),
        enquiryId: d.enquiryId ? String(d.enquiryId) : undefined,
        centerId: rc.centerId,
        centerName: rc.centerName,
        centerKey: rc.centerKey,
        executiveName: String(exec),
        subtotal,
        gstAmount: gst,
        total,
        discountMrpBasis: discAgg.mrpSum,
        discountOffMrp: discAgg.discountSum,
        referenceKey: refSrc.key,
        referenceLabel: refSrc.label,
      });
    }
  }

  return out.sort((a, b) => b.date.getTime() - a.date.getTime());
}
