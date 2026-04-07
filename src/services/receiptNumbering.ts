import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';

export type ReceiptNumberSettings = {
  booking_next_number: number;
  trial_next_number: number;
};

const DEFAULT_SETTINGS: ReceiptNumberSettings = {
  booking_next_number: 1,
  trial_next_number: 1,
};

const DOC_ID = 'default';

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

export const formatBookingReceiptPreview = (n: number) =>
  `BR-${String(Math.max(1, Math.floor(n) || 1)).padStart(6, '0')}`;
export const formatTrialReceiptPreview = (n: number) =>
  `TR-${String(Math.max(1, Math.floor(n) || 1)).padStart(6, '0')}`;

