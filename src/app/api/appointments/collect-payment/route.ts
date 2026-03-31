import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { adminDb } from '@/server/firebaseAdmin';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import { listAvailableHearingAidSerialRows } from '@/server/computeAvailableInventoryStock';
import { buildStaffPaymentReceiptPdfBuffer } from '@/server/staffPaymentReceiptPdf';
import {
  mergeStaffSubmissionIntoEnquiry,
  type StaffBookingDetails,
  type StaffSaleProductLine,
  type StaffTrialDetails,
} from '@/server/staffEnquiryVisitMerge';
import {
  parseNotifyEmails,
  sendStaffPaymentNotifyEmail,
} from '@/server/sendStaffPaymentNotifyEmail';

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

function parseBookingDetails(raw: unknown): StaffBookingDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const hearingAidBrand = String(o.hearingAidBrand ?? '').trim();
  const hearingAidModel = String(o.hearingAidModel ?? '').trim();
  const hearingAidType = String(o.hearingAidType ?? '').trim();
  const whichEarRaw = String(o.whichEar ?? 'both').toLowerCase();
  const whichEar =
    whichEarRaw === 'left' || whichEarRaw === 'right' || whichEarRaw === 'both' ? whichEarRaw : 'both';
  const hearingAidPrice = Number(o.hearingAidPrice);
  const bookingSellingPrice = Number(o.bookingSellingPrice);
  const bookingQuantity = Number(o.bookingQuantity);
  if (!hearingAidBrand || !hearingAidModel || !hearingAidType) return null;
  if (!Number.isFinite(hearingAidPrice) || hearingAidPrice < 0) return null;
  if (!Number.isFinite(bookingSellingPrice) || bookingSellingPrice < 0) return null;
  if (!Number.isFinite(bookingQuantity) || bookingQuantity < 1) return null;
  return {
    hearingAidBrand,
    hearingAidModel,
    hearingAidType,
    whichEar,
    hearingAidPrice,
    bookingSellingPrice,
    bookingQuantity: Math.floor(bookingQuantity),
  };
}

function parseTrialDetails(raw: unknown): StaffTrialDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const trialHearingAidBrand = String(o.trialHearingAidBrand ?? '').trim();
  const trialHearingAidModel = String(o.trialHearingAidModel ?? '').trim();
  const trialHearingAidType = String(o.trialHearingAidType ?? '').trim();
  const trialSerialNumber = String(o.trialSerialNumber ?? '').trim();
  const trialStartDate = String(o.trialStartDate ?? '').trim();
  const trialEndDate = String(o.trialEndDate ?? '').trim();
  const trialNotes = String(o.trialNotes ?? '').trim();
  const trialHomeSecurityDepositAmount = Number(o.trialHomeSecurityDepositAmount);
  if (!trialHearingAidBrand || !trialHearingAidModel || !trialHearingAidType) return null;
  if (!trialStartDate || !trialEndDate) return null;
  if (!Number.isFinite(trialHomeSecurityDepositAmount) || trialHomeSecurityDepositAmount < 0) return null;
  return {
    trialHearingAidBrand,
    trialHearingAidModel,
    trialHearingAidType,
    trialSerialNumber,
    trialStartDate,
    trialEndDate,
    trialHomeSecurityDepositAmount,
    trialNotes,
  };
}

function parseSaleDetails(raw: unknown): StaffSaleProductLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const productId = String(o.productId ?? '').trim();
  const name = String(o.name ?? '').trim();
  const serialNumber = String(o.serialNumber ?? '').trim();
  const company = String(o.company ?? '').trim();
  const mrp = Number(o.mrp);
  const sellingPrice = Number(o.sellingPrice);
  const discountPercent = Number(o.discountPercent);
  const gstPercent = Number(o.gstPercent);
  const quantity = Number(o.quantity);
  if (!productId || !name || !serialNumber) return null;
  if (!Number.isFinite(mrp) || mrp < 0) return null;
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) return null;
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return null;
  if (!Number.isFinite(gstPercent) || gstPercent < 0) return null;
  if (!Number.isFinite(quantity) || quantity < 1) return null;
  return {
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
}

