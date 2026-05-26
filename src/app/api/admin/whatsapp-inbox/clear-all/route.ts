import { NextResponse } from 'next/server';
import { verifyCrmUserFromBearer, CrmAuthHttpError } from '@/server/verifyCrmUserBearer';
import { clearAllWhatsAppInboundInbox } from '@/server/whatsapp/clearInboundInbox';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { role } = await verifyCrmUserFromBearer(req);
    if (String(role || '').trim().toLowerCase() !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
    }

    const result = await clearAllWhatsAppInboundInbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof CrmAuthHttpError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    console.error('whatsapp-inbox/clear-all:', e);
    const msg = e instanceof Error ? e.message : 'Failed to clear inbox';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
