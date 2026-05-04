import { NextResponse } from 'next/server';
import { listAvailableHearingAidSerialRows } from '@/server/computeAvailableInventoryStock';
import { CrmAuthHttpError, verifyCrmUserFromBearer } from '@/server/verifyCrmUserBearer';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  try {
    await verifyCrmUserFromBearer(req);
    const items = await listAvailableHearingAidSerialRows();
    return NextResponse.json({ ok: true, items });
  } catch (err: unknown) {
    if (err instanceof CrmAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('staff-trial-stock/available-serials error:', err);
    const message = err instanceof Error ? err.message : 'Failed to load serials';
    return jsonError(message, 500);
  }
}