async function assertSerialAvailableForSale(productId: string, serialNumber: string): Promise<boolean> {
  const rows = await listAvailableHearingAidSerialRows();
  return rows.some((r) => r.productId === productId && r.serialNumber === serialNumber);
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
    let trial: StaffTrialDetails | undefined;
    let sale: { product: StaffSaleProductLine } | undefined;

    if (receiptType === 'booking') {
      const b = parseBookingDetails(details?.booking ?? details);
      if (!b) {
        return jsonError(
          'Missing or invalid booking details (brand, model, type, ear, MRP, selling price, quantity)',
          400
        );
      }
      booking = b;
    } else if (receiptType === 'trial') {
      const t = parseTrialDetails(details?.trial ?? details);
      if (!t) {
        return jsonError(
          'Missing or invalid trial details (device brand/model/type, dates, security deposit)',
          400
        );
      }
      trial = t;
    } else {
      const product = parseSaleDetails(details?.sale ?? details?.product ?? details);
      if (!product) {
        return jsonError(
          'Missing or invalid sale details (product, serial, MRP, selling price, discount %, GST %, quantity)',
          400
        );
      }
      const ok = await assertSerialAvailableForSale(product.productId, product.serialNumber);
      if (!ok) {
        return jsonError('Selected serial is not available in inventory (may already be sold or out)', 400);
      }
      sale = { product };
    }

    const merged = mergeStaffSubmissionIntoEnquiry({
      enquiry: enquiryData,
      appointment: appt,
      receiptType,
      amount,
      booking,
      trial,
      sale,
    });

    const requestId = uuidv4();
    const paymentDate = new Date().toISOString();
    const paymentMethod =
      paymentMode === 'cash' ? 'Cash' : paymentMode === 'upi' ? 'UPI' : 'Card';

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
        trial,
        sale,
      }),
    };

    await enquiryRef.update({
      visits: deepStripUndefined(merged.visits) as unknown[],
      visitSchedules: deepStripUndefined(merged.visitSchedules) as unknown[],
      financialSummary: deepStripUndefined(merged.financialSummary) as Record<string, unknown>,
      paymentRecords: FieldValue.arrayUnion(paymentRecord),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const patientName = ((appt.patientName as string) || (appt.title as string) || 'Patient').trim();
    const receiptLabel =
      receiptType === 'trial'
        ? 'Trial receipt request'
        : receiptType === 'booking'
          ? 'Booking receipt request'
          : 'Invoice request';

    const detailLines = buildPdfDetailLines(receiptType, { booking, trial, sale });

    const pdfBuffer = await buildStaffPaymentReceiptPdfBuffer({
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
    });

    const notify = parseNotifyEmails();
    let emailSent = false;
    if (notify.length === 0) {
      console.warn('collect-payment: STAFF_PAYMENT_NOTIFY_EMAILS not set; skipping email');
    } else {
      try {
        await sendStaffPaymentNotifyEmail({
          to: notify,
          subject: `[Staff payment] ${receiptLabel} — ${patientName} (₹${amount})`,
          text: [
            `A staff member submitted a payment request.`,
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
          html: `<p>A staff member submitted a payment request.</p>
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
<p>PDF attached for verification.</p>`,
          pdfBuffer,
          pdfFileName: `staff-payment-${appointmentId}-${requestId.slice(0, 8)}.pdf`,
        });
        emailSent = true;
      } catch (mailErr) {
        console.error('collect-payment: email failed', mailErr);
        return withCors(
          NextResponse.json(
            {
              ok: true,
              enquiryUpdated: true,
              emailSent: false,
              warning: 'Payment recorded but email to admins failed. Check server logs and SMTP.',
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
    trial?: StaffTrialDetails;
    sale?: { product: StaffSaleProductLine };
  }
): string[] {
  if (receiptType === 'booking' && args.booking) {
    const b = args.booking;
    return [
      `Brand: ${b.hearingAidBrand}`,
      `Model: ${b.hearingAidModel}`,
      `Type: ${b.hearingAidType}`,
      `Ear: ${b.whichEar}`,
      `MRP (per unit): ₹${b.hearingAidPrice}`,
      `Selling price (per unit): ₹${b.bookingSellingPrice}`,
      `Quantity: ${b.bookingQuantity}`,
    ];
  }
  if (receiptType === 'trial' && args.trial) {
    const t = args.trial;
    return [
      `Trial device: ${t.trialHearingAidBrand} ${t.trialHearingAidModel} (${t.trialHearingAidType})`,
      t.trialSerialNumber ? `Serial: ${t.trialSerialNumber}` : 'Serial: —',
      `Trial: ${t.trialStartDate} → ${t.trialEndDate}`,
      `Security deposit (recorded): ₹${t.trialHomeSecurityDepositAmount}`,
      t.trialNotes ? `Notes: ${t.trialNotes}` : '',
    ].filter(Boolean);
  }
  if (receiptType === 'invoice' && args.sale) {
    const p = args.sale.product;
    return [
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
