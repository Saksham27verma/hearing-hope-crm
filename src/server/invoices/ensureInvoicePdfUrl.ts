import type { DocumentReference } from 'firebase-admin/firestore';
import { adminDb, adminStorageBucket } from '@/server/firebaseAdmin';
import { getResolvedHtmlTemplateAdmin } from '@/server/invoiceTemplatesAdmin';
import { renderHtmlToPdfBuffer } from '@/server/htmlToPdfBuffer';
import { convertSaleToInvoiceData, saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';
import { processInvoiceHtmlTemplate } from '@/utils/invoiceHtmlTemplate';

const PDF_SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isPublicPdfUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function safeStorageSegment(value: string): string {
  return value.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'invoice';
}

async function persistPdfUrl(refs: DocumentReference[], pdfUrl: string) {
  const payload = { pdfUrl, pdfUrlUpdatedAt: new Date().toISOString() };
  await Promise.all(refs.map((ref) => ref.set(payload, { merge: true })));
}

/**
 * Returns a fetchable HTTPS URL for the invoice PDF — reuses `pdfUrl` on the sale/invoice doc
 * or renders via CRM HTML template, uploads to Storage, and saves the signed URL.
 */
export async function ensureInvoicePdfUrl(
  saleId: string,
  statusUpdateRefs: DocumentReference[],
): Promise<string> {
  const trimmedId = (saleId || '').trim();
  if (!trimmedId) throw new Error('Invoice id is required');

  const saleSnap = await adminDb().collection('sales').doc(trimmedId).get();
  if (!saleSnap.exists) {
    throw new Error('Sale not found — cannot generate invoice PDF.');
  }

  const sale = (saleSnap.data() || {}) as Record<string, unknown>;
  const existing = String(sale.pdfUrl || sale.pdf_url || '').trim();
  if (isPublicPdfUrl(existing)) return existing;

  const invoiceNumber = String(sale.invoiceNumber || '').trim();
  if (!saleHasBillableInvoiceNumber(invoiceNumber)) {
    throw new Error('A valid assigned invoice number is required before generating the PDF.');
  }

  const template = await getResolvedHtmlTemplateAdmin('invoice');
  if (!template?.htmlContent) {
    throw new Error('Invoice HTML template is not configured in Invoice Manager.');
  }

  const invoiceData = convertSaleToInvoiceData(sale);
  const html = processInvoiceHtmlTemplate(template.htmlContent, invoiceData, template);
  const buffer = await renderHtmlToPdfBuffer(html);

  const bucket = adminStorageBucket();
  const objectPath = `invoice-whatsapp/${trimmedId}/${safeStorageSegment(invoiceNumber)}.pdf`;
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    contentType: 'application/pdf',
    metadata: { cacheControl: 'public, max-age=3600' },
    resumable: false,
  });

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + PDF_SIGNED_URL_TTL_MS,
  });

  if (!isPublicPdfUrl(signedUrl)) {
    throw new Error('Failed to create a downloadable PDF URL.');
  }

  await persistPdfUrl(statusUpdateRefs, signedUrl);
  return signedUrl;
}
