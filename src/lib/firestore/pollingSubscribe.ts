/**
 * Firestore JS SDK 11.x can throw internal WatchChangeAggregator assertions
 * ("Unexpected state" b815/ca9) when many onSnapshot listeners run alongside heavy traffic.
 * Prefer getDocs + interval for non-critical live UI where realtime is nice-to-have.
 */
export const DEFAULT_FIRESTORE_POLL_MS = 30_000;
