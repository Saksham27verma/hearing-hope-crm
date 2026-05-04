import { NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { STAFF_TRIAL_CUSTODY_COLLECTION } from '@/server/staffTrialCustody';
import { assertStaffTrialCustodyWriter, CrmAuthHttpError, verifyCrmUserFromBearer } from '@/server/verifyCrmUserBearer';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const { role } = await verifyCrmUserFromBearer(req);
    assertStaffTrialCustodyWriter(role);

    const body = (await req.json()) as {
      docId?: string;
      currentStaffId?: string;
    };

    const docId = String(body.docId || '').trim();
    const currentStaffId = String(body.currentStaffId || '').trim();

    if (!docId || !currentStaffId) {
      return jsonError('docId and currentStaffId are required', 400);
    }

    const db = adminDb();
    const ref = db.collection(STAFF_TRIAL_CUSTODY_COLLECTION).doc(docId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new Error('NOT_FOUND');
      }
      const data = snap.data() as { staffId?: string };
      if (String(data.staffId || '') !== currentStaffId) {
        throw new Error('STAFF_MISMATCH');
      }
      tx.delete(ref);
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof CrmAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    if (err instanceof Error) {
      if (err.message === 'NOT_FOUND') return jsonError('Custody record not found', 404);
      if (err.message === 'STAFF_MISMATCH') {
        return jsonError('Current holder does not match — refresh and try again', 409);
      }
    }
    console.error('staff-trial-stock/return error:', err);
    const message = err instanceof Error ? err.message : 'Return failed';
    return jsonError(message, 500);
  }
}
