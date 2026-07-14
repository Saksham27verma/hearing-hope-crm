import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import {
  isHomeVisitAppointment,
  parseComplianceForm,
  parseGpsLocation,
} from '@/lib/visitCompliance/helpers';
import { mergeStaffComplianceIntoEnquiry } from '@/server/staffEnquiryVisitMerge';

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

function deepStripUndefined(x: unknown): unknown {
  if (x === undefined) return undefined;
  if (x === null || typeof x !== 'object') return x;
  if (Array.isArray(x)) {
    return x.map((i) => deepStripUndefined(i)).filter((i) => i !== undefined);
  }
  const o = x as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) {
    const v = deepStripUndefined(o[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function staffDisplayName(staff: Record<string, unknown> | undefined, uid: string): string {
  if (!staff) return uid;
  const name = String(staff.name || staff.fullName || staff.displayName || '').trim();
  return name || uid;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/**
 * Staff PWA final step: GPS + compliance questionnaire → mark appointment completed
 * and mirror checkout details onto the linked patient (enquiry) visit.
 */
export async function POST(req: Request) {
  try {
    const { uid, staff } = await verifyStaffFromBearer(req);
    const body = (await req.json().catch(() => null)) as {
      appointmentId?: unknown;
      feedback?: unknown;
      gps_location?: unknown;
      compliance_form_data?: unknown;
    } | null;

    const appointmentId = String(body?.appointmentId || '').trim();
    if (!appointmentId) return jsonError('appointmentId is required', 400);

    const gpsParsed = parseGpsLocation(body?.gps_location);
    if (!gpsParsed.ok) return jsonError(gpsParsed.error, 400);

    const formParsed = parseComplianceForm(body?.compliance_form_data);
    if (!formParsed.ok) return jsonError(formParsed.error, 400);

    const feedback = typeof body?.feedback === 'string' ? body.feedback.trim() : '';

    const db = adminDb();
    const ref = db.collection('appointments').doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError('Appointment not found', 404);

    const data = snap.data() || {};
    if (!isHomeVisitAppointment(data)) {
      return jsonError('Compliance completion is only for home visits', 400);
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

    if (data.telecaller_verified !== true) {
      return jsonError('Telecaller PIN must be verified before completing the visit', 403);
    }

    await ref.update({
      status: 'completed',
      feedback: feedback || FieldValue.delete(),
      gps_location: gpsParsed.gps,
      compliance_form_data: formParsed.form,
      complianceStatus: 'completed',
      telecaller_verified: true,
      telecaller_pin: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const enquiryId = String(data.enquiryId || '').trim();
    if (enquiryId) {
      try {
        const enquiryRef = db.collection('enquiries').doc(enquiryId);
        const enquirySnap = await enquiryRef.get();
        if (enquirySnap.exists) {
          const enquiryData = {
            id: enquirySnap.id,
            ...(enquirySnap.data() as Record<string, unknown>),
          };
          const merged = mergeStaffComplianceIntoEnquiry({
            enquiry: enquiryData,
            appointment: data as Record<string, unknown>,
            appointmentId,
            compliance: {
              gpsLocation: gpsParsed.gps,
              complianceFormData: formParsed.form,
              feedback,
            },
            staffUid: uid,
            staffName: staffDisplayName(staff as Record<string, unknown>, uid),
          });
          await enquiryRef.update({
            visits: deepStripUndefined(merged.visits) as unknown[],
            visitSchedules: deepStripUndefined(merged.visitSchedules) as unknown[],
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      } catch (enquiryErr) {
        console.error('complete-visit-compliance enquiry merge:', enquiryErr);
        // Appointment is already completed; do not fail the staff checkout.
      }
    }

    return withCors(
      NextResponse.json({
        ok: true,
        appointmentId,
        status: 'completed',
        complianceStatus: 'completed',
        enquiryId: enquiryId || undefined,
      })
    );
  } catch (err: unknown) {
    if (err instanceof StaffAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('complete-visit-compliance:', err);
    return jsonError(err instanceof Error ? err.message : 'Failed to complete visit', 500);
  }
}
