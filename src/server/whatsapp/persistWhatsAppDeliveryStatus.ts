import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';

export const WHATSAPP_DELIVERY_STATUSES_COLLECTION = 'whatsapp_delivery_statuses';

/**
 * Persist Meta/Pinnacle delivery receipts (sent / delivered / read / failed).
 * API accept ≠ phone delivery; this is how we learn post-accept failures.
 */
export async function persistWhatsAppDeliveryStatuses(
  statuses: unknown[],
): Promise<number> {
  if (!Array.isArray(statuses) || statuses.length === 0) return 0;
  const db = adminDb();
  let n = 0;
  for (const raw of statuses) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;
    const id = String(s.id || '').trim();
    if (!id) continue;
    const status = String(s.status || '').trim().toLowerCase() || 'unknown';
    const recipientId = String(s.recipient_id || '').trim();
    const errors = s.errors;
    const errorSummary =
      Array.isArray(errors) && errors[0] && typeof errors[0] === 'object'
        ? JSON.stringify(errors[0])
        : errors
          ? JSON.stringify(errors)
          : null;

    await db
      .collection(WHATSAPP_DELIVERY_STATUSES_COLLECTION)
      .doc(id)
      .set(
        {
          messageId: id,
          status,
          recipientId,
          timestamp: s.timestamp != null ? String(s.timestamp) : null,
          errors: errorSummary,
          raw: s,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    n += 1;
    console.log('[WhatsApp status]', { id, status, recipientId, errors: errorSummary });
  }
  return n;
}
