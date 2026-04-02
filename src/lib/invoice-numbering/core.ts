import type { InvoiceNumberSettings } from '@/lib/invoice-numbering/types';

export const DEFAULT_INVOICE_NUMBER_SETTINGS: InvoiceNumberSettings = {
  prefix: 'INV-',
  suffix: `/${new Date().getFullYear()}`,
  next_number: 1,
  padding: 4,
};

export function normalizeInvoiceSettings(raw: Record<string, unknown> | undefined): InvoiceNumberSettings {
  const d = raw || {};
  const pad =
    typeof d.padding === 'number' && d.padding >= 1
      ? Math.min(Math.floor(d.padding), 12)
      : DEFAULT_INVOICE_NUMBER_SETTINGS.padding;
  let next =
    typeof d.next_number === 'number' && Number.isFinite(d.next_number)
      ? Math.floor(d.next_number)
      : DEFAULT_INVOICE_NUMBER_SETTINGS.next_number;
  if (next < 1) next = 1;
  return {
    prefix: typeof d.prefix === 'string' ? d.prefix : DEFAULT_INVOICE_NUMBER_SETTINGS.prefix,
    suffix: typeof d.suffix === 'string' ? d.suffix : DEFAULT_INVOICE_NUMBER_SETTINGS.suffix,
    next_number: next,
    padding: pad,
  };
}

/** Format one invoice number from settings and a numeric sequence value (no Firestore). */
export function formatInvoiceNumber(settings: InvoiceNumberSettings, sequenceValue: number): string {
  const n = Math.max(1, Math.floor(sequenceValue));
  const padded = String(n).padStart(settings.padding, '0');
  return `${settings.prefix}${padded}${settings.suffix}`;
}

export function isProvisionalInvoiceNumber(invoiceNumber: string): boolean {
  return /^PROV-/i.test(String(invoiceNumber || '').trim());
}

/**
 * Parse the numeric sequence from a stored invoice number (last digit group before first `/`).
 * Returns null for empty, provisional (PROV-), or unparseable values.
 */
export function parseSequencePartFromInvoiceNumber(invoiceNumber: string): number | null {
  const s = invoiceNumber.trim();
  if (!s) return null;
  if (isProvisionalInvoiceNumber(s)) return null;

  const beforeSlash = s.split('/')[0] || s;
  const digitGroups = beforeSlash.match(/\d+/g);
  if (!digitGroups || digitGroups.length === 0) return null;
  const seqStr = digitGroups[digitGroups.length - 1];
  const seq = Number.parseInt(seqStr, 10);
  if (!Number.isFinite(seq) || seq < 1) return null;
  return seq;
}

/** Max sequence among invoice strings, or null if none parse. */
export function maxSequenceFromInvoiceStrings(invoiceNumbers: string[]): number | null {
  let maxSeq: number | null = null;
  for (const inv of invoiceNumbers) {
    const seq = parseSequencePartFromInvoiceNumber(String(inv || '').trim());
    if (seq == null) continue;
    if (maxSeq == null || seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}

/**
 * `desiredNext` before transaction: max from sales + 1, or settings.next_number at reconcile time if no sales seq.
 */
export function computeDesiredNextSequence(
  settingsAtReconcile: InvoiceNumberSettings,
  maxSequenceFromRecentSales: number | null
): number {
  if (typeof maxSequenceFromRecentSales === 'number' && Number.isFinite(maxSequenceFromRecentSales)) {
    return maxSequenceFromRecentSales + 1;
  }
  return settingsAtReconcile.next_number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True if the string matches `${prefix}${padded}${suffix}` for the given settings. */
export function invoiceNumberMatchesSettings(invoiceNumber: string, settings: InvoiceNumberSettings): boolean {
  const s = String(invoiceNumber || '').trim();
  if (!s || isProvisionalInvoiceNumber(s)) return false;
  const pad = Math.min(12, Math.max(1, Math.floor(settings.padding)));
  const pattern = new RegExp(
    `^${escapeRegex(settings.prefix)}\\d{${pad},${pad}}${escapeRegex(settings.suffix)}$`
  );
  return pattern.test(s);
}
