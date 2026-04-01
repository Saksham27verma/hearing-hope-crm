import type { StaffPaymentReceiptPdfInput } from '@/server/staffPaymentReceiptPdf';
import { getResolvedHtmlTemplateAdmin, resolveCenterDisplayNameAdmin } from '@/server/invoiceTemplatesAdmin';
import { renderHtmlToPdfBuffer } from '@/server/htmlToPdfBuffer';
import {
  buildBookingReceiptData,
  buildTrialReceiptData,
  type EnquiryLike,
  type VisitLike,
} from '@/utils/receiptDataBuilders';
import {
  buildBookingReceiptHtmlString,
  buildTrialReceiptHtmlString,
} from '@/utils/receiptTemplateHtml';
import { enquiryVisitToInvoiceSalePayload, convertSaleToInvoiceData, mergeInvoiceConfigIntoData } from '@/utils/invoiceSaleToData';
import { DEFAULT_INVOICE_PDF_CONFIG } from '@/utils/invoicePdfPreferences';
import { processInvoiceHtmlTemplate } from '@/utils/invoiceHtmlTemplate';

function publicSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && explicit.trim()) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.trim()) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

function wrapFragmentInDocument(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Receipt</title>
</head>
<body style="margin:0;background:#ffffff">
${inner}
</body>
</html>`;
}

export type StaffCrmPdfArgs = {
  receiptType: 'trial' | 'booking' | 'invoice';
  enquiry: Record<string, unknown>;
  lastVisit: Record<string, unknown>;
  enquiryId: string;
  paymentMethod: string;
  staffName: string;
  staffId: string;
  requestId: string;
  /** Same Firestore id the staff app showed (Invoice Manager pin); server tries this before routing doc. */
  htmlTemplateId?: string | null;
  /** Fallback when CRM-style PDF cannot be built. */
  fallbackInput: StaffPaymentReceiptPdfInput;
};

export type StaffCrmStylePdfResult = {
  buffer: Buffer;
  /** Firestore `invoiceTemplates` id used for HTML→PDF, when CRM-style path succeeded. */
  templateId?: string;
};

/**
 * PDF attached to staff payment notify email: strict Invoice Manager HTML templates,
 * rendered server-side so mobile and CRM produce identical documents.
 */
export async function buildStaffCrmStyleReceiptPdfBuffer(args: StaffCrmPdfArgs): Promise<StaffCrmStylePdfResult> {
  const origin = publicSiteOrigin();
  const override = args.htmlTemplateId;

  const enquiry = args.enquiry as EnquiryLike;
  const visit = args.lastVisit as VisitLike;

  try {
    if (args.receiptType === 'booking') {
      const template = await getResolvedHtmlTemplateAdmin('booking_receipt', { overrideTemplateId: override });
      if (!template?.htmlContent) {
        throw new Error('booking_receipt HTML template is required in Invoice Manager.');
      }
      console.info(`staffCrmStyleReceiptPdf: booking template id=${template.id} len=${template.htmlContent.length}`);
      const centerName = await resolveCenterDisplayNameAdmin(args.enquiry, args.lastVisit);
      const data = buildBookingReceiptData(enquiry, visit, {
        centerName,
        paymentMode: args.paymentMethod,
      });
      const inner = buildBookingReceiptHtmlString(template, data, { logoPublicOrigin: origin });
      const html = wrapFragmentInDocument(inner);
      const buffer = await renderHtmlToPdfBuffer(html);
      return { buffer, templateId: template.id };
    }

    if (args.receiptType === 'trial') {
      const template = await getResolvedHtmlTemplateAdmin('trial_receipt', { overrideTemplateId: override });
      if (!template?.htmlContent) throw new Error('trial_receipt HTML template is required in Invoice Manager.');
      const centerName = await resolveCenterDisplayNameAdmin(args.enquiry, args.lastVisit);
      const data = buildTrialReceiptData(enquiry, visit, {
        centerName,
      });
      const inner = buildTrialReceiptHtmlString(template, data, { logoPublicOrigin: origin });
      const html = wrapFragmentInDocument(inner);
      const buffer = await renderHtmlToPdfBuffer(html);
      return { buffer, templateId: template.id };
    }

    if (args.receiptType === 'invoice') {
      const template = await getResolvedHtmlTemplateAdmin('invoice', { overrideTemplateId: override });
      if (!template?.htmlContent) throw new Error('invoice HTML template is required in Invoice Manager.');
      const sale: Record<string, unknown> = {
        ...enquiryVisitToInvoiceSalePayload(args.enquiry, args.lastVisit),
        paymentMethod: args.paymentMethod,
        salesperson: { name: args.staffName },
      };
      let invoiceData = convertSaleToInvoiceData(sale);
      invoiceData = mergeInvoiceConfigIntoData(invoiceData, DEFAULT_INVOICE_PDF_CONFIG);
      invoiceData = {
        ...invoiceData,
        paymentMethod: args.paymentMethod,
        salesperson: args.staffName,
      };
      const html = processInvoiceHtmlTemplate(template.htmlContent, invoiceData, template);
      const buffer = await renderHtmlToPdfBuffer(html);
      return { buffer, templateId: template.id };
    }

    throw new Error(`Unsupported receiptType: ${String(args.receiptType)}`);
  } catch (e) {
    const detail = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    console.error('staffCrmStyleReceiptPdf: strict template rendering failed:', detail);
    throw e;
  }
}
