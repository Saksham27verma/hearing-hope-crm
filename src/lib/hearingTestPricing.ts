/**
 * Hearing test charges: optional per-row prices in `hearingTestDetails.hearingTestEntries`
 * (or root `hearingTestEntries` on draft visits), with aggregate `testPrice` for backward compatibility.
 */
export function sumHearingTestEntryPrices(visit: {
  hearingTestDetails?: {
    hearingTestEntries?: { price?: number; testPrice?: number }[];
    testPrice?: number;
  };
  hearingTestEntries?: { price?: number; testPrice?: number }[];
  testPrice?: number;
} | null | undefined): number {
  if (!visit) return 0;
  const raw =
    visit.hearingTestDetails?.hearingTestEntries ?? visit.hearingTestEntries;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.reduce(
      (s, e) => s + Math.max(0, Number(e?.price ?? e?.testPrice) || 0),
      0
    );
  }
  return Math.max(
    0,
    Number(visit.hearingTestDetails?.testPrice ?? visit.testPrice) || 0
  );
}
