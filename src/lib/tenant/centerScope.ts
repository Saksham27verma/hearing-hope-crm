/**
 * Multi-tenant center scoping for the CRM.
 *
 * @see useCenterScope for React state (global vs scoped view).
 * @see centerScopeWhere for Firestore query helpers.
 */

import type { UserProfile } from '@/context/AuthContext';

/** All center ids assigned to the profile (`centerIds` + legacy single `centerId` / `branchId`). */
export function normalizeCenterIdsFromProfile(
  profile: Pick<UserProfile, 'centerId' | 'branchId' | 'centerIds'> | null,
): string[] {
  if (!profile) return [];
  const raw = profile.centerIds;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];
  }
  const single = profile.centerId ?? profile.branchId;
  if (single !== undefined && single !== null && String(single).trim() !== '') {
    return [String(single).trim()];
  }
  return [];
}

/** Resolve primary center id from profile (first assigned, for legacy single-field callers). */
export function normalizeCenterId(
  profile: Pick<UserProfile, 'centerId' | 'branchId' | 'centerIds'> | null,
): string | null {
  const ids = normalizeCenterIdsFromProfile(profile);
  return ids.length > 0 ? ids[0] : null;
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
  return normalizeCenterId(profile) === null && normalizeCenterIdsFromProfile(profile).length === 0;
}

/**
 * Centers this user may access in the UI.
 * `null` = full access (super-admin viewer / no restriction).
 * Non-null array = restricted to these center ids.
 */
export function getAllowedCenterIds(profile: UserProfile | null): string[] | null {
  if (!profile) return null;
  if (profile.role === 'admin' && isSuperAdminViewer(profile)) return null;
  const ids = normalizeCenterIdsFromProfile(profile);
  return ids.length > 0 ? ids : null;
}

/**
 * Non-null when the account is pinned to exactly one center (legacy lock banner / no switcher).
 * When multiple centers are assigned, returns null — user switches via Data scope.
 */
export function getLockedCenterId(profile: UserProfile | null): string | null {
  if (!profile) return null;
  if (profile.role === 'admin' && isSuperAdminViewer(profile)) return null;
  const ids = normalizeCenterIdsFromProfile(profile);
  if (ids.length === 1) return ids[0];
  return null;
}

/** Resolved scope for filtering documents. */
export type DataScopeMode =
  | { type: 'global' }
  | { type: 'single'; centerId: string }
  | { type: 'union'; centerIds: string[] };

/**
 * Combines toolbar selection (`effectiveScopeCenterId`) with the viewer's allowed centers.
 * - Super-admin global: allowedCenterIds null, effective null → global.
 * - Multi-center user, “All assigned”: allowedCenterIds [a,b], effective null → union.
 */
export function resolveDataScope(
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null,
): DataScopeMode {
  if (viewerAllowedCenterIds === null) {
    if (!effectiveScopeCenterId) return { type: 'global' };
    return { type: 'single', centerId: effectiveScopeCenterId };
  }
  if (viewerAllowedCenterIds.length === 0) {
    if (!effectiveScopeCenterId) return { type: 'global' };
    return { type: 'single', centerId: effectiveScopeCenterId };
  }
  if (viewerAllowedCenterIds.length === 1) {
    return { type: 'single', centerId: viewerAllowedCenterIds[0] };
  }
  if (!effectiveScopeCenterId) {
    return { type: 'union', centerIds: viewerAllowedCenterIds };
  }
  return { type: 'single', centerId: effectiveScopeCenterId };
}

export function isGlobalDataScope(
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null,
): boolean {
  return resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds).type === 'global';
}

function extractEnquiryCenterCandidates(enquiry: Record<string, unknown>): string[] {
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
  return [...new Set(candidates)];
}

/** Whether a user row overlaps the current data scope (for user directory). */
export function userRowMatchesDataScope(
  row: Pick<UserProfile, 'centerId' | 'branchId' | 'centerIds'>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const userCenters = normalizeCenterIdsFromProfile(row);
  if (userCenters.length === 0) return true;
  if (mode.type === 'single') {
    return userCenters.includes(mode.centerId);
  }
  return userCenters.some((c) => mode.centerIds.includes(c));
}

/**
 * Whether an enquiry document should appear for the current scope.
 * Pass `viewerAllowedCenterIds` from {@link useCenterScope} (same as profile allowed centers).
 */
export function enquiryMatchesDataScope(
  enquiry: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  if (mode.type === 'union') {
    const candidates = extractEnquiryCenterCandidates(enquiry);
    if (candidates.length === 0) return true;
    return candidates.some((c) => mode.centerIds.includes(c));
  }
  const want = mode.centerId;
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

export function saleMatchesDataScope(
  sale: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const cid = sale.centerId ?? sale.branch;
  if (cid === undefined || cid === null || String(cid).trim() === '') return true;
  if (mode.type === 'union') {
    return mode.centerIds.includes(String(cid));
  }
  return String(cid) === mode.centerId;
}

export function stockTransferMatchesDataScope(
  transfer: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const from = transfer.fromBranch != null ? String(transfer.fromBranch) : '';
  const to = transfer.toBranch != null ? String(transfer.toBranch) : '';
  if (!from && !to) return true;
  if (mode.type === 'union') {
    return (from && mode.centerIds.includes(from)) || (to && mode.centerIds.includes(to));
  }
  const want = mode.centerId;
  return from === want || to === want;
}

export function appointmentMatchesDataScope(
  appt: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const cid = appt.centerId;
  if (cid === undefined || cid === null || String(cid).trim() === '') return true;
  if (mode.type === 'union') {
    return mode.centerIds.includes(String(cid));
  }
  return String(cid) === mode.centerId;
}

export function inventoryCollectionDocMatchesScope(
  row: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const loc = row.location ?? row.centerId ?? row.branch;
  if (loc === undefined || loc === null || String(loc).trim() === '') return true;
  if (mode.type === 'union') {
    return mode.centerIds.includes(String(loc));
  }
  return String(loc) === mode.centerId;
}

export function visitorMatchesDataScope(
  visitor: Record<string, unknown>,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const vc = visitor.visitingCenter;
  if (vc === undefined || vc === null || String(vc).trim() === '') return true;
  if (mode.type === 'union') {
    return mode.centerIds.includes(String(vc));
  }
  return String(vc) === mode.centerId;
}

/** In-memory inventory row `location` vs current scope (inventory page aggregate). */
export function inventoryItemMatchesDataScope(
  location: string,
  effectiveScopeCenterId: string | null,
  viewerAllowedCenterIds: string[] | null = null,
): boolean {
  const mode = resolveDataScope(effectiveScopeCenterId, viewerAllowedCenterIds);
  if (mode.type === 'global') return true;
  const loc = String(location || '');
  if (!loc) return true;
  if (mode.type === 'union') {
    return mode.centerIds.includes(loc);
  }
  return loc === mode.centerId;
}
