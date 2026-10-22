import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPaymentAcknowledgmentData, getBookingPaymentMode } from './receiptDataBuilders';
import { enquiryPaymentIdsForVisit } from './enquiryPaymentLedger';
import { enquiryVisitToInvoiceSalePayload, resolveInvoicePaymentMethodLabel } from './invoiceSaleToData';

const enquiry = {
  id: 'enq-1',
  name: 'Repeat Patient',
  invoiceNumber: 'INV-0101',
  visits: [
    { id: '1', visitDate: '2026-01-02', hearingAidBooked: true, bookingAdvanceAmount: 5000 },
    { id: '2', visitDate: '2026-01-09', hearingAidSale: true, invoiceNumber: 'INV-0101', salesAfterTax: 40000 },
    { id: '3', visitDate: '2026-04-02', hearingAidBooked: true, bookingAdvanceAmount: 3000 },
    { id: '4', visitDate: '2026-04-10', hearingAidSale: true, salesAfterTax: 30000 },
  ],
  payments: [
    { id: 'p1', amount: 5000, paymentFor: 'booking_advance', paymentMode: 'Cash', paymentDate: '2026-01-02' },
    { id: 'p2', amount: 35000, paymentFor: 'hearing_aid', paymentMode: 'Card', paymentDate: '2026-01-09' },
    { id: 'p3', amount: 3000, paymentFor: 'booking_advance', paymentMode: 'UPI', paymentDate: '2026-04-02', relatedVisitId: '3' },
    { id: 'p4', amount: 27000, paymentFor: 'hearing_aid', paymentMode: 'UPI', paymentDate: '2026-04-10' },
  ],
};

test('payment acknowledgment for selected payments only', () => {
  const ids = enquiryPaymentIdsForVisit(enquiry, 3);
  assert.deepEqual(ids, ['p4']);
  const data = buildPaymentAcknowledgmentData(enquiry, { paymentIds: ids, scopeLabel: 'Visit 4' });
  assert.equal(data.lineCount, 1);
  assert.equal(data.totalPaid, 27000);
  assert.equal(data.documentTitle.includes('Visit 4'), true);
  assert.notEqual(data.documentNumber, 'PA-enq-1');
});

test('payment acknowledgment without a selection keeps every payment and the old number', () => {
  const data = buildPaymentAcknowledgmentData(enquiry);
  assert.equal(data.lineCount, 4);
  assert.equal(data.totalPaid, 70000);
  assert.equal(data.documentNumber, 'PA-enq-1');
});

test('booking receipt uses the payment mode of its own booking', () => {
  assert.equal(getBookingPaymentMode(enquiry, enquiry.visits[2]), 'UPI');
  assert.equal(getBookingPaymentMode(enquiry, enquiry.visits[0]), 'Cash');
});

test('second invoice never borrows the first visit invoice number', () => {
  const payload = enquiryVisitToInvoiceSalePayload(enquiry, enquiry.visits[3], { visitIndex: 3 });
  assert.equal(payload.invoiceNumber, '');
});

test('second invoice shows only the payment modes of its own purchase', () => {
  const payload = enquiryVisitToInvoiceSalePayload(enquiry, enquiry.visits[3], { visitIndex: 3 });
  assert.equal(payload.paymentMethod, 'UPI');
  assert.equal(
    resolveInvoicePaymentMethodLabel({ enquiryVisitIndex: 1 }, enquiry),
    'Cash, Card',
  );
});
