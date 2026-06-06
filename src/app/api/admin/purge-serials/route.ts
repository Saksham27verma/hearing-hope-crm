import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { getRequesterTenant } from '@/server/tenant/requesterTenant';
import { purgeSerialsEverywhere } from '@/server/admin/serialPurgePropagation';

export const maxDuration = 120;

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type PurgeSerialsBody = {
  serials?: string[];
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const decoded = await adminAuth().verifyIdToken(match[1]);
    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);

    const body = (await req.json().catch(() => null)) as PurgeSerialsBody | null;
    const serials = Array.isArray(body?.serials)
      ? body!.serials!.map((s) => String(s || '').trim()).filter(Boolean)
      : [];

    if (serials.length === 0) {
      return jsonError('serials array is required', 400);
    }

    const db = adminDb();
    const result = await purgeSerialsEverywhere(db, serials);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Forbidden') return jsonError('Forbidden', 403);
    console.error('purge-serials', e);
    return jsonError(msg || 'Serial purge failed', 500);
  }
}
