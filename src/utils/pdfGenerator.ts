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
import {
  convertSaleToInvoiceData,
  mergeInvoiceConfigIntoData,
  enquiryVisitToInvoiceSalePayload as enquiryVisitToInvoiceSalePayloadImpl,
  saleHasBillableInvoiceNumber,
} from '@/utils/invoiceSaleToData';

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

export function enquiryVisitToInvoiceSalePayload(enquiry: any, visit: any) {
  return enquiryVisitToInvoiceSalePayloadImpl(
    enquiry as Record<string, unknown>,
    visit as Record<string, unknown>
  );
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

export { mergeInvoiceConfigIntoData, convertSaleToInvoiceData } from '@/utils/invoiceSaleToData';

export function createInvoicePdfElement(data: InvoiceData, rendererId: 'classic' | 'modern'): ReactElement {
  if (rendererId === 'modern') {
    return createElement(ModernInvoiceTemplate, { data });
  }
  return createElement(InvoiceTemplate, { data });
}

export const generateInvoicePDF = async (sale: any, opts?: InvoicePdfGenerationOptions): Promise<Blob> => {
  if (!saleHasBillableInvoiceNumber(sale?.invoiceNumber)) {
    throw new Error(
      'A valid invoice number is required before generating a PDF. Assign one from Sales & Invoicing or open the enquiry sale invoice flow.'
    );
  }
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
