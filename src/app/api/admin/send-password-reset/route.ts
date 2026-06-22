import { NextResponse } from 'next/server';
import { adminAuth } from '@/server/firebaseAdmin';
import { sendPasswordResetEmailServer } from '@/server/admin/passwordReset';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);

    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const email = (body?.email || '').toString().trim().toLowerCase();
    if (!email) return jsonError('Email is required', 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Invalid email format', 400);

    await sendPasswordResetEmailServer(email);

    return NextResponse.json({ ok: true, email });
  } catch (err: unknown) {
    const code = String((err as { code?: string }).code || '');
    const message = err instanceof Error ? err.message : 'Failed to send password reset email';
    console.error('send-password-reset error:', err);
    if (code.includes('user-not-found') || message.toLowerCase().includes('no user record')) {
      return jsonError('No Firebase account exists for this email. Re-create the user first.', 404);
    }
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}
