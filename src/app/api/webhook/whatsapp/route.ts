import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Meta / WhatsApp Cloud API nested callback shape (Pinnacle mirrors this). */
type PinnacleWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string;
          id?: string;
          type?: string;
          text?: { body?: string };
        }>;
        contacts?: Array<{
          profile?: { name?: string };
        }>;
        statuses?: unknown[];
      };
    }>;
  }>;
};

function getVerifyToken(): string | null {
  const token = (process.env.PINNACLE_WEBHOOK_VERIFY_TOKEN || '').trim();
  return token || null;
}

/**
 * Placeholder notification hook — no database writes.
 * Wire up email, Slack, or push when you are ready.
 */
async function triggerNotification(
  customerName: string,
  customerPhone: string,
  messageBody: string,
): Promise<void> {
  try {
    console.log('[WhatsApp inbound]', {
      customerName,
      customerPhone,
      messageBody,
    });

    // --- Email via existing CRM SMTP (Nodemailer) ---
    // import { isSmtpConfigured, sendSimpleSmtpMail } from '@/server/sendStaffPaymentNotifyEmail';
    // const notifyEmails = (process.env.WHATSAPP_NOTIFY_EMAILS || '')
    //   .split(',')
    //   .map((e) => e.trim())
    //   .filter(Boolean);
    // if (isSmtpConfigured() && notifyEmails.length > 0) {
    //   await sendSimpleSmtpMail({
    //     to: notifyEmails,
    //     subject: `WhatsApp from ${customerName} (${customerPhone})`,
    //     text: messageBody,
    //   });
    // }

    // --- Resend (install `resend`, set RESEND_API_KEY) ---
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'Hope CRM <noreply@yourdomain.com>',
    //   to: notifyEmails,
    //   subject: `WhatsApp from ${customerName}`,
    //   text: `${customerName} (${customerPhone}):\n\n${messageBody}`,
    // });

    // --- Slack incoming webhook ---
    // const slackUrl = process.env.SLACK_WHATSAPP_WEBHOOK_URL?.trim();
    // if (slackUrl) {
    //   await fetch(slackUrl, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       text: `*${customerName}* (${customerPhone})\n${messageBody}`,
    //     }),
    //   });
    // }
  } catch (err) {
    console.error('[WhatsApp inbound] triggerNotification failed:', err);
  }
}

/**
 * GET — Pinnacle / Meta webhook subscription verification.
 * Register the same verify token in Pinnacle as PINNACLE_WEBHOOK_VERIFY_TOKEN.
 */
export async function GET(req: Request) {
  const expectedToken = getVerifyToken();
  if (!expectedToken) {
    console.error('[WhatsApp webhook] PINNACLE_WEBHOOK_VERIFY_TOKEN is not set');
    return NextResponse.json(
      { ok: false, error: 'Webhook verify token not configured' },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !challenge) {
    return NextResponse.json({ ok: false, error: 'Invalid verification request' }, { status: 400 });
  }

  if (token !== expectedToken) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * POST — Incoming Pinnacle callbacks (messages, statuses, etc.).
 * Always returns 200 so Pinnacle does not retry indefinitely.
 */
export async function POST(req: Request) {
  try {
    const payload = (await req.json().catch(() => null)) as PinnacleWebhookPayload | null;
    if (!payload) {
      return NextResponse.json({ ok: true, skipped: 'invalid_json' });
    }

    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ ok: true, skipped: 'no_message' });
    }

    if (message.type !== 'text' || !message.text?.body) {
      return NextResponse.json({
        ok: true,
        skipped: 'unsupported_type',
        type: message.type ?? 'unknown',
      });
    }

    const customerPhone = String(message.from || '').trim();
    const messageBody = String(message.text.body).trim();
    const contact = value?.contacts?.[0];
    const customerName = String(contact?.profile?.name || '').trim() || 'Unknown';

    if (!customerPhone || !messageBody) {
      return NextResponse.json({ ok: true, skipped: 'incomplete_message' });
    }

    await triggerNotification(customerName, customerPhone, messageBody);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[WhatsApp webhook] POST handler error:', err);
    return NextResponse.json({ ok: true });
  }
}
