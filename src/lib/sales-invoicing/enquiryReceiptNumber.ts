import type { Firestore } from 'firebase/firestore';
import {
  allocateNextBookingReceiptNumber,
  allocateNextTrialReceiptNumber,
  isStrictBookingReceiptNumber,
  isStrictTrialReceiptNumber,
} from '@/services/receiptNumbering';

type AnyVisit = Record<string, unknown>;

const isHomeTrialVisit = (visit: AnyVisit): boolean =>
  String(visit?.trialHearingAidType ?? '').trim().toLowerCase() === 'home';

const isBookingVisit = (visit: AnyVisit): boolean => {
  const hearingAidBooked = Boolean(visit?.hearingAidBooked);
  const bookingFromTrialAdvance =
    Boolean(visit?.bookingFromTrial) && Number(visit?.bookingAdvanceAmount || 0) > 0;
  return hearingAidBooked || bookingFromTrialAdvance;
};

const isHomeTrialReceiptVisit = (visit: AnyVisit): boolean =>
  (Boolean(visit?.trialGiven) || Boolean(visit?.hearingAidTrial)) && isHomeTrialVisit(visit);

export type AssignReceiptNumbersResult = {
  visits: AnyVisit[];
  visitSchedules: AnyVisit[];
  changed: boolean;
};

/**
 * Walk a saved enquiry's visits and assign strict `BR-NNNNNN` / `TR-NNNNNN` numbers
 * to any booking / home-trial rows that are missing one (or have a non-strict
 * fallback like `BR-1`). In-office trials are skipped on purpose so they don't
 * consume a TR sequence.
 *
 * Allocations are atomic via `runTransaction` against `receiptSettings/default`,
 * so concurrent saves can't reuse the same number.
 */
export async function assignReceiptNumbersToVisits(
  db: Firestore,
  rawVisits: unknown,
  rawVisitSchedules?: unknown
): Promise<AssignReceiptNumbersResult> {
  const visits: AnyVisit[] = Array.isArray(rawVisits) ? rawVisits.map((v) => ({ ...(v as AnyVisit) })) : [];
  const visitSchedules: AnyVisit[] = Array.isArray(rawVisitSchedules)
    ? rawVisitSchedules.map((v) => ({ ...(v as AnyVisit) }))
    : [];
  let changed = false;

  for (let i = 0; i < visits.length; i++) {
    const visit = visits[i];

    if (isBookingVisit(visit) && !isStrictBookingReceiptNumber(visit.bookingReceiptNumber)) {
      const allocated = await allocateNextBookingReceiptNumber(db);
      visits[i] = { ...visit, bookingReceiptNumber: allocated };
      if (visitSchedules[i]) {
        visitSchedules[i] = { ...visitSchedules[i], bookingReceiptNumber: allocated };
      }
      changed = true;
    }

    if (
      isHomeTrialReceiptVisit(visits[i]) &&
      !isStrictTrialReceiptNumber(visits[i].trialReceiptNumber)
    ) {
      const allocated = await allocateNextTrialReceiptNumber(db);
      visits[i] = { ...visits[i], trialReceiptNumber: allocated };
      if (visitSchedules[i]) {
        visitSchedules[i] = { ...visitSchedules[i], trialReceiptNumber: allocated };
      }
      changed = true;
    }
  }

  return { visits, visitSchedules, changed };
}
