import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

export type ReceiptNumberSettings = {
  booking_next_number: number;
  trial_next_number: number;
};

export type ReceiptNumberKind = 'booking' | 'trial';

const DEFAULT_SETTINGS: ReceiptNumberSettings = {
  booking_next_number: 1,
  trial_next_number: 1,
};

const DOC_ID = 'default';
const RECEIPT_PADDING = 6;
const STRICT_BOOKING_RE = /^BR-(\d{6})$/;
const STRICT_TRIAL_RE = /^TR-(\d{6})$/;

export function receiptSettingsDocRef(db: Firestore, docId: string = DOC_ID) {
  return doc(db, 'receiptSettings', docId);
}

export function normalizeReceiptSettings(raw?: Record<string, unknown>): ReceiptNumberSettings {
  const booking_next_number = Math.max(1, Math.floor(Number(raw?.booking_next_number) || 1));
  const trial_next_number = Math.max(1, Math.floor(Number(raw?.trial_next_number) || 1));
  return { booking_next_number, trial_next_number };
}

export async function loadReceiptNumberSettings(
  db: Firestore,
  docId: string = DOC_ID
): Promise<ReceiptNumberSettings> {
  const snap = await getDoc(receiptSettingsDocRef(db, docId));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  return normalizeReceiptSettings(snap.data() as Record<string, unknown>);
}

export async function saveReceiptNumberSettings(
  db: Firestore,
  partial: Partial<ReceiptNumberSettings>,
  docId: string = DOC_ID
): Promise<ReceiptNumberSettings> {
  const normalized = normalizeReceiptSettings(partial as Record<string, unknown>);
  await setDoc(
    receiptSettingsDocRef(db, docId),
    {
      booking_next_number: normalized.booking_next_number,
      trial_next_number: normalized.trial_next_number,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return normalized;
}

const padReceiptSequence = (n: number) =>
  String(Math.max(1, Math.floor(n))).padStart(RECEIPT_PADDING, '0');

export const formatBookingReceiptPreview = (n: number) =>
  `BR-${padReceiptSequence(Number(n) || 1)}`;
export const formatTrialReceiptPreview = (n: number) => `TR-${padReceiptSequence(Number(n) || 1)}`;

const formatReceiptNumber = (kind: ReceiptNumberKind, sequence: number): string =>
  kind === 'booking' ? formatBookingReceiptPreview(sequence) : formatTrialReceiptPreview(sequence);

const parseStrictReceiptSequence = (kind: ReceiptNumberKind, value: unknown): number | null => {
  const s = String(value ?? '').trim();
  const m = (kind === 'booking' ? STRICT_BOOKING_RE : STRICT_TRIAL_RE).exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Walk every enquiry's `visits[]` once and return the largest strict `BR-NNNNNN` / `TR-NNNNNN`
 * sequence already used. Lets us advance `receiptSettings` past any historical/backfilled rows
 * (mirrors the server-side `inferMaxExistingReceiptSequence` in `allocateReceiptNumber.ts`).
 */
async function inferMaxExistingReceiptSequence(
  db: Firestore,
  kind: ReceiptNumberKind
): Promise<number> {
  const field = kind === 'booking' ? 'bookingReceiptNumber' : 'trialReceiptNumber';
  const enquiriesSnap = await getDocs(collection(db, 'enquiries'));
  let maxSeq = 0;
  for (const d of enquiriesSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    const visits = Array.isArray(data.visits) ? (data.visits as Array<Record<string, unknown>>) : [];
    for (const visit of visits) {
      const seq = parseStrictReceiptSequence(kind, visit?.[field]);
      if (seq && seq > maxSeq) maxSeq = seq;
    }
  }
  return maxSeq;
}

/**
 * Atomically allocate the next strict receipt number for `kind`, advancing the
 * `receiptSettings/default` counter so subsequent allocations don't reuse it.
 * Use from CRM-side enquiry save flows (mirrors `allocateNextReceiptNumberAdmin`).
 */
export async function allocateNextReceiptNumber(
  db: Firestore,
  kind: ReceiptNumberKind,
  docId: string = DOC_ID
): Promise<string> {
  const ref = receiptSettingsDocRef(db, docId);
  const nextField = kind === 'booking' ? 'booking_next_number' : 'trial_next_number';

  let desiredNext = 1;
  try {
    const maxExisting = await inferMaxExistingReceiptSequence(db, kind);
    desiredNext = Math.max(1, maxExisting + 1);
  } catch (error) {
    console.error('allocateNextReceiptNumber: failed to infer existing max sequence:', error);
  }

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
    let next = Number(current[nextField]);
    if (!Number.isFinite(next) || next < 1) next = 1;
    next = Math.max(Math.floor(next), desiredNext);

    const allocated = formatReceiptNumber(kind, next);
    tx.set(
      ref,
      {
        booking_next_number:
          kind === 'booking'
            ? next + 1
            : Math.max(1, Math.floor(Number(current.booking_next_number) || 1)),
        trial_next_number:
          kind === 'trial'
            ? next + 1
            : Math.max(1, Math.floor(Number(current.trial_next_number) || 1)),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return allocated;
  });
}

export const allocateNextBookingReceiptNumber = (db: Firestore, docId: string = DOC_ID) =>
  allocateNextReceiptNumber(db, 'booking', docId);

export const allocateNextTrialReceiptNumber = (db: Firestore, docId: string = DOC_ID) =>
  allocateNextReceiptNumber(db, 'trial', docId);

export const isStrictBookingReceiptNumber = (value: unknown): boolean =>
  parseStrictReceiptSequence('booking', value) !== null;

export const isStrictTrialReceiptNumber = (value: unknown): boolean =>
  parseStrictReceiptSequence('trial', value) !== null;

