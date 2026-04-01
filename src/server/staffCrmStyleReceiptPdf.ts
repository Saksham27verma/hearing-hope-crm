import { buildStaffPaymentReceiptPdfBuffer, type StaffPaymentReceiptPdfInput } from '@/server/staffPaymentReceiptPdf';
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
 * PDF attached to staff payment notify email: same Firestore HTML templates as the CRM (Invoice Manager),
 * rendered server-side. Falls back to the legacy minimal pdf-lib document if Chromium/Puppeteer fails
 * or no HTML template exists for the document type.
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
        throw new Error('no booking HTML template in invoiceTemplates (need non-visual HTML + documentType booking)');
      }
      console.info(`staffCrmStyleReceiptPdf: booking template id=${template.id} len=${template.htmlContent.length}`);
      const centerName = await resolveCenterDisplayNameAdmin(args.enquiry, args.lastVisit);
      const data = buildBookingReceiptData(enquiry, visit, {
        receiptNumber: `BR-STAFF-${args.requestId.slice(0, 8)}`,
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
      if (!template?.htmlContent) throw new Error('no trial HTML template');
      const centerName = await resolveCenterDisplayNameAdmin(args.enquiry, args.lastVisit);
      const data = buildTrialReceiptData(enquiry, visit, {
        receiptNumber: `TR-STAFF-${args.requestId.slice(0, 8)}`,
        centerName,
      });
      const inner = buildTrialReceiptHtmlString(template, data, { logoPublicOrigin: origin });
      const html = wrapFragmentInDocument(inner);
      const buffer = await renderHtmlToPdfBuffer(html);
      return { buffer, templateId: template.id };
    }

    if (args.receiptType === 'invoice') {
      const template = await getResolvedHtmlTemplateAdmin('invoice', { overrideTemplateId: override });
      if (!template?.htmlContent) throw new Error('no invoice HTML template');
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
  } catch (e) {
    const detail = e instanceof Error ? `${e.message}\n${e.stack}` : String(e);
    console.error(
      'staffCrmStyleReceiptPdf: CRM HTML template path failed — email will use minimal pdf-lib receipt. Cause:',
      detail
    );
  }

  const buffer = await buildStaffPaymentReceiptPdfBuffer(args.fallbackInput);
  return { buffer };
}
