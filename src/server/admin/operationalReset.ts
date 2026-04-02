import type { DocumentData, Firestore, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

/** Root collections wiped by operational reset (Admin SDK). Enquiries are rewritten, not deleted. */
export const OPERATIONAL_RESET_COLLECTIONS: string[] = [
  'sales',
  'purchases',
  'materialInward',
  'materialsOut',
  'stockTransfers',
  'inventory',
  'distributions',
  'appointments',
  'visitors',
  'telecallingRecords',
  'interaction',
  'cashRegister',
  'cashDailySheets',
  'materials',
  'hopeAiIndex',
  'hopeAiLogs',
];

const ENQUIRY_FIELD_WHITELIST = new Set([
  'name',
  'phone',
  'email',
  'address',
  'reference',
  'status',
  'enquiryType',
  'visitorType',
  'assignedTo',
  'telecaller',
  'center',
  'visitingCenter',
  'subject',
  'message',
  'notes',
  'companyName',
  'contactPerson',
  'purposeOfVisit',
  'createdAt',
]);

/**
 * Full document replace: only whitelisted identity/routing fields, empty visits/followUps/payments.
 */
export function buildSanitizedEnquiry(existing: DocumentData | undefined): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  if (existing && typeof existing === 'object') {
    for (const key of ENQUIRY_FIELD_WHITELIST) {
      if (Object.prototype.hasOwnProperty.call(existing, key) && existing[key] !== undefined) {
        base[key] = existing[key];
      }
    }
  }
  base.visits = [];
  base.followUps = [];
  base.payments = [];
  base.activeFormTypes = [];
  base.updatedAt = FieldValue.serverTimestamp();
  base.operationalResetAt = FieldValue.serverTimestamp();
  return base;
}

const DELETE_BATCH_SIZE = 500;

/**
 * Recursively deletes documents in batches (Firestore recommended pattern for large collections).
 */
export async function deleteAllDocumentsInCollection(
  db: Firestore,
  collectionId: string
): Promise<number> {
  const col = db.collection(collectionId);
  let deleted = 0;

  while (true) {
    const snap = await col.orderBy('__name__').limit(DELETE_BATCH_SIZE).get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
  }

  return deleted;
}

/**
 * Count documents (paged) for dry-run previews.
 */
export async function countDocumentsInCollection(
  db: Firestore,
  collectionId: string
): Promise<number> {
  const col = db.collection(collectionId);
  let count = 0;
  let lastDoc: QueryDocumentSnapshot | null = null;
  for (;;) {
    let q: Query = col.orderBy('__name__').limit(DELETE_BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    count += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < DELETE_BATCH_SIZE) break;
  }
  return count;
}

const ENQUIRY_WRITE_BATCH = 450;

/** Replace every enquiry doc with sanitized payload (full replace, not merge). */
export async function rewriteAllEnquiriesSanitized(db: Firestore): Promise<number> {
  const col = db.collection('enquiries');
  let updated = 0;
  let lastDoc: QueryDocumentSnapshot | null = null;
  for (;;) {
    let q: Query = col.orderBy('__name__').limit(ENQUIRY_WRITE_BATCH);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const d of snap.docs) {
      batch.set(d.ref, buildSanitizedEnquiry(d.data()));
    }
    await batch.commit();
    updated += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < ENQUIRY_WRITE_BATCH) break;
  }
  return updated;
}
