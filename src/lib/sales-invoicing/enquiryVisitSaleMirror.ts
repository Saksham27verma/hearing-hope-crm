import type { SaleRecord } from '@/lib/sales-invoicing/types';
import { normalizeEnquiryVisitIndex } from '@/lib/sales-invoicing/saleCancelled';
import { normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';

/** Calendar date in IST — matches `enquiryVisitSaleDateToTimestamp` for YYYY-MM-DD inputs. */
export function toIstCalendarDateKey(value: Date | string | null | undefined): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }
    return '';
  }
  if (!Number.isNaN(value.getTime())) {
    return value.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }
  return '';
}

export type ExchangeFields = {
  exchangeCredit: number;
  exchangePriorVisitIndex: number | undefined;
};

/** Read exchange credit from flat visit or nested `hearingAidDetails`. */
export function readExchangeFieldsFromVisit(visit: Record<string, unknown>): ExchangeFields {
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const baseGrand =
    Number(visit.salesAfterTax) ||
    Number(visit.grossSalesBeforeTax || 0) + Number(visit.taxAmount || 0) ||
    Number(details?.salesAfterTax) ||
    0;
  const rawCredit = visit.exchangeCreditAmount ?? details?.exchangeCreditAmount ?? 0;
  const exchangeCredit = Math.min(Math.max(0, Number(rawCredit) || 0), baseGrand);
  const priorRaw = visit.exchangePriorVisitIndex ?? details?.exchangePriorVisitIndex;
  const exchangePriorVisitIndex =
    priorRaw === '' || priorRaw == null
      ? undefined
      : normalizeEnquiryVisitIndex(priorRaw);
  return { exchangeCredit, exchangePriorVisitIndex };
}

export function saleGrandTotalFromVisit(visit: Record<string, unknown>): number {
  const { exchangeCredit } = readExchangeFieldsFromVisit(visit);
  const grossSalesBeforeTax = Number(visit.grossSalesBeforeTax) || 0;
  const gstAmount = Number(visit.taxAmount) || 0;
  const baseGrand = Number(visit.salesAfterTax) || grossSalesBeforeTax + gstAmount;
  return Math.round(baseGrand - exchangeCredit);
}

function stableProductsKey(products: unknown): string {
  if (!Array.isArray(products)) return '[]';
  const rows = products.map((raw) => {
    const p = raw as Record<string, unknown>;
    return {
      id: String(p.productId || p.id || '').trim(),
      sn: String(p.serialNumber || '').trim(),
      sp: Number(p.sellingPrice ?? p.finalAmount ?? 0) || 0,
      q: Number(p.quantity ?? 1) || 1,
    };
  });
  rows.sort((a, b) => `${a.id}|${a.sn}`.localeCompare(`${b.id}|${b.sn}`));
  return JSON.stringify(rows);
}

export type SaleMirrorFingerprint = {
  visitIndex: number;
  grossSalesBeforeTax: number;
  gstAmount: number;
  grandTotal: number;
  exchangeCredit: number;
  exchangePriorVisitIndex: number | null;
  productsKey: string;
  saleDateKey: string;
  patientName: string;
  phone: string;
  email: string;
  address: string;
  customerGstNumber: string;
  centerId: string;
  notes: string;
  salespersonId: string;
  salespersonName: string;
};

function salespersonFromVisit(visit: Record<string, unknown>): { id: string; name: string } {
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const name = String(
    details?.whoSold ?? visit.whoSold ?? visit.whoSoldName ?? visit.hearingAidBrand ?? '',
  ).trim();
  const id = String(visit.salespersonId ?? details?.salespersonId ?? '').trim();
  return { id, name };
}

