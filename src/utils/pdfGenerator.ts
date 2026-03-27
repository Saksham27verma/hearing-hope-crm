import { createElement, type ReactElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import InvoiceTemplate, { InvoiceData } from '@/components/invoices/InvoiceTemplate';
import ModernInvoiceTemplate from '@/components/invoices/templates/ModernInvoiceTemplate';
import {
  getInvoicePdfTemplate,
  getInvoicePdfConfig,
  resolveInvoicePdfRendererId,
  type InvoiceConfig,
  type InvoicePdfTemplateId,
} from '@/utils/invoicePdfPreferences';

export type { InvoiceConfig, InvoicePdfTemplateId } from '@/utils/invoicePdfPreferences';
export {
  setInvoicePdfTemplate,
  setInvoicePdfConfig,
  getInvoicePdfTemplate,
  getInvoicePdfConfig,
  DEFAULT_INVOICE_PDF_CONFIG,
  INVOICE_PDF_TEMPLATE_OPTIONS,
} from '@/utils/invoicePdfPreferences';

export type InvoicePdfGenerationOptions = {
  templateId?: InvoicePdfTemplateId;
  config?: Partial<InvoiceConfig>;
};

function formatInvoiceDateLabel(value: unknown): string {
  if (value == null) return new Date().toLocaleDateString('en-IN');
  const v = value as any;
  if (typeof v?.toDate === 'function') return v.toDate().toLocaleDateString('en-IN');
  if (v?.seconds != null) return new Date(v.seconds * 1000).toLocaleDateString('en-IN');
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toLocaleDateString('en-IN') : d.toLocaleDateString('en-IN');
  }
  if (value instanceof Date) return value.toLocaleDateString('en-IN');
  return new Date().toLocaleDateString('en-IN');
}

/** Map enquiry + visit into the shape expected by `convertSaleToInvoiceData` / invoice PDF. */
export function enquiryVisitToInvoiceSalePayload(enquiry: any, visit: any) {
  const visitKey = visit?.id ?? visit?.visitDate ?? visit?.purchaseDate ?? 'sale';
  return {
    products: visit?.products || [],
    gstAmount: Number(visit?.taxAmount) || 0,
    totalAmount: Number(visit?.salesAfterTax) || 0,
    patientName: enquiry?.name || 'Patient',
    phone: enquiry?.phone || '',
    email: enquiry?.email || '',
    address: enquiry?.address || '',
    saleDate: visit?.purchaseDate || visit?.visitDate || visit?.date || new Date().toISOString().slice(0, 10),
    // Provisional label only — does not use the global sales sequence (no Firestore write).
    invoiceNumber: `PROV-${String(enquiry?.id || 'enquiry').slice(0, 8)}-${String(visitKey).slice(0, 12)}`,
    notes: visit?.saleNotes || visit?.notes || '',
  };
}

export async function openEnquirySaleInvoicePDF(
  enquiry: any,
  visit: any,
  opts?: InvoicePdfGenerationOptions
): Promise<void> {
  return openInvoicePDF(enquiryVisitToInvoiceSalePayload(enquiry, visit), opts);
}

export async function downloadEnquirySaleInvoicePDF(
  enquiry: any,
  visit: any,
  filename?: string,
  opts?: InvoicePdfGenerationOptions
): Promise<void> {
  const payload = enquiryVisitToInvoiceSalePayload(enquiry, visit);
  const safeName = (filename || `invoice-${payload.invoiceNumber}.pdf`).replace(/[^\w.-]+/g, '-');
  return downloadInvoicePDF(payload, safeName, opts);
}

export function mergeInvoiceConfigIntoData(data: InvoiceData, config: InvoiceConfig): InvoiceData {
  const next = { ...data };
  if (config.companyName) next.companyName = config.companyName;
  if (config.companyAddress) next.companyAddress = config.companyAddress;
  if (config.companyPhone) next.companyPhone = config.companyPhone;
  if (config.companyEmail) next.companyEmail = config.companyEmail;
  if (config.companyGST !== undefined && config.companyGST !== '') next.companyGST = config.companyGST;
  if (config.customTerms && config.customTerms.trim()) next.terms = config.customTerms.trim();
  if (config.customFooter && config.customFooter.trim()) next.footerNote = config.customFooter.trim();
  return next;
}

export function createInvoicePdfElement(data: InvoiceData, rendererId: 'classic' | 'modern'): ReactElement {
  if (rendererId === 'modern') {
    return createElement(ModernInvoiceTemplate, { data });
  }
  return createElement(InvoiceTemplate, { data });
}

