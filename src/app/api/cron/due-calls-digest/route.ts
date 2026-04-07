import { NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { sendSimpleSmtpMail, isSmtpConfigured } from '@/server/sendStaffPaymentNotifyEmail';
import { getDueCallsNotifyEmailList } from '@/server/dueCallsNotifyEmails';
import {
  buildDueCallsDigestEmailSubject,
  buildDueCallsDigestHtml,
  buildDueCallsDigestText,
  collectTodayDueCallsDigest,
} from '@/server/dueCallsDigest';

function getIstParts(now = new Date()): { ymd: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0');
  return { ymd: `${year}-${month}-${day}`, hour, minute };
}

function inAllowedIstWindow(now = new Date()): boolean {
  const { hour, minute } = getIstParts(now);
  return hour === 9 && minute >= 0 && minute <= 15;
}

/**
 * Daily due-calls digest for fixed recipients.
 * Secure with Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!inAllowedIstWindow()) {
    return NextResponse.json({
      ok: true,
      sent: false,
      skippedReason: 'Outside 9:00-9:15 IST window',
    });
  }

  const recipients = await getDueCallsNotifyEmailList();
  if (!recipients.length) {
    return NextResponse.json({ ok: true, sent: false, skippedReason: 'No recipients configured' });
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json({ ok: false, sent: false, error: 'SMTP not configured' }, { status: 503 });
  }

  const { dateYmdIst, rows } = await collectTodayDueCallsDigest();
  const db = adminDb();
  const runKey = `dueCallsDigest-${dateYmdIst}-IST`;
  const runRef = db.collection('cronRuns').doc(runKey);
  const alreadySent = await db.runTransaction(async (tx) => {
    const snap = await tx.get(runRef);
    if (snap.exists && snap.data()?.sent === true) return true;
    tx.set(
      runRef,
      {
        key: runKey,
        sent: true,
        sentAt: new Date().toISOString(),
        dateYmdIst,
        recipientCount: recipients.length,
        dueCount: rows.length,
      },
      { merge: true },
    );
    return false;
  });

  if (alreadySent) {
    return NextResponse.json({
      ok: true,
      sent: false,
      skippedReason: 'Already sent for today',
      dueCount: rows.length,
      recipients: recipients.length,
    });
  }

  const subject = buildDueCallsDigestEmailSubject(dateYmdIst);
  const text = buildDueCallsDigestText(dateYmdIst, rows);
  const html = buildDueCallsDigestHtml(dateYmdIst, rows, process.env.NEXT_PUBLIC_APP_URL);
  await sendSimpleSmtpMail({ to: recipients, subject, text, html });

  return NextResponse.json({
    ok: true,
    sent: true,
    recipients,
    dueCount: rows.length,
  });
}
