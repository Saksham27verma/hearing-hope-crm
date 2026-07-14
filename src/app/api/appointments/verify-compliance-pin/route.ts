import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import { isHomeVisitAppointment } from '@/lib/visitCompliance/helpers';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

function jsonError(message: string, status: number) {
  return withCors(NextResponse.json({ ok: false, error: message }, { status }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/**
 * Staff PWA verifies the telecaller PIN before GPS + compliance questionnaire.
 */
export async function POST(req: Request) {
  try {
    const { uid } = await verifyStaffFromBearer(req);
    const body = (await req.json().catch(() => null)) as {
      appointmentId?: unknown;
      pin?: unknown;
    } | null;

    const appointmentId = String(body?.appointmentId || '').trim();
    const pin = String(body?.pin ?? '').trim();
    if (!appointmentId) return jsonError('appointmentId is required', 400);
    if (!/^\d{4}$/.test(pin)) return jsonError('PIN must be exactly 4 digits', 400);

    const db = adminDb();
    const ref = db.collection('appointments').doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError('Appointment not found', 404);

    const data = snap.data() || {};
    if (!isHomeVisitAppointment(data)) {
      return jsonError('Compliance verification is only for home visits', 400);
    }

    const assigned =
      String(data.homeVisitorStaffId || '').trim() === uid ||
      String(data.assignedStaffId || '').trim() === uid;
    if (!assigned) return jsonError('You are not assigned to this appointment', 403);

    const status = String(data.status || 'scheduled').toLowerCase();
    if (status === 'cancelled') return jsonError('Appointment is cancelled', 400);
    if (status === 'completed' && data.complianceStatus === 'completed') {
      return jsonError('Visit already completed', 400);
    }

    if (data.telecaller_verified === true) {
      return withCors(
        NextResponse.json({
          ok: true,
          alreadyVerified: true,
          complianceStatus: data.complianceStatus || 'incomplete_compliance',
        })
      );
    }

    const expected = String(data.telecaller_pin || '').trim();
    if (!expected) {
      return jsonError('No verification PIN has been generated yet. Ask the telecaller to generate one in CRM.', 400);
    }
    if (expected !== pin) {
      return jsonError('Incorrect PIN', 403);
    }

    await ref.update({
      telecaller_verified: true,
      telecaller_verified_at: FieldValue.serverTimestamp(),
      telecaller_pin: null,
      complianceStatus: 'incomplete_compliance',
      complianceIncompleteSince: data.complianceIncompleteSince || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return withCors(
      NextResponse.json({
        ok: true,
        alreadyVerified: false,
        complianceStatus: 'incomplete_compliance',
      })
    );
  } catch (err: unknown) {
    if (err instanceof StaffAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('verify-compliance-pin:', err);
    return jsonError(err instanceof Error ? err.message : 'Failed to verify PIN', 500);
  }
}
