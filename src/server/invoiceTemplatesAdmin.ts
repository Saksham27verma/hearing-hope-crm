import {
  CRM_DOCUMENT_TEMPLATE_ROUTING_COLLECTION,
  CRM_DOCUMENT_TEMPLATE_ROUTING_DOC_ID,
  type DocumentTemplateRoutingDoc,
  routingFieldForDocumentType,
} from '@/lib/crmSettings/documentTemplateRouting';
import { adminDb } from '@/server/firebaseAdmin';
import type { ManagedDocumentType, TemplateImage } from '@/utils/documentTemplateUtils';
import {
  isHtmlTemplateRecord,
  pickPreferredHtmlTemplate,
  templateMatchesDocumentType,
} from '@/utils/invoiceTemplateSelection';

export type StoredInvoiceHtmlTemplate = {
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

/** Same selection rules as client `getPreferredCustomTemplate` in `receiptGenerator.ts` (shared helper). */
export async function getPreferredHtmlTemplateAdmin(
  documentType: ManagedDocumentType
): Promise<StoredInvoiceHtmlTemplate | null> {
  const snapshot = await adminDb().collection('invoiceTemplates').get();
  const templates = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StoredInvoiceHtmlTemplate));
  return pickPreferredHtmlTemplate(templates, documentType, (t) => t);
}

/**
 * Staff collect-payment PDFs: use the template explicitly chosen in Invoice Manager
 * (`crmSettings/documentTemplateRouting`), otherwise the same auto-pick as the CRM (default → favorite → newest).
 */
export async function getResolvedHtmlTemplateAdmin(
  documentType: ManagedDocumentType
): Promise<StoredInvoiceHtmlTemplate | null> {
  const db = adminDb();
  let preferredId: string | null | undefined;
  try {
    const routingSnap = await db
      .collection(CRM_DOCUMENT_TEMPLATE_ROUTING_COLLECTION)
      .doc(CRM_DOCUMENT_TEMPLATE_ROUTING_DOC_ID)
      .get();
    const routing = routingSnap.data() as DocumentTemplateRoutingDoc | undefined;
    const field = routingFieldForDocumentType(documentType);
    preferredId = routing?.[field] as string | undefined;
  } catch (e) {
    console.warn('getResolvedHtmlTemplateAdmin: could not read crmSettings routing:', e);
  }

  const id = preferredId != null ? String(preferredId).trim() : '';
  if (id) {
    try {
      const docSnap = await db.collection('invoiceTemplates').doc(id).get();
      if (docSnap.exists) {
        const t = { id: docSnap.id, ...docSnap.data() } as StoredInvoiceHtmlTemplate;
        // Pinned from Invoice Manager: field name (`bookingReceiptTemplateId`, etc.) is authoritative.
        if (isHtmlTemplateRecord(t)) {
          if (templateMatchesDocumentType(t, documentType)) {
            return t;
          }
          console.warn(
            `getResolvedHtmlTemplateAdmin: pinned template ${id} has documentType=${JSON.stringify(t.documentType)} (expected ${documentType}) — using it anyway because it was explicitly set for staff PDFs`
          );
          return t;
        }
        console.warn(
          `getResolvedHtmlTemplateAdmin: routing id ${id} is not usable as HTML (missing html or visual-only); falling back to auto-pick`
        );
      } else {
        console.warn(`getResolvedHtmlTemplateAdmin: routing template ${id} not found; falling back to auto-pick`);
      }
    } catch (e) {
      console.warn('getResolvedHtmlTemplateAdmin: failed to load routed template:', e);
    }
  }

  return getPreferredHtmlTemplateAdmin(documentType);
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
