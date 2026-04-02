import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeInvoiceNumberSettingsServer(raw: Record<string, unknown> | undefined) {
  const d = raw || {};
  const pad = typeof d.padding === 'number' && d.padding >= 1 ? Math.min(Math.floor(d.padding), 12) : 4;
  let next = typeof d.next_number === 'number' && Number.isFinite(d.next_number) ? Math.floor(d.next_number) : 1;
  if (next < 1) next = 1;
  return {
    prefix: typeof d.prefix === 'string' ? d.prefix : 'INV-',
    suffix: typeof d.suffix === 'string' ? d.suffix : `/${new Date().getFullYear()}`,
    next_number: next,
    padding: pad,
  };
}

function formatInvoiceNumberServer(
  settings: { prefix: string; suffix: string; padding: number },
  sequenceValue: number
): string {
  const n = Math.max(1, Math.floor(sequenceValue));
  return `${settings.prefix}${String(n).padStart(settings.padding, '0')}${settings.suffix}`;
}

async function allocateNextInvoiceNumberAdminServer(
  db: FirebaseFirestore.Firestore
): Promise<string> {
  const ref = db.collection('invoiceSettings').doc('default');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const settings = normalizeInvoiceNumberSettingsServer(
      snap.exists ? (snap.data() as Record<string, unknown>) : undefined
    );
    const n = settings.next_number;
    const formatted = formatInvoiceNumberServer(settings, n);
    tx.set(
      ref,
      {
        prefix: settings.prefix,
        suffix: settings.suffix,
        padding: settings.padding,
        next_number: n + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return formatted;
  });
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
        if (!invoiceNumber || /^PROV-/i.test(invoiceNumber)) {
          invoiceNumber = await allocateNextInvoiceNumberAdminServer(db);
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

