import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import {
  computeDesiredNextSequence,
  formatInvoiceNumber,
  maxSequenceFromInvoiceStrings,
  MAX_INVOICE_SEQUENCE,
  normalizeInvoiceSettings,
} from '@/lib/invoice-numbering/core';

export const DEFAULT_INVOICE_SETTINGS_DOC_ID = 'default';

export type AllocateInvoiceNumberOptions = {
  docId?: string;
  /** How many recent `sales` docs (by saleDate desc) to scan for max sequence. Default 50. */
  lookbackLimit?: number;
};

/**
 * Atomically allocates the next invoice number via Admin SDK (same rules as client `allocateNextInvoiceNumber`).
 */
export async function allocateNextInvoiceNumberAdmin(
  db: Firestore,
  options: AllocateInvoiceNumberOptions = {}
): Promise<string> {
  const docId = options.docId ?? DEFAULT_INVOICE_SETTINGS_DOC_ID;
  const lookbackLimit = options.lookbackLimit ?? 50;
  const ref = db.collection('invoiceSettings').doc(docId);

  const settingsSnap = await ref.get();
  const baseSettings = normalizeInvoiceSettings(
    settingsSnap.exists ? (settingsSnap.data() as Record<string, unknown>) : undefined
  );

  let salesSnap;
  try {
    salesSnap = await db.collection('sales').orderBy('saleDate', 'desc').limit(lookbackLimit).get();
  } catch (e) {
    console.error('allocateNextInvoiceNumberAdmin: sales reconcile query failed:', e);
    salesSnap = null;
  }

  const invoiceNumbers: string[] = [];
  if (salesSnap) {
    for (const s of salesSnap.docs) {
      invoiceNumbers.push(String((s.data() as Record<string, unknown>)?.invoiceNumber || '').trim());
    }
  }
  const maxSeq = maxSequenceFromInvoiceStrings(invoiceNumbers, baseSettings);
  const desiredNext = computeDesiredNextSequence(baseSettings, maxSeq);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const settings = normalizeInvoiceSettings(snap.exists ? (snap.data() as Record<string, unknown>) : undefined);
    let n = Math.max(settings.next_number, desiredNext);
    if (!Number.isFinite(n) || n < 1) n = 1;
    n = Math.min(MAX_INVOICE_SEQUENCE, Math.floor(n));
    const formatted = formatInvoiceNumber(settings, n);
    tx.set(
      ref,
      {
        prefix: settings.prefix,
        suffix: settings.suffix,
        padding: settings.padding,
        next_number: n + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return formatted;
  });
}
