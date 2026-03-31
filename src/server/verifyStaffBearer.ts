import type { DocumentData } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';

export class StaffAuthHttpError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'StaffAuthHttpError';
  }
}

export type VerifiedStaff = {
  uid: string;
  staff: DocumentData;
};

/**
 * Field staff (Expo / Staff PWA) sign in with a custom token whose UID is the `staff` document id.
 * This must be used instead of `users/{uid}` checks for mobile routes.
 */
export async function verifyStaffFromBearer(req: Request): Promise<VerifiedStaff> {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new StaffAuthHttpError('Missing Authorization bearer token', 401);
  }

  const idToken = match[1];
  let decoded: { uid: string };
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    throw new StaffAuthHttpError('Invalid or expired token', 401);
  }

  const uid = decoded.uid;
  const staffSnap = await adminDb().collection('staff').doc(uid).get();
  if (!staffSnap.exists) {
    throw new StaffAuthHttpError('Forbidden', 403);
  }

  const staff = staffSnap.data()!;
  if (staff.mobileAppEnabled !== true) {
    throw new StaffAuthHttpError('Mobile app access not enabled', 403);
  }

  return { uid, staff };
}
