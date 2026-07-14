import type {
  AppointmentComplianceFields,
  ComplianceFormData,
  GpsLocation,
} from '@/lib/visitCompliance/types';

export function generateFourDigitPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function isHomeVisitAppointment(data: { type?: unknown }): boolean {
  return String(data.type || '').trim().toLowerCase() === 'home';
}

/** Calendar day in Asia/Kolkata (matches staff PWA / visit APIs). */
export function isAppointmentTodayKolkata(start: unknown): boolean {
  const ms = toMillis(start);
  if (ms == null) return false;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date(ms)) === fmt.format(new Date());
}

export function isComplianceFullyComplete(data: AppointmentComplianceFields): boolean {
  return (
    data.telecaller_verified === true &&
    data.complianceStatus === 'completed' &&
    data.compliance_form_data != null &&
    data.gps_location != null
  );
}

/** Staff has finished on-site work and is waiting for telecaller call + PIN. */
export function isAwaitingTelecallerPin(data: AppointmentComplianceFields & { status?: unknown }): boolean {
  const status = String(data.status || 'scheduled').toLowerCase();
  if (status === 'cancelled') return false;
  // Do not hide when calendar status was marked completed early — complianceStatus is source of truth
  const cs = String(data.complianceStatus || '').toLowerCase();
  return cs === 'awaiting_telecaller_pin' || cs === 'pending_verification';
}

/**
 * Telecaller Log call / Generate PIN UI + red calendar / banner.
 * Show whenever staff has requested PIN (awaiting / pending).
 */
export function canShowTelecallerPinActions(
  data: AppointmentComplianceFields & { type?: unknown; status?: unknown; start?: unknown }
): boolean {
  if (!isHomeVisitAppointment(data)) return false;
  if (isComplianceFullyComplete(data)) return false;
  return isAwaitingTelecallerPin(data);
}

/** True when staff finished filling checkout and asked for PIN (draft present). */
export function hasCheckoutDraftForReview(
  data: AppointmentComplianceFields & { checkoutDraft?: unknown }
): boolean {
  return data.checkoutDraft != null && typeof data.checkoutDraft === 'object';
}

/**
 * True when CRM pipeline Sale/Booking should be blocked for this home appointment.
 * Legacy completed visits without compliance fields are not blocked.
 */
export function appointmentBlocksPipeline(data: AppointmentComplianceFields & {
  type?: unknown;
  status?: unknown;
}): boolean {
  if (!isHomeVisitAppointment(data)) return false;
  const status = String(data.status || 'scheduled').toLowerCase();
  if (status === 'cancelled') return false;
  if (data.complianceAdminOverride) return false;
  if (isComplianceFullyComplete(data)) return false;
  if (status === 'scheduled') return true;
  const cs = String(data.complianceStatus || '').toLowerCase();
  return (
    cs === 'awaiting_telecaller_pin' ||
    cs === 'pending_verification' ||
    cs === 'incomplete_compliance'
  );
}

export function parseComplianceForm(raw: unknown):
  | { ok: true; form: ComplianceFormData }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'compliance_form_data is required' };
  }
  const f = raw as Record<string, unknown>;

  const bool = (key: string): boolean | null => {
    if (typeof f[key] === 'boolean') return f[key] as boolean;
    return null;
  };

  const wearingIdUniformBag = bool('wearingIdUniformBag');
  const sharedPersonalContact = bool('sharedPersonalContact');
  const freeBatteryBoxesCommitted = bool('freeBatteryBoxesCommitted');
  const explainedAccessoriesCharges = bool('explainedAccessoriesCharges');
  const explainedWarranty = bool('explainedWarranty');

  if (
    wearingIdUniformBag == null ||
    sharedPersonalContact == null ||
    freeBatteryBoxesCommitted == null ||
    explainedAccessoriesCharges == null ||
    explainedWarranty == null
  ) {
    return { ok: false, error: 'All Yes/No compliance questions are required' };
  }

  const focRaw = f.focHomeVisitsCommitted;
  const focHomeVisitsCommitted = typeof focRaw === 'number' ? focRaw : Number(focRaw);
  if (!Number.isFinite(focHomeVisitsCommitted) || focHomeVisitsCommitted < 0) {
    return { ok: false, error: 'FOC home visits committed must be a non-negative number' };
  }

  let freeBatteryBoxesQty: number | null = null;
  if (freeBatteryBoxesCommitted) {
    const q = f.freeBatteryBoxesQty;
    const n = typeof q === 'number' ? q : Number(q);
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, error: 'Battery box quantity is required when free battery boxes were committed' };
    }
    freeBatteryBoxesQty = Math.floor(n);
  }

  return {
    ok: true,
    form: {
      wearingIdUniformBag,
      sharedPersonalContact,
      focHomeVisitsCommitted: Math.floor(focHomeVisitsCommitted),
      freeBatteryBoxesCommitted,
      freeBatteryBoxesQty,
      explainedAccessoriesCharges,
      explainedWarranty,
      connectedWithTelecaller: true,
    },
  };
}

