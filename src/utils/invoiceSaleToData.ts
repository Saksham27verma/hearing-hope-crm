import type { InvoiceData } from '@/components/invoices/InvoiceTemplate';
import type { InvoiceConfig } from '@/utils/invoicePdfPreferences';
import {
  accessoryLinesTotal,
  visitAccessoryToSaleAccessories,
} from '@/lib/sales-invoicing/visitAccessoryInvoice';
import { isProvisionalInvoiceNumber, normalizeInvoiceNumberString } from '@/lib/invoice-numbering/core';

/** Non-empty and not a provisional (PROV-*) placeholder — required before accountant-facing PDFs. */
export function saleHasBillableInvoiceNumber(inv: unknown): boolean {
  const s = normalizeInvoiceNumberString(inv);
  return s.length > 0 && !isProvisionalInvoiceNumber(s);
}

/** Map enquiry + visit into the shape expected by `convertSaleToInvoiceData` / invoice PDF. */
export function enquiryVisitToInvoiceSalePayload(
  enquiry: Record<string, unknown>,
  visit: Record<string, unknown>
): Record<string, unknown> {
  const accessories = visitAccessoryToSaleAccessories(visit);
  const accessoryTotal = accessoryLinesTotal(accessories);
  const salesAfterTax = Number(visit?.salesAfterTax) || 0;
  const taxAmount = Number(visit?.taxAmount) || 0;
  /** Pre-tax hearing-aid subtotal (visit stores after-tax + tax separately). */
  const hearingAidPreTax = Math.max(0, salesAfterTax - taxAmount);
  const totalAmount = hearingAidPreTax + accessoryTotal;
  const grandTotal = salesAfterTax + accessoryTotal;
  const invoiceNumberFromRecord = normalizeInvoiceNumberString(
    visit?.invoiceNumber ?? visit?.salesInvoiceNumber ?? enquiry?.invoiceNumber ?? ''
  );
  const invoiceNumber = saleHasBillableInvoiceNumber(invoiceNumberFromRecord) ? invoiceNumberFromRecord : '';
  return {
    products: visit?.products || [],
    accessories,
    gstAmount: taxAmount,
    totalAmount,
    grandTotal,
    patientName: enquiry?.name || 'Patient',
    phone: enquiry?.phone || '',
    email: enquiry?.email || '',
    address: enquiry?.address || '',
    customerGstNumber:
      enquiry?.customerGstNumber || enquiry?.customerGSTIN || enquiry?.customerGSTNumber || '',
    saleDate: visit?.purchaseDate || visit?.visitDate || visit?.date || new Date().toISOString().slice(0, 10),
    invoiceNumber,
    notes: visit?.saleNotes || visit?.notes || '',
  };
}

function formatInvoiceDateLabel(value: unknown): string {
  if (value == null) return new Date().toLocaleDateString('en-IN');
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v?.toDate === 'function') return v.toDate().toLocaleDateString('en-IN');
  if (v?.seconds != null) return new Date(v.seconds * 1000).toLocaleDateString('en-IN');
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toLocaleDateString('en-IN') : d.toLocaleDateString('en-IN');
  }
  if (value instanceof Date) return value.toLocaleDateString('en-IN');
  return new Date().toLocaleDateString('en-IN');
}

const getDefaultTermsAndConditions = (): string => {
  return `1. Payment is due within 30 days of invoice date.
2. All sales are final unless otherwise specified.
3. Warranty terms apply as per manufacturer guidelines.
4. Please retain this invoice for warranty claims.
5. For any queries, please contact us within 7 days.`;
};

