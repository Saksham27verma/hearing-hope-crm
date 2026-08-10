/**
 * Incentive rules engine.
 *
 * Kept as pure TS (no Firestore, no React) so it is easy to test and easy to
 * extend when new employees / rule shapes are added.
 *
 * Current employees:
 *   - Mohit Kumar (telecaller / receptionist)
 *       - ₹100 per non-cancelled sale where he has a call record AND the enquiry
 *         reference is "Indiamart" or "Online".
 *       - ₹50 per non-cancelled sale where he has a call record (any other reference).
 *       - Manual sales (no linked enquiry) are ignored.
 */

export type FollowUpLike = {
  callerName?: string | null;
};

export type EnquiryLike = {
  id?: string;
  reference?: unknown;
  telecaller?: string | null;
  followUps?: FollowUpLike[] | null;
};

export type SaleLike = {
  id?: string;
  enquiryId?: string | null;
  source?: string | null;
  cancelled?: boolean | null;
};

export interface IncentiveRule {
  /** Stable id, e.g. `reference-boost` — surfaced in the UI so you can audit which rule fired. */
  id: string;
  label: string;
  amount: number;
  /**
   * Predicate that decides whether this rule applies to a given (sale, enquiry) pair.
   * Rules are evaluated in order; the FIRST matching rule wins (so put boosts before base).
   */
  applies: (ctx: IncentiveContext) => boolean;
}

export interface IncentiveEmployee {
  id: string;
  displayName: string;
  role: string;
  /**
   * Names to match against `followUps[].callerName` / `enquiry.telecaller`.
   * Matching is case-insensitive and whitespace-trimmed.
   */
  matchNames: string[];
  rules: IncentiveRule[];
}

export interface IncentiveContext {
  sale: SaleLike;
  enquiry: EnquiryLike | null;
  employee: IncentiveEmployee;
  /** True if any follow-up on the enquiry has `callerName` matching one of `employee.matchNames`. */
  hasCallRecord: boolean;
  /** Matched caller names taken verbatim from the follow-ups (for display). */
  matchedCallerNames: string[];
  /** Normalized reference values (lowercased, trimmed). */
  referenceValues: string[];
}

export interface IncentiveResult {
  amount: number;
  ruleId: string | null;
  ruleLabel: string | null;
  hasCallRecord: boolean;
  matchedCallerNames: string[];
  referenceValues: string[];
}

const REFERENCE_BOOST_VALUES = new Set(['indiamart', 'online']);

function normalize(name: unknown): string {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function extractReferenceList(reference: unknown): string[] {
  if (Array.isArray(reference)) {
    return reference
      .map((r) => normalize(r))
      .filter((r) => r.length > 0);
  }
  if (typeof reference === 'string') {
    const norm = normalize(reference);
    return norm ? [norm] : [];
  }
  return [];
}

function collectMatchedCallers(enquiry: EnquiryLike | null, matchSet: Set<string>): string[] {
  if (!enquiry) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const followUps = Array.isArray(enquiry.followUps) ? enquiry.followUps : [];
  for (const fu of followUps) {
    const raw = typeof fu?.callerName === 'string' ? fu.callerName.trim() : '';
    if (!raw) continue;
    if (!matchSet.has(raw.toLowerCase())) continue;
    if (seen.has(raw.toLowerCase())) continue;
    seen.add(raw.toLowerCase());
    out.push(raw);
  }
  return out;
}

export function buildIncentiveContext(
  sale: SaleLike,
  enquiry: EnquiryLike | null,
  employee: IncentiveEmployee,
): IncentiveContext {
  const matchSet = new Set(employee.matchNames.map((n) => n.trim().toLowerCase()));
  const matchedCallerNames = collectMatchedCallers(enquiry, matchSet);
  return {
    sale,
    enquiry,
    employee,
    hasCallRecord: matchedCallerNames.length > 0,
    matchedCallerNames,
    referenceValues: extractReferenceList(enquiry?.reference),
  };
}

export function computeIncentiveForSale(
  sale: SaleLike,
  enquiry: EnquiryLike | null,
  employee: IncentiveEmployee,
): IncentiveResult {
  const ctx = buildIncentiveContext(sale, enquiry, employee);

  if (sale.cancelled === true) {
    return {
      amount: 0,
      ruleId: null,
      ruleLabel: null,
      hasCallRecord: ctx.hasCallRecord,
      matchedCallerNames: ctx.matchedCallerNames,
      referenceValues: ctx.referenceValues,
    };
  }

  for (const rule of employee.rules) {
    if (rule.applies(ctx)) {
      return {
        amount: rule.amount,
        ruleId: rule.id,
        ruleLabel: rule.label,
        hasCallRecord: ctx.hasCallRecord,
        matchedCallerNames: ctx.matchedCallerNames,
        referenceValues: ctx.referenceValues,
      };
    }
  }

  return {
    amount: 0,
    ruleId: null,
    ruleLabel: null,
    hasCallRecord: ctx.hasCallRecord,
    matchedCallerNames: ctx.matchedCallerNames,
    referenceValues: ctx.referenceValues,
  };
}

const MOHIT_KUMAR: IncentiveEmployee = {
  id: 'mohit_kumar',
  displayName: 'Mohit Kumar',
  role: 'Telecaller / Receptionist',
  matchNames: ['Mohit Kumar', 'Mohit'],
  rules: [
    {
      id: 'reference-boost',
      label: '₹100 — Indiamart / Online reference (his call record)',
      amount: 100,
      applies: (ctx) =>
        ctx.hasCallRecord &&
        ctx.referenceValues.some((r) => REFERENCE_BOOST_VALUES.has(r)),
    },
    {
      id: 'base-per-call-sale',
      label: '₹50 — sale with his call record',
      amount: 50,
      applies: (ctx) => ctx.hasCallRecord,
    },
  ],
};

export const INCENTIVE_EMPLOYEES: IncentiveEmployee[] = [MOHIT_KUMAR];

export function getIncentiveEmployee(id: string): IncentiveEmployee | null {
  return INCENTIVE_EMPLOYEES.find((e) => e.id === id) ?? null;
}
