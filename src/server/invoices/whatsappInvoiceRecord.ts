import type { DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import type { WaStatus } from '@/lib/invoices/whatsappTypes';
import { isProvisionalInvoiceNumber, normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';

export type { WaStatus };

export interface InvoiceWhatsAppRecord {
  id: string;
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  pdfUrl: string;
  waStatus: WaStatus;
}

function normalizeWaStatus(raw: unknown): WaStatus {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'SENT_VIA_WA' || s === 'FAILED') return s;
  return 'PENDING_APPROVAL';
}

const INVOICE_NUMBER_KEYS = ['invoiceNumber', 'invoice_number', 'salesInvoiceNumber'] as const;

/** Billable invoice # from one or more Firestore payloads (sales doc wins over sparse `invoices` stub). */
export function extractBillableInvoiceNumber(
  ...sources: Array<Record<string, unknown> | null | undefined>
): string {
  for (const data of sources) {
    if (!data) continue;
    for (const key of INVOICE_NUMBER_KEYS) {
      const raw = data[key];
      const normalized = normalizeInvoiceNumberString(raw);
      if (normalized && !isProvisionalInvoiceNumber(normalized)) return normalized;
      const s = String(raw ?? '').trim();
      if (s && !isProvisionalInvoiceNumber(s)) return s;
    }
  }
  return '';
}

function mergeInvoiceRecord(
  id: string,
  invoiceData: Record<string, unknown> | null,
  saleData: Record<string, unknown> | null,
): InvoiceWhatsAppRecord {
  const invoiceNumber = extractBillableInvoiceNumber(saleData, invoiceData);
  const customerName = String(
    saleData?.patientName ||
      saleData?.customerName ||
      invoiceData?.customerName ||
      invoiceData?.patientName ||
      '',
  ).trim();
  const customerPhone = String(
    saleData?.phone ||
      saleData?.customerPhone ||
      invoiceData?.customerPhone ||
      invoiceData?.phone ||
      '',
  ).trim();
  const pdfUrl = String(
    saleData?.pdfUrl ||
      saleData?.pdf_url ||
      invoiceData?.pdfUrl ||
      invoiceData?.pdf_url ||
      '',
  ).trim();
  const waStatus = normalizeWaStatus(saleData?.waStatus ?? invoiceData?.waStatus);

  return { id, customerName, customerPhone, invoiceNumber, pdfUrl, waStatus };
}

export function normalizePhoneForWhatsApp(raw: string): string {
  const digits = (raw || '').toString().replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export type LoadedInvoiceForWhatsApp = {
  record: InvoiceWhatsAppRecord;
  /** Firestore refs to merge `waStatus` (and timestamps) into after send. */
  statusUpdateRefs: DocumentReference[];
};

/**
 * Resolves invoice payload for WhatsApp: `invoices/{id}` first, then `sales/{id}` (CRM saved sales).
 */
async function enrichPhoneFromLinkedEnquiry(
  record: InvoiceWhatsAppRecord,
  saleData: Record<string, unknown> | null,
): Promise<InvoiceWhatsAppRecord> {
  if (normalizePhoneForWhatsApp(record.customerPhone)) return record;

  const enquiryId = String(saleData?.enquiryId || '').trim();
  if (!enquiryId) return record;

  const enqSnap = await adminDb().collection('enquiries').doc(enquiryId).get();
  if (!enqSnap.exists) return record;

  const phone = String((enqSnap.data() as Record<string, unknown>)?.phone || '').trim();
  if (!phone) return record;

  return { ...record, customerPhone: phone };
}

export async function loadInvoiceForWhatsApp(id: string): Promise<LoadedInvoiceForWhatsApp> {
  const trimmedId = (id || '').trim();
  if (!trimmedId) throw new Error('Invoice id is required');

  const db = adminDb();
  const invoicesRef = db.collection('invoices').doc(trimmedId);
  const salesRef = db.collection('sales').doc(trimmedId);

  const [invoiceSnap, saleSnap] = await Promise.all([invoicesRef.get(), salesRef.get()]);
  const saleData = saleSnap.exists ? ((saleSnap.data() || {}) as Record<string, unknown>) : null;
  const invoiceData = invoiceSnap.exists
    ? ((invoiceSnap.data() || {}) as Record<string, unknown>)
    : null;

  if (!saleSnap.exists && !invoiceSnap.exists) {
    throw new Error('Invoice not found');
  }

  let record = mergeInvoiceRecord(trimmedId, invoiceData, saleData);
  record = await enrichPhoneFromLinkedEnquiry(record, saleData);

  const statusUpdateRefs: DocumentReference[] = [invoicesRef];
  if (saleSnap.exists) statusUpdateRefs.push(salesRef);

  return { record, statusUpdateRefs };
}

export async function setInvoiceWaStatus(
  refs: DocumentReference[],
  waStatus: WaStatus,
  extra?: Record<string, unknown>,
) {
  const db = adminDb();
  const payload = {
    waStatus,
    waStatusUpdatedAt: new Date().toISOString(),
    ...extra,
  };
  await Promise.all(refs.map((ref) => ref.set(payload, { merge: true })));
}
