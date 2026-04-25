import assert from 'node:assert/strict';
import test from 'node:test';
import { __serialRenameTestUtils } from '@/server/admin/serialRenamePropagation';

test('replaceSerialDeep replaces serialNumbers arrays', () => {
  const input = {
    products: [
      {
        name: 'HA',
        serialNumbers: ['A-001', 'B-001'],
      },
    ],
  };
  const result = __serialRenameTestUtils.replaceSerialDeep(input, 'A-001', 'A-999');
  assert.equal(result.changed, 1);
  assert.deepEqual(result.next, {
    products: [
      {
        name: 'HA',
        serialNumbers: ['A-999', 'B-001'],
      },
    ],
  });
});

test('replaceSerialDeep replaces csv serial strings', () => {
  const input = {
    serialNumber: 'L-101, R-101',
    returnSerialNumber: 'L-101, R-101',
  };
  const result = __serialRenameTestUtils.replaceSerialDeep(input, 'R-101', 'R-202');
  assert.equal(result.changed, 2);
  assert.deepEqual(result.next, {
    serialNumber: 'L-101, R-202',
    returnSerialNumber: 'L-101, R-202',
  });
});

test('findOccurrencesInValue finds nested serial fields', () => {
  const input = {
    visits: [
      {
        trialSerialNumber: 'T-1',
        products: [{ serialNumber: 'T-1' }],
      },
    ],
  };
  const found: string[] = [];
  __serialRenameTestUtils.findOccurrencesInValue(input, 'T-1', '', found);
  assert.deepEqual(found.sort(), ['visits[0].products[0].serialNumber', 'visits[0].trialSerialNumber']);
});
