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
 *         where salesperson matches Ashok. Applies to manual + enquiry sales alike.
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
  visits?: unknown;
  visitHistory?: unknown;
  [key: string]: unknown;
};

export type SaleLike = {
  id?: string;
  enquiryId?: string | null;
  enquiryVisitIndex?: number | null;
  source?: string | null;
  cancelled?: boolean | null;
  salesperson?: { id?: string | null; name?: string | null } | string | null;
  grandTotal?: number | null;
  totalAmount?: number | null;
  gstAmount?: number | null;
  products?: Array<{ sellingPrice?: number | null; finalAmount?: number | null; quantity?: number | null }> | null;
  saleDate?: unknown;
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
   * Names / aliases to match against call records and salesperson fields.
   * Matching is case-insensitive and accepts full names that contain these
   * as whole-word tokens (e.g. "Bhawna" matches "Bhawna Sharma").
   */
  matchNames: string[];
  rules: IncentiveRule[];
  /**
   * When true, page will fetch the linked enquiry and skip manual sales
   * (needed for call-record / reference rules). When false, page evaluates
   * rules on the sale alone (salesperson-based rules), with enquiry used only
   * as a salesperson fallback when available.
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
  /** True if resolved salesperson name matches one of `employee.matchNames`. */
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

function tokenize(name: string): string[] {
  return name
    .split(/[\s.,\-_/|()]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Flexible person-name match:
 * - exact equality after normalize
 * - OR every token of the match alias appears as a whole-word token in the candidate
 *   (so "Bhawna" matches "Bhawna Sharma", but "Ashok" does not match "Ashoka")
 */
export function personNameMatches(candidate: unknown, matchNames: string[]): boolean {
  const c = normalize(candidate);
  if (!c) return false;
  const cTokens = tokenize(c);
  for (const raw of matchNames) {
    const n = normalize(raw);
    if (!n) continue;
    if (c === n) return true;
    const nTokens = tokenize(n);
    if (nTokens.length === 0) continue;
    if (nTokens.every((t) => cTokens.includes(t))) return true;
  }
  return false;
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

function collectMatchedCallers(enquiry: EnquiryLike | null, matchNames: string[]): string[] {
  if (!enquiry) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const followUps = Array.isArray(enquiry.followUps) ? enquiry.followUps : [];
  for (const fu of followUps) {
    const raw = typeof fu?.callerName === 'string' ? fu.callerName.trim() : '';
    if (!raw) continue;
    if (!personNameMatches(raw, matchNames)) continue;
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

/** Read salesperson name whether stored as `{ name }` or a plain string. */
export function readSalespersonName(sale: SaleLike | null | undefined): string {
  if (!sale) return '';
  const sp = sale.salesperson;
  if (typeof sp === 'string') return sp.trim();
  if (sp && typeof sp === 'object' && typeof sp.name === 'string') return sp.name.trim();
  return '';
}

/**
 * Prefer invoice grandTotal; fall back to totalAmount+GST, then product line totals.
 * Some legacy / partially-synced sales have grandTotal missing or 0.
 */
export function resolveSaleIncentiveAmount(sale: SaleLike): number {
  const gt = toSafeNumber(sale.grandTotal);
  if (gt > 0) return gt;
  const sub = toSafeNumber(sale.totalAmount);
  const gst = toSafeNumber(sale.gstAmount);
  if (sub + gst > 0) return sub + gst;
  if (sub > 0) return sub;
  if (Array.isArray(sale.products)) {
    const fromLines = sale.products.reduce((sum, p) => {
      const unit = toSafeNumber(p?.sellingPrice ?? p?.finalAmount);
      const qty = Math.max(1, toSafeNumber(p?.quantity) || 1);
      return sum + unit * qty;
    }, 0);
    if (fromLines > 0) return fromLines;
  }
  return 0;
}

/** Parse saleDate from Firestore Timestamp, Date, millis, or ISO string. */
export function parseSaleDate(saleDate: unknown): Date | null {
  if (!saleDate) return null;
  if (saleDate instanceof Date && !Number.isNaN(saleDate.getTime())) return saleDate;
  if (typeof saleDate === 'object') {
    const ts = saleDate as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof ts.toDate === 'function') {
      try {
        const d = ts.toDate();
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
      } catch {
        /* ignore */
      }
    }
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
    if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
  }
  if (typeof saleDate === 'number' && Number.isFinite(saleDate)) {
    const d = new Date(saleDate > 1e12 ? saleDate : saleDate * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof saleDate === 'string') {
    const d = new Date(saleDate);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function visitWhoSoldName(visit: Record<string, unknown> | null | undefined): string {
  if (!visit) return '';
  const details = visit.hearingAidDetails as Record<string, unknown> | undefined;
  return String(
    details?.whoSold ?? visit.whoSold ?? visit.whoSoldName ?? visit.hearingAidBrand ?? '',
  ).trim();
}

/**
 * Resolve the salesperson name for incentive attribution.
 * 1) sale.salesperson.name
 * 2) linked enquiry visit "Who Sold" (hearingAidBrand / whoSold) when sale has enquiryId
 * 3) enquiry.sales top-level field when present
 */
export function resolveEffectiveSalespersonName(
  sale: SaleLike,
  enquiry: EnquiryLike | null,
): string {
  const fromSale = readSalespersonName(sale);
  if (fromSale) return fromSale;
  if (!enquiry) return '';

  const visitsRaw = enquiry.visits ?? enquiry.visitHistory;
  const visits = Array.isArray(visitsRaw) ? (visitsRaw as Record<string, unknown>[]) : [];
  const idx =
    typeof sale.enquiryVisitIndex === 'number' && Number.isFinite(sale.enquiryVisitIndex)
      ? sale.enquiryVisitIndex
      : -1;
  if (idx >= 0 && idx < visits.length) {
    const fromVisit = visitWhoSoldName(visits[idx]);
    if (fromVisit) return fromVisit;
  }
  // Prefer any sale visit that looks sold and has whoSold
  for (const v of visits) {
    const sold =
      v?.hearingAidSale === true ||
      v?.purchaseFromTrial === true ||
      v?.hearingAidStatus === 'sold';
    if (!sold) continue;
    const name = visitWhoSoldName(v);
    if (name) return name;
  }
  const topLevelSales = typeof enquiry.sales === 'string' ? enquiry.sales.trim() : '';
  return topLevelSales;
}

export function buildIncentiveContext(
  sale: SaleLike,
  enquiry: EnquiryLike | null,
  employee: IncentiveEmployee,
): IncentiveContext {
  const matchedCallerNames = collectMatchedCallers(enquiry, employee.matchNames);
  const spNameRaw = resolveEffectiveSalespersonName(sale, enquiry);
  const matchesSalesperson = personNameMatches(spNameRaw, employee.matchNames);

  return {
    sale,
    enquiry,
    employee,
    hasCallRecord: matchedCallerNames.length > 0,
    matchedCallerNames,
    referenceValues: extractReferenceList(enquiry?.reference),
    matchesSalesperson,
    matchedSalespersonName: matchesSalesperson ? spNameRaw : null,
    saleGrandTotal: resolveSaleIncentiveAmount(sale),
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
 * Match against resolved salesperson name (sale + enquiry whoSold fallback).
 */
export function saleMatchesEmployeeSalesperson(
  sale: SaleLike,
  employee: IncentiveEmployee,
  enquiry: EnquiryLike | null = null,
): boolean {
  const raw = resolveEffectiveSalespersonName(sale, enquiry);
  return personNameMatches(raw, employee.matchNames);
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
  // Invoices store full name "Bhawna Sharma"; "Bhavna" is a common alternate spelling.
  matchNames: ['Bhawna Sharma', 'Bhawna', 'Bhavna'],
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
