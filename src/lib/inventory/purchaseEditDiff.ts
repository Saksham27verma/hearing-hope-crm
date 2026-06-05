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

type SerialUsage = {
  serial: string;
  reason: string;
};

function noteUsage(
  usages: Map<string, SerialUsage>,
  serial: string,
  reason: string,
): void {
  const normalized = normalizeSerial(serial);
  if (!normalized || usages.has(normalized)) return;
  usages.set(normalized, { serial: normalized, reason });
}

function scanProductsArray(
  products: unknown,
  usages: Map<string, SerialUsage>,
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
  usages: Map<string, SerialUsage>,
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
 * Ensures removed purchase serials are not still sold, dispatched, or transferred elsewhere.
 * Returns a user-facing error message, or null if safe to save.
 */
export async function validateRemovedPurchaseSerials(
  removed: RemovedPurchaseSerial[],
): Promise<string | null> {
  if (removed.length === 0) return null;

  const removedSet = new Set(removed.map((r) => normalizeSerial(r.serial)).filter(Boolean));
  const usages = new Map<string, SerialUsage>();

  const [
    salesSnap,
    materialsOutSnap,
    distributionsSnap,
    stockTransferSnap,
    enquiriesSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'sales')),
    getDocs(collection(db, 'materialsOut')),
    getDocs(collection(db, 'distributions')),
    getDocs(collection(db, 'stockTransfers')),
    getDocs(collection(db, 'enquiries')),
  ]);

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

  if (usages.size === 0) return null;

  const first = usages.values().next().value as SerialUsage;
  const more = usages.size - 1;
  const suffix = more > 0 ? ` (+${more} more)` : '';
  return `Cannot remove serial ${first.serial} from this purchase — it is ${first.reason}${suffix}.`;
}
