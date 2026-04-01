import { NextResponse } from 'next/server';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import { getEnquiryFieldOptionsAdmin } from '@/server/staffFieldOptionsAdmin';
import { adminDb } from '@/server/firebaseAdmin';

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

/** Dropdowns for staff receipt flows — same keys as CRM enquiry form (`ear_side`, `trial_location_type`, `hearing_test_type`) plus active staff names for “done by” fields. */
export async function GET(req: Request) {
  try {
    await verifyStaffFromBearer(req);
    const db = adminDb();
    const [earSide, trialLocationType, hearingTestType, staffSnap] = await Promise.all([
      getEnquiryFieldOptionsAdmin('ear_side'),
      getEnquiryFieldOptionsAdmin('trial_location_type'),
      getEnquiryFieldOptionsAdmin('hearing_test_type'),
      db.collection('staff').get(),
    ]);
    const staffNames = [
      ...new Set(
        staffSnap.docs
          .map((d) => {
            const data = d.data() as { name?: string; status?: string };
            if ((data.status || 'active') !== 'active') return '';
            return String(data.name || '').trim();
          })
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, 'en'));
    return withCors(
      NextResponse.json({
        ok: true,
        earSide,
        trialLocationType,
        hearingTestType,
        staffNames,
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
