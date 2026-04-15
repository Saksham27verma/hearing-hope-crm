export type EnquiryJourneyStatus =
  | 'in_process'
  | 'ent'
  | 'tests_only'
  | 'accessory'
  | 'programming'
  | 'repair'
  | 'in_trial'
  | 'booked'
  | 'sold'
  | 'not_interested'
  | 'bought_elsewhere'
  /** @deprecated Derived pipeline no longer emits this; kept for legacy Firestore */
  | 'enquiry'
  /** @deprecated Use sold; kept for legacy */
  | 'completed';

export type EnquiryStatusChipColor =
  'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

/** Values stored on `enquiries.leadOutcome` (optional closure / note for tagging). */
export const LEAD_OUTCOME_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'bought_elsewhere', label: 'Bought hearing aids elsewhere' },
] as const;

export const ENQUIRY_STATUS_OPTIONS: Array<{ value: EnquiryJourneyStatus; label: string }> = [
  { value: 'in_process', label: 'In Process' },
  { value: 'ent', label: 'ENT' },
  { value: 'tests_only', label: 'Tests only' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'programming', label: 'Programming' },
  { value: 'repair', label: 'Repair' },
  { value: 'in_trial', label: 'In Trial' },
  { value: 'booked', label: 'Booked' },
  { value: 'sold', label: 'Sold' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'bought_elsewhere', label: 'Bought elsewhere' },
];

const VALID_OVERRIDE = new Set<string>([
  ...ENQUIRY_STATUS_OPTIONS.map((o) => o.value),
  'enquiry',
  'completed',
]);

const normalize = (value: any) => String(value || '').toLowerCase();

const JOURNEY_META: Record<
  EnquiryJourneyStatus,
  { label: string; color: EnquiryStatusChipColor }
> = {
  in_process: { label: 'In Process', color: 'info' },
  ent: { label: 'ENT', color: 'secondary' },
  tests_only: { label: 'Tests only', color: 'info' },
  accessory: { label: 'Accessory', color: 'secondary' },
  programming: { label: 'Programming', color: 'secondary' },
  repair: { label: 'Repair', color: 'secondary' },
  in_trial: { label: 'In Trial', color: 'warning' },
  booked: { label: 'Booked', color: 'primary' },
  sold: { label: 'Sold', color: 'success' },
  not_interested: { label: 'Not Interested', color: 'error' },
  bought_elsewhere: { label: 'Bought elsewhere', color: 'warning' },
  enquiry: { label: 'In Process', color: 'info' },
  completed: { label: 'Sold', color: 'success' },
};

/**
 * Firestore `journeyStatusOverride`: optional manual tag for quick corrections from the list/profile chip.
 * Cleared when the enquiry form is saved so visits + lead outcome drive the tag again.
 */
export const parseJourneyStatusOverride = (raw: any): EnquiryJourneyStatus | null => {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!VALID_OVERRIDE.has(s)) return null;
  if (s === 'enquiry') return 'in_process';
  if (s === 'completed') return 'sold';
  return s as EnquiryJourneyStatus;
};

export const journeyKeyToMeta = (
  key: EnquiryJourneyStatus
): { key: EnquiryJourneyStatus; label: string; color: EnquiryStatusChipColor } => {
  const meta = JOURNEY_META[key];
  if (!meta) {
    return { key: 'in_process', label: 'In Process', color: 'info' };
  }
  return { key, ...meta };
};

const getVisitSchedules = (enquiry: any): any[] => {
  if (Array.isArray(enquiry?.visitSchedules) && enquiry.visitSchedules.length > 0) {
    return enquiry.visitSchedules;
  }
  if (Array.isArray(enquiry?.visits) && enquiry.visits.length > 0) {
    return enquiry.visits;
  }
  return [];
};

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
    entService: Boolean(visit.entService) || has('ent_service'),
    purchaseFromTrial: Boolean(visit.purchaseFromTrial) || Boolean(ha.purchaseFromTrial),
    trialGiven: Boolean(visit.trialGiven) || Boolean(ha.trialGiven),
    bookingFromTrial: Boolean(visit.bookingFromTrial) || Boolean(ha.bookingFromTrial),
    bookingAdvanceAmount:
      Number(visit.bookingAdvanceAmount ?? ha.bookingAdvanceAmount ?? 0) || 0,
    hearingAidStatus: visit.hearingAidStatus || ha.hearingAidStatus || '',
    trialResult: visit.trialResult || ha.trialResult || '',
  };
};

