/**
 * Activity Logger — fire-and-forget audit trail writer.
 * All writes are wrapped in try/catch so logging failures
 * never propagate to callers or crash any existing flow.
 */

import {
  addDoc,
  collection,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import type { UserProfile } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | 'CANCEL'
  | 'FOLLOW_UP'
  | 'RESCHEDULE'
  | 'LOGIN'
  | 'IMPORT';

export type ActivityModule =
  | 'Enquiries'
  | 'Sales'
  | 'Purchases'
  | 'Material In'
  | 'Material Out'
  | 'Appointments'
  | 'Telecalling'
  | 'Stock Transfer'
  | 'Distribution Sales'
  | 'Visitors'
  | 'Users'
  | 'Staff'
  | 'Cash Register'
  | 'Inventory'
  | 'Products';

export interface ActivityChanges {
  [fieldName: string]: { before: unknown; after: unknown };
}

export interface LogActivityPayload {
  action: ActivityAction;
  module: ActivityModule;
  entityId: string;
  entityName: string;
  description: string;
  changes?: ActivityChanges;
  metadata?: Record<string, unknown>;
}

// ─── Diff helper ──────────────────────────────────────────────────────────────

const IGNORED_FIELDS = new Set([
  'updatedAt', 'createdAt', 'id', '__type', '__proto__',
]);

/**
 * Computes a shallow diff between two plain objects.
 * Returns only fields that actually changed (deep-equal by JSON).
 * Skips timestamp/meta fields.
 */
export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ActivityChanges | undefined {
  const changes: ActivityChanges = {};

  const allKeys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  for (const key of allKeys) {
    if (IGNORED_FIELDS.has(key)) continue;
    try {
      const bVal = JSON.stringify((before || {})[key] ?? null);
      const aVal = JSON.stringify((after || {})[key] ?? null);
      if (bVal !== aVal) {
        changes[key] = { before: (before || {})[key], after: (after || {})[key] };
      }
    } catch {
      // ignore non-serializable fields
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}

// ─── Core logger ──────────────────────────────────────────────────────────────

/**
 * Writes an activity log document to Firestore.
 * Always fire-and-forget — never throws, never awaited for correctness.
 *
 * Pass `firebaseUser` when `userProfile` may still be loading so edits still get attributed.
 */
export async function logActivity(
  db: Firestore,
  userProfile: UserProfile | null,
  centerId: string | null | undefined,
  payload: LogActivityPayload,
  firebaseUser?: FirebaseAuthUser | null,
): Promise<void> {
  try {
    if (!db) return;
    const uid = userProfile?.uid ?? firebaseUser?.uid ?? null;
    if (!uid) return;

    const userName =
      userProfile?.displayName ||
      firebaseUser?.displayName ||
      userProfile?.email ||
      firebaseUser?.email ||
      'Unknown User';
    const userEmail = userProfile?.email || firebaseUser?.email || '';
    const userRole = userProfile?.role ?? 'staff';

    const logEntry = {
      timestamp: serverTimestamp(),
      userId: uid,
      userName,
      userEmail,
      userRole,
      centerId: centerId ?? userProfile?.centerId ?? null,
      action: payload.action,
      module: payload.module,
      entityId: payload.entityId || '',
      entityName: payload.entityName || '',
      description: payload.description || '',
      ...(payload.changes ? { changes: payload.changes } : {}),
      ...(payload.metadata ? { metadata: payload.metadata } : {}),
    };

    await addDoc(collection(db, 'activityLogs'), logEntry);
  } catch (err) {
    // Intentionally swallowed for callers — but surface failures in dev so misconfigured rules/env are obvious.
    if (process.env.NODE_ENV === 'development') {
      console.error('[activityLogger] Failed to write activityLogs:', err);
    }
  }
}
