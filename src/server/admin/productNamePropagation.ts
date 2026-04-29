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

type CollectionName = (typeof TARGET_COLLECTIONS)[number];

export type ProductRenameResult = {
  ok: true;
  changedDocs: number;
  changedLineItems: number;
  updatedByCollection: Record<string, number>;
};

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function objectHasTargetProductIdentity(obj: Record<string, unknown>, productId: string): boolean {
  return (
    normalize(obj.productId) === productId ||
    normalize(obj.hearingAidProductId) === productId
  );
}

function replaceProductNameDeep(
  value: unknown,
  productId: string,
  newName: string,
): { next: unknown; changedLineItems: number } {
  if (Array.isArray(value)) {
    let changedLineItems = 0;
    const next = value.map((entry) => {
      const nested = replaceProductNameDeep(entry, productId, newName);
      changedLineItems += nested.changedLineItems;
      return nested.next;
    });
    return { next, changedLineItems };
  }

  if (!value || typeof value !== 'object') {
    return { next: value, changedLineItems: 0 };
  }

  const obj = value as Record<string, unknown>;
  const nextObj: Record<string, unknown> = {};
  let changedLineItems = 0;

  for (const [key, child] of Object.entries(obj)) {
    const nested = replaceProductNameDeep(child, productId, newName);
    nextObj[key] = nested.next;
    changedLineItems += nested.changedLineItems;
  }

  if (objectHasTargetProductIdentity(obj, productId)) {
    let changedThisItem = false;
    if (typeof obj.name === 'string' && normalize(obj.name) !== newName) {
      nextObj.name = newName;
      changedThisItem = true;
    }
    if (typeof obj.productName === 'string' && normalize(obj.productName) !== newName) {
      nextObj.productName = newName;
      changedThisItem = true;
    }
    if (changedThisItem) {
      changedLineItems += 1;
    }
  }

  return { next: nextObj, changedLineItems };
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

export async function renameProductEverywhere(
  db: Firestore,
  args: { productId: string; newName: string },
): Promise<ProductRenameResult> {
  const productId = normalize(args.productId);
  const newName = normalize(args.newName);

  if (!productId || !newName) {
    throw new Error('productId and newName are required');
  }

  const docsToMutate = new Map<string, { ref: DocumentReference<DocumentData>; data: Record<string, unknown> }>();
  const changedByCollection: Record<string, number> = {};
  let changedLineItems = 0;

  for (const collectionName of [...new Set(TARGET_COLLECTIONS)]) {
    const snap = await db.collection(collectionName).get();
    for (const docSnap of snap.docs) {
      const before = docSnap.data() as Record<string, unknown>;
      const replaced = replaceProductNameDeep(before, productId, newName);
      if (replaced.changedLineItems <= 0) continue;

      const key = `${collectionName}/${docSnap.id}`;
      docsToMutate.set(key, { ref: docSnap.ref, data: replaced.next as Record<string, unknown> });
      changedByCollection[collectionName] = (changedByCollection[collectionName] || 0) + 1;
      changedLineItems += replaced.changedLineItems;
    }
  }

  const changedDocs = await commitInBatches(db, [...docsToMutate.values()]);
  return {
    ok: true,
    changedDocs,
    changedLineItems,
    updatedByCollection: changedByCollection,
  };
}

export const __productRenameTestUtils = {
  normalize,
  replaceProductNameDeep,
};
