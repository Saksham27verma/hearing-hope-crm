import { expandSalesReturnLinesFromVisit } from '@/utils/salesReturnFromVisit';
import { visitInvoiceNumberFromVisit, visitLinkedSaleIdFromVisit } from '@/lib/sales-invoicing/enquiryVisitSaleMirror';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';

export function isInvoicableSaleVisit(visit: Record<string, unknown> | undefined | null): boolean {
  if (!visit || typeof visit !== 'object') return false;
  return Boolean(
    visit.hearingAidSale || visit.purchaseFromTrial || visit.hearingAidStatus === 'sold'
  );
}

function serialTokens(raw: string): string[] {
  const s = String(raw || '').trim();
  if (!s) return [];
  return s.split(/[,;|]+/).map((x) => x.trim()).filter(Boolean);
}

function productSerialMatchesLine(productSerial: string, token: string): boolean {
  const norm = (x: string) => x.trim().toLowerCase();
  const t = norm(token);
  if (!t) return false;
  const pts = serialTokens(String(productSerial || ''));
  if (pts.length) return pts.some((p) => norm(p) === t);
  return norm(String(productSerial || '')) === t;
}

function collectTargetsFromOneReturnVisit(
  arr: Record<string, unknown>[],
  v: Record<string, unknown>,
  returnVisitIndex: number,
): Set<number> {
  const targets = new Set<number>();
  if (!v?.salesReturn) return targets;
  const lines = expandSalesReturnLinesFromVisit(
    v as Parameters<typeof expandSalesReturnLinesFromVisit>[0]
  );

  const idRaw = String(v.returnOriginalSaleVisitId || '').trim();
  if (idRaw !== '') {
    const n = parseInt(idRaw, 10);
    if (!Number.isNaN(n) && n >= 0 && n < arr.length) targets.add(n);
  }

  const items = Array.isArray(v.salesReturnItems) ? v.salesReturnItems : [];
  for (const it of items) {
    const rec = it as { visitIndex?: number };
    if (typeof rec.visitIndex === 'number' && rec.visitIndex >= 0 && rec.visitIndex < arr.length) {
      targets.add(rec.visitIndex);
    }
  }

  for (const line of lines) {
    if (typeof line.visitIndex === 'number' && line.visitIndex >= 0 && line.visitIndex < arr.length) {
      targets.add(line.visitIndex);
    }
    const tokens = serialTokens(line.serialNumber);
    const toScan = tokens.length ? tokens : line.serialNumber ? [String(line.serialNumber)] : [];
    // Only match sale visits that happened before this return — never a later re-sale of the same serial.
    const scanUntil = Number.isFinite(returnVisitIndex) ? Math.min(returnVisitIndex, arr.length) : arr.length;
    for (const tok of toScan) {
      for (let j = 0; j < scanUntil; j++) {
        const ov = arr[j] as Record<string, unknown>;
        if (!isInvoicableSaleVisit(ov)) continue;
        const prods = Array.isArray(ov.products) ? ov.products : [];
        for (const p of prods) {
          const rec = p as Record<string, unknown>;
          if (productSerialMatchesLine(String(rec.serialNumber || ''), tok)) targets.add(j);
        }
      }
    }
  }

  return targets;
}

/** Visit indices (0-based) whose mirrored `sales` row must be voided due to an active sales return. */
export function collectSaleVisitIndicesVoidedByReturns(visits: unknown[]): number[] {
  const targets = new Set<number>();
  const arr = Array.isArray(visits) ? (visits as Record<string, unknown>[]) : [];

  for (let i = 0; i < arr.length; i++) {
    for (const idx of collectTargetsFromOneReturnVisit(arr, arr[i], i)) targets.add(idx);
  }

  return [...targets].sort((a, b) => a - b);
}

export type SalesReturnInvoicePreview = {
  visitIndex: number;
  visitNumber: number;
  invoiceNumber: string;
  linkedSaleId: string;
  serialNumbers: string[];
};

