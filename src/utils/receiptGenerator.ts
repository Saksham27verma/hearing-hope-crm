import { pdf } from '@react-pdf/renderer';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { collection, getDocs } from 'firebase/firestore';
import BookingReceiptTemplate, { BookingReceiptData } from '@/components/receipts/BookingReceiptTemplate';
import TrialReceiptTemplate, { TrialReceiptData } from '@/components/receipts/TrialReceiptTemplate';
import { db } from '@/firebase/config';
import {
  ManagedDocumentType,
  replaceTemplateTokens,
  TemplateImage,
} from '@/utils/documentTemplateUtils';

const defaultCompany = {
  companyName: 'Hope Hearing Solutions',
  companyAddress: 'Your Company Address\nCity, State - PIN Code',
  companyPhone: '+91 XXXXX XXXXX',
  companyEmail: 'info@hopehearing.com',
};

const defaultBookingTerms = `1. This receipt is against advance payment for hearing aid booking.
2. Balance amount to be paid as per agreed terms before delivery.
3. Booking amount is non-refundable as per policy; exceptions at discretion of the center.`;

const defaultTrialTerms = `1. Device is issued for trial and must be returned by the end date.
2. Device should be returned in the same condition. Loss or damage may attract charges.
3. Trial does not guarantee purchase; full payment required if you decide to buy.`;

const defaultBookingFooter = `Thank you for your booking. This receipt is issued against advance payment for hearing aid booking.
Please retain this receipt for your records.`;

const defaultTrialFooter = `This receipt confirms that the above hearing aid device has been issued for trial as on the start date.
Please return the device in good condition by the end date. Damages or loss may attract charges.
Thank you for choosing us.`;

type StoredDocumentTemplate = {
  id: string;
  templateType?: 'visual' | 'html';
  documentType?: ManagedDocumentType;
  htmlContent?: string;
  images?: TemplateImage[];
  isFavorite?: boolean;
  updatedAt?: any;
  createdAt?: any;
};

export type EnquiryLike = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
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
  visitDate?: string;
  visitTime?: string;
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

const formatTrialType = (visit: VisitLike): string | undefined => {
  const raw = String(visit.trialHearingAidType || visit.visitType || '').toLowerCase();
  if (!raw) return undefined;
  if (raw === 'home') return 'Home Trial';
  if (raw === 'center' || raw === 'clinic') return 'Clinic Trial';
  return raw;
};

const getBookingPaymentMode = (enquiry: EnquiryLike): string | undefined => {
  const bookingPayment =
    enquiry.payments?.find((payment) => payment.paymentFor === 'booking_advance') ||
    enquiry.paymentRecords?.find((payment) => payment.paymentType === 'hearing_aid_booking');

  return bookingPayment?.paymentMode || bookingPayment?.paymentMethod;
};

const getTimestampValue = (value: any) => {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatHtmlText = (value?: string | number | null, multiline = false) => {
  if (value == null || value === '') return '';
  const text = escapeHtml(String(value));
  return multiline ? text.replace(/\n/g, '<br/>') : text;
};

const formatCurrency = (amount?: number) =>
  typeof amount === 'number' && !Number.isNaN(amount)
    ? `Rs. ${amount.toLocaleString('en-IN')}`
    : '';

const getPreferredCustomTemplate = async (documentType: ManagedDocumentType): Promise<StoredDocumentTemplate | null> => {
  try {
    const snapshot = await getDocs(collection(db, 'invoiceTemplates'));
    const templates = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as StoredDocumentTemplate))
      .filter((template) =>
        template.templateType === 'html' && template.documentType === documentType && template.htmlContent
      )
      .sort((a, b) => {
        const favoriteDelta = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
        if (favoriteDelta !== 0) return favoriteDelta;
        return (getTimestampValue(b.updatedAt) || getTimestampValue(b.createdAt)) -
          (getTimestampValue(a.updatedAt) || getTimestampValue(a.createdAt));
      });

    return templates[0] ?? null;
  } catch (error) {
    console.error(`Error fetching ${documentType} template:`, error);
    return null;
  }
};

