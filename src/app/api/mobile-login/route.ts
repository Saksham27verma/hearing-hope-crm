import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';

/** Allow staff PWA (and other web clients) to POST from a different origin than the CRM. */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const withoutCountry = digits.replace(/^91/, '');
  const withoutLeadingZeros = withoutCountry.replace(/^0+/, '');
  return withoutLeadingZeros.slice(-10) || phone;
}

function jsonError(message: string, status: number) {
  return withCors(NextResponse.json({ ok: false, error: message }, { status }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const phone = (body?.phone ?? '').toString().trim();
    const password = (body?.password ?? '').toString();

    if (!phone || !password) {
      return jsonError('Phone and password are required', 400);
    }

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length !== 10) {
      return jsonError('Invalid phone number', 400);
    }

    const db = adminDb();
    const staffRef = db.collection('staff');
    const staffSnap = await staffRef
      .where('phone', '==', normalizedPhone)
      .where('mobileAppEnabled', '==', true)
      .limit(1)
      .get();

    if (staffSnap.empty) {
      return jsonError('Invalid credentials or mobile access not enabled', 401);
    }

    const staffDoc = staffSnap.docs[0];
    const staffId = staffDoc.id;
    const staffData = staffDoc.data();
    const hash = staffData.mobileAppPasswordHash as string | undefined;

    if (!hash) {
      return jsonError('Mobile app not configured', 401);
    }

    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      return jsonError('Invalid credentials', 401);
    }

    const token = await adminAuth().createCustomToken(staffId);

    return withCors(NextResponse.json({ ok: true, token }));
  } catch (err: any) {
    console.error('mobile-login error:', err);
    return jsonError(err?.message || 'Login failed', 500);
  }
}
