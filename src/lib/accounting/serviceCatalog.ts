import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getFieldOptions } from '@/services/fieldOptionsService';
import { ENT_PROCEDURE_OPTIONS } from '@/components/enquiries/enquiryFormFieldOptions';
import { accountingSettingsDocRef } from '@/services/accountingNumbering';

export type ServiceCatalogItem = {
  key: string;
  kind: 'hearing_aid' | 'test' | 'ent' | 'custom';
  name: string;
  description?: string;
  company?: string;
  productType?: string;
  hsnSac?: string;
  gstPercent: number;
  suggestedRate: number;
  isFree?: boolean;
  hasSerialNumber?: boolean;
  customId?: string;
};

export type ServiceCatalog = {
  hearingAids: ServiceCatalogItem[];
  tests: ServiceCatalogItem[];
  entProcedures: ServiceCatalogItem[];
  custom: ServiceCatalogItem[];
};

export type CustomCatalogItemInput = {
  name: string;
  hsnSac?: string;
  gstPercent: number;
  suggestedRate: number;
};

const CUSTOM_COLLECTION = 'accountingCatalog';

export async function fetchServiceCatalog(companyId: string): Promise<ServiceCatalog> {
  const [productsSnap, testOpts, priceMap, custom] = await Promise.all([
    getDocs(collection(db, 'products')),
    getFieldOptions(db, 'enquiries', 'hearing_test_type'),
    loadServicePriceMap(companyId),
    fetchCustomCatalogItems(companyId),
  ]);

  const hearingAids: ServiceCatalogItem[] = productsSnap.docs.map((d) => {
    const p = d.data() as Record<string, unknown>;
    const gstApplicable = p.gstApplicable !== false;
    const key = `product:${d.id}`;
    const savedRate = priceMap[key];
    return {
      key,
      kind: 'hearing_aid',
      name: String(p.name || 'Unnamed'),
      company: (p.company as string) || '',
      productType: (p.type as string) || '',
      hsnSac: (p.hsnCode as string) || '',
      gstPercent: gstApplicable ? Number(p.gstPercentage || 18) : 0,
      suggestedRate: Number(savedRate ?? p.mrp ?? 0),
      isFree: p.isFreeOfCost === true,
      // Hearing aids are serial-tracked by default (even if master flag is unset).
      hasSerialNumber:
        p.hasSerialNumber === true ||
        String(p.type || '')
          .trim()
          .toLowerCase()
          .includes('hearing aid'),
    };
  });
  hearingAids.sort((a, b) => a.name.localeCompare(b.name));

  const tests: ServiceCatalogItem[] = testOpts.map((o) => {
    const key = `test:${o.optionValue}`;
    return {
      key,
      kind: 'test',
      name: o.optionLabel,
      hsnSac: '9993',
      gstPercent: 18,
      suggestedRate: Number(priceMap[key] ?? 0),
    };
  });

  const entProcedures: ServiceCatalogItem[] = ENT_PROCEDURE_OPTIONS.map((o) => {
    const key = `ent:${o.optionValue}`;
    return {
      key,
      kind: 'ent',
      name: o.optionLabel,
      hsnSac: '9993',
      gstPercent: 18,
      suggestedRate: Number(priceMap[key] ?? 0),
    };
  });

  return { hearingAids, tests, entProcedures, custom };
}

export async function fetchCustomCatalogItems(
  companyId: string,
): Promise<ServiceCatalogItem[]> {
  try {
    const snap = await getDocs(
      query(collection(db, CUSTOM_COLLECTION), where('companyId', '==', companyId)),
    );
    const rows: ServiceCatalogItem[] = snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          key: `custom:${d.id}`,
          kind: 'custom' as const,
          name: String(data.name || 'Untitled'),
          hsnSac: (data.hsnSac as string) || '',
          gstPercent: Number(data.gstPercent ?? 18),
          suggestedRate: Number(data.suggestedRate ?? 0),
          customId: d.id,
        };
      })
      .filter((r) => (r.name || '').trim().length > 0);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  } catch (e) {
    console.warn('fetchCustomCatalogItems failed', e);
    return [];
  }
}

export async function addCustomCatalogItem(
  companyId: string,
  input: CustomCatalogItemInput,
): Promise<string> {
  const ref = await addDoc(collection(db, CUSTOM_COLLECTION), {
    companyId,
    name: input.name.trim(),
    hsnSac: input.hsnSac?.trim() || '',
    gstPercent: Math.max(0, Math.min(100, Number(input.gstPercent) || 0)),
    suggestedRate: Math.max(0, Number(input.suggestedRate) || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCustomCatalogItem(
  customId: string,
  patch: Partial<CustomCatalogItemInput>,
): Promise<void> {
  const cleaned: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.name !== undefined) cleaned.name = patch.name.trim();
  if (patch.hsnSac !== undefined) cleaned.hsnSac = patch.hsnSac.trim();
  if (patch.gstPercent !== undefined)
    cleaned.gstPercent = Math.max(0, Math.min(100, Number(patch.gstPercent) || 0));
  if (patch.suggestedRate !== undefined)
    cleaned.suggestedRate = Math.max(0, Number(patch.suggestedRate) || 0);
  await updateDoc(doc(db, CUSTOM_COLLECTION, customId), cleaned);
}

export async function deleteCustomCatalogItem(customId: string): Promise<void> {
  await deleteDoc(doc(db, CUSTOM_COLLECTION, customId));
}

export async function loadServicePriceMap(companyId: string): Promise<Record<string, number>> {
  try {
    const snap = await getDoc(accountingSettingsDocRef(db, companyId));
    if (!snap.exists()) return {};
    const data = snap.data() as Record<string, unknown>;
    const map = data.servicePrices;
    if (!map || typeof map !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export async function rememberServicePrices(
  companyId: string,
  entries: { key: string; rate: number }[],
): Promise<void> {
  const filtered = entries.filter((e) => e.key && Number.isFinite(e.rate) && e.rate > 0);
  if (filtered.length === 0) return;
  const servicePrices: Record<string, number> = {};
  for (const e of filtered) servicePrices[e.key] = Number(e.rate);
  try {
    await setDoc(
      accountingSettingsDocRef(db, companyId),
      { servicePrices },
      { merge: true },
    );
  } catch (e) {
    console.warn('rememberServicePrices failed', e);
  }
}
