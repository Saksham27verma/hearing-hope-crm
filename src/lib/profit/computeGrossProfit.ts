/**
 * Gross-profit computation that exactly mirrors ProfitReportTab.tsx.
 *
 * Reuses the same shared lib functions (enquiryDerivation, mergeUnifiedRows,
 * salesReportNormalize) so the number shown here is bit-for-bit identical to
 * the "Profit" total in Reports → Profit Analysis.
 */

import { deriveEnquirySalesFromDocs } from '@/lib/sales-invoicing/enquiryDerivation';
import { buildUnifiedInvoiceRows } from '@/lib/sales-invoicing/mergeUnifiedRows';
import {
  buildCenterResolveContext,
  getProductLinesForUnifiedRow,
  mapUnifiedRowsToRecords,
  type Center,
} from '@/lib/sales-invoicing/salesReportNormalize';
import type { SaleRecord } from '@/lib/sales-invoicing/types';

// ── Serial-matching helpers (identical to ProfitReportTab internals) ─────────

const HEAR_DOT_COM_COST_RATE = 0.21;

function isHearDotComReference(key: string, label: string): boolean {
  const n = (v: string) =>
    String(v || '').toLowerCase().replace(/^ref:/, '').replace(/[^a-z0-9]+/g, '');
  return n(key) === 'hearcom' || n(label) === 'hearcom';
}

function normalizeSerial(s: unknown): string {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}

function splitSerialCandidates(raw: unknown): string[] {
  if (Array.isArray(raw))
    return raw.map((v) => normalizeSerial(String(v || ''))).filter(Boolean);
  const text = String(raw || '').trim();
  if (!text) return [];
  return text.split(/[,\n;|]+/g).map((v) => normalizeSerial(v)).filter(Boolean);
}

function serialCandidatesFromProduct(p: Record<string, unknown>): string[] {
  const all: string[] = [];
  if (Array.isArray(p.serialNumbers)) all.push(...splitSerialCandidates(p.serialNumbers));
  for (const key of [
    'serialNumber', 'trialSerialNumber', 'serialNo',
    'serial_no', 'deviceSerial', 'hearingAidSerial',
  ]) {
    all.push(...splitSerialCandidates(p[key]));
  }
  return [...new Set(all.filter(Boolean))];
}

function uniqueProductIdsFromLine(p: Record<string, unknown>): string[] {
  return [
    ...new Set(
      [p.productId, p.id, p.hearingAidProductId]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean),
    ),
  ];
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function unitsForLineSplit(p: Record<string, unknown>, serials: string[]): number {
  const q = Math.round(safeNum(p.quantity)) || 0;
  const n = serials.length;
  return Math.max(n, q >= 1 ? q : 0, 1);
}

function perUnitPreTaxSelling(p: Record<string, unknown>, serials: string[]): number {
  const lineTotal = safeNum(p.sellingPrice ?? p.finalAmount ?? p.amount ?? 0);
  return lineTotal / unitsForLineSplit(p, serials);
}

function perSerialDealerCost(p: Record<string, unknown>, serials: string[]): number {
  const dealerPerUnit = safeNum(p.dealerPrice ?? p.finalPrice ?? p.purchasePrice ?? 0);
  const quantity = Math.round(safeNum(p.quantity)) || 1;
  const lineTotal = dealerPerUnit * Math.max(quantity, 1);
  return lineTotal / unitsForLineSplit(p, serials);
}

type CostSource = 'materialInward' | 'purchase';

type CostLine = {
  source: CostSource;
  sourceDocId: string;
  sourceNumber: string;
  productId: string;
  serial: string;
  dealerPrice: number;
  entryDate: Date;
};

