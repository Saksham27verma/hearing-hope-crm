import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';
import { allocateNextInvoiceNumberAdmin } from '@/server/allocateInvoiceNumber';
import { invoiceNumberMatchesSettings, normalizeInvoiceSettings } from '@/lib/invoice-numbering/core';

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
    const settingsSnap = await db.collection('invoiceSettings').doc('default').get();
    const invSettings = normalizeInvoiceSettings(
      settingsSnap.exists ? (settingsSnap.data() as Record<string, unknown>) : undefined
    );
    const enquiriesSnap = await db.collection('enquiries').get();
    let processedVisits = 0;
    let createdSales = 0;
    let updatedSales = 0;
    let allocatedInvoiceNumbers = 0;

    for (const enquiryDoc of enquiriesSnap.docs) {
      const data = enquiryDoc.data() as Record<string, unknown>;
      const visits = Array.isArray(data.visits) ? [...(data.visits as Record<string, unknown>[])] : [];
      let visitsChanged = false;

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

        let invoiceNumber = String(visit.invoiceNumber || '').trim();
        const needsInvoiceAlloc =
          !invoiceNumber ||
          /^PROV-/i.test(invoiceNumber) ||
          !invoiceNumberMatchesSettings(invoiceNumber, invSettings);
        if (needsInvoiceAlloc) {
          invoiceNumber = await allocateNextInvoiceNumberAdmin(db);
          visits[visitIndex] = { ...visit, invoiceNumber };
          visitsChanged = true;
          allocatedInvoiceNumbers++;
        }

        const saleDateRaw = String(visit.purchaseDate || visit.visitDate || '').trim();
        const saleDate = saleDateRaw
          ? Timestamp.fromDate(new Date(`${saleDateRaw}T00:00:00+05:30`))
          : Timestamp.now();
        const grossSalesBeforeTax = Number(visit.grossSalesBeforeTax) || 0;
        const gstAmount = Number(visit.taxAmount) || 0;
        const grandTotal = Number(visit.salesAfterTax) || grossSalesBeforeTax + gstAmount;

        const existingSaleSnap = await db
          .collection('sales')
          .where('enquiryId', '==', enquiryDoc.id)
          .where('enquiryVisitIndex', '==', visitIndex)
          .limit(1)
          .get();

        const payload = {
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
        };

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

      if (visitsChanged) {
        await db.collection('enquiries').doc(enquiryDoc.id).set(
          {
            visits,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      processedVisits,
      createdSales,
      updatedSales,
      allocatedInvoiceNumbers,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to resync enquiry sales';
    console.error('resync-enquiry-sales error:', err);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}

