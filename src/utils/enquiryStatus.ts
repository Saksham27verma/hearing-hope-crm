export type EnquiryJourneyStatus =
  | 'enquiry'
  | 'in_process'
  | 'in_trial'
  | 'booked'
  | 'sold'
  | 'not_interested'
  | 'completed';

export type EnquiryStatusChipColor =
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

export const ENQUIRY_STATUS_OPTIONS: Array<{ value: EnquiryJourneyStatus; label: string }> = [
  { value: 'enquiry', label: 'New Enquiry' },
  { value: 'in_process', label: 'In Process' },
  { value: 'in_trial', label: 'In Trial' },
  { value: 'booked', label: 'Booked' },
  { value: 'sold', label: 'Sold' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'completed', label: 'Completed' },
];

const VALID_OVERRIDE = new Set<string>(ENQUIRY_STATUS_OPTIONS.map((o) => o.value));

const normalize = (value: any) => String(value || '').toLowerCase();

const JOURNEY_META: Record<
  EnquiryJourneyStatus,
  { label: string; color: EnquiryStatusChipColor }
> = {
  enquiry: { label: 'New Enquiry', color: 'default' },
  in_process: { label: 'In Process', color: 'info' },
  in_trial: { label: 'In Trial', color: 'warning' },
  booked: { label: 'Booked', color: 'primary' },
  sold: { label: 'Sold', color: 'success' },
  not_interested: { label: 'Not Interested', color: 'error' },
  completed: { label: 'Completed', color: 'success' },
};

/** Firestore `journeyStatusOverride`: set to a journey key to pin the chip; null/omit for auto. */
export const parseJourneyStatusOverride = (raw: any): EnquiryJourneyStatus | null => {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!VALID_OVERRIDE.has(s)) return null;
  return s as EnquiryJourneyStatus;
};

export const journeyKeyToMeta = (
  key: EnquiryJourneyStatus
): { key: EnquiryJourneyStatus; label: string; color: EnquiryStatusChipColor } => ({
  key,
  ...JOURNEY_META[key],
});

const getVisitSchedules = (enquiry: any): any[] => {
  if (Array.isArray(enquiry?.visitSchedules) && enquiry.visitSchedules.length > 0) {
    return enquiry.visitSchedules;
  }
  if (Array.isArray(enquiry?.visits) && enquiry.visits.length > 0) {
    return enquiry.visits;
  }
  return [];
};

/**
 * Saved visits use `medicalServices` + nested `hearingAidDetails`; journey derivation originally
 * expected flat flags on the visit. Merge both shapes so last-visit status matches the CRM form.
 */
const expandVisitForJourney = (visit: any): any => {
  if (!visit || typeof visit !== 'object') return visit;
  const ha =
    visit.hearingAidDetails && typeof visit.hearingAidDetails === 'object'
      ? visit.hearingAidDetails
      : {};
  const ms = Array.isArray(visit.medicalServices) ? visit.medicalServices : [];
  const has = (code: string) => ms.includes(code);

  return {
    ...visit,
    hearingAidSale:
      Boolean(visit.hearingAidSale) ||
      has('hearing_aid_sale') ||
      has('hearing_aid'),
    hearingAidBooked: Boolean(visit.hearingAidBooked) || has('hearing_aid_booked'),
    hearingAidTrial: Boolean(visit.hearingAidTrial) || has('hearing_aid_trial'),
    hearingTest: Boolean(visit.hearingTest) || has('hearing_test'),
    purchaseFromTrial: Boolean(visit.purchaseFromTrial) || Boolean(ha.purchaseFromTrial),
    trialGiven: Boolean(visit.trialGiven) || Boolean(ha.trialGiven),
    bookingAdvanceAmount:
      Number(visit.bookingAdvanceAmount ?? ha.bookingAdvanceAmount ?? 0) || 0,
    hearingAidStatus: visit.hearingAidStatus || ha.hearingAidStatus || '',
    trialResult: visit.trialResult || ha.trialResult || '',
  };
};

const getVisitSortTime = (visit: any): number => {
  const candidates = [visit?.visitDate, visit?.date, visit?.bookingDate, visit?.trialStartDate];
  for (const c of candidates) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (Number.isFinite(t)) return t;
  }
  const ca = visit?.createdAt;
  if (ca && typeof ca.toMillis === 'function') return ca.toMillis();
  if (typeof ca?.seconds === 'number') return ca.seconds * 1000;
  return 0;
};

const isVisitCancelled = (visit: any): boolean =>
  normalize(visit?.visitStatus) === 'cancelled' || normalize(visit?.status) === 'cancelled';

