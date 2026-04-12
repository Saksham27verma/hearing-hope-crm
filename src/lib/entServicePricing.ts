/**
 * ENT clinic charges: per-row prices in `entServiceDetails.entProcedureEntries`
 * (or root `entProcedureEntries` on draft visits), with aggregate `entServicePrice` for compatibility.
 */
export function sumEntProcedurePrices(visit: {
  entServiceDetails?: {
    entProcedureEntries?: { price?: number; procedurePrice?: number }[];
    totalPrice?: number;
  };
  entProcedureEntries?: { price?: number; procedurePrice?: number }[];
  entServicePrice?: number;
} | null | undefined): number {
  if (!visit) return 0;
  const raw =
    visit.entServiceDetails?.entProcedureEntries ?? visit.entProcedureEntries;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.reduce(
      (s, e) => s + Math.max(0, Number(e?.price ?? e?.procedurePrice) || 0),
      0
    );
  }
  return Math.max(
    0,
    Number(visit.entServiceDetails?.totalPrice ?? visit.entServicePrice) || 0
  );
}
