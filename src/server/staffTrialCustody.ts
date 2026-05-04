import { createHash } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

export const STAFF_TRIAL_CUSTODY_COLLECTION = 'staffTrialCustody';

/** Max events kept on the custody document (audit tail). */
export const STAFF_TRIAL_CUSTODY_HISTORY_CAP = 20;

export type StaffTrialCustodyTransferEvent = {
  at: number;
  action: 'assign' | 'transfer' | 'return';
  fromStaffId?: string;
  fromStaffName?: string;
  toStaffId?: string;
  toStaffName?: string;
  byUid?: string;
};

export type StaffTrialCustodyDoc = {
  productId: string;
  serialNumbers: string[];
  staffId: string;
  staffName: string;
  centerId?: string | null;
  assignedAt: number;
  updatedAt: number;
  assignedByUid?: string;
  notes?: string;
  transferHistory?: StaffTrialCustodyTransferEvent[];
};

export function normalizeStaffTrialSerials(serialNumbers: string[]): string[] {
  return [...new Set(serialNumbers.map((s) => String(s || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Deterministic Firestore document id (Node-only; used by API routes). */
export function staffTrialCustodyDocId(productId: string, serialNumbers: string[]): string {
  const parts = normalizeStaffTrialSerials(serialNumbers);
  const payload = `${String(productId || '').trim()}\n${parts.join('\n')}`;
  const hex = createHash('sha256').update(payload, 'utf8').digest('hex');
  return `stc_${hex}`;
}

/**
 * Build map productId -> Set of serial strings under staff trial custody (for availability math).
 */
export async function loadStaffTrialCustodySerialsByProduct(db: Firestore): Promise<Map<string, Set<string>>> {
  const snap = await db.collection(STAFF_TRIAL_CUSTODY_COLLECTION).get();
  const map = new Map<string, Set<string>>();
  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const productId = String(data.productId || '').trim();
    if (!productId) return;
    const raw = data.serialNumbers;
    const serials: string[] = Array.isArray(raw)
      ? (raw as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    if (!serials.length) return;
    if (!map.has(productId)) map.set(productId, new Set());
    const set = map.get(productId)!;
    serials.forEach((sn) => set.add(sn));
  });
  return map;
}
