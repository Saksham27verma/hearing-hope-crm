/**
 * Incentive rules engine.
 *
 * Kept as pure TS (no Firestore, no React) so it is easy to test and easy to
 * extend when new employees / rule shapes are added.
 *
 * Current employees:
 *   - Mohit Kumar (telecaller / receptionist) — enquiry-based
 *       - ₹100 per non-cancelled sale where he has a call record AND the enquiry
 *         reference is "Indiamart" or "Online".
 *       - ₹50 per non-cancelled sale where he has a call record (any other reference).
 *       - Manual sales (no linked enquiry) are ignored.
 *   - Ashok (sales) — salesperson-based
 *       - 1% of the sale's grand total (invoice total) on every non-cancelled sale
 *         where `sale.salesperson.name` matches Ashok. Applies to manual + enquiry
 *         sales alike (no enquiry needed).
 *   - Bhavik (sales) — monthly tiered (flat rate on FULL monthly total once threshold hit)
 *       Tiers (per calendar month, non-cancelled sales where he is salesperson):
 *         ₹3,00,000+ → 1%
 *         ₹5,00,000+ → 2%
 *         ₹6,00,000+ → 2.5%
 *         ₹7,50,000+ → 3%
 *   - Bhawna (sales) — monthly tiered (same logic, different thresholds)
 *         ₹6,00,000+ → 1%
 *         ₹12,00,000+ → 2%
 *         ₹15,00,000+ → 2.5%
 *         ₹18,00,000+ → 3%
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
  salesperson?: { id?: string | null; name?: string | null } | null;
  grandTotal?: number | null;
  totalAmount?: number | null;
};

export interface IncentiveRule {
  /** Stable id, e.g. `reference-boost` — surfaced in the UI so you can audit which rule fired. */
  id: string;
  label: string;
  /** Predicate that decides whether this rule applies. First matching rule wins. */
  applies: (ctx: IncentiveContext) => boolean;
  /** Fixed payout, or a function of context (for percentage-based rules). */
  amount: number | ((ctx: IncentiveContext) => number);
}

export interface MonthlyTier {
  /** Minimum monthly total (INR) required to activate this tier. */
  threshold: number;
  /** Rate as decimal (0.01 = 1%). */
  rate: number;
  label: string;
}

export interface MonthlyTieredConfig {
  /** Sorted ascending by threshold. Employee gets the HIGHEST tier whose threshold ≤ monthly total. */
  tiers: MonthlyTier[];
}

export interface IncentiveEmployee {
  id: string;
  displayName: string;
  role: string;
  /**
   * Names to match against `followUps[].callerName` (call records) AND
   * `sale.salesperson.name` (salesperson-based rules). Matching is
   * case-insensitive and whitespace-trimmed.
   */
  matchNames: string[];
  rules: IncentiveRule[];
  /**
   * When true, page will fetch the linked enquiry and skip manual sales
   * (needed for call-record / reference rules). When false, page evaluates
   * rules on the sale alone (salesperson-based rules).
   */
  requiresEnquiry: boolean;
  /**
   * Optional monthly-tiered payout configured on the employee's sales
   * (salesperson match). When set, the page computes incentives per
   * calendar month instead of per sale, and the `rules[]` array is ignored.
   */
  monthlyTiered?: MonthlyTieredConfig;
}

export interface IncentiveContext {
  sale: SaleLike;
  enquiry: EnquiryLike | null;
  employee: IncentiveEmployee;
  /** True if any follow-up on the enquiry has `callerName` matching `employee.matchNames`. */
  hasCallRecord: boolean;
  /** Matched caller names taken verbatim from the follow-ups (for display). */
  matchedCallerNames: string[];
  /** Normalized reference values (lowercased, trimmed). */
  referenceValues: string[];
  /** True if `sale.salesperson.name` matches one of `employee.matchNames`. */
  matchesSalesperson: boolean;
  /** Matched salesperson name taken verbatim (for display). */
  matchedSalespersonName: string | null;
  /** Grand total (invoice total) as a safe number, 0 when missing. */
  saleGrandTotal: number;
}

