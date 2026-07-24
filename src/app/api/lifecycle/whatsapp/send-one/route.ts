import { NextResponse } from 'next/server';
import { verifyLifecycleWebhookSecret } from '@/server/lifecycle/lifecycleAuth';
import {
  extractMessageId,
  sendLifecycleWhatsApp,
} from '@/server/lifecycle/pinnacleLifecycleSend';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  if (!verifyLifecycleWebhookSecret(req)) {
    return jsonError('Unauthorized', 401);
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError('Invalid JSON', 400);

  const externalSaleId = String(body.externalSaleId || '').trim();
  const phone = String(body.phone || '').trim();
  const customerName = String(body.customerName || '').trim();
  const templateKey = String(body.templateKey || 'service_1yr').trim();
  // Templates are static (no Meta placeholders) — do not invent body params.
  const bodyParams = Array.isArray(body.bodyParams)
    ? body.bodyParams.map((x) => String(x))
    : [];

  if (!externalSaleId || !phone) {
    return jsonError('externalSaleId and phone required', 400);
  }

  const result = await sendLifecycleWhatsApp({
    phone,
    templateKey,
    bodyParams,
    customerName,
    externalSaleId,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const messageId = result.messageId || extractMessageId(result.response);
  if (!messageId) {
    return NextResponse.json(
      { ok: false, error: 'Pinnacle did not return a WhatsApp message id' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    messageId,
    templateName: result.templateName,
    to: result.to,
    externalSaleId,
    deliveryMode: (process.env.PINNACLE_LIFECYCLE_DELIVERY_MODE || 'document').trim() || 'document',
    pinnacle: result.response,
  });
}
