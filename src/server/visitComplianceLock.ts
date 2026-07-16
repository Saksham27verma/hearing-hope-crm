import { adminDb } from '@/server/firebaseAdmin';
import {
  CRM_VISIT_COMPLIANCE_LOCK_COLLECTION,
  CRM_VISIT_COMPLIANCE_LOCK_DOC_ID,
  parseVisitComplianceLockEnabled,
} from '@/lib/crmSettings/visitComplianceLock';

/** Server-side: true when booking/trial/sale must wait for home-visit checkout. */
export async function isVisitCompliancePipelineLockEnabled(): Promise<boolean> {
  try {
    const snap = await adminDb()
      .collection(CRM_VISIT_COMPLIANCE_LOCK_COLLECTION)
      .doc(CRM_VISIT_COMPLIANCE_LOCK_DOC_ID)
      .get();
    if (!snap.exists) return false;
    return parseVisitComplianceLockEnabled(snap.data());
  } catch (err) {
    console.error('isVisitCompliancePipelineLockEnabled:', err);
    return false;
  }
}
