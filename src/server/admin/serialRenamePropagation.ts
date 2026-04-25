import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';

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

type CollectionName = (typeof TARGET_COLLECTIONS)[number];

export type SerialOccurrence = {
  collection: CollectionName;
  docId: string;
  fieldPath: string;
  value: string;
};

export type SerialRenameSource = {
  collection: 'materialInward' | 'purchases';
  docId: string;
};

export type SerialRenameConflict = {
  collection: CollectionName;
  docId: string;
  fieldPath: string;
};

export type SerialRenameResult = {
  ok: true;
  changedDocs: number;
  changedFields: number;
  updatedByCollection: Record<string, number>;
};

function normalizeSerial(value: unknown): string {
  return String(value ?? '').trim();
}

function replaceCsvSerial(serialList: string, oldSerial: string, newSerial: string): string {
  const tokens = serialList
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return serialList;
  const replaced = tokens.map((token) => (token === oldSerial ? newSerial : token));
  return replaced.join(', ');
}

function findOccurrencesInValue(
  value: unknown,
  oldSerial: string,
  fieldPath: string,
  occurrences: string[],
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, idx) => {
      const nextPath = `${fieldPath}[${idx}]`;
      if (typeof entry === 'string' && normalizeSerial(entry) === oldSerial) {
        occurrences.push(nextPath);
      } else {
        findOccurrencesInValue(entry, oldSerial, nextPath, occurrences);
      }
    });
    return;
  }

  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = fieldPath ? `${fieldPath}.${key}` : key;
    if (key === 'serialNumbers' && Array.isArray(child)) {
      child.forEach((serial, idx) => {
        if (normalizeSerial(serial) === oldSerial) {
          occurrences.push(`${nextPath}[${idx}]`);
        }
      });
      continue;
    }
    if (SERIAL_STRING_KEYS.has(key) && typeof child === 'string') {
      const trimmed = normalizeSerial(child);
      if (trimmed === oldSerial) {
        occurrences.push(nextPath);
        continue;
      }
      if (trimmed.includes(',')) {
        const tokens = trimmed
          .split(',')
          .map((token) => token.trim())
          .filter(Boolean);
        if (tokens.includes(oldSerial)) {
          occurrences.push(nextPath);
        }
      }
      continue;
    }
    findOccurrencesInValue(child, oldSerial, nextPath, occurrences);
  }
}

function replaceSerialDeep(value: unknown, oldSerial: string, newSerial: string): { next: unknown; changed: number } {
  if (Array.isArray(value)) {
    let changed = 0;
    const next = value.map((entry) => {
      if (typeof entry === 'string') {
        const trimmed = normalizeSerial(entry);
        if (trimmed === oldSerial) {
          changed += 1;
          return newSerial;
        }
        return entry;
      }
      const nested = replaceSerialDeep(entry, oldSerial, newSerial);
      changed += nested.changed;
      return nested.next;
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
      const serials = child.map((serial) => {
        const trimmed = normalizeSerial(serial);
        if (trimmed === oldSerial) {
          changed += 1;
          return newSerial;
        }
        return serial;
      });
      nextObj[key] = serials;
      continue;
    }

    if (SERIAL_STRING_KEYS.has(key) && typeof child === 'string') {
      const trimmed = normalizeSerial(child);
      if (trimmed === oldSerial) {
        changed += 1;
        nextObj[key] = newSerial;
        continue;
      }
      if (trimmed.includes(',')) {
        const replaced = replaceCsvSerial(trimmed, oldSerial, newSerial);
        if (replaced !== trimmed) {
          changed += 1;
          nextObj[key] = replaced;
          continue;
        }
      }
      nextObj[key] = child;
      continue;
    }

    const nested = replaceSerialDeep(child, oldSerial, newSerial);
    changed += nested.changed;
    nextObj[key] = nested.next;
  }

  return { next: nextObj, changed };
}

async function fetchOccurrences(
  db: Firestore,
  serial: string,
): Promise<SerialOccurrence[]> {
  const occurrences: SerialOccurrence[] = [];
  const uniqueCollections = [...new Set(TARGET_COLLECTIONS)];

  for (const collectionName of uniqueCollections) {
    const snap = await db.collection(collectionName).get();
    for (const docSnap of snap.docs) {
      const paths: string[] = [];
      findOccurrencesInValue(docSnap.data(), serial, '', paths);
      for (const path of paths) {
        occurrences.push({
          collection: collectionName,
          docId: docSnap.id,
          fieldPath: path,
          value: serial,
        });
      }
    }
  }

  return occurrences;
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

export async function renameSerialEverywhere(
  db: Firestore,
  args: {
    oldSerial: string;
    newSerial: string;
    source: SerialRenameSource;
  },
): Promise<SerialRenameResult> {
  const oldSerial = normalizeSerial(args.oldSerial);
  const newSerial = normalizeSerial(args.newSerial);

  if (!oldSerial || !newSerial) {
    throw new Error('Both oldSerial and newSerial are required');
  }
  if (oldSerial === newSerial) {
    return { ok: true, changedDocs: 0, changedFields: 0, updatedByCollection: {} };
  }

  const [oldOccurrences, newOccurrences] = await Promise.all([
    fetchOccurrences(db, oldSerial),
    fetchOccurrences(db, newSerial),
  ]);

  const conflicts: SerialRenameConflict[] = newOccurrences
    .filter((entry) => !(entry.collection === args.source.collection && entry.docId === args.source.docId))
    .map((entry) => ({
      collection: entry.collection,
      docId: entry.docId,
      fieldPath: entry.fieldPath,
    }));

  if (conflicts.length > 0) {
    const error = new Error('Serial conflict found');
    (error as Error & { conflicts?: SerialRenameConflict[] }).conflicts = conflicts;
    throw error;
  }

  if (oldOccurrences.length === 0) {
    return { ok: true, changedDocs: 0, changedFields: 0, updatedByCollection: {} };
  }

  const docsToMutate = new Map<string, { ref: DocumentReference<DocumentData>; data: Record<string, unknown> }>();
  const changedByCollection: Record<string, number> = {};
  let changedFields = 0;

  for (const coll of [...new Set(oldOccurrences.map((item) => item.collection))]) {
    const snap = await db.collection(coll).get();
    for (const docSnap of snap.docs) {
      const before = docSnap.data() as Record<string, unknown>;
      const replaced = replaceSerialDeep(before, oldSerial, newSerial);
      if (replaced.changed <= 0) continue;
      const key = `${coll}/${docSnap.id}`;
      docsToMutate.set(key, { ref: docSnap.ref, data: replaced.next as Record<string, unknown> });
      changedByCollection[coll] = (changedByCollection[coll] || 0) + 1;
      changedFields += replaced.changed;
    }
  }

  const updatedCount = await commitInBatches(db, [...docsToMutate.values()]);

  return {
    ok: true,
    changedDocs: updatedCount,
    changedFields,
    updatedByCollection: changedByCollection,
  };
}

export const __serialRenameTestUtils = {
  normalizeSerial,
  replaceCsvSerial,
  replaceSerialDeep,
  findOccurrencesInValue,
};
