import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/server/firebaseAdmin';

export const runtime = 'nodejs';

const STRICT_BOOKING_RE = /^BR-(\d{6})$/;
const STRICT_TRIAL_RE = /^TR-(\d{6})$/;

const pad = (n: number) => String(Math.max(1, Math.floor(n))).padStart(6, '0');

const parseSeq = (kind: 'booking' | 'trial', value: unknown): number | null => {
  const s = String(value ?? '').trim();
  const m = (kind === 'booking' ? STRICT_BOOKING_RE : STRICT_TRIAL_RE).exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const isHomeTrial = (visit: Record<string, unknown>) =>
  String(visit.trialHearingAidType ?? '').trim().toLowerCase() === 'home';

export async function POST() {
  try {
    const db = adminDb();
    const enquirySnap = await db.collection('enquiries').get();

    const bookingCount = new Map<string, number>();
    const trialCount = new Map<string, number>();
    let bookingSeq = 0;
    let trialSeq = 0;

    // First pass: collect max + existing strict numbers.
    for (const d of enquirySnap.docs) {
      const data = d.data() as Record<string, unknown>;
      const visits = Array.isArray(data.visits) ? (data.visits as Array<Record<string, unknown>>) : [];
      for (const v of visits) {
        const b = String(v.bookingReceiptNumber || '').trim();
        const t = String(v.trialReceiptNumber || '').trim();
        const bSeq = parseSeq('booking', b);
        const tSeq = parseSeq('trial', t);
        if (bSeq) {
          bookingCount.set(b, (bookingCount.get(b) || 0) + 1);
          bookingSeq = Math.max(bookingSeq, bSeq);
        }
        if (tSeq) {
          trialCount.set(t, (trialCount.get(t) || 0) + 1);
          trialSeq = Math.max(trialSeq, tSeq);
        }
      }
    }

    let docsUpdated = 0;
    let bookingRewritten = 0;
    let trialRewritten = 0;

    for (const d of enquirySnap.docs) {
      const data = d.data() as Record<string, unknown>;
      const visits = Array.isArray(data.visits) ? [...(data.visits as Array<Record<string, unknown>>)] : [];
      const schedules = Array.isArray(data.visitSchedules)
        ? [...(data.visitSchedules as Array<Record<string, unknown>>)]
        : [];
      let changed = false;

      for (let i = 0; i < visits.length; i++) {
        const v = { ...(visits[i] || {}) };
        const s = { ...(schedules[i] || {}) };

        const isBookingRelevant =
          Boolean(v.hearingAidBooked) || Number(v.bookingAdvanceAmount || 0) > 0;
        if (isBookingRelevant) {
          const current = String(v.bookingReceiptNumber || '').trim();
          const seq = parseSeq('booking', current);
          const duplicate = (bookingCount.get(current) || 0) > 1;
          const validUnique = seq != null && !duplicate;
          if (!validUnique) {
            bookingSeq += 1;
            const nextNo = `BR-${pad(bookingSeq)}`;
            v.bookingReceiptNumber = nextNo;
            s.bookingReceiptNumber = nextNo;
            bookingRewritten += 1;
            changed = true;
          }
        }

        const isTrialRelevant =
          (Boolean(v.trialGiven) || Boolean(v.hearingAidTrial)) && isHomeTrial(v);
        if (isTrialRelevant) {
          const current = String(v.trialReceiptNumber || '').trim();
          const seq = parseSeq('trial', current);
          const duplicate = (trialCount.get(current) || 0) > 1;
          const validUnique = seq != null && !duplicate;
          if (!validUnique) {
            trialSeq += 1;
            const nextNo = `TR-${pad(trialSeq)}`;
            v.trialReceiptNumber = nextNo;
            s.trialReceiptNumber = nextNo;
            trialRewritten += 1;
            changed = true;
          }
        }

        visits[i] = v;
        if (schedules[i]) schedules[i] = s;
      }

      if (changed) {
        await db.collection('enquiries').doc(d.id).set(
          {
            visits,
            visitSchedules: schedules,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        docsUpdated += 1;
      }
    }

    await db.collection('receiptSettings').doc('default').set(
      {
        booking_next_number: bookingSeq + 1,
        trial_next_number: trialSeq + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      docsUpdated,
      bookingRewritten,
      trialRewritten,
      bookingNext: bookingSeq + 1,
      trialNext: trialSeq + 1,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backfill failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

