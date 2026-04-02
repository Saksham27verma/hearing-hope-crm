import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { adminDb } from '@/server/firebaseAdmin';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import { listAvailableHearingAidSerialRows } from '@/server/computeAvailableInventoryStock';
import { buildStaffCrmStyleReceiptPdfBuffer } from '@/server/staffCrmStyleReceiptPdf';
import {
  mergeStaffSubmissionIntoEnquiry,
  type StaffBookingDetails,
  type StaffSaleDetails,
  type StaffSaleProductLine,
  type StaffTrialDetails,
} from '@/server/staffEnquiryVisitMerge';
import { docToCatalogProduct, type CatalogProductDoc } from '@/server/staffEnquiryCatalogHelpers';
import { sendStaffPaymentNotifyEmail } from '@/server/sendStaffPaymentNotifyEmail';
import { getStaffPaymentNotifyEmailList } from '@/server/staffPaymentNotifyEmails';

/** HTML→PDF (Puppeteer) can exceed default limits on Vercel. */
export const maxDuration = 60;

/** Puppeteer / @sparticuz/chromium require Node (not Edge). */
export const runtime = 'nodejs';

const TZ = 'Asia/Kolkata';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

function jsonError(message: string, status: number) {
  return withCors(NextResponse.json({ ok: false, error: message }, { status }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function parseAppointmentStart(start: unknown): Date | null {
  if (start == null) return null;
  if (typeof start === 'string') {
    const d = new Date(start);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof start === 'object' && start !== null) {
    const o = start as { toDate?: () => Date; seconds?: number };
    if (typeof o.toDate === 'function') return o.toDate();
    if (typeof o.seconds === 'number') return new Date(o.seconds * 1000);
  }
  return null;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function buildSalesDocFromStaffInvoice(args: {
  enquiryId: string;
  enquiryData: Record<string, unknown>;
  visit: Record<string, unknown>;
  visitIndex: number;
  amountPaidNow: number;
  staffUid: string;
  staffName: string;
  paymentMethod: string;
}): Record<string, unknown> {
  const products = Array.isArray(args.visit.products) ? args.visit.products : [];
  const grossSalesBeforeTax = Number(args.visit.grossSalesBeforeTax) || 0;
  const gstAmount = Number(args.visit.taxAmount) || 0;
  const grandTotal = Number(args.visit.salesAfterTax) || grossSalesBeforeTax + gstAmount;
  const paymentStatus = args.amountPaidNow >= grandTotal ? 'paid' : 'pending';
  const visitDate = firstNonEmptyString(args.visit.purchaseDate, args.visit.visitDate);
  const saleDate = visitDate ? Timestamp.fromDate(new Date(`${visitDate}T00:00:00+05:30`)) : Timestamp.now();

  const accessoryName = firstNonEmptyString(args.visit.accessoryName, (args.visit.accessoryDetails as Record<string, unknown> | undefined)?.accessoryName);
  const accessoryQty = Math.max(
    1,
    Number(
      (args.visit.accessoryDetails as Record<string, unknown> | undefined)?.accessoryQuantity ??
        args.visit.accessoryQuantity ??
        1
    ) || 1
  );
  const accessoryFOC = Boolean(
    (args.visit.accessoryDetails as Record<string, unknown> | undefined)?.accessoryFOC ?? args.visit.accessoryFOC
  );
  const accessoryUnitAmount = accessoryFOC
    ? 0
    : Math.max(
        0,
        Number(
          (args.visit.accessoryDetails as Record<string, unknown> | undefined)?.accessoryAmount ??
            args.visit.accessoryAmount ??
            0
        ) || 0
      );
  const accessories =
    args.visit.accessory && accessoryName
      ? [
          {
            id: 'visit-accessory',
            name: accessoryName,
            isFree: accessoryFOC,
            quantity: accessoryQty,
            price: accessoryUnitAmount,
          },
        ]
      : [];

  return {
    invoiceNumber: firstNonEmptyString(args.visit.invoiceNumber),
    patientName: firstNonEmptyString(args.enquiryData.name, args.enquiryData.patientName, 'Patient'),
    phone: firstNonEmptyString(args.enquiryData.phone, args.enquiryData.mobile),
    email: firstNonEmptyString(args.enquiryData.email),
    address: firstNonEmptyString(args.enquiryData.address, args.enquiryData.location),
    products,
    accessories,
    manualLineItems: [],
    referenceDoctor: { name: '' },
    salesperson: {
      id: args.staffUid,
      name: args.staffName,
    },
    totalAmount: grossSalesBeforeTax + accessories.reduce((s: number, a: any) => s + (a.isFree ? 0 : a.price * a.quantity), 0),
    gstAmount,
    gstPercentage: 0,
    grandTotal,
    netProfit: 0,
    branch: '',
    centerId: firstNonEmptyString(args.visit.centerId, args.enquiryData.visitingCenter, (args.enquiryData as { center?: string }).center),
    paymentMethod: args.paymentMethod.toLowerCase(),
    paymentStatus,
    notes: `Generated from staff app invoice flow (visit ${firstNonEmptyString(args.visit.id)}).`,
    saleDate,
    source: 'enquiry',
    enquiryId: args.enquiryId,
    enquiryVisitIndex: args.visitIndex,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function isSameCalendarDayInKolkata(a: Date, b: Date): boolean {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(a) === fmt.format(b);
}

function isAppointmentTodayServer(start: unknown): boolean {
  const d = parseAppointmentStart(start);
  if (!d) return false;
  return isSameCalendarDayInKolkata(d, new Date());
}

function normalizeInvoiceNumberSettingsServer(raw: Record<string, unknown> | undefined): {
  prefix: string;
  suffix: string;
  next_number: number;
  padding: number;
} {
  const d = raw || {};
  const pad =
    typeof d.padding === 'number' && d.padding >= 1 ? Math.min(Math.floor(d.padding), 12) : 4;
  let next =
    typeof d.next_number === 'number' && Number.isFinite(d.next_number)
      ? Math.floor(d.next_number)
      : 1;
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

  // Reconcile outside the transaction to avoid doing query reads inside tx.
  const settingsSnap = await ref.get();
  const baseSettings = normalizeInvoiceNumberSettingsServer(
    settingsSnap.exists ? (settingsSnap.data() as Record<string, unknown>) : undefined
  );

  // Look at recent `sales` docs to find the highest allocated numeric sequence.
  let salesSnap;
  try {
    salesSnap = await db.collection('sales').orderBy('saleDate', 'desc').limit(50).get();
  } catch (e) {
    console.error('allocateNextInvoiceNumberAdminServer: sales reconcile query failed:', e);
    salesSnap = null;
  }
  let maxSeq: number | null = null;
  if (salesSnap) {
    for (const s of salesSnap.docs) {
      const inv = String((s.data() as Record<string, unknown>)?.invoiceNumber || '').trim();
      if (!inv || /^PROV-/i.test(inv)) continue;
      const beforeSlash = inv.split('/')[0] || inv;
      const digitGroups = beforeSlash.match(/\d+/g);
      if (!digitGroups || digitGroups.length === 0) continue;
      const seq = Number.parseInt(digitGroups[digitGroups.length - 1], 10);
      if (!Number.isFinite(seq) || seq < 1) continue;
      if (maxSeq == null || seq > maxSeq) maxSeq = seq;
    }
  }

  const desiredNext = typeof maxSeq === 'number' && Number.isFinite(maxSeq) ? maxSeq + 1 : baseSettings.next_number;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const settings = normalizeInvoiceNumberSettingsServer(
      snap.exists ? (snap.data() as Record<string, unknown>) : undefined
    );

    // Never allocate backwards. If another concurrent allocation already advanced the counter,
    // `settings.next_number` will be >= `desiredNext`.
    const n = Math.max(settings.next_number, desiredNext);
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

type ReceiptType = 'trial' | 'booking' | 'invoice';
const RECEIPT_TYPES: ReceiptType[] = ['trial', 'booking', 'invoice'];
const PAYMENT_MODES = ['cash', 'upi', 'card'] as const;

function mapReceiptTypeToPaymentType(receiptType: ReceiptType): string {
  switch (receiptType) {
    case 'booking':
      return 'hearing_aid_booking';
    case 'invoice':
      return 'hearing_aid_sale';
    case 'trial':
      return 'staff_trial_request';
    default:
      return 'staff_trial_request';
  }
}

/** Aligns with SimplifiedEnquiryForm `PaymentRecord.paymentFor` so the enquiry Payments section shows the row. */
function mapStaffReceiptToCrmPaymentFor(
  receiptType: ReceiptType,
  trial?: StaffTrialDetails
): 'booking_advance' | 'hearing_aid' | 'trial_home_security_deposit' | 'other' {
  if (receiptType === 'booking') return 'booking_advance';
  if (receiptType === 'invoice') return 'hearing_aid';
  if (receiptType === 'trial') {
    return trial?.trialLocationType === 'home' ? 'trial_home_security_deposit' : 'other';
  }
  return 'other';
}

function mapBodyPaymentModeToCrm(mode: string): 'Cash' | 'Card' | 'UPI' {
  const m = mode.toLowerCase();
  if (m === 'upi') return 'UPI';
  if (m === 'card') return 'Card';
  return 'Cash';
}

function parseWhichEar(raw: unknown): 'left' | 'right' | 'both' {
  const whichEarRaw = String(raw ?? 'both').toLowerCase();
  return whichEarRaw === 'left' || whichEarRaw === 'right' || whichEarRaw === 'both' ? whichEarRaw : 'both';
}

function parseBookingDetails(raw: unknown): (StaffBookingDetails & { catalogProductId: string }) | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const catalogProductId = String(o.catalogProductId ?? '').trim();
  const whichEar = parseWhichEar(o.whichEar);
  const hearingAidPrice = Number(o.hearingAidPrice);
  const bookingSellingPrice = Number(o.bookingSellingPrice);
  const bookingQuantity = Number(o.bookingQuantity);
  if (!catalogProductId) return null;
  if (!Number.isFinite(hearingAidPrice) || hearingAidPrice < 0) return null;
  if (!Number.isFinite(bookingSellingPrice) || bookingSellingPrice < 0) return null;
  if (!Number.isFinite(bookingQuantity) || bookingQuantity < 1) return null;
  return {
    catalogProductId,
    whichEar,
    hearingAidPrice,
    bookingSellingPrice,
    bookingQuantity: Math.floor(bookingQuantity),
  };
}

function parseTrialDetails(raw: unknown): (StaffTrialDetails & { catalogProductId: string }) | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const catalogProductId = String(o.catalogProductId ?? '').trim();
  const loc = String(o.trialLocationType ?? o.trialHearingAidType ?? '').trim().toLowerCase();
  const trialLocationType = loc === 'home' ? 'home' : loc === 'in_office' ? 'in_office' : null;
  const whichEar = parseWhichEar(o.whichEar);
  const hearingAidPrice = Number(o.hearingAidPrice);
  const trialDuration = Number(o.trialDuration);
  const trialStartDate = String(o.trialStartDate ?? '').trim();
  const trialEndDate = String(o.trialEndDate ?? '').trim();
  const trialSerialNumber = String(o.trialSerialNumber ?? '').trim();
  const trialNotes = String(o.trialNotes ?? '').trim();
  const trialHomeSecurityDepositAmount = Number(o.trialHomeSecurityDepositAmount ?? 0);

  if (!catalogProductId || !trialLocationType) return null;
  if (!Number.isFinite(hearingAidPrice) || hearingAidPrice < 0) return null;
  if (!Number.isFinite(trialHomeSecurityDepositAmount) || trialHomeSecurityDepositAmount < 0) return null;

  if (trialLocationType === 'home') {
    if (!Number.isFinite(trialDuration) || trialDuration < 1) return null;
    if (!trialStartDate || !trialEndDate) return null;
    if (!trialSerialNumber) return null;
  }

  return {
    catalogProductId,
    trialLocationType,
    whichEar,
    hearingAidPrice,
    trialDuration: trialLocationType === 'home' ? Math.floor(trialDuration) : 0,
    trialStartDate: trialLocationType === 'home' ? trialStartDate : '',
    trialEndDate: trialLocationType === 'home' ? trialEndDate : '',
    trialSerialNumber: trialLocationType === 'home' ? trialSerialNumber : '',
    trialHomeSecurityDepositAmount: trialLocationType === 'home' ? trialHomeSecurityDepositAmount : 0,
    trialNotes,
  };
}

function parseSaleDetails(raw: unknown): StaffSaleDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const inner = (o.sale ?? o.product) as Record<string, unknown> | undefined;
  const src = inner && typeof inner === 'object' ? inner : o;
  const productId = String(src.productId ?? '').trim();
  const name = String(src.name ?? '').trim();
  const serialNumber = String(src.serialNumber ?? '').trim();
  const company = String(src.company ?? '').trim();
  const mrp = Number(src.mrp);
  const sellingPrice = Number(src.sellingPrice);
  const discountPercent = Number(src.discountPercent);
  const gstPercent = Number(src.gstPercent);
  const quantity = Number(src.quantity);
  const whichEar = parseWhichEar(o.whichEar ?? src.whichEar);
  if (!productId || !name || !serialNumber) return null;
  if (!Number.isFinite(mrp) || mrp < 0) return null;
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) return null;
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return null;
  if (!Number.isFinite(gstPercent) || gstPercent < 0) return null;
  if (!Number.isFinite(quantity) || quantity < 1) return null;
  const product: StaffSaleProductLine = {
    productId,
    name,
    company,
    serialNumber,
    mrp,
    sellingPrice,
    discountPercent,
    gstPercent,
    quantity: Math.floor(quantity),
  };
  return { product, whichEar };
}

async function assertSerialAvailableForSale(productId: string, serialNumber: string): Promise<boolean> {
  const rows = await listAvailableHearingAidSerialRows();
  return rows.some((r) => r.productId === productId && r.serialNumber === serialNumber);
}

async function loadCatalogProduct(productId: string): Promise<CatalogProductDoc | null> {
  const db = adminDb();
  const snap = await db.collection('products').doc(productId).get();
  if (!snap.exists) return null;
  return docToCatalogProduct(snap.id, snap.data()!);
}

export async function POST(req: Request) {
  try {
    const { uid, staff } = await verifyStaffFromBearer(req);
    const staffName = ((staff.name as string) || 'Staff').trim();

    const body = await req.json().catch(() => null);
    const appointmentId = (body?.appointmentId ?? '').toString().trim();
    const amountRaw = body?.amount;
    const paymentMode = (body?.paymentMode ?? '').toString().trim().toLowerCase();
    const receiptType = (body?.receiptType ?? '').toString().trim().toLowerCase() as ReceiptType;
    const htmlTemplateIdFromClient = (body?.htmlTemplateId ?? body?.receiptHtmlTemplateId ?? '')
      .toString()
      .trim();

    if (!appointmentId) {
      return jsonError('appointmentId is required', 400);
    }

    const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonError('amount must be a positive number', 400);
    }

    if (!PAYMENT_MODES.includes(paymentMode as (typeof PAYMENT_MODES)[number])) {
      return jsonError('paymentMode must be cash, upi, or card', 400);
    }

    if (!RECEIPT_TYPES.includes(receiptType)) {
      return jsonError('receiptType must be trial, booking, or invoice', 400);
    }

    const db = adminDb();
    const apptRef = db.collection('appointments').doc(appointmentId);
    const apptSnap = await apptRef.get();
    if (!apptSnap.exists) {
      return jsonError('Appointment not found', 404);
    }

    const appt = apptSnap.data() as Record<string, unknown>;
    const type = appt.type as string | undefined;

    if (type === 'home') {
      if (appt.homeVisitorStaffId !== uid) {
        return jsonError('This appointment is not assigned to you', 403);
      }
    } else if (type === 'center') {
      if (appt.assignedStaffId !== uid) {
        return jsonError('This appointment is not assigned to you', 403);
      }
    } else {
      return jsonError('Invalid appointment type', 400);
    }

    const statusRaw = ((appt.status as string) || '').toLowerCase();
    if (statusRaw === 'completed' || statusRaw === 'cancelled') {
      return jsonError('Cannot log payment for completed or cancelled appointments', 400);
    }
    if (statusRaw && statusRaw !== 'scheduled') {
      return jsonError('Appointment must be scheduled', 400);
    }

    if (!isAppointmentTodayServer(appt.start)) {
      return jsonError('Appointment must be scheduled for today', 400);
    }

    const enquiryId = (appt.enquiryId as string | undefined)?.trim();
    if (!enquiryId) {
      return jsonError('Appointment has no linked enquiry', 400);
    }

    const enquiryRef = db.collection('enquiries').doc(enquiryId);
    const enquirySnap = await enquiryRef.get();
    if (!enquirySnap.exists) {
      return jsonError('Linked enquiry not found', 400);
    }

    const enquiryData = { id: enquirySnap.id, ...(enquirySnap.data() as Record<string, unknown>) };
    const details = body?.details;

    let booking: StaffBookingDetails | undefined;
    let bookingProduct: CatalogProductDoc | undefined;
    let trial: StaffTrialDetails | undefined;
    let trialProduct: CatalogProductDoc | undefined;
    let sale: StaffSaleDetails | undefined;
    let saleDeviceType: string | undefined;

    if (receiptType === 'booking') {
      const b = parseBookingDetails(details?.booking ?? details);
      if (!b) {
        return jsonError(
          'Missing or invalid booking details (catalogProductId, whichEar, MRP, selling price, quantity)',
          400
        );
      }
      const { catalogProductId, ...rest } = b;
      const p = await loadCatalogProduct(catalogProductId);
      if (!p) {
        return jsonError('Catalog product not found', 400);
      }
      booking = rest;
      bookingProduct = p;
    } else if (receiptType === 'trial') {
      const t = parseTrialDetails(details?.trial ?? details);
      if (!t) {
        return jsonError(
          'Missing or invalid trial details (catalogProductId, trialLocationType in_office|home, whichEar, MRP, home: duration/dates/serial/deposit)',
          400
        );
      }
      const { catalogProductId, ...rest } = t;
      const p = await loadCatalogProduct(catalogProductId);
      if (!p) {
        return jsonError('Catalog product not found', 400);
      }
      if (rest.trialLocationType === 'home') {
        const okSerial = await assertSerialAvailableForSale(catalogProductId, rest.trialSerialNumber);
        if (!okSerial) {
          return jsonError('Trial serial is not available in inventory', 400);
        }
      }
      trial = rest;
      trialProduct = p;
    } else {
      const s = parseSaleDetails(details?.sale ?? details?.product ?? details);
      if (!s) {
        return jsonError(
          'Missing or invalid sale details (product, whichEar, serial, MRP, selling price, discount %, GST %, quantity)',
          400
        );
      }
      const ok = await assertSerialAvailableForSale(s.product.productId, s.product.serialNumber);
      if (!ok) {
        return jsonError('Selected serial is not available in inventory (may already be sold or out)', 400);
      }
      const prodDoc = await loadCatalogProduct(s.product.productId);
      saleDeviceType = prodDoc?.type || '';
      sale = s;
    }

    const requestId = uuidv4();
    const paymentDate = new Date().toISOString();
    const paymentMethod =
      paymentMode === 'cash' ? 'Cash' : paymentMode === 'upi' ? 'UPI' : 'Card';

    const merged = mergeStaffSubmissionIntoEnquiry({
      enquiry: enquiryData,
      appointment: appt,
      appointmentId,
      receiptType,
      amount,
      booking,
      bookingProduct,
      trial,
      trialProduct,
      sale,
      whoSoldName: staffName,
      saleDeviceType,
    });

    if (receiptType === 'invoice') {
      const lastIdx = merged.visits.length - 1;
      if (lastIdx >= 0) {
        const lastVisit = (merged.visits[lastIdx] || {}) as Record<string, unknown>;
        const existingInvoiceNumber = String(lastVisit.invoiceNumber || '').trim();
        const isProvisionalExisting = /^PROV-/i.test(existingInvoiceNumber);
        if (!existingInvoiceNumber || isProvisionalExisting) {
          const allocatedInvoiceNumber = await allocateNextInvoiceNumberAdminServer(db);
          merged.visits[lastIdx] = { ...lastVisit, invoiceNumber: allocatedInvoiceNumber };
          if (merged.visitSchedules[lastIdx]) {
            merged.visitSchedules[lastIdx] = {
              ...merged.visitSchedules[lastIdx],
              invoiceNumber: allocatedInvoiceNumber,
            };
          }
        }
      }
    }

    const lastVisit = merged.visits[merged.visits.length - 1] as Record<string, unknown> | undefined;
    const relatedVisitId = String(lastVisit?.id ?? '').trim();

    const crmPaymentEntry = deepStripUndefined({
      id: requestId,
      paymentDate: paymentDate.slice(0, 10),
      amount,
      paymentFor: mapStaffReceiptToCrmPaymentFor(receiptType, trial),
      paymentMode: mapBodyPaymentModeToCrm(paymentMode),
      referenceNumber: appointmentId,
      remarks: `Staff app · ${receiptType} · visit ${relatedVisitId || '—'}`,
      ...(relatedVisitId ? { relatedVisitId } : {}),
    }) as Record<string, unknown>;

    const paymentRecord = {
      id: requestId,
      amount,
      paymentMethod,
      paymentDate,
      paymentType: mapReceiptTypeToPaymentType(receiptType),
      verificationStatus: 'pending' as const,
      source: 'staff_app',
      appointmentId,
      submittedByStaffId: uid,
      receiptCategory: receiptType,
      createdAt: Timestamp.now(),
      staffPayload: removeUndefined({
        booking,
        bookingProductId: bookingProduct?.id,
        trial,
        trialProductId: trialProduct?.id,
        sale,
        saleDeviceType,
      }),
    };

    await enquiryRef.update({
      visits: deepStripUndefined(merged.visits) as unknown[],
      visitSchedules: deepStripUndefined(merged.visitSchedules) as unknown[],
      financialSummary: deepStripUndefined(merged.financialSummary) as Record<string, unknown>,
      paymentRecords: FieldValue.arrayUnion(paymentRecord),
      payments: FieldValue.arrayUnion(crmPaymentEntry),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (receiptType === 'invoice') {
      const lastVisitIndex = merged.visits.length - 1;
      const lastVisit = (merged.visits[lastVisitIndex] || {}) as Record<string, unknown>;
      const existingSaleSnap = await db
        .collection('sales')
        .where('enquiryId', '==', enquiryId)
        .where('enquiryVisitIndex', '==', lastVisitIndex)
        .limit(1)
        .get();
      const allocatedInvoiceNumber = String(lastVisit.invoiceNumber || '').trim();
      if (existingSaleSnap.empty) {
        const saleDoc = buildSalesDocFromStaffInvoice({
          enquiryId,
          enquiryData,
          visit: lastVisit,
          visitIndex: lastVisitIndex,
          amountPaidNow: amount,
          staffUid: uid,
          staffName,
          paymentMethod,
        });
        await db.collection('sales').add(deepStripUndefined(saleDoc) as Record<string, unknown>);
      } else {
        // Ensure invoice numbering stays in sync even if a sales doc already exists (e.g. previously provisional).
        const saleId = existingSaleSnap.docs[0]?.id;
        if (saleId && allocatedInvoiceNumber) {
          await db.collection('sales').doc(saleId).set(
            {
              invoiceNumber: allocatedInvoiceNumber,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }
    }

    const patientName = ((appt.patientName as string) || (appt.title as string) || 'Patient').trim();
    const receiptLabel =
      receiptType === 'trial'
        ? 'Trial receipt request'
        : receiptType === 'booking'
          ? 'Booking receipt request'
          : 'Invoice request';

    const detailLines = buildPdfDetailLines(receiptType, {
      booking,
      bookingProduct,
      trial,
      trialProduct,
      sale,
      whoSoldName: staffName,
    });

    const { buffer: pdfBuffer, templateId: htmlTemplateIdUsed } = await buildStaffCrmStyleReceiptPdfBuffer({
      receiptType,
      enquiry: enquiryData,
      lastVisit: (merged.visits[merged.visits.length - 1] || {}) as Record<string, unknown>,
      enquiryId,
      paymentMethod,
      staffName,
      staffId: uid,
      requestId,
      htmlTemplateId: htmlTemplateIdFromClient || undefined,
      fallbackInput: {
        receiptLabel,
        patientName,
        amount,
        paymentMode: paymentMethod,
        receiptType,
        appointmentId,
        enquiryId,
        staffId: uid,
        staffName,
        createdAtIso: paymentDate,
        detailLines,
      },
    });

    if (htmlTemplateIdFromClient && htmlTemplateIdUsed && htmlTemplateIdFromClient !== htmlTemplateIdUsed) {
      console.warn(
        `collect-payment: client htmlTemplateId=${htmlTemplateIdFromClient} but PDF used templateId=${htmlTemplateIdUsed} (override missing/invalid — server fell back)`
      );
    }

    const notify = await getStaffPaymentNotifyEmailList();
    let emailSent = false;
    if (notify.length === 0) {
      console.warn(
        'collect-payment: no notify emails — set recipients in CRM Settings or STAFF_PAYMENT_NOTIFY_EMAILS; skipping email'
      );
    } else {
      try {
        await sendStaffPaymentNotifyEmail({
          to: notify,
          subject: `[Staff payment] ${receiptLabel} — ${patientName} (₹${amount}) · Generated by ${staffName}`,
          text: [
            `A staff member submitted a payment request.`,
            ``,
            `Generated by (employee): ${staffName} (${uid})`,
            ``,
            `Patient: ${patientName}`,
            `Amount: ₹${amount.toFixed(2)}`,
            `Mode: ${paymentMethod}`,
            `Type: ${receiptType}`,
            `Appointment: ${appointmentId}`,
            `Enquiry: ${enquiryId}`,
            `Staff: ${staffName} (${uid})`,
            ...(detailLines?.length ? ['', ...detailLines] : []),
            ``,
            `Verify in CRM and send the official document to the patient if approved.`,
          ].join('\n'),
          html: `<p><b>Generated by (employee):</b> ${escapeHtml(staffName)} <span style="color:#64748b">(${escapeHtml(uid)})</span></p>
<p>A staff member submitted a payment request.</p>
<ul>
<li><b>Patient:</b> ${escapeHtml(patientName)}</li>
<li><b>Amount:</b> ₹${amount.toFixed(2)}</li>
<li><b>Mode:</b> ${escapeHtml(paymentMethod)}</li>
<li><b>Type:</b> ${escapeHtml(receiptType)}</li>
<li><b>Appointment:</b> ${escapeHtml(appointmentId)}</li>
<li><b>Enquiry:</b> ${escapeHtml(enquiryId)}</li>
<li><b>Staff:</b> ${escapeHtml(staffName)} (${escapeHtml(uid)})</li>
</ul>
${detailLines?.length ? `<pre style="font-size:12px;white-space:pre-wrap">${escapeHtml(detailLines.join('\n'))}</pre>` : ''}
<p>PDF attached — same template family as CRM (Invoice Manager). Verify in CRM before sending to the patient if required.</p>`,
          pdfBuffer,
          pdfFileName: `staff-payment-${appointmentId}-${requestId.slice(0, 8)}.pdf`,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('collect-payment: email failed', mailErr);
        const emailError = mailErr instanceof Error ? mailErr.message : 'Email failed';
        return withCors(
          NextResponse.json(
            {
              ok: true,
              enquiryUpdated: true,
              emailSent: false,
              emailError,
              htmlTemplateIdUsed: htmlTemplateIdUsed ?? null,
              warning:
                'Payment recorded but email to admins failed. Fix SMTP on the server or use Settings → Send test email to see the error.',
            },
            { status: 200 }
          )
        );
      }
    }

    return withCors(
      NextResponse.json({
        ok: true,
        enquiryUpdated: true,
        emailSent,
        requestId,
        htmlTemplateIdUsed: htmlTemplateIdUsed ?? null,
      })
    );
  } catch (err: unknown) {
    if (err instanceof StaffAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('collect-payment error:', err);
    const message = err instanceof Error ? err.message : 'Failed to process payment request';
    return jsonError(message, 500);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

/** Firestore does not allow undefined anywhere in field values. */
function deepStripUndefined(x: unknown): unknown {
  if (x === undefined) return undefined;
  if (x === null || typeof x !== 'object') return x;
  if (x instanceof Timestamp) return x;
  if (Array.isArray(x)) {
    return x.map((i) => deepStripUndefined(i)).filter((i) => i !== undefined);
  }
  const o = x as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) {
    const v = deepStripUndefined(o[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function buildPdfDetailLines(
  receiptType: ReceiptType,
  args: {
    booking?: StaffBookingDetails;
    bookingProduct?: CatalogProductDoc;
    trial?: StaffTrialDetails;
    trialProduct?: CatalogProductDoc;
    sale?: StaffSaleDetails;
    whoSoldName: string;
  }
): string[] {
  if (receiptType === 'booking' && args.booking && args.bookingProduct) {
    const b = args.booking;
    const p = args.bookingProduct;
    return [
      `Catalog: ${p.company} ${p.name} (${p.type})`,
      `Ear: ${b.whichEar}`,
      `MRP (per unit): ₹${b.hearingAidPrice}`,
      `Selling price (per unit): ₹${b.bookingSellingPrice}`,
      `Quantity: ${b.bookingQuantity}`,
    ];
  }
  if (receiptType === 'trial' && args.trial && args.trialProduct) {
    const t = args.trial;
    const p = args.trialProduct;
    const loc = t.trialLocationType === 'home' ? 'Home trial' : 'In-office trial';
    return [
      `Trial type: ${loc}`,
      `Device: ${p.company} ${p.name} (${p.type})`,
      `Ear: ${t.whichEar}`,
      `MRP (per unit): ₹${t.hearingAidPrice}`,
      t.trialLocationType === 'home' ? `Serial: ${t.trialSerialNumber}` : 'Serial: —',
      t.trialLocationType === 'home'
        ? `Period: ${t.trialStartDate} → ${t.trialEndDate} (${t.trialDuration} days)`
        : '',
      `Security deposit (recorded): ₹${t.trialHomeSecurityDepositAmount}`,
      t.trialNotes ? `Notes: ${t.trialNotes}` : '',
    ].filter(Boolean);
  }
  if (receiptType === 'invoice' && args.sale) {
    const p = args.sale.product;
    return [
      `Which ear: ${args.sale.whichEar}`,
      `Who sold (CRM field): ${args.whoSoldName}`,
      `Product: ${p.name}`,
      `Company: ${p.company || '—'}`,
      `Serial: ${p.serialNumber}`,
      `MRP: ₹${p.mrp}`,
      `Selling: ₹${p.sellingPrice}`,
      `Discount %: ${p.discountPercent}`,
      `GST %: ${p.gstPercent}`,
      `Qty: ${p.quantity}`,
    ];
  }
  return [];
}
