import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

export type ReceiptNumberKind = 'booking' | 'trial';

const RECEIPT_SETTINGS_DOC_ID = 'default';
const BOOKING_PREFIX = 'BR';
const TRIAL_PREFIX = 'TR';
const RECEIPT_PADDING = 6;
const STRICT_BOOKING_RE = /^BR-(\d{6})$/;
const STRICT_TRIAL_RE = /^TR-(\d{6})$/;

const pad = (n: number) => String(Math.max(1, Math.floor(n))).padStart(RECEIPT_PADDING, '0');

function formatReceiptNumber(kind: ReceiptNumberKind, sequence: number): string {
  const prefix = kind === 'booking' ? BOOKING_PREFIX : TRIAL_PREFIX;
  return `${prefix}-${pad(sequence)}`;
}

function parseStrictSequence(kind: ReceiptNumberKind, value: unknown): number | null {
  const s = String(value ?? '').trim();
  const m = (kind === 'booking' ? STRICT_BOOKING_RE : STRICT_TRIAL_RE).exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function inferMaxExistingReceiptSequence(
  db: Firestore,
  kind: ReceiptNumberKind
): Promise<number> {
  const field = kind === 'booking' ? 'bookingReceiptNumber' : 'trialReceiptNumber';
  const enquirySnap = await db.collection('enquiries').get();
  let maxSeq = 0;
  for (const d of enquirySnap.docs) {
    const data = d.data() as Record<string, unknown>;
    const visits = Array.isArray(data.visits) ? data.visits : [];
    for (const visit of visits as Array<Record<string, unknown>>) {
      const seq = parseStrictSequence(kind, visit?.[field]);
      if (seq && seq > maxSeq) maxSeq = seq;
    }
  }
  return maxSeq;
}

export async function allocateNextReceiptNumberAdmin(
  db: Firestore,
  kind: ReceiptNumberKind
): Promise<string> {
  const ref = db.collection('receiptSettings').doc(RECEIPT_SETTINGS_DOC_ID);
  const nextField = kind === 'booking' ? 'booking_next_number' : 'trial_next_number';
  let desiredNext = 1;
  try {
    const maxExisting = await inferMaxExistingReceiptSequence(db, kind);
    desiredNext = Math.max(1, maxExisting + 1);
  } catch (error) {
    console.error('allocateNextReceiptNumberAdmin: failed to infer existing max sequence:', error);
  }

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? (snap.data() as Record<string, unknown>) : {};
    let next = Number(current[nextField]);
    if (!Number.isFinite(next) || next < 1) next = 1;
    next = Math.max(Math.floor(next), desiredNext);

    const allocated = formatReceiptNumber(kind, next);
    tx.set(
      ref,
      {
        booking_next_number:
          kind === 'booking' ? next + 1 : Math.max(1, Number(current.booking_next_number) || 1),
        trial_next_number:
          kind === 'trial' ? next + 1 : Math.max(1, Number(current.trial_next_number) || 1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return allocated;
  });
}

