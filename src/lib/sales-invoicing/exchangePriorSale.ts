import { doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
import { fetchSalesForEnquiryVisit } from '@/lib/sales-invoicing/enquiryVisitSaleDedupe';
import {
  readExchangeFieldsFromVisit,
  visitInvoiceNumberFromVisit,
} from '@/lib/sales-invoicing/enquiryVisitSaleMirror';
import { isSaleCancelled, normalizeEnquiryVisitIndex } from '@/lib/sales-invoicing/saleCancelled';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';

export type ExchangePriorInvoiceSuggestion = {
  upgradeVisitIndex: number;
  priorVisitIndex: number;
  priorVisitLabel: string;
  priorInvoiceNumber: string;
  priorSaleId?: string;
  priorSaleCancelled: boolean;
};

/** True when a later visit records exchange credit against this sale visit. */
export function isVisitReferencedByLaterExchange(visits: unknown[], visitIndex: number): boolean {
  const arr = Array.isArray(visits) ? visits : [];
  const want = normalizeEnquiryVisitIndex(visitIndex);
  for (let i = 0; i < arr.length; i++) {
    if (i === want) continue;
    const { exchangeCredit, exchangePriorVisitIndex } = readExchangeFieldsFromVisit(
      arr[i] as Record<string, unknown>,
    );
    if (exchangeCredit > 0 && exchangePriorVisitIndex === want) return true;
  }
  return false;
}

/** @deprecated Use `isVisitReferencedByLaterExchange` */
export const isVisitSupersededByLaterExchange = isVisitReferencedByLaterExchange;

export function buildExchangePriorInvoiceSuggestions(
  visits: unknown[],
): ExchangePriorInvoiceSuggestion[] {
  const arr = Array.isArray(visits) ? visits : [];
  const out: ExchangePriorInvoiceSuggestion[] = [];

  for (let upgradeIdx = 0; upgradeIdx < arr.length; upgradeIdx++) {
    const upgradeVisit = arr[upgradeIdx] as Record<string, unknown>;
    const { exchangeCredit, exchangePriorVisitIndex } = readExchangeFieldsFromVisit(upgradeVisit);
    if (exchangeCredit <= 0 || typeof exchangePriorVisitIndex !== 'number') continue;

    const priorVisit = arr[exchangePriorVisitIndex] as Record<string, unknown> | undefined;
    if (!priorVisit) continue;

    const priorInvoiceNumber = visitInvoiceNumberFromVisit(priorVisit);
    const linkedSaleId = String(
      priorVisit.linkedSaleId ??
        (priorVisit.hearingAidDetails as { linkedSaleId?: string } | undefined)?.linkedSaleId ??
        '',
    ).trim();

    out.push({
      upgradeVisitIndex: upgradeIdx,
      priorVisitIndex: exchangePriorVisitIndex,
      priorVisitLabel: `Visit ${exchangePriorVisitIndex + 1}`,
      priorInvoiceNumber: priorInvoiceNumber || '(not linked yet)',
      priorSaleId: linkedSaleId || undefined,
      priorSaleCancelled: Boolean(priorVisit.hearingAidSaleSuperseded),
    });
  }

  return out;
}

/**
 * Manual only — cancels active `sales` rows for a single prior visit index (strict match).
 * Does not use loose fingerprint matching.
 */
export async function cancelPriorVisitInvoicesForExchange(args: {
  db: Firestore;
  enquiryId: string;
  priorVisitIndex: number;
  actorUid?: string | null;
  supersededByVisitIndex: number;
}): Promise<{ cancelledIds: string[] }> {
  const visitIndex = normalizeEnquiryVisitIndex(args.priorVisitIndex);
  const sales = await fetchSalesForEnquiryVisit(args.db, args.enquiryId, visitIndex);
  const active = sales.filter((s) => !isSaleCancelled(s));
  const cancelledIds: string[] = [];

  for (const s of active) {
    if (!s.id) continue;
    if (normalizeEnquiryVisitIndex(s.enquiryVisitIndex) !== visitIndex) continue;
    await updateDoc(doc(args.db, 'sales', s.id), {
      cancelled: true,
      cancelledAt: serverTimestamp(),
      cancelledByUid: args.actorUid ?? null,
      cancelReason: `Prior sale voided for exchange (upgrade visit ${args.supersededByVisitIndex + 1})`,
      supersededByExchangeVisitIndex: args.supersededByVisitIndex,
      updatedAt: serverTimestamp(),
    });
    cancelledIds.push(s.id);
  }

  return { cancelledIds };
}

export function filterSalesForExchangeUpgradeVisit(
  sales: import('@/lib/sales-invoicing/types').SaleRecord[],
  visitIndex: number,
  visit: Record<string, unknown>,
): import('@/lib/sales-invoicing/types').SaleRecord[] {
  const wantIdx = normalizeEnquiryVisitIndex(visitIndex);
  const { exchangeCredit } = readExchangeFieldsFromVisit(visit);
  if (exchangeCredit <= 0) return sales;

  return sales.filter((s) => {
    if (isSaleCancelled(s)) return false;
    return normalizeEnquiryVisitIndex(s.enquiryVisitIndex) === wantIdx;
  });
}
