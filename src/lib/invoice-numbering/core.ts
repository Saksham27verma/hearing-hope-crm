import type { InvoiceNumberSettings } from '@/lib/invoice-numbering/types';

export const DEFAULT_INVOICE_NUMBER_SETTINGS: InvoiceNumberSettings = {
  prefix: 'INV-',
  suffix: `/${new Date().getFullYear()}`,
  next_number: 1,
  padding: 4,
};

/** Safe upper bound for sequential invoice counter (avoids float / corrupted Firestore values). */
export const MAX_INVOICE_SEQUENCE = 99_999_999;

function coercePositiveInt(v: unknown, fallback: number, max = MAX_INVOICE_SEQUENCE): number {
  if (v == null) return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) {
    const x = Math.floor(v);
    if (x >= 1 && x <= max) return x;
    return fallback;
  }
  if (typeof v === 'string') {
    const t = v.trim().replace(/[^\d]/g, '');
    if (!t) return fallback;
    const x = parseInt(t.slice(0, 12), 10);
    if (Number.isFinite(x) && x >= 1 && x <= max) return x;
  }
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    const t = String(v).replace(/\D/g, '');
    if (t) {
      const x = parseInt(t.slice(0, 12), 10);
      if (Number.isFinite(x) && x >= 1 && x <= max) return x;
    }
  }
  return fallback;
}

export function normalizeInvoiceSettings(raw: Record<string, unknown> | undefined): InvoiceNumberSettings {
  const d = raw || {};
  let padding = DEFAULT_INVOICE_NUMBER_SETTINGS.padding;
  const rawPad = d.padding;
  if (typeof rawPad === 'number' && Number.isFinite(rawPad)) {
    padding = Math.min(12, Math.max(1, Math.floor(rawPad)));
  } else if (typeof rawPad === 'string' && rawPad.trim()) {
    const x = parseInt(rawPad.replace(/[^\d]/g, '').slice(0, 3), 10);
    if (Number.isFinite(x) && x >= 1) padding = Math.min(12, x);
  }
  let next = coercePositiveInt(d.next_number, DEFAULT_INVOICE_NUMBER_SETTINGS.next_number);
  if (next < 1) next = 1;
  return {
    prefix: typeof d.prefix === 'string' ? d.prefix : DEFAULT_INVOICE_NUMBER_SETTINGS.prefix,
    suffix: typeof d.suffix === 'string' ? d.suffix : DEFAULT_INVOICE_NUMBER_SETTINGS.suffix,
    next_number: next,
    padding,
  };
}

/**
 * Padded digit segment for the sequence — never use `String(n)` on floats that may stringify as
 * scientific notation (e.g. corrupted Firestore values), which produced invoices like HDI/.../3.82e+25.
 */
function formatSequenceDigitsPadded(sequenceInt: number, padding: number): string {
  let n = Math.trunc(Number(sequenceInt));
  if (!Number.isFinite(n) || n < 1) n = 1;
  n = Math.min(MAX_INVOICE_SEQUENCE, n);
  const pad = Math.min(12, Math.max(1, Math.floor(padding)));
  // After clamp, n ≤ 99_999_999 — always safe integer; toString(10) never emits scientific notation.
  const digits = n <= Number.MAX_SAFE_INTEGER ? n.toString(10) : String(MAX_INVOICE_SEQUENCE);
  return digits.padStart(pad, '0');
}

/** Normalize a value that may have been stored as a number (float) by mistake — returns '' if unusable. */
export function normalizeInvoiceNumberString(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const raw = String(value);
    if (/e/i.test(raw)) return '';
    if (Math.abs(value) > MAX_INVOICE_SEQUENCE) return '';
    return String(Math.trunc(value));
  }
  const s = String(value).trim();
  if (!s) return '';
  if (/e[+-]/i.test(s)) return '';
  return s;
}

/** Format one invoice number from settings and a numeric sequence value (no Firestore). */
export function formatInvoiceNumber(settings: InvoiceNumberSettings, sequenceValue: number): string {
  let n = Math.floor(Number(sequenceValue));
  if (!Number.isFinite(n) || n < 1) n = 1;
  if (n > MAX_INVOICE_SEQUENCE) n = MAX_INVOICE_SEQUENCE;
  const pad = Math.min(12, Math.max(1, Math.floor(settings.padding)));
  const padded = formatSequenceDigitsPadded(n, pad);
  return `${settings.prefix}${padded}${settings.suffix}`;
}

export function isProvisionalInvoiceNumber(invoiceNumber: string): boolean {
  return /^PROV-/i.test(String(invoiceNumber || '').trim());
}

/**
 * Parse sequence using prefix + fixed-width digits + suffix (correct when suffix is numeric, e.g. HDI0001202627).
 */
export function parseStrictSequenceFromInvoiceNumber(
  invoiceNumber: string,
  settings: InvoiceNumberSettings
): number | null {
  const s = String(invoiceNumber || '').trim();
  if (!s || isProvisionalInvoiceNumber(s)) return null;
  const pad = Math.min(12, Math.max(1, Math.floor(settings.padding)));
  const pattern = new RegExp(
    `^${escapeRegex(settings.prefix)}(\\d{${pad}})${escapeRegex(settings.suffix)}$`
  );
  const m = s.match(pattern);
  if (!m) return null;
  const seq = Number.parseInt(m[1], 10);
  if (!Number.isFinite(seq) || seq < 1 || seq > MAX_INVOICE_SEQUENCE) return null;
  return seq;
}

/**
 * Parse the numeric sequence from a stored invoice number.
 * When `settings` is passed, only numbers that match prefix + padded digits + suffix are used
 * (avoids treating a numeric suffix like "202627" as the sequence).
 * Without settings, uses legacy "last digit run before /" (best-effort) with a sanity cap.
 */
export function parseSequencePartFromInvoiceNumber(
  invoiceNumber: string,
  settings?: InvoiceNumberSettings
): number | null {
  const s = String(invoiceNumber || '').trim();
  if (!s) return null;
  if (isProvisionalInvoiceNumber(s)) return null;

  if (settings) {
    const strict = parseStrictSequenceFromInvoiceNumber(s, settings);
    if (strict != null) return strict;
    return null;
  }

  const beforeSlash = s.split('/')[0] || s;
  const digitGroups = beforeSlash.match(/\d+/g);
  if (!digitGroups || digitGroups.length === 0) return null;
  const seqStr = digitGroups[digitGroups.length - 1];
  const seq = Number.parseInt(seqStr, 10);
  if (!Number.isFinite(seq) || seq < 1 || seq > MAX_INVOICE_SEQUENCE) return null;
  return seq;
}

/** Max sequence among invoice strings, or null if none parse. Pass `settings` for reliable parsing. */
export function maxSequenceFromInvoiceStrings(
  invoiceNumbers: string[],
  settings?: InvoiceNumberSettings
): number | null {
  let maxSeq: number | null = null;
  for (const inv of invoiceNumbers) {
    const seq = parseSequencePartFromInvoiceNumber(String(inv || '').trim(), settings);
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
    const next = maxSequenceFromRecentSales + 1;
    return Math.min(MAX_INVOICE_SEQUENCE, Math.max(1, next));
  }
  return Math.min(MAX_INVOICE_SEQUENCE, Math.max(1, settingsAtReconcile.next_number));
}

export function escapeRegex(s: string): string {
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
