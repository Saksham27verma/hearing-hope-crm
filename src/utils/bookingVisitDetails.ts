/**
 * Resolve booking quantity, per-unit selling, and booking total from enquiry visits.
 * Matches the enquiry form: "Selling price (per unit)" × Quantity = "Booking Total".
 *
 * Do not use catalog product line sellingPrice for bookings — it defaults to MRP and
 * is unrelated to the user-entered bookingSellingPrice field.
 */

function hearingAidLineQty(p: { quantity?: number }): number {
  const q = Math.floor(Number(p.quantity));
  if (!Number.isFinite(q) || q < 1) return 1;
  return Math.min(9999, q);
}

function sumProductLineQty(products: unknown[]): number {
  if (!Array.isArray(products) || products.length === 0) return 0;
  return products.reduce((sum, p) => {
    if (!p || typeof p !== 'object') return sum;
    return sum + hearingAidLineQty(p as { quantity?: number });
  }, 0);
}

function getHearingAidDetails(visit: Record<string, unknown>): Record<string, unknown> {
  return visit.hearingAidDetails && typeof visit.hearingAidDetails === 'object'
    ? (visit.hearingAidDetails as Record<string, unknown>)
    : {};
}

/** User-entered selling price per unit (visit root or hearingAidDetails). */
export function resolveBookingUnitSellingPrice(visit: Record<string, unknown>): number {
  const ha = getHearingAidDetails(visit);
  const explicit =
    Number(visit.bookingSellingPrice) || Number(ha.bookingSellingPrice) || 0;
  if (explicit > 0) return explicit;
  return 0;
}

/** Booking quantity: explicit fields, product line sum, or the greater of both when both exist. */
export function resolveBookingQuantity(visit: Record<string, unknown>): number {
  const ha = getHearingAidDetails(visit);

  const explicitCandidates = [
    Math.floor(Number(visit.bookingQuantity)),
    Math.floor(Number(ha.bookingQuantity)),
  ].filter((n) => Number.isFinite(n) && n >= 1);
  const explicitQty = explicitCandidates.length ? Math.max(...explicitCandidates) : 0;

  const products = Array.isArray(visit.products)
    ? visit.products
    : Array.isArray(ha.products)
      ? ha.products
      : [];
  const fromProducts = sumProductLineQty(products);

  if (explicitQty >= 1 && fromProducts >= 1) return Math.max(explicitQty, fromProducts);
  if (explicitQty >= 1) return explicitQty;
  if (fromProducts >= 1) return fromProducts;
  return 1;
}

/** Booking total = selling price (per unit) × quantity — same as enquiry form "Booking Total". */
export function resolveBookingTotal(visit: Record<string, unknown>): number {
  const qty = resolveBookingQuantity(visit);
  const unitSelling = resolveBookingUnitSellingPrice(visit);
  if (unitSelling > 0 && qty > 0) return unitSelling * qty;
  return 0;
}

export type BookingVisitCommercials = {
  bookingDate: string;
  brand: string;
  model: string;
  unitMrp: number;
  bookingQty: number;
  unitSelling: number;
  bookingTotal: number;
  bookingAdvance: number;
};

/** Full booking commercial fields for reports (device labels + money). */
export function extractBookingVisitCommercials(visit: Record<string, unknown>): BookingVisitCommercials {
  const ha = getHearingAidDetails(visit);
  const products = (Array.isArray(visit.products) ? visit.products : []) as Array<
    Record<string, unknown>
  >;
  const first = products[0];

  const bookingQty = resolveBookingQuantity(visit);
  const unitSelling = resolveBookingUnitSellingPrice(visit);
  const bookingTotal = resolveBookingTotal(visit);

  const model =
    String(visit.hearingAidModel || ha.quotation || first?.name || '').trim() || '—';
  const brand = String(visit.hearingAidBrand || ha.whoSold || first?.company || '').trim() || '—';
  const bookingDate = String(
    visit.bookingDate || ha.bookingDate || visit.visitDate || '',
  ).trim();
  const bookingAdvance =
    Number(visit.bookingAdvanceAmount ?? ha.bookingAdvanceAmount ?? 0) || 0;

  const unitMrpRaw = Number(
    visit.hearingAidPrice ?? ha.bookingAmount ?? first?.mrp ?? visit.bookingMRP ?? ha.bookingMRP ?? 0,
  );
  const grossMrp = Number(visit.grossMRP ?? ha.grossMRP ?? 0);
  const unitMrp =
    unitMrpRaw ||
    (bookingQty > 0 && grossMrp > 0 ? grossMrp / bookingQty : grossMrp > 0 ? grossMrp : 0);

  return {
    bookingDate: bookingDate || '—',
    brand,
    model,
    unitMrp,
    bookingQty,
    unitSelling,
    bookingTotal,
    bookingAdvance,
  };
}
