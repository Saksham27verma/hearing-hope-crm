import { NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizeCenterIdsFromProfile } from '@/lib/tenant/centerScope';
import { sendSimpleSmtpMail, isSmtpConfigured } from '@/server/sendStaffPaymentNotifyEmail';
import { getDueCallsNotificationUserIds, getDueCallsNotifyEmailList, getDueCallsNotifySchedule } from '@/server/dueCallsNotifyEmails';
import {
  buildDueCallsDigestEmailSubject,
  buildDueCallsDigestHtml,
  buildDueCallsDigestText,
  collectTodayDueCallsDigest,
} from '@/server/dueCallsDigest';

function normalizeNameKey(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

type UserLike = {
  uid: string;
  email?: string;
  displayName?: string;
  nickname?: string;
  role?: string;
  branchId?: string;
  centerId?: string | null;
  centerIds?: string[] | null;
};

async function writeDueCallsNotifications(params: {
  dateYmdIst: string;
  rows: Array<{ telecaller: string; centerId: string | null }>;
  selectedUserIds: string[];
}): Promise<{ written: number }> {
  const { dateYmdIst, rows, selectedUserIds } = params;
  const db = adminDb();
  const allowSet = new Set(selectedUserIds.map((x) => String(x).trim()).filter(Boolean));

  // Group by telecaller + center (center-scoped).
  const groups = new Map<string, { telecallerKey: string; telecallerLabel: string; centerId: string | null; count: number }>();
  for (const r of rows) {
    const telecallerLabel = String(r.telecaller || '').trim();
    const telecallerKey = normalizeNameKey(telecallerLabel);
    if (!telecallerKey || telecallerKey === 'unassigned') continue;
    const centerId = r.centerId ? String(r.centerId).trim() : null;
    const k = `${telecallerKey}|${centerId || '__none'}`;
    const prev = groups.get(k);
    if (prev) prev.count += 1;
    else groups.set(k, { telecallerKey, telecallerLabel, centerId, count: 1 });
  }
  if (groups.size === 0) return { written: 0 };

  // Build name-key -> users map (displayName + nickname + email local part).
  const usersSnap = await db.collection('users').get();
  const nameToUsers = new Map<string, UserLike[]>();
  usersSnap.docs.forEach((d) => {
    const data = (d.data() || {}) as Omit<UserLike, 'uid'>;
    const u: UserLike = { uid: d.id, ...data };
    const addKey = (k: string) => {
      const key = normalizeNameKey(k);
      if (!key) return;
      const list = nameToUsers.get(key) || [];
      list.push(u);
      nameToUsers.set(key, list);
    };
    if (u.displayName) addKey(u.displayName);
    if (u.nickname) addKey(u.nickname);
    if (u.email && u.email.includes('@')) addKey(u.email.split('@')[0]);
  });

  const ops: Array<{ id: string; doc: Record<string, unknown> }> = [];
  for (const g of groups.values()) {
    const candidates = nameToUsers.get(g.telecallerKey) || [];
    for (const u of candidates) {
      // Staff-only (as requested).
      if (String(u.role || '').trim().toLowerCase() !== 'staff') continue;
      if (allowSet.size > 0 && !allowSet.has(u.uid)) continue;

      const allowedCenters = normalizeCenterIdsFromProfile({
        centerId: u.centerId ?? null,
        branchId: u.branchId,
        centerIds: u.centerIds ?? null,
      });
      if (g.centerId && allowedCenters.length > 0 && !allowedCenters.includes(g.centerId)) continue;

      const centerPart = g.centerId ? `|${g.centerId}` : '';
      const id = `cronDueCalls|${dateYmdIst}|${u.uid}|${g.centerId || '__none'}`;
      const title = "Today's Due Calls";
      const message = `You have ${g.count} due call${g.count === 1 ? '' : 's'} today${g.centerId ? ` (${g.centerId})` : ''}.`;
      const href = `/telecalling-records?quickFilter=due_today&telecaller=${encodeURIComponent(g.telecallerLabel)}`;
      ops.push({
        id,
        doc: {
          userId: u.uid,
          centerId: g.centerId,
          type: 'due_calls',
          title,
          message,
          href,
          entity: { kind: 'system', id: `dueCalls|${dateYmdIst}${centerPart}` },
          is_read: false,
          readAt: null,
          createdAt: FieldValue.serverTimestamp(),
          dedupeKey: id,
        },
      });
    }
  }
  if (ops.length === 0) return { written: 0 };

  // Batch in chunks (Firestore limit: 500 writes / batch).
  let written = 0;
  const chunkSize = 450;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const chunk = ops.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach((op) => {
      const ref = db.collection('notifications').doc(op.id);
      batch.set(ref, op.doc, { merge: false });
    });
    await batch.commit();
    written += chunk.length;
  }
  return { written };
}

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
  const selectedUserIds = await getDueCallsNotificationUserIds();
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

    // Create staff notifications (idempotent: deterministic ids per day/user/center).
    let notificationsWritten = 0;
    try {
      const res = await writeDueCallsNotifications({ dateYmdIst, rows, selectedUserIds });
      notificationsWritten = res.written;
    } catch (err) {
      console.error('Due-calls notifications write failed:', err);
      // Non-fatal: email can still send.
    }

    await sendSimpleSmtpMail({ to: recipients, subject, text, html });
    const sentAt = new Date().toISOString();
    await runRef.set(
      {
        sent: true,
        inProgress: false,
        sentAt,
        notificationsWritten,
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
        notificationsWritten,
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
