import { NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { notifyStaffDevices } from '@/server/notifyStaffDevices';

function formatAppointmentDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Remind assigned staff when an appointment start time is reached (30-minute lookback window).
 * Secured with CRON_SECRET: call with header Authorization: Bearer <CRON_SECRET>.
 *
 * Vercel Hobby: cannot schedule this more than once per day, so do not use vercel.json crons for
 * this route on Hobby. Use Vercel Pro (e.g. cron */5 * * * *) or an external cron (cron-job.org,
 * etc.) hitting GET this URL every ~5 minutes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (process.env.VERCEL && !secret) {
    return NextResponse.json(
      { ok: false, error: 'Set CRON_SECRET in Vercel for appointment reminders' },
      { status: 503 }
    );
  }
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = Date.now();
  /** Appointment started within this window (covers cron drift). */
  const windowMs = 30 * 60 * 1000;

  const db = adminDb();
  const snap = await db.collection('appointments').where('status', '==', 'scheduled').limit(400).get();

  let checked = 0;
  let reminded = 0;
  const errors: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const startRaw = data.start;
    if (typeof startRaw !== 'string') continue;
    const startMs = new Date(startRaw).getTime();
    if (!Number.isFinite(startMs)) continue;

    checked += 1;
    // Started in the last `windowMs`, not in the future beyond 2 minutes (clock skew)
    if (startMs > now + 2 * 60 * 1000) continue;
    if (startMs < now - windowMs) continue;

    if (data.pwaReminderSentForStart === startRaw) continue;

    const type = data.type;
    const staffId =
      type === 'home'
        ? (data.homeVisitorStaffId as string | undefined)
        : (data.assignedStaffId as string | undefined);
    if (!staffId) continue;

    const patientName = (data.patientName || data.title || 'Patient') as string;
    const dateTimeStr = formatAppointmentDate(startRaw);

    try {
      await notifyStaffDevices(staffId, {
        title: 'Appointment starting',
        body: `${patientName} • ${dateTimeStr}`,
        data: {
          type: 'appointment_due',
          appointmentId: doc.id,
          patientName: String(patientName),
          start: String(startRaw),
        },
      });
      await doc.ref.update({ pwaReminderSentForStart: startRaw });
      reminded += 1;
    } catch (e) {
      errors.push(`${doc.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    checked,
    reminded,
    errors: errors.length ? errors : undefined,
  });
}
