import { NextResponse } from 'next/server';
import { verifyLifecycleWebhookSecret } from '@/server/lifecycle/lifecycleAuth';
import { isSmtpConfigured, sendSimpleSmtpMail } from '@/server/sendStaffPaymentNotifyEmail';
import {
  buildLifecycleDigestHtml,
  buildLifecycleDigestSubject,
  buildLifecycleDigestText,
  parseLifecycleDigestEmails,
  type LifecycleDigestPayload,
} from '@/server/lifecycle/lifecycleDailyDigest';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  if (!verifyLifecycleWebhookSecret(req)) {
    return jsonError('Unauthorized', 401);
  }

  const body = (await req.json().catch(() => null)) as LifecycleDigestPayload | null;
  if (!body || !body.date) {
    return jsonError('date required', 400);
  }

  const to = parseLifecycleDigestEmails();
  if (to.length === 0) {
    return jsonError('LIFECYCLE_DIGEST_EMAIL is not set', 503);
  }
  if (!isSmtpConfigured()) {
    return jsonError('SMTP is not configured', 503);
  }

  const payload: LifecycleDigestPayload = {
    date: String(body.date),
    due: Number(body.due) || 0,
    sent: Number(body.sent) || 0,
    failed: Number(body.failed) || 0,
    byMilestone: body.byMilestone && typeof body.byMilestone === 'object' ? body.byMilestone : {},
    rows: Array.isArray(body.rows) ? body.rows : [],
    dashboardUrl: body.dashboardUrl ? String(body.dashboardUrl) : undefined,
    notificationCreated: Number(body.notificationCreated) || 0,
    crmNotified: Number(body.crmNotified) || 0,
  };

  try {
    await sendSimpleSmtpMail({
      to,
      subject: buildLifecycleDigestSubject(payload),
      text: buildLifecycleDigestText(payload),
      html: buildLifecycleDigestHtml(payload),
    });
    return NextResponse.json({ ok: true, to });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Digest email failed' },
      { status: 502 },
    );
  }
}
