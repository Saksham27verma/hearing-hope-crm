import type { BookingReceiptData } from '@/components/receipts/BookingReceiptTemplate';
import type { TrialReceiptData } from '@/components/receipts/TrialReceiptTemplate';

export const receiptDefaultCompany = {
  companyName: 'Hope Digital Innovations Pvt Ltd',
  companyAddress: 'G-14, Ground Floor, King Mall, Rohini, Delhi - 85',
  companyPhone: '9711871169',
  companyEmail: 'info@hopehearing.com',
};

export const defaultBookingTerms = `1. This receipt is against advance payment for hearing aid booking.
2. Balance amount to be paid as per agreed terms before delivery.
3. Booking amount is non-refundable as per policy; exceptions at discretion of the center.`;

export const defaultTrialTerms = `1. Device is issued for trial and must be returned by the end date.
2. Device should be returned in the same condition. Loss or damage may attract charges.
3. Trial does not guarantee purchase; full payment required if you decide to buy.`;

export const defaultBookingFooter = `Thank you for your booking. Please retain this receipt for your records.`;

export const defaultTrialFooter = `This receipt confirms that the above hearing aid device has been issued for trial as on the start date.
Please return the device in good condition by the end date. Damages or loss may attract charges.
Thank you for choosing us.`;

export type EnquiryLike = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  center?: string;
  visitingCenter?: string;
  centerId?: string;
  payments?: Array<{
    amount?: number;
    paymentFor?: string;
    paymentMode?: string;
    paymentDate?: string;
  }>;
  paymentRecords?: Array<{
    amount?: number;
    paymentType?: string;
    paymentMethod?: string;
    paymentDate?: string;
  }>;
};

export type VisitLike = {
  id?: string;
  bookingReceiptNumber?: string;
  trialReceiptNumber?: string;
  visitDate?: string;
  visitTime?: string;
  centerId?: string;
  hearingAidBooked?: boolean;
  trialGiven?: boolean;
  trialStartDate?: string;
  trialEndDate?: string;
  trialDuration?: number;
  bookingDate?: string;
  bookingAdvanceAmount?: number;
  trialHearingAidBrand?: string;
  trialHearingAidModel?: string;
  trialHearingAidType?: string;
  trialSerialNumber?: string;
  /** Home trial security deposit (₹); 0 for in-office / not applicable. */
  trialHomeSecurityDepositAmount?: number;
  whichEar?: string;
  visitType?: string;
  hearingAidBrand?: string;
  hearingAidModel?: string;
  hearingAidType?: string;
  hearingAidPrice?: number;
  bookingSellingPrice?: number;
  bookingQuantity?: number;
  products?: Array<{ name?: string; productName?: string; serialNumber?: string; brand?: string; model?: string }>;
};

export const formatTrialType = (visit: VisitLike): string | undefined => {
  const raw = String(visit.trialHearingAidType || visit.visitType || '').toLowerCase();
  if (!raw) return undefined;
  if (raw === 'home') return 'Home Trial';
  if (raw === 'center' || raw === 'clinic' || raw === 'in_office') return 'Clinic Trial';
  return raw;
};

function stableReceiptNumber(prefix: 'BR' | 'TR', visit: VisitLike, fallbackDate: string): string {
  const visitId = String(visit.id || '').trim();
  if (visitId) return `${prefix}-${visitId}`;
  const safeDate = String(fallbackDate || '').replace(/[^\d]/g, '');
  return `${prefix}-${safeDate || Date.now()}`;
}

export const getBookingPaymentMode = (enquiry: EnquiryLike): string | undefined => {
  const fromPayments = enquiry.payments?.find((payment) => payment.paymentFor === 'booking_advance');
  if (fromPayments?.paymentMode) return fromPayments.paymentMode;
  const fromRecords = enquiry.paymentRecords?.find((payment) => payment.paymentType === 'hearing_aid_booking');
  return fromRecords?.paymentMethod;
};

