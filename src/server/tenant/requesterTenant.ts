import { adminDb } from '@/server/firebaseAdmin';
import { isSuperAdminViewer, normalizeCenterIdsFromProfile, normalizeCenterId } from '@/lib/tenant/centerScope';
import type { UserProfile } from '@/context/AuthContext';

export type RequesterTenant = {
  uid: string;
  role: UserProfile['role'];
  /** First center id for backward compatibility */
  centerId: string | null;
  /** All assigned centers */
  centerIds: string[];
  isSuperAdmin: boolean;
};

function profileFromDoc(data: Record<string, unknown> | undefined, uid: string): RequesterTenant | null {
  if (!data) return null;
  const p = { ...data, uid } as UserProfile;
  const centerIds = normalizeCenterIdsFromProfile(p);
  return {
    uid,
    role: p.role,
    centerId: centerIds.length > 0 ? centerIds[0] : normalizeCenterId(p),
    centerIds,
    isSuperAdmin: isSuperAdminViewer(p),
  };
}

export async function getRequesterTenant(uid: string): Promise<RequesterTenant | null> {
  const snap = await adminDb().collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return profileFromDoc(snap.data(), uid);
}

export function assertAdmin(requester: RequesterTenant): void {
  // "Super admin" accounts should be able to perform admin-only maintenance actions
  // even if their `role` isn't set to `admin` in the `users` profile doc.
  if (requester.role !== 'admin' && !requester.isSuperAdmin) {
    throw new Error('Forbidden');
  }
}

function requesterAllowedCenters(requester: RequesterTenant): string[] {
  if (requester.centerIds.length > 0) return requester.centerIds;
  if (requester.centerId) return [requester.centerId];
  return [];
}

/**
 * Validates center assignment for a new/updated user.
 * `nextCenterIds` (if non-empty) wins; otherwise uses `nextCenterId`.
 */
export function assertCanSetCenter(
  requester: RequesterTenant,
  nextCenterId: string | null,
  nextCenterIds?: string[] | null,
): void {
  assertAdmin(requester);
  if (requester.isSuperAdmin) return;

  const allowed = requesterAllowedCenters(requester);
  if (allowed.length === 0) return;

  const ids =
    Array.isArray(nextCenterIds) && nextCenterIds.length > 0
      ? [...new Set(nextCenterIds.map((x) => String(x).trim()).filter(Boolean))]
      : nextCenterId && String(nextCenterId).trim()
        ? [String(nextCenterId).trim()]
        : [];

  if (ids.length === 0) {
    throw new Error('Center is required for users in your scope');
  }

  for (const id of ids) {
    if (!allowed.includes(id)) {
      throw new Error('Cannot assign users outside your center(s)');
    }
  }
}

/**
 * Only super admins may grant `isSuperAdmin`. Clearing it is allowed for any admin.
 */
export function assertCanSetSuperAdmin(requester: RequesterTenant, nextFlag: boolean | undefined): void {
  if (nextFlag === undefined) return;
  if (!nextFlag) return;
  assertAdmin(requester);
  if (!requester.isSuperAdmin) {
    throw new Error('Only super admins can assign super-admin status');
  }
}
