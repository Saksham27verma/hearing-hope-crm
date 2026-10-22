import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';
import {
  visitInvoiceNumberFromVisit,
  visitLinkedSaleIdFromVisit,
} from '@/lib/sales-invoicing/enquiryVisitSaleMirror';

/**
 * Which visit of an enquiry already "owns" a sale doc / invoice number.
 *
 * One invoice per sale visit: when a patient comes back months later, saving the new visit must
 * never reuse, overwrite or void the invoice of an earlier visit. Older data can have the same
 * invoice copied onto two visits; the earliest visit keeps it (that is where it was first issued).
 */
export type VisitSaleClaim = {
  visitIndex: number;
  saleId: string;
  invoiceNumber: string;
};

export function collectVisitSaleClaims(visits: unknown): VisitSaleClaim[] {
  if (!Array.isArray(visits)) return [];
  const out: VisitSaleClaim[] = [];
  visits.forEach((raw, visitIndex) => {
    if (!raw || typeof raw !== 'object') return;
    const visit = raw as Record<string, unknown>;
    const saleId = visitLinkedSaleIdFromVisit(visit);
    const inv = visitInvoiceNumberFromVisit(visit);
    const invoiceNumber = saleHasBillableInvoiceNumber(inv) ? inv : '';
    if (saleId || invoiceNumber) out.push({ visitIndex, saleId, invoiceNumber });
  });
  return out;
}

/** Earliest visit index that claims this sale (by linked id or invoice #), or null when unclaimed. */
export function ownerVisitIndexForSale(
  claims: VisitSaleClaim[],
  sale: { id?: string; invoiceNumber?: unknown },
): number | null {
  const id = String(sale.id || '').trim();
  const inv = normalizeInvoiceNumberString(sale.invoiceNumber);
  let owner: number | null = null;
  for (const c of claims) {
    const hit = (id && c.saleId === id) || (inv && c.invoiceNumber === inv);
    if (hit && (owner === null || c.visitIndex < owner)) owner = c.visitIndex;
  }
  return owner;
}

export function isSaleOwnedByAnotherVisit(
  claims: VisitSaleClaim[],
  sale: { id?: string; invoiceNumber?: unknown },
  visitIndex: number,
): boolean {
  const owner = ownerVisitIndexForSale(claims, sale);
  return owner !== null && owner !== visitIndex;
}

/** Invoice # already issued to an earlier/other visit of this enquiry. */
export function isInvoiceOwnedByAnotherVisit(
  claims: VisitSaleClaim[],
  invoiceNumber: unknown,
  visitIndex: number,
): boolean {
  const inv = normalizeInvoiceNumberString(invoiceNumber);
  if (!saleHasBillableInvoiceNumber(inv)) return false;
  return isSaleOwnedByAnotherVisit(claims, { invoiceNumber: inv }, visitIndex);
}
