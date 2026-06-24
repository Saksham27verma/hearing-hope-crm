import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';

export interface SerialIndexEntry {
  products: string[];
}

export type SerialIndex = Map<string, SerialIndexEntry>;

/** Split comma/newline/pipe-separated serial strings; flatten nested arrays. */
export function splitSerialCandidates(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => splitSerialCandidates(item));
  }
  const text = String(raw).trim();
  if (!text) return [];
  return text
    .split(/[,\n;|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function serialsFromSerialPairs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const pair of value) {
    if (!Array.isArray(pair)) continue;
    for (const s of pair) {
      const t = String(s ?? '').trim();
      if (t) out.push(t);
    }
  }
  return out;
}

const SERIAL_REMARK_PATTERNS = [
  /\bS\/N\s*:?\s*([^,\-–—|\n]+)/gi,
  /\bSerial(?:\s+(?:Number|No\.?|#))?\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-_/]*)/gi,
];

/** Parse serial numbers embedded in free-text remarks/notes (e.g. trial/sales returns). */
export function serialsFromRemarksText(text: string): string[] {
  const out: string[] = [];
  for (const pattern of SERIAL_REMARK_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = String(match[1] || '').trim();
      if (candidate.length >= 3) out.push(candidate);
    }
  }
  return [...new Set(out)];
}

export function isSerialTrackedProductLine(prod: {
  type?: string;
  hasSerialNumber?: boolean;
}): boolean {
  if (prod.hasSerialNumber) return true;
  const type = String(prod.type || '').trim().toLowerCase();
  return type === 'hearing aid' || type.includes('hearing aid');
}

/**
 * Extract every serial number stored on a product line, including legacy field names
 * and serials embedded in remarks/notes.
 */
export function extractSerialNumbersFromProductLine(
  prod: Record<string, unknown>,
  opts?: { fallbackTexts?: string[] },
): string[] {
  const all: string[] = [];

  all.push(...splitSerialCandidates(prod.serialNumbers));
  all.push(...splitSerialCandidates(prod.serials));

  for (const key of [
    'serialNumber',
    'trialSerialNumber',
    'serialNo',
    'serial_no',
    'deviceSerial',
    'hearingAidSerial',
    'sn',
    'SN',
  ]) {
    all.push(...splitSerialCandidates(prod[key]));
  }

  all.push(...serialsFromSerialPairs(prod.serialPairs));

  if (all.length === 0 && opts?.fallbackTexts?.length) {
    for (const text of opts.fallbackTexts) {
      all.push(...serialsFromRemarksText(String(text || '')));
    }
  }

  return [...new Set(all.filter(Boolean))];
}

/** Serials for display/export with document-level context (reason, notes, etc.). */
export function productLineSerials(
  prod: Record<string, unknown>,
  materialContext?: { reason?: string; reference?: string; notes?: string },
): string[] {
  const fallbackTexts = [
    prod.remarks as string | undefined,
    materialContext?.reason,
    materialContext?.reference,
    materialContext?.notes,
  ].filter(Boolean) as string[];
  return extractSerialNumbersFromProductLine(prod, { fallbackTexts });
}

export function normalizeProductLinesWithSerials<T extends { remarks?: string; serialNumbers?: string[] }>(
  products: T[],
  materialContext?: { reason?: string; reference?: string; notes?: string },
): T[] {
  return products.map((product) => {
    const serials = productLineSerials(product as unknown as Record<string, unknown>, materialContext);
    if (serials.length === 0) return product;
    return { ...product, serialNumbers: serials };
  });
}

/**
 * Helper to safely extract serial numbers and associated product names
 * from a products array used in various Firestore documents
 * (materialInward, purchases, sales, etc.).
 */
const extractSerialsFromProducts = (
  products: any[] | undefined | null,
  index: SerialIndex
) => {
  if (!Array.isArray(products)) return;

  products.forEach((prod: any) => {
    const productName = String(prod?.name ?? '').trim() || 'Unknown product';

    extractSerialNumbersFromProductLine(prod).forEach((sn) => {
      const existing = index.get(sn);
      if (existing) {
        if (!existing.products.includes(productName)) {
          existing.products.push(productName);
        }
      } else {
        index.set(sn, { products: [productName] });
      }
    });
  });
};

export type FetchExistingSerialNumbersOptions = {
  /** When editing a purchase, ignore serials on that document so removed units can be re-added. */
  excludePurchaseId?: string;
  /** When editing material inward, ignore serials on that document. */
  excludeMaterialInwardId?: string;
};

/**
 * Fetches all known serial numbers from key transactional collections.
 *
 * This is intentionally broad: it looks at materialInward, purchases,
 * sales, distributions, materialsOut, and stockTransfer so that we
 * avoid re‑using any serial number that has ever entered the system.
 *
 * Returns a SerialIndex mapping serial -> list of product names
 * where that serial has appeared.
 */
export const fetchExistingSerialNumbers = async (
  options?: FetchExistingSerialNumbersOptions,
): Promise<SerialIndex> => {
  const index: SerialIndex = new Map();
  const excludePurchaseId = String(options?.excludePurchaseId || '').trim();
  const excludeMaterialInwardId = String(options?.excludeMaterialInwardId || '').trim();

  try {
    const [
      materialInSnap,
      purchasesSnap,
      salesSnap,
      distributionsSnap,
      materialsOutSnap,
      stockTransferSnap,
    ] = await Promise.all([
      getDocs(collection(db, 'materialInward')),
      getDocs(collection(db, 'purchases')),
      getDocs(collection(db, 'sales')),
      getDocs(collection(db, 'distributions')),
      getDocs(collection(db, 'materialsOut')),
      getDocs(collection(db, 'stockTransfers')),
    ]);

    const processSnapshot = (snap: any, skipDocId?: string) => {
      snap.docs.forEach((docSnap: any) => {
        if (skipDocId && docSnap.id === skipDocId) return;
        const data: any = docSnap.data();
        extractSerialsFromProducts(data?.products, index);
      });
    };

    processSnapshot(materialInSnap, excludeMaterialInwardId || undefined);
    processSnapshot(purchasesSnap, excludePurchaseId || undefined);
    processSnapshot(salesSnap);
    processSnapshot(distributionsSnap);
    processSnapshot(materialsOutSnap);
    processSnapshot(stockTransferSnap);
  } catch (error) {
    console.error('Error fetching existing serial numbers:', error);
    // We deliberately swallow the error here; callers should still be able
    // to function, but they won't have global duplicate protection.
  }

  return index;
};


