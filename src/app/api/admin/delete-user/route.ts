import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';
import { normalizeCenterId } from '@/lib/tenant/centerScope';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
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
    const uid = (fromQuery || body?.uid || '').toString().trim();
    if (!uid) return jsonError('uid is required', 400);
    if (uid === decoded.uid) return jsonError('You cannot delete your own account', 400);

    const db = adminDb();
    const targetSnap = await db.collection('users').doc(uid).get();
    if (targetSnap.exists && !requester.isSuperAdmin && requester.centerId) {
      const target = targetSnap.data() as { centerId?: string | null; branchId?: string | null };
      const tCenter = normalizeCenterId(target);
      if (tCenter !== requester.centerId) {
        return jsonError('Cannot delete users outside your center', 403);
      }
    }

    const auth = adminAuth();
    await auth.deleteUser(uid).catch((e: { code?: string }) => {
      if (String(e?.code || '').includes('user-not-found')) return;
      throw e;
    });

    await db.collection('users').doc(uid).delete();
    await db.collection('userPresence').doc(uid).delete().catch(() => {
      /* optional cleanup — ignore if doc missing */
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete user';
    console.error('delete-user error:', err);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}
