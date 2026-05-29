import { doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
import {
  chooseCanonicalSaleRecord,
  findSalesForEnquiryVisitMirror,
} from '@/lib/sales-invoicing/enquiryVisitSaleDedupe';
import {
  readExchangeFieldsFromVisit,
  visitInvoiceNumberFromVisit,
} from '@/lib/sales-invoicing/enquiryVisitSaleMirror';
import { isSaleCancelled, normalizeEnquiryVisitIndex } from '@/lib/sales-invoicing/saleCancelled';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';

/** True when a later visit exchanges against this sale visit. */
export function isVisitSupersededByLaterExchange(visits: unknown[], visitIndex: number): boolean {
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

/** Visits that are exchange upgrades (credit from a prior sale visit). */
export function collectExchangeUpgradeVisitIndices(visits: unknown[]): number[] {
  const arr = Array.isArray(visits) ? visits : [];
  const out: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const { exchangeCredit, exchangePriorVisitIndex } = readExchangeFieldsFromVisit(
      arr[i] as Record<string, unknown>,
    );
    if (exchangeCredit > 0 && typeof exchangePriorVisitIndex === 'number') {
      out.push(i);
    }
  }
  return out;
}

export function patchVisitAsExchangeSuperseded(
  visit: Record<string, unknown>,
  supersededByVisitIndex: number,
): Record<string, unknown> {
  const had = (visit.hearingAidDetails as Record<string, unknown> | undefined) || {};
  return {
    ...visit,
    hearingAidSaleSuperseded: true,
    supersededByExchangeVisitIndex: supersededByVisitIndex,
    hearingAidDetails: {
      ...had,
      hearingAidSaleSuperseded: true,
      supersededByExchangeVisitIndex: supersededByVisitIndex,
    },
  };
}

/**
 * Void mirrored `sales` rows for a visit replaced by an exchange upgrade.
 */
export async function cancelEnquiryVisitSalesSupersededByExchange(args: {
  db: Firestore;
  enquiryId: string;
  visitIndex: number;
  priorVisit: Record<string, unknown>;
  enquiry: Record<string, unknown>;
  actorUid?: string | null;
  supersededByVisitIndex: number;
}): Promise<{ cancelledIds: string[] }> {
  const visitIndex = normalizeEnquiryVisitIndex(args.visitIndex);
  const sales = await findSalesForEnquiryVisitMirror(
    args.db,
    args.enquiryId,
    visitIndex,
    args.priorVisit,
    args.enquiry,
    { priorVisitInvoice: visitInvoiceNumberFromVisit(args.priorVisit) },
  );
  const active = sales.filter((s) => !isSaleCancelled(s));
  const cancelledIds: string[] = [];

  for (const s of active) {
    if (!s.id) continue;
    await updateDoc(doc(args.db, 'sales', s.id), {
      cancelled: true,
      cancelledAt: serverTimestamp(),
      cancelledByUid: args.actorUid ?? null,
      cancelReason: `Superseded by exchange sale (visit ${args.supersededByVisitIndex + 1})`,
      supersededByExchangeVisitIndex: args.supersededByVisitIndex,
      updatedAt: serverTimestamp(),
    });
    cancelledIds.push(s.id);
  }

  if (cancelledIds.length > 0) {
    const inv = normalizeInvoiceNumberString(
      chooseCanonicalSaleRecord(sales)?.invoiceNumber,
    );
    const { clearEnquiryVisitInvoiceNumberOnSaleDelete } = await import(
      '@/lib/sales-invoicing/enquiryVisitInvoiceSync'
    );
    await clearEnquiryVisitInvoiceNumberOnSaleDelete({
      db: args.db,
      enquiryId: args.enquiryId,
      visitIndex,
      invoiceNumber: inv,
    });
  }

  return { cancelledIds };
}

/** After an exchange sale is saved, ensure the prior visit invoice is voided. */
export async function applyExchangePriorSaleCancellation(args: {
  db: Firestore;
  enquiryId: string;
  visits: Record<string, unknown>[];
  enquiry: Record<string, unknown>;
  actorUid?: string | null;
}): Promise<{ priorVisitIndex: number; cancelledIds: string[] }[]> {
  const results: { priorVisitIndex: number; cancelledIds: string[] }[] = [];

  for (const upgradeIdx of collectExchangeUpgradeVisitIndices(args.visits)) {
    const upgradeVisit = args.visits[upgradeIdx] as Record<string, unknown>;
    const { exchangePriorVisitIndex } = readExchangeFieldsFromVisit(upgradeVisit);
    if (typeof exchangePriorVisitIndex !== 'number') continue;

    const priorVisit = args.visits[exchangePriorVisitIndex] as Record<string, unknown> | undefined;
    if (!priorVisit) continue;

    const { cancelledIds } = await cancelEnquiryVisitSalesSupersededByExchange({
      db: args.db,
      enquiryId: args.enquiryId,
      visitIndex: exchangePriorVisitIndex,
      priorVisit,
      enquiry: args.enquiry,
      actorUid: args.actorUid,
      supersededByVisitIndex: upgradeIdx,
    });

    args.visits[exchangePriorVisitIndex] = patchVisitAsExchangeSuperseded(
      priorVisit,
      upgradeIdx,
    );
    results.push({ priorVisitIndex: exchangePriorVisitIndex, cancelledIds });
  }

  return results;
}

/** Sales lookup for an exchange upgrade visit — never attach to the prior visit's invoice. */
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
