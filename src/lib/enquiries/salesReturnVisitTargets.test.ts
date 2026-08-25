import assert from 'node:assert/strict';
import test from 'node:test';
import { expandSalesReturnLinesFromVisit } from '@/utils/salesReturnFromVisit';
import {
  buildSalesReturnInventoryRestores,
  collectSaleVisitIndicesVoidedByReturns,
  previewInvoicesCancelledByReturnVisit,
} from './salesReturnVisitTargets';

const sale0 = {
  hearingAidSale: true,
  invoiceNumber: 'INV-0001',
  linkedSaleId: 'sale-a',
  products: [{ productId: 'p1', name: 'Aid A', serialNumber: 'SN-A', soldFromCenterId: 'c1' }],
  visitDate: '2025-01-10',
};

const sale1 = {
  hearingAidSale: true,
  invoiceNumber: 'INV-0002',
  linkedSaleId: 'sale-b',
  products: [{ productId: 'p2', name: 'Aid B', serialNumber: 'SN-B', soldFromCenterId: 'c1' }],
  visitDate: '2025-03-10',
};

test('return of one of two sales only voids that sale visit', () => {
  const visits = [
    sale0,
    sale1,
    {
      salesReturn: true,
      returnOriginalSaleVisitId: '1',
      salesReturnItems: [{ serialNumber: 'SN-B', visitIndex: 1 }],
    },
  ];
  assert.deepEqual(collectSaleVisitIndicesVoidedByReturns(visits), [1]);
});

test('later re-sale of a returned serial is not voided by the old return', () => {
  const visits = [
    sale0,
    {
      salesReturn: true,
      returnOriginalSaleVisitId: '0',
      salesReturnItems: [{ serialNumber: 'SN-A', visitIndex: 0 }],
    },
    {
      hearingAidSale: true,
      invoiceNumber: 'INV-0009',
      products: [{ productId: 'p1', name: 'Aid A', serialNumber: 'SN-A' }],
    },
  ];
  assert.deepEqual(collectSaleVisitIndicesVoidedByReturns(visits), [0]);
});

test('preview lists the invoice that will be cancelled', () => {
  const returnVisit = {
    salesReturn: true,
    salesReturnItems: [{ serialNumber: 'SN-B', visitIndex: 1 }],
  };
  const visits = [sale0, sale1, returnVisit];
  const preview = previewInvoicesCancelledByReturnVisit(visits, returnVisit, 2);
  assert.equal(preview.length, 1);
  assert.equal(preview[0].visitIndex, 1);
  assert.equal(preview[0].invoiceNumber, 'INV-0002');
  assert.deepEqual(preview[0].serialNumbers, ['SN-B']);
});

test('expandSalesReturnLinesFromVisit keeps visitIndex for stock restore targeting', () => {
  const lines = expandSalesReturnLinesFromVisit({
    salesReturnItems: [{ serialNumber: 'SN-B', visitIndex: 1, invoiceNumber: 'INV-0002' }],
  });
  assert.equal(lines[0].visitIndex, 1);
  assert.equal(lines[0].invoiceNumber, 'INV-0002');
});

test('inventory restore uses the returned sale visit product, not a later sale', () => {
  const visits = [
    sale0,
    sale1,
    {
      salesReturn: true,
      returnOriginalSaleVisitId: '1',
      salesReturnItems: [{ serialNumber: 'SN-B', visitIndex: 1 }],
    },
  ];
  const rows = buildSalesReturnInventoryRestores(visits, 'fallback');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].productId, 'p2');
  assert.equal(rows[0].serialNumber, 'SN-B');
  assert.equal(rows[0].soldFromCenterId, 'c1');
});