const buildBookingReceiptHtml = (template: StoredDocumentTemplate, data: BookingReceiptData) =>
  replaceTemplateTokens(
    template.htmlContent || '',
    {
      COMPANY_NAME: formatHtmlText(data.companyName),
      COMPANY_ADDRESS: formatHtmlText(data.companyAddress, true),
      COMPANY_PHONE: formatHtmlText(data.companyPhone),
      COMPANY_EMAIL: formatHtmlText(data.companyEmail),
      RECEIPT_NUMBER: formatHtmlText(data.receiptNumber),
      RECEIPT_DATE: formatHtmlText(data.receiptDate),
      PATIENT_NAME: formatHtmlText(data.patientName),
      PATIENT_PHONE: formatHtmlText(data.patientPhone),
      PATIENT_EMAIL: formatHtmlText(data.patientEmail),
      PATIENT_ADDRESS: formatHtmlText(data.patientAddress, true),
      BOOKING_DATE: formatHtmlText(data.bookingDate),
      DEVICE_NAME: formatHtmlText(data.deviceName),
      MRP: formatHtmlText(formatCurrency(data.mrp)),
      SELLING_PRICE: formatHtmlText(formatCurrency(data.sellingPrice)),
      QUANTITY: formatHtmlText(data.quantity),
      ADVANCE_AMOUNT: formatHtmlText(formatCurrency(data.advanceAmount)),
      BALANCE_AMOUNT: formatHtmlText(formatCurrency(data.balanceAmount)),
      PAYMENT_MODE: formatHtmlText(data.paymentMode),
      CENTER_NAME: formatHtmlText(data.centerName),
      VISIT_DATE: formatHtmlText(data.visitDate),
      TERMS_TEXT: formatHtmlText(data.terms, true),
      FOOTER_TEXT: formatHtmlText(defaultBookingFooter, true),
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    template.images || []
  );

const buildTrialReceiptHtml = (template: StoredDocumentTemplate, data: TrialReceiptData) =>
  replaceTemplateTokens(
    template.htmlContent || '',
    {
      COMPANY_NAME: formatHtmlText(data.companyName),
      COMPANY_ADDRESS: formatHtmlText(data.companyAddress, true),
      COMPANY_PHONE: formatHtmlText(data.companyPhone),
      COMPANY_EMAIL: formatHtmlText(data.companyEmail),
      RECEIPT_NUMBER: formatHtmlText(data.receiptNumber),
      RECEIPT_DATE: formatHtmlText(data.receiptDate),
      PATIENT_NAME: formatHtmlText(data.patientName),
      PATIENT_PHONE: formatHtmlText(data.patientPhone),
      PATIENT_EMAIL: formatHtmlText(data.patientEmail),
      PATIENT_ADDRESS: formatHtmlText(data.patientAddress, true),
      TRIAL_DATE: formatHtmlText(data.trialDate),
      TRIAL_START_DATE: formatHtmlText(data.trialStartDate),
      TRIAL_END_DATE: formatHtmlText(data.trialEndDate),
      TRIAL_DURATION_DAYS: formatHtmlText(
        data.trialDurationDays != null ? `${data.trialDurationDays} days` : ''
      ),
      DEVICE_USED: formatHtmlText(data.deviceUsed),
      TRIAL_TYPE: formatHtmlText(data.trialType),
      SERIAL_NUMBER: formatHtmlText(data.serialNumber),
      WHICH_EAR: formatHtmlText(data.whichEar),
      CENTER_NAME: formatHtmlText(data.centerName),
      VISIT_DATE: formatHtmlText(data.visitDate),
      TERMS_TEXT: formatHtmlText(data.terms, true),
      FOOTER_TEXT: formatHtmlText(defaultTrialFooter, true),
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    template.images || []
  );

const createPdfFromHtml = async (html: string): Promise<Blob> => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.onload = () => resolve();
              image.onerror = () => resolve();
            })
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 120));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: container.scrollWidth,
      windowWidth: container.scrollWidth,
    });

    const pdfDoc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();
    const imageData = canvas.toDataURL('image/png');
    const imageWidth = pageWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;

    let heightLeft = imageHeight;
    let position = 0;

    pdfDoc.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imageHeight;
      pdfDoc.addPage();
      pdfDoc.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight);
      heightLeft -= pageHeight;
    }

    return pdfDoc.output('blob');
  } finally {
    document.body.removeChild(container);
  }
};

