/** Firestore: who receives daily due-calls digest emails. */
export const CRM_DUE_CALLS_NOTIFY_COLLECTION = 'crmSettings';
export const CRM_DUE_CALLS_NOTIFY_DOC_ID = 'dueCallsNotify';

export type DueCallsNotifyDoc = {
  emails: string[];
  updatedAt?: unknown;
};