const isTrialOnlyVisit = (v: ReturnType<typeof expandVisitForJourney>): boolean =>
  Boolean(v.hearingAidTrial) && !v.hearingAidBooked && !v.bookingFromTrial;

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
  const trialOnly = isTrialOnlyVisit(v);
  if (v.hearingAidBooked || (!trialOnly && Number(v.bookingAdvanceAmount || 0) > 0)) {
    return true;
  }
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

/** Higher = further in funnel; max wins across visits. */
const RANK = {
  in_process: 20,
  ent: 26,
  tests_only: 28,
  accessory: 30,
  programming: 31,
  repair: 32,
  in_trial: 35,
  booked: 45,
  sold: 55,
  not_interested: 60,
} as const;

const rankToKey = (rank: number): EnquiryJourneyStatus => {
  if (rank >= RANK.not_interested) return 'not_interested';
  if (rank >= RANK.sold) return 'sold';
  if (rank >= RANK.booked) return 'booked';
  if (rank >= RANK.in_trial) return 'in_trial';
  if (rank >= RANK.repair) return 'repair';
  if (rank >= RANK.programming) return 'programming';
  if (rank >= RANK.accessory) return 'accessory';
  if (rank >= RANK.tests_only) return 'tests_only';
  if (rank >= RANK.ent) return 'ent';
  return 'in_process';
};

/** ENT service only — no hearing test, HA, or other services on this visit. */
const isEntOnlyVisit = (raw: any): boolean => {
  const v = expandVisitForJourney(raw);
  if (!v.entService) return false;
  if (
    v.hearingAidSale ||
    v.purchaseFromTrial ||
    v.hearingAidBooked ||
    v.hearingAidTrial ||
    v.trialGiven ||
    v.hearingTest
  ) {
    return false;
  }
  if (raw.accessory || raw.programming || raw.repair || raw.counselling || raw.salesReturn) {
    return false;
  }
  const ms = Array.isArray(raw.medicalServices) ? raw.medicalServices : [];
  const other = ms.filter((s: string) => s !== 'ent_service');
  return other.length === 0;
};

/** Hearing test (or PTA) only — no HA trial/booking/sale or other services on this visit. */
const isHearingTestOnlyVisit = (raw: any): boolean => {
  const v = expandVisitForJourney(raw);
  if (!v.hearingTest) return false;
  if (
    v.hearingAidSale ||
    v.purchaseFromTrial ||
    v.hearingAidBooked ||
    v.hearingAidTrial ||
    v.trialGiven
  ) {
    return false;
  }
  if (raw.accessory || raw.programming || raw.repair || raw.counselling || raw.salesReturn) {
    return false;
  }
  const ms = Array.isArray(raw.medicalServices) ? raw.medicalServices : [];
  const other = ms.filter((s: string) => s !== 'hearing_test');
  if (other.length > 0) return false;
  return true;
};

/** Accessory-only visit — no HA/test/programming/repair/counselling/sales-return signals. */
const isAccessoryOnlyVisit = (raw: any): boolean => {
  const v = expandVisitForJourney(raw);
  if (!Boolean(raw?.accessory)) return false;
  if (
    v.hearingAidSale ||
    v.purchaseFromTrial ||
    v.hearingAidBooked ||
    v.hearingAidTrial ||
    v.trialGiven ||
    v.hearingTest
  ) {
    return false;
  }
  if (raw.programming || raw.repair || raw.counselling || raw.salesReturn) {
    return false;
  }
  const ms = Array.isArray(raw.medicalServices) ? raw.medicalServices : [];
  const other = ms.filter((s: string) => s !== 'accessory');
  return other.length === 0;
};

