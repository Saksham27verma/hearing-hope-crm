import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { UserProfile } from '@/context/AuthContext';
import { getAllowedCenterIds } from '@/lib/tenant/centerScope';

export interface Center {
  id: string;
  name: string;
  isHeadOffice?: boolean;
  // ... other properties
}

/** All centers from Firestore (unsorted). */
export async function fetchAllCenters(): Promise<Center[]> {
  const snap = await getDocs(collection(db, 'centers'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Center[];
}

/**
 * When viewer is restricted to specific centers, limit dropdown options.
 * `allowedCenterIds === null` means no restriction (full list).
 */
export function filterCentersForViewer<T extends { id: string }>(
  centers: T[],
  allowedCenterIds: string[] | null,
): T[] {
  if (allowedCenterIds === null || allowedCenterIds.length === 0) return centers;
  const allowed = new Set(allowedCenterIds);
  return centers.filter((c) => allowed.has(c.id));
}

/** Centers visible to this profile (same rules as inventory scope). */
export function getCentersForProfile(centers: Center[], profile: UserProfile | null): Center[] {
  return filterCentersForViewer(centers, getAllowedCenterIds(profile));
}

/** Match stored `location` to a center id (legacy name or id). */
export function resolveCenterIdForForm(
  raw: string | undefined,
  centers: { id: string; name?: string }[],
): string {
  const r = String(raw || '').trim();
  if (!r) return '';
  if (centers.some((c) => c.id === r)) return r;
  const byName = centers.find((c) => String(c.name || '').trim() === r);
  return byName?.id || r;
}

export function getCenterLabel(centerId: string, centers: { id: string; name?: string }[]): string {
  const c = centers.find((x) => x.id === centerId);
  return c?.name?.trim() || centerId;
}

/**
 * Get the head office center from Firestore
 * Returns the first center marked as head office, or null if none found
 */
export const getHeadOfficeCenter = async (): Promise<Center | null> => {
  try {
    const centersQuery = collection(db, 'centers');
    const querySnapshot = await getDocs(centersQuery);
    
    const centers = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Center[];
    
    // Find the center marked as head office
    const headOffice = centers.find(center => center.isHeadOffice);
    
    return headOffice || null;
  } catch (error) {
    console.error('Error fetching head office:', error);
    return null;
  }
};

/**
 * Get the head office ID, with fallback to 'rohini' for backward compatibility
 */
export const getHeadOfficeId = async (): Promise<string> => {
  const headOffice = await getHeadOfficeCenter();
  return headOffice?.id || 'rohini'; // Fallback to rohini for backward compatibility
};
