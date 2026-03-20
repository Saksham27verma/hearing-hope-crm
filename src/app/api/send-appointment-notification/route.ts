import { NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function formatAppointmentDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { patientName, start, homeVisitorStaffId } = body || {};

    if (!homeVisitorStaffId || !patientName || !start) {
      return jsonError('Missing required fields: patientName, start, homeVisitorStaffId', 400);
    }

    const db = adminDb();
    const staffDoc = await db.collection('staff').doc(homeVisitorStaffId).get();
    const pushToken = staffDoc.data()?.pushToken as string | undefined;

    if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
      return NextResponse.json({ ok: true, skipped: 'No push token for staff' });
    }

    const dateTimeStr = formatAppointmentDate(start);
    const message = {
      to: pushToken,
      title: 'New Home Visit Appointment',
      body: `${patientName} • ${dateTimeStr}`,
      data: { type: 'appointment', patientName, start },
      sound: 'default',
      channelId: 'appointments',
    };

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await res.json().catch(() => ({}));
    if (result.data?.status === 'error') {
      console.error('Expo push error:', result.data.message);
      return jsonError(result.data.message || 'Failed to send notification', 500);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('send-appointment-notification error:', err);
    return jsonError(err?.message || 'Failed to send notification', 500);
  }
}
