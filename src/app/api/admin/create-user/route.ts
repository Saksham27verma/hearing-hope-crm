import { NextResponse } from 'next/server';
import type { UserRecord } from 'firebase-admin/auth';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { sendPasswordResetEmailServer } from '@/server/admin/passwordReset';
import { deleteStaleUserDocsForEmail } from '@/server/admin/userFirestore';
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
    const centerIdsRaw = body?.centerIds;
    const isSuperAdminRaw = body?.isSuperAdmin;

    if (!email) return jsonError('Email is required', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Invalid email format', 400);
    if (!['admin', 'staff', 'audiologist'].includes(role)) return jsonError('Invalid role', 400);

    const auth = adminAuth();
    const resolvedDisplayName = displayName || email.split('@')[0];

    // Create Auth user, or reprovision when Firebase Auth still has this email (e.g. incomplete delete).
    const tempPassword = `Temp@${Math.random().toString(36).slice(2, 10)}A1!`;
    let newUser: UserRecord;
    let reprovisioned = false;
    try {
      newUser = await auth.createUser({
        email,
        displayName: resolvedDisplayName,
        password: tempPassword,
        emailVerified: false,
        disabled: false,
      });
    } catch (createErr: unknown) {
      const code = String((createErr as { code?: string }).code || '');
      if (!code.includes('email-already-exists') && !code.includes('auth/email-already-exists')) {
        throw createErr;
      }
      newUser = await auth.getUserByEmail(email);
      reprovisioned = true;
      await auth.updateUser(newUser.uid, {
        displayName: resolvedDisplayName,
        disabled: false,
        password: tempPassword,
      });
    }

    await deleteStaleUserDocsForEmail(db, email, newUser.uid);

    // Default module access (can be refined later in Users module)
    const defaultAllowedModulesByRole: Record<UserRole, string[]> = {
      admin: ['*'],
      staff: [
        'dashboard',
        'products',
        'inventory',
        'staff stock assign',
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

    let centerIds: string[] = [];
    if (Array.isArray(centerIdsRaw) && centerIdsRaw.length > 0) {
      centerIds = [...new Set(centerIdsRaw.map((x: unknown) => String(x).trim()).filter(Boolean))];
    }
    let centerId: string | null = null;
    if (centerIds.length > 0) {
      centerId = centerIds[0];
    } else if (centerIdRaw !== undefined && centerIdRaw !== null && centerIdRaw !== '') {
      centerId = String(centerIdRaw);
      centerIds = [centerId];
    }
    assertCanSetCenter(requester, centerId, centerIds.length > 0 ? centerIds : null);
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
      ...(centerIds.length > 0 ? { centerIds } : {}),
      isSuperAdmin: role === 'admin' ? isSuperAdmin : false,
    };

    await db.collection('users').doc(newUser.uid).set(userProfile);

    let passwordResetSent = false;
    let passwordResetError: string | null = null;
    try {
      await sendPasswordResetEmailServer(email);
      passwordResetSent = true;
    } catch (resetErr: unknown) {
      passwordResetError =
        resetErr instanceof Error ? resetErr.message : 'Failed to send password reset email';
      console.error('create-user password reset error:', resetErr);
    }

    try {
      await db.collection('activityLogs').add({
        timestamp: new Date(),
        userId: decoded.uid,
        userName: decoded.name || decoded.email || requester.uid,
        userEmail: decoded.email || '',
        userRole: requester.role || 'admin',
        centerId: requester.centerId || null,
        action: 'CREATE',
        module: 'Users',
        entityId: newUser.uid,
        entityName: displayName || email,
        description: `Created user ${displayName || email} with role "${role}"`,
        metadata: { email, role, displayName },
      });
    } catch { /* silent */ }

    return NextResponse.json({
      ok: true,
      uid: newUser.uid,
      email,
      reprovisioned,
      passwordResetSent,
      passwordResetError,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create user';
    console.error('create-user error:', err);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}

