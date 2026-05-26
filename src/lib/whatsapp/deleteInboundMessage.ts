import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { WHATSAPP_INBOUND_MESSAGES_COLLECTION } from '@/lib/whatsapp/inboundMessageTypes';

/** Removes inbox message and related admin notifications for that WhatsApp message id. */
export async function deleteWhatsAppInboundMessage(messageId: string): Promise<void> {
  if (!db) throw new Error('Database not available');

  const cleanId = String(messageId || '').trim();
  if (!cleanId) throw new Error('Invalid message id');

  await deleteDoc(doc(db, WHATSAPP_INBOUND_MESSAGES_COLLECTION, cleanId));

  const dedupeKey = `waInbound|${cleanId}`;
  const notifSnap = await getDocs(
    query(collection(db, 'notifications'), where('dedupeKey', '==', dedupeKey)),
  );

  if (!notifSnap.empty) {
    const batch = writeBatch(db);
    notifSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** Deletes many inbox messages (and their notification copies). */
export async function deleteWhatsAppInboundMessages(messageIds: string[]): Promise<number> {
  const ids = [...new Set(messageIds.map((id) => String(id || '').trim()).filter(Boolean))];
  for (const id of ids) {
    await deleteWhatsAppInboundMessage(id);
  }
  return ids.length;
}

/** Admin: wipe entire inbox in Firebase (all pages, not only visible list). */
export async function clearAllWhatsAppInboundViaApi(idToken: string): Promise<{
  messagesDeleted: number;
  notificationsDeleted: number;
}> {
  const res = await fetch('/api/admin/whatsapp-inbox/clear-all', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    messagesDeleted?: number;
    notificationsDeleted?: number;
  } | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Clear failed (${res.status})`);
  }
  return {
    messagesDeleted: Number(json.messagesDeleted) || 0,
    notificationsDeleted: Number(json.notificationsDeleted) || 0,
  };
}
