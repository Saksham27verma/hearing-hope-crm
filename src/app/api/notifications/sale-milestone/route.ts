import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { writeNotification } from '@/server/notifications';
import {
  getSaleMilestoneNotificationUserIds,
  getSaleMilestoneNotifyEnabled,
  verifyLifecycleWebhookSecret,
} from '@/server/lifecycle/lifecycleAuth';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  if (!verifyLifecycleWebhookSecret(req)) {
    return jsonError('Unauthorized', 401);
  }

  const enabled = await getSaleMilestoneNotifyEnabled();
  if (!enabled) {
    return NextResponse.json({ ok: true, notified: 0, skippedReason: 'disabled' });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError('Invalid JSON', 400);

  const externalSaleId = String(body.externalSaleId || '').trim();
  const customerName = String(body.customerName || 'Customer').trim();
  const phone = String(body.phone || '').trim();
  const reference = String(body.reference || '').trim();
  const saleDate = String(body.saleDate || '').trim();
  const milestoneDays = Number(body.milestoneDays);
  const milestoneLabel = String(body.milestoneLabel || '').trim();
  const title = String(body.title || `${milestoneLabel} — ${customerName}`).trim();
  const message =
    String(body.message || '').trim() ||
    `Sale on ${saleDate}${reference ? ` · ${reference}` : ''} · ${phone}`;
  const centerIdRaw = body.centerId;
  const centerId = centerIdRaw ? String(centerIdRaw).trim() : null;

  if (!externalSaleId || !Number.isFinite(milestoneDays)) {
    return jsonError('externalSaleId and milestoneDays required', 400);
  }

  const userIds = await getSaleMilestoneNotificationUserIds();
  let recipients = userIds;

  if (recipients.length === 0) {
    const adminsSnap = await adminDb().collection('users').where('role', '==', 'admin').get();
    recipients = adminsSnap.docs.map((d) => d.id);
  }

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  const lifecycleUrl = (process.env.LIFECYCLE_APP_URL || '').replace(/\/$/, '');
  const href = lifecycleUrl
    ? `${lifecycleUrl}/sales?highlight=${encodeURIComponent(externalSaleId)}&from=crm`
    : null;

  let notified = 0;
  for (const uid of recipients) {
    const notifId = `saleMilestone|${externalSaleId}|${milestoneDays}|${uid}`;
    const dedupeKey = `saleMilestone|${externalSaleId}|${milestoneDays}`;
    await writeNotification({
      id: notifId,
      doc: {
        userId: uid,
        centerId,
        type: 'sale_milestone',
        title,
        message,
        href,
        entity: { kind: 'legacy_sale', id: externalSaleId },
        is_read: false,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
        dedupeKey,
      },
    });
    notified += 1;
  }

  return NextResponse.json({ ok: true, notified });
}
