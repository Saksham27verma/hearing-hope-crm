import { NextResponse } from 'next/server';
import type { Query } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Serialize Firestore Timestamp / Date / millis for JSON. */
function toMillis(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'object' && v !== null && 'toMillis' in v && typeof (v as { toMillis: () => number }).toMillis === 'function') {
    try {
      return (v as { toMillis: () => number }).toMillis();
    } catch {
      return null;
    }
  }
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

/**
 * Lists activity logs with server privileges (any admin).
 * Client reads are restricted by rules; staff actions still write via logActivity.
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);

    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const url = new URL(req.url);
    const limitRaw = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
    const startAfterId = url.searchParams.get('startAfterId')?.trim() || '';
    const module = url.searchParams.get('module')?.trim() || '';
    const userId = url.searchParams.get('userId')?.trim() || '';
    const action = url.searchParams.get('action')?.trim() || '';

    const db = adminDb();
    const col = db.collection('activityLogs');

    let q: Query = col.orderBy('timestamp', 'desc').limit(limit);

    if (module) {
      q = col.where('module', '==', module).orderBy('timestamp', 'desc').limit(limit);
    } else if (userId) {
      q = col.where('userId', '==', userId).orderBy('timestamp', 'desc').limit(limit);
    } else if (action) {
      q = col.where('action', '==', action).orderBy('timestamp', 'desc').limit(limit);
    }

    if (startAfterId) {
      const cursor = await col.doc(startAfterId).get();
      if (cursor.exists) {
        q = q.startAfter(cursor);
      }
    }

    const snap = await q.get();

    const logs = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        userId: String(d.userId ?? ''),
        userName: String(d.userName ?? ''),
        userEmail: String(d.userEmail ?? ''),
        userRole: String(d.userRole ?? ''),
        centerId: d.centerId ?? null,
        action: d.action,
        module: d.module,
        entityId: String(d.entityId ?? ''),
        entityName: String(d.entityName ?? ''),
        description: String(d.description ?? ''),
        changes: d.changes ?? undefined,
        metadata: d.metadata ?? undefined,
        timestampMillis: toMillis(d.timestamp),
      };
    });

    const last = snap.docs[snap.docs.length - 1];
    const hasMore = snap.docs.length === limit;

    return NextResponse.json({
      ok: true,
      logs,
      nextCursor: hasMore && last ? last.id : null,
      hasMore,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load activity logs';
    console.error('activity-logs GET error:', err);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}
