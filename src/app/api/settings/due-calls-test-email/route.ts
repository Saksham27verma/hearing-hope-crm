import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { isSmtpConfigured, sendSimpleSmtpMail } from '@/server/sendStaffPaymentNotifyEmail';
import { getDueCallsNotifyEmailList } from '@/server/dueCallsNotifyEmails';
import {
  buildDueCallsDigestEmailSubject,
  buildDueCallsDigestHtml,
  buildDueCallsDigestText,
  collectTodayDueCallsDigest,
} from '@/server/dueCallsDigest';

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

async function verifyCrmUser(req: Request): Promise<{ uid: string } | null> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const decoded = await adminAuth().verifyIdToken(match[1]);
    const db = adminDb();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return null;
    const roleRaw = (userSnap.data() as { role?: string })?.role;
    const role = typeof roleRaw === 'string' ? roleRaw.trim().toLowerCase() : '';
    if (!role || !['admin', 'staff', 'audiologist'].includes(role)) return null;
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const user = await verifyCrmUser(req);
  if (!user) return jsonError('Unauthorized', 401);

  const recipients = await getDueCallsNotifyEmailList();
  return NextResponse.json({
    ok: true,
    smtpConfigured: isSmtpConfigured(),
    recipientCount: recipients.length,
    recipientsPreview: recipients.slice(0, 8),
  });
}

export async function POST(req: Request) {
  const user = await verifyCrmUser(req);
  if (!user) return jsonError('Unauthorized', 401);

  const recipients = await getDueCallsNotifyEmailList();
  if (recipients.length === 0) {
    return jsonError('No recipient emails configured for due-calls digest.', 400, {
      smtpConfigured: isSmtpConfigured(),
    });
  }
  if (!isSmtpConfigured()) {
    return jsonError('SMTP is not configured on the server.', 503, { smtpConfigured: false });
  }

  const { dateYmdIst, rows } = await collectTodayDueCallsDigest();
  const subject = `[TEST] ${buildDueCallsDigestEmailSubject(dateYmdIst)}`;
  const text = buildDueCallsDigestText(dateYmdIst, rows);
  const html = buildDueCallsDigestHtml(dateYmdIst, rows, process.env.NEXT_PUBLIC_APP_URL);
  await sendSimpleSmtpMail({ to: recipients, subject, text, html });

  return NextResponse.json({
    ok: true,
    sentTo: recipients,
    dueCount: rows.length,
    message: `Test email sent to ${recipients.length} address(es).`,
  });
}
