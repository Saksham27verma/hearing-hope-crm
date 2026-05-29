import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  type Firestore,
  updateDoc,
  where,
} from 'firebase/firestore';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';

type SaleLike = {
  id: string;
  invoiceNumber?: unknown;
  cancelled?: boolean;
  updatedAt?: { seconds?: number; nanoseconds?: number } | null;
  createdAt?: { seconds?: number; nanoseconds?: number } | null;
};

function timestampScore(ts: SaleLike['updatedAt'] | SaleLike['createdAt']): number {
  if (!ts || typeof ts.seconds !== 'number') return 0;
  return ts.seconds * 1_000_000_000 + (typeof ts.nanoseconds === 'number' ? ts.nanoseconds : 0);
}

function chooseCanonicalSaleForVisit(sales: SaleLike[]): SaleLike | null {
  const billable = sales.filter((s) => saleHasBillableInvoiceNumber(s.invoiceNumber));
  if (billable.length === 0) return null;
  billable.sort((a, b) => {
    const cancelRank = Number(Boolean(a.cancelled)) - Number(Boolean(b.cancelled));
    if (cancelRank !== 0) return cancelRank;
    const updated = timestampScore(b.updatedAt) - timestampScore(a.updatedAt);
    if (updated !== 0) return updated;
    const created = timestampScore(b.createdAt) - timestampScore(a.createdAt);
    if (created !== 0) return created;
    return a.id.localeCompare(b.id);
  });
  return billable[0] ?? null;
}

function patchVisitWithSaleLink(
  visit: Record<string, unknown>,
  saleId: string,
  invoiceNumber: string,
): Record<string, unknown> {
  const had = (visit.hearingAidDetails as Record<string, unknown> | undefined) || {};
  return {
    ...visit,
    invoiceNumber,
    linkedSaleId: saleId,
    saleInvoiceDeleted: false,
    hearingAidDetails: {
      ...had,
      invoiceNumber,
      linkedSaleId: saleId,
    },
  };
}

function visitNeedsSaleLinkPatch(
  visit: Record<string, unknown>,
  saleId: string,
  invoiceNumber: string,
): boolean {
  const inv = normalizeInvoiceNumberString(visit.invoiceNumber);
  const linked = String(visit.linkedSaleId || '').trim();
  const had = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const hadInv = normalizeInvoiceNumberString(had?.invoiceNumber);
  const hadLinked = String(had?.linkedSaleId || '').trim();
  return inv !== invoiceNumber || linked !== saleId || hadInv !== invoiceNumber || hadLinked !== saleId;
}

export async function getCanonicalInvoiceNumberForEnquiryVisit(
  db: Firestore,
  enquiryId: string,
  visitIndex: number,
): Promise<{ invoiceNumber: string; saleId?: string }> {
  const salesSnap = await getDocs(
    query(
      collection(db, 'sales'),
      where('enquiryId', '==', enquiryId),
      where('enquiryVisitIndex', '==', visitIndex),
      limit(25),
    ),
  );
  const sales = salesSnap.docs.map((saleDoc) => ({
    id: saleDoc.id,
    ...(saleDoc.data() as Omit<SaleLike, 'id'>),
  }));
  const chosen = chooseCanonicalSaleForVisit(sales);
  const invoiceNumber = normalizeInvoiceNumberString(chosen?.invoiceNumber);
  return saleHasBillableInvoiceNumber(invoiceNumber)
    ? { invoiceNumber, saleId: chosen?.id }
    : { invoiceNumber: '' };
}

