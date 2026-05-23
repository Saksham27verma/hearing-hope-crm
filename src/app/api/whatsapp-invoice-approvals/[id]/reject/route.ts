import { NextResponse } from 'next/server';
import { verifyCrmUserFromBearer, CrmAuthHttpError } from '@/server/verifyCrmUserBearer';
import {
  assertAdminRole,
  handleRejectInvoiceWhatsAppRequest,
} from '@/server/invoices/whatsappApprovalHandlers';

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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { uid, role } = await verifyCrmUserFromBearer(req);
    assertAdminRole(role);

    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const result = await handleRejectInvoiceWhatsAppRequest({
      requestId: id,
      reviewerUid: uid,
      reason: body?.reason,
    });

    if (!result.ok) return json(result, 400);
    return json(result, 200);
  } catch (e) {
    const status = e instanceof CrmAuthHttpError ? e.statusCode : 500;
    const message = e instanceof Error ? e.message : 'Failed to reject request';
    return json({ ok: false, error: message }, status);
  }
}
