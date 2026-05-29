import assert from 'node:assert/strict';
import test from 'node:test';
import { saleRecordMatchesVisitMirror } from './enquiryVisitSaleMirror';
import type { SaleRecord } from './types';

test('saleRecordMatchesVisitMirror matches mirrored sale and visit', () => {
  const enquiry = {
    name: 'Test Patient',
    phone: '9876543210',
    email: 'p@example.com',
    address: '123 Street',
    visitingCenter: 'center-1',
  };

  const visit = {
    hearingAidSale: true,
    grossSalesBeforeTax: 10000,
    taxAmount: 1800,
    salesAfterTax: 11800,
    products: [{ productId: 'p1', serialNumber: 'SN1', sellingPrice: 10000, quantity: 1 }],
    purchaseDate: '2025-05-01',
    visitNotes: 'Note',
    centerId: 'center-1',
  };

  const sale: SaleRecord = {
    patientName: 'Test Patient',
    phone: '9876543210',
    email: 'p@example.com',
    address: '123 Street',
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
    enquiryVisitIndex: 0,
  };

  assert.equal(saleRecordMatchesVisitMirror(sale, visit, enquiry, 0), true);
});

test('saleRecordMatchesVisitMirror detects enquiry edit changing totals', () => {
  const enquiry = {
    name: 'Test Patient',
    phone: '9876543210',
    email: 'p@example.com',
    address: '123 Street',
    visitingCenter: 'center-1',
  };

  const visit = {
    hearingAidSale: true,
    grossSalesBeforeTax: 12000,
    taxAmount: 2160,
    salesAfterTax: 14160,
    products: [{ productId: 'p1', serialNumber: 'SN1', sellingPrice: 12000, quantity: 1 }],
    purchaseDate: '2025-05-01',
    visitNotes: 'Note',
    centerId: 'center-1',
  };

  const sale: SaleRecord = {
    patientName: 'Test Patient',
    phone: '9876543210',
    email: 'p@example.com',
    address: '123 Street',
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
    enquiryVisitIndex: 0,
  };

  assert.equal(saleRecordMatchesVisitMirror(sale, visit, enquiry, 0), false);
});
