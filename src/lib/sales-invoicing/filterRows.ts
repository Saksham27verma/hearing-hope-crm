import type { InvoiceTablePaymentFilter, PaymentStatus, UnifiedInvoiceRow } from './types';
import { timestampToMs } from './timestamps';
import type { Timestamp } from 'firebase/firestore';

export function filterUnifiedRows(
  rows: UnifiedInvoiceRow[],
  search: string,
  opts: {
    dateFrom: Date | null;
    dateTo: Date | null;
    paymentStatuses: InvoiceTablePaymentFilter[];
    source: 'all' | 'manual' | 'enquiry';
  }
): UnifiedInvoiceRow[] {
  let out = [...rows];

  const q = search.trim().toLowerCase();
  if (q) {
    out = out.filter((r) => {
      const inv = (r.invoiceNumber || '').toLowerCase();
      const client = r.clientName.toLowerCase();
      const phone = (r.clientPhone || '').toLowerCase();
      const enq = (r.linkedEnquiryRef || '').toLowerCase();
      const payBlob = (r.patientPayments || [])
        .map(
          (p) =>
            `${p.amount} ${p.mode} ${p.referenceNumber || ''} ${p.remarks || ''} ${p.date || ''}`.toLowerCase()
        )
        .join(' ');
      return (
        inv.includes(q) || client.includes(q) || phone.includes(q) || enq.includes(q) || payBlob.includes(q)
      );
    });
  }

  if (opts.dateFrom) {
    const start = opts.dateFrom.setHours(0, 0, 0, 0);
    out = out.filter((r) => timestampToMs(r.date as Timestamp) >= start);
  }
  if (opts.dateTo) {
    const end = opts.dateTo.setHours(23, 59, 59, 999);
    out = out.filter((r) => timestampToMs(r.date as Timestamp) <= end);
  }

  if (opts.source === 'manual') {
    out = out.filter((r) => r.kind === 'saved' && r.source === 'manual');
  } else if (opts.source === 'enquiry') {
    out = out.filter((r) => r.kind === 'enquiry_pending' || (r.kind === 'saved' && r.source === 'enquiry'));
  }

  if (opts.paymentStatuses.length > 0) {
    out = out.filter((r) => {
      if (r.isCancelled || r.savedSale?.cancelled) {
        return opts.paymentStatuses.includes('cancelled');
      }
      if (r.kind === 'enquiry_pending') {
        return opts.paymentStatuses.includes('pending');
      }
      const ps = r.savedSale?.paymentStatus || 'paid';
      let effective: PaymentStatus = ps;
      if (ps === 'pending' && r.savedSale?.dueDate && typeof r.savedSale.dueDate.seconds === 'number') {
        if (r.savedSale.dueDate.seconds * 1000 < Date.now()) effective = 'overdue';
      }
      return opts.paymentStatuses.includes(effective);
    });
  }

  return out;
}
