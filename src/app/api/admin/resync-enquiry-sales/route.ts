import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';
import { saleHasBillableInvoiceNumber } from '@/utils/invoiceSaleToData';
import { collectSaleVisitIndicesVoidedByReturns } from '@/lib/enquiries/salesReturnVisitTargets';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);
    const decoded = await adminAuth().verifyIdToken(match[1]);
    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const db = adminDb();
    const enquiriesSnap = await db.collection('enquiries').get();
    let processedVisits = 0;
    let createdSales = 0;
    let updatedSales = 0;

    for (const enquiryDoc of enquiriesSnap.docs) {
      const data = enquiryDoc.data() as Record<string, unknown>;
      const visits = Array.isArray(data.visits) ? [...(data.visits as Record<string, unknown>[])] : [];
      const voidTargets = new Set(collectSaleVisitIndicesVoidedByReturns(visits));

      for (let visitIndex = 0; visitIndex < visits.length; visitIndex++) {
        const visit = visits[visitIndex] || {};
        const products = Array.isArray(visit.products) ? visit.products : [];
        // Only treat as invoicable "sale" when the visit is explicitly marked as a sale.
        // This prevents "booking-only" visits from being mirrored into `sales` and getting invoice numbers.
        const isSale = Boolean(
          visit?.hearingAidSale || visit?.purchaseFromTrial || visit?.hearingAidStatus === 'sold'
        );
        if (!isSale) continue;
        processedVisits++;

        const visitInvoiceNumber = String(visit.invoiceNumber || '').trim();

        const saleDateRaw = String(visit.purchaseDate || visit.visitDate || '').trim();
        const saleDate = saleDateRaw
          ? Timestamp.fromDate(new Date(`${saleDateRaw}T00:00:00+05:30`))
          : Timestamp.now();
        const grossSalesBeforeTax = Number(visit.grossSalesBeforeTax) || 0;
        const gstAmount = Number(visit.taxAmount) || 0;
        const baseGrand = Number(visit.salesAfterTax) || grossSalesBeforeTax + gstAmount;
        const v = visit as Record<string, unknown>;
        const exchangeCredit = Math.min(
          Math.max(0, Number(v.exchangeCreditAmount) || 0),
          baseGrand
        );
        const grandTotal = Math.round(baseGrand - exchangeCredit);
        const exPriorRaw = v.exchangePriorVisitIndex;
        const exPrior =
          exPriorRaw === '' || exPriorRaw == null
            ? undefined
            : Number(exPriorRaw);

        const existingSaleSnap = await db
          .collection('sales')
          .where('enquiryId', '==', enquiryDoc.id)
          .where('enquiryVisitIndex', '==', visitIndex)
          .limit(1)
          .get();
        const existingSalesInvoice = existingSaleSnap.empty
          ? ''
          : String(existingSaleSnap.docs[0].data()?.invoiceNumber || '').trim();
        const invoiceNumber = saleHasBillableInvoiceNumber(visitInvoiceNumber)
          ? visitInvoiceNumber
          : saleHasBillableInvoiceNumber(existingSalesInvoice)
            ? existingSalesInvoice
            : '';

        const payload: Record<string, unknown> = {
          invoiceNumber,
          patientName: String(data.name || data.patientName || 'Patient'),
          phone: String(data.phone || data.mobile || ''),
          email: String(data.email || ''),
          address: String(data.address || data.location || ''),
          products,
          accessories: [],
          manualLineItems: [],
          referenceDoctor: { name: '' },
          salesperson: { id: '', name: '' },
          totalAmount: grossSalesBeforeTax,
          gstAmount,
          gstPercentage: 0,
          grandTotal,
          netProfit: 0,
          branch: '',
          centerId: String(visit.centerId || data.visitingCenter || data.center || ''),
          paymentMethod: 'cash',
          paymentStatus: 'pending',
          notes: String(visit.visitNotes || ''),
          saleDate,
          source: 'enquiry',
          enquiryId: enquiryDoc.id,
          enquiryVisitIndex: visitIndex,
          updatedAt: FieldValue.serverTimestamp(),
          ...(exchangeCredit > 0 ? { exchangeCreditInr: exchangeCredit } : {}),
          ...(typeof exPrior === 'number' && !Number.isNaN(exPrior) && exPrior >= 0
            ? { exchangePriorVisitIndex: exPrior }
            : {}),
        };

        if (voidTargets.has(visitIndex)) {
          payload.cancelled = true;
          payload.cancelReason = 'Sales return (admin sync)';
          payload.cancelledAt = FieldValue.serverTimestamp();
        }

        if (existingSaleSnap.empty) {
          await db.collection('sales').add({
            ...payload,
            createdAt: FieldValue.serverTimestamp(),
          });
          createdSales++;
        } else {
          await db.collection('sales').doc(existingSaleSnap.docs[0].id).set(payload, { merge: true });
          updatedSales++;
        }
      }

    }

    return NextResponse.json({
      ok: true,
      processedVisits,
      createdSales,
      updatedSales,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resync enquiry sales';
    console.error('resync-enquiry-sales error:', err);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}

