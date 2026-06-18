import type { DocumentReference } from 'firebase-admin/firestore';
import { adminDb, adminStorageBucket } from '@/server/firebaseAdmin';
import { getResolvedHtmlTemplateAdmin } from '@/server/invoiceTemplatesAdmin';
import { renderHtmlToPdfBuffer } from '@/server/htmlToPdfBuffer';
import { extractBillableInvoiceNumber, loadInvoiceForWhatsApp } from '@/server/invoices/whatsappInvoiceRecord';
import {
  INVOICE_WHATSAPP_REQUESTS_COLLECTION,
  type InvoiceWhatsAppRequestDoc,
} from '@/lib/invoices/invoiceWhatsAppRequestTypes';
import {
  buildInvoiceDataForPdf,
  resolveInvoicePaymentMethodLabel,
  saleHasBillableInvoiceNumber,
} from '@/utils/invoiceSaleToData';
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

async function loadEnquiryForSale(sale: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const enquiryId = String(sale.enquiryId || '').trim();
  if (!enquiryId) return null;
  const snap = await adminDb().collection('enquiries').doc(enquiryId).get();
  if (!snap.exists) return null;
  return (snap.data() || {}) as Record<string, unknown>;
}

/** Regenerate when cached PDF used a placeholder sale field but enquiry has real payment modes. */
function shouldRegeneratePdfForPaymentMode(
  sale: Record<string, unknown>,
  resolvedPaymentMethod: string,
): boolean {
  if (!resolvedPaymentMethod) return false;
  const stored = String(sale.paymentMethod ?? sale.paymentMode ?? '').trim();
  return stored !== resolvedPaymentMethod;
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
  const enquiry = await loadEnquiryForSale(sale);
  const paymentMethod = resolveInvoicePaymentMethodLabel(sale, enquiry);
  const saleForInvoice = paymentMethod ? { ...sale, paymentMethod } : sale;

  const existing = String(sale.pdfUrl || sale.pdf_url || '').trim();
  const mustRegenerateForPayment =
    isPublicPdfUrl(existing) && shouldRegeneratePdfForPaymentMode(sale, paymentMethod);
  if (isPublicPdfUrl(existing) && !mustRegenerateForPayment) return existing;

  const invoiceNumber = extractBillableInvoiceNumber(sale);
  if (!saleHasBillableInvoiceNumber(invoiceNumber)) {
    throw new Error('A valid assigned invoice number is required before generating the PDF.');
  }

  const template = await getResolvedHtmlTemplateAdmin('invoice');
  if (!template?.htmlContent) {
    throw new Error('Invoice HTML template is not configured in Invoice Manager.');
  }

  const invoiceData = buildInvoiceDataForPdf(saleForInvoice, enquiry);
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
  if (paymentMethod && shouldRegeneratePdfForPaymentMode(sale, paymentMethod)) {
    await Promise.all(
      statusUpdateRefs.map((ref) => ref.set({ paymentMethod }, { merge: true })),
    );
  }
  return signedUrl;
}

/** Regenerates invoice PDF when payment mode was missing on cached preview; updates pending request doc. */
export async function refreshWhatsAppApprovalRequestPdf(requestId: string): Promise<string> {
  const trimmedId = (requestId || '').trim();
  if (!trimmedId) throw new Error('Request id is required');

  const requestSnap = await adminDb()
    .collection(INVOICE_WHATSAPP_REQUESTS_COLLECTION)
    .doc(trimmedId)
    .get();
  if (!requestSnap.exists) throw new Error('WhatsApp approval request not found');

  const request = requestSnap.data() as InvoiceWhatsAppRequestDoc;
  const saleSnap = await adminDb().collection('sales').doc(request.saleId).get();
  if (!saleSnap.exists) {
    return String(request.pdfUrl || '').trim();
  }

  const sale = (saleSnap.data() || {}) as Record<string, unknown>;
  const enquiry = await loadEnquiryForSale(sale);
  const paymentMethod = resolveInvoicePaymentMethodLabel(sale, enquiry);
  const existingRequestPdf = String(request.pdfUrl || sale.pdfUrl || sale.pdf_url || '').trim();
  const needsRegenerate = shouldRegeneratePdfForPaymentMode(sale, paymentMethod);

  if (!needsRegenerate && isPublicPdfUrl(existingRequestPdf)) {
    return existingRequestPdf;
  }

  const loaded = await loadInvoiceForWhatsApp(request.saleId);
  const pdfUrl = await ensureInvoicePdfUrl(request.saleId, loaded.statusUpdateRefs);

  if (pdfUrl && pdfUrl !== existingRequestPdf && request.status === 'pending') {
    await requestSnap.ref.update({ pdfUrl });
  }

  return pdfUrl;
}
