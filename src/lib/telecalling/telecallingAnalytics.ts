/**
 * Telecalling analytics — shared due/call semantics with Telecalling Records page.
 * Aggregates follow-up logs and due obligations for Reports → Telecallers Analysis.
 */

import { addMinutes, format, parse, parseISO } from 'date-fns';
import { getEnquiryStatusMeta } from '@/utils/enquiryStatus';

export interface FollowUp {
  id: string;
  date: string;
  dateTime?: string;
  remarks: string;
  nextFollowUpDate: string;
  nextFollowUpDateTime?: string;
  callerName: string;
  createdAt?: { seconds: number; nanoseconds?: number };
}

export interface CallEvent {
  enquiryId: string;
  /** Person who logged the call (callerName). */
  telecaller: string;
  /** `enquiries.telecaller` on this enquiry, if set. */
  assignedTelecaller: string | null;
  callAt: Date;
  callDateYmd: string;
  journeyLabel: string;
  centerId: string;
  centerLabel: string;
  soldNow: boolean;
  soldDuringPeriod: boolean;
}

export interface DueObligation {
  id: string;
  enquiryId: string;
  telecaller: string;
  dueAt: Date;
  dueDateYmd: string;
  completed: boolean;
  overdueNow: boolean;
  centerId: string;
  centerLabel: string;
  source: 'followup_log' | 'patient_info' | 'appointment_due';
}

export interface TelecallerSummaryRow {
  telecaller: string;
  callsLogged: number;
  activeDays: number;
  dueScheduled: number;
  dueCompleted: number;
  dueMissed: number;
  compliancePct: number | null;
  overdueNow: number;
  enquiriesTouched: number;
  soldNowCount: number;
  soldDuringPeriodCount: number;
  soldNowPct: number | null;
  soldDuringPeriodPct: number | null;
}

export interface DailySeriesPoint {
  date: string;
  telecaller: string;
  calls: number;
  duesDue: number;
  duesCompleted: number;
}

export interface TelecallingAnalyticsResult {
  callEvents: CallEvent[];
  dueObligations: DueObligation[];
  summaryRows: TelecallerSummaryRow[];
  dailySeries: DailySeriesPoint[];
  telecallerOptions: string[];
  centerOptions: string[];
}

export interface BuildTelecallingAnalyticsInput {
  enquiries: Array<{ id: string; data: Record<string, unknown> }>;
  appointments: Array<{ id: string; data: Record<string, unknown> }>;
  centerIdToName: Record<string, string>;
  fromDate: string;
  toDate: string;
}

// --- Date helpers (aligned with telecalling-records/page.tsx) ---

export function normalizeYmd(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().slice(0, 10);
}

export function parseDateSafe(raw: string | undefined): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;

  try {
    const hasTzInstant =
      /[zZ]$/.test(t) ||
      /T[^+-zZ]*[+-]\d{2}:?\d{2}$/.test(t) ||
      /T[^+-zZ]*[+-]\d{4}$/.test(t);
    if (hasTzInstant) {
      const p = parseISO(t);
      if (!Number.isNaN(p.getTime())) return p;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t) && !hasTzInstant) {
      const slice = t.length >= 16 ? t.slice(0, 16) : t;
      const d = parse(slice, "yyyy-MM-dd'T'HH:mm", new Date());
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const d = parse(t, 'yyyy-MM-dd', new Date());
      d.setHours(10, 0, 0, 0);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const p = parseISO(t);
    if (!Number.isNaN(p.getTime())) return p;
  } catch {
    // fall through
  }

  const fallback = new Date(t);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function pickFollowUpDateTime(followUp: FollowUp): Date | null {
  return parseDateSafe(followUp.dateTime) || parseDateSafe(followUp.date);
}

export function pickNextFollowUpDateTime(followUp: FollowUp): Date | null {
  return parseDateSafe(followUp.nextFollowUpDateTime) || parseDateSafe(followUp.nextFollowUpDate);
}

export function hasCallAfterDue(followUps: FollowUp[], dueAt: Date): boolean {
  return followUps.some((fu) => {
    const callTime = pickFollowUpDateTime(fu);
    if (!callTime) return false;
    return callTime.getTime() >= dueAt.getTime();
  });
}

export function isSoldJourneyLabel(label: string | undefined): boolean {
  const t = String(label || '').trim().toLowerCase();
  return t === 'sold' || t.includes('sold');
}

