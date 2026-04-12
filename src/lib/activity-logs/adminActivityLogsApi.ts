import type { User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ActivityLogDoc } from '@/components/activity-logs/types';

export interface FetchActivityLogsParams {
  limit: number;
  startAfterId?: string | null;
  module?: string;
  userId?: string;
  action?: string;
}

export interface FetchActivityLogsResult {
  logs: ActivityLogDoc[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface ApiActivityLogRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  centerId?: string | null;
  action: string;
  module: string;
  entityId: string;
  entityName: string;
  description: string;
  changes?: ActivityLogDoc['changes'];
  metadata?: Record<string, unknown>;
  timestampMillis: number | null;
}

function rowToDoc(row: ApiActivityLogRow): ActivityLogDoc {
  const ms = row.timestampMillis ?? 0;
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    userRole: row.userRole,
    centerId: row.centerId,
    action: row.action as ActivityLogDoc['action'],
    module: row.module as ActivityLogDoc['module'],
    entityId: row.entityId,
    entityName: row.entityName,
    description: row.description,
    changes: row.changes,
    metadata: row.metadata,
    timestamp: Timestamp.fromMillis(ms),
  };
}

function firestoreSnapToDoc(d: QueryDocumentSnapshot): ActivityLogDoc {
  const data = d.data();
  const ts = data.timestamp;
  const timestamp =
    ts && typeof (ts as { toMillis?: () => number }).toMillis === 'function'
      ? (ts as Timestamp)
      : Timestamp.fromMillis(0);

  return {
    id: d.id,
    userId: String(data.userId ?? ''),
    userName: String(data.userName ?? ''),
    userEmail: String(data.userEmail ?? ''),
    userRole: String(data.userRole ?? ''),
    centerId: data.centerId ?? null,
    action: data.action as ActivityLogDoc['action'],
    module: data.module as ActivityLogDoc['module'],
    entityId: String(data.entityId ?? ''),
    entityName: String(data.entityName ?? ''),
    description: String(data.description ?? ''),
    changes: data.changes,
    metadata: data.metadata,
    timestamp,
  };
}

/**
 * Direct Firestore list (browser SDK). Used when the Admin API is unavailable
 * (missing FIREBASE_ADMIN_* env locally) or returns an error; respects security rules.
 */
async function fetchActivityLogsFromFirestoreClient(
  params: FetchActivityLogsParams,
): Promise<FetchActivityLogsResult> {
  const colRef = collection(db, 'activityLogs');
  const constraints: QueryConstraint[] = [];

  if (params.module) {
    constraints.push(where('module', '==', params.module));
  } else if (params.userId) {
    constraints.push(where('userId', '==', params.userId));
  } else if (params.action) {
    constraints.push(where('action', '==', params.action));
  }

  constraints.push(orderBy('timestamp', 'desc'));

  if (params.startAfterId) {
    const cursorSnap = await getDoc(doc(db, 'activityLogs', params.startAfterId));
    if (cursorSnap.exists()) {
      constraints.push(startAfter(cursorSnap));
    }
  }

  constraints.push(limit(params.limit));

  const q = query(colRef, ...constraints);
  const snap = await getDocs(q);
  const logs = snap.docs.map(firestoreSnapToDoc);
  const last = snap.docs[snap.docs.length - 1];
  const hasMore = snap.docs.length === params.limit;

  return {
    logs,
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
  };
}

/** Admin-only: full audit trail across all users (bypasses restrictive client Firestore rules). */
export async function fetchActivityLogsAdmin(
  user: User,
  params: FetchActivityLogsParams,
): Promise<FetchActivityLogsResult> {
  let apiError: string | null = null;

  try {
    const token = await user.getIdToken();
    const sp = new URLSearchParams();
    sp.set('limit', String(params.limit));
    if (params.startAfterId) sp.set('startAfterId', params.startAfterId);
    if (params.module) sp.set('module', params.module);
    if (params.userId) sp.set('userId', params.userId);
    if (params.action) sp.set('action', params.action);

    const res = await fetch(`/api/admin/activity-logs?${sp.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      logs?: ApiActivityLogRow[];
      nextCursor?: string | null;
      hasMore?: boolean;
    };

    if (res.ok && data?.ok && Array.isArray(data.logs)) {
      return {
        logs: data.logs.map(rowToDoc),
        nextCursor: data.nextCursor ?? null,
        hasMore: Boolean(data.hasMore),
      };
    }

    apiError = data?.error || `HTTP ${res.status}`;
  } catch (e) {
    apiError = e instanceof Error ? e.message : 'Network error';
  }

  try {
    const fromClient = await fetchActivityLogsFromFirestoreClient(params);
    return fromClient;
  } catch (clientErr) {
    const clientMsg = clientErr instanceof Error ? clientErr.message : String(clientErr);
    throw new Error(
      apiError
        ? `Activity logs: server API failed (${apiError}). Client read also failed: ${clientMsg}`
        : `Activity logs: ${clientMsg}`,
    );
  }
}
