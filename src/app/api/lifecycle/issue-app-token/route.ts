import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';

function signAppToken(payload: Record<string, unknown>, expiresInSec = 3600): string {
  const secret =
    process.env.TOKEN_SIGNING_SECRET?.trim() ||
    process.env.LIFECYCLE_WEBHOOK_SECRET?.trim() ||
    '';
  if (!secret) throw new Error('TOKEN_SIGNING_SECRET not configured');
  const exp = Math.floor(Date.now() / 1000) + expiresInSec;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const decoded = await adminAuth().verifyIdToken(match[1]);
    const db = adminDb();
    const callerSnap = await db.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists) return jsonError('Forbidden', 403);

    const lifecycleUrl = (process.env.LIFECYCLE_APP_URL || '').replace(/\/$/, '');
    if (!lifecycleUrl) return jsonError('LIFECYCLE_APP_URL not configured', 503);

    const token = signAppToken({
      uid: decoded.uid,
      email: decoded.email || '',
      role: String((callerSnap.data() || {}).role || ''),
    });

    const url = `${lifecycleUrl}/dashboard?token=${encodeURIComponent(token)}`;
    return NextResponse.json({ ok: true, url, token });
  } catch (e) {
    console.error('lifecycle/issue-app-token:', e);
    return jsonError(e instanceof Error ? e.message : 'Failed', 500);
  }
}
