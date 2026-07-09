import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

export type AccountingCompanyProfile = {
  id: string;
  name: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
};

export async function fetchAccountingCompanyProfile(
  companyId: string,
): Promise<AccountingCompanyProfile | null> {
  const ref = doc(db, 'companies', companyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    name: String(d.name || snap.id),
    gstNumber: (d.gstNumber as string) || (d.gstin as string) || '',
    address: (d.address as string) || '',
    city: (d.city as string) || '',
    state: (d.state as string) || '',
    pincode: (d.pincode as string) || '',
    phone: (d.phone as string) || '',
    email: (d.email as string) || '',
    website: (d.website as string) || '',
    bankName: (d.bankName as string) || '',
    accountNumber: (d.accountNumber as string) || '',
    ifsc: (d.ifsc as string) || '',
    branch: (d.branch as string) || '',
  };
}
