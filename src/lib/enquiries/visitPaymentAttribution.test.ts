import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attributePaymentToVisit,
  saleCycleVisitIndexFor,
  visitDisplayLabel,
} from './visitPaymentAttribution';

// Repeat customer: bought in January, came back in April for a booking and in May for a second aid.
const visits = [
  { id: '1', visitDate: '2026-01-10', hearingTest: true, hearingAidSale: true },
  { id: '2', visitDate: '2026-02-01', programming: true },
  { id: '3', visitDate: '2026-04-05', hearingAidBooked: true },
  { id: '4', visitDate: '2026-05-02', hearingAidSale: true },
];

test('explicit relatedVisitId wins over the payment date', () => {
  const a = attributePaymentToVisit({ relatedVisitId: '4', date: '2026-01-10' }, visits);
  assert.deepEqual(a, { visitIndex: 3, inferred: false });
});

test('unlinked payment goes to the latest visit on or before its date', () => {
  assert.equal(attributePaymentToVisit({ date: '2026-05-02', category: 'full_payment' }, visits).visitIndex, 3);
  assert.equal(attributePaymentToVisit({ date: '2026-04-20', category: 'booking_advance' }, visits).visitIndex, 2);
});

test('prefers an earlier visit whose services match what was paid for', () => {
  // Balance for the January hearing aid paid after the February programming visit.
  const a = attributePaymentToVisit({ date: '2026-02-15', category: 'hearing_aid' }, visits);
  assert.equal(a.visitIndex, 0);
  assert.equal(a.inferred, true);
});

test('payment before the first visit belongs to the earliest visit', () => {
  assert.equal(attributePaymentToVisit({ date: '2025-12-30' }, visits).visitIndex, 0);
});

test('payment without a date cannot be attributed when there are several visits', () => {
  assert.equal(attributePaymentToVisit({}, visits).visitIndex, null);
});

test('a stale relatedVisitId (visit deleted) falls back to the date', () => {
  assert.equal(attributePaymentToVisit({ relatedVisitId: '99', date: '2026-04-06' }, visits).visitIndex, 2);
});

test('sale cycle: visits up to a sale belong to it; after the last sale they belong to the last', () => {
  assert.equal(saleCycleVisitIndexFor(visits, 0), 0);
  assert.equal(saleCycleVisitIndexFor(visits, 1), 3);
  assert.equal(saleCycleVisitIndexFor(visits, 2), 3);
  assert.equal(saleCycleVisitIndexFor(visits, 3), 3);
  const later = [...visits, { id: '5', visitDate: '2026-08-01', programming: true }];
  assert.equal(saleCycleVisitIndexFor(later, 4), 3);
  assert.equal(saleCycleVisitIndexFor([{ id: '1', visitDate: '2026-01-01', hearingTest: true }], 0), null);
});

test('a booking for the next aid (no sale yet) is not folded into the previous invoice', () => {
  const next = [...visits, { id: '5', visitDate: '2026-09-01', hearingAidBooked: true }];
  assert.equal(saleCycleVisitIndexFor(next, 4), null);
});

test('visit labels are position based', () => {
  assert.equal(visitDisplayLabel(visits, 3).startsWith('Visit 4'), true);
  assert.equal(visitDisplayLabel(visits, null), 'Not linked to a visit');
});
