import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { serialsFromLineProduct } from '@/lib/enquiryInventoryAvailability';

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
    'Removing them from this purchase will take them out of purchase-based inventory.',
    'Other records listed above will not be changed automatically.',
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
