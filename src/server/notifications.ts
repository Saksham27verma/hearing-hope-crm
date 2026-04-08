import type { NotificationDoc } from '@/lib/notifications/types';
import { adminDb } from '@/server/firebaseAdmin';

export async function writeNotification(opts: {
  id?: string;
  doc: NotificationDoc;
}): Promise<void> {
  const db = adminDb();
  const ref = opts.id
    ? db.collection('notifications').doc(opts.id)
    : db.collection('notifications').doc();
  await ref.set(opts.doc, { merge: false });
}

