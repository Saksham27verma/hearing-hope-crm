import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/firebase/config';

export type BusinessCompany = { id: string; name: string };

/**
 * Legal/business entities from `companies` (Hope Enterprises, HDIPL, etc.).
 * Not the same as product manufacturer `company` on catalog items.
 */
export async function fetchBusinessCompanies(): Promise<BusinessCompany[]> {
  const q = query(collection(db, 'companies'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    name: String((d.data() as { name?: string }).name || d.id).trim(),
  }));
}

/**
 * Pick a default business company for forms: keep previous if still valid, else first in list.
 */
export function defaultCompanySelection(
  companies: BusinessCompany[],
  previousName?: string,
): string {
  const list = companies.map((c) => c.name).filter(Boolean);
  if (list.length === 0) return '';
  const prev = String(previousName || '').trim();
  if (prev) {
    const found = list.find((n) => n.toLowerCase() === prev.toLowerCase());
    if (found) return found;
  }
  return list[0];
}

const BUSINESS_COMPANY_COLORS = [
  '#1976d2',
  '#388e3c',
  '#f57c00',
  '#7b1fa2',
  '#c62828',
  '#00695c',
  '#5d4037',
  '#6a1b9a',
  '#0277bd',
  '#558b2f',
];

/** Stable accent color for a business company name (inventory UI). */
export function businessCompanyChipColor(name: string): string {
  const s = String(name || '').trim();
  if (!s) return '#616161';
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33 + s.charCodeAt(i)) >>> 0;
  }
  return BUSINESS_COMPANY_COLORS[h % BUSINESS_COMPANY_COLORS.length];
}
