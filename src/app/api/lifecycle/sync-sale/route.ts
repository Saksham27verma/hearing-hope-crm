import { NextResponse } from 'next/server';
import { syncSaleToLifecycleById } from '@/server/lifecycle/lifecycleSalesSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { saleId?: string };
    const saleId = String(body.saleId || '').trim();
    if (!saleId) {
      return NextResponse.json({ ok: false, error: 'saleId required' }, { status: 400 });
    }
    const ok = await syncSaleToLifecycleById(saleId);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error('[api/lifecycle/sync-sale] error', err);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
