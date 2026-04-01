/** Lines carried onto sales invoices / PDFs from enquiry visit accessory service. */

export type SaleAccessoryLine = {
  id: string;
  name: string;
  isFree: boolean;
  quantity: number;
  /** Per-unit amount (matches enquiry `accessoryAmount`). */
  price: number;
};

export function visitAccessoryToSaleAccessories(
  visit: Record<string, unknown> | null | undefined
): SaleAccessoryLine[] {
  if (!visit || !visit.accessory) return [];
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
