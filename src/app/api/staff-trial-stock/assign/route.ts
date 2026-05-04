import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { listAvailableHearingAidSerialRows } from '@/server/computeAvailableInventoryStock';
import {
  STAFF_TRIAL_CUSTODY_COLLECTION,
  STAFF_TRIAL_CUSTODY_HISTORY_CAP,
  normalizeStaffTrialSerials,
  staffTrialCustodyDocId,
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
      productId?: string;
      serialNumbers?: string[];
      staffId?: string;
      notes?: string;
      centerId?: string | null;
    };

    const productId = String(body.productId || '').trim();
    const staffId = String(body.staffId || '').trim();
    const parts = normalizeStaffTrialSerials(Array.isArray(body.serialNumbers) ? body.serialNumbers : []);

    if (!productId || !staffId || parts.length === 0) {
      return jsonError('productId, staffId, and serialNumbers are required', 400);
    }

    const db = adminDb();
    const staffSnap = await db.collection('staff').doc(staffId).get();
    if (!staffSnap.exists) return jsonError('Staff not found', 404);
    const staffData = staffSnap.data() as { name?: string; status?: string };
    const staffName = String(staffData?.name || '').trim() || 'Unknown';
    if ((staffData?.status || 'active') !== 'active') {
      return jsonError('Staff member is not active', 400);
    }

    const rows = await listAvailableHearingAidSerialRows();
    const availableForProduct = new Set(
      rows.filter((r) => r.productId === productId).map((r) => r.serialNumber),
    );
    for (const sn of parts) {
      if (!availableForProduct.has(sn)) {
        return jsonError(`Serial is not available for assignment: ${sn}`, 400);
      }
    }

    const docId = staffTrialCustodyDocId(productId, parts);
    const ref = db.collection(STAFF_TRIAL_CUSTODY_COLLECTION).doc(docId);
    const now = Date.now();
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const centerRaw = body.centerId;
    const centerId =
      centerRaw === null || centerRaw === undefined ? null : String(centerRaw).trim() || null;

    const historyEvent: StaffTrialCustodyTransferEvent = {
      at: now,
      action: 'assign',
      toStaffId: staffId,
      toStaffName: staffName,
      byUid: uid,
    };

    await db.runTransaction(async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists) {
        throw new Error('CUSTODY_EXISTS');
      }
      const payload: Record<string, unknown> = {
        productId,
        serialNumbers: parts,
        staffId,
        staffName,
        assignedAt: now,
        updatedAt: now,
        assignedByUid: uid,
        transferHistory: [historyEvent],
        createdAt: FieldValue.serverTimestamp(),
      };
      if (centerId) payload.centerId = centerId;
      if (notes) payload.notes = notes;
      tx.set(ref, payload);
    });

    return NextResponse.json({ ok: true, id: docId });
  } catch (err: unknown) {
    if (err instanceof CrmAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    if (err instanceof Error && err.message === 'CUSTODY_EXISTS') {
      return jsonError('This serial combination is already assigned to staff custody', 409);
    }
    console.error('staff-trial-stock/assign error:', err);
    const message = err instanceof Error ? err.message : 'Assign failed';
    return jsonError(message, 500);
  }
}
