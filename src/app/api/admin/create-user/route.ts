import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import {
  assertAdmin,
  assertCanSetCenter,
  assertCanSetSuperAdmin,
  getRequesterTenant,
} from '@/server/tenant/requesterTenant';

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

    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const db = adminDb();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const email = (body?.email || '').toString().trim().toLowerCase();
    const displayName = (body?.displayName || '').toString().trim();
    const role = (body?.role || '').toString().trim() as UserRole;
    const allowedModulesBody = body?.allowedModules;
    const centerIdRaw = body?.centerId;
    const isSuperAdminRaw = body?.isSuperAdmin;

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
      staff: [
        'dashboard',
        'products',
        'inventory',
        'purchases',
        'materials',
        'deliveries',
        'distribution sales',
        'sales',
        'invoice manager',
        'parties',
        'centers',
        'interaction',
        'stock transfer',
        'cash register',
        'appointment scheduler',
        'appointments',
        'reports',
      ],
      audiologist: ['dashboard', 'products', 'inventory', 'interaction', 'appointment scheduler', 'appointments'],
    };

    let allowedModules: string[] = defaultAllowedModulesByRole[role];
    if (Array.isArray(allowedModulesBody) && allowedModulesBody.length > 0) {
      allowedModules = allowedModulesBody.map((x: unknown) => String(x).toLowerCase().trim()).filter(Boolean);
    }

    let centerId: string | null = null;
    if (centerIdRaw !== undefined && centerIdRaw !== null && centerIdRaw !== '') {
      centerId = String(centerIdRaw);
    }
    assertCanSetCenter(requester, centerId);
    const isSuperAdmin = Boolean(isSuperAdminRaw);
    assertCanSetSuperAdmin(requester, isSuperAdmin);

    const userProfile: Record<string, unknown> = {
      uid: newUser.uid,
      email,
      displayName: newUser.displayName || displayName || email.split('@')[0],
      role,
      allowedModules,
      createdAt: Date.now(),
      createdBy: decoded.uid,
      centerId,
      branchId: centerId,
      isSuperAdmin: role === 'admin' ? isSuperAdmin : false,
    };

    await db.collection('users').doc(newUser.uid).set(userProfile, { merge: true });

    return NextResponse.json({ ok: true, uid: newUser.uid, email });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create user';
    console.error('create-user error:', err);
    if (String((err as { code?: string }).code || '').includes('auth/email-already-exists')) {
      return jsonError('A user with this email already exists', 409);
    }
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}

