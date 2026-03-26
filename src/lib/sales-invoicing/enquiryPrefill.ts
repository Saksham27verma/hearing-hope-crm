import { Timestamp } from 'firebase/firestore';
import type { DerivedEnquirySale } from './types';

/** Map enquiry visit product lines into sale `products`-compatible rows (minimal catalog fields). */
export function mapVisitProductsToSaleProducts(products: any[]): any[] {
  return products.map((p: any, i: number) => {
    const selling = Math.round(Number(p.finalAmount ?? p.sellingPrice ?? 0));
    const mrp = Math.round(Number(p.mrp ?? selling));
    const gstPercent = Number(p.gstPercent ?? p.gstPercentage ?? 0);
    const gstAmount = Math.round((selling * gstPercent) / 100);
    return {
      id: p.id || `visit-line-${i}`,
      name: p.name || 'Item',
      type: p.type || '',
      company: p.company || '',
      mrp,
      dealerPrice: p.dealerPrice,
      quantityType: 'piece' as const,
      hasSerialNumber: false,
      gstApplicable: gstPercent > 0,
      gstPercentage: gstPercent,
      hsnCode: p.hsnCode,
      serialNumber: (p.serialNumber || '—').toString(),
      sellingPrice: selling,
      discount: Math.max(0, mrp - selling),
      discountPercent: mrp > 0 ? Math.round(((mrp - selling) / mrp) * 100) : 0,
      gstPercent,
      gstAmount,
      totalWithGst: selling + gstAmount,
    };
  });
}

export function prefillSaleFromDerivedEnquiry(
  d: DerivedEnquirySale,
  defaults: { invoiceNumber: string; salesperson: { id: string; name: string } }
) {
  const products = mapVisitProductsToSaleProducts(Array.isArray(d.products) ? d.products : []);
  const totalAmount = products.reduce((sum: number, p: any) => sum + (p.sellingPrice || 0), 0);
  const gstAmount = products.reduce((sum: number, p: any) => sum + (p.gstAmount || 0), 0);
  const grandTotal = totalAmount + gstAmount;
  return {
    invoiceNumber: defaults.invoiceNumber,
    patientName: d.patientName,
    phone: d.phone || '',
    email: '',
    address: d.address || '',
    products,
    accessories: [],
    referenceDoctor: { name: '' },
    salesperson: defaults.salesperson,
    totalAmount,
    gstAmount,
    gstPercentage: 0,
    grandTotal,
    netProfit: 0,
    branch: '',
    centerId: '',
    paymentMethod: 'cash',
    paymentStatus: 'paid' as const,
    notes: '',
    saleDate: d.visitDate || Timestamp.now(),
    source: 'enquiry' as const,
    enquiryId: d.enquiryId,
    visitorId: d.visitorId,
    enquiryVisitIndex: d.visitIndex,
    manualLineItems: [],
  };
}
