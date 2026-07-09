import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getFieldOptions } from '@/services/fieldOptionsService';
import { ENT_PROCEDURE_OPTIONS } from '@/components/enquiries/enquiryFormFieldOptions';
import { accountingSettingsDocRef } from '@/services/accountingNumbering';

export type ServiceCatalogItem = {
  key: string;
  kind: 'hearing_aid' | 'test' | 'ent';
  name: string;
  description?: string;
  company?: string;
  productType?: string;
  hsnSac?: string;
  gstPercent: number;
  suggestedRate: number;
  isFree?: boolean;
  hasSerialNumber?: boolean;
};

export type ServiceCatalog = {
  hearingAids: ServiceCatalogItem[];
  tests: ServiceCatalogItem[];
  entProcedures: ServiceCatalogItem[];
};

export async function fetchServiceCatalog(companyId: string): Promise<ServiceCatalog> {
  const [productsSnap, testOpts, priceMap] = await Promise.all([
    getDocs(collection(db, 'products')),
    getFieldOptions(db, 'enquiries', 'hearing_test_type'),
    loadServicePriceMap(companyId),
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
      hasSerialNumber: p.hasSerialNumber === true,
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

  return { hearingAids, tests, entProcedures };
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
