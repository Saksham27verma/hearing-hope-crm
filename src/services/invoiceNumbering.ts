import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { InvoiceNumberSettings } from '@/lib/invoice-numbering/types';

/** Default document id for org-wide invoice sequence. */
export const DEFAULT_INVOICE_SETTINGS_DOC_ID = 'default';

export function invoiceSettingsDocRef(db: Firestore, docId: string = DEFAULT_INVOICE_SETTINGS_DOC_ID) {
  return doc(db, 'invoiceSettings', docId);
}

export const DEFAULT_INVOICE_NUMBER_SETTINGS: InvoiceNumberSettings = {
  prefix: 'INV-',
  suffix: `/${new Date().getFullYear()}`,
  next_number: 1,
  padding: 4,
};

export function normalizeInvoiceSettings(raw: Record<string, unknown> | undefined): InvoiceNumberSettings {
  const d = raw || {};
  const pad = typeof d.padding === 'number' && d.padding >= 1 ? Math.min(Math.floor(d.padding), 12) : DEFAULT_INVOICE_NUMBER_SETTINGS.padding;
  let next = typeof d.next_number === 'number' && Number.isFinite(d.next_number) ? Math.floor(d.next_number) : DEFAULT_INVOICE_NUMBER_SETTINGS.next_number;
  if (next < 1) next = 1;
  return {
    prefix: typeof d.prefix === 'string' ? d.prefix : DEFAULT_INVOICE_NUMBER_SETTINGS.prefix,
    suffix: typeof d.suffix === 'string' ? d.suffix : DEFAULT_INVOICE_NUMBER_SETTINGS.suffix,
    next_number: next,
    padding: pad,
  };
}

/** Format one invoice number from settings and a numeric sequence value (does not read/write Firestore). */
export function formatInvoiceNumber(settings: InvoiceNumberSettings, sequenceValue: number): string {
  const n = Math.max(1, Math.floor(sequenceValue));
  const padded = String(n).padStart(settings.padding, '0');
  return `${settings.prefix}${padded}${settings.suffix}`;
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
  return formatInvoiceNumber(settings, settings.next_number);
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
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const settings = normalizeInvoiceSettings(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined);
    const n = settings.next_number;
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