export function buildSaleMirrorFingerprint(
  visit: Record<string, unknown>,
  enquiry: Record<string, unknown>,
  visitIndex: number,
): SaleMirrorFingerprint {
  const { exchangeCredit, exchangePriorVisitIndex } = readExchangeFieldsFromVisit(visit);
  const grossSalesBeforeTax = Number(visit.grossSalesBeforeTax) || 0;
  const gstAmount = Number(visit.taxAmount) || 0;
  const saleDateRaw = visit.purchaseDate || visit.visitDate;
  const salesperson = salespersonFromVisit(visit);
  return {
    visitIndex: normalizeEnquiryVisitIndex(visitIndex),
    grossSalesBeforeTax,
    gstAmount,
    grandTotal: saleGrandTotalFromVisit(visit),
    exchangeCredit,
    exchangePriorVisitIndex:
      typeof exchangePriorVisitIndex === 'number' ? exchangePriorVisitIndex : null,
    productsKey: stableProductsKey(visit.products),
    saleDateKey: toIstCalendarDateKey(
      typeof saleDateRaw === 'string' || saleDateRaw instanceof Date ? saleDateRaw : String(saleDateRaw || ''),
    ),
    patientName: String(enquiry.name || enquiry.patientName || '').trim(),
    phone: String(enquiry.phone || '').trim(),
    email: String(enquiry.email || '').trim(),
    address: String(enquiry.address || '').trim(),
    customerGstNumber: String(enquiry.customerGstNumber || '').trim(),
    centerId: String(visit.centerId || enquiry.visitingCenter || enquiry.center || '').trim(),
    notes: String(visit.visitNotes || '').trim(),
    salespersonId: salesperson.id,
    salespersonName: salesperson.name,
  };
}

export function fingerprintFromSaleRecord(
  sale: SaleRecord,
  enquiry: Record<string, unknown>,
): SaleMirrorFingerprint | null {
  const visitIndex = normalizeEnquiryVisitIndex(sale.enquiryVisitIndex);
  const grossSalesBeforeTax = Number(sale.totalAmount) || 0;
  const gstAmount = Number(sale.gstAmount) || 0;
  const exchangeCredit = Math.max(0, Number(sale.exchangeCreditInr) || 0);
  const grandTotal = Math.round(Number(sale.grandTotal) || grossSalesBeforeTax + gstAmount);
  const sd = sale.saleDate as { toDate?: () => Date; seconds?: number } | undefined;
  let saleDate: Date | null = null;
  if (sd && typeof sd.toDate === 'function') {
    saleDate = sd.toDate();
  } else if (sd && typeof sd.seconds === 'number') {
    saleDate = new Date(sd.seconds * 1000);
  }
  const saleDateKey = saleDate ? toIstCalendarDateKey(saleDate) : '';
  const sp = sale.salesperson;
  return {
    visitIndex,
    grossSalesBeforeTax,
    gstAmount,
    grandTotal,
    exchangeCredit,
    exchangePriorVisitIndex:
      typeof sale.exchangePriorVisitIndex === 'number'
        ? normalizeEnquiryVisitIndex(sale.exchangePriorVisitIndex)
        : null,
    productsKey: stableProductsKey(sale.products),
    saleDateKey,
    patientName: String(sale.patientName || enquiry.name || '').trim(),
    phone: String(sale.phone || enquiry.phone || '').trim(),
    email: String(sale.email || '').trim(),
    address: String(sale.address || '').trim(),
    customerGstNumber: String(sale.customerGstNumber || '').trim(),
    centerId: String(sale.centerId || '').trim(),
    notes: String(sale.notes || '').trim(),
    salespersonId: String(sp?.id || '').trim(),
    salespersonName: String(sp?.name || '').trim(),
  };
}

function saleHasStoredVisitIndex(sale: SaleRecord): boolean {
  const raw = sale.enquiryVisitIndex;
  if (raw === null || raw === undefined) return false;
  if (typeof raw === 'string' && !raw.trim()) return false;
  return true;
}

function fingerprintsEqual(
  a: SaleMirrorFingerprint,
  b: SaleMirrorFingerprint,
  opts?: { ignoreVisitIndex?: boolean },
): boolean {
  const dateOk =
    !a.saleDateKey || !b.saleDateKey || a.saleDateKey === b.saleDateKey;
  return (
    (opts?.ignoreVisitIndex || a.visitIndex === b.visitIndex) &&
    a.grossSalesBeforeTax === b.grossSalesBeforeTax &&
    a.gstAmount === b.gstAmount &&
    a.grandTotal === b.grandTotal &&
    a.exchangeCredit === b.exchangeCredit &&
    a.exchangePriorVisitIndex === b.exchangePriorVisitIndex &&
    a.productsKey === b.productsKey &&
    dateOk &&
    a.patientName === b.patientName &&
    a.phone === b.phone &&
    a.email === b.email &&
    a.address === b.address &&
    a.customerGstNumber === b.customerGstNumber &&
    a.centerId === b.centerId &&
    a.notes === b.notes &&
    a.salespersonId === b.salespersonId &&
    a.salespersonName === b.salespersonName
  );
}

