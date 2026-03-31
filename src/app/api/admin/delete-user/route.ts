import { NextResponse } from 'next/server';
import type { DocumentSnapshot, Firestore, QuerySnapshot } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';
import type { UserProfile } from '@/context/AuthContext';
import { normalizeCenterIdsFromProfile } from '@/lib/tenant/centerScope';
import type { RequesterTenant } from '@/server/tenant/requesterTenant';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type UserDoc = {
  uid?: string;
  email?: string;
  centerId?: string | null;
  branchId?: string | null;
};

/** Collect Firestore `users` doc ids that belong to the same login (handles legacy duplicate docs). */
async function collectDuplicateUserDocIds(
  db: Firestore,
  initialDocId: string,
  data: UserDoc,
): Promise<Set<string>> {
  const ids = new Set<string>();
  ids.add(initialDocId);

  const authUid =
    typeof data.uid === 'string' && data.uid.trim() ? data.uid.trim() : initialDocId;
  if (authUid !== initialDocId) {
    ids.add(authUid);
  }

  const emailRaw = typeof data.email === 'string' ? data.email.trim() : '';
  const emailLower = emailRaw.toLowerCase();

  const queries: Promise<QuerySnapshot>[] = [];
  if (emailRaw) {
    queries.push(db.collection('users').where('email', '==', emailRaw).get());
  }
  if (emailLower && emailLower !== emailRaw) {
    queries.push(db.collection('users').where('email', '==', emailLower).get());
  }
  queries.push(db.collection('users').where('uid', '==', authUid).get());

  const snaps = await Promise.all(queries);
  for (const snap of snaps) {
    snap.docs.forEach((d) => ids.add(d.id));
  }

  return ids;
}

function assertCenterScopeForDocs(requester: RequesterTenant, snapshots: DocumentSnapshot[]): string | null {
  if (requester.isSuperAdmin) return null;
  const allowed =
    requester.centerIds.length > 0 ? requester.centerIds : requester.centerId ? [requester.centerId] : [];
  if (allowed.length === 0) return null;
  for (const s of snapshots) {
    if (!s.exists) continue;
    const t = s.data() as Record<string, unknown>;
    const targetCenters = normalizeCenterIdsFromProfile(t as UserProfile);
    if (targetCenters.length === 0) continue;
    const ok = targetCenters.some((c) => allowed.includes(c));
    if (!ok) {
      return 'Cannot delete users outside your center(s)';
    }
  }
  return null;
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);

    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const url = new URL(req.url);
    const fromQuery = url.searchParams.get('uid')?.trim() || '';
    const body = (await req.json().catch(() => null)) as { uid?: string } | null;
    const docId = (fromQuery || body?.uid || '').toString().trim();
    if (!docId) return jsonError('uid is required', 400);

    const db = adminDb();
    const targetSnap = await db.collection('users').doc(docId).get();
    if (!targetSnap.exists) {
      return jsonError('User profile not found', 404);
    }

    const data = targetSnap.data() as UserDoc;
    const authUid =
      typeof data.uid === 'string' && data.uid.trim() ? data.uid.trim() : docId;

    if (authUid === decoded.uid) {
      return jsonError('You cannot delete your own account', 400);
    }

    const docIdsToDelete = await collectDuplicateUserDocIds(db, docId, data);

    const docsToVerify = await Promise.all(
      [...docIdsToDelete].map((id) => db.collection('users').doc(id).get()),
    );
    const scopeErr = assertCenterScopeForDocs(requester, docsToVerify);
    if (scopeErr) return jsonError(scopeErr, 403);

    const auth = adminAuth();
    await auth.deleteUser(authUid).catch((e: { code?: string }) => {
      if (String(e?.code || '').includes('user-not-found')) return;
      throw e;
    });

    for (const id of docIdsToDelete) {
      await db.collection('users').doc(id).delete();
      await db.collection('userPresence').doc(id).delete().catch(() => {});
    }

    return NextResponse.json({ ok: true, deletedDocIds: [...docIdsToDelete], authUid });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete user';
    console.error('delete-user error:', err);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}
