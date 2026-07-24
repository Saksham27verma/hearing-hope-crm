import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { verifyLifecycleWebhookSecret } from '@/server/lifecycle/lifecycleAuth';
import {
  extractMessageId,
  sendLifecycleWhatsApp,
} from '@/server/lifecycle/pinnacleLifecycleSend';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type Recipient = {
  externalSaleId: string;
  phone: string;
  customerName: string;
  bodyParams: string[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  if (!verifyLifecycleWebhookSecret(req)) {
    return jsonError('Unauthorized', 401);
  }

  const body = (await req.json().catch(() => null)) as {
    templateKey?: string;
    recipients?: Recipient[];
    delayMs?: number;
  } | null;
  if (!body?.recipients?.length) {
    return jsonError('recipients array required', 400);
  }

  const templateKey = String(body.templateKey || 'service_1yr');
  const delayMs = Math.max(500, Math.min(5000, Number(body.delayMs) || 1500));
  const recipients = body.recipients.slice(0, 500);
  const jobId = randomUUID();
  const db = adminDb();

  await db.collection('lifecycle_whatsapp_batches').doc(jobId).set({
    templateKey,
    total: recipients.length,
    sent: 0,
    failed: 0,
    status: 'running',
    createdAt: FieldValue.serverTimestamp(),
  });

  const results: Array<{ externalSaleId: string; ok: boolean; error?: string; messageId?: string }> =
    [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const bodyParams = Array.isArray(r.bodyParams) ? r.bodyParams.map((x) => String(x)) : [];
    const out = await sendLifecycleWhatsApp({
      phone: r.phone,
      templateKey,
      bodyParams,
      customerName: r.customerName,
      externalSaleId: r.externalSaleId,
    });
    if (out.ok) {
      const messageId = out.messageId || extractMessageId(out.response);
      if (!messageId) {
        failed += 1;
        results.push({
          externalSaleId: r.externalSaleId,
          ok: false,
          error: 'Pinnacle did not return a WhatsApp message id',
        });
      } else {
        sent += 1;
        results.push({
          externalSaleId: r.externalSaleId,
          ok: true,
          messageId,
        });
      }
    } else {
      failed += 1;
      results.push({ externalSaleId: r.externalSaleId, ok: false, error: out.error });
    }
    if (i < recipients.length - 1) await sleep(delayMs);
  }

  await db.collection('lifecycle_whatsapp_batches').doc(jobId).set(
    {
      sent,
      failed,
      status: 'done',
      finishedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true, jobId, total: recipients.length, sent, failed, results });
}