export function isNotInterestedEnquiry(statusLabel: string, enquiry: Record<string, unknown>): boolean {
  const statusNorm = String(statusLabel || '').trim().toLowerCase();
  const legacyStatusNorm = String(enquiry.status || '').trim().toLowerCase();
  const leadOutcomeNorm = String(enquiry.leadOutcome || '').trim().toLowerCase();
  return (
    statusNorm.includes('not interested') ||
    legacyStatusNorm.includes('not interested') ||
    leadOutcomeNorm.includes('not interested')
  );
}

function toDateInputValue(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

function addMinutesLocal(value: Date, minutes: number): Date {
  return addMinutes(value, minutes);
}

function parseDateStart(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDateInRange(d: Date, start: Date | null, end: Date | null): boolean {
  const t = d.getTime();
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}

function resolveCenterDisplay(centerId: string, map: Record<string, string>): string {
  const id = centerId.trim();
  if (!id) return '';
  return map[id] || id;
}

const PLACEHOLDER_TELECALLER = new Set(['', 'unassigned', 'unknown']);

/** `enquiries.telecaller` only — not assignedTo / callerName. */
export function getEnquiryAssignedTelecaller(enquiry: Record<string, unknown>): string | null {
  const tc = String(enquiry.telecaller || '').trim();
  if (!tc || PLACEHOLDER_TELECALLER.has(tc.toLowerCase())) return null;
  return tc;
}

export function namesMatchTelecaller(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Who logged the call (callerName), with enquiry telecaller fallback for display. */
function resolveCallLoggedByName(
  callerName: string | undefined,
  enquiry: Record<string, unknown>
): string {
  const fromCall = String(callerName || '').trim();
  if (fromCall && fromCall !== 'Unknown') return fromCall;
  return getEnquiryAssignedTelecaller(enquiry) || 'Unassigned';
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && value !== null) {
    const withToDate = value as { toDate?: () => Date };
    if (typeof withToDate.toDate === 'function') {
      const d = withToDate.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const withSeconds = value as { seconds?: number; _seconds?: number };
    const seconds = withSeconds.seconds ?? withSeconds._seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }
  return null;
}

/**
 * Best-effort sold timestamp for "sold during period" metric.
 * Uses: manual sold override (updatedAt), latest HA sale visit date, or enquiry updatedAt when status is sold.
 */
export function inferSoldAtDate(enquiry: Record<string, unknown>): Date | null {
  const statusMeta = getEnquiryStatusMeta({ ...enquiry, id: enquiry.id });
  if (statusMeta.key !== 'sold' && statusMeta.key !== 'completed') return null;

  const override = String(enquiry.journeyStatusOverride || '').trim();
  if (override === 'sold' || override === 'completed') {
    return asDate(enquiry.updatedAt) || asDate(enquiry.createdAt);
  }

  const schedules = Array.isArray(enquiry.visitSchedules)
    ? enquiry.visitSchedules
    : Array.isArray(enquiry.visits)
      ? enquiry.visits
      : [];

  let latestSale: Date | null = null;
  for (const visit of schedules) {
    if (!visit || typeof visit !== 'object') continue;
    const v = visit as Record<string, unknown>;
    const ha = (v.hearingAidDetails as Record<string, unknown>) || {};
    const sold =
      Boolean(v.hearingAidSale) ||
      Boolean(v.purchaseFromTrial) ||
      Boolean(ha.purchaseFromTrial) ||
      String(v.hearingAidStatus || ha.hearingAidStatus || '')
        .toLowerCase()
        .includes('sold');
    if (!sold) continue;
    const candidates = [v.visitDate, v.date, v.bookingDate, v.createdAt];
    for (const c of candidates) {
      const d =
        typeof c === 'string'
          ? parseDateSafe(c)
          : c && typeof c === 'object'
            ? asDate(c)
            : null;
      if (d && (!latestSale || d.getTime() > latestSale.getTime())) {
        latestSale = d;
      }
    }
  }

  if (latestSale) return latestSale;

  const fs = enquiry.financialSummary as { paymentStatus?: string } | undefined;
  if (fs && String(fs.paymentStatus || '').toLowerCase().includes('paid')) {
    return asDate(enquiry.updatedAt) || asDate(enquiry.createdAt);
  }

  return asDate(enquiry.updatedAt) || asDate(enquiry.createdAt);
}

function readVisitDateTime(visit: unknown): Date | null {
  if (!visit || typeof visit !== 'object') return null;
  const v = visit as Record<string, unknown>;
  const visitDateRaw = typeof v.visitDate === 'string' ? v.visitDate.trim() : '';
  const visitTimeRaw = typeof v.visitTime === 'string' ? v.visitTime.trim() : '';
  if (visitDateRaw) {
    const hhmm = /^\d{2}:\d{2}$/.test(visitTimeRaw) ? visitTimeRaw : '10:00';
    const combined = parseDateSafe(`${visitDateRaw}T${hhmm}`);
    if (combined) return combined;
  }
  const candidates = ['visitDate', 'date', 'appointmentDate', 'start', 'scheduledAt', 'bookingDate'];
  for (const key of candidates) {
    const d = parseDateSafe(typeof v[key] === 'string' ? (v[key] as string) : undefined);
    if (d) return d;
  }
  return null;
}

function isCancelledVisit(visit: unknown): boolean {
  if (!visit || typeof visit !== 'object') return false;
  const v = visit as Record<string, unknown>;
  const status = String(v.status || v.visitStatus || '').toLowerCase();
  return status.includes('cancel');
}

function readAppointmentDateTime(appointment: Record<string, unknown>): Date | null {
  const startRaw = typeof appointment.start === 'string' ? appointment.start.trim() : '';
  if (startRaw) {
    const d = parseDateSafe(startRaw);
    if (d) return d;
  }
  const dateRaw =
    typeof appointment.appointmentDate === 'string'
      ? appointment.appointmentDate.trim()
      : typeof appointment.date === 'string'
        ? appointment.date.trim()
        : '';
  const timeRaw =
    typeof appointment.appointmentTime === 'string'
      ? appointment.appointmentTime.trim()
      : typeof appointment.time === 'string'
        ? appointment.time.trim()
        : '';
  if (dateRaw) {
    const hhmm = /^\d{2}:\d{2}$/.test(timeRaw) ? timeRaw : '10:00';
    return parseDateSafe(`${dateRaw}T${hhmm}`);
  }
  return null;
}

function isCancelledAppointment(appointment: Record<string, unknown>): boolean {
  const status = String(appointment.status || '').toLowerCase();
  return status.includes('cancel');
}

export function buildTelecallingAnalytics(
  input: BuildTelecallingAnalyticsInput
): TelecallingAnalyticsResult {
  const { enquiries, appointments, centerIdToName, fromDate, toDate } = input;
  const rangeStart = parseDateStart(fromDate);
  const rangeEnd = parseDateEnd(toDate);
  const now = new Date();

  const appointmentsByEnquiryId = new Map<string, Record<string, unknown>[]>();
  for (const apt of appointments) {
    const enquiryId = String(apt.data.enquiryId || '').trim();
    if (!enquiryId) continue;
    const list = appointmentsByEnquiryId.get(enquiryId) || [];
    list.push(apt.data);
    appointmentsByEnquiryId.set(enquiryId, list);
  }

  const callEvents: CallEvent[] = [];
  const dueObligations: DueObligation[] = [];
  const telecallerSet = new Set<string>();
  const centerSet = new Set<string>();

  for (const { id: enquiryId, data: enquiryData } of enquiries) {
    const raw = { ...enquiryData, id: enquiryId };
    const statusMeta = getEnquiryStatusMeta(raw);
    if (isNotInterestedEnquiry(statusMeta.label, enquiryData)) continue;

    const soldJourney = isSoldJourneyLabel(statusMeta.label);
    const soldNow = statusMeta.key === 'sold' || statusMeta.key === 'completed';
    const soldAt = inferSoldAtDate(raw);
    const soldDuringPeriod =
      soldNow &&
      soldAt !== null &&
      isDateInRange(soldAt, rangeStart, rangeEnd);

    const centerId = String(enquiryData.visitingCenter || enquiryData.center || '').trim();
    const centerLabel = resolveCenterDisplay(centerId, centerIdToName);
    if (centerLabel) centerSet.add(centerLabel);

    const followList: FollowUp[] = Array.isArray(enquiryData.followUps)
      ? (enquiryData.followUps as FollowUp[])
      : [];
    const assignedTelecaller = getEnquiryAssignedTelecaller(enquiryData);

    for (const followUp of followList) {
      const callAt = pickFollowUpDateTime(followUp);
      if (!callAt) continue;
      const telecaller = resolveCallLoggedByName(followUp.callerName, enquiryData);
      telecallerSet.add(telecaller);

      if (isDateInRange(callAt, rangeStart, rangeEnd)) {
        callEvents.push({
          enquiryId,
          telecaller,
          assignedTelecaller,
          callAt,
          callDateYmd: toDateInputValue(callAt),
          journeyLabel: statusMeta.label,
          centerId,
          centerLabel,
          soldNow,
          soldDuringPeriod,
        });
      }
    }

    if (soldJourney) continue;

    const pushDue = (
      dueAt: Date,
      source: DueObligation['source'],
      suffix: string
    ) => {
      if (!isDateInRange(dueAt, rangeStart, rangeEnd)) return;
      if (!assignedTelecaller) return;
      const completed = hasCallAfterDue(followList, dueAt);
      const overdueNow = !completed && dueAt.getTime() < now.getTime();
      telecallerSet.add(assignedTelecaller);
      dueObligations.push({
        id: `${enquiryId}_${suffix}`,
        enquiryId,
        telecaller: assignedTelecaller,
        dueAt,
        dueDateYmd: toDateInputValue(dueAt),
        completed,
        overdueNow,
        centerId,
        centerLabel,
        source,
      });
    };

    followList.forEach((followUp, index) => {
      const dueAt = pickNextFollowUpDateTime(followUp);
      if (!dueAt) return;
      pushDue(dueAt, 'followup_log', `fu_${followUp.id || index}`);
    });

    const patientFollowYmd = normalizeYmd(
      typeof enquiryData.followUpDate === 'string' ? enquiryData.followUpDate : undefined
    );
    if (patientFollowYmd) {
      const alreadyCovered = followList.some(
        (fu) => normalizeYmd(fu.nextFollowUpDate) === patientFollowYmd
      );
      if (!alreadyCovered) {
        const dueAt = parseDateSafe(patientFollowYmd);
        if (dueAt) {
          pushDue(dueAt, 'patient_info', 'patient_followup');
        }
      }
    }

    const schedules = Array.isArray(enquiryData.visitSchedules)
      ? enquiryData.visitSchedules
      : [];
    schedules.forEach((visit, index) => {
      if (isCancelledVisit(visit)) return;
      const appointmentAt = readVisitDateTime(visit);
      if (!appointmentAt) return;
      const dueAt = addMinutesLocal(appointmentAt, -30);
      const alreadyCovered = followList.some((fu) => {
        const next = pickNextFollowUpDateTime(fu);
        return next ? Math.abs(next.getTime() - dueAt.getTime()) < 60 * 1000 : false;
      });
      if (alreadyCovered) return;
      pushDue(dueAt, 'appointment_due', `visit_due_${index}`);
    });

    const linkedAppointments = appointmentsByEnquiryId.get(enquiryId) || [];
    linkedAppointments.forEach((appointment, index) => {
      if (isCancelledAppointment(appointment)) return;
      const appointmentAt = readAppointmentDateTime(appointment);
      if (!appointmentAt) return;
      const dueAt = addMinutesLocal(appointmentAt, -30);
      const alreadyCovered = followList.some((fu) => {
        const next = pickNextFollowUpDateTime(fu);
        return next ? Math.abs(next.getTime() - dueAt.getTime()) < 60 * 1000 : false;
      });
      if (alreadyCovered) return;
      pushDue(dueAt, 'appointment_due', `apt_due_${index}`);
    });
  }

  const telecallerOptions = Array.from(telecallerSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const centerOptions = Array.from(centerSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

  const summaryMap = new Map<string, TelecallerSummaryRow>();

  const ensureRow = (name: string): TelecallerSummaryRow => {
    const existing = summaryMap.get(name);
    if (existing) return existing;
    const row: TelecallerSummaryRow = {
      telecaller: name,
      callsLogged: 0,
      activeDays: 0,
      dueScheduled: 0,
      dueCompleted: 0,
      dueMissed: 0,
      compliancePct: null,
      overdueNow: 0,
      enquiriesTouched: 0,
      soldNowCount: 0,
      soldDuringPeriodCount: 0,
      soldNowPct: null,
      soldDuringPeriodPct: null,
    };
    summaryMap.set(name, row);
    return row;
  };

  const activeDaysByTelecaller = new Map<string, Set<string>>();
  const enquiriesTouchedByTelecaller = new Map<string, Set<string>>();
  const soldNowByTelecaller = new Map<string, Set<string>>();
  const soldDuringByTelecaller = new Map<string, Set<string>>();

  for (const ev of callEvents) {
    const row = ensureRow(ev.telecaller);
    row.callsLogged += 1;
    const days = activeDaysByTelecaller.get(ev.telecaller) || new Set<string>();
    days.add(ev.callDateYmd);
    activeDaysByTelecaller.set(ev.telecaller, days);
    const touched = enquiriesTouchedByTelecaller.get(ev.telecaller) || new Set<string>();
    touched.add(ev.enquiryId);
    enquiriesTouchedByTelecaller.set(ev.telecaller, touched);
    if (ev.soldNow) {
      const soldSet = soldNowByTelecaller.get(ev.telecaller) || new Set<string>();
      soldSet.add(ev.enquiryId);
      soldNowByTelecaller.set(ev.telecaller, soldSet);
    }
    if (ev.soldDuringPeriod) {
      const soldSet = soldDuringByTelecaller.get(ev.telecaller) || new Set<string>();
      soldSet.add(ev.enquiryId);
      soldDuringByTelecaller.set(ev.telecaller, soldSet);
    }
  }

  for (const due of dueObligations) {
    const row = ensureRow(due.telecaller);
    row.dueScheduled += 1;
    if (due.completed) row.dueCompleted += 1;
    else row.dueMissed += 1;
    if (due.overdueNow) row.overdueNow += 1;
  }

  for (const [name, row] of summaryMap) {
    row.activeDays = activeDaysByTelecaller.get(name)?.size ?? 0;
    row.enquiriesTouched = enquiriesTouchedByTelecaller.get(name)?.size ?? 0;
    row.soldNowCount = soldNowByTelecaller.get(name)?.size ?? 0;
    row.soldDuringPeriodCount = soldDuringByTelecaller.get(name)?.size ?? 0;
    row.compliancePct =
      row.dueScheduled > 0 ? Math.round((row.dueCompleted / row.dueScheduled) * 1000) / 10 : null;
    row.soldNowPct =
      row.enquiriesTouched > 0
        ? Math.round((row.soldNowCount / row.enquiriesTouched) * 1000) / 10
        : null;
    row.soldDuringPeriodPct =
      row.enquiriesTouched > 0
        ? Math.round((row.soldDuringPeriodCount / row.enquiriesTouched) * 1000) / 10
        : null;
  }

  const summaryRows = Array.from(summaryMap.values()).sort((a, b) => {
    if (b.callsLogged !== a.callsLogged) return b.callsLogged - a.callsLogged;
    return a.telecaller.localeCompare(b.telecaller);
  });

  const dailyMap = new Map<string, DailySeriesPoint>();
  const dailyKey = (date: string, telecaller: string) => `${date}|${telecaller}`;

  for (const ev of callEvents) {
    const key = dailyKey(ev.callDateYmd, ev.telecaller);
    const existing = dailyMap.get(key);
    if (existing) {
      existing.calls += 1;
    } else {
      dailyMap.set(key, {
        date: ev.callDateYmd,
        telecaller: ev.telecaller,
        calls: 1,
        duesDue: 0,
        duesCompleted: 0,
      });
    }
  }

  for (const due of dueObligations) {
    const key = dailyKey(due.dueDateYmd, due.telecaller);
    const existing = dailyMap.get(key);
    if (existing) {
      existing.duesDue += 1;
      if (due.completed) existing.duesCompleted += 1;
    } else {
      dailyMap.set(key, {
        date: due.dueDateYmd,
        telecaller: due.telecaller,
        calls: 0,
        duesDue: 1,
        duesCompleted: due.completed ? 1 : 0,
      });
    }
  }

  const dailySeries = Array.from(dailyMap.values()).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.telecaller.localeCompare(b.telecaller);
  });

  return {
    callEvents,
    dueObligations,
    summaryRows,
    dailySeries,
    telecallerOptions,
    centerOptions,
  };
}
