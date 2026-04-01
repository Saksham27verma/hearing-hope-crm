import { NextResponse } from 'next/server';
import { renderHtmlToPdfBuffer } from '@/server/htmlToPdfBuffer';
import { getResolvedHtmlTemplateAdmin } from '@/server/invoiceTemplatesAdmin';
import { processInvoiceHtmlTemplate } from '@/utils/invoiceHtmlTemplate';
import type { InvoiceData } from '@/components/invoices/InvoiceTemplate';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RenderInvoiceBody = {
  invoiceData: InvoiceData;
  templateId?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RenderInvoiceBody;
    const invoiceData = body?.invoiceData;
    if (!invoiceData) {
      return NextResponse.json({ ok: false, error: 'invoiceData is required' }, { status: 400 });
    }

    const template = await getResolvedHtmlTemplateAdmin('invoice', {
      overrideTemplateId: body?.templateId || undefined,
    });
    if (!template?.htmlContent) {
      return NextResponse.json(
        { ok: false, error: 'invoice HTML template is required in Invoice Manager.' },
        { status: 422 }
      );
    }

    const html = processInvoiceHtmlTemplate(template.htmlContent, invoiceData, template);
    const buffer = await renderHtmlToPdfBuffer(html);
    const safe = `invoice-${String(invoiceData.invoiceNumber || 'INV').replace(/[^\w.-]+/g, '-')}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safe}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to render invoice PDF';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