// Function to convert sale data to invoice data format
export const convertSaleToInvoiceData = (sale: any): InvoiceData => {
  const subtotal =
    sale.products?.reduce((sum: number, product: any) => {
      return sum + (product.sellingPrice || product.finalAmount || 0) * (product.quantity || 1);
    }, 0) || 0;

  const totalGST = sale.gstAmount || 0;
  const totalDiscount =
    sale.products?.reduce((sum: number, product: any) => {
      const mrp = product.mrp || 0;
      const sellingPrice = product.sellingPrice || product.finalAmount || 0;
      const discount = (mrp - sellingPrice) * (product.quantity || 1);
      return sum + (discount > 0 ? discount : 0);
    }, 0) || 0;

  const grandTotal = sale.totalAmount || subtotal + totalGST;

  const items =
    sale.products?.map((product: any, index: number) => ({
      id: product.id || `item-${index}`,
      name: product.name || 'Unknown Product',
      description: product.type || '',
      serialNumber: product.serialNumber || '',
      quantity: product.quantity || 1,
      rate: product.sellingPrice || product.finalAmount || 0,
      mrp: product.mrp || 0,
      discount: product.discount || 0,
      gstPercent: product.gstPercent || sale.gstPercentage || 0,
      amount: (product.sellingPrice || product.finalAmount || 0) * (product.quantity || 1),
    })) || [];

  const invoiceNumber = sale.invoiceNumber || '—';
  const invoiceDate = formatInvoiceDateLabel(sale.saleDate);

  return {
    companyName: 'Hope Hearing Solutions',
    companyAddress: 'Your Company Address\nCity, State - PIN Code',
    companyPhone: '+91 XXXXX XXXXX',
    companyEmail: 'info@hopehearing.com',
    companyGST: 'GST Number Here',
    invoiceNumber,
    invoiceDate,
    customerName: sale.patientName || 'Walk-in Customer',
    customerAddress: sale.address || '',
    customerPhone: sale.phone || '',
    customerEmail: sale.email || '',
    items,
    subtotal,
    totalDiscount: totalDiscount > 0 ? totalDiscount : undefined,
    totalGST: totalGST > 0 ? totalGST : undefined,
    grandTotal,
    referenceDoctor: sale.referenceDoctor?.name || '',
    salesperson: sale.salesperson?.name || '',
    branch: sale.branch || '',
    paymentMethod: sale.paymentMethod || '',
    notes: sale.notes || '',
    terms: getDefaultTermsAndConditions(),
  };
};

const getDefaultTermsAndConditions = (): string => {
  return `1. Payment is due within 30 days of invoice date.
2. All sales are final unless otherwise specified.
3. Warranty terms apply as per manufacturer guidelines.
4. Please retain this invoice for warranty claims.
5. For any queries, please contact us within 7 days.`;
};

export const generateInvoicePDF = async (sale: any, opts?: InvoicePdfGenerationOptions): Promise<Blob> => {
  const templateId = opts?.templateId ?? getInvoicePdfTemplate();
  const rendererId = resolveInvoicePdfRendererId(templateId);
  const mergedConfig: InvoiceConfig = { ...getInvoicePdfConfig(), ...opts?.config };
  let invoiceData = convertSaleToInvoiceData(sale);
  invoiceData = mergeInvoiceConfigIntoData(invoiceData, mergedConfig);
  const doc = createInvoicePdfElement(invoiceData, rendererId);
  return pdf(doc).toBlob();
};

export const downloadInvoicePDF = async (
  sale: any,
  filename?: string,
  opts?: InvoicePdfGenerationOptions
): Promise<void> => {
  try {
    const pdfBlob = await generateInvoicePDF(sale, opts);
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `invoice-${sale.invoiceNumber || Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF invoice');
  }
};

export const openInvoicePDF = async (sale: any, opts?: InvoicePdfGenerationOptions): Promise<void> => {
  try {
    const pdfBlob = await generateInvoicePDF(sale, opts);
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('Error opening PDF:', error);
    throw new Error('Failed to open PDF invoice');
  }
};

export const printInvoicePDF = async (sale: any, opts?: InvoicePdfGenerationOptions): Promise<void> => {
  try {
    const pdfBlob = await generateInvoicePDF(sale, opts);
    const url = URL.createObjectURL(pdfBlob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    };
  } catch (error) {
    console.error('Error printing PDF:', error);
    throw new Error('Failed to print PDF invoice');
  }
};

export const emailInvoicePDF = async (
  sale: any,
  emailAddress: string,
  opts?: InvoicePdfGenerationOptions
): Promise<void> => {
  try {
    const pdfBlob = await generateInvoicePDF(sale, opts);
    const reader = new FileReader();
    reader.readAsDataURL(pdfBlob);
    return new Promise((resolve, reject) => {
      reader.onload = () => {
        const base64Data = reader.result as string;
        console.log('PDF ready for email:', {
          to: emailAddress,
          subject: `Invoice #${sale.invoiceNumber || 'INV-' + Date.now()}`,
          attachment: base64Data,
        });
        resolve();
      };
      reader.onerror = () => reject(new Error('Failed to process PDF for email'));
    });
  } catch (error) {
    console.error('Error preparing PDF for email:', error);
    throw new Error('Failed to prepare PDF for email');
  }
};

export const generateBatchInvoices = async (sales: any[], opts?: InvoicePdfGenerationOptions): Promise<Blob[]> => {
  return Promise.all(sales.map((sale) => generateInvoicePDF(sale, opts)));
};

export const generateCustomInvoicePDF = async (
  sale: any,
  config: InvoiceConfig = {},
  templateId?: InvoicePdfTemplateId
): Promise<Blob> => {
  return generateInvoicePDF(sale, { config, templateId });
};
