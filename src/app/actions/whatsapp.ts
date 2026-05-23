'use server';

import { verifyCrmUserFromIdToken, CrmAuthHttpError } from '@/server/verifyCrmUserBearer';
import {
  assertAdminRole,
  handleApproveInvoiceWhatsAppRequest,
  handleRejectInvoiceWhatsAppRequest,
  handleRequestInvoiceWhatsAppApproval,
  type WhatsAppActionResult,
} from '@/server/invoices/whatsappApprovalHandlers';

export type SendInvoiceWhatsAppResult = WhatsAppActionResult;

function toResult(e: unknown): WhatsAppActionResult {
  const message =
    e instanceof CrmAuthHttpError
      ? e.message
      : e instanceof Error
        ? e.message
        : 'Request failed';
  return { ok: false, error: message };
}

/** Staff: submit invoice for admin WhatsApp approval (does not send yet). */
export async function requestInvoiceWhatsAppApproval(
  saleId: string,
  idToken: string,
  invoiceNumberHint?: string,
): Promise<SendInvoiceWhatsAppResult> {
  try {
    const { uid, role } = await verifyCrmUserFromIdToken(idToken);
    return await handleRequestInvoiceWhatsAppApproval({
      saleId,
      callerUid: uid,
      callerRole: role,
      invoiceNumberHint,
    });
  } catch (e) {
    return toResult(e);
  }
}

/** Admin: approve and send via Pinnacle. */
export async function approveInvoiceWhatsAppRequest(
  requestId: string,
  idToken: string,
): Promise<SendInvoiceWhatsAppResult> {
  try {
    const { uid, role } = await verifyCrmUserFromIdToken(idToken);
    assertAdminRole(role);
    return await handleApproveInvoiceWhatsAppRequest({ requestId, reviewerUid: uid });
  } catch (e) {
    return toResult(e);
  }
}

/** Admin: reject approval request. */
export async function rejectInvoiceWhatsAppRequest(
  requestId: string,
  idToken: string,
  reason?: string,
): Promise<SendInvoiceWhatsAppResult> {
  try {
    const { uid, role } = await verifyCrmUserFromIdToken(idToken);
    assertAdminRole(role);
    return await handleRejectInvoiceWhatsAppRequest({ requestId, reviewerUid: uid, reason });
  } catch (e) {
    return toResult(e);
  }
}
