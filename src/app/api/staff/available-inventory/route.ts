import { NextResponse } from 'next/server';
import { listAvailableHearingAidSerialRows } from '@/server/computeAvailableInventoryStock';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

function jsonError(message: string, status: number) {
  return withCors(NextResponse.json({ ok: false, error: message }, { status }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: Request) {
  try {
    await verifyStaffFromBearer(req);
    const items = await listAvailableHearingAidSerialRows();
    return withCors(NextResponse.json({ ok: true, items }));
  } catch (err: unknown) {
    if (err instanceof StaffAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('staff/available-inventory error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load inventory';
    return jsonError(message, 500);
  }
}