/** Persist invoice # and `linkedSaleId` on enquiry `visits` and `visitSchedules`. */
export async function syncEnquiryVisitSaleLinkFromSale(args: {
  db: Firestore;
  enquiryId: string;
  visitIndex: number;
  saleId: string;
  invoiceNumber: string;
}) {
  const normalized = normalizeInvoiceNumberString(args.invoiceNumber);
  const saleId = String(args.saleId || '').trim();
  if (!saleHasBillableInvoiceNumber(normalized) || !saleId) return;

  const enquiryRef = doc(args.db, 'enquiries', args.enquiryId);
  const enquirySnap = await getDoc(enquiryRef);
  if (!enquirySnap.exists()) return;

  const data = enquirySnap.data() as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  const visitsRaw = data.visits;
  if (Array.isArray(visitsRaw)) {
    const visit = visitsRaw[args.visitIndex] as Record<string, unknown> | undefined;
    if (visit && visitNeedsSaleLinkPatch(visit, saleId, normalized)) {
      const patchedVisits = [...visitsRaw];
      patchedVisits[args.visitIndex] = patchVisitWithSaleLink(visit, saleId, normalized);
      patch.visits = patchedVisits;
    }
  }

  const schedulesRaw = data.visitSchedules;
  if (Array.isArray(schedulesRaw)) {
    const sched = schedulesRaw[args.visitIndex] as Record<string, unknown> | undefined;
    if (sched && visitNeedsSaleLinkPatch(sched, saleId, normalized)) {
      const patchedSchedules = [...schedulesRaw];
      patchedSchedules[args.visitIndex] = patchVisitWithSaleLink(sched, saleId, normalized);
      patch.visitSchedules = patchedSchedules;
    }
  }

  if (Object.keys(patch).length > 0) {
    await updateDoc(enquiryRef, patch);
  }
}

/** @deprecated Use `syncEnquiryVisitSaleLinkFromSale` */
export async function syncEnquiryVisitInvoiceNumberFromSale(args: {
  db: Firestore;
  enquiryId: string;
  visitIndex: number;
  invoiceNumber: string;
}) {
  const normalized = normalizeInvoiceNumberString(args.invoiceNumber);
  if (!saleHasBillableInvoiceNumber(normalized)) return;
  const { saleId } = await getCanonicalInvoiceNumberForEnquiryVisit(
    args.db,
    args.enquiryId,
    args.visitIndex,
  );
  if (!saleId) return;
  await syncEnquiryVisitSaleLinkFromSale({
    db: args.db,
    enquiryId: args.enquiryId,
    visitIndex: args.visitIndex,
    saleId,
    invoiceNumber: normalized,
  });
}

/** After a `sales` doc is deleted, drop the mirrored invoice # so reports do not treat the visit as uninvoiced. */
export async function clearEnquiryVisitInvoiceNumberOnSaleDelete(args: {
  db: Firestore;
  enquiryId: string;
  visitIndex: number;
  invoiceNumber?: string;
}) {
  const enquiryRef = doc(args.db, 'enquiries', args.enquiryId);
  const enquirySnap = await getDoc(enquiryRef);
  if (!enquirySnap.exists()) return;

  const data = enquirySnap.data() as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  const clearVisit = (visit: Record<string, unknown>) => {
    const normalizedTarget = normalizeInvoiceNumberString(args.invoiceNumber);
    const onVisit = normalizeInvoiceNumberString(visit.invoiceNumber);
    if (normalizedTarget && onVisit && onVisit !== normalizedTarget) return visit;

    const nextVisit = { ...visit };
    delete nextVisit.invoiceNumber;
    delete nextVisit.salesInvoiceNumber;
    delete nextVisit.salesInvoiceNo;
    delete nextVisit.invoiceNo;
    delete nextVisit.linkedSaleId;
    nextVisit.saleInvoiceDeleted = true;
    const had = { ...((nextVisit.hearingAidDetails as Record<string, unknown>) || {}) };
    delete had.invoiceNumber;
    delete had.linkedSaleId;
    nextVisit.hearingAidDetails = had;
    return nextVisit;
  };

  const visitsRaw = data.visits;
  if (Array.isArray(visitsRaw)) {
    const visit = visitsRaw[args.visitIndex] as Record<string, unknown> | undefined;
    if (visit) {
      const patchedVisits = [...visitsRaw];
      patchedVisits[args.visitIndex] = clearVisit(visit);
      patch.visits = patchedVisits;
    }
  }

  const schedulesRaw = data.visitSchedules;
  if (Array.isArray(schedulesRaw)) {
    const sched = schedulesRaw[args.visitIndex] as Record<string, unknown> | undefined;
    if (sched) {
      const patchedSchedules = [...schedulesRaw];
      patchedSchedules[args.visitIndex] = clearVisit(sched);
      patch.visitSchedules = patchedSchedules;
    }
  }

  if (Object.keys(patch).length > 0) {
    await updateDoc(enquiryRef, patch);
  }
}
