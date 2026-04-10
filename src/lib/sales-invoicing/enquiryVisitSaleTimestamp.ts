import { Timestamp } from 'firebase/firestore';

/**
 * Maps visit purchase/visit date strings to a Firestore Timestamp.
 * Supports YYYY-MM-DD from HTML date inputs and full ISO strings; avoids
 * concatenating "T00:00:00" onto values that already contain a time part.
 */
export function enquiryVisitSaleDateToTimestamp(saleDateRaw: unknown): Timestamp {
  if (saleDateRaw == null) return Timestamp.now();
  const raw = String(saleDateRaw).trim();
  if (!raw) return Timestamp.now();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00+05:30`);
    if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
    return Timestamp.now();
  }

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return Timestamp.fromDate(d);
  return Timestamp.now();
}
