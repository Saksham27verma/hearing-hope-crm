import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import {
  CRM_DOCUMENT_TEMPLATE_ROUTING_COLLECTION,
  CRM_DOCUMENT_TEMPLATE_ROUTING_DOC_ID,
  type DocumentTemplateRoutingDoc,
  routingFieldForDocumentType,
} from '@/lib/crmSettings/documentTemplateRouting';
import { db } from '@/firebase/config';
import { ManagedDocumentType, type TemplateImage } from '@/utils/documentTemplateUtils';
import {
  isHtmlTemplateRecord,
  pickPreferredHtmlTemplate,
  templateMatchesDocumentType,
} from '@/utils/invoiceTemplateSelection';
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
  isDefault?: boolean;
  isFavorite?: boolean;
  updatedAt?: unknown;
  createdAt?: unknown;
};

/**
 * html2canvas can fail on cross-origin images (logos on Firebase Storage).
 * Inline remote images as data URLs before capture to preserve quality and avoid CORS paint errors.
 */
const inlineImagesForHtml2Canvas = async (root: HTMLElement): Promise<void> => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = (img.getAttribute('src') || '').trim();
      if (!src || src.startsWith('data:')) return;
      try {
        const abs = src.startsWith('http') ? src : `${origin}${src.startsWith('/') ? src : `/${src}`}`;
        const res = await fetch(abs, { mode: 'cors' });
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to convert image blob to data URL'));
          reader.readAsDataURL(blob);
        });
        if (dataUrl) img.src = dataUrl;
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
    const templates = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as StoredDocumentTemplate));

    const routingSnap = await getDoc(
      doc(db, CRM_DOCUMENT_TEMPLATE_ROUTING_COLLECTION, CRM_DOCUMENT_TEMPLATE_ROUTING_DOC_ID)
    );
    const routing = routingSnap.data() as DocumentTemplateRoutingDoc | undefined;
    const field = routingFieldForDocumentType(documentType);
    const routedId = routing?.[field];
    if (routedId != null && String(routedId).trim()) {
      const match = templates.find((t) => t.id === String(routedId).trim());
      if (match && isHtmlTemplateRecord(match) && templateMatchesDocumentType(match, documentType)) {
        return match;
      }
    }

    return pickPreferredHtmlTemplate(templates, documentType, (t) => t);
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
    await inlineImagesForHtml2Canvas(container);

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

async function generateReceiptPdfServer(
  receiptType: 'booking' | 'trial',
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string; paymentMode?: string }
): Promise<Blob> {
  const res = await fetch('/api/receipts/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receiptType,
      enquiry,
      visit,
      options,
    }),
  });
  if (!res.ok) {
    let message = `Failed to render ${receiptType} receipt`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) message = j.error;
    } catch {
      // no-op
    }
    throw new Error(message);
  }
  return res.blob();
}

/**
 * Uses the same Invoice Manager template resolution as `/api/receipts/render` (admin + routing),
 * but returns HTML only — then rasterizes in-browser. Use when Puppeteer/Chrome PDF fails locally.
 */
async function generateReceiptPdfFromServerHtmlFragment(
  receiptType: 'booking' | 'trial',
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string; paymentMode?: string }
): Promise<Blob> {
  const res = await fetch('/api/receipts/render-html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      receiptType,
      enquiry,
      visit,
      options,
    }),
  });
  const j = (await res.json()) as { ok?: boolean; htmlFragment?: string; error?: string };
  if (!res.ok || !j?.htmlFragment) {
    const msg = j?.error || `Failed to load ${receiptType} receipt HTML`;
    throw new Error(msg);
  }
  return createPdfFromHtml(j.htmlFragment);
}

export { buildBookingReceiptData, buildTrialReceiptData } from '@/utils/receiptDataBuilders';

/** Generate booking receipt PDF blob. */
export async function generateBookingReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string; paymentMode?: string }
): Promise<Blob> {
  try {
    return await generateReceiptPdfServer('booking', enquiry, visit, options);
  } catch (error) {
    console.warn('generateBookingReceiptPDF: server PDF failed, trying HTML fragment + client rasterize', error);
    try {
      return await generateReceiptPdfFromServerHtmlFragment('booking', enquiry, visit, options);
    } catch (e2) {
      console.warn('generateBookingReceiptPDF: server HTML fragment failed, legacy client template pick', e2);
      return _legacyClientBookingPdf(enquiry, visit, options);
    }
  }
}

/** Generate trial receipt PDF blob. */
export async function generateTrialReceiptPDF(
  enquiry: EnquiryLike,
  visit: VisitLike,
  options?: { receiptNumber?: string; centerName?: string }
): Promise<Blob> {
  try {
    return await generateReceiptPdfServer('trial', enquiry, visit, options);
  } catch (error) {
    console.warn('generateTrialReceiptPDF: server PDF failed, trying HTML fragment + client rasterize', error);
    try {
      return await generateReceiptPdfFromServerHtmlFragment('trial', enquiry, visit, options);
    } catch (e2) {
      console.warn('generateTrialReceiptPDF: server HTML fragment failed, legacy client template pick', e2);
      return _legacyClientTrialPdf(enquiry, visit, options);
    }
  }
}

/* Legacy client-side renderer retained for fallback/dev utility only. */
async function _legacyClientBookingPdf(
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
  if (!customTemplate?.htmlContent) {
    throw new Error('Booking receipt HTML template is not configured in Invoice Manager.');
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
  return createPdfFromHtml(
    buildBookingReceiptHtmlString(customTemplate, data, { logoPublicOrigin: origin })
  );
}

/* Legacy client-side renderer retained for fallback/dev utility only. */
async function _legacyClientTrialPdf(
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
  if (!customTemplate?.htmlContent) {
    throw new Error('Trial receipt HTML template is not configured in Invoice Manager.');
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
  return createPdfFromHtml(buildTrialReceiptHtmlString(customTemplate, data, { logoPublicOrigin: origin }));
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
