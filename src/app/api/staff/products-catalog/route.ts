import { NextResponse } from 'next/server';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import { adminDb } from '@/server/firebaseAdmin';
import { docToCatalogProduct, type CatalogProductDoc } from '@/server/staffEnquiryCatalogHelpers';

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

/** Full `products` list — same source as CRM enquiry catalog (all products). */
export async function GET(req: Request) {
  try {
    await verifyStaffFromBearer(req);
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    const db = adminDb();
    const snap = await db.collection('products').get();
    let products: CatalogProductDoc[] = snap.docs.map((d) => docToCatalogProduct(d.id, d.data()));

    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      products = products.filter((p) => {
        const hay = `${p.company} ${p.name} ${p.type} ${p.mrp ?? ''} ${p.hsnCode ?? ''}`
          .toLowerCase()
          .replace(/\s+/g, ' ');
        return tokens.every((t) => hay.includes(t));
      });
    }

    return withCors(
      NextResponse.json({
        ok: true,
        products,
      })
    );
  } catch (err: unknown) {
    if (err instanceof StaffAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('staff/products-catalog error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load products';
    return jsonError(message, 500);
  }
}
