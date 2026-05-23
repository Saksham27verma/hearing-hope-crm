export type InvoiceWhatsAppRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'failed';

export interface InvoiceWhatsAppRequestedBy {
  uid: string;
  name: string;
  email?: string;
  role: string;
}

export interface InvoiceWhatsAppReviewedBy {
  uid: string;
  name: string;
}

/** Firestore `invoiceWhatsAppRequests/{id}` */
export interface InvoiceWhatsAppRequestDoc {
  saleId: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  pdfUrl: string;
  centerId: string | null;
  status: InvoiceWhatsAppRequestStatus;
  requestedBy: InvoiceWhatsAppRequestedBy;
  requestedAt: unknown;
  reviewedBy?: InvoiceWhatsAppReviewedBy | null;
  reviewedAt?: unknown | null;
  rejectionReason?: string | null;
  sendError?: string | null;
  dedupeKey: string;
}

export type InvoiceWhatsAppRequestWithId = InvoiceWhatsAppRequestDoc & { id: string };

export const INVOICE_WHATSAPP_REQUESTS_COLLECTION = 'invoiceWhatsAppRequests';
