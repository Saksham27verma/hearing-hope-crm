import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeEnquiryVisitSaleCandidates } from './enquiryVisitSaleDedupe';
import { shouldAllocateNewInvoiceNumber } from './enquiryInvoiceNumber';
import {
  isExplicitEnquirySaleVisit,
  isInvoicableEnquirySaleVisit,
  resolveSaleDateForUpsert,
} from './enquiryVisitSaleUpsert';
import {
  formatSaleDateLabel,
  parseEnquiryVisitSaleDate,
} from './enquiryVisitSaleTimestamp';
import { deriveEnquirySalesFromDocs } from './enquiryDerivation';
import type { SaleRecord } from './types';

function sale(overrides: Partial<SaleRecord> & { id: string }): SaleRecord {
  return {
    patientName: 'Test Patient',
    products: [{ productId: 'p1', serialNumber: 'SN1', sellingPrice: 10000, quantity: 1 }],
    salesperson: { id: '', name: '' },
    totalAmount: 10000,
    gstAmount: 1800,
    grandTotal: 11800,
    gstPercentage: 0,
    netProfit: 0,
    branch: '',
    centerId: 'center-1',
    notes: 'Note',
    saleDate: { seconds: 1746057600 } as SaleRecord['saleDate'],
    invoiceNumber: 'INV-0001',
    ...overrides,
  };
}

const enquiry = {
  name: 'Test Patient',
  phone: '9876543210',
  email: 'p@example.com',
  address: '123 Street',
  visitingCenter: 'center-1',
};

const saleVisit = {
  hearingAidSale: true,
  invoiceNumber: 'INV-0001',
  grossSalesBeforeTax: 10000,
  taxAmount: 1800,
  salesAfterTax: 11800,
  products: [{ productId: 'p1', serialNumber: 'SN1', sellingPrice: 10000, quantity: 1 }],
  purchaseDate: '2025-05-01',
  visitNotes: 'Note',
  centerId: 'center-1',
};

test('merge finds existing sale by invoice number even without enquiryId', () => {
  const orphan = sale({ id: 'legacy-sale' });
  delete orphan.enquiryId;
  delete orphan.enquiryVisitIndex;

  const found = mergeEnquiryVisitSaleCandidates({
    visitIndex: 0,
    visit: saleVisit,
    enquiry,
    enquirySales: [],
    globalInvoiceSales: [orphan],
  });

  assert.equal(found.length, 1);
  assert.equal(found[0]?.id, 'legacy-sale');
});

test('merge honors linkedSaleId when enquiryVisitIndex is missing', () => {
  const linked = sale({ id: 'linked-sale' });
  delete linked.enquiryVisitIndex;

  const found = mergeEnquiryVisitSaleCandidates({
    visitIndex: 1,
    visit: { ...saleVisit, linkedSaleId: 'linked-sale' },
    enquiry,
    enquirySales: [],
    linkedSale: linked,
  });

  assert.equal(found.length, 1);
  assert.equal(found[0]?.id, 'linked-sale');
});

test('follow-up non-sale visit is not invoicable', () => {
  const followUp = {
    hearingAidSale: false,
    visitDate: '2026-08-24',
    visitNotes: 'Follow up',
  };
  assert.equal(isInvoicableEnquirySaleVisit(followUp), false);
  assert.equal(isExplicitEnquirySaleVisit(followUp), false);
});

test('generic medicalServices hearing_aid is not a sale', () => {
  const visit = { medicalServices: ['hearing_aid'], hearingAidSale: false };
  assert.equal(isExplicitEnquirySaleVisit(visit), false);
  assert.equal(isInvoicableEnquirySaleVisit(visit), false);
});

test('already-invoiced visit stays invoicable for in-place update', () => {
  assert.equal(isInvoicableEnquirySaleVisit({ invoiceNumber: 'INV-0001' }), true);
  assert.equal(isInvoicableEnquirySaleVisit({ linkedSaleId: 'abc' }), true);
});

test('shouldAllocateNewInvoiceNumber is false when visit already has an invoice', () => {
  assert.equal(
    shouldAllocateNewInvoiceNumber({ candidateInvoiceNumbers: ['INV-0001'] }),
    false,
  );
  assert.equal(
    shouldAllocateNewInvoiceNumber({ currentSaleId: 'sale-1', candidateInvoiceNumbers: [] }),
    false,
  );
  assert.equal(
    shouldAllocateNewInvoiceNumber({ candidateInvoiceNumbers: [] }),
    true,
  );
});

test('resolveSaleDateForUpsert freezes existing saleDate when visit date is unchanged', () => {
  const existingTs = { seconds: 1746057600, nanoseconds: 0 };
  const frozen = resolveSaleDateForUpsert(
    { purchaseDate: '2025-05-01', visitDate: '2025-05-01' },
    { saleDate: existingTs },
  );
  assert.equal(frozen, existingTs);
});

test('resolveSaleDateForUpsert keeps existing saleDate when visit date is blank', () => {
  const existingTs = { seconds: 1746057600, nanoseconds: 0 };
  const frozen = resolveSaleDateForUpsert({ visitDate: '', purchaseDate: '' }, { saleDate: existingTs });
  assert.equal(frozen, existingTs);
});

test('resolveSaleDateForUpsert skips create when visit has no date', () => {
  assert.equal(resolveSaleDateForUpsert({ visitDate: '' }, undefined), null);
});

test('formatSaleDateLabel never returns Invalid Date', () => {
  assert.equal(formatSaleDateLabel(undefined), '—');
  assert.equal(formatSaleDateLabel(''), '—');
  assert.equal(formatSaleDateLabel('not-a-date'), '—');
  assert.equal(formatSaleDateLabel({}), '—');

  const fromSeconds = formatSaleDateLabel({ seconds: 1746057600 });
  assert.notEqual(fromSeconds, 'Invalid Date');
  assert.notEqual(fromSeconds, '—');

  const fromAdmin = formatSaleDateLabel({ _seconds: 1746057600 });
  assert.notEqual(fromAdmin, 'Invalid Date');
  assert.notEqual(fromAdmin, '—');

  const fromYmd = formatSaleDateLabel('2025-05-01');
  assert.notEqual(fromYmd, 'Invalid Date');
  assert.equal(fromYmd.includes('2025'), true);
});

test('parseEnquiryVisitSaleDate does not concatenate time onto ISO values', () => {
  const d = parseEnquiryVisitSaleDate('2025-05-01T10:30:00+05:30');
  assert.ok(d);
  assert.equal(Number.isNaN(d.getTime()), false);
});

test('deriveEnquirySalesFromDocs does not throw on invalid visit dates', () => {
  const derived = deriveEnquirySalesFromDocs(
    [
      {
        id: 'enq-1',
        name: 'Patient',
        visits: [
          {
            hearingAidSale: true,
            visitDate: 'bogus',
            products: [],
            salesAfterTax: 100,
          },
        ],
      },
    ],
    'enquiry',
  );
  assert.equal(derived.length, 1);
  assert.equal(Number.isNaN(derived[0].visitDate?.seconds), false);
});
