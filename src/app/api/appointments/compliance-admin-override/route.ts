import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { CrmAuthHttpError, verifyCrmUserFromBearer } from '@/server/verifyCrmUserBearer';
import { isHomeVisitAppointment } from '@/lib/visitCompliance/helpers';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Admin-only: bypass end-of-visit compliance so Sale/Booking can proceed.
 */
export async function POST(req: Request) {
  try {
    const { uid, role } = await verifyCrmUserFromBearer(req);
    if (role !== 'admin') return jsonError('Admin only', 403);

    const body = (await req.json().catch(() => null)) as {
      appointmentId?: unknown;
      reason?: unknown;
    } | null;

    const appointmentId = String(body?.appointmentId || '').trim();
    if (!appointmentId) return jsonError('appointmentId is required', 400);
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

    const db = adminDb();
    const userSnap = await db.collection('users').doc(uid).get();
    const byName =
      String((userSnap.data() as { displayName?: string } | undefined)?.displayName || '').trim() ||
      uid;

    const ref = db.collection('appointments').doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) return jsonError('Appointment not found', 404);

    const data = snap.data() || {};
    if (!isHomeVisitAppointment(data)) {
      return jsonError('Override applies only to home visits', 400);
    }

    await ref.update({
      complianceAdminOverride: {
        byUid: uid,
        byName,
        at: new Date().toISOString(),
        reason: reason || 'Admin bypass of incomplete visit compliance',
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, appointmentId });
  } catch (err: unknown) {
    if (err instanceof CrmAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('compliance-admin-override:', err);
    return jsonError(err instanceof Error ? err.message : 'Failed to apply override', 500);
  }
}
