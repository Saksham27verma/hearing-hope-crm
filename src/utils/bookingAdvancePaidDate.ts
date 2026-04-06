/**
 * When a booking advance was taken (payment-linked date, else visit/booking dates).
 * Shared with Booked Report and dashboard "today's booking advances".
 */

export function getEnquiryVisitSchedules(enquiry: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(enquiry.visitSchedules) && enquiry.visitSchedules.length > 0) {
    return enquiry.visitSchedules as Record<string, unknown>[];
  }
  if (Array.isArray(enquiry.visits) && enquiry.visits.length > 0) {
    return enquiry.visits as Record<string, unknown>[];
  }
  return [];
}

/** HA booking row, not a sale on the same visit row. */
export function isBookingVisitRow(visit: unknown): boolean {
  if (!visit || typeof visit !== 'object') return false;
  const v = visit as Record<string, unknown>;
  const ms = Array.isArray(v.medicalServices) ? (v.medicalServices as string[]) : [];
  const has = (code: string) => ms.includes(code);
  const hearingAidBooked = Boolean(v.hearingAidBooked) || has('hearing_aid_booked');
  const hearingAidSale =
    Boolean(v.hearingAidSale) || has('hearing_aid_sale') || has('hearing_aid');
  return hearingAidBooked && !hearingAidSale;
}

export function isBookingAdvancePayment(p: Record<string, unknown> | null | undefined): boolean {
  if (!p || typeof p !== 'object') return false;
  const pf = String(p.paymentFor ?? '').toLowerCase();
  const pt = String(p.paymentType ?? '').toLowerCase();
  return (
    pf === 'booking_advance' ||
    pf === 'hearing_aid_booking' ||
    pt === 'hearing_aid_booking'
  );
}

/** Local calendar YYYY-MM-DD (matches dashboard `localDateKey` / “today”). */
function dateToLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizePaymentDateOnly(raw: unknown): string {
  if (raw == null) return '';
  const ts = raw as { toDate?: () => Date; seconds?: number };
  if (typeof ts?.toDate === 'function') {
    const d = ts.toDate();
    if (d && Number.isFinite(d.getTime())) return dateToLocalYmd(d);
  }
  if (typeof ts?.seconds === 'number') {
    return dateToLocalYmd(new Date(ts.seconds * 1000));
  }
  const s = String(raw).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return dateToLocalYmd(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** `YYYY-MM-DD` when known, else `null` (caller may show "—"). */
export function getBookingAdvancePaidDateKey(
  enquiry: Record<string, unknown>,
  visit: Record<string, unknown>,
): string | null {
  const visitId = String(visit?.id ?? '').trim();
  const advance =
    Number(
      visit.bookingAdvanceAmount ??
        (visit.hearingAidDetails as Record<string, unknown> | undefined)?.bookingAdvanceAmount ??
        0,
    ) || 0;
  const pools: Record<string, unknown>[] = [
    ...(Array.isArray(enquiry.payments) ? (enquiry.payments as Record<string, unknown>[]) : []),
    ...(Array.isArray(enquiry.paymentRecords)
      ? (enquiry.paymentRecords as Record<string, unknown>[])
      : []),
  ];

  const linked = pools.filter(
    (p) =>
      isBookingAdvancePayment(p) &&
      visitId &&
      String(p.relatedVisitId ?? '').trim() === visitId,
  );
  let candidates = linked;
  if (!candidates.length && advance > 0) {
    candidates = pools.filter(
      (p) =>
        isBookingAdvancePayment(p) && Math.abs(Number(p.amount ?? 0) - advance) < 0.5,
    );
  }
  if (candidates.length) {
    const dates = candidates
      .map((p) => normalizePaymentDateOnly(p.paymentDate))
      .filter(Boolean)
      .sort();
    if (dates.length) return dates[0];
  }

  const ha = visit.hearingAidDetails as Record<string, unknown> | undefined;
  const fallback = String(
    visit.visitDate || visit.date || visit.bookingDate || ha?.bookingDate || '',
  ).trim();
  const n = normalizePaymentDateOnly(fallback);
  return n || null;
}

export function getBookingAdvancePaidDateForReport(enquiry: any, visit: any): string {
  return getBookingAdvancePaidDateKey(enquiry, visit) || '—';
}
