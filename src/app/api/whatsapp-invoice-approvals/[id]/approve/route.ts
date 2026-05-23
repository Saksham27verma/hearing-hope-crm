import { NextResponse } from 'next/server';
import { verifyCrmUserFromBearer, CrmAuthHttpError } from '@/server/verifyCrmUserBearer';
import {
  assertAdminRole,
  handleApproveInvoiceWhatsAppRequest,
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
    const result = await handleApproveInvoiceWhatsAppRequest({ requestId: id, reviewerUid: uid });

    if (!result.ok) return json(result, 400);
    return json(result, 200);
  } catch (e) {
    const status = e instanceof CrmAuthHttpError ? e.statusCode : 500;
    const message = e instanceof Error ? e.message : 'Failed to approve request';
    return json({ ok: false, error: message }, status);
  }
}