/** Invoices that will be cancelled if this return visit is saved — for the enquiry form alert. */
export function previewInvoicesCancelledByReturnVisit(
  visits: unknown[],
  returnVisit: Record<string, unknown> | undefined | null,
  returnVisitIndex?: number,
): SalesReturnInvoicePreview[] {
  if (!returnVisit?.salesReturn) return [];
  const arr = Array.isArray(visits) ? (visits as Record<string, unknown>[]) : [];
  const idx =
    typeof returnVisitIndex === 'number' && returnVisitIndex >= 0
      ? returnVisitIndex
      : arr.indexOf(returnVisit);
  const indices = collectTargetsFromOneReturnVisit(arr, returnVisit, idx < 0 ? arr.length : idx);
  const serialsByVisit = new Map<number, string[]>();
  const items = Array.isArray(returnVisit.salesReturnItems) ? returnVisit.salesReturnItems : [];
  for (const it of items) {
    const rec = it as { visitIndex?: number; serialNumber?: string };
    const idx = typeof rec.visitIndex === 'number' ? rec.visitIndex : undefined;
    const sn = String(rec.serialNumber || '').trim();
    if (idx == null || !sn) continue;
    const prev = serialsByVisit.get(idx) || [];
    prev.push(sn);
    serialsByVisit.set(idx, prev);
  }

  const out: SalesReturnInvoicePreview[] = [];
  for (const visitIndex of [...indices].sort((a, b) => a - b)) {
    const saleVisit = arr[visitIndex];
    if (!saleVisit) continue;
    const invoiceNumber = normalizeInvoiceNumberString(visitInvoiceNumberFromVisit(saleVisit));
    const linkedSaleId = visitLinkedSaleIdFromVisit(saleVisit);
    out.push({
      visitIndex,
      visitNumber: visitIndex + 1,
      invoiceNumber: saleHasBillableInvoiceNumber(invoiceNumber) ? invoiceNumber : '',
      linkedSaleId,
      serialNumbers: serialsByVisit.get(visitIndex) || [],
    });
  }
  return out;
}

export type SalesReturnRestoreRow = {
  /** Serial as stored on the sale line (may be pair "A, B"). */
  serialNumber: string;
  productId: string;
  productName: string;
  /** Firestore centers doc id */
  soldFromCenterId: string;
};

function findSaleProductForReturnLine(
  visits: unknown[],
  line: { serialNumber: string; visitIndex?: number },
  returnOriginalSaleVisitId: string
): { visitIndex: number; product: Record<string, unknown> } | null {
  const arr = Array.isArray(visits) ? visits : [];
  const candSet = new Set<number>();
  const idRaw = String(returnOriginalSaleVisitId || '').trim();
  if (idRaw !== '') {
    const n = parseInt(idRaw, 10);
    if (!Number.isNaN(n) && n >= 0 && n < arr.length) candSet.add(n);
  }
  if (typeof line.visitIndex === 'number' && line.visitIndex >= 0 && line.visitIndex < arr.length) {
    candSet.add(line.visitIndex);
  }
  const candidates = [...candSet];
  const tokens = serialTokens(line.serialNumber);
  const toScan = tokens.length ? tokens : line.serialNumber ? [String(line.serialNumber)] : [];

  for (const j of candidates) {
    const ov = arr[j] as Record<string, unknown>;
    if (!isInvoicableSaleVisit(ov)) continue;
    const prods = Array.isArray(ov.products) ? ov.products : [];
    for (const p of prods) {
      const rec = p as Record<string, unknown>;
      for (const tok of toScan) {
        if (productSerialMatchesLine(String(rec.serialNumber || ''), tok)) {
          return { visitIndex: j, product: rec };
        }
      }
    }
  }

  for (let j = 0; j < arr.length; j++) {
    const ov = arr[j] as Record<string, unknown>;
    if (!isInvoicableSaleVisit(ov)) continue;
    const prods = Array.isArray(ov.products) ? ov.products : [];
    for (const p of prods) {
      const rec = p as Record<string, unknown>;
      for (const tok of toScan) {
        if (productSerialMatchesLine(String(rec.serialNumber || ''), tok)) {
          return { visitIndex: j, product: rec };
        }
      }
    }
  }
  return null;
}

/** Rows to restore into `materialInward` for current enquiry visits with sales return. */
export function buildSalesReturnInventoryRestores(
  visits: unknown[],
  enquiryCenterFallback: string
): SalesReturnRestoreRow[] {
  const out: SalesReturnRestoreRow[] = [];
  const arr = Array.isArray(visits) ? visits : [];

  for (const v of arr) {
    const visit = v as Record<string, unknown>;
    if (!visit?.salesReturn) continue;
    const lines = expandSalesReturnLinesFromVisit(
      visit as Parameters<typeof expandSalesReturnLinesFromVisit>[0]
    );
    const origId = String(visit.returnOriginalSaleVisitId || '').trim();
    for (const line of lines) {
      const hit = findSaleProductForReturnLine(arr, line, origId);
      if (!hit) continue;
      const pid = String(hit.product.productId || '').trim();
      if (!pid) continue;
      const saleVisit = arr[hit.visitIndex] as Record<string, unknown>;
      const centerFromLine = String(hit.product.soldFromCenterId || '').trim();
      const centerFromVisit = String(saleVisit?.centerId || '').trim();
      const serialNumber = String(line.serialNumber || hit.product.serialNumber || '').trim();
      if (!serialNumber) continue;
      out.push({
        serialNumber,
        productId: pid,
        productName: String(hit.product.name || 'Product'),
        soldFromCenterId: centerFromLine || centerFromVisit || enquiryCenterFallback,
      });
    }
  }
  const seen = new Set<string>();
  const dedup: SalesReturnRestoreRow[] = [];
  for (const r of out) {
    const k = `${r.productId}::${r.serialNumber.trim().toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(r);
  }
  return dedup;
}
