import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';
import { cascadeRenameBusinessCompany } from '@/server/admin/cascadeRenameBusinessCompany';

export const maxDuration = 120;

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
    const companyId = String(body?.companyId || '').trim();
    const oldName = String(body?.oldName || '').trim();
    const newName = String(body?.newName || '').trim();

    if (!companyId) return jsonError('companyId is required', 400);
    if (!oldName || !newName) return jsonError('oldName and newName are required', 400);
    if (oldName === newName) {
      return NextResponse.json({
        ok: true,
        updatedByCollection: {},
        totalUpdated: 0,
        message: 'No rename needed',
      });
    }

    const db = adminDb();
    const companyRef = db.collection('companies').doc(companyId);
    const companySnap = await companyRef.get();
    if (!companySnap.exists) return jsonError('Company not found', 404);

    const currentName = String((companySnap.data() as { name?: string }).name || '').trim();
    // Allow: (1) normal rename — company doc still has oldName until client updates after cascade.
    // (2) repair — doc was already renamed (e.g. in Console) but purchases/inventory still use oldName.
    const matchesOld = currentName === oldName;
    const matchesNew = currentName === newName;
    if (!matchesOld && !matchesNew) {
      return jsonError(
        `Company name in Firestore ("${currentName}") must match either the legacy label (oldName) or the target name (newName). Open Companies and refresh, or fix the companies document.`,
        409,
      );
    }

    const result = await cascadeRenameBusinessCompany(db, oldName, newName);

    // Caller updates `companies/{companyId}` with the full form payload (name, type, etc.).

    return NextResponse.json({
      ok: true,
      updatedByCollection: result.updatedByCollection,
      totalUpdated: result.totalUpdated,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'Forbidden') return jsonError('Forbidden', 403);
    console.error('rename-business-company', e);
    return jsonError(msg || 'Rename failed', 500);
  }
}
