import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';

type UserRole = 'admin' | 'staff' | 'audiologist';

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

    const db = adminDb();
    const requesterSnap = await db.collection('users').doc(decoded.uid).get();
    const requesterRole = (requesterSnap.exists ? (requesterSnap.data() as any)?.role : null) as UserRole | null;
    if (requesterRole !== 'admin') return jsonError('Forbidden', 403);

    const body = await req.json().catch(() => null);
    const uid = (body?.uid || '').toString().trim();
    if (!uid) return jsonError('uid is required', 400);
    if (uid === decoded.uid) return jsonError('You cannot delete your own account', 400);

    const auth = adminAuth();
    await auth.deleteUser(uid).catch((e: any) => {
      if (String(e?.code || '').includes('user-not-found')) return;
      throw e;
    });
    await db.collection('users').doc(uid).delete().catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const message = err?.message || 'Failed to delete user';
    console.error('delete-user error:', err);
    return jsonError(message, 500);
  }
}
