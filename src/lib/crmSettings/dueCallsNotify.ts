/** Firestore: who receives daily due-calls digest emails. */
export const CRM_DUE_CALLS_NOTIFY_COLLECTION = 'crmSettings';
export const CRM_DUE_CALLS_NOTIFY_DOC_ID = 'dueCallsNotify';

export type DueCallsNotifyDoc = {
  emails: string[];
  /** Optional allow-list for due-call notifications. Empty => auto by telecaller mapping. */
  notificationUserIds?: string[];
  /** IST hour 0-23 for daily send. */
  sendHourIst?: number;
  /** IST minute 0-59 for daily send. */
  sendMinuteIst?: number;
  /** Master toggle for daily digest. */
  enabled?: boolean;
  updatedAt?: unknown;
};
