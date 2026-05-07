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

export async function syncEnquiryVisitInvoiceNumberFromSale(args: {
  db: Firestore;
  enquiryId: string;
  visitIndex: number;
  invoiceNumber: string;
}) {
  const normalized = normalizeInvoiceNumberString(args.invoiceNumber);
  if (!saleHasBillableInvoiceNumber(normalized)) return;

  const enquiryRef = doc(args.db, 'enquiries', args.enquiryId);
  const enquirySnap = await getDoc(enquiryRef);
  if (!enquirySnap.exists()) return;

  const data = enquirySnap.data() as Record<string, unknown>;
  const visitsRaw = data.visits;
  if (!Array.isArray(visitsRaw)) return;
  const visit = visitsRaw[args.visitIndex] as Record<string, unknown> | undefined;
  if (!visit) return;
  if (normalizeInvoiceNumberString(visit.invoiceNumber) === normalized) return;

  const patchedVisits = [...visitsRaw];
  patchedVisits[args.visitIndex] = { ...visit, invoiceNumber: normalized };
  await updateDoc(enquiryRef, { visits: patchedVisits });
}
