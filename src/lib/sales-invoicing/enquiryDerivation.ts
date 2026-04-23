import { Timestamp } from 'firebase/firestore';
import type { DerivedEnquirySale } from './types';
import { toTimestamp, timestampToMs } from './timestamps';
import { accessoryLinesTotal, visitAccessoryToSaleAccessories } from '@/lib/sales-invoicing/visitAccessoryInvoice';

export function deriveEnquirySalesFromDocs(docs: any[], source: 'visitor' | 'enquiry'): DerivedEnquirySale[] {
  const derived: DerivedEnquirySale[] = [];
  docs.forEach((rec: any) => {
    const name = rec.name || rec.patientName || rec.fullName || 'Unknown';
    const phone = rec.phone || rec.mobile || '';
    const email = rec.email || '';
    const address = rec.address || rec.location || '';
    const customerGstNumber =
      rec.customerGstNumber || rec.customerGSTIN || rec.customerGSTNumber || rec.customerGST || rec.gstNumber || '';
    const visits: any[] = Array.isArray(rec.visits) ? rec.visits : [];
    visits.forEach((visit: any, idx: number) => {
      // Only treat as invoicable "sale" when the visit is explicitly marked as a sale.
      // This prevents "booking-only" visits (which can still carry amounts/products) from
      // being included as invoiced sales.
      const isSale = Boolean(
        visit?.hearingAidSale ||
          visit?.purchaseFromTrial ||
          visit?.hearingAidStatus === 'sold'
      );
      if (!isSale) return;
      const prods: any[] = Array.isArray(visit.products) ? visit.products : [];
      const accessories = visitAccessoryToSaleAccessories(visit as Record<string, unknown>);
      const accessoryTotal = accessoryLinesTotal(accessories);
      const dateStr: string = visit.visitDate || visit.purchaseDate || visit.hearingAidPurchaseDate || '';
      const ts = dateStr ? Timestamp.fromDate(new Date(dateStr)) : toTimestamp(rec.updatedAt) || Timestamp.now();
      const productTotal = prods.reduce((sum: number, p: any) => sum + (p.finalAmount || p.sellingPrice || 0), 0);
      const salesAfterTax = Number(visit.salesAfterTax);
      const taxAmount = Number(visit.taxAmount) || 0;
      const haAfterTax =
        Number.isFinite(salesAfterTax) && salesAfterTax > 0 ? salesAfterTax : productTotal;
      const totalAmount = haAfterTax + accessoryTotal;
      const invoiceGrandTotal = haAfterTax + accessoryTotal;
      const whoSoldName = String(
        visit?.hearingAidDetails?.whoSold ?? visit?.hearingAidBrand ?? '',
      ).trim();
      const base: DerivedEnquirySale = {
        id: `${rec.id}-${idx}`,
        visitIndex: idx,
        ...(whoSoldName ? { whoSoldName } : {}),
        patientName: name,
        visitDate: ts,
        products: prods,
        totalAmount,
        gstAmount: taxAmount,
        grandTotal: invoiceGrandTotal,
        ...(accessories.length > 0 ? { accessories } : {}),
        phone,
        email,
        address,
        ...(customerGstNumber ? { customerGstNumber } : {}),
      };
      if (source === 'visitor') base.visitorId = rec.id;
      else base.enquiryId = rec.id;
      derived.push(base);
    });
  });
  derived.sort((a, b) => timestampToMs(b.visitDate) - timestampToMs(a.visitDate));
  return derived;
}
