import type { Firestore } from 'firebase-admin/firestore';
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

async function loadHtmlTemplateByIdForStaffPdf(
  db: Firestore,
  id: string
): Promise<StoredInvoiceHtmlTemplate | null> {
  const trimmed = String(id).trim();
  if (!trimmed) return null;
  try {
    const docSnap = await db.collection('invoiceTemplates').doc(trimmed).get();
    if (!docSnap.exists) return null;
    const t = { id: docSnap.id, ...docSnap.data() } as StoredInvoiceHtmlTemplate;
    if (!isHtmlTemplateRecord(t)) return null;
    return t;
  } catch (e) {
    console.warn('loadHtmlTemplateByIdForStaffPdf:', e);
    return null;
  }
}

export type ResolveHtmlTemplateOptions = {
  /** From staff app body — same Firestore id the app showed; takes precedence over CRM routing doc. */
  overrideTemplateId?: string | null;
};

/**
 * Staff collect-payment PDFs: optional **app override** id first, then Invoice Manager routing
 * (`crmSettings/documentTemplateRouting`), then the same auto-pick as the CRM browser flow.
 */
export async function getResolvedHtmlTemplateAdmin(
  documentType: ManagedDocumentType,
  options?: ResolveHtmlTemplateOptions
): Promise<StoredInvoiceHtmlTemplate | null> {
  const db = adminDb();
  const override = options?.overrideTemplateId;
  if (override != null && String(override).trim()) {
    const t = await loadHtmlTemplateByIdForStaffPdf(db, String(override));
    if (t) {
      if (!templateMatchesDocumentType(t, documentType)) {
        console.warn(
          `getResolvedHtmlTemplateAdmin: override template ${t.id} documentType=${JSON.stringify(t.documentType)} (expected ${documentType}) — using anyway (explicit app/CRM choice)`
        );
      }
      console.info(`getResolvedHtmlTemplateAdmin: using overrideTemplateId=${t.id} for ${documentType}`);
      return t;
    }
    console.warn(
      `getResolvedHtmlTemplateAdmin: overrideTemplateId ${override} not found or not HTML; falling back to routing`
    );
  }

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
    const t = await loadHtmlTemplateByIdForStaffPdf(db, id);
    if (t) {
      if (!templateMatchesDocumentType(t, documentType)) {
        console.warn(
          `getResolvedHtmlTemplateAdmin: pinned template ${id} has documentType=${JSON.stringify(t.documentType)} (expected ${documentType}) — using it anyway (CRM routing)`
        );
      }
      console.info(`getResolvedHtmlTemplateAdmin: using crmSettings routing id=${t.id} for ${documentType}`);
      return t;
    }
    console.warn(`getResolvedHtmlTemplateAdmin: routing template ${id} not found or invalid HTML; falling back to auto-pick`);
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
