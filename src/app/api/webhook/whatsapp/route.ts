import { NextResponse } from 'next/server';
import { persistWhatsAppInboundMessage } from '@/server/notifications/persistWhatsAppInbound';
import { persistWhatsAppDeliveryStatuses } from '@/server/whatsapp/persistWhatsAppDeliveryStatus';

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

async function triggerNotification(
  waMessageId: string,
  customerName: string,
  customerPhone: string,
  messageBody: string,
): Promise<void> {
  try {
    console.log('[WhatsApp inbound]', {
      waMessageId,
      customerName,
      customerPhone,
      messageBody,
    });

    const { stored, notified } = await persistWhatsAppInboundMessage({
      waMessageId,
      customerName,
      customerPhone,
      messageBody,
    });
    if (stored) {
      console.log('[WhatsApp inbound] saved to CRM inbox, admins notified:', notified);
    }
  } catch (err) {
    console.error('[WhatsApp inbound] triggerNotification failed:', err);
  }
}

/**
 * GET — Pinnacle / Meta webhook subscription verification.
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

    const statuses = value?.statuses;
    if (Array.isArray(statuses) && statuses.length > 0) {
      try {
        await persistWhatsAppDeliveryStatuses(statuses);
      } catch (err) {
        console.error('[WhatsApp status] persist failed:', err);
      }
      if (!message) {
        return NextResponse.json({ ok: true, skipped: 'status_only' });
      }
    }

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

    const waMessageId = String(message.id || '').trim() || `anon-${Date.now()}`;
    await triggerNotification(waMessageId, customerName, customerPhone, messageBody);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[WhatsApp webhook] POST handler error:', err);
    return NextResponse.json({ ok: true });
  }
}
