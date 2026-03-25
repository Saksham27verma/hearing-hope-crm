import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminMessaging } from '@/server/firebaseAdmin';

export type StaffPushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

/**
 * Notify one staff member on every registered device: Expo (mobile) + FCM web (PWA).
 */
export async function notifyStaffDevices(staffId: string, payload: StaffPushPayload): Promise<{
  expo: 'sent' | 'skipped' | 'error';
  fcm: { attempted: number; sent: number; errors: string[] };
}> {
  const db = adminDb();
  const snap = await db.collection('staff').doc(staffId).get();
  const d = snap.data() || {};

  let expo: 'sent' | 'skipped' | 'error' = 'skipped';
  const pushToken = d.pushToken as string | undefined;
  if (pushToken && pushToken.startsWith('ExponentPushToken[')) {
    try {
      const message = {
        to: pushToken,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        sound: 'default',
        channelId: 'appointments',
      };
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(message),
      });
      const result = await res.json().catch(() => ({}));
      if (result.data?.status === 'error') {
        console.error('Expo push error:', result.data.message);
        expo = 'error';
      } else {
        expo = 'sent';
      }
    } catch (e) {
      console.error('Expo push fetch failed:', e);
      expo = 'error';
    }
  }

  const webTokens: string[] = [];
  if (typeof d.fcmWebPushToken === 'string' && d.fcmWebPushToken.trim()) {
    webTokens.push(d.fcmWebPushToken.trim());
  }
  if (Array.isArray(d.fcmWebPushTokens)) {
    for (const t of d.fcmWebPushTokens) {
      if (typeof t === 'string' && t.trim()) webTokens.push(t.trim());
    }
  }
  const unique = [...new Set(webTokens)];

  const fcmResult = { attempted: unique.length, sent: 0, errors: [] as string[] };
  if (unique.length === 0) {
    return { expo, fcm: fcmResult };
  }

  const messaging = adminMessaging();
  const data = payload.data ? { ...payload.data } : {};
  for (const k of Object.keys(data)) {
    if (data[k] === undefined || data[k] === null) delete data[k];
    else data[k] = String(data[k]);
  }

  const pwaBase = (process.env.STAFF_TELECALLING_PWA_URL || '').trim().replace(/\/$/, '');

  const ref = db.collection('staff').doc(staffId);
  for (const token of unique) {
    try {
      const webpush: {
        notification: { title: string; body: string; icon: string };
        fcmOptions?: { link: string };
      } = {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/manifest-icon-192.maskable.png',
        },
      };
      if (pwaBase) {
        webpush.fcmOptions = { link: `${pwaBase}/app` };
      }

      await messaging.send({
        token,
        notification: { title: payload.title, body: payload.body },
        data,
        webpush,
      });
      fcmResult.sent += 1;
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      const msg = err instanceof Error ? err.message : String(err);
      fcmResult.errors.push(msg);
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        try {
          const r = await ref.get();
          const cur = r.data() || {};
          const updates: Record<string, unknown> = {
            fcmWebPushTokens: FieldValue.arrayRemove(token),
          };
          if (cur.fcmWebPushToken === token) {
            updates.fcmWebPushToken = FieldValue.delete();
          }
          await ref.update(updates);
        } catch (cleanupErr) {
          console.error('FCM token cleanup failed:', cleanupErr);
        }
      }
    }
  }

  return { expo, fcm: fcmResult };
}