/** Build booking receipt data from enquiry + visit. */
export function buildBookingReceiptData(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string }
): BookingReceiptData {
  const receiptDate = new Date().toLocaleDateString('en-IN');
  const bookingDate = visit.bookingDate || visit.visitDate || receiptDate;
  const product = visit.products?.[0];
  const mrp = Number(visit.hearingAidPrice) || 0;
  const advanceAmount = Number(visit.bookingAdvanceAmount) || 0;
  const quantity = Number(visit.bookingQuantity) || 1;
  const sellingPrice = Number(visit.bookingSellingPrice) || 0;
  const bookingTotal = sellingPrice * quantity;
  return {
    ...defaultCompany,
    receiptNumber: options?.receiptNumber ?? `BR-${Date.now()}`,
    receiptDate,
    patientName: enquiry.name || 'Patient',
    patientPhone: enquiry.phone,
    patientEmail: enquiry.email,
    patientAddress: enquiry.address,
    bookingDate,
    advanceAmount,
    deviceName: [product?.name || product?.productName, product?.brand || visit.hearingAidBrand, product?.model || visit.hearingAidModel]
      .filter(Boolean)
      .join(' ')
      .trim() || [visit.hearingAidBrand, visit.hearingAidModel].filter(Boolean).join(' ').trim() || undefined,
    mrp: mrp || undefined,
    sellingPrice: sellingPrice || undefined,
    quantity,
    balanceAmount: bookingTotal > 0 ? Math.max(bookingTotal - advanceAmount, 0) : undefined,
    paymentMode: getBookingPaymentMode(enquiry),
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
  const duration = visit.trialDuration ?? (visit.trialStartDate && visit.trialEndDate
    ? Math.ceil((new Date(visit.trialEndDate).getTime() - new Date(visit.trialStartDate).getTime()) / (1000 * 60 * 60 * 24))
    : undefined);
  const trialType = formatTrialType(visit);
  const isHomeTrial = trialType?.toLowerCase().includes('home');
  return {
    ...defaultCompany,
    receiptNumber: options?.receiptNumber ?? `TR-${Date.now()}`,
    receiptDate,
    patientName: enquiry.name || 'Patient',
    patientPhone: enquiry.phone,
    patientEmail: enquiry.email,
    patientAddress: enquiry.address,
    trialDate: visit.visitDate,
    trialStartDate: visit.trialStartDate || visit.visitDate || receiptDate,
    trialEndDate: visit.trialEndDate,
    trialDurationDays: duration,
    deviceUsed: [
      visit.trialHearingAidBrand || visit.hearingAidBrand || product?.brand,
      visit.trialHearingAidModel || visit.hearingAidModel || product?.model,
    ].filter(Boolean).join(' ').trim() || product?.name || product?.productName,
    trialType,
    serialNumber: isHomeTrial ? (visit.trialSerialNumber || product?.serialNumber) : undefined,
    whichEar: visit.whichEar,
    centerName: options?.centerName,
    visitDate: visit.visitDate,
    terms: defaultTrialTerms,
  };
}

/** Generate booking receipt PDF blob. */
export async function generateBookingReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string }
): Promise<Blob> {
  const data = buildBookingReceiptData(enquiry, visit, options);
  const customTemplate = await getPreferredCustomTemplate('booking_receipt');
  if (customTemplate?.htmlContent) {
    return createPdfFromHtml(buildBookingReceiptHtml(customTemplate, data));
  }
  const doc = BookingReceiptTemplate({ data });
  return pdf(doc).toBlob();
}

/** Generate trial receipt PDF blob. */
export async function generateTrialReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string }
): Promise<Blob> {
  const data = buildTrialReceiptData(enquiry, visit, options);
  const customTemplate = await getPreferredCustomTemplate('trial_receipt');
  if (customTemplate?.htmlContent) {
    return createPdfFromHtml(buildTrialReceiptHtml(customTemplate, data));
  }
  const doc = TrialReceiptTemplate({ data });
  return pdf(doc).toBlob();
}

/** Download booking receipt PDF. */
export async function downloadBookingReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  filename?: string,
  options?: { receiptNumber?: string; centerName?: string }
): Promise<void> {
  const blob = await generateBookingReceiptPDF(enquiry, visit, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename ?? `booking-receipt-${visit.bookingDate || 'receipt'}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Download trial receipt PDF. */
export async function downloadTrialReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  filename?: string,
  options?: { receiptNumber?: string; centerName?: string }
): Promise<void> {
  const blob = await generateTrialReceiptPDF(enquiry, visit, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename ?? `trial-receipt-${visit.trialStartDate || 'receipt'}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Open booking receipt PDF in new tab. */
export async function openBookingReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string }
): Promise<void> {
  const blob = await generateBookingReceiptPDF(enquiry, visit, options);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open trial receipt PDF in new tab. */
export async function openTrialReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string }
): Promise<void> {
  const blob = await generateTrialReceiptPDF(enquiry, visit, options);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
