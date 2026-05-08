import type { Timestamp } from 'firebase/firestore';
import type { DerivedEnquirySale, PaymentStatus, SaleRecord, UnifiedInvoiceRow } from './types';
import { saleInvoiceFaceTotal } from './saleInvoiceFaceTotal';
import { timestampToMs } from './timestamps';

function effectivePaymentStatus(s: SaleRecord): PaymentStatus {
  const ps = s.paymentStatus;
  if (ps === 'paid' || ps === 'pending' || ps === 'overdue') {
    if (ps === 'pending' && s.dueDate && typeof s.dueDate.seconds === 'number') {
      const due = s.dueDate.seconds * 1000;
      if (due < Date.now()) return 'overdue';
    }
    return ps;
  }
  return 'paid';
}

function statusChip(status: PaymentStatus): { label: string; variant: UnifiedInvoiceRow['statusVariant'] } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', variant: 'paid' };
    case 'pending':
      return { label: 'Pending', variant: 'pending' };
    case 'overdue':
      return { label: 'Overdue', variant: 'overdue' };
    default:
      return { label: 'Paid', variant: 'paid' };
  }
}

function isDerivedCoveredBySale(sale: SaleRecord, d: DerivedEnquirySale): boolean {
  const vIdx = sale.enquiryVisitIndex;
  // Same visit index always "covers" the derived row — including voided invoices —
  // so we do not show a phantom Uninvoiced duplicate after cancel.
  if (typeof vIdx === 'number' && vIdx === d.visitIndex) {
    if (sale.enquiryId && d.enquiryId && sale.enquiryId === d.enquiryId) return true;
    if (sale.visitorId && d.visitorId && sale.visitorId === d.visitorId) return true;
  }
  if (sale.cancelled) return false;
  const saleTs = sale.saleDate?.seconds;
  const dTs = d.visitDate?.seconds;
  if (saleTs && dTs) {
    const a = new Date(saleTs * 1000);
    const b = new Date(dTs * 1000);
    if (a.toDateString() === b.toDateString()) {
      if (sale.enquiryId && d.enquiryId && sale.enquiryId === d.enquiryId) return true;
      if (sale.visitorId && d.visitorId && sale.visitorId === d.visitorId) return true;
    }
  }
  return false;
}

export function buildUnifiedInvoiceRows(sales: SaleRecord[], derived: DerivedEnquirySale[]): UnifiedInvoiceRow[] {
  const rows: UnifiedInvoiceRow[] = [];

  for (const s of sales) {
    if (s.cancelled) {
      rows.push({
        kind: 'saved',
        rowId: `sale-${s.id}`,
        invoiceNumber: s.invoiceNumber || null,
        date: s.saleDate,
        clientName: s.patientName || '—',
        clientPhone: s.phone,
        linkedEnquiryRef: s.enquiryId || s.visitorId || null,
        total: saleInvoiceFaceTotal(s),
        statusLabel: 'Cancelled',
        statusVariant: 'cancelled',
        isCancelled: true,
        source: s.source === 'enquiry' ? 'enquiry' : 'manual',
        savedSale: s,
      });
      continue;
    }
    const ps = effectivePaymentStatus(s);
    const { label, variant } = statusChip(ps);
    rows.push({
      kind: 'saved',
      rowId: `sale-${s.id}`,
      invoiceNumber: s.invoiceNumber || null,
      date: s.saleDate,
      clientName: s.patientName || '—',
      clientPhone: s.phone,
      linkedEnquiryRef: s.enquiryId || s.visitorId || null,
      total: saleInvoiceFaceTotal(s),
      statusLabel: label,
      statusVariant: variant,
      isCancelled: false,
      source: s.source === 'enquiry' ? 'enquiry' : 'manual',
      savedSale: s,
    });
  }

  for (const d of derived) {
    if (sales.some((s) => isDerivedCoveredBySale(s, d))) continue;
    rows.push({
      kind: 'enquiry_pending',
      rowId: `enq-${d.id}`,
      invoiceNumber: null,
      date: d.visitDate,
      clientName: d.patientName,
      clientPhone: d.phone,
      linkedEnquiryRef: d.enquiryId || d.visitorId || null,
      total: d.totalAmount || 0,
      statusLabel: 'Uninvoiced',
      statusVariant: 'uninvoiced',
      source: 'enquiry_pending',
      derivedEnquiry: d,
    });
  }

  rows.sort((a, b) => timestampToMs(b.date as Timestamp) - timestampToMs(a.date as Timestamp));
  return rows;
}
