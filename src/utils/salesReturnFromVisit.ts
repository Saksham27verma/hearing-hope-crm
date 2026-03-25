/**
 * Normalizes enquiry visit sales return data: prefers salesReturnItems[], falls back to legacy returnSerialNumber.
 */
export function expandSalesReturnLinesFromVisit(visit: {
  salesReturnItems?: Array<{
    serialNumber?: string;
    model?: string;
    productName?: string;
    brand?: string;
  }>;
  returnSerialNumber?: string;
}): Array<{ serialNumber: string; model?: string; productName?: string; brand?: string }> {
  const items = visit.salesReturnItems;
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((it) => ({
        serialNumber: String(it.serialNumber || '').trim(),
        model: it.model ? String(it.model).trim() : undefined,
        productName: it.productName,
        brand: it.brand,
      }))
      .filter((x) => x.serialNumber);
  }
  const legacy = String(visit.returnSerialNumber || '').trim();
  if (!legacy) return [];
  if (legacy.includes(',')) {
    return legacy
      .split(',')
      .map((s) => ({ serialNumber: s.trim() }))
      .filter((x) => x.serialNumber);
  }
  return [{ serialNumber: legacy }];
}
