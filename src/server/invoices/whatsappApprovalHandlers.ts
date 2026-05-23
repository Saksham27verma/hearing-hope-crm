import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { CrmAuthHttpError } from '@/server/verifyCrmUserBearer';
import { ensureInvoicePdfUrl } from '@/server/invoices/ensureInvoicePdfUrl';
import { executeInvoiceWhatsAppSend } from '@/server/invoices/executeInvoiceWhatsAppSend';
import {
  INVOICE_WHATSAPP_REQUESTS_COLLECTION,
  type InvoiceWhatsAppRequestDoc,
  type InvoiceWhatsAppRequestStatus,
} from '@/lib/invoices/invoiceWhatsAppRequestTypes';
import { notifyAdminsWhatsAppInvoiceRequest } from '@/server/notifications/notifyAdminsWhatsAppRequest';
import {
  extractBillableInvoiceNumber,
  loadInvoiceForWhatsApp,
  setInvoiceWaStatus,
} from '@/server/invoices/whatsappInvoiceRecord';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';

export type WhatsAppActionResult =
  | { ok: true; requestId?: string; waStatus?: string }
  | { ok: false; error: string };

async function getCallerProfile(uid: string) {
  const snap = await adminDb().collection('users').doc(uid).get();
  if (!snap.exists) throw new CrmAuthHttpError('Forbidden', 403);
  return (snap.data() || {}) as Record<string, unknown>;
}

function callerDisplayName(data: Record<string, unknown>, uid: string): string {
  return (
    String(data.displayName || data.nickname || data.email || '').trim() || uid
  );
}

async function findPendingRequestForSale(saleId: string) {
  const snap = await adminDb()
    .collection(INVOICE_WHATSAPP_REQUESTS_COLLECTION)
    .where('saleId', '==', saleId)
    .where('status', '==', 'pending')
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

export async function handleRequestInvoiceWhatsAppApproval(params: {
  saleId: string;
  callerUid: string;
  callerRole: string;
  invoiceNumberHint?: string;
}): Promise<WhatsAppActionResult> {
  const saleId = (params.saleId || '').trim();
  if (!saleId) return { ok: false, error: 'Sale id is required' };

  const existing = await findPendingRequestForSale(saleId);
  if (existing) {
    return {
      ok: false,
      error: 'A WhatsApp approval request is already pending for this invoice.',
    };
  }

  const callerData = await getCallerProfile(params.callerUid);
  const loaded = await loadInvoiceForWhatsApp(saleId);
  let { record } = loaded;

  const hintNumber = extractBillableInvoiceNumber({
    invoiceNumber: (params.invoiceNumberHint || '').trim(),
  });
  if (!saleHasBillableInvoiceNumber(record.invoiceNumber) && hintNumber) {
    record = { ...record, invoiceNumber: hintNumber };
  }

  if (!saleHasBillableInvoiceNumber(record.invoiceNumber)) {
    return {
      ok: false,
      error: 'Invoice number is required. Save the sale with an assigned invoice number first.',
    };
  }

  let pdfUrl: string;
  try {
    pdfUrl = await ensureInvoicePdfUrl(saleId, loaded.statusUpdateRefs);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Failed to generate invoice PDF',
    };
  }

  const saleSnap = await adminDb().collection('sales').doc(saleId).get();
  const saleData = (saleSnap.data() || {}) as Record<string, unknown>;
  const centerIdRaw = saleData.centerId ?? saleData.branch ?? null;
  const centerId = centerIdRaw ? String(centerIdRaw).trim() : null;

  const requestRef = adminDb().collection(INVOICE_WHATSAPP_REQUESTS_COLLECTION).doc();
  const requestId = requestRef.id;
  const dedupeKey = `waReq|${saleId}`;

  const doc: InvoiceWhatsAppRequestDoc = {
    saleId,
    invoiceNumber: record.invoiceNumber,
    customerName: record.customerName,
    customerPhone: record.customerPhone,
    pdfUrl,
    centerId,
    status: 'pending',
    requestedBy: {
      uid: params.callerUid,
      name: callerDisplayName(callerData, params.callerUid),
      email: String(callerData.email || '').trim() || undefined,
      role: params.callerRole,
    },
    requestedAt: FieldValue.serverTimestamp(),
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    sendError: null,
    dedupeKey,
  };

  await requestRef.set(doc);

  await Promise.all(
    loaded.statusUpdateRefs.map((ref) =>
      ref.set(
        {
          waStatus: 'PENDING_APPROVAL',
          waRequestId: requestId,
          waStatusUpdatedAt: new Date().toISOString(),
          pdfUrl,
        },
        { merge: true },
      ),
    ),
  );

  await notifyAdminsWhatsAppInvoiceRequest({
    requestId,
    saleId,
    centerId,
    invoiceNumber: record.invoiceNumber,
    customerName: record.customerName,
    requestedByName: doc.requestedBy.name,
  });

  return { ok: true, requestId, waStatus: 'PENDING_APPROVAL' };
}

