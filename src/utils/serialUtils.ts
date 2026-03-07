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
export const fetchExistingSerialNumbers = async (): Promise<SerialIndex> => {
  const index: SerialIndex = new Map();

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
      getDocs(collection(db, 'stockTransfer')),
    ]);

    const processSnapshot = (snap: any) => {
      snap.docs.forEach((docSnap: any) => {
        const data: any = docSnap.data();
        extractSerialsFromProducts(data?.products, index);
      });
    };

    processSnapshot(materialInSnap);
    processSnapshot(purchasesSnap);
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


