/**
 * Normalizes enquiry visit sales return data: prefers salesReturnItems[], falls back to legacy returnSerialNumber.
 */
export function expandSalesReturnLinesFromVisit(visit: {
  salesReturnItems?: Array<{
    serialNumber?: string;
    model?: string;
    productName?: string;
    brand?: string;
    visitIndex?: number;
    invoiceNumber?: string;
  }>;
  returnSerialNumber?: string;
}): Array<{
  serialNumber: string;
  model?: string;
  productName?: string;
  brand?: string;
  visitIndex?: number;
  invoiceNumber?: string;
}> {
  const items = visit.salesReturnItems;
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((it) => ({
        serialNumber: String(it.serialNumber || '').trim(),
        model: it.model ? String(it.model).trim() : undefined,
        productName: it.productName,
        brand: it.brand,
        visitIndex: typeof it.visitIndex === 'number' ? it.visitIndex : undefined,
        invoiceNumber: it.invoiceNumber ? String(it.invoiceNumber).trim() : undefined,
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
