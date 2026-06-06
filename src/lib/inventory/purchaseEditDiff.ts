import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { serialsFromLineProduct } from '@/lib/enquiryInventoryAvailability';

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

/** Serial numbers on the invoice before edit but not on the form now. */
export function serialsRemovedBetweenPurchaseProducts(
  beforeProducts: PurchaseLineProduct[],
  afterProducts: PurchaseLineProduct[],
): string[] {
  const before = collectSerialEntries(beforeProducts);
  const after = collectSerialEntries(afterProducts);
  return [...before.keys()].filter((serial) => !after.has(serial));
}

export function buildPurgeSerialsConfirmationMessage(serials: string[]): string {
  const list = serials.slice(0, 8).join(', ');
  const more = serials.length > 8 ? ` (+${serials.length - 8} more)` : '';
  return [
    `Serial number(s) ${list}${more} still exist in other inventory records.`,
    '',
    'Remove them from all records (material-in, material-out, stock transfers, sales, etc.)',
    'and add them to this purchase?',
  ].join('\n');
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

/** Deletes serial numbers from all inventory-related collections (admin API). */
export async function purgeRemovedSerialsEverywhere(
  serialsToRemove: string[],
  getIdToken: () => Promise<string | undefined>,
): Promise<void> {
  const serials = serialsToRemove.map(normalizeSerial).filter(Boolean);
  if (serials.length === 0) return;

  const token = await getIdToken();
  if (!token) {
    throw new Error('You must be signed in to remove serial numbers from inventory.');
  }

  const res = await fetch('/api/admin/purge-serials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ serials }),
  });

  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || 'Failed to purge removed serial numbers from inventory.');
  }
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
    'Removing them will update this purchase and delete those serial numbers from all inventory records',
    '(material-in, material-out, stock transfers, sales, distributions, enquiries, etc.).',
    'This frees the serial numbers so they can be added again on another purchase.',
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