export function saleRecordMatchesVisitMirror(
  sale: SaleRecord,
  visit: Record<string, unknown>,
  enquiry: Record<string, unknown>,
  visitIndex: number,
): boolean {
  const target = buildSaleMirrorFingerprint(visit, enquiry, visitIndex);
  const fromSale = fingerprintFromSaleRecord(sale, enquiry);
  if (!fromSale) return false;
  return fingerprintsEqual(target, fromSale, {
    ignoreVisitIndex: !saleHasStoredVisitIndex(sale),
  });
}

export function visitInvoiceNumberFromVisit(visit: Record<string, unknown>): string {
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const raw = visit.invoiceNumber ?? details?.invoiceNumber ?? visit.salesInvoiceNumber;
  return normalizeInvoiceNumberString(raw);
}

export function visitLinkedSaleIdFromVisit(visit: Record<string, unknown>): string {
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  return String(visit.linkedSaleId ?? details?.linkedSaleId ?? '').trim();
}

export function readVisitSaleTotals(visit: Record<string, unknown>): {
  grossSalesBeforeTax: number;
  gstAmount: number;
  salesAfterTax: number;
} {
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const grossSalesBeforeTax = Number(visit.grossSalesBeforeTax ?? details?.grossSalesBeforeTax) || 0;
  const gstAmount = Number(visit.taxAmount ?? details?.taxAmount) || 0;
  const salesAfterTax =
    Number(visit.salesAfterTax ?? details?.salesAfterTax) ||
    grossSalesBeforeTax + gstAmount;
  return { grossSalesBeforeTax, gstAmount, salesAfterTax };
}

function productSerialSet(products: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(products)) return out;
  for (const raw of products) {
    const p = raw as Record<string, unknown>;
    const sn = String(p.serialNumber || '').trim();
    if (sn) out.add(sn.toLowerCase());
  }
  return out;
}

export function productSerialSetFromVisit(visit: Record<string, unknown>): Set<string> {
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const fromFlat = productSerialSet(visit.products);
  if (fromFlat.size > 0) return fromFlat;
  return productSerialSet(details?.products);
}

export function productSerialsOverlap(a: Set<string>, products: unknown): boolean {
  if (a.size === 0) return false;
  const b = productSerialSet(products);
  if (b.size === 0) return false;
  for (const sn of a) {
    if (b.has(sn)) return true;
  }
  return false;
}

/** Loose match when totals shifted (e.g. exchange credit added after first invoice). */
export function saleLooselyMatchesEnquiryVisit(
  sale: SaleRecord,
  visit: Record<string, unknown>,
  visitIndex: number,
): boolean {
  const wantIdx = normalizeEnquiryVisitIndex(visitIndex);
  const saleIdx = normalizeEnquiryVisitIndex(sale.enquiryVisitIndex);
  const hasSaleIdx = saleHasStoredVisitIndex(sale);
  if (hasSaleIdx && saleIdx !== wantIdx) return false;

  const { exchangeCredit } = readExchangeFieldsFromVisit(visit);
  if (exchangeCredit > 0) {
    const saleEx = Math.max(0, Number(sale.exchangeCreditInr) || 0);
    if (saleEx > 0 && Math.abs(saleEx - exchangeCredit) <= 1) return true;
    return false;
  }

  const visitSerials = productSerialSetFromVisit(visit);
  if (productSerialsOverlap(visitSerials, sale.products)) return true;

  const { grossSalesBeforeTax, gstAmount } = readVisitSaleTotals(visit);
  const saleGross = Number(sale.totalAmount) || 0;
  const saleGst = Number(sale.gstAmount) || 0;
  const saleGrand = Math.round(Number(sale.grandTotal) || saleGross + saleGst);
  const visitGrand = saleGrandTotalFromVisit(visit);

  if (saleGross === grossSalesBeforeTax && saleGst === gstAmount) return true;
  if (saleGrand === visitGrand) return true;

  return false;
}
