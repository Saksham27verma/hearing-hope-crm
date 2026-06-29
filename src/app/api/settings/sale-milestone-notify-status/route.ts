import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import {
  CRM_SALE_MILESTONE_NOTIFY_COLLECTION,
  CRM_SALE_MILESTONE_NOTIFY_DOC_ID,
} from '@/lib/crmSettings/saleMilestoneNotify';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await adminAuth().verifyIdToken(match[1]);

  const db = adminDb();
  const snap = await db
    .collection(CRM_SALE_MILESTONE_NOTIFY_COLLECTION)
    .doc(CRM_SALE_MILESTONE_NOTIFY_DOC_ID)
    .get();
  const data = snap.data() || {};

  const usersSnap = await db.collection('users').get();
  const userOptions = usersSnap.docs.map((d) => {
    const u = d.data();
    return {
      uid: d.id,
      displayName: String(u.displayName || u.email || d.id),
      email: String(u.email || ''),
      role: String(u.role || ''),
    };
  });

  return NextResponse.json({
    enabled: data.enabled !== false,
    notificationUserIds: Array.isArray(data.notificationUserIds) ? data.notificationUserIds : [],
    userOptions,
  });
}