function tsToDate(t: unknown): Date {
  if (!t) return new Date(0);
  if (typeof t === 'object' && t !== null && 'toDate' in t)
    return (t as { toDate(): Date }).toDate();
  if (typeof t === 'string') {
    const d = new Date(t);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  if (typeof t === 'number') return new Date(t);
  return new Date(0);
}

function dedupeCostEntries(entries: CostLine[]): CostLine[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const k = `${e.source}:${e.sourceDocId}:${e.productId}:${e.serial}:${e.dealerPrice}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function pickPreferredCostLine(entries: CostLine[]): CostLine | undefined {
  const unique = dedupeCostEntries(entries);
  if (!unique.length) return undefined;
  if (unique.length === 1) return unique[0];
  const purchases = unique.filter((e) => e.source === 'purchase');
  const pool = purchases.length ? purchases : unique;
  return pool.sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())[0];
}

function collapseCostLineMap(map: Map<string, CostLine[]>): Map<string, CostLine> {
  const out = new Map<string, CostLine>();
  map.forEach((arr, key) => {
    const picked = pickPreferredCostLine(arr);
    if (picked) out.set(key, picked);
  });
  return out;
}

// ── Public types ─────────────────────────────────────────────────────────────

export type RawDoc = { id: string } & Record<string, unknown>;

export type GrossProfitResult = {
  /** Serial-level profit = selling − dealer (same as Profit Analysis Report) */
  profitTotal: number;
  /** Pre-tax serial-level selling (resolved serials only) */
  sellingTotal: number;
  /** Total matched dealer costs */
  dealerCostTotal: number;
  /** Sum of invoice grand totals (informational, includes GST) */
  grossRevenue: number;
  resolvedCount: number;
  unresolvedCount: number;
  unresolvedSellingValue: number;
  /** Per-sale rows for the breakdown Revenue section */
  saleRows: Array<{
    id: string;
    date: string;
    clientName: string;
    invoiceRef: string | null;
    centerName: string | undefined;
    grandTotal: number;
  }>;
};

// ── Main function ─────────────────────────────────────────────────────────────

export function computeGrossProfit(params: {
  salesRawDocs: RawDoc[];
  enquiryRawDocs: RawDoc[];
  centresRawDocs: RawDoc[];
  materialRawDocs: RawDoc[];
  purchasesRawDocs: RawDoc[];
  dateFrom: Date;
  dateTo: Date;
}): GrossProfitResult {
  const { salesRawDocs, enquiryRawDocs, centresRawDocs, materialRawDocs, purchasesRawDocs, dateFrom, dateTo } = params;

  // ── Build center context (for mapUnifiedRowsToRecords) ──
  const centersList: Center[] = centresRawDocs.map((d) => ({ id: d.id, ...d }));
  const resolveCtx = buildCenterResolveContext(centersList);

  // ── Build unified sale rows (direct + enquiry-derived) ──
  const saleRecords = salesRawDocs as unknown as SaleRecord[];
  const derived = deriveEnquirySalesFromDocs(enquiryRawDocs, 'enquiry');
  const unified = buildUnifiedInvoiceRows(saleRecords, derived);

  const enquiryById = new Map<string, unknown>(enquiryRawDocs.map((e) => [e.id, e]));
  const normalizedRecords = mapUnifiedRowsToRecords(unified, resolveCtx, enquiryById as Map<string, unknown>);
  const unifiedByRowId = new Map(unified.map((r) => [r.rowId, r]));

  // ── Build serial → dealer-cost maps ──
  const byProductSerial = new Map<string, CostLine[]>();
  const bySerialOnly = new Map<string, CostLine[]>();

  function registerLine(entry: CostLine, p: Record<string, unknown>) {
    for (const pid of uniqueProductIdsFromLine(p)) {
      const k = `${pid}|${entry.serial}`;
      const arr = byProductSerial.get(k) ?? [];
      arr.push(entry);
      byProductSerial.set(k, arr);
    }
    const arr2 = bySerialOnly.get(entry.serial) ?? [];
    arr2.push(entry);
    bySerialOnly.set(entry.serial, arr2);
  }

  function processInboundDocs(docs: RawDoc[], source: CostSource) {
    for (const docSnap of docs) {
      const products = Array.isArray(docSnap.products)
        ? (docSnap.products as Record<string, unknown>[])
        : [];
      const sourceNumber = String(
        source === 'purchase' ? (docSnap.invoiceNo ?? '') : (docSnap.challanNumber ?? ''),
      );
      const rawDate =
        source === 'purchase'
          ? (docSnap.purchaseDate ?? docSnap.createdAt)
          : (docSnap.receivedDate ?? docSnap.createdAt);
      const entryDate = tsToDate(rawDate);

      for (const raw of products) {
        const p = raw as Record<string, unknown>;
        const serials = serialCandidatesFromProduct(p);
        if (!serials.length) continue;
        const dealer = perSerialDealerCost(p, serials);
        const primaryPid = String(
          p.productId ?? p.id ?? p.hearingAidProductId ?? '',
        ).trim();

        for (const serial of serials) {
          registerLine(
            {
              source,
              sourceDocId: docSnap.id,
              sourceNumber,
              productId: primaryPid,
              serial,
              dealerPrice: dealer,
              entryDate,
            },
            p,
          );
        }
      }
    }
  }

  processInboundDocs(materialRawDocs, 'materialInward');
  processInboundDocs(purchasesRawDocs, 'purchase');

  const costByProductSerial = collapseCostLineMap(byProductSerial);
  const costBySerialOnly = collapseCostLineMap(bySerialOnly);

  // ── Compute serial-level profit (identical to ProfitReportTab) ──
  let profitTotal = 0;
  let sellingTotal = 0;
  let dealerCostTotal = 0;
  let resolvedCount = 0;
  let unresolvedCount = 0;
  let unresolvedSellingValue = 0;
  let grossRevenue = 0;

  const saleRows: GrossProfitResult['saleRows'] = [];

  function inRange(d: Date): boolean {
    const t = d.getTime();
    return t >= dateFrom.getTime() && t <= dateTo.getTime();
  }

  for (const rec of normalizedRecords) {
    if (!inRange(rec.date)) continue;

    grossRevenue += rec.total;

    // Add revenue row for breakdown table
    saleRows.push({
      id: rec.rowId,
      date: rec.date.toISOString().slice(0, 10),
      clientName: rec.patientName,
      invoiceRef: rec.invoiceNumber,
      centerName: rec.centerName === '—' ? undefined : rec.centerName,
      grandTotal: rec.total,
    });

    const row = unifiedByRowId.get(rec.rowId);
    if (!row) continue;

    const products = getProductLinesForUnifiedRow(row);

    for (let pIndex = 0; pIndex < products.length; pIndex++) {
      const product = products[pIndex];
      const serials = serialCandidatesFromProduct(product);
      if (!serials.length) continue;

      const productIdsToTry = uniqueProductIdsFromLine(product);
      const perSerialSelling = perUnitPreTaxSelling(product, serials);

      for (let sIndex = 0; sIndex < serials.length; sIndex++) {
        const serial = serials[sIndex];

        // Hear.com special case: fixed 21% profit share
        if (isHearDotComReference(rec.referenceKey, rec.referenceLabel)) {
          const profit = perSerialSelling * HEAR_DOT_COM_COST_RATE;
          const dealer = perSerialSelling - profit;
          profitTotal += profit;
          sellingTotal += perSerialSelling;
          dealerCostTotal += dealer;
          resolvedCount++;
          continue;
        }

        // Try product+serial match first
        let resolved: CostLine | undefined;
        for (const pid of productIdsToTry) {
          const hit = costByProductSerial.get(`${pid}|${serial}`);
          if (hit) { resolved = hit; break; }
        }
        // Fallback: serial only
        if (!resolved) {
          resolved = costBySerialOnly.get(serial);
        }

        if (resolved) {
          profitTotal += perSerialSelling - resolved.dealerPrice;
          sellingTotal += perSerialSelling;
          dealerCostTotal += resolved.dealerPrice;
          resolvedCount++;
        } else {
          unresolvedCount++;
          unresolvedSellingValue += perSerialSelling;
        }
      }
    }
  }

  return {
    profitTotal,
    sellingTotal,
    dealerCostTotal,
    grossRevenue,
    resolvedCount,
    unresolvedCount,
    unresolvedSellingValue,
    saleRows,
  };
}
