import { adminDb } from '@/server/firebaseAdmin';
import {
  CRM_DUE_CALLS_NOTIFY_COLLECTION,
  CRM_DUE_CALLS_NOTIFY_DOC_ID,
} from '@/lib/crmSettings/dueCallsNotify';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Env-only fallback list when settings doc is empty/invalid. */
export function parseDueCallsNotifyEmailsFromEnv(): string[] {
  const raw = process.env.DUE_CALLS_NOTIFY_EMAILS?.trim() || '';
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((e) => EMAIL_RE.test(e));
}

/** Recipients for daily due-calls digest: Firestore first, env fallback. */
export async function getDueCallsNotifyEmailList(): Promise<string[]> {
  try {
    const snap = await adminDb()
      .collection(CRM_DUE_CALLS_NOTIFY_COLLECTION)
      .doc(CRM_DUE_CALLS_NOTIFY_DOC_ID)
      .get();
    if (!snap.exists) return parseDueCallsNotifyEmailsFromEnv();
    const raw = snap.data()?.emails;
    if (!Array.isArray(raw) || raw.length === 0) return parseDueCallsNotifyEmailsFromEnv();
    const cleaned = raw.map((e) => String(e).trim()).filter(Boolean);
    const valid = [...new Set(cleaned.filter((e) => EMAIL_RE.test(e)))];
    if (valid.length > 0) return valid;
  } catch (err) {
    console.error('getDueCallsNotifyEmailList:', err);
  }
  return parseDueCallsNotifyEmailsFromEnv();
}

/** Optional allow-list for due-call notifications. Empty => auto-map by telecaller names. */
export async function getDueCallsNotificationUserIds(): Promise<string[]> {
  try {
    const snap = await adminDb()
      .collection(CRM_DUE_CALLS_NOTIFY_COLLECTION)
      .doc(CRM_DUE_CALLS_NOTIFY_DOC_ID)
      .get();
    if (!snap.exists) return [];
    const raw = snap.data()?.notificationUserIds;
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((v) => String(v || '').trim()).filter(Boolean))];
  } catch (err) {
    console.error('getDueCallsNotificationUserIds:', err);
    return [];
  }
}

export type DueCallsNotifySchedule = {
  enabled: boolean;
  sendHourIst: number;
  sendMinuteIst: number;
};

export async function getDueCallsNotifySchedule(): Promise<DueCallsNotifySchedule> {
  const fallback: DueCallsNotifySchedule = {
    enabled: true,
    sendHourIst: 9,
    sendMinuteIst: 0,
  };
  try {
    const snap = await adminDb()
      .collection(CRM_DUE_CALLS_NOTIFY_COLLECTION)
      .doc(CRM_DUE_CALLS_NOTIFY_DOC_ID)
      .get();
    if (!snap.exists) return fallback;
    const data = snap.data() || {};
    const sendHourIst = Number(data.sendHourIst);
    const sendMinuteIst = Number(data.sendMinuteIst);
    return {
      enabled: data.enabled !== false,
      sendHourIst: Number.isFinite(sendHourIst) && sendHourIst >= 0 && sendHourIst <= 23 ? sendHourIst : fallback.sendHourIst,
      sendMinuteIst:
        Number.isFinite(sendMinuteIst) && sendMinuteIst >= 0 && sendMinuteIst <= 59 ? sendMinuteIst : fallback.sendMinuteIst,
    };
  } catch (err) {
    console.error('getDueCallsNotifySchedule:', err);
    return fallback;
  }
}
