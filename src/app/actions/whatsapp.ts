'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { verifyCrmUserFromIdToken, CrmAuthHttpError } from '@/server/verifyCrmUserBearer';
import { ensureInvoicePdfUrl } from '@/server/invoices/ensureInvoicePdfUrl';
import {
  loadInvoiceForWhatsApp,
  normalizePhoneForWhatsApp,
  setInvoiceWaStatus,
} from '@/server/invoices/whatsappInvoiceRecord';

export type SendInvoiceWhatsAppResult =
  | { ok: true; waStatus: 'SENT_VIA_WA' }
  | { ok: false; error: string };

function pinnacleConfig() {
  const phoneId = (process.env.PINNACLE_PHONE_ID || '').trim();
  const apiKey = (process.env.PINNACLE_API_KEY || '').trim();
  /** Pinnacle "English" templates use `en`, not `en_US`. */
  const templateName = (
    process.env.PINNACLE_TEMPLATE_NAME || 'invoice_from_crm_testing_template'
  ).trim();
  const templateLanguage = (process.env.PINNACLE_TEMPLATE_LANGUAGE || 'en').trim();
  if (!phoneId || !apiKey) {
    throw new Error('Pinnacle WhatsApp is not configured (PINNACLE_PHONE_ID / PINNACLE_API_KEY).');
  }
  return { phoneId, apiKey, templateName, templateLanguage };
}

function buildPinnaclePayload(params: {
  to: string;
  pdfUrl: string;
  invoiceNumber: string;
  customerName: string;
}) {
  const { templateName, templateLanguage } = pinnacleConfig();
  const filename = `Invoice_${params.invoiceNumber || 'document'}.pdf`.replace(/[^\w.-]+/g, '_');
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: params.to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: {
                link: params.pdfUrl,
                filename,
              },
            },
          ],
        },
        {
          type: 'body',
          parameters: [{ type: 'text', text: params.customerName || 'Customer' }],
        },
      ],
    },
  };
}

async function postToPinnacle(body: Record<string, unknown>) {
  const { phoneId, apiKey } = pinnacleConfig();
  const url = `https://partnersv1.pinbot.ai/v3/${phoneId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify(body),
  });

  let responseJson: unknown = null;
  const text = await res.text();
  try {
    responseJson = text ? JSON.parse(text) : null;
  } catch {
    responseJson = { raw: text };
  }

  if (!res.ok) {
    const root =
      typeof responseJson === 'object' && responseJson ? (responseJson as Record<string, unknown>) : null;
    const errObj =
      root?.error && typeof root.error === 'object'
        ? (root.error as Record<string, unknown>)
        : root;
    const code = errObj?.code;
    const detail = errObj ? JSON.stringify(errObj) : text || res.statusText;
    const detailStr = String(root?.message || detail);

    if (code === 132001 || detailStr.includes('132001') || detailStr.includes('does not exist in the translation')) {
      const { templateName, templateLanguage } = pinnacleConfig();
      throw new Error(
        `WhatsApp template not found: name="${templateName}" language="${templateLanguage}". ` +
          'In Pinnacle / Meta WhatsApp Manager, copy the exact approved template name and language code into ' +
          'PINNACLE_TEMPLATE_NAME and PINNACLE_TEMPLATE_LANGUAGE (e.g. en or en_US), then redeploy.',
      );
    }

    throw new Error(`Pinnacle API error (${res.status}): ${detail}`);
  }

  return responseJson;
}

/**
 * Sends an invoice PDF via Pinnacle WhatsApp template and updates `waStatus` in Firestore.
 * @param invoiceId — `invoices/{id}` or CRM `sales/{id}` (same id).
 * @param idToken — Firebase ID token from the signed-in CRM user.
 */
export async function sendInvoiceWhatsApp(
  invoiceId: string,
  idToken: string,
): Promise<SendInvoiceWhatsAppResult> {
  let statusUpdateRefs: Awaited<ReturnType<typeof loadInvoiceForWhatsApp>>['statusUpdateRefs'] | null =
    null;

  try {
    await verifyCrmUserFromIdToken(idToken);

    const loaded = await loadInvoiceForWhatsApp(invoiceId);
    statusUpdateRefs = loaded.statusUpdateRefs;
    const { record } = loaded;

    if (!record.invoiceNumber) {
      throw new Error('Invoice number is required before sending on WhatsApp.');
    }

    const to = normalizePhoneForWhatsApp(record.customerPhone);
    if (!to || to.length < 10) {
      throw new Error('A valid customer phone number is required (e.g. 919876543210).');
    }

    const pdfUrl = await ensureInvoicePdfUrl(invoiceId, statusUpdateRefs);

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

    return { ok: true, waStatus: 'SENT_VIA_WA' };
  } catch (e) {
    const message =
      e instanceof CrmAuthHttpError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Failed to send invoice on WhatsApp';

    return { ok: false, error: message };
  }
}
