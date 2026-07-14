import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import {
  isAppointmentTodayKolkata,
  isHomeVisitAppointment,
} from '@/lib/visitCompliance/helpers';
import { notifyAwaitingCompliancePin } from '@/server/notifications/notifyAwaitingCompliancePin';

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
 * Field staff marks home visit checkout started — waiting for telecaller to log a call and generate PIN.
 * Notifies CRM telecaller/admins and turns the calendar event red.
 */
export async function POST(req: Request) {
  try {
    const { uid, staff } = await verifyStaffFromBearer(req);
    const body = (await req.json().catch(() => null)) as { appointmentId?: unknown } | null;
    const appointmentId = String(body?.appointmentId || '').trim();
    if (!appointmentId) return jsonError('appointmentId is required', 400);

    const db = adminDb();
    const ref = db.collection('appointments').doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError('Appointment not found', 404);

    const data = snap.data() || {};
    if (!isHomeVisitAppointment(data)) {
      return jsonError('End-of-visit PIN flow is only for home visits', 400);
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

    if (!isAppointmentTodayKolkata(data.start)) {
      return jsonError('End-of-visit checkout is only available for today’s appointments', 400);
    }

    const cs = String(data.complianceStatus || '').toLowerCase();
    if (cs === 'pending_verification' || cs === 'incomplete_compliance' || cs === 'completed') {
      return withCors(
        NextResponse.json({
          ok: true,
          alreadyRequested: true,
          complianceStatus: data.complianceStatus,
        })
      );
    }

    const alreadyAwaiting = cs === 'awaiting_telecaller_pin';
    if (!alreadyAwaiting) {
      await ref.update({
        complianceStatus: 'awaiting_telecaller_pin',
        complianceIncompleteSince: data.complianceIncompleteSince || FieldValue.serverTimestamp(),
        staffAwaitingPinAt: FieldValue.serverTimestamp(),
        staffAwaitingPinBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    let telecallerName = String(data.telecaller || '').trim() || null;
    const enquiryId = String(data.enquiryId || '').trim();
    if (!telecallerName && enquiryId) {
      try {
        const enq = await db.collection('enquiries').doc(enquiryId).get();
        telecallerName = String((enq.data() as { telecaller?: string } | undefined)?.telecaller || '').trim() || null;
      } catch {
        /* ignore */
      }
    }

    const staffName =
      String(data.homeVisitorName || staff?.name || '').trim() || 'Field staff';
    const patientName = String(data.patientName || data.title || 'Patient').trim() || 'Patient';
    const centerId = data.centerId ? String(data.centerId).trim() : null;

    let notified = 0;
    try {
      notified = await notifyAwaitingCompliancePin({
        appointmentId,
        patientName,
        staffName,
        telecallerName,
        centerId,
      });
    } catch (notifyErr) {
      console.error('notifyAwaitingCompliancePin failed:', notifyErr);
    }

    return withCors(
      NextResponse.json({
        ok: true,
        alreadyRequested: alreadyAwaiting,
        complianceStatus: 'awaiting_telecaller_pin',
        notified,
      })
    );
  } catch (err: unknown) {
    if (err instanceof StaffAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('request-compliance-pin:', err);
    return jsonError(err instanceof Error ? err.message : 'Failed to request PIN', 500);
  }
}
