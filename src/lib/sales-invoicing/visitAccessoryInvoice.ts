/** Lines carried onto sales invoices / PDFs from enquiry visit accessory service. */

export type SaleAccessoryLine = {
  id: string;
  name: string;
  isFree: boolean;
  quantity: number;
  /** Per-unit amount (matches enquiry `accessoryAmount`). */
  price: number;
};

export type VisitAccessoryEntry = {
  id: string;
  accessoryName: string;
  accessorySerialNumber?: string;
  /** Row-level notes (visit-level notes live on `accessoryDetails` string field). */
  accessoryDetails?: string;
  accessoryFOC?: boolean;
  accessoryAmount?: number;
  accessoryQuantity?: number;
};

export function newAccessoryEntryId(): string {
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Multiple accessories per visit, or legacy single flat fields. */
export function normalizeAccessoryEntriesFromSavedVisit(
  visit: Record<string, unknown> | null | undefined
): VisitAccessoryEntry[] {
  if (!visit) return [];
  const ad = visit.accessoryDetails;
  const nested =
    typeof ad === 'object' && ad !== null && !Array.isArray(ad)
      ? (ad as Record<string, unknown>)
      : {};
  const raw = nested.accessoryEntries ?? visit.accessoryEntries;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((e: Record<string, unknown>, i: number) => ({
      id: String(e?.id || `acc-${i}-${newAccessoryEntryId()}`),
      accessoryName: String(e?.accessoryName ?? '').trim(),
      accessorySerialNumber: String(e?.accessorySerialNumber ?? '').trim(),
      accessoryDetails: String(e?.accessoryDetails ?? '').trim(),
      accessoryFOC: Boolean(e?.accessoryFOC),
      accessoryAmount: Math.max(0, Number(e?.accessoryAmount) || 0),
      accessoryQuantity: Math.max(1, Math.floor(Number(e?.accessoryQuantity) || 1)),
    }));
  }
  const name = String(nested.accessoryName ?? visit.accessoryName ?? '').trim();
  if (!name) return [];
  return [
    {
      id: newAccessoryEntryId(),
      accessoryName: name,
      accessorySerialNumber: String(
        nested.accessorySerialNumber ?? visit.accessorySerialNumber ?? ''
      ).trim(),
      accessoryDetails: String(
        nested.accessoryDetails ??
          (typeof visit.accessoryDetails === 'string' ? visit.accessoryDetails : '') ??
          ''
      ).trim(),
      accessoryFOC: Boolean(nested.accessoryFOC ?? visit.accessoryFOC),
      accessoryAmount: Math.max(0, Number(nested.accessoryAmount ?? visit.accessoryAmount) || 0),
      accessoryQuantity: Math.max(
        1,
        Math.floor(Number(nested.accessoryQuantity ?? visit.accessoryQuantity) || 1)
      ),
    },
  ];
}

export function sumAccessoryEntryPrices(
  visit: {
    /** Visit notes (form) or nested accessory payload (saved visit). */
    accessoryDetails?: unknown;
    accessoryEntries?: VisitAccessoryEntry[];
    accessoryAmount?: number;
    accessoryQuantity?: number;
    accessoryFOC?: boolean;
  } | null | undefined
): number {
  if (!visit) return 0;
  const nested =
    typeof visit.accessoryDetails === 'object' &&
    visit.accessoryDetails !== null &&
    !Array.isArray(visit.accessoryDetails)
      ? (visit.accessoryDetails as {
          accessoryEntries?: VisitAccessoryEntry[];
          accessoryAmount?: number;
          accessoryQuantity?: number;
          accessoryFOC?: boolean;
        })
      : undefined;
  const raw = visit.accessoryEntries ?? nested?.accessoryEntries;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.reduce((sum, e) => {
      if (e.accessoryFOC) return sum;
      const qty = Math.max(1, Number(e.accessoryQuantity) || 1);
      const unit = Math.max(0, Number(e.accessoryAmount) || 0);
      return sum + unit * qty;
    }, 0);
  }
  if (visit.accessoryFOC || nested?.accessoryFOC) return 0;
  const qty = Math.max(
    1,
    Number(nested?.accessoryQuantity ?? visit.accessoryQuantity) || 1
  );
  const unit = Math.max(0, Number(nested?.accessoryAmount ?? visit.accessoryAmount) || 0);
  return unit * qty;
}

/** Flat visit fields for legacy readers (comma-separated names, summed qty). */
export function syncAccessoryFlatFieldsFromEntries(entries: VisitAccessoryEntry[]): {
  accessoryName: string;
  accessorySerialNumber: string;
  accessoryFOC: boolean;
  accessoryAmount: number;
  accessoryQuantity: number;
} {
  const filtered = entries.filter((e) => String(e.accessoryName || '').trim());
  if (filtered.length === 0) {
    return {
      accessoryName: '',
      accessorySerialNumber: '',
      accessoryFOC: false,
      accessoryAmount: 0,
      accessoryQuantity: 1,
    };
  }
  return {
    accessoryName: filtered.map((e) => e.accessoryName).join(', '),
    accessorySerialNumber: filtered
      .map((e) => String(e.accessorySerialNumber || '').trim())
      .filter(Boolean)
      .join(', '),
    accessoryFOC: filtered.every((e) => Boolean(e.accessoryFOC)),
    accessoryAmount: Math.max(0, Number(filtered[0].accessoryAmount) || 0),
    accessoryQuantity: filtered.reduce(
      (s, e) => s + Math.max(1, Number(e.accessoryQuantity) || 1),
      0
    ),
  };
}

export function visitAccessoryToSaleAccessories(
  visit: Record<string, unknown> | null | undefined
): SaleAccessoryLine[] {
  if (!visit || !visit.accessory) return [];
  const entries = normalizeAccessoryEntriesFromSavedVisit(visit).filter((e) =>
    String(e.accessoryName || '').trim()
  );
  if (entries.length > 0) {
    return entries.map((e, i) => {
      const isFree = Boolean(e.accessoryFOC);
      const quantity = Math.max(1, Number(e.accessoryQuantity) || 1);
      const price = isFree ? 0 : Math.max(0, Number(e.accessoryAmount) || 0);
      return {
        id: String(e.id || `visit-accessory-${i}`),
        name: e.accessoryName,
        isFree,
        quantity,
        price,
      };
    });
  }
  const ad = (visit.accessoryDetails as Record<string, unknown> | undefined) || {};
  const name = String(ad.accessoryName ?? visit.accessoryName ?? '').trim();
  if (!name) return [];
  const quantity = Math.max(1, Number(ad.accessoryQuantity ?? visit.accessoryQuantity ?? 1) || 1);
  const isFree = !!(ad.accessoryFOC ?? visit.accessoryFOC);
  const price = isFree ? 0 : Math.max(0, Number(ad.accessoryAmount ?? visit.accessoryAmount ?? 0));
  return [{ id: 'visit-accessory', name, isFree, quantity, price }];
}

export function accessoryLinesTotal(lines: SaleAccessoryLine[]): number {
  return lines.reduce((sum, a) => sum + (a.isFree ? 0 : a.price * a.quantity), 0);
}