/** Map raw sale payload (enquiry visit / billing) into `InvoiceData` for HTML/React PDF. */
export const convertSaleToInvoiceData = (sale: Record<string, unknown>): InvoiceData => {
  const products = (sale.products as Record<string, unknown>[]) || [];
  const accessories = (sale.accessories as Record<string, unknown>[]) || [];

  const lineQty = (p: Record<string, unknown>) => {
    const q = Math.floor(Number(p.quantity) || 1);
    return !Number.isFinite(q) || q < 1 ? 1 : Math.min(9999, q);
  };

  const productSub =
    products.reduce((sum: number, product: Record<string, unknown>) => {
      const unit = Number(product.sellingPrice) || Number(product.finalAmount) || 0;
      return sum + Math.round(unit * lineQty(product));
    }, 0) || 0;

  const accessorySub = accessories.reduce((sum: number, a: Record<string, unknown>) => {
    if (a.isFree) return sum;
    const qty = lineQty(a);
    return sum + Math.round((Number(a.price) || 0) * qty);
  }, 0);

  const subtotal = productSub + accessorySub;

  const totalGST = Math.round(Number(sale.gstAmount) || 0);
  const totalDiscount =
    products.reduce((sum: number, product: Record<string, unknown>) => {
      const mrp = Number(product.mrp) || 0;
      const sellingPrice = Number(product.sellingPrice) || Number(product.finalAmount) || 0;
      const discount = (mrp - sellingPrice) * (Number(product.quantity) || 1);
      return sum + (discount > 0 ? discount : 0);
    }, 0) || 0;

  const computedGrand = Math.round(subtotal + totalGST);
  const grandTotal = Math.round(
    typeof sale.grandTotal === 'number' && !Number.isNaN(sale.grandTotal)
      ? sale.grandTotal
      : typeof sale.totalAmount === 'number' && !Number.isNaN(sale.totalAmount)
        ? Number(sale.totalAmount) + totalGST
        : computedGrand
  );

  const productRows =
    products.map((product: Record<string, unknown>, index: number) => {
      const qty = lineQty(product);
      const unitSp = Number(product.sellingPrice) || Number(product.finalAmount) || 0;
      const linePreTax = Math.round(unitSp * qty);
      const gstPct = Number(product.gstPercent) || Number(sale.gstPercentage) || 0;
      const gstExempt = product.gstApplicable === false;
      const unitGst = Number(product.gstAmount);
      const lineGst = gstExempt
        ? 0
        : Number.isFinite(unitGst)
          ? Math.round(unitGst * qty)
          : Math.round((linePreTax * gstPct) / 100);
      const unitFin = Number(product.finalAmount);
      const lineInclusive =
        Number.isFinite(unitFin) && unitFin > 0 ? Math.round(unitFin * qty) : linePreTax + lineGst;
      const typeOrCompany = String(product.type ?? product.company ?? '').trim();
      const warranty = String(product.warranty ?? '').trim();
      const description = warranty
        ? [typeOrCompany, `Warranty: ${warranty}`].filter(Boolean).join(' · ')
        : typeOrCompany;

      return {
        id: (product.id as string) || `item-${index}`,
        name: (product.name as string) || 'Unknown Product',
        description,
        serialNumber: (product.serialNumber as string) || '',
        quantity: qty,
        rate: unitSp,
        mrp: Number(product.mrp) || 0,
        discount: Number(product.discount) || 0,
        discountPercent:
          typeof product.discountPercent === 'number' && !Number.isNaN(product.discountPercent)
            ? product.discountPercent
            : undefined,
        gstPercent: gstPct,
        amount: linePreTax,
        taxLineAmount: lineGst,
        inclusiveLineAmount: lineInclusive,
      };
    }) || [];

  const accessoryRows = accessories.map((a: Record<string, unknown>, index: number) => {
    const qty = lineQty(a);
    const rate = a.isFree ? 0 : Number(a.price) || 0;
    const linePreTax = Math.round(rate * qty);
    return {
      id: (a.id as string) || `acc-${index}`,
      name: (a.name as string) || 'Accessory',
      description: 'Accessory',
      serialNumber: '',
      quantity: qty,
      rate,
      mrp: rate,
      discount: 0,
      gstPercent: 0,
      amount: linePreTax,
      taxLineAmount: 0,
      inclusiveLineAmount: linePreTax,
    };
  });

  const items = [...productRows, ...accessoryRows];

  const invoiceNumber = normalizeInvoiceNumberString(sale.invoiceNumber) || '—';
  const invoiceDate = formatInvoiceDateLabel(sale.saleDate);

  const refDoc = sale.referenceDoctor as { name?: string } | undefined;
  const salesDoc = sale.salesperson as { name?: string } | undefined;
  const customerGST =
    (sale.customerGstNumber as string) ||
    (sale.customerGSTIN as string) ||
    (sale.customerGSTNumber as string) ||
    (sale.customerGST as string) ||
    '';

  return {
    companyName: 'Hope Hearing Solutions',
    companyAddress: 'Your Company Address\nCity, State - PIN Code',
    companyPhone: '+91 XXXXX XXXXX',
    companyEmail: 'info@hopehearing.com',
    companyGST: 'GST Number Here',
    invoiceNumber,
    invoiceDate,
    customerName: (sale.patientName as string) || 'Walk-in Customer',
    customerAddress: (sale.address as string) || '',
    customerPhone: (sale.phone as string) || '',
    customerEmail: (sale.email as string) || '',
    customerGST,
    items,
    subtotal,
    totalDiscount: totalDiscount > 0 ? totalDiscount : undefined,
    totalGST: totalGST > 0 ? totalGST : undefined,
    grandTotal,
    referenceDoctor: refDoc?.name || '',
    salesperson: salesDoc?.name || '',
    branch: (sale.branch as string) || '',
    paymentMethod: (sale.paymentMethod as string) || '',
    notes: (sale.notes as string) || '',
    terms: getDefaultTermsAndConditions(),
  };
};

export function mergeInvoiceConfigIntoData(data: InvoiceData, config: InvoiceConfig): InvoiceData {
  const next = { ...data };
  if (config.companyName) next.companyName = config.companyName;
  if (config.companyAddress) next.companyAddress = config.companyAddress;
  if (config.companyPhone) next.companyPhone = config.companyPhone;
  if (config.companyEmail) next.companyEmail = config.companyEmail;
  if (config.companyGST !== undefined && config.companyGST !== '') next.companyGST = config.companyGST;
  if (config.customTerms && config.customTerms.trim()) next.terms = config.customTerms.trim();
  if (config.customFooter && config.customFooter.trim()) next.footerNote = config.customFooter.trim();
  return next;
}
