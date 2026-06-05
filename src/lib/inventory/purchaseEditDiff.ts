import { collection, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { serialsFromLineProduct } from '@/lib/enquiryInventoryAvailability';
import { stripSerialPairsFromProductLines } from '@/utils/stripSerialPairsForFirestore';

export type SerialTypoRename = {
  oldSerial: string;
  newSerial: string;
};

export type PurchaseLineProduct = {
  productId: string;
  name?: string;
  serialNumbers?: string[];
  quantity?: number;
};

export type RemovedPurchaseSerial = {
  serial: string;
  productId: string;
  productName: string;
};

const normalizeSerial = (value: string): string => String(value || '').trim();

function collectSerialEntries(
  products: PurchaseLineProduct[],
): Map<string, { productId: string; productName: string }> {
  const map = new Map<string, { productId: string; productName: string }>();
  products.forEach((product) => {
    const productId = String(product.productId || '').trim();
    const productName = String(product.name || '').trim() || 'Unknown product';
    serialsFromLineProduct(product).forEach((serial) => {
      const normalized = normalizeSerial(serial);
      if (!normalized) return;
      map.set(normalized, { productId, productName });
    });
  });
  return map;
}

/** Serial numbers present before edit but not in the saved payload. */
export function diffRemovedPurchaseSerials(
  beforeProducts: PurchaseLineProduct[],
  afterProducts: PurchaseLineProduct[],
): RemovedPurchaseSerial[] {
  const before = collectSerialEntries(beforeProducts);
  const after = collectSerialEntries(afterProducts);
  const removed: RemovedPurchaseSerial[] = [];

  before.forEach((meta, serial) => {
    if (after.has(serial)) return;
    removed.push({
      serial,
      productId: meta.productId,
      productName: meta.productName,
    });
  });

  return removed;
}

/**
 * Only true typo renames: same row, same serial count, exactly one removed and one added.
 * Avoids treating "4 serials → keep 2" as renames by position index.
 */
export function collectPurchaseSerialTypoRenames(
  beforeProducts: PurchaseLineProduct[],
  afterProducts: PurchaseLineProduct[],
): SerialTypoRename[] {
  const changes: SerialTypoRename[] = [];
  const seen = new Set<string>();
  const rowCount = Math.min(beforeProducts.length, afterProducts.length);

  for (let rowIdx = 0; rowIdx < rowCount; rowIdx += 1) {
    const beforeLine = beforeProducts[rowIdx];
    const afterLine = afterProducts[rowIdx];
    if (!beforeLine || !afterLine) continue;
    if (String(beforeLine.productId || '') !== String(afterLine.productId || '')) continue;

    const beforeSerials = serialsFromLineProduct(beforeLine).map(normalizeSerial).filter(Boolean);
    const afterSerials = serialsFromLineProduct(afterLine).map(normalizeSerial).filter(Boolean);
    if (beforeSerials.length === 0 || beforeSerials.length !== afterSerials.length) continue;

    const afterSet = new Set(afterSerials);
    const removed = beforeSerials.filter((sn) => !afterSet.has(sn));
    const beforeSet = new Set(beforeSerials);
    const added = afterSerials.filter((sn) => !beforeSet.has(sn));

    if (removed.length !== 1 || added.length !== 1) continue;

    const key = `${removed[0]}=>${added[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    changes.push({ oldSerial: removed[0], newSerial: added[0] });
  }

  return changes;
}

function stripRemovedSerialsFromProductLine(
  prod: Record<string, unknown>,
  removedSet: Set<string>,
): Record<string, unknown> | null {
  const priorSerials = serialsFromLineProduct(prod as Parameters<typeof serialsFromLineProduct>[0]);
  if (priorSerials.length === 0) return prod;

  const kept = priorSerials.filter((sn) => !removedSet.has(normalizeSerial(sn)));
  if (kept.length === 0) return null;

  const isPair =
    String(prod.type || '') === 'Hearing Aid' && String(prod.quantityType || '') === 'pair';
  const quantity = isPair ? Math.max(1, kept.length / 2) : kept.length;

  const { serialPairs: _pairs, serialNumber: _one, ...rest } = prod;
  return {
    ...rest,
    serialNumbers: kept,
    quantity,
  };
}

/**
 * Deletes removed serial numbers from material-inward lines (does not rename or reassign).
 */
export async function purgeRemovedSerialsFromMaterialInward(
  serialsToRemove: string[],
): Promise<number> {
  const removedSet = new Set(serialsToRemove.map(normalizeSerial).filter(Boolean));
  if (removedSet.size === 0) return 0;

  const snap = await getDocs(collection(db, 'materialInward'));
  let updatedDocs = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const products = Array.isArray(data.products) ? (data.products as Record<string, unknown>[]) : [];
    if (products.length === 0) continue;

    let changed = false;
    const nextProducts = products
      .map((line) => {
        const next = stripRemovedSerialsFromProductLine(line, removedSet);
        if (next === null) {
          changed = true;
          return null;
        }
        const beforeSerials = serialsFromLineProduct(line as Parameters<typeof serialsFromLineProduct>[0]);
        const afterSerials = serialsFromLineProduct(next as Parameters<typeof serialsFromLineProduct>[0]);
        if (beforeSerials.length !== afterSerials.length) changed = true;
        return next;
      })
      .filter((line): line is Record<string, unknown> => line !== null);

    if (!changed) continue;

    await updateDoc(doc(db, 'materialInward', docSnap.id), {
      products: stripSerialPairsFromProductLines(nextProducts),
      updatedAt: serverTimestamp(),
    });
    updatedDocs += 1;
  }

  return updatedDocs;
}

export type RemovedSerialUsageWarning = {
  serial: string;
  reason: string;
};

function noteUsage(
  usages: Map<string, RemovedSerialUsageWarning>,
  serial: string,
  reason: string,
): void {
  const normalized = normalizeSerial(serial);
  if (!normalized) return;
  const existing = usages.get(normalized);
  if (existing) {
    if (!existing.reason.includes(reason)) {
      existing.reason = `${existing.reason}; ${reason}`;
    }
    return;
  }
  usages.set(normalized, { serial: normalized, reason });
}

function scanProductsArray(
  products: unknown,
  usages: Map<string, RemovedSerialUsageWarning>,
  removedSet: Set<string>,
  reason: string,
): void {
  if (!Array.isArray(products)) return;
  products.forEach((prod) => {
    serialsFromLineProduct(prod as Parameters<typeof serialsFromLineProduct>[0]).forEach((serial) => {
      if (removedSet.has(normalizeSerial(serial))) {
        noteUsage(usages, serial, reason);
      }
    });
    const single = (prod as { serialNumber?: unknown })?.serialNumber;
    if (single != null) {
      const tokens = String(single)
        .split(/[,;\n]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      tokens.forEach((serial) => {
        if (removedSet.has(normalizeSerial(serial))) {
          noteUsage(usages, serial, reason);
        }
      });
    }
  });
}

function scanEnquiryVisits(
  data: Record<string, unknown>,
  usages: Map<string, RemovedSerialUsageWarning>,
  removedSet: Set<string>,
): void {
  const visits = Array.isArray(data.visits) ? data.visits : [];
  visits.forEach((visit) => {
    if (!visit || typeof visit !== 'object') return;
    const v = visit as Record<string, unknown>;
    const products = Array.isArray(v.products) ? v.products : [];
    products.forEach((prod) => {
      if (!prod || typeof prod !== 'object') return;
      const p = prod as Record<string, unknown>;
      const serial = normalizeSerial(String(p.serialNumber || p.serialNo || ''));
      if (serial && removedSet.has(serial)) {
        noteUsage(usages, serial, 'sold on an enquiry visit');
      }
    });
  });
}

/**
 * Finds other records that still reference serials being removed from a purchase.
 * Used to show a confirmation before saving (does not block save).
 */
export async function findRemovedPurchaseSerialWarnings(
  removed: RemovedPurchaseSerial[],
): Promise<RemovedSerialUsageWarning[]> {
  if (removed.length === 0) return [];

  const removedSet = new Set(removed.map((r) => normalizeSerial(r.serial)).filter(Boolean));
  const usages = new Map<string, RemovedSerialUsageWarning>();

  const [
    materialInSnap,
    salesSnap,
    materialsOutSnap,
    distributionsSnap,
    stockTransferSnap,
    enquiriesSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'materialInward')),
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'materialsOut')),
    getDocs(collection(db, 'distributions')),
    getDocs(collection(db, 'stockTransfers')),
    getDocs(collection(db, 'enquiries')),
  ]);

  materialInSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    scanProductsArray(
      (data as { products?: unknown }).products,
      usages,
      removedSet,
      'on a material-in record',
    );
  });

  salesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    if (data.cancelled === true || data.cancelled === 'true') return;
    scanProductsArray(data.products ?? data.items, usages, removedSet, 'sold on a sales invoice');
  });

  materialsOutSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const status = String(data.status || 'dispatched');
    if (status === 'returned') return;
    scanProductsArray(data.products, usages, removedSet, 'on a material-out / dispatch record');
  });

  distributionsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    scanProductsArray((data as { products?: unknown }).products, usages, removedSet, 'on a distribution');
  });

  stockTransferSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    scanProductsArray((data as { products?: unknown }).products, usages, removedSet, 'on a stock transfer');
  });

  enquiriesSnap.docs.forEach((docSnap) => {
    scanEnquiryVisits(docSnap.data() as Record<string, unknown>, usages, removedSet);
  });

  return Array.from(usages.values()).sort((a, b) => a.serial.localeCompare(b.serial));
}

export function buildRemovedSerialConfirmationMessage(warnings: RemovedSerialUsageWarning[]): string {
  if (warnings.length === 0) return '';

  const lines = warnings.map((w) => `• ${w.serial}: ${w.reason}`);
  const list = lines.slice(0, 8).join('\n');
  const more = warnings.length > 8 ? `\n…and ${warnings.length - 8} more.` : '';

  return [
    'The following serial number(s) you are removing from this purchase also appear elsewhere:',
    '',
    list + more,
    '',
    'Removing them will update this purchase and delete those serials from material-in records.',
    'Material-out, sales, and other records above will not be changed automatically.',
    '',
    'Do you want to continue?',
  ].join('\n');
}

export async function confirmRemovedPurchaseSerials(
  removed: RemovedPurchaseSerial[],
): Promise<boolean> {
  const warnings = await findRemovedPurchaseSerialWarnings(removed);
  if (warnings.length === 0) return true;
  const message = buildRemovedSerialConfirmationMessage(warnings);
  return window.confirm(message);
}
