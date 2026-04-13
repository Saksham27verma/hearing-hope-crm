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
