import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';

export interface SerialIndexEntry {
  products: string[];
}

export type SerialIndex = Map<string, SerialIndexEntry>;

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

    const rawArray: any[] = Array.isArray(prod?.serialNumbers)
      ? prod.serialNumbers
      : prod?.serialNumber
        ? [prod.serialNumber]
        : [];

    rawArray
      .map((sn) => String(sn ?? '').trim())
      .filter((sn) => !!sn)
      .forEach((sn) => {
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


