import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';
import { allocateNextInvoiceNumber } from '@/services/invoiceNumbering';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';

const DEFAULT_ALLOCATION_RETRY_LIMIT = 5;

interface ResolveEnquirySaleInvoiceNumberArgs {
  db: Firestore;
  existingVisitInvoice?: unknown;
  existingSalesInvoice?: unknown;
  priorVisitInvoice?: unknown;
  currentSaleId?: string;
  allocationRetryLimit?: number;
}

async function hasDuplicateInvoiceNumber(
  db: Firestore,
  invoiceNumber: string,
  currentSaleId?: string,
): Promise<boolean> {
  const dupSnap = await getDocs(
    query(collection(db, 'sales'), where('invoiceNumber', '==', invoiceNumber), limit(50)),
  );
  return dupSnap.docs.some((d) => d.id !== currentSaleId);
}

export function collectCandidateInvoiceNumbers(values: unknown[]): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];

  values.forEach((value) => {
    const normalized = normalizeInvoiceNumberString(value);
    if (!saleHasBillableInvoiceNumber(normalized) || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  });

  return candidates;
}

/** Allocate only when this visit has no invoice yet and is not updating an existing sale. */
export function shouldAllocateNewInvoiceNumber(args: {
  currentSaleId?: string;
  candidateInvoiceNumbers: string[];
}): boolean {
  if (args.currentSaleId) return false;
  return args.candidateInvoiceNumbers.length === 0;
}

export async function resolveEnquirySaleInvoiceNumber({
  db,
  existingVisitInvoice,
  existingSalesInvoice,
  priorVisitInvoice,
  currentSaleId,
  allocationRetryLimit = DEFAULT_ALLOCATION_RETRY_LIMIT,
}: ResolveEnquirySaleInvoiceNumberArgs): Promise<string> {
  const invoiceCandidates = collectCandidateInvoiceNumbers([
    existingSalesInvoice,
    existingVisitInvoice,
    priorVisitInvoice,
  ]);

  // Updating an existing sale row, or the visit already carries an invoice #:
  // never allocate a new number — that existing number IS this visit's invoice.
  if (!shouldAllocateNewInvoiceNumber({ currentSaleId, candidateInvoiceNumbers: invoiceCandidates })) {
    if (invoiceCandidates.length > 0) return invoiceCandidates[0];

    if (currentSaleId) {
      const snap = await getDoc(doc(db, 'sales', currentSaleId));
      const fromDoc = normalizeInvoiceNumberString(snap.data()?.invoiceNumber);
      if (saleHasBillableInvoiceNumber(fromDoc)) return fromDoc;
      throw new Error('Existing sale is missing a billable invoice number.');
    }
  }

  const attempts = Math.max(1, Math.floor(allocationRetryLimit));
  for (let attempt = 0; attempt < attempts; attempt++) {
    const allocated = normalizeInvoiceNumberString(await allocateNextInvoiceNumber(db));
    if (!saleHasBillableInvoiceNumber(allocated)) continue;
    const isDuplicate = await hasDuplicateInvoiceNumber(db, allocated, currentSaleId);
    if (!isDuplicate) return allocated;
  }

  throw new Error('Could not allocate a unique invoice number. Please retry.');
}