export interface IncentiveResult {
  amount: number;
  ruleId: string | null;
  ruleLabel: string | null;
  hasCallRecord: boolean;
  matchedCallerNames: string[];
  referenceValues: string[];
  matchesSalesperson: boolean;
  matchedSalespersonName: string | null;
  saleGrandTotal: number;
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

function toSafeNumber(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function buildIncentiveContext(
  sale: SaleLike,
  enquiry: EnquiryLike | null,
  employee: IncentiveEmployee,
): IncentiveContext {
  const matchSet = new Set(employee.matchNames.map((n) => n.trim().toLowerCase()));
  const matchedCallerNames = collectMatchedCallers(enquiry, matchSet);

  const spNameRaw = typeof sale.salesperson?.name === 'string' ? sale.salesperson.name.trim() : '';
  const matchesSalesperson = !!spNameRaw && matchSet.has(spNameRaw.toLowerCase());

  return {
    sale,
    enquiry,
    employee,
    hasCallRecord: matchedCallerNames.length > 0,
    matchedCallerNames,
    referenceValues: extractReferenceList(enquiry?.reference),
    matchesSalesperson,
    matchedSalespersonName: matchesSalesperson ? spNameRaw : null,
    saleGrandTotal: toSafeNumber(sale.grandTotal),
  };
}

function resolveRuleAmount(rule: IncentiveRule, ctx: IncentiveContext): number {
  const raw = typeof rule.amount === 'function' ? rule.amount(ctx) : rule.amount;
  const n = toSafeNumber(raw);
  return n > 0 ? Math.round(n) : 0;
}

export function computeIncentiveForSale(
  sale: SaleLike,
  enquiry: EnquiryLike | null,
  employee: IncentiveEmployee,
): IncentiveResult {
  const ctx = buildIncentiveContext(sale, enquiry, employee);

  const emptyMatch: Omit<IncentiveResult, 'amount' | 'ruleId' | 'ruleLabel'> = {
    hasCallRecord: ctx.hasCallRecord,
    matchedCallerNames: ctx.matchedCallerNames,
    referenceValues: ctx.referenceValues,
    matchesSalesperson: ctx.matchesSalesperson,
    matchedSalespersonName: ctx.matchedSalespersonName,
    saleGrandTotal: ctx.saleGrandTotal,
  };

  if (sale.cancelled === true) {
    return { amount: 0, ruleId: null, ruleLabel: null, ...emptyMatch };
  }

  for (const rule of employee.rules) {
    if (rule.applies(ctx)) {
      return {
        amount: resolveRuleAmount(rule, ctx),
        ruleId: rule.id,
        ruleLabel: rule.label,
        ...emptyMatch,
      };
    }
  }

  return { amount: 0, ruleId: null, ruleLabel: null, ...emptyMatch };
}

const MOHIT_KUMAR: IncentiveEmployee = {
  id: 'mohit_kumar',
  displayName: 'Mohit Kumar',
  role: 'Telecaller / Receptionist',
  matchNames: ['Mohit Kumar', 'Mohit'],
  requiresEnquiry: true,
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

/**
 * Match against `sale.salesperson.name` (case-insensitive, trimmed).
 * Used by the monthly-tiered page path to filter which sales belong to the employee.
 */
export function saleMatchesEmployeeSalesperson(
  sale: SaleLike,
  employee: IncentiveEmployee,
): boolean {
  const raw = typeof sale.salesperson?.name === 'string' ? sale.salesperson.name.trim().toLowerCase() : '';
  if (!raw) return false;
  return employee.matchNames.map((n) => n.trim().toLowerCase()).includes(raw);
}

/**
 * Given a monthly total and the employee's tier config, return the highest
 * qualifying tier plus the resulting incentive amount (rounded to nearest ₹).
 * Below the lowest threshold → `{ tier: null, rate: 0, amount: 0 }`.
 */
export function computeMonthlyTierIncentive(
  monthTotal: number,
  tiers: MonthlyTier[],
): { tier: MonthlyTier | null; rate: number; amount: number } {
  const total = toSafeNumber(monthTotal);
  let selected: MonthlyTier | null = null;
  for (const t of tiers) {
    if (total >= t.threshold) {
      if (!selected || t.threshold >= selected.threshold) selected = t;
    }
  }
  const rate = selected?.rate ?? 0;
  return { tier: selected, rate, amount: Math.round(total * rate) };
}

const ASHOK: IncentiveEmployee = {
  id: 'ashok',
  displayName: 'Ashok',
  role: 'Sales',
  matchNames: ['Ashok'],
  requiresEnquiry: false,
  rules: [
    {
      id: 'salesperson-1pct',
      label: '1% of grand total — sale where he is the salesperson',
      applies: (ctx) => ctx.matchesSalesperson && ctx.saleGrandTotal > 0,
      amount: (ctx) => ctx.saleGrandTotal * 0.01,
    },
  ],
};

const BHAVIK: IncentiveEmployee = {
  id: 'bhavik',
  displayName: 'Bhavik',
  role: 'Sales',
  matchNames: ['Bhavik'],
  requiresEnquiry: false,
  rules: [],
  monthlyTiered: {
    tiers: [
      { threshold: 300_000, rate: 0.01, label: '₹3 L+ → 1%' },
      { threshold: 500_000, rate: 0.02, label: '₹5 L+ → 2%' },
      { threshold: 600_000, rate: 0.025, label: '₹6 L+ → 2.5%' },
      { threshold: 750_000, rate: 0.03, label: '₹7.5 L+ → 3%' },
    ],
  },
};

const BHAWNA: IncentiveEmployee = {
  id: 'bhawna',
  displayName: 'Bhawna',
  role: 'Sales',
  matchNames: ['Bhawna'],
  requiresEnquiry: false,
  rules: [],
  monthlyTiered: {
    tiers: [
      { threshold: 600_000, rate: 0.01, label: '₹6 L+ → 1%' },
      { threshold: 1_200_000, rate: 0.02, label: '₹12 L+ → 2%' },
      { threshold: 1_500_000, rate: 0.025, label: '₹15 L+ → 2.5%' },
      { threshold: 1_800_000, rate: 0.03, label: '₹18 L+ → 3%' },
    ],
  },
};

export const INCENTIVE_EMPLOYEES: IncentiveEmployee[] = [MOHIT_KUMAR, ASHOK, BHAVIK, BHAWNA];

export function getIncentiveEmployee(id: string): IncentiveEmployee | null {
  return INCENTIVE_EMPLOYEES.find((e) => e.id === id) ?? null;
}
