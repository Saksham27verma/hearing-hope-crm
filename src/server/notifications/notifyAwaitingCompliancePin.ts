import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { isSuperAdminViewer, normalizeCenterIdsFromProfile } from '@/lib/tenant/centerScope';

function normalizeNameKey(raw: unknown): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Notify CRM users when field staff requests an end-of-visit PIN.
 * Recipients: center-scoped admins + users whose displayName/nickname matches appointment telecaller.
 */
export async function notifyAwaitingCompliancePin(params: {
  appointmentId: string;
  patientName: string;
  staffName: string;
  telecallerName: string | null;
  centerId: string | null;
}): Promise<number> {
  const db = adminDb();
  const { appointmentId, patientName, staffName, telecallerName, centerId } = params;
  const href = `/appointments?awaitingPin=${encodeURIComponent(appointmentId)}`;
  const message = `${staffName} is waiting for a verification PIN for ${patientName}. Log the patient call and generate the PIN.`;
  const telecallerKey = normalizeNameKey(telecallerName);

  const usersSnap = await db.collection('users').get();
  const writes: Array<{ uid: string; notifId: string; centerId: string | null }> = [];

  usersSnap.docs.forEach((d) => {
    const data = (d.data() || {}) as Record<string, unknown>;
    const role = String(data.role || '')
      .trim()
      .toLowerCase();
    if (!role || !['admin', 'staff', 'audiologist'].includes(role)) return;

    const displayName = String(data.displayName || '').trim();
    const nickname = typeof data.nickname === 'string' ? data.nickname.trim() : '';
    const emailLocal =
      typeof data.email === 'string' && data.email.includes('@')
        ? data.email.split('@')[0]
        : '';

    const nameMatch =
      !!telecallerKey &&
      [displayName, nickname, emailLocal].some((n) => normalizeNameKey(n) === telecallerKey);

    const isAdmin = role === 'admin';
    if (!isAdmin && !nameMatch) return;

    const profile = {
      uid: d.id,
      email: String(data.email || ''),
      displayName,
      nickname: nickname || undefined,
      role: role as 'admin' | 'staff' | 'audiologist',
      branchId: typeof data.branchId === 'string' ? data.branchId : undefined,
      centerId: (data.centerId as string | null | undefined) ?? null,
      centerIds: (Array.isArray(data.centerIds) ? (data.centerIds as string[]) : null) as
        | string[]
        | null,
      isSuperAdmin:
        data.isSuperAdmin === true ? true : data.isSuperAdmin === false ? false : undefined,
    };

    if (isAdmin && !nameMatch) {
      const superAdmin = isSuperAdminViewer(profile as Parameters<typeof isSuperAdminViewer>[0]);
      if (!superAdmin && centerId) {
        const centers = normalizeCenterIdsFromProfile(
          profile as Parameters<typeof normalizeCenterIdsFromProfile>[0]
        );
        if (centers.length > 0 && !centers.includes(centerId)) return;
      }
    }

    const notifId = `awaitingPin|${appointmentId}|${d.id}`;
    writes.push({ uid: d.id, notifId, centerId });
  });

  if (writes.length === 0) return 0;

  const batch = db.batch();
  writes.forEach((w) => {
    batch.set(
      db.collection('notifications').doc(w.notifId),
      {
        userId: w.uid,
        centerId: w.centerId,
        type: 'awaiting_compliance_pin',
        title: 'PIN requested — home visit checkout',
        message,
        href,
        entity: { kind: 'appointment', id: appointmentId },
        is_read: false,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
        dedupeKey: `awaitingPin|${appointmentId}`,
      },
      { merge: false }
    );
  });
  await batch.commit();
  return writes.length;
}
