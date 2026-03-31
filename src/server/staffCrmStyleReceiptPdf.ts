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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function publicSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && explicit.trim()) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.trim()) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

function appendGeneratedByFooter(html: string, line: string): string {
  const footer = `<div style="margin-top:14px;padding:10px 12px;border-top:1px solid #e5e7eb;font-size:10px;color:#64748b;font-family:system-ui,Segoe UI,sans-serif;line-height:1.4">${escapeHtml(line)}</div>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${footer}</body>`);
  }
  return `${html}${footer}`;
}

function wrapFragmentInDocument(inner: string, footerLine: string): string {
  const f = `<div style="margin-top:14px;padding:10px 12px;border-top:1px solid #e5e7eb;font-size:10px;color:#64748b;font-family:system-ui,Segoe UI,sans-serif;line-height:1.4">${escapeHtml(footerLine)}</div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Receipt</title>
</head>
<body style="margin:0;background:#ffffff">
${inner}
${f}
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
  /** Fallback when CRM-style PDF cannot be built. */
  fallbackInput: StaffPaymentReceiptPdfInput;
};

/**
 * PDF attached to staff payment notify email: same Firestore HTML templates as the CRM (Invoice Manager),
 * rendered server-side. Falls back to the legacy minimal pdf-lib document if Chromium/Puppeteer fails
 * or no HTML template exists for the document type.
 */
export async function buildStaffCrmStyleReceiptPdfBuffer(args: StaffCrmPdfArgs): Promise<Buffer> {
  const origin = publicSiteOrigin();
  const footerLine = `Generated in staff app by ${args.staffName} (ID: ${args.staffId}) · Request ${args.requestId.slice(0, 8)}…`;

  const enquiry = args.enquiry as EnquiryLike;
  const visit = args.lastVisit as VisitLike;

  try {
    if (args.receiptType === 'booking') {
      const template = await getResolvedHtmlTemplateAdmin('booking_receipt');
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
      const html = wrapFragmentInDocument(inner, footerLine);
      return await renderHtmlToPdfBuffer(html);
    }

    if (args.receiptType === 'trial') {
      const template = await getResolvedHtmlTemplateAdmin('trial_receipt');
      if (!template?.htmlContent) throw new Error('no trial HTML template');
      const centerName = await resolveCenterDisplayNameAdmin(args.enquiry, args.lastVisit);
      const data = buildTrialReceiptData(enquiry, visit, {
        receiptNumber: `TR-STAFF-${args.requestId.slice(0, 8)}`,
        centerName,
      });
      const inner = buildTrialReceiptHtmlString(template, data, { logoPublicOrigin: origin });
      const html = wrapFragmentInDocument(inner, footerLine);
      return await renderHtmlToPdfBuffer(html);
    }

    if (args.receiptType === 'invoice') {
      const template = await getResolvedHtmlTemplateAdmin('invoice');
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
      let html = processInvoiceHtmlTemplate(template.htmlContent, invoiceData, template);
      html = appendGeneratedByFooter(html, footerLine);
      return await renderHtmlToPdfBuffer(html);
    }
  } catch (e) {
    console.warn(
      'staffCrmStyleReceiptPdf: falling back to minimal PDF (check Firestore invoiceTemplates + Puppeteer logs):',
      e
    );
  }

  return buildStaffPaymentReceiptPdfBuffer(args.fallbackInput);
}
