import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';

type UserRole = 'admin' | 'staff' | 'audiologist';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function PATCH(req: Request) {
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

    const displayName = body?.displayName !== undefined ? String(body.displayName).trim() : undefined;
    const role = body?.role !== undefined ? (String(body.role).trim() as UserRole) : undefined;
    const allowedModules = body?.allowedModules !== undefined ? body.allowedModules : undefined;
    const email = body?.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;

    if (role !== undefined && !['admin', 'staff', 'audiologist'].includes(role)) {
      return jsonError('Invalid role', 400);
    }
    if (allowedModules !== undefined && !Array.isArray(allowedModules)) {
      return jsonError('allowedModules must be an array of strings', 400);
    }
    if (email !== undefined && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError('Invalid email format', 400);
    }

    const auth = adminAuth();
    const updates: Record<string, unknown> = { updatedAt: Date.now(), updatedBy: decoded.uid };
    if (displayName !== undefined) updates.displayName = displayName || null;
    if (role !== undefined) updates.role = role;
    if (allowedModules !== undefined) updates.allowedModules = allowedModules;

    if (email !== undefined && email) {
      await auth.updateUser(uid, { email });
      updates.email = email;
    }

    await db.collection('users').doc(uid).set(updates, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const message = err?.message || 'Failed to update user';
    console.error('update-user error:', err);
    if (String(err?.code || '').includes('auth/email-already-exists')) {
      return jsonError('A user with this email already exists', 409);
    }
    return jsonError(message, 500);
  }
}
