import { Timestamp } from 'firebase/firestore';

/**
 * Parse a visit purchase/visit date (or a stored saleDate) into a real Date.
 * Supports YYYY-MM-DD (IST midnight), ISO strings, Date, and Firestore Timestamp shapes.
 * Returns null for empty/invalid values — never silently substitutes "now".
 */
export function parseEnquiryVisitSaleDate(saleDateRaw: unknown): Date | null {
  if (saleDateRaw == null) return null;

  if (saleDateRaw instanceof Date) {
    return Number.isNaN(saleDateRaw.getTime()) ? null : saleDateRaw;
  }

  if (typeof saleDateRaw === 'object') {
    const ts = saleDateRaw as {
      toDate?: () => Date;
      seconds?: number;
      nanoseconds?: number;
      _seconds?: number;
      _nanoseconds?: number;
    };
    if (typeof ts.toDate === 'function') {
      try {
        const d = ts.toDate();
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
      } catch {
        /* ignore */
      }
    }
    if (typeof ts.seconds === 'number' && Number.isFinite(ts.seconds)) {
      return new Date(ts.seconds * 1000);
    }
    if (typeof ts._seconds === 'number' && Number.isFinite(ts._seconds)) {
      return new Date(ts._seconds * 1000);
    }
    return null;
  }

  if (typeof saleDateRaw === 'number' && Number.isFinite(saleDateRaw)) {
    const d = new Date(saleDateRaw > 1e12 ? saleDateRaw : saleDateRaw * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = String(saleDateRaw).trim();
  if (!raw || raw === '[object Object]') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00+05:30`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Maps visit purchase/visit date strings to a Firestore Timestamp.
 * Supports YYYY-MM-DD from HTML date inputs and full ISO strings; avoids
 * concatenating "T00:00:00" onto values that already contain a time part.
 * Empty/invalid input falls back to now for callers that require a Timestamp.
 */
export function enquiryVisitSaleDateToTimestamp(saleDateRaw: unknown): Timestamp {
  const d = parseEnquiryVisitSaleDate(saleDateRaw);
  return d ? Timestamp.fromDate(d) : Timestamp.now();
}

/** Sales & Invoicing table/palette date — never returns "Invalid Date". */
export function formatSaleDateLabel(value: unknown, fallback = '—'): string {
  const d = parseEnquiryVisitSaleDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
