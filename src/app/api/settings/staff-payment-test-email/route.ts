import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import {
  isSmtpConfigured,
  sendSimpleSmtpMail,
} from '@/server/sendStaffPaymentNotifyEmail';
import { getStaffPaymentNotifyEmailList } from '@/server/staffPaymentNotifyEmails';

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

/** Diagnostics: SMTP env + resolved recipient list (no email sent). */
export async function GET(req: Request) {
  const user = await verifyCrmUser(req);
  if (!user) return jsonError('Unauthorized', 401);

  const recipients = await getStaffPaymentNotifyEmailList();
  return NextResponse.json({
    ok: true,
    smtpConfigured: isSmtpConfigured(),
    recipientCount: recipients.length,
    recipientsPreview: recipients.slice(0, 8),
  });
}

/** Send a one-line test message to all configured recipients. */
export async function POST(req: Request) {
  const user = await verifyCrmUser(req);
  if (!user) return jsonError('Unauthorized', 401);

  const recipients = await getStaffPaymentNotifyEmailList();
  if (recipients.length === 0) {
    return jsonError(
      'No recipient emails configured. Save at least one valid address in Settings above (or set STAFF_PAYMENT_NOTIFY_EMAILS on the server).',
      400,
      { smtpConfigured: isSmtpConfigured() }
    );
  }

  if (!isSmtpConfigured()) {
    return jsonError(
      'SMTP is not configured on the server. Add SMTP_HOST, SMTP_PORT, and usually SMTP_USER, SMTP_PASS, and SMTP_FROM to your deployment environment (Vercel/host), redeploy, then try again. For local development, add them to .env.local and restart the dev server.',
      503,
      { smtpConfigured: false, recipientCount: recipients.length }
    );
  }

  try {
    await sendSimpleSmtpMail({
      to: recipients,
      subject: '[Hope CRM] Test — staff payment notify',
      text: [
        'This is a test email from Hope CRM Settings.',
        '',
        'If you received this, SMTP and recipient addresses are working.',
        `Recipients for staff payment PDFs: ${recipients.join(', ')}`,
        '',
        `Sent at ${new Date().toISOString()}`,
      ].join('\n'),
    });
    return NextResponse.json({
      ok: true,
      sentTo: recipients,
      message: `Test email sent to ${recipients.length} address(es). Check inbox and spam.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Send failed';
    console.error('staff-payment-test-email POST:', err);
    return jsonError(msg, 502, { smtpConfigured: true, recipientCount: recipients.length });
  }
}
