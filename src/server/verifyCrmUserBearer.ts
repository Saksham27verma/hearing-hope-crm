import { adminAuth, adminDb } from '@/server/firebaseAdmin';

export class CrmAuthHttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'CrmAuthHttpError';
  }
}

/**
 * Verifies Firebase ID token and ensures `users/{uid}` exists with a CRM role.
 */
export async function verifyCrmUserFromBearer(req: Request): Promise<{ uid: string; role: string }> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new CrmAuthHttpError('Missing Authorization bearer token', 401);

  const idToken = match[1];
  const decoded = await adminAuth().verifyIdToken(idToken);
  const db = adminDb();
  const userSnap = await db.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) throw new CrmAuthHttpError('Forbidden', 403);

  const roleRaw = (userSnap.data() as { role?: string })?.role;
  const role = typeof roleRaw === 'string' ? roleRaw.trim().toLowerCase() : '';
  if (!role || !['admin', 'staff', 'audiologist'].includes(role)) {
    throw new CrmAuthHttpError('Forbidden', 403);
  }

  return { uid: decoded.uid, role };
}

/** Inventory-style actions: admin and staff only (not audiologist). */
export function assertStaffTrialCustodyWriter(role: string) {
  const r = role.trim().toLowerCase();
  if (r === 'admin' || r === 'staff') return;
  throw new CrmAuthHttpError('Forbidden: trial custody changes require staff or admin role', 403);
}
