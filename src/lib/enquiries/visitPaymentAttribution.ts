/**
 * Which enquiry visit a payment belongs to.
 *
 * Payments carry an optional `relatedVisitId`. Older rows (and generic "partial payment" rows) do not,
 * so we fall back to the payment date: the latest visit on/before that date, preferring one whose
 * services match what the payment was for. Used for per-visit payment receipts and for scoping the
 * payment mode printed on a repeat customer's second (third…) invoice.
 */

type VisitRecord = Record<string, unknown>;

export type PaymentVisitAttribution = {
  visitIndex: number | null;
  /** True when matched by date / service rather than an explicit `relatedVisitId` link. */
  inferred: boolean;
};

export type AttributablePayment = {
  relatedVisitId?: unknown;
  /** YYYY-MM-DD (longer ISO strings are trimmed). */
  date?: unknown;
  /** CRM `paymentFor` or normalized `paymentType`. */
  category?: unknown;
};

function ymd(raw: unknown): string {
  const s = String(raw ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

/** Calendar date of a visit (YYYY-MM-DD), empty when unknown. */
export function visitDateKey(visit: VisitRecord | null | undefined): string {
  if (!visit) return '';
  const had = (visit.hearingAidDetails as VisitRecord | undefined) || {};
  return (
    ymd(visit.visitDate) ||
    ymd(visit.purchaseDate) ||
    ymd(had.purchaseDate) ||
    ymd(visit.bookingDate) ||
    ymd(had.bookingDate) ||
    ymd(visit.trialStartDate) ||
    ymd(had.trialStartDate) ||
    ymd(visit.date)
  );
}

function services(visit: VisitRecord): Set<string> {
  const out = new Set<string>();
  if (Array.isArray(visit.medicalServices)) {
    for (const s of visit.medicalServices) out.add(String(s));
  }
  const had = (visit.hearingAidDetails as VisitRecord | undefined) || {};
  const flag = (key: string, ...values: unknown[]) => {
    if (values.some(Boolean)) out.add(key);
  };
  flag('hearing_test', visit.hearingTest);
  flag('ent_service', visit.entService);
  flag('hearing_aid_trial', visit.hearingAidTrial, visit.trialGiven, had.trialGiven);
  flag('hearing_aid_booked', visit.hearingAidBooked, visit.bookingFromTrial, had.bookingFromTrial);
  flag(
    'hearing_aid_sale',
    visit.hearingAidSale,
    visit.purchaseFromTrial,
    had.purchaseFromTrial,
    visit.hearingAidStatus === 'sold',
    had.hearingAidStatus === 'sold',
  );
  flag('accessory', visit.accessory);
  flag('programming', visit.programming);
  flag('repair', visit.repair);
  return out;
}

/** True when the visit is an explicit hearing-aid sale (one invoice per such visit). */
export function isSaleVisitRecord(visit: VisitRecord | null | undefined): boolean {
  if (!visit) return false;
  return services(visit).has('hearing_aid_sale');
}

/** Service keys a payment category can settle; `null` means "any billable service". */
function servicesForCategory(category: string): string[] | null {
  switch (category) {
    case 'hearing_test':
    case 'hearing_aid_test':
      return ['hearing_test'];
    case 'ent_service':
      return ['ent_service'];
    case 'booking_advance':
    case 'hearing_aid_booking':
      return ['hearing_aid_booked'];
    case 'hearing_aid':
    case 'hearing_aid_sale':
      return ['hearing_aid_sale', 'hearing_aid_booked'];
    case 'accessory':
    case 'accessories':
      return ['accessory'];
    case 'programming':
      return ['programming'];
    case 'trial_home_security_deposit':
    case 'trial_home_security_deposit_refund':
    case 'staff_trial_request':
      return ['hearing_aid_trial'];
    default:
      return null;
  }
}

/** Categories that never belong on a hearing-aid tax invoice (test / ENT / programming fees). */
export function isNonSalePaymentCategory(category: unknown): boolean {
  const c = String(category ?? '').trim();
  return (
    c === 'hearing_test' ||
    c === 'hearing_aid_test' ||
    c === 'ent_service' ||
    c === 'programming'
  );
}

function visitMatchesCategory(visit: VisitRecord, category: string): boolean {
  const wanted = servicesForCategory(category);
  const have = services(visit);
  if (wanted === null) return have.size > 0;
  return wanted.some((s) => have.has(s));
}

/** Array position of the visit with this id (first match), or -1. */
export function visitIndexById(visits: unknown, id: unknown): number {
  const want = String(id ?? '').trim();
  if (!want || !Array.isArray(visits)) return -1;
  return visits.findIndex((v) => String((v as VisitRecord | null)?.id ?? '').trim() === want);
}

/** Visit indices in chronological order (date, then array position). Undated visits keep their position. */
export function chronologicalVisitOrder(visits: unknown): number[] {
  const arr = Array.isArray(visits) ? (visits as VisitRecord[]) : [];
  const keyed = arr.map((v, i) => ({ i, key: visitDateKey(v) }));
  // Undated visits inherit the previous dated visit's key so they stay near their neighbours.
  let carry = '';
  for (const row of keyed) {
    if (row.key) carry = row.key;
    else row.key = carry;
  }
  return keyed
    .sort((a, b) => (a.key === b.key ? a.i - b.i : a.key < b.key ? -1 : 1))
    .map((r) => r.i);
}

export function attributePaymentToVisit(
  payment: AttributablePayment,
  visits: unknown,
): PaymentVisitAttribution {
  const arr = Array.isArray(visits) ? (visits as VisitRecord[]) : [];
  if (arr.length === 0) return { visitIndex: null, inferred: false };

  const explicit = visitIndexById(arr, payment.relatedVisitId);
  if (explicit >= 0) return { visitIndex: explicit, inferred: false };

  if (arr.length === 1) return { visitIndex: 0, inferred: true };

  const payDate = ymd(payment.date);
  if (!payDate) return { visitIndex: null, inferred: false };

  const category = String(payment.category ?? '').trim();
  const dated = arr
    .map((v, i) => ({ i, key: visitDateKey(v), v }))
    .filter((r) => r.key)
    .sort((a, b) => (a.key === b.key ? a.i - b.i : a.key < b.key ? -1 : 1));
  if (dated.length === 0) return { visitIndex: null, inferred: false };

  const onOrBefore = dated.filter((r) => r.key <= payDate);
  if (onOrBefore.length === 0) {
    // Paid before the first recorded visit (e.g. advance taken on the phone) — earliest visit.
    return { visitIndex: dated[0].i, inferred: true };
  }
  for (let k = onOrBefore.length - 1; k >= 0; k--) {
    if (visitMatchesCategory(onOrBefore[k].v, category)) {
      return { visitIndex: onOrBefore[k].i, inferred: true };
    }
  }
  return { visitIndex: onOrBefore[onOrBefore.length - 1].i, inferred: true };
}

/**
 * The sale visit whose purchase cycle a visit falls in. A cycle runs from just after the previous
 * sale visit up to and including this sale; visits after the last sale belong to the last sale.
 * Returns null when the enquiry has no sale visits.
 */
export function saleCycleVisitIndexFor(visits: unknown, visitIndex: number | null): number | null {
  if (visitIndex == null || visitIndex < 0) return null;
  const arr = Array.isArray(visits) ? (visits as VisitRecord[]) : [];
  if (visitIndex >= arr.length) return null;
  const order = chronologicalVisitOrder(arr);
  const pos = order.indexOf(visitIndex);
  if (pos < 0) return null;
  for (let p = pos; p < order.length; p++) {
    if (isSaleVisitRecord(arr[order[p]])) return order[p];
  }
  for (let p = pos - 1; p >= 0; p--) {
    if (isSaleVisitRecord(arr[order[p]])) return order[p];
  }
  return null;
}

/** Prefer flat `visits`; fall back to `visitSchedules` (same ids / order). */
export function enquiryVisitsForAttribution(enquiry: Record<string, unknown> | null | undefined): VisitRecord[] {
  if (!enquiry) return [];
  if (Array.isArray(enquiry.visits) && enquiry.visits.length > 0) return enquiry.visits as VisitRecord[];
  if (Array.isArray(enquiry.visitSchedules)) return enquiry.visitSchedules as VisitRecord[];
  return [];
}

/** "Visit 2 · 12 Oct 2026" — position-based so it matches the visit tabs. */
export function visitDisplayLabel(visits: unknown, visitIndex: number | null | undefined): string {
  if (visitIndex == null || visitIndex < 0) return 'Not linked to a visit';
  const arr = Array.isArray(visits) ? (visits as VisitRecord[]) : [];
  const key = visitDateKey(arr[visitIndex]);
  if (!key) return `Visit ${visitIndex + 1}`;
  const d = new Date(`${key}T12:00:00`);
  const pretty = Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `Visit ${visitIndex + 1} · ${pretty}`;
}
