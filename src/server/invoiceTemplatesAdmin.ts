import { adminDb } from '@/server/firebaseAdmin';
import type { ManagedDocumentType, TemplateImage } from '@/utils/documentTemplateUtils';

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

function getTimestampValue(value: unknown): number {
  if (!value) return 0;
  const v = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.toDate === 'function') {
    try {
      return v.toDate().getTime();
    } catch {
      return 0;
    }
  }
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const parsed = new Date(value as string).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Same selection rules as client `getPreferredCustomTemplate` in `receiptGenerator.ts`. */
export async function getPreferredHtmlTemplateAdmin(
  documentType: ManagedDocumentType
): Promise<StoredInvoiceHtmlTemplate | null> {
  const db = adminDb();
  const snapshot = await db.collection('invoiceTemplates').get();
  const templates = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as StoredInvoiceHtmlTemplate))
    .filter(
      (t) => t.templateType === 'html' && t.documentType === documentType && String(t.htmlContent || '').trim() !== ''
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
