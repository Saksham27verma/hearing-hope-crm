import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';
import { renameProductEverywhere } from '@/server/admin/productNamePropagation';

export const maxDuration = 120;

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type RenameProductBody = {
  productId?: string;
  newName?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const decoded = await adminAuth().verifyIdToken(match[1]);
    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const body = (await req.json().catch(() => null)) as RenameProductBody | null;
    const productId = String(body?.productId || '').trim();
    const newName = String(body?.newName || '').trim();

    if (!productId || !newName) {
      return jsonError('productId and newName are required', 400);
    }

    const result = await renameProductEverywhere(adminDb(), {
      productId,
      newName,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Forbidden') return jsonError('Forbidden', 403);
    console.error('rename-product', e);
    return jsonError(msg || 'Product rename propagation failed', 500);
  }
}
