import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import BookingReceiptTemplate from '@/components/receipts/BookingReceiptTemplate';
import TrialReceiptTemplate from '@/components/receipts/TrialReceiptTemplate';
import { db } from '@/firebase/config';
import { ManagedDocumentType, type TemplateImage } from '@/utils/documentTemplateUtils';
import {
  buildBookingReceiptHtmlString,
  buildTrialReceiptHtmlString,
} from '@/utils/receiptTemplateHtml';
import {
  buildBookingReceiptData,
  buildTrialReceiptData,
  type EnquiryLike,
  type VisitLike,
} from '@/utils/receiptDataBuilders';

export type { EnquiryLike, VisitLike };

type StoredDocumentTemplate = {
  id: string;
  templateType?: 'visual' | 'html';
  documentType?: ManagedDocumentType;
  htmlContent?: string;
  images?: TemplateImage[];
  isFavorite?: boolean;
  updatedAt?: unknown;
  createdAt?: unknown;
};

const getTimestampValue = (value: unknown) => {
  if (!value) return 0;
  const v = value as { toMillis?: () => number; seconds?: number };
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const parsed = new Date(value as string).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
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

/** Resolve center display name from visit / enquiry ids (Firestore `centers` collection). */
async function resolveCenterDisplayName(enquiry: EnquiryLike, visit: VisitLike): Promise<string | undefined> {
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

const getPreferredCustomTemplate = async (documentType: ManagedDocumentType): Promise<StoredDocumentTemplate | null> => {
  try {
    const snapshot = await getDocs(collection(db, 'invoiceTemplates'));
    const templates = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as StoredDocumentTemplate))
      .filter(
        (template) => template.templateType === 'html' && template.documentType === documentType && template.htmlContent
      )
      .sort((a, b) => {
        const favoriteDelta = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
        if (favoriteDelta !== 0) return favoriteDelta;
        return (
          (getTimestampValue(b.updatedAt) || getTimestampValue(b.createdAt)) -
          (getTimestampValue(a.updatedAt) || getTimestampValue(a.createdAt))
        );
      });

    return templates[0] ?? null;
  } catch (error) {
    console.error(`Error fetching ${documentType} template:`, error);
    return null;
  }
};

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

export { buildBookingReceiptData, buildTrialReceiptData } from '@/utils/receiptDataBuilders';

/** Generate booking receipt PDF blob. */
export async function generateBookingReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string; paymentMode?: string }
): Promise<Blob> {
  const centerName =
    options?.centerName !== undefined && options.centerName !== ''
      ? options.centerName
      : await resolveCenterDisplayName(enquiry, visit);
  const data = buildBookingReceiptData(enquiry, visit, {
    receiptNumber: options?.receiptNumber,
    centerName,
    paymentMode: options?.paymentMode,
  });
  const customTemplate = await getPreferredCustomTemplate('booking_receipt');
  if (customTemplate?.htmlContent) {
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    return createPdfFromHtml(
      buildBookingReceiptHtmlString(customTemplate, data, { logoPublicOrigin: origin })
    );
  }
  const doc = createElement(BookingReceiptTemplate, { data });
  return pdf(doc as Parameters<typeof pdf>[0]).toBlob();
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
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    return createPdfFromHtml(buildTrialReceiptHtmlString(customTemplate, data, { logoPublicOrigin: origin }));
  }
  const doc = createElement(TrialReceiptTemplate, { data });
  return pdf(doc as Parameters<typeof pdf>[0]).toBlob();
}

/** Download booking receipt PDF. */
export async function downloadBookingReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  filename?: string,
  options?: { receiptNumber?: string; centerName?: string; paymentMode?: string }
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
  options?: { receiptNumber?: string; centerName?: string; paymentMode?: string }
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
