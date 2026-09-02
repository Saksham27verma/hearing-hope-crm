import assert from 'node:assert/strict';
import test from 'node:test';
import type { SaleRecord, UnifiedInvoiceRow } from './types';
import {
  buildCenterResolveContext,
  mapUnifiedRowsToRecords,
  resolveSaleReportDate,
} from './salesReportNormalize';

const MAY_1_2025_IST = new Date('2025-05-01T00:00:00+05:30');
const MAY_1_2025_SECONDS = Math.floor(MAY_1_2025_IST.getTime() / 1000);

function istYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function todayIstYmd(): string {
  return istYmd(new Date());
}

function inRange(d: Date, from: Date, to: Date): boolean {
  const t = d.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function thisMonthBounds(now = new Date()): { from: Date; to: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    from: new Date(y, m, 1, 0, 0, 0, 0),
    to: new Date(y, m + 1, 0, 23, 59, 59, 999),
  };
}

function sale(overrides: Partial<SaleRecord> & { id: string }): SaleRecord {
  return {
    patientName: 'SATISH CHAND',
    products: [{ mrp: 50000, sellingPrice: 28000, quantity: 1 }],
    salesperson: { id: 's1', name: 'Bhavik' },
    totalAmount: 28000,
    gstAmount: 0,
    grandTotal: 28000,
    gstPercentage: 0,
    netProfit: 0,
    branch: 'Rohini',
    centerId: 'center-1',
    invoiceNumber: 'HDIPL/26-27/227',
    saleDate: { seconds: MAY_1_2025_SECONDS } as SaleRecord['saleDate'],
    ...overrides,
  };
}

function savedRow(s: SaleRecord): UnifiedInvoiceRow {
  return {
    kind: 'saved',
    rowId: `sale-${s.id}`,
    invoiceNumber: s.invoiceNumber || null,
    date: s.saleDate,
    clientName: s.patientName,
    linkedEnquiryRef: s.enquiryId || null,
    total: 28000,
    statusLabel: 'Paid',
    statusVariant: 'paid',
    isCancelled: false,
    source: 'enquiry',
    savedSale: s,
  };
}

const centers = [{ id: 'center-1', name: 'Rohini' }];
const emptyEnquiries = new Map<string, unknown>();

function mapSales(sales: SaleRecord[], enquiryById: Map<string, unknown> = emptyEnquiries) {
  return mapUnifiedRowsToRecords(
    sales.map(savedRow),
    buildCenterResolveContext(centers),
    enquiryById,
  );
}

test('resolveSaleReportDate keeps a Timestamp with toDate as that calendar day', () => {
  const d = resolveSaleReportDate({
    saleDate: {
      seconds: MAY_1_2025_SECONDS,
      toDate: () => MAY_1_2025_IST,
    },
  });
  assert.ok(d);
  assert.equal(istYmd(d), '2025-05-01');
  assert.notEqual(istYmd(d), todayIstYmd());
});

test('resolveSaleReportDate parses YYYY-MM-DD strings instead of today', () => {
  const d = resolveSaleReportDate({ saleDate: '2025-05-01' });
  assert.ok(d);
  assert.equal(istYmd(d), '2025-05-01');
  assert.notEqual(istYmd(d), todayIstYmd());
});

test('resolveSaleReportDate parses {seconds} blobs that lack toDate', () => {
  const d = resolveSaleReportDate({ saleDate: { seconds: MAY_1_2025_SECONDS } });
  assert.ok(d);
  assert.equal(istYmd(d), '2025-05-01');
});

test('resolveSaleReportDate falls back to createdAt when saleDate is missing', () => {
  const d = resolveSaleReportDate({
    createdAt: { seconds: MAY_1_2025_SECONDS },
  });
  assert.ok(d);
  assert.equal(istYmd(d), '2025-05-01');
});

test('resolveSaleReportDate falls back to visit purchaseDate', () => {
  const d = resolveSaleReportDate({}, { purchaseDate: '2025-04-15' });
  assert.ok(d);
  assert.equal(istYmd(d), '2025-04-15');
});

test('resolveSaleReportDate returns null instead of now when nothing parses', () => {
  const d = resolveSaleReportDate({ saleDate: undefined, createdAt: undefined }, {});
  assert.equal(d, null);
});

test('mapUnifiedRowsToRecords uses Timestamp saleDate, not today', () => {
  const rows = mapSales([
    sale({
      id: 'sale-ts',
      saleDate: {
        seconds: MAY_1_2025_SECONDS,
        toDate: () => MAY_1_2025_IST,
      } as SaleRecord['saleDate'],
    }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].invoiceNumber, 'HDIPL/26-27/227');
  assert.equal(istYmd(rows[0].date), '2025-05-01');
});

test('mapUnifiedRowsToRecords uses string saleDate instead of today', () => {
  const rows = mapSales([
    sale({
      id: 'sale-str',
      saleDate: '2025-05-01' as unknown as SaleRecord['saleDate'],
    }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(istYmd(rows[0].date), '2025-05-01');
  assert.notEqual(istYmd(rows[0].date), todayIstYmd());
});

test('mapUnifiedRowsToRecords uses seconds blob saleDate without toDate', () => {
  const rows = mapSales([
    sale({
      id: 'sale-sec',
      saleDate: { seconds: MAY_1_2025_SECONDS } as SaleRecord['saleDate'],
    }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(istYmd(rows[0].date), '2025-05-01');
});

test('mapUnifiedRowsToRecords falls back to createdAt when saleDate is missing', () => {
  const row = sale({
    id: 'sale-created',
    createdAt: { seconds: MAY_1_2025_SECONDS } as SaleRecord['createdAt'],
  });
  delete (row as { saleDate?: unknown }).saleDate;
  const rows = mapSales([row]);
  assert.equal(rows.length, 1);
  assert.equal(istYmd(rows[0].date), '2025-05-01');
});

test('mapUnifiedRowsToRecords falls back to visit purchaseDate', () => {
  const row = sale({
    id: 'sale-visit',
    enquiryId: 'enq-1',
    enquiryVisitIndex: 0,
  });
  delete (row as { saleDate?: unknown }).saleDate;
  const enquiryById = new Map<string, unknown>([
    ['enq-1', { id: 'enq-1', visits: [{ purchaseDate: '2025-04-15' }] }],
  ]);
  const rows = mapSales([row], enquiryById);
  assert.equal(rows.length, 1);
  assert.equal(istYmd(rows[0].date), '2025-04-15');
});

test('mapUnifiedRowsToRecords drops undated invoices instead of stamping today', () => {
  const row = sale({ id: 'sale-undated' });
  delete (row as { saleDate?: unknown }).saleDate;
  const rows = mapSales([row]);
  assert.equal(rows.length, 0);

  const { from, to } = thisMonthBounds();
  const wouldHavePassedIfToday = inRange(new Date(), from, to);
  assert.equal(wouldHavePassedIfToday, true);
});
