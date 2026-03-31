/** Firestore: who receives staff payment PDF emails from `collect-payment`. */
export const CRM_STAFF_PAYMENT_NOTIFY_COLLECTION = 'crmSettings';
export const CRM_STAFF_PAYMENT_NOTIFY_DOC_ID = 'staffPaymentNotify';

export type StaffPaymentNotifyDoc = {
  emails: string[];
  updatedAt?: unknown;
};
