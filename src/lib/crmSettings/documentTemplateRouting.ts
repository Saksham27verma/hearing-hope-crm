import type { ManagedDocumentType } from '@/utils/documentTemplateUtils';

/** Firestore: which `invoiceTemplates/{id}` row to use for staff collect-payment PDFs (explicit choice from Invoice Manager). */
export const CRM_DOCUMENT_TEMPLATE_ROUTING_COLLECTION = 'crmSettings';
export const CRM_DOCUMENT_TEMPLATE_ROUTING_DOC_ID = 'documentTemplateRouting';

export type DocumentTemplateRoutingDoc = {
  /** `invoiceTemplates` document id */
  bookingReceiptTemplateId?: string | null;
  trialReceiptTemplateId?: string | null;
  paymentAcknowledgmentTemplateId?: string | null;
  invoiceHtmlTemplateId?: string | null;
  salarySlipTemplateId?: string | null;
  updatedAt?: unknown;
};

export function routingFieldForDocumentType(
  documentType: ManagedDocumentType
): keyof Pick<
  DocumentTemplateRoutingDoc,
  | 'bookingReceiptTemplateId'
  | 'trialReceiptTemplateId'
  | 'paymentAcknowledgmentTemplateId'
  | 'invoiceHtmlTemplateId'
  | 'salarySlipTemplateId'
> {
  if (documentType === 'booking_receipt') return 'bookingReceiptTemplateId';
  if (documentType === 'trial_receipt') return 'trialReceiptTemplateId';
  if (documentType === 'payment_acknowledgment') return 'paymentAcknowledgmentTemplateId';
  if (documentType === 'salary_slip') return 'salarySlipTemplateId';
  return 'invoiceHtmlTemplateId';
}
