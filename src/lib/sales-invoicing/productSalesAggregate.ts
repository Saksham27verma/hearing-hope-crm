/**
 * Flatten invoiced sale product lines and aggregate by product for Top Products report.
 */

import type { NormalizedSale } from '@/lib/sales-invoicing/salesReportNormalize';
import { getProductLinesForUnifiedRow } from '@/lib/sales-invoicing/salesReportNormalize';
import type { UnifiedInvoiceRow } from '@/lib/sales-invoicing/types';

export const PRODUCT_SALE_TYPES = [
  'Hearing Aid',
  'Charger',
  'Battery',
  'Accessory',
  'Other',
] as const;

export type ProductCatalogEntry = {
  id: string;
  name?: string;
  type?: string;
  company?: string;
};

export type ProductSaleLine = {
  productKey: string;
  productId: string;
  productName: string;
  company: string;
  productType: string;
  quantity: number;
  /** Pre-GST selling revenue for the line (sellingPrice × qty). */
  revenue: number;
  saleDate: Date;
  centerKey: string;
  centerName: string;
  executiveName: string;
  patientName: string;
  invoiceNumber: string | null;
  enquiryId?: string;
  rowId: string;
  serialNumber: string;
};

export type ProductAggregate = {
  productKey: string;
  productId: string;
  productName: string;
  company: string;
  productType: string;
  unitsSold: number;
  invoiceCount: number;
  revenue: number;
  avgSellingPrice: number;
  lines: ProductSaleLine[];
};

function str(v: unknown): string {
  return v != null ? String(v).trim() : '';
}

function lineQuantity(p: Record<string, unknown>): number {
  const q = Math.floor(Number(p.quantity));
  if (!Number.isFinite(q) || q < 1) return 1;
  return Math.min(9999, q);
}

