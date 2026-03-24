import { pdf } from '@react-pdf/renderer';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import BookingReceiptTemplate, { BookingReceiptData } from '@/components/receipts/BookingReceiptTemplate';
import TrialReceiptTemplate, { TrialReceiptData } from '@/components/receipts/TrialReceiptTemplate';
import { db } from '@/firebase/config';
import {
  ManagedDocumentType,
  replaceTemplateTokens,
  TemplateImage,
} from '@/utils/documentTemplateUtils';

const defaultCompany = {
  companyName: 'Hope Digital Innovations Pvt Ltd',
  companyAddress: 'G-14, Ground Floor, King Mall, Rohini, Delhi - 85',
  companyPhone: '9711871169',
  companyEmail: 'info@hopehearing.com',
};

const defaultBookingTerms = `1. This receipt is against advance payment for hearing aid booking.
2. Balance amount to be paid as per agreed terms before delivery.
3. Booking amount is non-refundable as per policy; exceptions at discretion of the center.`;

const defaultTrialTerms = `1. Device is issued for trial and must be returned by the end date.
2. Device should be returned in the same condition. Loss or damage may attract charges.
3. Trial does not guarantee purchase; full payment required if you decide to buy.`;

const defaultBookingFooter = `Thank you for your booking. Please retain this receipt for your records.`;

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

const LOGO_PLACEHOLDER_TOKEN = '{{LOGO_PLACEHOLDER}}';

const getDefaultLogoUrl = (): string =>
  typeof window === 'undefined' ? '/images/logohope.svg' : `${window.location.origin}/images/logohope.svg`;

/** Ensures logo token resolves when the Firestore template has no uploaded logo. */
const mergeTemplateImagesWithDefaultLogo = (images?: TemplateImage[]): TemplateImage[] => {
  const list = [...(images ?? [])];
  const hasLogo = list.some(
    (im) => im.placeholder === LOGO_PLACEHOLDER_TOKEN && String(im.url ?? '').trim() !== ''
  );
  if (!hasLogo) {
    list.push({ placeholder: LOGO_PLACEHOLDER_TOKEN, url: getDefaultLogoUrl() });
  }
  return list;
};

/** html2canvas often fails to paint external SVGs; inline as data URL before capture. */
const inlineSvgImagesForHtml2Canvas = async (root: HTMLElement): Promise<void> => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = (img.getAttribute('src') || '').trim();
      if (!src || src.startsWith('data:image/svg+xml')) return;
      if (!src.includes('.svg')) return;
      try {
        const abs = src.startsWith('http') ? src : `${origin}${src.startsWith('/') ? src : `/${src}`}`;
        const res = await fetch(abs);
        if (!res.ok) return;
        const text = await res.text();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
      } catch {
        /* keep original src */
      }
    })
  );
};

export type EnquiryLike = {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** Selected center document id (enquiry form) */
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

/** Resolve center display name from visit / enquiry ids (Firestore `centers` collection). */
async function resolveCenterDisplayName(
  enquiry: EnquiryLike,
  visit: VisitLike
): Promise<string | undefined> {
  const raw =
    visit.centerId ||
    (enquiry as { visitingCenter?: string }).visitingCenter ||
    (enquiry as { center?: string }).center ||
    (enquiry as { centerId?: string }).centerId;
  if (raw == null || String(raw).trim() === '') return undefined;
  const id = String(raw).trim();
  try {
    const snap = await getDoc(doc(db, 'centers', id));
    if (snap.exists()) {
      const name = (snap.data() as { name?: string })?.name;
      if (name && String(name).trim()) return String(name).trim();
    }
  } catch (e) {
    console.warn('resolveCenterDisplayName:', e);
  }
  return id;
}

/** One line for receipt: brand + model/product without repeating the same text twice. */
function buildUniqueDeviceDescription(
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

const buildBookingReceiptHtml = (template: StoredDocumentTemplate, data: BookingReceiptData) => {
  const qty = Number(data.quantity) || 1;
  const unitSelling = Number(data.sellingPrice) || 0;
  const totalAgreed = unitSelling * qty;
  return replaceTemplateTokens(
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
      DEVICE_NAME: formatHtmlText(
        data.deviceName ||
          [data.deviceBrand, data.deviceModel].filter(Boolean).join(' ').trim()
      ),
      DEVICE_BRAND: formatHtmlText(data.deviceBrand),
      DEVICE_MODEL: formatHtmlText(data.deviceModel),
      MRP: formatHtmlText(formatCurrency(data.mrp)),
      SELLING_PRICE: formatHtmlText(formatCurrency(data.sellingPrice)),
      TOTAL_AGREED_VALUE: formatHtmlText(formatCurrency(totalAgreed)),
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
    mergeTemplateImagesWithDefaultLogo(template.images)
  );
};

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
    mergeTemplateImagesWithDefaultLogo(template.images)
  );

const createPdfFromHtml = async (html: string): Promise<Blob> => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '720px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await inlineSvgImagesForHtml2Canvas(container);

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

    await new Promise((resolve) => setTimeout(resolve, 150));

    const canvas = await html2canvas(container, {
      scale: 1.75,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: container.scrollWidth,
      windowWidth: container.scrollWidth,
    });

    const pdfDoc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const pageHeight = pdfDoc.internal.pageSize.getHeight();
    const imageData = canvas.toDataURL('image/png', 0.92);
    const aspect = canvas.width / canvas.height;
    let drawW = pageWidth;
    let drawH = drawW / aspect;
    if (drawH > pageHeight) {
      drawH = pageHeight;
      drawW = drawH * aspect;
    }
    const x = (pageWidth - drawW) / 2;
    pdfDoc.addImage(imageData, 'PNG', x, 0, drawW, drawH);

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
  const { brand, model, fullName } = buildUniqueDeviceDescription(visit, product);
  const deviceNameCombined = fullName;
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
    deviceBrand: brand,
    deviceModel: model,
    deviceName: deviceNameCombined,
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
  const centerName =
    options?.centerName !== undefined && options.centerName !== ''
      ? options.centerName
      : await resolveCenterDisplayName(enquiry, visit);
  const data = buildBookingReceiptData(enquiry, visit, {
    receiptNumber: options?.receiptNumber,
    centerName,
  });
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
  const centerName =
    options?.centerName !== undefined && options.centerName !== ''
      ? options.centerName
      : await resolveCenterDisplayName(enquiry, visit);
  const data = buildTrialReceiptData(enquiry, visit, {
    receiptNumber: options?.receiptNumber,
    centerName,
  });
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
