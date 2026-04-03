/**
 * Helpers for enquiry "pick from stock" — aligned with inventory page serial/qty handling.
 */

/** Composite key: productId + center id (Firestore `centers` doc id). */
export function makeProductLocationKey(productId: string, locationId: string): string {
  return `${String(productId).trim()}|${String(locationId).trim()}`;
}

export function splitProductLocationKey(key: string): { productId: string; locationId: string } {
  const i = key.indexOf('|');
  if (i < 0) return { productId: key, locationId: '' };
  return { productId: key.slice(0, i), locationId: key.slice(i + 1) };
}

/** Remove one serial from every location bucket for this product (sale does not carry center). */
export function subtractSerialFromLocationMap(
  serialsByProductLoc: Record<string, Set<string>>,
  productId: string,
  serial: string
): void {
  if (!productId || !serial) return;
  const prefix = `${productId}|`;
  for (const key of Object.keys(serialsByProductLoc)) {
    if (key.startsWith(prefix)) {
      serialsByProductLoc[key].delete(serial);
    }
  }
}

/** Spread qty reduction across location buckets for this product (order stable). */
export function subtractQtyFromLocationMap(
  qtyByProductLoc: Record<string, number>,
  productId: string,
  qty: number
): void {
  let remaining = Number(qty);
  if (!productId || !Number.isFinite(remaining) || remaining <= 0) return;
  const prefix = `${productId}|`;
  const keys = Object.keys(qtyByProductLoc)
    .filter((k) => k.startsWith(prefix))
    .sort();
  for (const key of keys) {
    if (remaining <= 0) break;
    const q = qtyByProductLoc[key] || 0;
    if (q <= 0) continue;
    const take = Math.min(q, remaining);
    qtyByProductLoc[key] = q - take;
    remaining -= take;
  }
}

/** Serials on one material-in / purchase / materials-out line (array or single field). */
export function serialsFromLineProduct(p: {
  serialNumbers?: unknown;
  serialNumber?: unknown;
  serialNo?: unknown;
  serial_no?: unknown;
}): string[] {
  const raw = p.serialNumbers;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((x) => String(x || '').trim()).filter(Boolean);
  }
  const one = p.serialNumber ?? p.serialNo ?? (p as { serial_no?: unknown }).serial_no;
  if (one != null && String(one).trim()) return [String(one).trim()];
  return [];
}

/** Serials sold on a sales line or enquiry product row (multiple possible fields). */
export function serialCandidatesFromSaleProduct(p: {
  serialNumbers?: unknown;
  serialNumber?: unknown;
  trialSerialNumber?: unknown;
}): string[] {
  const set = new Set<string>();
  serialsFromLineProduct(p).forEach((s) => set.add(s));
  [p.serialNumber, p.trialSerialNumber].forEach((v) => {
    if (v != null && String(v).trim()) set.add(String(v).trim());
  });
  return Array.from(set);
}

/** Mirrors inventory page logic for which enquiry visits consume stock. */
function visitIsHearingAidSale(visit: Record<string, unknown>): boolean {
  return !!(
    visit.hearingAidSale ||
    (Array.isArray(visit.medicalServices) &&
      (visit.medicalServices as string[]).includes('hearing_aid_sale')) ||
    visit.journeyStage === 'sale' ||
    visit.hearingAidStatus === 'sold' ||
    (Array.isArray(visit.products) &&
      visit.products.length > 0 &&
      ((Number(visit.salesAfterTax) || 0) > 0 || (Number(visit.grossSalesBeforeTax) || 0) > 0))
  );
}

/** Remove serials / qty already sold via `sales` docs (CRM sales collection). */
export function applySalesCollectionToAvailabilityMaps(
  salesDocs: Array<{ data: () => Record<string, unknown> }>,
  serialsByProductLoc: Record<string, Set<string>>,
  qtyByProductLoc: Record<string, number>
): void {
  for (const doc of salesDocs) {
    const data = doc.data() as Record<string, unknown>;
    const products = (Array.isArray(data.products) ? data.products : Array.isArray(data.items) ? data.items : []) as Record<
      string,
      unknown
    >[];
    for (const p of products) {
      const pid = String(p.productId || p.id || '').trim();
      if (!pid) continue;
      const sns = serialCandidatesFromSaleProduct(p as Parameters<typeof serialCandidatesFromSaleProduct>[0]);
      if (sns.length > 0) {
        sns.forEach((sn) => subtractSerialFromLocationMap(serialsByProductLoc, pid, sn));
      } else {
        const q = Number(p.quantity ?? 1) || 1;
        subtractQtyFromLocationMap(qtyByProductLoc, pid, q);
      }
    }
  }
}

/** Remove serials / qty sold from enquiry visit `products` (same idea as inventory page). */
export function applyEnquiryVisitsSalesToAvailabilityMaps(
  enquiryDocs: Array<{ data: () => Record<string, unknown> }>,
  serialsByProductLoc: Record<string, Set<string>>,
  qtyByProductLoc: Record<string, number>
): void {
  for (const doc of enquiryDocs) {
    const data = doc.data();
    const visits = Array.isArray(data.visits) ? (data.visits as Record<string, unknown>[]) : [];
    for (const visit of visits) {
      if (!visitIsHearingAidSale(visit)) continue;
      const products = (Array.isArray(visit.products) ? visit.products : []) as Record<string, unknown>[];
      for (const p of products) {
        const pid = String(p.productId || p.id || '').trim();
        if (!pid) continue;
        const sns = serialCandidatesFromSaleProduct(p as Parameters<typeof serialCandidatesFromSaleProduct>[0]);
        if (sns.length > 0) {
          sns.forEach((sn) => subtractSerialFromLocationMap(serialsByProductLoc, pid, sn));
        } else {
          const q = Number(p.quantity ?? 1) || 1;
          subtractQtyFromLocationMap(qtyByProductLoc, pid, q);
        }
      }
    }
  }
}
