import type { InvoiceData } from '@/components/invoices/InvoiceTemplate';
import type { InvoiceConfig } from '@/utils/invoicePdfPreferences';
import {
  accessoryLinesTotal,
  visitAccessoryToSaleAccessories,
} from '@/lib/sales-invoicing/visitAccessoryInvoice';
import { isProvisionalInvoiceNumber } from '@/lib/invoice-numbering/core';

/** Non-empty and not a provisional (PROV-*) placeholder — required before accountant-facing PDFs. */
export function saleHasBillableInvoiceNumber(inv: unknown): boolean {
  const s = String(inv ?? '').trim();
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
  const invoiceNumberFromRecord = String(
    visit?.invoiceNumber || visit?.salesInvoiceNumber || enquiry?.invoiceNumber || ''
  ).trim();
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

  const productSub =
    products.reduce((sum: number, product: Record<string, unknown>) => {
      return sum + (Number(product.sellingPrice) || Number(product.finalAmount) || 0) * (Number(product.quantity) || 1);
    }, 0) || 0;

  const accessorySub = accessories.reduce((sum: number, a: Record<string, unknown>) => {
    if (a.isFree) return sum;
    return sum + (Number(a.price) || 0) * (Number(a.quantity) || 1);
  }, 0);

  const subtotal = productSub + accessorySub;

  const totalGST = Number(sale.gstAmount) || 0;
  const totalDiscount =
    products.reduce((sum: number, product: Record<string, unknown>) => {
      const mrp = Number(product.mrp) || 0;
      const sellingPrice = Number(product.sellingPrice) || Number(product.finalAmount) || 0;
      const discount = (mrp - sellingPrice) * (Number(product.quantity) || 1);
      return sum + (discount > 0 ? discount : 0);
    }, 0) || 0;

  const computedGrand = subtotal + totalGST;
  const grandTotal =
    typeof sale.grandTotal === 'number' && !Number.isNaN(sale.grandTotal)
      ? sale.grandTotal
      : typeof sale.totalAmount === 'number' && !Number.isNaN(sale.totalAmount)
        ? Number(sale.totalAmount) + totalGST
        : computedGrand;

  const productRows =
    products.map((product: Record<string, unknown>, index: number) => ({
      id: (product.id as string) || `item-${index}`,
      name: (product.name as string) || 'Unknown Product',
      description: (product.type as string) || '',
      serialNumber: (product.serialNumber as string) || '',
      quantity: Number(product.quantity) || 1,
      rate: Number(product.sellingPrice) || Number(product.finalAmount) || 0,
      mrp: Number(product.mrp) || 0,
      discount: Number(product.discount) || 0,
      gstPercent: Number(product.gstPercent) || Number(sale.gstPercentage) || 0,
      amount:
        (Number(product.sellingPrice) || Number(product.finalAmount) || 0) * (Number(product.quantity) || 1),
    })) || [];

  const accessoryRows = accessories.map((a: Record<string, unknown>, index: number) => {
    const qty = Number(a.quantity) || 1;
    const rate = a.isFree ? 0 : Number(a.price) || 0;
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
      amount: rate * qty,
    };
  });

  const items = [...productRows, ...accessoryRows];

  const invoiceNumber = (sale.invoiceNumber as string) || '—';
  const invoiceDate = formatInvoiceDateLabel(sale.saleDate);

  const refDoc = sale.referenceDoctor as { name?: string } | undefined;
  const salesDoc = sale.salesperson as { name?: string } | undefined;

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