function lineUnitSelling(p: Record<string, unknown>): number {
  const n = Number(p.sellingPrice ?? p.finalAmount ?? p.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function productIdsFromLine(p: Record<string, unknown>): string[] {
  return [
    ...new Set(
      [p.productId, p.id, p.hearingAidProductId]
        .map((x) => str(x))
        .filter(Boolean),
    ),
  ];
}

function resolveProductType(
  line: Record<string, unknown>,
  productId: string,
  catalog: Map<string, ProductCatalogEntry>,
): string {
  const fromLine = str(line.type);
  if (fromLine) return fromLine;
  const meta = productId ? catalog.get(productId) : undefined;
  if (meta?.type) return str(meta.type) || 'Hearing Aid';
  // `sales.products[]` are primarily hearing-aid / device lines.
  return 'Hearing Aid';
}

function resolveCompany(
  line: Record<string, unknown>,
  productId: string,
  catalog: Map<string, ProductCatalogEntry>,
): string {
  const fromLine = str(line.company);
  if (fromLine) return fromLine;
  const meta = productId ? catalog.get(productId) : undefined;
  return str(meta?.company);
}

function productGroupKey(productId: string, name: string, company: string): string {
  if (productId) return `id:${productId}`;
  return `name:${name.toLowerCase()}|${company.toLowerCase()}`;
}

export function buildProductCatalogMap(
  products: ProductCatalogEntry[],
): Map<string, ProductCatalogEntry> {
  const m = new Map<string, ProductCatalogEntry>();
  for (const p of products) {
    if (p.id) m.set(p.id, p);
  }
  return m;
}

/**
 * Flatten product lines from normalized invoiced sales + unified rows.
 */
export function flattenProductSaleLines(
  records: NormalizedSale[],
  unifiedByRowId: Map<string, UnifiedInvoiceRow>,
  catalog: Map<string, ProductCatalogEntry>,
): ProductSaleLine[] {
  const out: ProductSaleLine[] = [];

  for (const rec of records) {
    const row = unifiedByRowId.get(rec.rowId);
    const products = getProductLinesForUnifiedRow(row);
    if (!products.length) continue;

    for (const raw of products) {
      const p = raw as Record<string, unknown>;
      const ids = productIdsFromLine(p);
      const productId = ids[0] || '';
      const productName =
        str(p.name) || str(p.model) || (productId ? catalog.get(productId)?.name : '') || 'Product';
      const company = resolveCompany(p, productId, catalog);
      const productType = resolveProductType(p, productId, catalog);
      const quantity = lineQuantity(p);
      const unitSelling = lineUnitSelling(p);
      const productKey = productGroupKey(productId, productName, company);

      out.push({
        productKey,
        productId,
        productName,
        company,
        productType,
        quantity,
        revenue: unitSelling * quantity,
        saleDate: rec.date,
        centerKey: rec.centerKey,
        centerName: rec.centerName,
        executiveName: rec.executiveName,
        patientName: rec.patientName,
        invoiceNumber: rec.invoiceNumber,
        enquiryId: rec.enquiryId,
        rowId: rec.rowId,
        serialNumber: str(p.serialNumber),
      });
    }
  }

  return out;
}

export type ProductLineFilters = {
  dateFrom?: Date | null;
  dateTo?: Date | null;
  centerKey?: string; // 'all' or specific
  executiveName?: string; // 'all' or specific
  company?: string; // 'all' or specific (case-insensitive match)
  productType?: string; // 'all' or specific; default callers use 'Hearing Aid'
};

function inRange(d: Date, from?: Date | null, to?: Date | null): boolean {
  const t = d.getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export function filterProductSaleLines(
  lines: ProductSaleLine[],
  filters: ProductLineFilters,
): ProductSaleLine[] {
  const center = filters.centerKey && filters.centerKey !== 'all' ? filters.centerKey : null;
  const exec =
    filters.executiveName && filters.executiveName !== 'all' ? filters.executiveName : null;
  const company =
    filters.company && filters.company !== 'all' ? filters.company.toLowerCase() : null;
  const type =
    filters.productType && filters.productType !== 'all' ? filters.productType : null;

  return lines.filter((line) => {
    if (!inRange(line.saleDate, filters.dateFrom, filters.dateTo)) return false;
    if (center && line.centerKey !== center) return false;
    if (exec && line.executiveName !== exec) return false;
    if (company && line.company.toLowerCase() !== company) return false;
    if (type && line.productType !== type) return false;
    return true;
  });
}

/** Aggregate filtered lines by product; sorted by units sold desc, then revenue desc. */
export function aggregateProductSales(lines: ProductSaleLine[]): ProductAggregate[] {
  const byKey = new Map<string, ProductAggregate>();
  const invoiceSets = new Map<string, Set<string>>();

  for (const line of lines) {
    let agg = byKey.get(line.productKey);
    if (!agg) {
      agg = {
        productKey: line.productKey,
        productId: line.productId,
        productName: line.productName,
        company: line.company,
        productType: line.productType,
        unitsSold: 0,
        invoiceCount: 0,
        revenue: 0,
        avgSellingPrice: 0,
        lines: [],
      };
      byKey.set(line.productKey, agg);
      invoiceSets.set(line.productKey, new Set());
    }

    agg.unitsSold += line.quantity;
    agg.revenue += line.revenue;
    agg.lines.push(line);
    if (!agg.company && line.company) agg.company = line.company;
    if (!agg.productId && line.productId) agg.productId = line.productId;

    const invKey = line.invoiceNumber || line.rowId;
    invoiceSets.get(line.productKey)!.add(invKey);
  }

  const result: ProductAggregate[] = [];
  byKey.forEach((agg, key) => {
    const invoices = invoiceSets.get(key);
    agg.invoiceCount = invoices?.size ?? 0;
    agg.avgSellingPrice = agg.unitsSold > 0 ? agg.revenue / agg.unitsSold : 0;
    agg.lines.sort((a, b) => b.saleDate.getTime() - a.saleDate.getTime());
    result.push(agg);
  });

  result.sort((a, b) => {
    if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
    return b.revenue - a.revenue;
  });

  return result;
}
