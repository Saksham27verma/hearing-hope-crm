import { adminDb } from '@/server/firebaseAdmin';
import {
  CRM_STAFF_PAYMENT_NOTIFY_COLLECTION,
  CRM_STAFF_PAYMENT_NOTIFY_DOC_ID,
} from '@/lib/crmSettings/staffPaymentNotify';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Env-only list (fallback when CRM Settings has no valid emails). */
export function parseNotifyEmailsFromEnv(): string[] {
  const raw = process.env.STAFF_PAYMENT_NOTIFY_EMAILS?.trim() || '';
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((e) => EMAIL_RE.test(e));
}

/**
 * Recipients for staff collect-payment PDFs: **CRM Settings** (`crmSettings/staffPaymentNotify.emails`)
 * first; if empty/invalid, **STAFF_PAYMENT_NOTIFY_EMAILS** env.
 */
export async function getStaffPaymentNotifyEmailList(): Promise<string[]> {
  try {
    const snap = await adminDb()
      .collection(CRM_STAFF_PAYMENT_NOTIFY_COLLECTION)
      .doc(CRM_STAFF_PAYMENT_NOTIFY_DOC_ID)
      .get();
    if (!snap.exists) return parseNotifyEmailsFromEnv();
    const raw = snap.data()?.emails;
    if (!Array.isArray(raw) || raw.length === 0) return parseNotifyEmailsFromEnv();
    const cleaned = raw.map((e) => String(e).trim()).filter(Boolean);
    const valid = [...new Set(cleaned.filter((e) => EMAIL_RE.test(e)))];
    if (valid.length > 0) return valid;
  } catch (err) {
    console.error('getStaffPaymentNotifyEmailList:', err);
  }
  return parseNotifyEmailsFromEnv();
}
