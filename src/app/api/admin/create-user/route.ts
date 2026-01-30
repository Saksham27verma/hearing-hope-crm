import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';

type UserRole = 'admin' | 'staff' | 'audiologist';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);

    // Authorize via Firestore user profile role (this app stores roles in `users/{uid}`)
    const db = adminDb();
    const requesterSnap = await db.collection('users').doc(decoded.uid).get();
    const requesterRole = (requesterSnap.exists ? (requesterSnap.data() as any)?.role : null) as UserRole | null;
    if (requesterRole !== 'admin') return jsonError('Forbidden', 403);

    const body = await req.json().catch(() => null);
    const email = (body?.email || '').toString().trim().toLowerCase();
    const displayName = (body?.displayName || '').toString().trim();
    const role = (body?.role || '').toString().trim() as UserRole;

    if (!email) return jsonError('Email is required', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Invalid email format', 400);
    if (!['admin', 'staff', 'audiologist'].includes(role)) return jsonError('Invalid role', 400);

    // Create Auth user with a random temporary password; user will set their own via password reset email.
    const tempPassword = `Temp@${Math.random().toString(36).slice(2, 10)}A1!`;
    const newUser = await adminAuth().createUser({
      email,
      displayName: displayName || email.split('@')[0],
      password: tempPassword,
      emailVerified: false,
      disabled: false,
    });

    // Default module access (can be refined later in Users module)
    const defaultAllowedModulesByRole: Record<UserRole, string[]> = {
      admin: ['*'],
      staff: ['inventory', 'products', 'materials', 'parties', 'interaction', 'sales', 'purchases', 'cash', 'centers', 'stock', 'reports'],
      audiologist: ['interaction', 'appointments'],
    };

    const userProfile = {
      uid: newUser.uid,
      email,
      displayName: newUser.displayName || displayName || email.split('@')[0],
      role,
      allowedModules: defaultAllowedModulesByRole[role],
      createdAt: Date.now(),
      createdBy: decoded.uid,
    };

    await db.collection('users').doc(newUser.uid).set(userProfile, { merge: true });

    return NextResponse.json({ ok: true, uid: newUser.uid, email });
  } catch (err: any) {
    const message = err?.message || 'Failed to create user';
    console.error('create-user error:', err);
    // Handle "email already exists" nicely
    if (String(err?.code || '').includes('auth/email-already-exists')) {
      return jsonError('A user with this email already exists', 409);
    }
    return jsonError(message, 500);
  }
}

