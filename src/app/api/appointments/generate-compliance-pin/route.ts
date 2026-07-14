import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { CrmAuthHttpError, verifyCrmUserFromBearer } from '@/server/verifyCrmUserBearer';
import {
  canShowTelecallerPinActions,
  generateFourDigitPin,
  hasTelecallerCallLoggedForVisit,
  isAppointmentTodayKolkata,
  isHomeVisitAppointment,
  PIN_REQUIRES_CALL_LOG_MESSAGE,
} from '@/lib/visitCompliance/helpers';

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
 * CRM telecaller generates a 4-digit PIN for a home visit appointment.
 * Only for today's visits after field staff marked awaiting PIN, and after a patient call is logged.
 */
export async function POST(req: Request) {
  try {
    const { uid } = await verifyCrmUserFromBearer(req);
    const body = (await req.json().catch(() => null)) as { appointmentId?: unknown } | null;
    const appointmentId = String(body?.appointmentId || '').trim();
    if (!appointmentId) return jsonError('appointmentId is required', 400);

    const db = adminDb();
    const ref = db.collection('appointments').doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError('Appointment not found', 404);

    const data = snap.data() || {};
    if (!isHomeVisitAppointment(data)) {
      return jsonError('Verification PIN is only for home visits', 400);
    }

    const status = String(data.status || 'scheduled').toLowerCase();
    if (status === 'cancelled') return jsonError('Appointment is cancelled', 400);
    if (status === 'completed' && data.complianceStatus === 'completed') {
      return jsonError('Visit compliance already completed', 400);
    }

    if (!isAppointmentTodayKolkata(data.start)) {
      return jsonError('Verification PIN can only be generated for today’s appointments', 400);
    }

    if (!canShowTelecallerPinActions({ ...data, type: 'home', start: data.start, status })) {
      return jsonError(
        'PIN is only available after the home-visit staff marks the visit complete and waits for a PIN (today’s appointments only).',
        403
      );
    }

    const enquiryId = String(data.enquiryId || '').trim();
    if (!enquiryId) {
      return jsonError(
        'This appointment has no linked enquiry. Link a patient enquiry, log a call, then generate the PIN.',
        400
      );
    }

    const enquirySnap = await db.collection('enquiries').doc(enquiryId).get();
    if (!enquirySnap.exists) {
      return jsonError('Linked enquiry not found. Cannot verify patient call log.', 404);
    }

    const enquiry = enquirySnap.data() || {};
    const followUps = enquiry.followUps;
    if (!hasTelecallerCallLoggedForVisit(followUps, data.start)) {
      return jsonError(PIN_REQUIRES_CALL_LOG_MESSAGE, 403);
    }

    const pin = generateFourDigitPin();
    await ref.update({
      telecaller_pin: pin,
      telecaller_pin_generated_at: FieldValue.serverTimestamp(),
      telecaller_pin_generated_by: uid,
      telecaller_verified: false,
      complianceStatus: 'pending_verification',
      complianceIncompleteSince: data.complianceIncompleteSince || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return withCors(
      NextResponse.json({
        ok: true,
        pin,
        appointmentId,
        complianceStatus: 'pending_verification',
      })
    );
  } catch (err: unknown) {
    if (err instanceof CrmAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('generate-compliance-pin:', err);
    return jsonError(err instanceof Error ? err.message : 'Failed to generate PIN', 500);
  }
}
