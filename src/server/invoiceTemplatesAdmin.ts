import { adminDb } from '@/server/firebaseAdmin';
import type { ManagedDocumentType, TemplateImage } from '@/utils/documentTemplateUtils';
import { pickPreferredHtmlTemplate } from '@/utils/invoiceTemplateSelection';

export type StoredInvoiceHtmlTemplate = {
  id: string;
  templateType?: 'visual' | 'html';
  documentType?: ManagedDocumentType;
  htmlContent?: string;
  images?: TemplateImage[];
  isFavorite?: boolean;
  updatedAt?: unknown;
  createdAt?: unknown;
};

/** Same selection rules as client `getPreferredCustomTemplate` in `receiptGenerator.ts` (shared helper). */
export async function getPreferredHtmlTemplateAdmin(
  documentType: ManagedDocumentType
): Promise<StoredInvoiceHtmlTemplate | null> {
  const snapshot = await adminDb().collection('invoiceTemplates').get();
  const templates = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StoredInvoiceHtmlTemplate));
  return pickPreferredHtmlTemplate(templates, documentType, (t) => t);
}

export async function resolveCenterDisplayNameAdmin(
  enquiry: Record<string, unknown>,
  visit: Record<string, unknown>
): Promise<string | undefined> {
  const raw =
    visit.centerId ||
    enquiry.visitingCenter ||
    enquiry.center ||
    enquiry.centerId;
  if (raw == null || String(raw).trim() === '') return undefined;
  const id = String(raw).trim();
  try {
    const snap = await adminDb().collection('centers').doc(id).get();
    if (snap.exists) {
      const name = (snap.data() as { name?: string })?.name;
      if (name && String(name).trim()) return String(name).trim();
    }
  } catch (e) {
    console.warn('resolveCenterDisplayNameAdmin:', e);
  }
  return id;
}
