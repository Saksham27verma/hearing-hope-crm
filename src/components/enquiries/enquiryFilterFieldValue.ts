/**
 * Resolve enquiry document paths for filtering, including synthetic aggregates.
 */

export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current == null) return undefined;
    if (typeof current === 'object' && key in current) {
      return (current as any)[key];
    }
    return undefined;
  }, obj);
}

/** Normalize payment / visit shapes from Firestore */
export function getEnquiryFieldRaw(enquiry: any, path: string): unknown {
  if (!enquiry) return undefined;

  if (path === 'paymentsTotal') {
    const arr = Array.isArray(enquiry.payments) ? enquiry.payments : [];
    return arr.reduce((s: number, p: any) => s + Number(p?.amount || 0), 0);
  }

  if (path === 'paymentForAny') {
    // Handled specially in applyFilterCondition — return array of paymentFor values
    const arr = Array.isArray(enquiry.payments) ? enquiry.payments : [];
    return arr.map((p: any) => p?.paymentFor).filter(Boolean);
  }

  if (path === 'paymentModeAny') {
    const arr = Array.isArray(enquiry.payments) ? enquiry.payments : [];
    return arr.map((p: any) => p?.paymentMode).filter(Boolean);
  }

  if (path === 'center') {
    return enquiry.center ?? enquiry.visitingCenter;
  }

  /** Normalized boolean for filters (missing / false → false, only explicit true is hot). */
  if (path === 'hotEnquiry') {
    return enquiry.hotEnquiry === true;
  }

  /** Center | home from any visit or scheduled visit */
  if (path === 'visitLocationAny') {
    const out: string[] = [];
    (enquiry.visits || []).forEach((v: any) => {
      if (v?.visitType) out.push(String(v.visitType));
    });
    (enquiry.visitSchedules || []).forEach((s: any) => {
      if (s?.visitType) out.push(String(s.visitType));
    });
    return [...new Set(out)];
  }

  /** hearingAidStatus + trialResult from any visit row */
  if (path === 'hearingAidStatusAny') {
    const out: string[] = [];
    (enquiry.visits || []).forEach((v: any) => {
      if (v?.hearingAidStatus) out.push(String(v.hearingAidStatus));
      if (v?.trialResult) out.push(String(v.trialResult));
    });
    return [...new Set(out)];
  }

  return getNestedValue(enquiry, path);
}

/** Parse a visit date string or Firestore Timestamp to a calendar day (local midnight). */
function parseVisitDay(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (typeof v === 'object' && v !== null && typeof (v as { toDate?: () => Date }).toDate === 'function') {
    const d = (v as { toDate: () => Date }).toDate();
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof v === 'object' && v !== null && '_seconds' in (v as object)) {
    const sec = Number((v as { _seconds?: number })._seconds);
    if (!Number.isFinite(sec)) return null;
    const d = new Date(sec * 1000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof v === 'object' && v !== null && 'seconds' in (v as object)) {
    const sec = Number((v as { seconds?: number }).seconds);
    if (!Number.isFinite(sec)) return null;
    const d = new Date(sec * 1000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
}

/** Visit / schedule dates (day granularity) used by legacy visit filters and `visitDateAny` advanced rules. */
export function getVisitDatesFromEnquiry(enquiry: any): Date[] {
  if (!enquiry) return [];
  const visitsArr = Array.isArray(enquiry.visits) ? enquiry.visits : [];
  const schedulesArr = Array.isArray(enquiry.visitSchedules) ? enquiry.visitSchedules : [];
  const out: Date[] = [];
  visitsArr.forEach((v: any) => {
    const d = parseVisitDay(v?.visitDate ?? v?.date);
    if (d) out.push(d);
  });
  schedulesArr.forEach((v: any) => {
    const d = parseVisitDay(v?.visitDate);
    if (d) out.push(d);
  });
  return out;
}

function sameDay(a: Date, b: Date) {
  return a.getTime() === b.getTime();
}

/**
 * True if **any** visit or scheduled visit date matches the operator (day-level, local calendar).
 */
export function evaluateVisitDateAnyFilter(enquiry: any, operator: string, value: any): boolean {
  const dates = getVisitDatesFromEnquiry(enquiry);
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (operator === 'is_null' || operator === 'is_empty') {
    return dates.length === 0;
  }
  if (operator === 'is_not_null' || operator === 'is_not_empty') {
    return dates.length > 0;
  }

  if (dates.length === 0) return false;

  const anyDay = (pred: (d: Date) => boolean) => dates.some(pred);

  switch (operator) {
    case 'equals': {
      const searchDate = new Date(value);
      if (isNaN(searchDate.getTime())) return false;
      const sd = new Date(searchDate.getFullYear(), searchDate.getMonth(), searchDate.getDate());
      return anyDay(d => sameDay(d, sd));
    }
    case 'not_equals': {
      const searchDate = new Date(value);
      if (isNaN(searchDate.getTime())) return false;
      const sd = new Date(searchDate.getFullYear(), searchDate.getMonth(), searchDate.getDate());
      return dates.every(d => !sameDay(d, sd));
    }
    case 'before': {
      const searchDate = new Date(value);
      if (isNaN(searchDate.getTime())) return false;
      const sd = new Date(searchDate.getFullYear(), searchDate.getMonth(), searchDate.getDate());
      return anyDay(d => d.getTime() < sd.getTime());
    }
    case 'after': {
      const searchDate = new Date(value);
      if (isNaN(searchDate.getTime())) return false;
      const sd = new Date(searchDate.getFullYear(), searchDate.getMonth(), searchDate.getDate());
      return anyDay(d => d.getTime() > sd.getTime());
    }
    case 'between': {
      const parts = String(value)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (parts.length < 2) return false;
      const startDate = new Date(parts[0]);
      const endDate = new Date(parts[1]);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return false;
      const s0 = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const e0 = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      return anyDay(d => d.getTime() >= s0.getTime() && d.getTime() <= e0.getTime());
    }
    case 'last_days': {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return false;
      const from = new Date(todayDay);
      from.setDate(from.getDate() - n);
      return anyDay(d => d.getTime() >= from.getTime() && d.getTime() <= todayDay.getTime());
    }
    case 'next_days': {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return false;
      const until = new Date(todayDay);
      until.setDate(until.getDate() + n);
      return anyDay(d => d.getTime() >= todayDay.getTime() && d.getTime() <= until.getTime());
    }
    case 'this_month':
      return anyDay(
        d => d.getMonth() === todayDay.getMonth() && d.getFullYear() === todayDay.getFullYear()
      );
    case 'last_month': {
      const lastMonth = new Date(todayDay.getFullYear(), todayDay.getMonth() - 1, 1);
      return anyDay(
        d => d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear()
      );
    }
    case 'this_year':
      return anyDay(d => d.getFullYear() === todayDay.getFullYear());
    default:
      return false;
  }
}
