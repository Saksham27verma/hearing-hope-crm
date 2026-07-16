/** Firestore: require home-visit PWA checkout before booking / trial / sale. */
export const CRM_VISIT_COMPLIANCE_LOCK_COLLECTION = 'crmSettings';
export const CRM_VISIT_COMPLIANCE_LOCK_DOC_ID = 'visitComplianceLock';

export type VisitComplianceLockDoc = {
  /** When true, Sale/Booking (CRM) and booking/trial/sale (staff PWA) stay locked until checkout is complete. */
  enabled?: boolean;
  updatedAt?: unknown;
};

/** Lock is opt-in: missing/false = unlocked (training / gradual rollout). */
export function parseVisitComplianceLockEnabled(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return (data as VisitComplianceLockDoc).enabled === true;
}
