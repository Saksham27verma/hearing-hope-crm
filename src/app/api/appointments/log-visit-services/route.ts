import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';
import { StaffAuthHttpError, verifyStaffFromBearer } from '@/server/verifyStaffBearer';
import {
  mergeStaffVisitServicesIntoEnquiry,
  type StaffVisitServicesPayload,
} from '@/server/staffEnquiryVisitMerge';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function withCors(res: NextResponse): NextResponse {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

function jsonError(message: string, status: number) {
  return withCors(NextResponse.json({ ok: false, error: message }, { status }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

function parseAppointmentStart(start: unknown): Date | null {
  if (start == null) return null;
  if (typeof start === 'string') {
    const d = new Date(start);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof start === 'object' && start !== null) {
    const o = start as { toDate?: () => Date; seconds?: number };
    if (typeof o.toDate === 'function') return o.toDate();
    if (typeof o.seconds === 'number') return new Date(o.seconds * 1000);
  }
  return null;
}

function isSameCalendarDayInKolkata(a: Date, b: Date): boolean {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(a) === fmt.format(b);
}

function isAppointmentTodayServer(start: unknown): boolean {
  const d = parseAppointmentStart(start);
  if (!d) return false;
  return isSameCalendarDayInKolkata(d, new Date());
}

function deepStripUndefined(x: unknown): unknown {
  if (x === undefined) return undefined;
  if (x === null || typeof x !== 'object') return x;
  if (Array.isArray(x)) {
    return x.map((i) => deepStripUndefined(i)).filter((i) => i !== undefined);
  }
  const o = x as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) {
    const v = deepStripUndefined(o[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function parseServicesBody(raw: unknown): { ok: true; services: StaffVisitServicesPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'services object is required' };
  }
  const s = raw as Record<string, unknown>;

  const hearingTest = s.hearingTest;
  const accessory = s.accessory;
  const programming = s.programming;
  const counselling = s.counselling;

  if (!hearingTest && !accessory && !programming && !counselling) {
    return { ok: false, error: 'Select at least one service (hearingTest, accessory, programming, counselling)' };
  }

  const out: StaffVisitServicesPayload = {};

  if (hearingTest && typeof hearingTest === 'object') {
    const ht = hearingTest as Record<string, unknown>;
    const entriesRaw = ht.hearingTestEntries;
    if (!Array.isArray(entriesRaw) || entriesRaw.length === 0) {
      return { ok: false, error: 'hearingTest.hearingTestEntries must be a non-empty array' };
    }
    const hearingTestEntries = entriesRaw.map((row, i) => {
      const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      return {
        id: String(r.id ?? `row-${i}`).trim(),
        testType: String(r.testType ?? '').trim(),
        price: Math.max(0, Number(r.price) || 0),
      };
    });
    const hasType = hearingTestEntries.some((e) => e.testType);
    if (!hasType) {
      return { ok: false, error: 'Each hearing test row needs a test type' };
    }
    out.hearingTest = {
      hearingTestEntries,
      testDoneBy: ht.testDoneBy != null ? String(ht.testDoneBy).trim() : undefined,
      testResults: ht.testResults != null ? String(ht.testResults).trim() : undefined,
      recommendations: ht.recommendations != null ? String(ht.recommendations).trim() : undefined,
    };
  }

  if (accessory && typeof accessory === 'object') {
    const a = accessory as Record<string, unknown>;
    const accessoryName = String(a.accessoryName ?? '').trim();
    if (!accessoryName) {
      return { ok: false, error: 'accessory.accessoryName is required' };
    }
    out.accessory = {
      accessoryName,
      accessoryDetails: a.accessoryDetails != null ? String(a.accessoryDetails).trim() : undefined,
      accessoryFOC: typeof a.accessoryFOC === 'boolean' ? a.accessoryFOC : undefined,
      accessoryAmount:
        a.accessoryAmount != null && a.accessoryAmount !== '' ? Math.max(0, Number(a.accessoryAmount) || 0) : undefined,
      accessoryQuantity:
        a.accessoryQuantity != null && a.accessoryQuantity !== ''
          ? Math.max(1, Math.floor(Number(a.accessoryQuantity) || 1))
          : undefined,
    };
  }

  if (programming && typeof programming === 'object') {
    const p = programming as Record<string, unknown>;
    out.programming = {
      programmingReason: p.programmingReason != null ? String(p.programmingReason).trim() : undefined,
      programmingAmount:
        p.programmingAmount != null && p.programmingAmount !== ''
          ? Math.max(0, Number(p.programmingAmount) || 0)
          : undefined,
      programmingDoneBy: p.programmingDoneBy != null ? String(p.programmingDoneBy).trim() : undefined,
      hearingAidPurchaseDate:
        p.hearingAidPurchaseDate != null ? String(p.hearingAidPurchaseDate).trim() : undefined,
      hearingAidName: p.hearingAidName != null ? String(p.hearingAidName).trim() : undefined,
      underWarranty: typeof p.underWarranty === 'boolean' ? p.underWarranty : undefined,
      warranty: p.warranty != null ? String(p.warranty).trim() : undefined,
    };
  }

  if (counselling && typeof counselling === 'object') {
    const c = counselling as Record<string, unknown>;
    out.counselling = {
      notes: c.notes != null ? String(c.notes).trim() : undefined,
    };
  }

  if (
    !out.hearingTest &&
    !out.accessory &&
    !out.programming &&
    !out.counselling
  ) {
    return { ok: false, error: 'No valid service data after parsing' };
  }

  return { ok: true, services: out };
}

export async function POST(req: Request) {
  try {
    const { uid } = await verifyStaffFromBearer(req);

    const body = await req.json().catch(() => null);
    const appointmentId = (body?.appointmentId ?? '').toString().trim();
    const servicesRaw = body?.services;

    if (!appointmentId) {
      return jsonError('appointmentId is required', 400);
    }

    const parsed = parseServicesBody(servicesRaw);
    if (!parsed.ok) {
      return jsonError(parsed.error, 400);
    }

    const db = adminDb();
    const apptRef = db.collection('appointments').doc(appointmentId);
    const apptSnap = await apptRef.get();
    if (!apptSnap.exists) {
      return jsonError('Appointment not found', 404);
    }

    const appt = apptSnap.data() as Record<string, unknown>;

    const type = appt.type as string | undefined;
    if (type === 'home') {
      if (appt.homeVisitorStaffId !== uid) {
        return jsonError('This appointment is not assigned to you', 403);
      }
    } else if (type === 'center') {
      if (appt.assignedStaffId !== uid) {
        return jsonError('This appointment is not assigned to you', 403);
      }
    } else {
      return jsonError('Invalid appointment type', 400);
    }

    const statusRaw = ((appt.status as string) || '').toLowerCase();
    if (statusRaw === 'completed' || statusRaw === 'cancelled') {
      return jsonError('Cannot log visit for completed or cancelled appointments', 400);
    }
    if (statusRaw && statusRaw !== 'scheduled') {
      return jsonError('Appointment must be scheduled', 400);
    }

    if (!isAppointmentTodayServer(appt.start)) {
      return jsonError('Appointment must be scheduled for today', 400);
    }

    const enquiryId = (appt.enquiryId as string | undefined)?.trim();
    if (!enquiryId) {
      return jsonError('Appointment has no linked enquiry', 400);
    }

    const enquiryRef = db.collection('enquiries').doc(enquiryId);
    const enquirySnap = await enquiryRef.get();
    if (!enquirySnap.exists) {
      return jsonError('Linked enquiry not found', 400);
    }

    const enquiryData = { id: enquirySnap.id, ...(enquirySnap.data() as Record<string, unknown>) };

    const merged = mergeStaffVisitServicesIntoEnquiry({
      enquiry: enquiryData,
      appointment: appt,
      appointmentId,
      services: parsed.services,
    });

    await enquiryRef.update({
      visits: deepStripUndefined(merged.visits) as unknown[],
      visitSchedules: deepStripUndefined(merged.visitSchedules) as unknown[],
      updatedAt: FieldValue.serverTimestamp(),
    });

    return withCors(NextResponse.json({ ok: true, enquiryId }));
  } catch (err: unknown) {
    if (err instanceof StaffAuthHttpError) {
      return jsonError(err.message, err.statusCode);
    }
    console.error('log-visit-services error:', err);
    const message = err instanceof Error ? err.message : 'Failed to log visit services';
    return jsonError(message, 500);
  }
}
