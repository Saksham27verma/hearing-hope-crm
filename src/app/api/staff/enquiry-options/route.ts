import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import type { StaffRecord } from '@/utils/enquiryTelecallerOptions';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Active staff rows for enquiry telecaller / staff dropdowns.
 * Uses Admin SDK so CRM staff users still get the full list when client Firestore
 * rules block `getDocs(collection('staff'))` (common when rules only allow own doc).
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);
    const db = adminDb();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return jsonError('Forbidden', 403);

    const roleRaw = (userSnap.data() as { role?: string })?.role;
    const role =
      typeof roleRaw === 'string' ? roleRaw.trim().toLowerCase() : '';
    if (!role || !['admin', 'staff', 'audiologist'].includes(role)) {
      return jsonError('Forbidden', 403);
    }

    const snap = await db.collection('staff').get();
    const staff: StaffRecord[] = snap.docs
      .map((d) => {
        const data = d.data() as { name?: string; jobRole?: string; status?: string };
        return {
          id: d.id,
          name: (data.name || '').toString().trim(),
          jobRole: (data.jobRole || '').toString().trim(),
          status: data.status,
        };
      })
      .filter((s) => (s.status || 'active') === 'active' && s.name);

    return NextResponse.json({ ok: true, staff });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load staff';
    console.error('staff/enquiry-options error:', err);
    return jsonError(message, 500);
  }
}
