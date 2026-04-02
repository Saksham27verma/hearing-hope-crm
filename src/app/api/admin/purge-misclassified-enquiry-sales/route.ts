import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isRealSaleVisit(visit: Record<string, unknown> | null | undefined): boolean {
  if (!visit) return false;
  return Boolean(
    (visit as any)?.hearingAidSale ||
      (visit as any)?.purchaseFromTrial ||
      (visit as any)?.hearingAidStatus === 'sold'
  );
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);
    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const db = adminDb();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const dryRun = Boolean(body?.dryRun);

    const salesSnap = await db.collection('sales').where('source', '==', 'enquiry').get();

    let checked = 0;
    const misclassifiedSaleIds: string[] = [];

    for (const saleDoc of salesSnap.docs) {
      checked++;

      const sale = saleDoc.data() as Record<string, unknown>;
      const enquiryIdRaw = sale?.enquiryId;
      const enquiryId = typeof enquiryIdRaw === 'string' && enquiryIdRaw.trim() ? enquiryIdRaw.trim() : '';
      if (!enquiryId) continue;

      const enquiryVisitIndexRaw = sale?.enquiryVisitIndex;
      const visitIndex =
        typeof enquiryVisitIndexRaw === 'number' && Number.isFinite(enquiryVisitIndexRaw)
          ? Math.floor(enquiryVisitIndexRaw)
          : typeof enquiryVisitIndexRaw === 'string' && enquiryVisitIndexRaw.trim()
            ? Math.floor(Number(enquiryVisitIndexRaw))
            : NaN;

      if (!Number.isFinite(visitIndex)) continue;

      const enquirySnap = await db.collection('enquiries').doc(enquiryId).get();
      if (!enquirySnap.exists) continue;

      const enquiry = enquirySnap.data() as Record<string, unknown>;
      const visitsKey = Array.isArray(enquiry?.visits) ? 'visits' : 'visitSchedules';
      const visitList = Array.isArray(enquiry?.[visitsKey]) ? [...(enquiry?.[visitsKey] as any[])] : [];
      const visit = visitList[visitIndex] as Record<string, unknown> | undefined;

      if (!isRealSaleVisit(visit)) {
        misclassifiedSaleIds.push(saleDoc.id);
      }
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        checked,
        misclassifiedCount: misclassifiedSaleIds.length,
      });
    }

    // Delete in batches of 500 to respect Firestore write limits.
    const ids = misclassifiedSaleIds;
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const batch = db.batch();
      const chunk = ids.slice(i, i + 500);
      chunk.forEach((id) => batch.delete(db.collection('sales').doc(id)));
      await batch.commit();
      deleted += chunk.length;
    }

    return NextResponse.json({
      ok: true,
      dryRun: false,
      checked,
      deletedCount: deleted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to purge misclassified enquiry sales';
    console.error('purge-misclassified-enquiry-sales error:', err);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}

