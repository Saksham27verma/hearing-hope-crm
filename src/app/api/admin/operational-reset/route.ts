import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';
import {
  OPERATIONAL_RESET_COLLECTIONS,
  countDocumentsInCollection,
  deleteAllDocumentsInCollection,
  rewriteAllEnquiriesSanitized,
} from '@/server/admin/operationalReset';

export const maxDuration = 60;

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const decoded = await adminAuth().verifyIdToken(match[1]);
    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    assertAdmin(requester);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const dryRun = Boolean(body?.dryRun);

    const db = adminDb();

    const collectionCounts: Record<string, number> = {};
    const collectionErrors: Record<string, string> = {};

    for (const name of OPERATIONAL_RESET_COLLECTIONS) {
      try {
        collectionCounts[name] = await countDocumentsInCollection(db, name);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        collectionErrors[name] = msg;
        collectionCounts[name] = -1;
      }
    }

    let enquiryCount = 0;
    try {
      enquiryCount = await countDocumentsInCollection(db, 'enquiries');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      collectionErrors.enquiries = msg;
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        collectionCounts,
        enquiryCount,
        collectionErrors: Object.keys(collectionErrors).length ? collectionErrors : undefined,
      });
    }

    const deletedByCollection: Record<string, number> = {};

    for (const name of OPERATIONAL_RESET_COLLECTIONS) {
      try {
        deletedByCollection[name] = await deleteAllDocumentsInCollection(db, name);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        collectionErrors[name] = msg;
        deletedByCollection[name] = 0;
      }
    }

    let enquiriesRewritten = 0;
    try {
      enquiriesRewritten = await rewriteAllEnquiriesSanitized(db);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      collectionErrors.enquiriesRewrite = msg;
    }

    return NextResponse.json({
      ok: Object.keys(collectionErrors).length === 0,
      dryRun: false,
      deletedByCollection,
      enquiriesRewritten,
      collectionErrors: Object.keys(collectionErrors).length ? collectionErrors : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operational reset failed';
    console.error('operational-reset error:', err);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}
