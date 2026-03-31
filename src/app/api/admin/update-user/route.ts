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

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);

    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const uid = (body?.uid ?? '').toString().trim();
    if (!uid) return jsonError('uid is required', 400);

    const displayName = body?.displayName !== undefined ? String(body.displayName).trim() : undefined;
    const role = body?.role !== undefined ? (String(body.role).trim() as UserRole) : undefined;
    const allowedModules = body?.allowedModules !== undefined ? body.allowedModules : undefined;
    const email = body?.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
    const centerIdRaw = body?.centerId;
    const centerIdsRaw = body?.centerIds;
    const isSuperAdminRaw = body?.isSuperAdmin;

    if (role !== undefined && !['admin', 'staff', 'audiologist'].includes(role)) {
      return jsonError('Invalid role', 400);
    }
    if (allowedModules !== undefined && !Array.isArray(allowedModules)) {
      return jsonError('allowedModules must be an array of strings', 400);
    }
    if (email !== undefined && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonError('Invalid email format', 400);
    }

    let nextCenterId: string | null | undefined;
    let nextCenterIds: string[] | undefined;
    if (centerIdsRaw !== undefined) {
      if (Array.isArray(centerIdsRaw) && centerIdsRaw.length > 0) {
        nextCenterIds = [...new Set(centerIdsRaw.map((x: unknown) => String(x).trim()).filter(Boolean))];
        nextCenterId = nextCenterIds[0];
        assertCanSetCenter(requester, nextCenterId, nextCenterIds);
      } else {
        nextCenterIds = [];
        nextCenterId = null;
        assertCanSetCenter(requester, null, null);
      }
    } else if (centerIdRaw !== undefined) {
      if (centerIdRaw === null || centerIdRaw === '') {
        nextCenterId = null;
        assertCanSetCenter(requester, null, null);
      } else {
        nextCenterId = String(centerIdRaw);
        nextCenterIds = [nextCenterId];
        assertCanSetCenter(requester, nextCenterId, nextCenterIds);
      }
    }

    if (isSuperAdminRaw !== undefined) {
      assertCanSetSuperAdmin(requester, Boolean(isSuperAdminRaw));
    }

    const auth = adminAuth();
    const updates: Record<string, unknown> = { updatedAt: Date.now(), updatedBy: decoded.uid };
    if (displayName !== undefined) updates.displayName = displayName || null;
    if (role !== undefined) updates.role = role;
    if (allowedModules !== undefined) updates.allowedModules = allowedModules;
    if (nextCenterId !== undefined) {
      updates.centerId = nextCenterId;
      updates.branchId = nextCenterId;
    }
    if (nextCenterIds !== undefined) {
      if (nextCenterIds.length > 0) {
        updates.centerIds = nextCenterIds;
      } else {
        updates.centerIds = [];
      }
    }
    if (isSuperAdminRaw !== undefined) updates.isSuperAdmin = Boolean(isSuperAdminRaw);

    if (email !== undefined && email) {
      await auth.updateUser(uid, { email });
      updates.email = email;
    }

    await adminDb().collection('users').doc(uid).set(updates, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update user';
    console.error('update-user error:', err);
    if (String((err as { code?: string }).code || '').includes('auth/email-already-exists')) {
      return jsonError('A user with this email already exists', 409);
    }
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}
