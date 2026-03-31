import { adminDb } from '@/server/firebaseAdmin';
import { isSuperAdminViewer, normalizeCenterId } from '@/lib/tenant/centerScope';
import type { UserProfile } from '@/context/AuthContext';

export type RequesterTenant = {
  uid: string;
  role: UserProfile['role'];
  centerId: string | null;
  isSuperAdmin: boolean;
};

function profileFromDoc(data: Record<string, unknown> | undefined, uid: string): RequesterTenant | null {
  if (!data) return null;
  const p = { ...data, uid } as UserProfile;
  return {
    uid,
    role: p.role,
    centerId: normalizeCenterId(p),
    isSuperAdmin: isSuperAdminViewer(p),
  };
}

export async function getRequesterTenant(uid: string): Promise<RequesterTenant | null> {
  const snap = await adminDb().collection('users').doc(uid).get();
  if (!snap.exists) return null;
  return profileFromDoc(snap.data(), uid);
}

export function assertAdmin(requester: RequesterTenant): void {
  if (requester.role !== 'admin') {
    throw new Error('Forbidden');
  }
}

/**
 * Validates assigning `nextCenterId` to a user. Center-locked admins cannot assign other centers or unset center.
 */
export function assertCanSetCenter(requester: RequesterTenant, nextCenterId: string | null): void {
  assertAdmin(requester);
  if (requester.isSuperAdmin) return;
  if (!requester.centerId) return;
  if (nextCenterId === null || nextCenterId === '') {
    throw new Error('Center is required for users in your scope');
  }
  if (nextCenterId !== requester.centerId) {
    throw new Error('Cannot assign users outside your center');
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
