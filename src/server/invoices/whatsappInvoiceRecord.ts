import type { DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import type { WaStatus } from '@/lib/invoices/whatsappTypes';

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

function mapInvoicesDoc(id: string, data: Record<string, unknown>): InvoiceWhatsAppRecord {
  return {
    id,
    customerName: String(data.customerName || data.patientName || '').trim(),
    customerPhone: String(data.customerPhone || data.phone || '').trim(),
    invoiceNumber: String(data.invoiceNumber || '').trim(),
    pdfUrl: String(data.pdfUrl || data.pdf_url || '').trim(),
    waStatus: normalizeWaStatus(data.waStatus),
  };
}

function mapSalesDoc(id: string, data: Record<string, unknown>): InvoiceWhatsAppRecord {
  return {
    id,
    customerName: String(data.patientName || data.customerName || '').trim(),
    customerPhone: String(data.phone || data.customerPhone || '').trim(),
    invoiceNumber: String(data.invoiceNumber || '').trim(),
    pdfUrl: String(data.pdfUrl || data.pdf_url || '').trim(),
    waStatus: normalizeWaStatus(data.waStatus),
  };
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

  if (invoiceSnap.exists) {
    let record = mapInvoicesDoc(trimmedId, (invoiceSnap.data() || {}) as Record<string, unknown>);
    record = await enrichPhoneFromLinkedEnquiry(record, saleData);
    const refs: DocumentReference[] = [invoicesRef];
    if (saleSnap.exists) refs.push(salesRef);
    return { record, statusUpdateRefs: refs };
  }

  if (saleSnap.exists) {
    let record = mapSalesDoc(trimmedId, saleData!);
    record = await enrichPhoneFromLinkedEnquiry(record, saleData);
    return { record, statusUpdateRefs: [invoicesRef, salesRef] };
  }

  throw new Error('Invoice not found');
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
