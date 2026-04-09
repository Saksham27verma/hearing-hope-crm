import {
  collection,
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
  currentSaleId?: string
): Promise<boolean> {
  const dupSnap = await getDocs(
    query(collection(db, 'sales'), where('invoiceNumber', '==', invoiceNumber), limit(50))
  );
  return dupSnap.docs.some((d) => d.id !== currentSaleId);
}

function collectCandidateInvoiceNumbers(values: unknown[]): string[] {
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

export async function resolveEnquirySaleInvoiceNumber({
  db,
  existingVisitInvoice,
  existingSalesInvoice,
  priorVisitInvoice,
  currentSaleId,
  allocationRetryLimit = DEFAULT_ALLOCATION_RETRY_LIMIT,
}: ResolveEnquirySaleInvoiceNumberArgs): Promise<string> {
  const invoiceCandidates = collectCandidateInvoiceNumbers([
    existingVisitInvoice,
    existingSalesInvoice,
    priorVisitInvoice,
  ]);

  for (const candidate of invoiceCandidates) {
    const isDuplicate = await hasDuplicateInvoiceNumber(db, candidate, currentSaleId);
    if (!isDuplicate) return candidate;
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
