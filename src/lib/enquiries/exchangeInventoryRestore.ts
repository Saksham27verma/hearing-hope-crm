import { isInvoicableSaleVisit } from '@/lib/enquiries/salesReturnVisitTargets';
import type { SalesReturnRestoreRow } from '@/lib/enquiries/salesReturnVisitTargets';

function serialTokens(raw: string): string[] {
  const s = String(raw || '').trim();
  if (!s) return [];
  return s.split(/[,;|]+/).map((x) => x.trim()).filter(Boolean);
}

function priorVisitIndexFromExchangeVisit(visit: Record<string, unknown>): number | null {
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const credit =
    Number(visit.exchangeCreditAmount ?? details?.exchangeCreditAmount) || 0;
  if (credit <= 0) return null;
  const raw = visit.exchangePriorVisitIndex ?? details?.exchangePriorVisitIndex;
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * Serials from the prior sale visit that were traded in on an exchange — should return to stock.
 */
export function buildExchangeInventoryRestores(
  visits: unknown[],
  enquiryCenterFallback: string,
): SalesReturnRestoreRow[] {
  const arr = Array.isArray(visits) ? visits : [];
  const out: SalesReturnRestoreRow[] = [];

  for (let i = 0; i < arr.length; i++) {
    const visit = arr[i] as Record<string, unknown>;
    if (!isInvoicableSaleVisit(visit)) continue;
    const priorIdx = priorVisitIndexFromExchangeVisit(visit);
    if (priorIdx == null || priorIdx >= arr.length) continue;
    const priorVisit = arr[priorIdx] as Record<string, unknown>;
    if (!isInvoicableSaleVisit(priorVisit)) continue;

    const priorHad = priorVisit.hearingAidDetails as Record<string, unknown> | undefined;
    const prods = Array.isArray(priorVisit.products)
      ? priorVisit.products
      : Array.isArray(priorHad?.products)
        ? priorHad.products
        : [];
    const centerFromVisit = String(visit.centerId || priorVisit.centerId || '').trim();
    for (const p of prods) {
      const rec = p as Record<string, unknown>;
      const pid = String(rec.productId || rec.id || '').trim();
      const serialNumber = String(rec.serialNumber || '').trim();
      if (!pid || !serialNumber) continue;
      out.push({
        serialNumber,
        productId: pid,
        productName: String(rec.name || 'Product'),
        soldFromCenterId:
          String(rec.soldFromCenterId || '').trim() || centerFromVisit || enquiryCenterFallback,
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

/** Normalized serial tokens returned to stock via exchange (for availability maps). */
export function collectExchangeReturnedSerialNorms(visits: unknown[]): Set<string> {
  const rows = buildExchangeInventoryRestores(visits, '');
  const norms = new Set<string>();
  for (const r of rows) {
    serialTokens(r.serialNumber).forEach((t) => {
      const n = t.trim().toLowerCase();
      if (n) norms.add(n);
    });
  }
  return norms;
}
