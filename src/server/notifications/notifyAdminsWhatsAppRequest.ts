import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { isSuperAdminViewer, normalizeCenterIdsFromProfile } from '@/lib/tenant/centerScope';
export async function notifyAdminsWhatsAppInvoiceRequest(params: {
  requestId: string;
  saleId: string;
  centerId: string | null;
  invoiceNumber: string;
  customerName: string;
  requestedByName: string;
}): Promise<number> {
  const db = adminDb();
  const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
  if (adminsSnap.empty) return 0;

  const { requestId, saleId, centerId, invoiceNumber, customerName, requestedByName } = params;
  const href = `/whatsapp-invoice-approvals?request=${encodeURIComponent(requestId)}`;
  const message = `${requestedByName} requested WhatsApp for ${customerName}${invoiceNumber ? ` · ${invoiceNumber}` : ''}`;

  const writes: Array<{ uid: string; notifId: string; centerId: string | null }> = [];

  adminsSnap.docs.forEach((d) => {
    const data = (d.data() || {}) as Record<string, unknown>;
    const profile = {
      uid: d.id,
      email: String(data.email || ''),
      displayName: String(data.displayName || ''),
      nickname: typeof data.nickname === 'string' ? data.nickname : undefined,
      role: 'admin' as const,
      branchId: typeof data.branchId === 'string' ? data.branchId : undefined,
      centerId: (data.centerId as string | null | undefined) ?? null,
      centerIds: (Array.isArray(data.centerIds) ? (data.centerIds as string[]) : null) as string[] | null,
      isSuperAdmin: data.isSuperAdmin === true ? true : data.isSuperAdmin === false ? false : undefined,
    };

    const superAdmin = isSuperAdminViewer(profile as Parameters<typeof isSuperAdminViewer>[0]);
    if (!superAdmin && centerId) {
      const centers = normalizeCenterIdsFromProfile(profile as Parameters<typeof normalizeCenterIdsFromProfile>[0]);
      if (centers.length > 0 && !centers.includes(centerId)) return;
    }

    const notifId = `waInvoiceReq|${requestId}|${d.id}`;
    writes.push({ uid: d.id, notifId, centerId });
  });

  if (writes.length === 0) return 0;

  const batch = db.batch();
  writes.forEach((w) => {
    batch.set(db.collection('notifications').doc(w.notifId), {
      userId: w.uid,
      centerId: w.centerId,
      type: 'whatsapp_invoice_request',
      title: 'WhatsApp invoice approval',
      message,
      href,
      entity: { kind: 'whatsapp_invoice_request', id: requestId },
      is_read: false,
      readAt: null,
      createdAt: FieldValue.serverTimestamp(),
      dedupeKey: `waInvoiceReq|${requestId}`,
    });
  });
  await batch.commit();

  return writes.length;
}
