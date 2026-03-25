import { collection, getDocs, type QuerySnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { StaffRecord } from '@/utils/enquiryTelecallerOptions';

function mapStaffSnapshot(querySnapshot: QuerySnapshot): StaffRecord[] {
  return querySnapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as { name?: string; jobRole?: string; status?: string };
      return {
        id: docSnap.id,
        name: (data.name || '').toString().trim(),
        jobRole: (data.jobRole || '').toString().trim(),
        status: data.status,
      };
    })
    .filter((s) => (s.status || 'active') === 'active' && s.name);
}

/**
 * Load `staff` for enquiry UI. Tries client Firestore first; on failure (e.g. security rules
 * for staff-role users), falls back to `/api/staff/enquiry-options` (Admin SDK).
 */
export async function fetchStaffRecordsWithServerFallback(): Promise<StaffRecord[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'staff'));
    return mapStaffSnapshot(snap);
  } catch (e) {
    console.warn('Client Firestore staff list failed; trying server fallback:', e);
  }

  try {
    const { auth } = await import('@/firebase/config');
    const user = auth?.currentUser;
    if (!user) return [];
    const token = await user.getIdToken();
    const res = await fetch('/api/staff/enquiry-options', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { ok?: boolean; staff?: StaffRecord[] };
    if (!data.ok || !Array.isArray(data.staff)) return [];
    return data.staff;
  } catch (e) {
    console.error('Server staff list fallback failed:', e);
    return [];
  }
}
