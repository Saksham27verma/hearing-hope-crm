import type { Firestore } from 'firebase-admin/firestore';

/** Remove legacy Firestore user rows for an email that no longer match the Auth UID. */
export async function deleteStaleUserDocsForEmail(
  db: Firestore,
  email: string,
  authUid: string,
): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  const removed: string[] = [];
  const seen = new Set<string>();

  const queries = [db.collection('users').where('email', '==', normalized).get()];
  if (normalized !== email.trim()) {
    queries.push(db.collection('users').where('email', '==', email.trim()).get());
  }

  const snaps = await Promise.all(queries);
  for (const snap of snaps) {
    for (const docSnap of snap.docs) {
      if (docSnap.id === authUid || seen.has(docSnap.id)) continue;
      seen.add(docSnap.id);
      await docSnap.ref.delete();
      await db.collection('userPresence').doc(docSnap.id).delete().catch(() => {});
      removed.push(docSnap.id);
    }
  }

  return removed;
}
