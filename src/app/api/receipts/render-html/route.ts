import { NextResponse } from 'next/server';
import {
  getResolvedHtmlTemplateAdmin,
  resolveCenterDisplayNameAdmin,
} from '@/server/invoiceTemplatesAdmin';
import {
  buildBookingReceiptData,
  buildPaymentAcknowledgmentData,
  buildTrialReceiptData,
  type EnquiryLike,
  type VisitLike,
} from '@/utils/receiptDataBuilders';
import {
  buildBookingReceiptHtmlString,
  buildPaymentAcknowledgmentHtmlString,
  buildTrialReceiptHtmlString,
} from '@/utils/receiptTemplateHtml';
import { getEnquiryPaymentLedgerLines } from '@/utils/enquiryPaymentLedger';

export const runtime = 'nodejs';
export const maxDuration = 60;

function publicSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && explicit.trim()) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.trim()) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

type RenderReceiptBody = {
  receiptType: 'booking' | 'trial' | 'payment_acknowledgment';
  enquiry: Record<string, unknown>;
  visit?: Record<string, unknown>;
  options?: {
    receiptNumber?: string;
    centerName?: string;
    paymentMode?: string;
    documentNumber?: string;
    statementDate?: string;
  };
};

/**
 * Same HTML fragment as `/api/receipts/render` uses before PDF, but returns JSON so the browser
 * can rasterize with html2canvas when Puppeteer/Chrome is unavailable locally.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RenderReceiptBody;
    const receiptType = body?.receiptType;
    if (receiptType !== 'booking' && receiptType !== 'trial' && receiptType !== 'payment_acknowledgment') {
      return NextResponse.json(
        { ok: false, error: 'receiptType must be booking, trial, or payment_acknowledgment' },
        { status: 400 }
      );
    }
    const enquiry = (body?.enquiry || {}) as EnquiryLike;
    const visit = (body?.visit || {}) as VisitLike;
    const opts = body?.options || {};
    const origin = publicSiteOrigin();

    if (receiptType === 'payment_acknowledgment') {
      const lines = getEnquiryPaymentLedgerLines(body?.enquiry as Record<string, unknown>);
      if (lines.length === 0) {
        return NextResponse.json({ ok: false, error: 'No payments recorded for this enquiry.' }, { status: 400 });
      }
      const template = await getResolvedHtmlTemplateAdmin('payment_acknowledgment');
      if (!template?.htmlContent) {
        return NextResponse.json(
          { ok: false, error: 'payment_acknowledgment HTML template is required in Invoice Manager.' },
          { status: 422 }
        );
      }
      const centerName =
        opts.centerName !== undefined && String(opts.centerName).trim() !== ''
          ? String(opts.centerName)
          : undefined;
      const data = buildPaymentAcknowledgmentData(enquiry, {
        documentNumber: opts.documentNumber,
        centerName,
        statementDate: opts.statementDate,
      });
      const htmlFragment = buildPaymentAcknowledgmentHtmlString(template, data, { logoPublicOrigin: origin });
      return NextResponse.json({ ok: true, htmlFragment, templateId: template.id });
    }

    if (receiptType === 'booking') {
      const template = await getResolvedHtmlTemplateAdmin('booking_receipt');
      if (!template?.htmlContent) {
        return NextResponse.json(
          { ok: false, error: 'booking_receipt HTML template is required in Invoice Manager.' },
          { status: 422 }
        );
      }
      const centerName =
        opts.centerName !== undefined && String(opts.centerName).trim() !== ''
          ? String(opts.centerName)
          : await resolveCenterDisplayNameAdmin(enquiry as Record<string, unknown>, visit as Record<string, unknown>);
      const data = buildBookingReceiptData(enquiry, visit, {
        receiptNumber: opts.receiptNumber,
        centerName,
        paymentMode: opts.paymentMode,
      });
      const htmlFragment = buildBookingReceiptHtmlString(template, data, { logoPublicOrigin: origin });
      return NextResponse.json({ ok: true, htmlFragment, templateId: template.id });
    }

    const template = await getResolvedHtmlTemplateAdmin('trial_receipt');
    if (!template?.htmlContent) {
      return NextResponse.json(
        { ok: false, error: 'trial_receipt HTML template is required in Invoice Manager.' },
        { status: 422 }
      );
    }
    const centerName =
      opts.centerName !== undefined && String(opts.centerName).trim() !== ''
        ? String(opts.centerName)
        : await resolveCenterDisplayNameAdmin(enquiry as Record<string, unknown>, visit as Record<string, unknown>);
    const data = buildTrialReceiptData(enquiry, visit, {
      receiptNumber: opts.receiptNumber,
      centerName,
    });
    const htmlFragment = buildTrialReceiptHtmlString(template, data, { logoPublicOrigin: origin });
    return NextResponse.json({ ok: true, htmlFragment, templateId: template.id });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Failed to render receipt HTML';
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}