export function parseGpsLocation(raw: unknown):
  | { ok: true; gps: GpsLocation }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'gps_location is required' };
  }
  const g = raw as Record<string, unknown>;
  const lat = typeof g.lat === 'number' ? g.lat : Number(g.lat);
  const lng = typeof g.lng === 'number' ? g.lng : Number(g.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: 'gps_location.lat and lng are required' };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { ok: false, error: 'gps_location coordinates out of range' };
  }
  const accuracy =
    g.accuracy == null || g.accuracy === ''
      ? null
      : typeof g.accuracy === 'number'
        ? g.accuracy
        : Number(g.accuracy);
  const capturedAt =
    typeof g.capturedAt === 'string' && g.capturedAt.trim()
      ? g.capturedAt.trim()
      : new Date().toISOString();

  return {
    ok: true,
    gps: {
      lat,
      lng,
      accuracy: Number.isFinite(accuracy as number) ? (accuracy as number) : null,
      capturedAt,
    },
  };
}

export function toMillis(ts: unknown): number | null {
  if (ts == null) return null;
  if (typeof ts === 'string' || typeof ts === 'number') {
    const n = new Date(ts).getTime();
    return Number.isNaN(n) ? null : n;
  }
  if (typeof ts === 'object') {
    const o = ts as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === 'function') {
      try {
        return o.toDate().getTime();
      } catch {
        return null;
      }
    }
    if (typeof o.seconds === 'number') return o.seconds * 1000;
    if (typeof o._seconds === 'number') return o._seconds * 1000;
  }
  return null;
}

/**
 * PIN may only be generated after a telecaller has logged a call for this visit's patient.
 * Accepts either:
 * - a call on the same Asia/Kolkata calendar day as the appointment, or
 * - a call at/after the appointment due window (start − 30 min).
 * Same-day matching is required so end-of-visit calls before the scheduled slot still unlock PIN.
 */
export function hasTelecallerCallLoggedForVisit(
  followUps: unknown,
  appointmentStart: unknown
): boolean {
  const startMs = toMillis(appointmentStart);
  if (startMs == null) return false;
  const list = Array.isArray(followUps) ? followUps : [];
  if (list.length === 0) return false;

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const apptDay = fmt.format(new Date(startMs));
  const dueAtMs = startMs - 30 * 60 * 1000;

  return list.some((raw) => {
    if (!raw || typeof raw !== 'object') return false;
    const fu = raw as { date?: string; dateTime?: string; createdAt?: unknown };
    let callAt: number | null = null;
    if (typeof fu.dateTime === 'string' && fu.dateTime.trim()) {
      const t = new Date(fu.dateTime.trim()).getTime();
      if (Number.isFinite(t)) callAt = t;
    }
    if (callAt == null && typeof fu.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fu.date.trim())) {
      const ymd = fu.date.trim().slice(0, 10);
      if (ymd === apptDay) return true;
      const t = new Date(`${ymd}T10:00:00`).getTime();
      if (Number.isFinite(t)) callAt = t;
    }
    if (callAt == null) {
      callAt = toMillis(fu.createdAt);
    }
    if (callAt == null) return false;
    if (fmt.format(new Date(callAt)) === apptDay) return true;
    return callAt >= dueAtMs;
  });
}

export const PIN_REQUIRES_CALL_LOG_MESSAGE =
  'Log a call with this patient below before generating a verification PIN.';

