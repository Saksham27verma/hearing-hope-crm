import { adminDb } from '@/server/firebaseAdmin';
import { effectiveGstPercentFromCatalogData } from '@/server/staffEnquiryCatalogHelpers';

export type StaffInventoryRow = {
  lineId: string;
  productId: string;
  name: string;
  company: string;
  type: string;
  mrp: number;
  dealerPrice: number;
  serialNumber: string;
  hasSerialNumber: boolean;
  /** From product master: false when GST exempt. */
  gstApplicable: boolean;
  /** Effective rate (0 if exempt, else e.g. 18). */
  gstPercent: number;
};

/**
 * Same stock math as Hope AI / inventory module — flattened rows for staff sale picker (one row per serial).
 */
export async function listAvailableHearingAidSerialRows(): Promise<StaffInventoryRow[]> {
  const db = adminDb();
  const [
    productsSnap,
    materialInSnap,
    purchasesSnap,
    materialsOutSnap,
    salesSnap,
    enquiriesSnap,
    stockTransfersSnap,
  ] = await Promise.all([
    db.collection('products').get(),
    db.collection('materialInward').get(),
    db.collection('purchases').get(),
    db.collection('materialsOut').get(),
    db.collection('sales').get(),
    db.collection('enquiries').get(),
    db.collection('stockTransfers').orderBy('createdAt', 'asc').get(),
  ]);

  const productById = new Map<string, Record<string, unknown>>();
  productsSnap.docs.forEach((d) => productById.set(d.id, { id: d.id, ...(d.data() as Record<string, unknown>) }));

  const serialsInByProduct = new Map<string, Set<string>>();
  const qtyInByProduct = new Map<string, number>();
  const stockTransferInSerials = new Set<string>();

  // Authoritative source: any serial that appears in a stockTransfer doc
  // is considered an internal move, so its corresponding materialOut should
  // not deplete availability. This protects against missing/out-of-order
  // synthetic materialInward "Stock Transfer from X" docs.
  stockTransfersSnap.docs.forEach((trDoc) => {
    const tr = trDoc.data() as Record<string, unknown>;
    const products = (tr.products as unknown[]) || [];
    products.forEach((prod: unknown) => {
      const p = prod as Record<string, unknown>;
      const productId = String(p.productId || p.id || '');
      if (!productId) return;
      const serials: string[] = Array.isArray(p.serialNumbers)
        ? (p.serialNumbers as string[])
        : p.serialNumber
          ? [String(p.serialNumber)]
          : [];
      serials.forEach((sn) => {
        if (sn) stockTransferInSerials.add(`${productId}|${sn}`);
      });
    });
  });

  materialInSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const supplierName = String((data.supplier as { name?: string } | undefined)?.name || '');
    const isStockTransfer = supplierName.includes('Stock Transfer from');
    const products = (data.products as unknown[]) || [];

    products.forEach((prod: unknown) => {
      const p = prod as Record<string, unknown>;
      const productId = String(p.productId || p.id || '');
      if (!productId) return;
      const serialArray: string[] = Array.isArray(p.serialNumbers)
        ? (p.serialNumbers as string[])
        : p.serialNumber
          ? [String(p.serialNumber)]
          : [];

      if (isStockTransfer) {
        serialArray.forEach((sn) => stockTransferInSerials.add(`${productId}|${sn}`));
        return;
      }

      if (serialArray.length > 0) {
        if (!serialsInByProduct.has(productId)) serialsInByProduct.set(productId, new Set());
        serialArray.forEach((sn) => {
          if (sn) serialsInByProduct.get(productId)!.add(sn);
        });
      } else {
        const q = Number(p.quantity ?? 0);
        qtyInByProduct.set(productId, (qtyInByProduct.get(productId) || 0) + (Number.isNaN(q) ? 0 : q));
      }
    });
  });

  purchasesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const products = (data.products as unknown[]) || [];
    products.forEach((prod: unknown) => {
      const p = prod as Record<string, unknown>;
      const productId = String(p.productId || p.id || '');
      if (!productId) return;
      const serialArray: string[] = Array.isArray(p.serialNumbers)
        ? (p.serialNumbers as string[])
        : p.serialNumber
          ? [String(p.serialNumber)]
          : [];
      if (serialArray.length > 0) {
        if (!serialsInByProduct.has(productId)) serialsInByProduct.set(productId, new Set());
        serialArray.forEach((sn) => {
          if (sn) serialsInByProduct.get(productId)!.add(sn);
        });
      } else {
        const q = Number(p.quantity ?? 0);
        qtyInByProduct.set(productId, (qtyInByProduct.get(productId) || 0) + (Number.isNaN(q) ? 0 : q));
      }
    });
  });

  const serialsOutByProduct = new Map<string, Set<string>>();
  const qtyOutByProduct = new Map<string, number>();

  materialsOutSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const rawStatus = String((data.status as string) || '');
    const status = rawStatus || 'dispatched';
    if (status === 'returned') return;
    const notes = String(data.notes || '');
    const reason = String(data.reason || '');
    const isStockTransfer = notes.includes('Stock Transfer') || reason.includes('Stock Transfer');
    const products = (data.products as unknown[]) || [];

    products.forEach((prod: unknown) => {
      const p = prod as Record<string, unknown>;
      const productId = String(p.productId || p.id || '');
      if (!productId) return;
      const serialArray: string[] = Array.isArray(p.serialNumbers)
        ? (p.serialNumbers as string[])
        : p.serialNumber
          ? [String(p.serialNumber)]
          : [];

      if (serialArray.length > 0) {
        if (!serialsOutByProduct.has(productId)) serialsOutByProduct.set(productId, new Set());
        const set = serialsOutByProduct.get(productId)!;
        serialArray.forEach((sn) => {
          if (isStockTransfer && stockTransferInSerials.has(`${productId}|${sn}`)) return;
          if (sn) set.add(sn);
        });
      } else {
        if (isStockTransfer) return;
        const q = Number(p.quantity ?? 0);
        qtyOutByProduct.set(productId, (qtyOutByProduct.get(productId) || 0) + (Number.isNaN(q) ? 0 : q));
      }
    });
  });

  const soldSerials = new Map<string, Set<string>>();
  const soldQtyByProduct = new Map<string, number>();

  salesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const products = (data.products as unknown[]) || [];
    products.forEach((prod: unknown) => {
      const p = prod as Record<string, unknown>;
      const productId = String(p.productId || p.id || '');
      if (!productId) return;
      const serialArray: string[] = Array.isArray(p.serialNumbers)
        ? (p.serialNumbers as string[])
        : p.serialNumber
          ? [String(p.serialNumber)]
          : [];
      if (serialArray.length > 0) {
        if (!soldSerials.has(productId)) soldSerials.set(productId, new Set());
        serialArray.forEach((sn) => {
          if (sn) soldSerials.get(productId)!.add(sn);
        });
      } else {
        const q = Number(p.quantity ?? 1);
        soldQtyByProduct.set(productId, (soldQtyByProduct.get(productId) || 0) + (Number.isNaN(q) ? 0 : q));
      }
    });
  });

  enquiriesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const visits = Array.isArray(data.visits) ? (data.visits as Record<string, unknown>[]) : [];
    visits.forEach((visit) => {
      const reserveSale = visit.hearingAidSale && visit.hearingAidProductId;
      const reserveTrialHome =
        visit.hearingAidTrial === true &&
        String(visit.trialHearingAidType || '').toLowerCase() === 'home' &&
        visit.hearingAidProductId;

      if (reserveSale) {
        const productId = String(visit.hearingAidProductId);
        const sn = String(visit.trialSerialNumber || '');
        if (sn) {
          if (!soldSerials.has(productId)) soldSerials.set(productId, new Set());
          soldSerials.get(productId)!.add(sn);
        } else {
          soldQtyByProduct.set(productId, (soldQtyByProduct.get(productId) || 0) + 1);
        }
      }

      if (reserveTrialHome) {
        const productId = String(visit.hearingAidProductId);
        const sn = String(visit.trialSerialNumber || '');
        if (sn) {
          if (!soldSerials.has(productId)) soldSerials.set(productId, new Set());
          soldSerials.get(productId)!.add(sn);
        }
        const pid2 = String(visit.secondHearingAidProductId || '').trim();
        const sn2 = String(visit.secondTrialSerialNumber || '').trim();
        if (pid2 && sn2) {
          if (!soldSerials.has(pid2)) soldSerials.set(pid2, new Set());
          soldSerials.get(pid2)!.add(sn2);
        }
      }
    });
  });

  const rows: StaffInventoryRow[] = [];

  productById.forEach((product, productId) => {
    const isSerial = !!product.hasSerialNumber;
    if (!isSerial) return;

    const inSerials = serialsInByProduct.get(productId) || new Set<string>();
    const outSerials = serialsOutByProduct.get(productId) || new Set<string>();
    const sold = soldSerials.get(productId) || new Set<string>();

    const available = new Set(inSerials);
    outSerials.forEach((sn) => available.delete(sn));
    sold.forEach((sn) => available.delete(sn));

    const name = String(product.name || '');
    const company = String(product.company || '');
    const type = String(product.type || '');
    const mrp = Number(product.mrp || 0);
    const dealerPrice = Number(product.dealerPrice || 0);
    const gstApplicable = product.gstApplicable !== false;
    const gstPercent = effectiveGstPercentFromCatalogData(product as Record<string, unknown>);

    available.forEach((serialNumber) => {
      rows.push({
        lineId: `${productId}|${serialNumber}`,
        productId,
        name,
        company,
        type,
        mrp,
        dealerPrice,
        serialNumber,
        hasSerialNumber: true,
        gstApplicable,
        gstPercent,
      });
    });
  });

  rows.sort((a, b) => a.name.localeCompare(b.name) || a.serialNumber.localeCompare(b.serialNumber));
  return rows;
}
