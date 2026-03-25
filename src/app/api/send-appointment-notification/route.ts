import { NextResponse } from 'next/server';
import { notifyStaffDevices } from '@/server/notifyStaffDevices';

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

    const dateTimeStr = formatAppointmentDate(start);
    const result = await notifyStaffDevices(String(homeVisitorStaffId), {
      title: 'New appointment',
      body: `${patientName} • ${dateTimeStr}`,
      data: {
        type: 'appointment_new',
        patientName: String(patientName),
        start: String(start),
      },
    });

    const anyDelivered = result.expo === 'sent' || result.fcm.sent > 0;
    if (!anyDelivered && result.expo === 'error') {
      return jsonError('Push notification failed', 500);
    }

    if (!anyDelivered && result.expo === 'skipped' && result.fcm.attempted === 0) {
      return NextResponse.json({ ok: true, skipped: 'No push tokens for staff' });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    console.error('send-appointment-notification error:', err);
    const message = err instanceof Error ? err.message : 'Failed to send notification';
    return jsonError(message, 500);
  }
}
