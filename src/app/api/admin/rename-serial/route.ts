import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { getRequesterTenant } from '@/server/tenant/requesterTenant';
import { renameSerialEverywhere, type SerialRenameConflict } from '@/server/admin/serialRenamePropagation';

export const maxDuration = 120;

function jsonError(message: string, status: number, conflicts?: SerialRenameConflict[]) {
  return NextResponse.json({ ok: false, error: message, conflicts: conflicts ?? [] }, { status });
}

type RenameSerialBody = {
  oldSerial?: string;
  newSerial?: string;
  sourceCollection?: 'materialInward' | 'purchases';
  sourceDocId?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const decoded = await adminAuth().verifyIdToken(match[1]);
    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);

    const body = (await req.json().catch(() => null)) as RenameSerialBody | null;
    const oldSerial = String(body?.oldSerial || '').trim();
    const newSerial = String(body?.newSerial || '').trim();
    const sourceCollection = body?.sourceCollection;
    const sourceDocId = String(body?.sourceDocId || '').trim();

    if (!oldSerial || !newSerial) {
      return jsonError('oldSerial and newSerial are required', 400);
    }
    if (sourceCollection !== 'materialInward' && sourceCollection !== 'purchases') {
      return jsonError('sourceCollection must be materialInward or purchases', 400);
    }
    if (!sourceDocId) {
      return jsonError('sourceDocId is required', 400);
    }

    const db = adminDb();
    const result = await renameSerialEverywhere(db, {
      oldSerial,
      newSerial,
      source: {
        collection: sourceCollection,
        docId: sourceDocId,
      },
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const conflicts = (e as Error & { conflicts?: SerialRenameConflict[] }).conflicts;
    if (msg === 'Serial conflict found') {
      return jsonError(
        'New serial already exists in other records. Please choose a unique serial.',
        409,
        conflicts ?? [],
      );
    }
    if (msg === 'Forbidden') return jsonError('Forbidden', 403);
    console.error('rename-serial', e);
    return jsonError(msg || 'Serial rename failed', 500);
  }
}
