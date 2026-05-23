import { FieldValue } from 'firebase-admin/firestore';
import { ensureInvoicePdfUrl } from '@/server/invoices/ensureInvoicePdfUrl';
import { buildPinnaclePayload, postToPinnacle } from '@/server/invoices/pinnacleSend';
import {
  extractBillableInvoiceNumber,
  loadInvoiceForWhatsApp,
  normalizePhoneForWhatsApp,
  setInvoiceWaStatus,
} from '@/server/invoices/whatsappInvoiceRecord';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';

export type ExecuteWhatsAppSendResult = { ok: true } | { ok: false; error: string };

/**
 * Sends invoice via Pinnacle using sale/invoice data. Used after admin approval.
 */
export async function executeInvoiceWhatsAppSend(
  saleId: string,
  invoiceNumberHint?: string,
): Promise<ExecuteWhatsAppSendResult> {
  let statusUpdateRefs: Awaited<ReturnType<typeof loadInvoiceForWhatsApp>>['statusUpdateRefs'] | null =
    null;

  try {
    const loaded = await loadInvoiceForWhatsApp(saleId);
    statusUpdateRefs = loaded.statusUpdateRefs;
    let { record } = loaded;

    const hintNumber = extractBillableInvoiceNumber({
      invoiceNumber: (invoiceNumberHint || '').trim(),
    });
    if (!saleHasBillableInvoiceNumber(record.invoiceNumber) && hintNumber) {
      record = { ...record, invoiceNumber: hintNumber };
    }

    if (!saleHasBillableInvoiceNumber(record.invoiceNumber)) {
      throw new Error('Invoice number is required before sending on WhatsApp.');
    }

    const to = normalizePhoneForWhatsApp(record.customerPhone);
    if (!to || to.length < 10) {
      throw new Error('A valid customer phone number is required (e.g. 919876543210).');
    }

    const pdfUrl = await ensureInvoicePdfUrl(saleId, statusUpdateRefs);

    const payload = buildPinnaclePayload({
      to,
      pdfUrl,
      invoiceNumber: record.invoiceNumber,
      customerName: record.customerName,
    });

    try {
      await postToPinnacle(payload);
    } catch (pinnacleErr) {
      if (statusUpdateRefs) {
        await setInvoiceWaStatus(statusUpdateRefs, 'FAILED');
      }
      throw pinnacleErr;
    }

    await setInvoiceWaStatus(statusUpdateRefs, 'SENT_VIA_WA', {
      waSentAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to send invoice on WhatsApp';
    return { ok: false, error: message };
  }
}
