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
  const bodyParams = Array.isArray(body.bodyParams)
    ? body.bodyParams.map((x) => String(x))
    : [customerName || 'Customer', 'Hearing Hope'];

  if (!externalSaleId || !phone) {
    return jsonError('externalSaleId and phone required', 400);
  }

  const result = await sendLifecycleWhatsApp({ phone, templateKey, bodyParams });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    messageId: extractMessageId(result.response),
    externalSaleId,
  });
}
