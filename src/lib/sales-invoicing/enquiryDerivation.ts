import { Timestamp } from 'firebase/firestore';
import type { DerivedEnquirySale } from './types';
import { toTimestamp, timestampToMs } from './timestamps';

export function deriveEnquirySalesFromDocs(docs: any[], source: 'visitor' | 'enquiry'): DerivedEnquirySale[] {
  const derived: DerivedEnquirySale[] = [];
  docs.forEach((rec: any) => {
    const name = rec.name || rec.patientName || rec.fullName || 'Unknown';
    const phone = rec.phone || rec.mobile || '';
    const address = rec.address || rec.location || '';
    const visits: any[] = Array.isArray(rec.visits) ? rec.visits : [];
    visits.forEach((visit: any, idx: number) => {
      const isSale = !!(
        visit?.hearingAidSale ||
        (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_sale')) ||
        visit?.journeyStage === 'sale' ||
        visit?.hearingAidStatus === 'sold' ||
        (Array.isArray(visit?.products) &&
          visit.products.length > 0 &&
          ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
      );
      if (!isSale) return;
      const prods: any[] = Array.isArray(visit.products) ? visit.products : [];
      const dateStr: string = visit.visitDate || visit.purchaseDate || visit.hearingAidPurchaseDate || '';
      const ts = dateStr ? Timestamp.fromDate(new Date(dateStr)) : toTimestamp(rec.updatedAt) || Timestamp.now();
      const totalAmount = prods.reduce((sum: number, p: any) => sum + (p.finalAmount || p.sellingPrice || 0), 0);
      const base: DerivedEnquirySale = {
        id: `${rec.id}-${idx}`,
        visitIndex: idx,
        patientName: name,
        visitDate: ts,
        products: prods,
        totalAmount,
        phone,
        address,
      };
      if (source === 'visitor') base.visitorId = rec.id;
      else base.enquiryId = rec.id;
      derived.push(base);
    });
  });
  derived.sort((a, b) => timestampToMs(b.visitDate) - timestampToMs(a.visitDate));
  return derived;
}
