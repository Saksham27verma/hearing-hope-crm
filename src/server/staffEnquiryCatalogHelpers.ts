import { v4 as uuidv4 } from 'uuid';
import type { DocumentData } from 'firebase-admin/firestore';

/** Minimal product shape from `products` — matches CRM enquiry catalog usage. */
export type CatalogProductDoc = {
  id: string;
  name: string;
  type: string;
  company: string;
  mrp?: number;
  isFreeOfCost?: boolean;
  gstApplicable?: boolean;
  gstType?: 'CGST' | 'IGST';
  gstPercentage?: number;
  hsnCode?: string;
  quantityType?: 'piece' | 'pair';
};

function lineQty(p: { quantity?: number }) {
  const q = Math.floor(Number(p.quantity));
  if (!Number.isFinite(q) || q < 1) return 1;
  return Math.min(9999, q);
}

/** Mirrors `applyCatalogHearingAidSelection` / first mapped line in SimplifiedEnquiryForm. */
export function buildCatalogHearingAidProductLine(args: {
  product: CatalogProductDoc;
  saleDateYmd: string;
  /** Per-unit MRP shown on visit (user may override catalog MRP). */
  mrpPerUnit: number;
  quantity: number;
}) {
  const { product, saleDateYmd } = args;
  const mrp = Math.round(Math.max(0, Number(args.mrpPerUnit) || 0));
  const discountPercent = 0;
  const discountAmount = 0;
  const sellingPrice = mrp;
  const gstPercent = effectiveGstPercentFromCatalogData(product as unknown as Record<string, unknown>);
  const gstAmount =
    gstPercent > 0 && product.gstApplicable !== false ? Math.round((sellingPrice * gstPercent) / 100) : 0;
  const finalAmount = sellingPrice + gstAmount;
  const qty = Math.max(1, Math.floor(Number(args.quantity) || 1));

  return {
    id: `${product.id}-${Date.now()}-${uuidv4().slice(0, 8)}`,
    inventoryId: '',
    productId: product.id,
    name: product.name,
    hsnCode: product.hsnCode || '',
    serialNumber: '',
    unit: 'piece' as const,
    quantity: qty,
    saleDate: saleDateYmd,
    mrp,
    dealerPrice: 0,
    sellingPrice,
    discountPercent,
    discountAmount,
    gstPercent,
    gstAmount,
    finalAmount,
    gstApplicable: product.gstApplicable !== false,
    gstType: product.gstType ?? ('IGST' as const),
    warranty: '',
    company: product.company || '',
    location: '',
  };
}

const roundInr = (n: number) => Math.round(Number(n) || 0);

/** Effective GST % for a `products` doc — 0 when exempt (`gstApplicable === false`), else catalog % or 18. */
export function effectiveGstPercentFromCatalogData(data: Record<string, unknown>): number {
  if (data.gstApplicable === false) return 0;
  const g = typeof data.gstPercentage === 'number' ? data.gstPercentage : Number(data.gstPercentage);
  if (Number.isFinite(g) && g >= 0) return g;
  return 18;
}

export function sumHearingAidVisitTotalsFromProducts(
  products: Array<{
    mrp: number;
    sellingPrice: number;
    gstAmount: number;
    finalAmount: number;
    quantity?: number;
  }>
) {
  const grossMRP = roundInr(products.reduce((sum, p) => sum + p.mrp * lineQty(p), 0));
  let grossSalesBeforeTax = roundInr(products.reduce((sum, p) => sum + p.sellingPrice * lineQty(p), 0));
  let taxAmount = roundInr(products.reduce((sum, p) => sum + p.gstAmount * lineQty(p), 0));
  let salesAfterTax = roundInr(products.reduce((sum, p) => sum + p.finalAmount * lineQty(p), 0));
  const prePlusTax = roundInr(grossSalesBeforeTax + taxAmount);
  if (prePlusTax !== salesAfterTax && Math.abs(salesAfterTax - prePlusTax) <= 1) {
    taxAmount = roundInr(salesAfterTax - grossSalesBeforeTax);
  }
  return { grossMRP, grossSalesBeforeTax, taxAmount, salesAfterTax };
}

export function docToCatalogProduct(id: string, data: DocumentData): CatalogProductDoc {
  const raw = data as Record<string, unknown>;
  const gstPct = effectiveGstPercentFromCatalogData(raw);
  return {
    id,
    name: String(data.name ?? ''),
    type: String(data.type ?? ''),
    company: String(data.company ?? ''),
    mrp: typeof data.mrp === 'number' ? data.mrp : Number(data.mrp) || 0,
    isFreeOfCost: !!data.isFreeOfCost,
    gstApplicable: data.gstApplicable !== false,
    gstType: data.gstType,
    gstPercentage: gstPct,
    hsnCode: data.hsnCode ? String(data.hsnCode) : '',
    quantityType: data.quantityType === 'pair' ? 'pair' : 'piece',
  };
}
