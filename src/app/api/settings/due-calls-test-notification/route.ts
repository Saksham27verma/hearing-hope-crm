import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { getDueCallsNotificationUserIds } from '@/server/dueCallsNotifyEmails';

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

async function verifyCrmUser(req: Request): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(match[1]);
    const db = adminDb();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return null;
    const roleRaw = (userSnap.data() as { role?: string })?.role;
    const role = typeof roleRaw === 'string' ? roleRaw.trim().toLowerCase() : '';
    if (!role || !['admin', 'staff', 'audiologist'].includes(role)) return null;
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const user = await verifyCrmUser(req);
  if (!user) return jsonError('Unauthorized', 401);

  const db = adminDb();
  const selectedUserIds = await getDueCallsNotificationUserIds();
  // Always include the requester so the test is immediately visible to the person testing.
  const recipientIds = [...selectedUserIds, user.uid];
  const uniq = [...new Set(recipientIds.map((x) => String(x).trim()).filter(Boolean))];
  if (uniq.length === 0) {
    return jsonError('No users selected for due-call notifications.', 400);
  }

  const now = Date.now();
  const batch = db.batch();
  uniq.forEach((uid) => {
    const notifId = `testDueCall|${now}|${uid}`;
    batch.set(db.collection('notifications').doc(notifId), {
      userId: uid,
      centerId: null,
      type: 'due_calls',
      title: "[TEST] Today's Due Calls",
      message: 'This is a test due-call notification from Settings.',
      href: '/telecalling-records?quickFilter=due_today',
      entity: { kind: 'system', id: `testDueCall|${now}` },
      is_read: false,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
      dedupeKey: notifId,
    });
  });
  await batch.commit();

  return NextResponse.json({
    ok: true,
    sentToUserIds: uniq,
    message:
      selectedUserIds.length > 0
        ? `Test notification sent to ${uniq.length} user(s), including your account.`
        : 'No users selected; sent test notification to your account.',
  });
}

