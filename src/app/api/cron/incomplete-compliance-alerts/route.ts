import { NextResponse } from 'next/server';
import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { isSuperAdminViewer, normalizeCenterIdsFromProfile } from '@/lib/tenant/centerScope';
import {
  appointmentBlocksPipeline,
  toMillis,
} from '@/lib/visitCompliance/helpers';
import { COMPLIANCE_INCOMPLETE_ALERT_HOURS } from '@/lib/visitCompliance/types';

/**
 * Alert admins when a home visit stays in pending_verification / incomplete_compliance
 * for more than COMPLIANCE_INCOMPLETE_ALERT_HOURS (default 2).
 *
 * Secured with CRON_SECRET (same pattern as appointment-pwa-reminders).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (process.env.VERCEL && !secret) {
    return NextResponse.json(
      { ok: false, error: 'Set CRON_SECRET in Vercel for compliance alerts' },
      { status: 503 }
    );
  }
  if (secret) {
    const auth = request.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = adminDb();
  const thresholdMs = COMPLIANCE_INCOMPLETE_ALERT_HOURS * 60 * 60 * 1000;
  const now = Date.now();

  const statuses = ['awaiting_telecaller_pin', 'pending_verification', 'incomplete_compliance'] as const;
  const candidates: QueryDocumentSnapshot[] = [];

  for (const cs of statuses) {
    const snap = await db.collection('appointments').where('complianceStatus', '==', cs).limit(200).get();
    snap.docs.forEach((d) => {
      if (String(d.data()?.type || '').toLowerCase() === 'home') candidates.push(d);
    });
  }

  const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
  if (adminsSnap.empty) {
    return NextResponse.json({ ok: true, checked: candidates.length, notified: 0 });
  }

  let checked = 0;
  let notified = 0;
  const errors: string[] = [];

  for (const docSnap of candidates) {
    checked += 1;
    const data = docSnap.data() || {};
    if (!appointmentBlocksPipeline({ ...data, type: 'home' })) continue;
    if (data.complianceAlertSentAt) continue;

    const sinceMs =
      toMillis(data.complianceIncompleteSince) ||
      toMillis(data.telecaller_pin_generated_at) ||
      toMillis(data.updatedAt);
    if (sinceMs == null) continue;
    if (now - sinceMs < thresholdMs) continue;

    const appointmentId = docSnap.id;
    const patient = String(data.patientName || data.title || 'Patient').trim() || 'Patient';
    const centerId = data.centerId ? String(data.centerId).trim() : null;
    const staffName = String(data.homeVisitorName || '').trim() || 'Field staff';
    const cs = String(data.complianceStatus || 'pending_verification');

    try {
      const batch = db.batch();
      let wrote = 0;

      adminsSnap.docs.forEach((d) => {
        const profileData = (d.data() || {}) as Record<string, unknown>;
        const profile = {
          uid: d.id,
          email: String(profileData.email || ''),
          displayName: String(profileData.displayName || ''),
          nickname: typeof profileData.nickname === 'string' ? profileData.nickname : undefined,
          role: 'admin' as const,
          branchId: typeof profileData.branchId === 'string' ? profileData.branchId : undefined,
          centerId: (profileData.centerId as string | null | undefined) ?? null,
          centerIds: (Array.isArray(profileData.centerIds)
            ? (profileData.centerIds as string[])
            : null) as string[] | null,
          isSuperAdmin:
            profileData.isSuperAdmin === true
              ? true
              : profileData.isSuperAdmin === false
                ? false
                : undefined,
        };

        const superAdmin = isSuperAdminViewer(profile as any);
        if (!superAdmin && centerId) {
          const centers = normalizeCenterIdsFromProfile(profile as any);
          if (centers.length > 0 && !centers.includes(centerId)) return;
        }

        const notifId = `incompleteCompliance|${appointmentId}|${d.id}`;
        batch.set(
          db.collection('notifications').doc(notifId),
          {
            userId: d.id,
            centerId,
            type: 'incomplete_compliance',
            title: 'Incomplete visit checkout',
            message: `${staffName} did not finish end-of-visit compliance for ${patient} (${cs.replace(/_/g, ' ')}) after ${COMPLIANCE_INCOMPLETE_ALERT_HOURS}h`,
            href: '/appointments',
            entity: { kind: 'appointment', id: appointmentId },
            is_read: false,
            readAt: null,
            createdAt: FieldValue.serverTimestamp(),
            dedupeKey: `incompleteCompliance|${appointmentId}`,
          },
          { merge: false }
        );
        wrote += 1;
      });

      if (wrote > 0) {
        batch.update(docSnap.ref, {
          complianceAlertSentAt: FieldValue.serverTimestamp(),
        });
        await batch.commit();
        notified += wrote;
      }
    } catch (e) {
      errors.push(`${appointmentId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    checked,
    notified,
    errors: errors.length ? errors : undefined,
  });
}
