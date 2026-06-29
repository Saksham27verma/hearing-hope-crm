import { adminDb } from '@/server/firebaseAdmin';
import {
  CRM_SALE_MILESTONE_NOTIFY_COLLECTION,
  CRM_SALE_MILESTONE_NOTIFY_DOC_ID,
  type SaleMilestoneNotifyDoc,
} from '@/lib/crmSettings/saleMilestoneNotify';

export function verifyLifecycleWebhookSecret(req: Request): boolean {
  const secret = process.env.LIFECYCLE_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return Boolean(match && match[1] === secret);
}

export async function getSaleMilestoneNotificationUserIds(): Promise<string[]> {
  const envIds = (process.env.SALE_MILESTONE_NOTIFY_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (envIds.length > 0) return envIds;

  const db = adminDb();
  const snap = await db
    .collection(CRM_SALE_MILESTONE_NOTIFY_COLLECTION)
    .doc(CRM_SALE_MILESTONE_NOTIFY_DOC_ID)
    .get();
  const data = (snap.data() || {}) as SaleMilestoneNotifyDoc;
  if (data.enabled === false) return [];
  return Array.isArray(data.notificationUserIds)
    ? data.notificationUserIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
}

export async function getSaleMilestoneNotifyEnabled(): Promise<boolean> {
  const db = adminDb();
  const snap = await db
    .collection(CRM_SALE_MILESTONE_NOTIFY_COLLECTION)
    .doc(CRM_SALE_MILESTONE_NOTIFY_DOC_ID)
    .get();
  const data = (snap.data() || {}) as SaleMilestoneNotifyDoc;
  return data.enabled !== false;
}
