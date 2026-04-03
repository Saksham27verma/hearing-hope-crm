import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

const BATCH_SIZE = 450;

export type CascadeRenameResult = {
  ok: true;
  updatedByCollection: Record<string, number>;
  totalUpdated: number;
};

function trimEq(a: string, b: string): boolean {
  return String(a || '').trim() === String(b || '').trim();
}

async function commitInBatches(
  db: Firestore,
  ops: Array<{ ref: DocumentReference; data: Record<string, unknown> }>,
): Promise<number> {
  let n = 0;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = ops.slice(i, i + BATCH_SIZE);
    for (const { ref, data } of chunk) {
      // Firestore Admin UpdateData typing is strict; values here are plain strings / string[].
      batch.update(ref, data as { [key: string]: string | string[] });
    }
    await batch.commit();
    n += chunk.length;
  }
  return n;
}

/**
 * Replace exact business company name `oldName` with `newName` on all denormalized Firestore fields.
 */
export async function cascadeRenameBusinessCompany(
  db: Firestore,
  oldName: string,
  newName: string,
): Promise<CascadeRenameResult> {
  const from = String(oldName || '').trim();
  const to = String(newName || '').trim();
  if (!from || !to || from === to) {
    return { ok: true, updatedByCollection: {}, totalUpdated: 0 };
  }

  const updatedByCollection: Record<string, number> = {};
  const allOps: Array<{ ref: DocumentReference; data: Record<string, unknown> }> = [];

  // --- centers: companies[] ---
  const beforeCenters = allOps.length;
  const centersSnap = await db.collection('centers').get();
  for (const d of centersSnap.docs) {
    const data = d.data() as { companies?: unknown };
    const arr = Array.isArray(data.companies) ? (data.companies as string[]) : [];
    if (!arr.some((c) => trimEq(c, from))) continue;
    const next = arr.map((c) => (trimEq(c, from) ? to : c));
    allOps.push({ ref: d.ref, data: { companies: next } });
  }
  updatedByCollection.centers = allOps.length - beforeCenters;

  // --- simple top-level company field ---
  const simpleCollections = [
    'purchases',
    'materialInward',
    'materialsOut',
    'materials',
    'manufacturerIncentives',
    'distributions',
  ] as const;

  for (const coll of simpleCollections) {
    const before = allOps.length;
    const q = await db.collection(coll).where('company', '==', from).get();
    for (const d of q.docs) {
      allOps.push({ ref: d.ref, data: { company: to } });
    }
    updatedByCollection[coll] = allOps.length - before;
  }

  // --- stockTransfers: company | fromCompany | toCompany ---
  const stIds = new Set<string>();
  const [st1, st2, st3] = await Promise.all([
    db.collection('stockTransfers').where('company', '==', from).get(),
    db.collection('stockTransfers').where('fromCompany', '==', from).get(),
    db.collection('stockTransfers').where('toCompany', '==', from).get(),
  ]);
  for (const s of [st1, st2, st3]) {
    s.docs.forEach((d) => stIds.add(d.id));
  }

  const beforeSt = allOps.length;
  for (const id of stIds) {
    const d = await db.collection('stockTransfers').doc(id).get();
    if (!d.exists) continue;
    const data = d.data() as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (trimEq(String(data.company ?? ''), from)) patch.company = to;
    if (trimEq(String(data.fromCompany ?? ''), from)) patch.fromCompany = to;
    if (trimEq(String(data.toCompany ?? ''), from)) patch.toCompany = to;
    if (Object.keys(patch).length > 0) {
      allOps.push({ ref: d.ref, data: patch });
    }
  }
  updatedByCollection.stockTransfers = allOps.length - beforeSt;

  const totalUpdated = await commitInBatches(db, allOps);

  return {
    ok: true,
    updatedByCollection,
    totalUpdated,
  };
}
