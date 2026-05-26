import type { QuerySnapshot } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { WHATSAPP_INBOUND_MESSAGES_COLLECTION } from '@/lib/whatsapp/inboundMessageTypes';

const BATCH_SIZE = 400;

async function deleteQueryBatch(getBatch: () => Promise<QuerySnapshot>): Promise<number> {
  let total = 0;
  for (;;) {
    const snap = await getBatch();
    if (snap.empty) break;
    const batch = adminDb().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
  }
  return total;
}

/** Deletes every document in whatsapp_inbound_messages and whatsapp_inbound notifications. */
export async function clearAllWhatsAppInboundInbox(): Promise<{
  messagesDeleted: number;
  notificationsDeleted: number;
}> {
  const db = adminDb();

  const messagesDeleted = await deleteQueryBatch(() =>
    db.collection(WHATSAPP_INBOUND_MESSAGES_COLLECTION).limit(BATCH_SIZE).get(),
  );

  const notificationsDeleted = await deleteQueryBatch(() =>
    db.collection('notifications').where('type', '==', 'whatsapp_inbound').limit(BATCH_SIZE).get(),
  );

  return { messagesDeleted, notificationsDeleted };
}
