import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { WHATSAPP_INBOUND_MESSAGES_COLLECTION } from '@/lib/whatsapp/inboundMessageTypes';

/**
 * Stores inbound WhatsApp text and notifies all CRM admins (notification bell + inbox page).
 */
export async function persistWhatsAppInboundMessage(params: {
  waMessageId: string;
  customerName: string;
  customerPhone: string;
  messageBody: string;
}): Promise<{ stored: boolean; notified: number }> {
  const { waMessageId, customerName, customerPhone, messageBody } = params;
  const cleanId = String(waMessageId || '').trim();
  if (!cleanId) return { stored: false, notified: 0 };

  const db = adminDb();
  const msgRef = db.collection(WHATSAPP_INBOUND_MESSAGES_COLLECTION).doc(cleanId);
  const existing = await msgRef.get();
  if (existing.exists) {
    return { stored: false, notified: 0 };
  }

  await msgRef.set({
    waMessageId: cleanId,
    customerName: String(customerName || 'Unknown').trim() || 'Unknown',
    customerPhone: String(customerPhone || '').trim(),
    messageBody: String(messageBody || '').trim(),
    createdAt: FieldValue.serverTimestamp(),
  });

  const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
  if (adminsSnap.empty) return { stored: true, notified: 0 };

  const preview =
    messageBody.length > 120 ? `${messageBody.slice(0, 117)}…` : messageBody;
  const title = `WhatsApp from ${customerName}`;
  const message = `${preview} · ${customerPhone}`;
  const href = '/whatsapp-inbox';

  const batch = db.batch();
  let notified = 0;

  adminsSnap.docs.forEach((d) => {
    const data = (d.data() || {}) as Record<string, unknown>;
    const centerId = (data.centerId as string | null | undefined) ?? null;
    const notifId = `waInbound|${cleanId}|${d.id}`;
    batch.set(db.collection('notifications').doc(notifId), {
      userId: d.id,
      centerId,
      type: 'whatsapp_inbound',
      title,
      message,
      href,
      entity: { kind: 'whatsapp_inbound', id: cleanId },
      is_read: false,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
      dedupeKey: `waInbound|${cleanId}`,
    });
    notified += 1;
  });

  await batch.commit();
  return { stored: true, notified };
}