const visitHasHaSignals = (visit: any): boolean => {
  if (!visit) return false;
  const v = expandVisitForJourney(visit);
  if (v.hearingAidSale || v.purchaseFromTrial) return true;
  if (v.hearingAidBooked || Number(v.bookingAdvanceAmount || 0) > 0) return true;
  if (v.hearingAidTrial || v.trialGiven) return true;
  const hs = normalize(v.hearingAidStatus);
  if (
    ['not_interested', 'sold', 'booked', 'trial_given', 'trial_completed', 'trial_extended'].includes(
      hs
    )
  ) {
    return true;
  }
  const tr = normalize(v.trialResult);
  if (['unsuccessful', 'ongoing', 'extended'].includes(tr)) return true;
  return false;
};

/**
 * Prefer the latest visit by date. Pure "cancelled" placeholder rows (no HA activity) are skipped
 * so a follow-up cancellation does not hide an earlier sale/booking/trial.
 */
const pickVisitForStatus = (schedules: any[]): any | undefined => {
  if (!schedules.length) return undefined;
  const sorted = [...schedules].sort((a, b) => {
    const tb = getVisitSortTime(b);
    const ta = getVisitSortTime(a);
    return tb - ta;
  });
  for (const v of sorted) {
    if (!isVisitCancelled(v) || visitHasHaSignals(v)) return v;
  }
  return sorted[0];
};

const deriveFromLastVisit = (
  enquiry: any
): { key: EnquiryJourneyStatus; label: string; color: EnquiryStatusChipColor } => {
  const schedules = getVisitSchedules(enquiry);
  const financialStatus = normalize(enquiry?.financialSummary?.paymentStatus);
  const hasAnyProgress =
    schedules.length > 0 ||
    (Array.isArray(enquiry?.followUps) && enquiry.followUps.length > 0) ||
    Boolean(enquiry?.assignedTo) ||
    Boolean(enquiry?.telecaller);

  if (schedules.length === 0) {
    if (hasAnyProgress) return journeyKeyToMeta('in_process');
    return journeyKeyToMeta('enquiry');
  }

  const raw = pickVisitForStatus(schedules);
  if (!raw) {
    if (hasAnyProgress) return journeyKeyToMeta('in_process');
    return journeyKeyToMeta('enquiry');
  }

  const v = expandVisitForJourney(raw);

  if (isVisitCancelled(raw) && !visitHasHaSignals(raw)) {
    return { key: 'in_process', label: 'Latest visit cancelled', color: 'default' };
  }

  if (
    normalize(v.hearingAidStatus) === 'not_interested' ||
    normalize(v.trialResult) === 'unsuccessful'
  ) {
    return journeyKeyToMeta('not_interested');
  }

  if (
    Boolean(v.hearingAidSale) ||
    Boolean(v.purchaseFromTrial) ||
    normalize(v.hearingAidStatus) === 'sold'
  ) {
    if (financialStatus === 'fully_paid') return journeyKeyToMeta('completed');
    return journeyKeyToMeta('sold');
  }

  if (
    Boolean(v.hearingAidBooked) ||
    Number(v.bookingAdvanceAmount || 0) > 0 ||
    normalize(v.hearingAidStatus) === 'booked'
  ) {
    return journeyKeyToMeta('booked');
  }

  const trNorm = normalize(v.trialResult);
  const trialResultMeansActive =
    ['ongoing', 'extended'].includes(trNorm) &&
    (Boolean(v.hearingAidTrial) || Boolean(v.trialGiven));
  if (
    Boolean(v.hearingAidTrial) ||
    Boolean(v.trialGiven) ||
    ['trial_given', 'trial_completed', 'trial_extended'].includes(normalize(v.hearingAidStatus)) ||
    trialResultMeansActive
  ) {
    return journeyKeyToMeta('in_trial');
  }

  if (normalize(v.visitStatus) === 'completed' || normalize(v.status) === 'completed') {
    return journeyKeyToMeta('in_process');
  }

  if (hasAnyProgress) return journeyKeyToMeta('in_process');
  return journeyKeyToMeta('enquiry');
};

export const getEnquiryStatusMeta = (
  enquiry: any
): {
  key: EnquiryJourneyStatus;
  label: string;
  color: EnquiryStatusChipColor;
  source: 'manual' | 'auto';
} => {
  const manual = parseJourneyStatusOverride(enquiry?.journeyStatusOverride);
  if (manual) {
    return { ...journeyKeyToMeta(manual), source: 'manual' };
  }
  return { ...deriveFromLastVisit(enquiry), source: 'auto' };
};
