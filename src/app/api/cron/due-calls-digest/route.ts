import { NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { sendSimpleSmtpMail, isSmtpConfigured } from '@/server/sendStaffPaymentNotifyEmail';
import { getDueCallsNotifyEmailList, getDueCallsNotifySchedule } from '@/server/dueCallsNotifyEmails';
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

function inAllowedIstWindow(targetHourIst: number, targetMinuteIst: number, now = new Date()): boolean {
  const { hour, minute } = getIstParts(now);
  return hour === targetHourIst && minute >= targetMinuteIst && minute <= Math.min(targetMinuteIst + 15, 59);
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

  const schedule = await getDueCallsNotifySchedule();
  if (!schedule.enabled) {
    return NextResponse.json({
      ok: true,
      sent: false,
      skippedReason: 'Daily due-calls digest is disabled',
    });
  }

  if (!inAllowedIstWindow(schedule.sendHourIst, schedule.sendMinuteIst)) {
    return NextResponse.json({
      ok: true,
      sent: false,
      skippedReason: `Outside configured IST window (${String(schedule.sendHourIst).padStart(2, '0')}:${String(
        schedule.sendMinuteIst,
      ).padStart(2, '0')} to +15m)`,
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
  const latestRef = db.collection('cronRuns').doc('dueCallsDigest-latest');
  const lockState = await db.runTransaction(async (tx) => {
    const snap = await tx.get(runRef);
    const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
    if (data?.sent === true) return 'already_sent' as const;
    if (data?.inProgress === true) return 'in_progress' as const;
    tx.set(
      runRef,
      {
        key: runKey,
        sent: false,
        inProgress: true,
        startedAt: new Date().toISOString(),
        dateYmdIst,
        recipientCount: recipients.length,
        dueCount: rows.length,
      },
      { merge: true },
    );
    return 'locked' as const;
  });

  if (lockState === 'already_sent') {
    return NextResponse.json({
      ok: true,
      sent: false,
      skippedReason: 'Already sent for today',
      dueCount: rows.length,
      recipients: recipients.length,
    });
  }
  if (lockState === 'in_progress') {
    return NextResponse.json({
      ok: true,
      sent: false,
      skippedReason: 'Another send is already in progress',
      dueCount: rows.length,
      recipients: recipients.length,
    });
  }

  try {
    const subject = buildDueCallsDigestEmailSubject(dateYmdIst);
    const text = buildDueCallsDigestText(dateYmdIst, rows);
    const html = buildDueCallsDigestHtml(dateYmdIst, rows, process.env.NEXT_PUBLIC_APP_URL);
    await sendSimpleSmtpMail({ to: recipients, subject, text, html });
    const sentAt = new Date().toISOString();
    await runRef.set(
      {
        sent: true,
        inProgress: false,
        sentAt,
        error: null,
      },
      { merge: true },
    );
    await latestRef.set(
      {
        key: runKey,
        sent: true,
        inProgress: false,
        sentAt,
        error: null,
        dueCount: rows.length,
        recipientCount: recipients.length,
        schedule: {
          enabled: schedule.enabled,
          sendHourIst: schedule.sendHourIst,
          sendMinuteIst: schedule.sendMinuteIst,
        },
      },
      { merge: true },
    );
  } catch (error) {
    const failedAt = new Date().toISOString();
    const errMsg = error instanceof Error ? error.message : String(error);
    await runRef.set(
      {
        sent: false,
        inProgress: false,
        error: errMsg,
        failedAt,
      },
      { merge: true },
    );
    await latestRef.set(
      {
        key: runKey,
        sent: false,
        inProgress: false,
        failedAt,
        error: errMsg,
        dueCount: rows.length,
        recipientCount: recipients.length,
        schedule: {
          enabled: schedule.enabled,
          sendHourIst: schedule.sendHourIst,
          sendMinuteIst: schedule.sendMinuteIst,
        },
      },
      { merge: true },
    );
    throw error;
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    recipients,
    dueCount: rows.length,
  });
}
