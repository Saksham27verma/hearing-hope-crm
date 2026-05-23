export type WaStatus = 'PENDING_APPROVAL' | 'SENT_VIA_WA' | 'FAILED' | 'REJECTED';

export interface InvoiceWhatsAppInvoiceProps {
  id: string;
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  pdfUrl: string;
  waStatus?: WaStatus;
}
