export type GoogleReviewPromptRecord = {
  completed: true;
  taken: boolean;
  reason: string;
  answeredAt: string;
  answeredByUid: string;
  answeredByName: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function visitLooksLikeHearingAidSale(visit: unknown): boolean {
  const v = asRecord(visit);
  if (!v) return false;
  const details = asRecord(v.hearingAidDetails);
  const services = Array.isArray(v.medicalServices) ? v.medicalServices.map(String) : [];
  return Boolean(
    v.hearingAidSale ||
      v.purchaseFromTrial ||
      details?.purchaseFromTrial ||
      v.hearingAidStatus === 'sold' ||
      details?.hearingAidStatus === 'sold' ||
      services.includes('hearing_aid_sale'),
  );
}

export function enquiryHasPersistedGoogleReviewPrompt(enquiry: unknown): boolean {
  const p = asRecord(asRecord(enquiry)?.googleReviewPrompt);
  return p?.completed === true;
}

function visitsFromEnquiry(enquiry: unknown): unknown[] {
  const e = asRecord(enquiry);
  if (!e) return [];
  const visits = Array.isArray(e.visits) ? e.visits : [];
  const schedules = Array.isArray(e.visitSchedules) ? e.visitSchedules : [];
  return [...visits, ...schedules];
}

/**
 * Ask only on the save that first records a hearing-aid sale.
 * Reopening an enquiry that already has a sale (or an answered prompt) never asks again.
 */
export function shouldAskGoogleReviewOnSaleSave(args: {
  existingEnquiry: unknown;
  nextVisits: unknown[] | undefined;
}): boolean {
  if (enquiryHasPersistedGoogleReviewPrompt(args.existingEnquiry)) return false;
  if (visitsFromEnquiry(args.existingEnquiry).some(visitLooksLikeHearingAidSale)) return false;
  const next = Array.isArray(args.nextVisits) ? args.nextVisits : [];
  return next.some(visitLooksLikeHearingAidSale);
}
