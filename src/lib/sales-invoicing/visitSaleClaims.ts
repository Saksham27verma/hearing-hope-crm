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

/**
 * Visit index that owns this sale, or null when unclaimed. A linked sale id is decisive; the invoice #
 * is only used when no visit links the sale id. Earliest visit wins when several claim it.
 */
export function ownerVisitIndexForSale(
  claims: VisitSaleClaim[],
  sale: { id?: string; invoiceNumber?: unknown },
): number | null {
  const earliest = (hit: (c: VisitSaleClaim) => boolean): number | null => {
    let owner: number | null = null;
    for (const c of claims) {
      if (hit(c) && (owner === null || c.visitIndex < owner)) owner = c.visitIndex;
    }
    return owner;
  };
  const id = String(sale.id || '').trim();
  if (id) {
    const byId = earliest((c) => c.saleId === id);
    if (byId !== null) return byId;
  }
  const inv = normalizeInvoiceNumberString(sale.invoiceNumber);
  return inv ? earliest((c) => c.invoiceNumber === inv) : null;
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
