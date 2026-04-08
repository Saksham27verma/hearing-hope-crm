import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { isSuperAdminViewer, normalizeCenterIdsFromProfile } from '@/lib/tenant/centerScope';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const decoded = await adminAuth().verifyIdToken(match[1]);
    const db = adminDb();

    // Ensure caller is a valid CRM user.
    const callerSnap = await db.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists) return jsonError('Forbidden', 403);

    const body = (await req.json().catch(() => null)) as { saleId?: unknown } | null;
    const saleId = String(body?.saleId || '').trim();
    if (!saleId) return jsonError('Missing saleId', 400);

    const saleSnap = await db.collection('sales').doc(saleId).get();
    if (!saleSnap.exists) return jsonError('Sale not found', 404);
    const sale = (saleSnap.data() || {}) as Record<string, unknown>;

    const centerIdRaw = sale.centerId ?? sale.branch ?? null;
    const centerId = centerIdRaw ? String(centerIdRaw).trim() : null;

    const patient = String(sale.patientName || 'Patient').trim() || 'Patient';
    const grandTotal = Number(sale.grandTotal) || (Number(sale.totalAmount) || 0) + (Number(sale.gstAmount) || 0);
    const invoiceNumber = String(sale.invoiceNumber || '').trim();
    const money = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number.isFinite(grandTotal) ? grandTotal : 0);

    const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
    if (adminsSnap.empty) return NextResponse.json({ ok: true, notified: 0 });

    const writes: Array<{ uid: string; notifId: string; centerId: string | null }> = [];
    adminsSnap.docs.forEach((d) => {
      const data = (d.data() || {}) as Record<string, unknown>;
      const profile = {
        uid: d.id,
        email: String(data.email || ''),
        displayName: String(data.displayName || ''),
        nickname: typeof data.nickname === 'string' ? data.nickname : undefined,
        role: 'admin' as const,
        branchId: typeof data.branchId === 'string' ? data.branchId : undefined,
        centerId: (data.centerId as string | null | undefined) ?? null,
        centerIds: (Array.isArray(data.centerIds) ? (data.centerIds as string[]) : null) as string[] | null,
        isSuperAdmin: data.isSuperAdmin === true ? true : data.isSuperAdmin === false ? false : undefined,
      };

      // Center-scoped recipients: super-admin gets all; otherwise must include the centerId (when known).
      const superAdmin = isSuperAdminViewer(profile as any);
      if (!superAdmin && centerId) {
        const centers = normalizeCenterIdsFromProfile(profile as any);
        if (centers.length > 0 && !centers.includes(centerId)) return;
      }

      const notifId = `newSale|${saleId}|${d.id}`;
      writes.push({ uid: d.id, notifId, centerId });
    });

    if (writes.length === 0) return NextResponse.json({ ok: true, notified: 0 });

    const batch = db.batch();
    writes.forEach((w) => {
      batch.set(db.collection('notifications').doc(w.notifId), {
        userId: w.uid,
        centerId: w.centerId,
        type: 'new_sale',
        title: 'New Sale',
        message: `${patient}${invoiceNumber ? ` · ${invoiceNumber}` : ''} · ${money}${centerId ? ` (${centerId})` : ''}`,
        href: '/sales',
        entity: { kind: 'sale', id: saleId },
        is_read: false,
        readAt: null,
        createdAt: FieldValue.serverTimestamp(),
        dedupeKey: `newSale|${saleId}`,
      }, { merge: false });
    });
    await batch.commit();

    return NextResponse.json({ ok: true, notified: writes.length });
  } catch (err: unknown) {
    console.error('notifications/new-sale:', err);
    const msg = err instanceof Error ? err.message : 'Failed to notify admins';
    return jsonError(msg, 500);
  }
}

