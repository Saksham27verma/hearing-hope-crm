import type { ManagedDocumentType } from '@/utils/documentTemplateUtils';

/** Map Firestore / legacy values to a canonical ManagedDocumentType. */
export function normalizeManagedDocumentType(raw: unknown): ManagedDocumentType | null {
  if (raw == null || raw === '') return null;
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (s === 'invoice') return 'invoice';
  if (s === 'booking_receipt' || s === 'booking') return 'booking_receipt';
  if (s === 'trial_receipt' || s === 'trial') return 'trial_receipt';
  return null;
}

/**
 * Whether this record should be treated as an HTML template for receipts/invoices.
 * - Requires non-empty htmlContent.
 * - Only `templateType === 'visual'` is excluded (config/React-PDF–style rows). Anything else with HTML
 *   (including missing `templateType` from legacy saves) is treated as HTML.
 */
export function isHtmlTemplateRecord(t: { templateType?: string; htmlContent?: string }): boolean {
  const html = String(t.htmlContent ?? '').trim();
  if (!html) return false;
  if (t.templateType === 'visual') return false;
  return true;
}

export function templateMatchesDocumentType(
  t: { documentType?: unknown },
  target: ManagedDocumentType
): boolean {
  return normalizeManagedDocumentType(t.documentType) === target;
}

export function getTimestampValueForTemplate(value: unknown): number {
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

export type TemplateSortable = {
  isFavorite?: boolean;
  updatedAt?: unknown;
  createdAt?: unknown;
};

/**
 * Same rules as the CRM enquiry receipt flow: HTML templates only, matching document type,
 * favorite first, then most recently updated.
 */
export function pickPreferredHtmlTemplate<T extends TemplateSortable>(
  templates: T[],
  documentType: ManagedDocumentType,
  getFields: (t: T) => { templateType?: string; htmlContent?: string; documentType?: unknown }
): T | null {
  const filtered = templates.filter((row) => {
    const f = getFields(row);
    return isHtmlTemplateRecord(f) && templateMatchesDocumentType(f, documentType);
  });
  filtered.sort((a, b) => {
    const favoriteDelta = Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
    if (favoriteDelta !== 0) return favoriteDelta;
    return (
      (getTimestampValueForTemplate(b.updatedAt) || getTimestampValueForTemplate(b.createdAt)) -
      (getTimestampValueForTemplate(a.updatedAt) || getTimestampValueForTemplate(a.createdAt))
    );
  });
  return filtered[0] ?? null;
}