/** Programming-only visit — no HA/test/accessory/repair/counselling/sales-return signals. */
const isProgrammingOnlyVisit = (raw: any): boolean => {
  const v = expandVisitForJourney(raw);
  if (!Boolean(raw?.programming)) return false;
  if (
    v.hearingAidSale ||
    v.purchaseFromTrial ||
    v.hearingAidBooked ||
    v.hearingAidTrial ||
    v.trialGiven ||
    v.hearingTest
  ) {
    return false;
  }
  if (raw.accessory || raw.repair || raw.counselling || raw.salesReturn) {
    return false;
  }
  const ms = Array.isArray(raw.medicalServices) ? raw.medicalServices : [];
  const other = ms.filter((s: string) => s !== 'programming');
  return other.length === 0;
};

const deriveVisitRank = (raw: any): number => {
  const v = expandVisitForJourney(raw);

  if (normalize(v.hearingAidStatus) === 'not_interested' || normalize(v.trialResult) === 'unsuccessful') {
    return RANK.not_interested;
  }

  if (
    Boolean(v.hearingAidSale) ||
    Boolean(v.purchaseFromTrial) ||
    normalize(v.hearingAidStatus) === 'sold'
  ) {
    return RANK.sold;
  }

  const trialOnly = isTrialOnlyVisit(v);
  const hasBookingSignal =
    Boolean(v.hearingAidBooked) ||
    normalize(v.hearingAidStatus) === 'booked' ||
    (!trialOnly && Number(v.bookingAdvanceAmount || 0) > 0);

  if (hasBookingSignal) {
    return RANK.booked;
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
    return RANK.in_trial;
  }

  if (isEntOnlyVisit(raw)) {
    return RANK.ent;
  }

  if (isHearingTestOnlyVisit(raw)) {
    return RANK.tests_only;
  }

  if (isAccessoryOnlyVisit(raw)) {
    return RANK.accessory;
  }

  if (isProgrammingOnlyVisit(raw)) {
    return RANK.programming;
  }

  const ms = Array.isArray(raw?.medicalServices) ? raw.medicalServices : [];
  const hasRepairSignal =
    Boolean(raw?.repair) ||
    ms.includes('repair') ||
    normalize(raw?.medicalService) === 'repair';
  if (hasRepairSignal) {
    return RANK.repair;
  }

  if (normalize(v.visitStatus) === 'completed' || normalize(v.status) === 'completed') {
    return RANK.in_process;
  }

  return RANK.in_process;
};

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

const deriveFromVisitsFunnel = (
  enquiry: any
): { key: EnquiryJourneyStatus; label: string; color: EnquiryStatusChipColor } => {
  const schedules = getVisitSchedules(enquiry);

  if (schedules.length === 0) {
    return journeyKeyToMeta('in_process');
  }

  let maxRank = -1;
  for (const visit of schedules) {
    if (isVisitCancelled(visit) && !visitHasHaSignals(visit)) continue;
    const r = deriveVisitRank(visit);
    if (r > maxRank) maxRank = r;
  }

  if (maxRank < 0) {
    const raw = pickVisitForStatus(schedules);
    if (raw && isVisitCancelled(raw) && !visitHasHaSignals(raw)) {
      return { key: 'in_process', label: 'Latest visit cancelled', color: 'default' };
    }
    return journeyKeyToMeta('in_process');
  }

  const key = rankToKey(maxRank);

  if (
    normalize(enquiry?.leadOutcome) === 'bought_elsewhere' &&
    maxRank < RANK.booked
  ) {
    return journeyKeyToMeta('bought_elsewhere');
  }

  return journeyKeyToMeta(key);
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
  return { ...deriveFromVisitsFunnel(enquiry), source: 'auto' };
};