async function loadRequestOrError(requestId: string) {
  const id = (requestId || '').trim();
  if (!id) return { ok: false as const, error: 'Request id is required' };

  const snap = await adminDb().collection(INVOICE_WHATSAPP_REQUESTS_COLLECTION).doc(id).get();
  if (!snap.exists) return { ok: false as const, error: 'Approval request not found' };

  const data = snap.data() as InvoiceWhatsAppRequestDoc;
  return { ok: true as const, ref: snap.ref, data };
}

export async function handleApproveInvoiceWhatsAppRequest(params: {
  requestId: string;
  reviewerUid: string;
}): Promise<WhatsAppActionResult> {
  const loaded = await loadRequestOrError(params.requestId);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const { ref, data } = loaded;
  if (data.status !== 'pending') {
    return { ok: false, error: `This request is already ${data.status}.` };
  }

  const reviewerData = await getCallerProfile(params.reviewerUid);
  const reviewedBy = {
    uid: params.reviewerUid,
    name: callerDisplayName(reviewerData, params.reviewerUid),
  };

  await ref.update({
    status: 'approved' satisfies InvoiceWhatsAppRequestStatus,
    reviewedBy,
    reviewedAt: FieldValue.serverTimestamp(),
  });

  const sendResult = await executeInvoiceWhatsAppSend(
    data.saleId,
    data.invoiceNumber,
  );

  if (!sendResult.ok) {
    await ref.update({
      status: 'failed',
      sendError: sendResult.error,
      reviewedAt: FieldValue.serverTimestamp(),
    });
    return { ok: false, error: sendResult.error };
  }

  await ref.update({
    status: 'sent',
    sendError: null,
  });

  return { ok: true, waStatus: 'SENT_VIA_WA' };
}

export async function handleRejectInvoiceWhatsAppRequest(params: {
  requestId: string;
  reviewerUid: string;
  reason?: string;
}): Promise<WhatsAppActionResult> {
  const loaded = await loadRequestOrError(params.requestId);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  const { ref, data } = loaded;
  if (data.status !== 'pending') {
    return { ok: false, error: `This request is already ${data.status}.` };
  }

  const reviewerData = await getCallerProfile(params.reviewerUid);
  const reason = (params.reason || '').trim() || null;

  await ref.update({
    status: 'rejected',
    reviewedBy: {
      uid: params.reviewerUid,
      name: callerDisplayName(reviewerData, params.reviewerUid),
    },
    reviewedAt: FieldValue.serverTimestamp(),
    rejectionReason: reason,
  });

  const { statusUpdateRefs } = await loadInvoiceForWhatsApp(data.saleId);
  await setInvoiceWaStatus(statusUpdateRefs, 'REJECTED', {
    waRequestId: ref.id,
  });

  return { ok: true, waStatus: 'REJECTED' };
}

export function assertAdminRole(role: string) {
  if (role.trim().toLowerCase() !== 'admin') {
    throw new CrmAuthHttpError('Only admins can approve or reject WhatsApp invoice requests', 403);
  }
}
