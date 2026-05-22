import type { UnifiedInvoiceRow } from '@/lib/sales-invoicing/types';
import type { InvoiceWhatsAppInvoiceProps } from '@/lib/invoices/whatsappTypes';

/** Build WhatsApp button props from a saved sales & invoicing table row. */
export function invoiceWhatsAppPropsFromRow(row: UnifiedInvoiceRow): InvoiceWhatsAppInvoiceProps | null {
  if (row.kind !== 'saved' || row.isCancelled || !row.savedSale?.id) return null;

  const sale = row.savedSale;
  const saleId = sale.id!;
  const invoiceNumber = (sale.invoiceNumber || row.invoiceNumber || '').trim();
  if (!invoiceNumber) return null;

  return {
    id: saleId,
    customerName: sale.patientName || row.clientName,
    customerPhone: (sale.phone || row.clientPhone || '').trim(),
    invoiceNumber,
    pdfUrl: sale.pdfUrl || '',
    waStatus: sale.waStatus,
  };
}
