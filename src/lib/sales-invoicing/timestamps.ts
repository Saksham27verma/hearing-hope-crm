import { Timestamp } from 'firebase/firestore';

export function toTimestamp(value: unknown): Timestamp | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  const v = value as { seconds?: number; _seconds?: number; toDate?: () => Date };
  if (typeof v.toDate === 'function') {
    try {
      return Timestamp.fromDate(v.toDate());
    } catch {
      return null;
    }
  }
  if (typeof v.seconds === 'number') {
    return new Timestamp(v.seconds, (v as { nanoseconds?: number }).nanoseconds || 0);
  }
  if (typeof v._seconds === 'number') {
    return new Timestamp(v._seconds, (v as { _nanoseconds?: number })._nanoseconds || 0);
  }
  return null;
}

export function timestampToMs(ts: Timestamp | null | undefined): number {
  if (!ts) return 0;
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const alt = ts as { _seconds?: number };
  if (typeof alt._seconds === 'number') return alt._seconds * 1000;
  return 0;
}
