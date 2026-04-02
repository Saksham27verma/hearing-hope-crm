import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  limit,
  orderBy,
  query,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { InvoiceNumberSettings } from '@/lib/invoice-numbering/types';
import {
  computeDesiredNextSequence,
  formatInvoiceNumber,
  normalizeInvoiceSettings,
  parseSequencePartFromInvoiceNumber,
} from '@/lib/invoice-numbering/core';

/** Default document id for org-wide invoice sequence. */
export const DEFAULT_INVOICE_SETTINGS_DOC_ID = 'default';

export {
  normalizeInvoiceSettings,
  formatInvoiceNumber,
  DEFAULT_INVOICE_NUMBER_SETTINGS,
  parseSequencePartFromInvoiceNumber,
  isProvisionalInvoiceNumber,
  invoiceNumberMatchesSettings,
} from '@/lib/invoice-numbering/core';

export function invoiceSettingsDocRef(db: Firestore, docId: string = DEFAULT_INVOICE_SETTINGS_DOC_ID) {
  return doc(db, 'invoiceSettings', docId);
}

/** Load current settings from Firestore (or defaults if missing). */
export async function loadInvoiceNumberSettings(
  db: Firestore,
  docId: string = DEFAULT_INVOICE_SETTINGS_DOC_ID
): Promise<InvoiceNumberSettings> {
  const ref = invoiceSettingsDocRef(db, docId);
  const snap = await getDoc(ref);
  return normalizeInvoiceSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined);
}

/** Persist full settings (prefix, suffix, padding, next_number). Use from Invoice Manager UI. */
export async function saveInvoiceNumberSettings(
  db: Firestore,
  partial: Partial<InvoiceNumberSettings> & Record<string, unknown>,
  docId: string = DEFAULT_INVOICE_SETTINGS_DOC_ID
): Promise<InvoiceNumberSettings> {
  const normalized = normalizeInvoiceSettings(partial as Record<string, unknown>);
  const ref = invoiceSettingsDocRef(db, docId);
  await setDoc(
    ref,
    {
      prefix: normalized.prefix,
      suffix: normalized.suffix,
      padding: normalized.padding,
      next_number: normalized.next_number,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return normalized;
}

/**
 * Read-only preview of what the next sequential invoice would look like.
 * Does not increment — safe for showing in the create form while the dialog is open.
 */
export async function peekNextInvoiceNumber(
  db: Firestore,
  docId: string = DEFAULT_INVOICE_SETTINGS_DOC_ID
): Promise<string> {
  const ref = invoiceSettingsDocRef(db, docId);
  const snap = await getDoc(ref);
  const settings = normalizeInvoiceSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined);

  const lastSeq = await inferLastInvoiceSequenceFromRecentSales(db, settings, 50);
  const desiredNext = computeDesiredNextSequence(settings, lastSeq);
  const previewN = Math.max(settings.next_number, desiredNext);
  return formatInvoiceNumber(settings, previewN);
}

/**
 * Atomically allocates the next invoice number and persists `next_number + 1`.
 * Use when a sale is actually written to `sales` and the user did not choose a custom number.
 */
export async function allocateNextInvoiceNumber(
  db: Firestore,
  docId: string = DEFAULT_INVOICE_SETTINGS_DOC_ID
): Promise<string> {
  const ref = invoiceSettingsDocRef(db, docId);

  const settingsSnap = await getDoc(ref);
  const baseSettings = normalizeInvoiceSettings(settingsSnap.exists() ? (settingsSnap.data() as Record<string, unknown>) : undefined);
  const lastSeq = await inferLastInvoiceSequenceFromRecentSales(db, baseSettings, 50);
  const desiredNext = computeDesiredNextSequence(baseSettings, lastSeq);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const settings = normalizeInvoiceSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined);

    const n = Math.max(settings.next_number, desiredNext);
    const formatted = formatInvoiceNumber(settings, n);

    transaction.set(
      ref,
      {
        prefix: settings.prefix,
        suffix: settings.suffix,
        padding: settings.padding,
        next_number: n + 1,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return formatted;
  });
}

async function inferLastInvoiceSequenceFromRecentSales(
  db: Firestore,
  _settings: InvoiceNumberSettings,
  lookbackLimit: number
): Promise<number | null> {
  let snap;
  try {
    snap = await getDocs(
      query(collection(db, 'sales'), orderBy('saleDate', 'desc'), limit(lookbackLimit))
    );
  } catch (e) {
    console.error('inferLastInvoiceSequenceFromRecentSales query failed:', e);
    return null;
  }

  let maxSeq: number | null = null;
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const inv = String(data.invoiceNumber || '').trim();
    const seq = parseSequencePartFromInvoiceNumber(inv);
    if (seq == null) continue;
    if (maxSeq == null || seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}