/** One line for receipt: brand + model/product without repeating the same text twice. */
export function buildUniqueDeviceDescription(
  visit: VisitLike,
  product?: { name?: string; productName?: string; brand?: string; model?: string }
): { brand?: string; model?: string; fullName?: string } {
  const brand = (visit.hearingAidBrand || product?.brand || '').trim() || undefined;
  const model = (visit.hearingAidModel || product?.model || '').trim() || undefined;
  const prodName = (product?.name || product?.productName || '').trim() || undefined;

  const parts: string[] = [];
  const push = (s?: string) => {
    const t = (s || '').trim();
    if (!t) return;
    if (!parts.some((p) => p.toLowerCase() === t.toLowerCase())) parts.push(t);
  };

  push(brand);
  push(model);
  if (prodName && prodName.toLowerCase() !== (brand || '').toLowerCase() && prodName.toLowerCase() !== (model || '').toLowerCase()) {
    push(prodName);
  }

  const fullName = parts.length ? parts.join(' ') : undefined;
  return { brand, model: model || undefined, fullName };
}

/** Build booking receipt data from enquiry + visit. */
export function buildBookingReceiptData(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string; paymentMode?: string }
): BookingReceiptData {
  const receiptDate = new Date().toLocaleDateString('en-IN');
  const bookingDate = visit.bookingDate || visit.visitDate || receiptDate;
  const product = visit.products?.[0];
  const mrp = Number(visit.hearingAidPrice) || 0;
  const advanceAmount = Number(visit.bookingAdvanceAmount) || 0;
  const quantity = Number(visit.bookingQuantity) || 1;
  const sellingPrice = Number(visit.bookingSellingPrice) || 0;
  const bookingTotal = sellingPrice * quantity;
  const { brand, model, fullName } = buildUniqueDeviceDescription(visit, product);
  const deviceNameCombined = fullName;
  return {
    ...receiptDefaultCompany,
    receiptNumber:
      options?.receiptNumber ||
      String(visit.bookingReceiptNumber || '').trim() ||
      stableReceiptNumber('BR', visit, bookingDate),
    receiptDate,
    patientName: enquiry.name || 'Patient',
    patientPhone: enquiry.phone,
    patientEmail: enquiry.email,
    patientAddress: enquiry.address,
    bookingDate,
    advanceAmount,
    deviceBrand: brand,
    deviceModel: model,
    deviceName: deviceNameCombined,
    mrp: mrp || undefined,
    sellingPrice: sellingPrice || undefined,
    quantity,
    balanceAmount: bookingTotal > 0 ? Math.max(bookingTotal - advanceAmount, 0) : undefined,
    paymentMode: options?.paymentMode ?? getBookingPaymentMode(enquiry),
    centerName: options?.centerName,
    visitDate: visit.visitDate,
    terms: defaultBookingTerms,
  };
}

/** Build trial receipt data from enquiry + visit. */
export function buildTrialReceiptData(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string }
): TrialReceiptData {
  const receiptDate = new Date().toLocaleDateString('en-IN');
  const product = visit.products?.[0];
  const duration =
    visit.trialDuration ??
    (visit.trialStartDate && visit.trialEndDate
      ? Math.ceil(
          (new Date(visit.trialEndDate).getTime() - new Date(visit.trialStartDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      : undefined);
  const trialType = formatTrialType(visit);
  const isHomeTrial = trialType?.toLowerCase().includes('home');
  const depositRaw = Number(visit.trialHomeSecurityDepositAmount);
  return {
    ...receiptDefaultCompany,
    receiptNumber:
      options?.receiptNumber ||
      String(visit.trialReceiptNumber || '').trim() ||
      stableReceiptNumber('TR', visit, visit.trialStartDate || visit.visitDate || receiptDate),
    receiptDate,
    patientName: enquiry.name || 'Patient',
    patientPhone: enquiry.phone,
    patientEmail: enquiry.email,
    patientAddress: enquiry.address,
    trialDate: visit.visitDate,
    trialStartDate: visit.trialStartDate || visit.visitDate || receiptDate,
    trialEndDate: visit.trialEndDate,
    trialDurationDays: duration,
    securityDepositAmount: isHomeTrial ? (Number.isFinite(depositRaw) ? depositRaw : 0) : undefined,
    deviceUsed: [
      visit.trialHearingAidBrand || visit.hearingAidBrand || product?.brand,
      visit.trialHearingAidModel || visit.hearingAidModel || product?.model,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || product?.name || product?.productName,
    trialType,
    serialNumber: isHomeTrial ? visit.trialSerialNumber || product?.serialNumber : undefined,
    whichEar: visit.whichEar,
    centerName: options?.centerName,
    visitDate: visit.visitDate,
    terms: defaultTrialTerms,
  };
}
