/** Firestore: sale milestone CRM notification recipients. */
export const CRM_SALE_MILESTONE_NOTIFY_COLLECTION = 'crmSettings';
export const CRM_SALE_MILESTONE_NOTIFY_DOC_ID = 'saleMilestoneNotify';

export type SaleMilestoneNotifyDoc = {
  notificationUserIds?: string[];
  enabled?: boolean;
  updatedAt?: unknown;
};
