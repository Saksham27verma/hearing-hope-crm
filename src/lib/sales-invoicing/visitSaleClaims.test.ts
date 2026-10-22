import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeEnquiryVisitSaleCandidates } from './enquiryVisitSaleDedupe';
import {
  collectVisitSaleClaims,
  isInvoiceOwnedByAnotherVisit,
  ownerVisitIndexForSale,
} from './visitSaleClaims';
import type { SaleRecord } from './types';

function sale(overrides: Partial<SaleRecord> & { id: string }): SaleRecord {
  return {
    patientName: 'Repeat Patient',
    products: [{ productId: 'p1', serialNumber: 'SN-OLD', sellingPrice: 40000, quantity: 1 }],
    salesperson: { id: '', name: '' },
    totalAmount: 40000,
    gstAmount: 0,
    grandTotal: 40000,
    gstPercentage: 0,
    netProfit: 0,
    branch: '',
    centerId: 'c1',
    notes: '',
    saleDate: { seconds: 1767312000 } as SaleRecord['saleDate'],
    invoiceNumber: 'INV-0101',
    enquiryId: 'enq-1',
    enquiryVisitIndex: 0,
    ...overrides,
  };
}

const firstVisit = {
  id: '1',
  hearingAidSale: true,
  visitDate: '2026-01-02',
  invoiceNumber: 'INV-0101',
  linkedSaleId: 'sale-1',
  products: [{ productId: 'p1', serialNumber: 'SN-OLD', sellingPrice: 40000, quantity: 1 }],
  grossSalesBeforeTax: 40000,
  taxAmount: 0,
  salesAfterTax: 40000,
};

test('earliest visit owns an invoice that older data copied onto a later visit', () => {
  const claims = collectVisitSaleClaims([
    firstVisit,
    { id: '2', invoiceNumber: 'INV-0101', linkedSaleId: 'sale-1' },
  ]);
  assert.equal(ownerVisitIndexForSale(claims, { id: 'sale-1' }), 0);
  assert.equal(isInvoiceOwnedByAnotherVisit(claims, 'INV-0101', 1), true);
  assert.equal(isInvoiceOwnedByAnotherVisit(claims, 'INV-0101', 0), false);
});

test('new visit with the same device serial does not pick up the earlier visit invoice', () => {
  // e.g. the same aid re-sold / replaced on a visit three months later.
  const newVisit = {
    id: '2',
    hearingAidSale: true,
    visitDate: '2026-04-02',
    products: [{ productId: 'p1', serialNumber: 'SN-OLD', sellingPrice: 42000, quantity: 1 }],
    grossSalesBeforeTax: 42000,
    taxAmount: 0,
    salesAfterTax: 42000,
  };
  const found = mergeEnquiryVisitSaleCandidates({
    visitIndex: 1,
    visit: newVisit,
    enquiry: { name: 'Repeat Patient', visits: [firstVisit, newVisit] },
    enquirySales: [sale({ id: 'sale-1' })],
  });
  assert.equal(found.length, 0);
});

test('legacy sale without a visit index that belongs to visit 1 is not reused for visit 2', () => {
  const legacy = sale({ id: 'sale-1' });
  delete legacy.enquiryVisitIndex;
  const newVisit = {
    id: '2',
    hearingAidSale: true,
    visitDate: '2026-04-02',
    products: [{ productId: 'p1', serialNumber: 'SN-NEW', sellingPrice: 40000, quantity: 1 }],
    grossSalesBeforeTax: 40000,
    taxAmount: 0,
    salesAfterTax: 40000,
  };
  const found = mergeEnquiryVisitSaleCandidates({
    visitIndex: 1,
    visit: newVisit,
    enquiry: { name: 'Repeat Patient', visits: [firstVisit, newVisit] },
    enquirySales: [legacy],
  });
  assert.equal(found.length, 0);
});

test('prior invoice from a different visit is ignored', () => {
  const newVisit = { id: '2', hearingAidSale: true, visitDate: '2026-04-02', products: [] };
  const found = mergeEnquiryVisitSaleCandidates({
    visitIndex: 1,
    visit: newVisit,
    enquiry: { visits: [firstVisit, newVisit] },
    enquirySales: [sale({ id: 'sale-1' })],
    globalInvoiceSales: [sale({ id: 'sale-1' })],
    priorVisitInvoice: 'INV-0101',
  });
  assert.equal(found.length, 0);
});

test('a visit still finds its own invoice after an earlier visit was deleted (index shifted)', () => {
  const own = sale({ id: 'sale-2', invoiceNumber: 'INV-0150', enquiryVisitIndex: 2 });
  const visit = { id: '3', hearingAidSale: true, invoiceNumber: 'INV-0150', linkedSaleId: 'sale-2', products: [] };
  const found = mergeEnquiryVisitSaleCandidates({
    visitIndex: 1,
    visit,
    enquiry: { visits: [firstVisit, visit] },
    enquirySales: [sale({ id: 'sale-1' }), own],
    linkedSale: own,
  });
  assert.deepEqual(
    found.map((s) => s.id),
    ['sale-2'],
  );
});
