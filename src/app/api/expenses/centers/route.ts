import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const decoded = await adminAuth().verifyIdToken(match[1]);
    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const snap = await adminDb().collection('centers').get();
    const centers = snap.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          name: String(
            data.name ??
            data.centerName ??
            data.branchName ??
            data.location ??
            doc.id,
          ),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'en-IN'));

    return NextResponse.json({ ok: true, data: centers });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch centers';
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}
