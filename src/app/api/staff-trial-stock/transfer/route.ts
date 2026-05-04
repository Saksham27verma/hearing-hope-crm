import { NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import {
  STAFF_TRIAL_CUSTODY_COLLECTION,
  STAFF_TRIAL_CUSTODY_HISTORY_CAP,
  type StaffTrialCustodyTransferEvent,
} from '@/server/staffTrialCustody';
import { assertStaffTrialCustodyWriter, CrmAuthHttpError, verifyCrmUserFromBearer } from '@/server/verifyCrmUserBearer';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const { uid, role } = await verifyCrmUserFromBearer(req);
    assertStaffTrialCustodyWriter(role);

    const body = (await req.json()) as {
      docId?: string;
      toStaffId?: string;
      currentStaffId?: string;
    };

    const docId = String(body.docId || '').trim();
    const toStaffId = String(body.toStaffId || '').trim();
    const currentStaffId = String(body.currentStaffId || '').trim();

    if (!docId || !toStaffId || !currentStaffId) {
      return jsonError('docId, toStaffId, and currentStaffId are required', 400);
    }
    if (toStaffId === currentStaffId) {
      return jsonError('Recipient is already the holder', 400);
    }

    const db = adminDb();
    const newStaffSnap = await db.collection('staff').doc(toStaffId).get();
    if (!newStaffSnap.exists) return jsonError('Staff not found', 404);
    const newStaffData = newStaffSnap.data() as { name?: string; status?: string };
    const toStaffName = String(newStaffData?.name || '').trim() || 'Unknown';
    if ((newStaffData?.status || 'active') !== 'active') {
      return jsonError('Recipient staff member is not active', 400);
    }

    const ref = db.collection(STAFF_TRIAL_CUSTODY_COLLECTION).doc(docId);
    const now = Date.now();

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new Error('NOT_FOUND');
      }
      const data = snap.data() as { staffId?: string; staffName?: string; transferHistory?: StaffTrialCustodyTransferEvent[] };
      if (String(data.staffId || '') !== currentStaffId) {
        throw new Error('STAFF_MISMATCH');
      }
      const fromStaffId = String(data.staffId || '');
      const fromStaffName = String(data.staffName || '');
      const prevHistory = Array.isArray(data.transferHistory) ? data.transferHistory : [];
      const event: StaffTrialCustodyTransferEvent = {
        at: now,
        action: 'transfer',
        fromStaffId,
        fromStaffName,
        toStaffId,
        toStaffName,
        byUid: uid,
      };
      const transferHistory = [...prevHistory, event].slice(-STAFF_TRIAL_CUSTODY_HISTORY_CAP);
      tx.update(ref, {
        staffId: toStaffId,
        staffName: toStaffName,
        updatedAt: now,
        transferHistory,
      });
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
    console.error('staff-trial-stock/transfer error:', err);
    const message = err instanceof Error ? err.message : 'Transfer failed';
    return jsonError(message, 500);
  }
}
