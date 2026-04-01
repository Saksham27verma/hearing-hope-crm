import { NextResponse } from 'next/server';
import {
  getResolvedHtmlTemplateAdmin,
  resolveCenterDisplayNameAdmin,
} from '@/server/invoiceTemplatesAdmin';
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

export const runtime = 'nodejs';
export const maxDuration = 60;

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

type RenderReceiptBody = {
  receiptType: 'booking' | 'trial';
  enquiry: Record<string, unknown>;
  visit: Record<string, unknown>;
  options?: {
    receiptNumber?: string;
    centerName?: string;
    paymentMode?: string;
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RenderReceiptBody;
    const receiptType = body?.receiptType;
    if (receiptType !== 'booking' && receiptType !== 'trial') {
      return NextResponse.json({ ok: false, error: 'receiptType must be booking or trial' }, { status: 400 });
    }
    const enquiry = (body?.enquiry || {}) as EnquiryLike;
    const visit = (body?.visit || {}) as VisitLike;
    const opts = body?.options || {};
    const origin = publicSiteOrigin();

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
      const inner = buildBookingReceiptHtmlString(template, data, { logoPublicOrigin: origin });
      const buffer = await renderHtmlToPdfBuffer(wrapFragmentInDocument(inner));
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="booking-receipt.pdf"`,
        },
      });
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
    const inner = buildTrialReceiptHtmlString(template, data, { logoPublicOrigin: origin });
    const buffer = await renderHtmlToPdfBuffer(wrapFragmentInDocument(inner));
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="trial-receipt.pdf"`,
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Failed to render receipt PDF';
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}

