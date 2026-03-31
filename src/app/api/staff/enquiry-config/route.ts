import { NextResponse } from 'next/server';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import { getEnquiryFieldOptionsAdmin } from '@/server/staffFieldOptionsAdmin';

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

/** Dropdowns for staff receipt flows — same keys as CRM enquiry form (`ear_side`, `trial_location_type`). */
export async function GET(req: Request) {
  try {
    await verifyStaffFromBearer(req);
    const [earSide, trialLocationType] = await Promise.all([
      getEnquiryFieldOptionsAdmin('ear_side'),
      getEnquiryFieldOptionsAdmin('trial_location_type'),
    ]);
    return withCors(
      NextResponse.json({
        ok: true,
        earSide,
        trialLocationType,
      })
    );
  } catch (err: unknown) {
    if (err instanceof StaffAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('staff/enquiry-config error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load enquiry config';
    return jsonError(message, 500);
  }
}
