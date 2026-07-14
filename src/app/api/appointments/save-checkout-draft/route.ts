import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import {
  isHomeVisitAppointment,
  parseComplianceForm,
  parseGpsLocation,
} from '@/lib/visitCompliance/helpers';
import type { AppointmentCheckoutDraft } from '@/lib/visitCompliance/types';

export const maxDuration = 30;

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

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/**
 * Staff stages checkout details (services / commerce / GPS+checklist) on the appointment
 * so telecallers can review them before generating a PIN.
 *
 * Important: do NOT await telecaller notifications before responding — Hobby functions
 * time out at ~10s and a full users scan can hang the staff PWA on "Notifying…".
 */
export async function POST(req: Request) {
  try {
    const { uid } = await verifyStaffFromBearer(req);
    const body = (await req.json().catch(() => null)) as {
      appointmentId?: unknown;
      patch?: unknown;
      readyForPin?: unknown;
    } | null;

    const appointmentId = String(body?.appointmentId || '').trim();
    if (!appointmentId) return jsonError('appointmentId is required', 400);

    const patchRaw = body?.patch;
    if (!patchRaw || typeof patchRaw !== 'object') {
      return jsonError('patch object is required', 400);
    }
    const patch = patchRaw as Record<string, unknown>;

    const db = adminDb();
    const ref = db.collection('appointments').doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError('Appointment not found', 404);

    const data = snap.data() || {};
    if (!isHomeVisitAppointment(data)) {
      return jsonError('Checkout draft is only for home visits', 400);
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

    const prev = (data.checkoutDraft && typeof data.checkoutDraft === 'object'
      ? data.checkoutDraft
      : {}) as AppointmentCheckoutDraft;

    const next: AppointmentCheckoutDraft = { ...prev };

    if ('services' in patch) {
      next.services = (patch.services as AppointmentCheckoutDraft['services']) || null;
    }
    if ('servicesSkipped' in patch) {
      next.servicesSkipped = Boolean(patch.servicesSkipped);
    }
    if ('commerce' in patch) {
      next.commerce = (patch.commerce as AppointmentCheckoutDraft['commerce']) || null;
    }
    if ('commerceSkipped' in patch) {
      next.commerceSkipped = Boolean(patch.commerceSkipped);
    }
    if ('feedback' in patch) {
      next.feedback = typeof patch.feedback === 'string' ? patch.feedback.trim() : '';
    }

    if ('gps_location' in patch) {
      if (patch.gps_location == null) {
        next.gps_location = null;
      } else {
        const gpsParsed = parseGpsLocation(patch.gps_location);
        if (!gpsParsed.ok) return jsonError(gpsParsed.error, 400);
        next.gps_location = gpsParsed.gps;
      }
    }

    if ('compliance_form_data' in patch) {
      if (patch.compliance_form_data == null) {
        next.compliance_form_data = null;
      } else {
        const formParsed = parseComplianceForm(patch.compliance_form_data);
        if (!formParsed.ok) return jsonError(formParsed.error, 400);
        next.compliance_form_data = formParsed.form;
      }
    }

    const readyForPin = body?.readyForPin === true;
    if (readyForPin) {
      if (!next.gps_location) {
        return jsonError('Capture GPS before requesting telecaller PIN', 400);
      }
      if (!next.compliance_form_data) {
        return jsonError('Complete the checklist before requesting telecaller PIN', 400);
      }
      if (!next.services && !next.servicesSkipped) {
        return jsonError('Mark visit services as done (or skipped) before PIN', 400);
      }
      if (!next.commerce && !next.commerceSkipped) {
        return jsonError('Add booking/trial/sale or mark as not needed before PIN', 400);
      }
    }

    const update: Record<string, unknown> = {
      checkoutDraft: deepStripUndefined(next),
      checkoutDraftSavedAt: FieldValue.serverTimestamp(),
      checkoutDraftSavedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (readyForPin) {
      update.checkoutReadyForPin = true;
      update.complianceStatus = 'awaiting_telecaller_pin';
      update.staffAwaitingPinAt = FieldValue.serverTimestamp();
      update.staffAwaitingPinBy = uid;
      update.complianceIncompleteSince = FieldValue.serverTimestamp();
    }

    await ref.update(update);

    // Respond first — notifications must not block staff checkout on Vercel Hobby timeouts.
    const response = withCors(
      NextResponse.json({
        ok: true,
        appointmentId,
        checkoutReadyForPin: readyForPin || Boolean(data.checkoutReadyForPin),
        complianceStatus: readyForPin
          ? 'awaiting_telecaller_pin'
          : data.complianceStatus || null,
      })
    );

    if (readyForPin) {
      const patientName = String(data.patientName || data.title || 'Patient').trim();
      const staffName = String(data.homeVisitorName || data.assignedStaffName || 'Staff').trim();
      const telecallerName = data.telecaller ? String(data.telecaller) : null;
      const centerId = data.centerId ? String(data.centerId) : null;
      void import('@/server/notifications/notifyAwaitingCompliancePin')
        .then(({ notifyAwaitingCompliancePin }) =>
          notifyAwaitingCompliancePin({
            appointmentId,
            patientName,
            staffName,
            telecallerName,
            centerId,
          })
        )
        .catch((e) => console.warn('save-checkout-draft notify:', e));
    }

    return response;
  } catch (err: unknown) {
    if (err instanceof StaffAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('save-checkout-draft:', err);
    return jsonError(err instanceof Error ? err.message : 'Failed to save checkout draft', 500);
  }
}
