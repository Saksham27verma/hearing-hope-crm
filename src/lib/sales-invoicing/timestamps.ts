import { Timestamp } from 'firebase/firestore';

export function toTimestamp(value: unknown): Timestamp | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  const v = value as { seconds?: number; toDate?: () => Date };
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
  return null;
}

export function timestampToMs(ts: Timestamp | null | undefined): number {
  if (!ts || typeof ts.seconds !== 'number') return 0;
  return ts.seconds * 1000;
}
