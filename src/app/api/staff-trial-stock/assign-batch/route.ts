import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { listAvailableHearingAidSerialRows } from '@/server/computeAvailableInventoryStock';
import {
  STAFF_TRIAL_CUSTODY_COLLECTION,
  normalizeStaffTrialSerials,
  staffTrialCustodyDocId,
  type StaffTrialCustodyTransferEvent,
} from '@/server/staffTrialCustody';
import { assertStaffTrialCustodyWriter, CrmAuthHttpError, verifyCrmUserFromBearer } from '@/server/verifyCrmUserBearer';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type LineInput = { productId?: string; serialNumbers?: string[] };

export async function POST(req: Request) {
  try {
    const { uid, role } = await verifyCrmUserFromBearer(req);
    assertStaffTrialCustodyWriter(role);

    const body = (await req.json()) as {
      staffId?: string;
      notes?: string;
      centerId?: string | null;
      lines?: LineInput[];
    };

    const staffId = String(body.staffId || '').trim();
    const linesRaw = Array.isArray(body.lines) ? body.lines : [];
    if (!staffId || linesRaw.length === 0) {
      return jsonError('staffId and at least one line are required', 400);
    }

    const db = adminDb();
    const staffSnap = await db.collection('staff').doc(staffId).get();
    if (!staffSnap.exists) return jsonError('Staff not found', 404);
    const staffData = staffSnap.data() as { name?: string; status?: string };
    const staffName = String(staffData?.name || '').trim() || 'Unknown';
    if ((staffData?.status || 'active') !== 'active') {
      return jsonError('Staff member is not active', 400);
    }

    const normalizedLines: { productId: string; serialNumbers: string[] }[] = [];
    for (const raw of linesRaw) {
      const productId = String(raw.productId || '').trim();
      const parts = normalizeStaffTrialSerials(Array.isArray(raw.serialNumbers) ? raw.serialNumbers : []);
      if (!productId || parts.length === 0) {
        return jsonError('Each line needs productId and at least one serial', 400);
      }
      normalizedLines.push({ productId, serialNumbers: parts });
    }

    const rows = await listAvailableHearingAidSerialRows();
    const availableByProduct = new Map<string, Set<string>>();
    rows.forEach((r) => {
      if (!availableByProduct.has(r.productId)) availableByProduct.set(r.productId, new Set());
      availableByProduct.get(r.productId)!.add(r.serialNumber);
    });

    for (const line of normalizedLines) {
      const set = availableByProduct.get(line.productId);
      if (!set) {
        return jsonError(`No available serial-tracked stock for product ${line.productId}`, 400);
      }
      for (const sn of line.serialNumbers) {
        if (!set.has(sn)) {
          return jsonError(`Serial is not available: ${sn} (${line.productId})`, 400);
        }
      }
    }

    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const centerRaw = body.centerId;
    const centerId =
      centerRaw === null || centerRaw === undefined ? null : String(centerRaw).trim() || null;

    const createdIds: string[] = [];
    const now = Date.now();

    for (const line of normalizedLines) {
      const docId = staffTrialCustodyDocId(line.productId, line.serialNumbers);
      const ref = db.collection(STAFF_TRIAL_CUSTODY_COLLECTION).doc(docId);
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
          productId: line.productId,
          serialNumbers: line.serialNumbers,
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
      createdIds.push(docId);
    }

    return NextResponse.json({ ok: true, ids: createdIds });
  } catch (err: unknown) {
    if (err instanceof CrmAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    if (err instanceof Error && err.message === 'CUSTODY_EXISTS') {
      return jsonError('One or more serials are already assigned to staff custody', 409);
    }
    console.error('staff-trial-stock/assign-batch error:', err);
    const message = err instanceof Error ? err.message : 'Batch assign failed';
    return jsonError(message, 500);
  }
}
