import { NextResponse } from 'next/server';
import { verifyCrmUserFromBearer, CrmAuthHttpError } from '@/server/verifyCrmUserBearer';
import { assertAdminRole } from '@/server/invoices/whatsappApprovalHandlers';
import { refreshWhatsAppApprovalRequestPdf } from '@/server/invoices/ensureInvoicePdfUrl';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { role } = await verifyCrmUserFromBearer(_req);
    assertAdminRole(role);

    const { id } = await ctx.params;
    const pdfUrl = await refreshWhatsAppApprovalRequestPdf(id);
    return json({ ok: true, pdfUrl }, 200);
  } catch (e) {
    const status = e instanceof CrmAuthHttpError ? e.statusCode : 500;
    const message = e instanceof Error ? e.message : 'Failed to refresh invoice PDF';
    return json({ ok: false, error: message }, status);
  }
}
