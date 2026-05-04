import { expandSalesReturnLinesFromVisit } from '@/utils/salesReturnFromVisit';

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

/** Visit indices (0-based) whose mirrored `sales` row must be voided due to an active sales return. */
export function collectSaleVisitIndicesVoidedByReturns(visits: unknown[]): number[] {
  const targets = new Set<number>();
  const arr = Array.isArray(visits) ? visits : [];

  for (let i = 0; i < arr.length; i++) {
    const v = arr[i] as Record<string, unknown>;
    if (!v?.salesReturn) continue;
    const lines = expandSalesReturnLinesFromVisit(
      v as Parameters<typeof expandSalesReturnLinesFromVisit>[0]
    );
    if (lines.length === 0) continue;

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
      const tokens = serialTokens(line.serialNumber);
      const toScan = tokens.length ? tokens : line.serialNumber ? [String(line.serialNumber)] : [];
      for (const tok of toScan) {
        for (let j = 0; j < arr.length; j++) {
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
  }

  return [...targets].sort((a, b) => a - b);
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
