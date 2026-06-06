import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import { stripSerialPairsFromProductLines } from '@/utils/stripSerialPairsForFirestore';

const BATCH_SIZE = 350;

const TARGET_COLLECTIONS = [
  'materialInward',
  'purchases',
  'materialsOut',
  'stockTransfers',
  'stockTransfer',
  'sales',
  'enquiries',
  'distributions',
] as const;

const SERIAL_STRING_KEYS = new Set([
  'serialNumber',
  'trialSerialNumber',
  'secondTrialSerialNumber',
  'returnSerialNumber',
]);

export type SerialPurgeResult = {
  ok: true;
  serialsRequested: number;
  changedDocs: number;
  changedFields: number;
  updatedByCollection: Record<string, number>;
};

function normalizeSerial(value: unknown): string {
  return String(value ?? '').trim();
}

function removeCsvSerial(serialList: string, serialToRemove: string): string {
  const tokens = serialList
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  const filtered = tokens.filter((token) => token !== serialToRemove);
  return filtered.join(', ');
}

function removeSerialDeep(value: unknown, serialToRemove: string): { next: unknown; changed: number } {
  const target = normalizeSerial(serialToRemove);
  if (!target) return { next: value, changed: 0 };

  if (Array.isArray(value)) {
    let changed = 0;
    const next: unknown[] = [];
    value.forEach((entry) => {
      if (typeof entry === 'string') {
        if (normalizeSerial(entry) === target) {
          changed += 1;
          return;
        }
        next.push(entry);
        return;
      }
      const nested = removeSerialDeep(entry, target);
      changed += nested.changed;
      next.push(nested.next);
    });
    return { next, changed };
  }

  if (!value || typeof value !== 'object') {
    return { next: value, changed: 0 };
  }

  let changed = 0;
  const nextObj: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'serialNumbers' && Array.isArray(child)) {
      const filtered = child.filter((serial) => normalizeSerial(serial) !== target);
      if (filtered.length !== child.length) {
        changed += child.length - filtered.length;
      }
      nextObj[key] = filtered;
      continue;
    }

    if (SERIAL_STRING_KEYS.has(key) && typeof child === 'string') {
      const trimmed = normalizeSerial(child);
      if (trimmed === target) {
        changed += 1;
        continue;
      }
      if (trimmed.includes(',')) {
        const nextCsv = removeCsvSerial(trimmed, target);
        if (nextCsv !== trimmed) {
          changed += 1;
          if (nextCsv) nextObj[key] = nextCsv;
          continue;
        }
      }
      nextObj[key] = child;
      continue;
    }

    const nested = removeSerialDeep(child, target);
    changed += nested.changed;
    nextObj[key] = nested.next;
  }

  return { next: nextObj, changed };
}

function serialsOnLine(prod: Record<string, unknown>): string[] {
  const raw = prod.serialNumbers;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((sn) => normalizeSerial(sn)).filter(Boolean);
  }
  const one = prod.serialNumber;
  if (one != null && normalizeSerial(one)) return [normalizeSerial(one)];
  return [];
}

function cleanupDocumentProducts(data: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(data.products)) return data;

  const products = (data.products as Record<string, unknown>[])
    .map((line) => {
      if (!line || typeof line !== 'object') return line;
      const serials = serialsOnLine(line);
      if (serials.length > 0) return line;
      const qty = Number(line.quantity ?? 0);
      if (qty > 0) return line;
      return null;
    })
    .filter((line): line is Record<string, unknown> => line !== null);

  return {
    ...data,
    products: stripSerialPairsFromProductLines(products),
  };
}

function removeSerialsFromDocument(
  data: Record<string, unknown>,
  serialsToRemove: Set<string>,
): { next: Record<string, unknown>; changed: number } {
  let current: unknown = data;
  let changed = 0;

  serialsToRemove.forEach((serial) => {
    const result = removeSerialDeep(current, serial);
    current = result.next;
    changed += result.changed;
  });

  const cleaned = cleanupDocumentProducts(current as Record<string, unknown>);
  if (Array.isArray(data.products) && Array.isArray(cleaned.products)) {
    if ((data.products as unknown[]).length !== (cleaned.products as unknown[]).length) {
      changed += 1;
    }
  }

  return { next: cleaned, changed };
}

async function commitInBatches(
  db: Firestore,
  ops: Array<{ ref: DocumentReference<DocumentData>; data: Record<string, unknown> }>,
): Promise<number> {
  let updated = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = ops.slice(i, i + BATCH_SIZE);
    for (const { ref, data } of chunk) {
      batch.set(ref, data, { merge: false });
    }
    await batch.commit();
    updated += chunk.length;
  }
  return updated;
}

export async function purgeSerialsEverywhere(
  db: Firestore,
  serials: string[],
): Promise<SerialPurgeResult> {
  const serialsToRemove = new Set(
    serials.map((serial) => normalizeSerial(serial)).filter(Boolean),
  );

  if (serialsToRemove.size === 0) {
    return {
      ok: true,
      serialsRequested: 0,
      changedDocs: 0,
      changedFields: 0,
      updatedByCollection: {},
    };
  }

  const docsToMutate = new Map<string, { ref: DocumentReference<DocumentData>; data: Record<string, unknown> }>();
  const changedByCollection: Record<string, number> = {};
  let changedFields = 0;
  const uniqueCollections = [...new Set(TARGET_COLLECTIONS)];

  for (const collectionName of uniqueCollections) {
    const snap = await db.collection(collectionName).get();
    for (const docSnap of snap.docs) {
      const before = docSnap.data() as Record<string, unknown>;
      const purged = removeSerialsFromDocument(before, serialsToRemove);
      if (purged.changed <= 0) continue;

      const key = `${collectionName}/${docSnap.id}`;
      docsToMutate.set(key, { ref: docSnap.ref, data: purged.next });
      changedByCollection[collectionName] = (changedByCollection[collectionName] || 0) + 1;
      changedFields += purged.changed;
    }
  }

  const changedDocs = await commitInBatches(db, [...docsToMutate.values()]);

  return {
    ok: true,
    serialsRequested: serialsToRemove.size,
    changedDocs,
    changedFields,
    updatedByCollection: changedByCollection,
  };
}

export const __serialPurgeTestUtils = {
  normalizeSerial,
  removeSerialDeep,
  removeSerialsFromDocument,
  cleanupDocumentProducts,
};
