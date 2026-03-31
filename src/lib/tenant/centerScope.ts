/**
 * Multi-tenant center scoping for the CRM.
 *
 * `centerId` on {@link import('@/context/AuthContext').UserProfile} ties a user to one {@link centers} document.
 * Super admins may view all centers or narrow the UI; center-locked users always read/write within their center.
 *
 * @see useCenterScope for React state (global vs scoped view).
 * @see centerScopeWhere for Firestore query helpers.
 */

import type { UserProfile } from '@/context/AuthContext';

/** Resolve primary center id from profile (prefers `centerId`, falls back to legacy `branchId`). */
export function normalizeCenterId(profile: Pick<UserProfile, 'centerId' | 'branchId'> | null): string | null {
  if (!profile) return null;
  const raw = profile.centerId ?? profile.branchId;
  if (raw === undefined || raw === null || raw === '') return null;
  return String(raw);
}

/**
 * Super admins can switch global vs center scope in the UI.
 * Explicit `isSuperAdmin: false` with a `centerId` => center-locked admin.
 * Legacy admins with no center id are treated as super-admin for backward compatibility.
 */
export function isSuperAdminViewer(profile: UserProfile | null): boolean {
  if (!profile || profile.role !== 'admin') return false;
  if (profile.isSuperAdmin === true) return true;
  if (profile.isSuperAdmin === false) return false;
  return normalizeCenterId(profile) === null;
}

/** Non-null when the signed-in user must never see other centers' data. */
export function getLockedCenterId(profile: UserProfile | null): string | null {
  if (!profile) return null;
  if (profile.role === 'admin' && isSuperAdminViewer(profile)) return null;
  return normalizeCenterId(profile);
}

/**
 * Whether an enquiry document should appear when the UI is scoped to `scopeCenterId`.
 * `scopeCenterId === null` means no extra filter (super-admin “all centers” or equivalent).
 */
export function enquiryMatchesDataScope(
  enquiry: Record<string, unknown>,
  scopeCenterId: string | null,
): boolean {
  if (!scopeCenterId) return true;
  const want = String(scopeCenterId);
  const candidates: string[] = [];
  const push = (v: unknown) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') candidates.push(String(v));
  };
  push(enquiry.center);
  push(enquiry.visitingCenter);
  const visits = Array.isArray(enquiry.visits) ? enquiry.visits : [];
  for (const v of visits as Record<string, unknown>[]) {
    push(v.center);
    push(v.visitingCenter);
  }
  if (candidates.length === 0) return true;
  return candidates.includes(want);
}
