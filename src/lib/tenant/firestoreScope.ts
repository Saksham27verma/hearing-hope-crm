import type { QueryConstraint } from 'firebase/firestore';
import { where } from 'firebase/firestore';

/**
 * Returns a Firestore `where` constraint when a center scope is active, or `null` when queries should not be filtered.
 * Use the same `fieldPath` as stored on your documents (e.g. `centerId`, `location`, `branchId`).
 */
export function centerScopeWhere(fieldPath: string, scopeCenterId: string | null): QueryConstraint | null {
  if (scopeCenterId === null || scopeCenterId === '') return null;
  return where(fieldPath, '==', scopeCenterId);
}
