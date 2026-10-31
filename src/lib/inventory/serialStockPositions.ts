import { expandSalesReturnLinesFromVisit } from '@/utils/salesReturnFromVisit';
import { buildExchangeInventoryRestores } from '@/lib/enquiries/exchangeInventoryRestore';

/**
 * Where every serial-tracked unit currently is, and whether it can move.
 *
 * These are the same rules the Inventory module uses to build its serial rows
 * (src/app/(protected)/inventory/page.tsx → fetchInventory). Stock Transfer uses
 * this so it offers exactly the serials Inventory shows as "In Stock" at a center.
 * If you change how Inventory decides location / sold / reserved, change it here too.
 */

export type SerialStockStatus = 'In Stock' | 'Reserved' | 'Staff assign' | 'Sold';

export interface SerialStockPosition {
  productId: string;
  /** Serial exactly as first recorded on the inbound document. */
  serialNumber: string;
  name: string;
  type: string;
  /** Manufacturer company from the product master. */
  company: string;
  /** Owning business company (document company, else product company — same fallback as Inventory). */
  businessCompany: string;
  location: string;
  status: SerialStockStatus;
}

type Doc = Record<string, any>;

export interface SerialStockSources {
  headOfficeId: string;
  /** Maps a stored location (center id or legacy center name) to a center id. */
  normalizeLocation?: (raw: string) => string;
  productById: Map<string, Doc>;
  materialInward: Doc[];
  purchases: Doc[];
  materialsOut: Doc[];
  sales: Doc[];
  enquiries: Doc[];
  /** Must be ordered by createdAt ascending. */
  stockTransfers: Doc[];
  staffTrialCustody: Doc[];
  purchaseReturns: Doc[];
}

export const normalizeSerialNumber = (serialNumber: unknown): string =>
  String(serialNumber || '')
    .trim()
    .replace(/^['"`\s]+|['"`\s]+$/g, '')
    .toUpperCase();

export const makeSerialKey = (productId: unknown, serialNumber: unknown): string =>
  `${String(productId || '').trim()}|${normalizeSerialNumber(serialNumber)}`;

/** Event time for the sale/return timeline (Inventory's getTimestampValue). */
const eventTs = (timestamp: any): number => {
  if (!timestamp) return 0;
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (timestamp instanceof Date) return timestamp.getTime();
  if (timestamp.toDate) return timestamp.toDate().getTime();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  return 0;
};

/** Document time for ordering inbound docs (Inventory's docTs). */
const docTs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val?.toMillis === 'function') return val.toMillis();
  if (typeof val?.seconds === 'number') return val.seconds * 1000;
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

/** Array entries are taken as-is; strings are split on , ; | or newlines. Values are normalized. */
const splitSerialCandidates = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((v) => normalizeSerialNumber(v)).filter(Boolean);
  }
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(/[,\n;|]+/g)
    .map((v) => normalizeSerialNumber(v))
    .filter(Boolean);
};

/** Serials on an inbound / transfer product line, as stored (not normalized). */
const lineSerials = (prod: Doc): string[] => {
  const raw: unknown[] = Array.isArray(prod?.serialNumbers)
    ? prod.serialNumbers
    : prod?.serialNumber
      ? [prod.serialNumber]
      : [];
  return raw.map((s) => String(s ?? '').trim()).filter(Boolean);
};

const serialCandidatesFromProduct = (prod: Doc): string[] => {
  const all: string[] = [];
  if (Array.isArray(prod?.serialNumbers) && prod.serialNumbers.length > 0) {
    all.push(...splitSerialCandidates(prod.serialNumbers));
  }
  [
    prod?.serialNumber,
    prod?.trialSerialNumber,
    prod?.serialNo,
    prod?.serial_no,
    prod?.deviceSerial,
    prod?.hearingAidSerial,
  ].forEach((v) => all.push(...splitSerialCandidates(v)));
  if (Array.isArray(prod?.previousSales)) {
    prod.previousSales.forEach((line: Doc) => all.push(...splitSerialCandidates(line?.serialNumber)));
  }
  return Array.from(new Set(all.filter(Boolean)));
};

/** Top-level fields whose name contains "serial". */
const serialLikeTopLevelValues = (input: unknown): string[] => {
  if (!input || typeof input !== 'object') return [];
  const out: string[] = [];
  Object.entries(input as Record<string, unknown>).forEach(([k, v]) => {
    if (k.toLowerCase().includes('serial')) out.push(...splitSerialCandidates(v));
  });
  return Array.from(new Set(out.filter(Boolean)));
};

const serialCandidatesFromVisit = (visit: Doc): string[] => {
  const all: string[] = [];
  all.push(...splitSerialCandidates(visit?.trialSerialNumber));
  all.push(...splitSerialCandidates(visit?.serialNumber));
  all.push(...splitSerialCandidates(visit?.hearingAidDetails?.trialSerialNumber));
  all.push(...splitSerialCandidates(visit?.hearingAidDetails?.serialNumber));
  if (Array.isArray(visit?.hearingAidDetails?.products)) {
    visit.hearingAidDetails.products.forEach((p: Doc) => all.push(...serialCandidatesFromProduct(p)));
  }
  if (Array.isArray(visit?.previousSales)) {
    visit.previousSales.forEach((line: Doc) => all.push(...splitSerialCandidates(line?.serialNumber)));
  }
  if (Array.isArray(visit?.hearingAidDetails?.previousSales)) {
    visit.hearingAidDetails.previousSales.forEach((line: Doc) =>
      all.push(...splitSerialCandidates(line?.serialNumber)),
    );
  }
  return Array.from(new Set(all.filter(Boolean)));
};

/** Visit that is an actual sale (invoice-level). */
const isSaleVisit = (visit: Doc): boolean =>
  !!(
    visit?.hearingAidSale ||
    visit?.purchaseFromTrial ||
    visit?.hearingAidStatus === 'sold' ||
    visit?.hearingAidDetails?.hearingAidStatus === 'sold'
  );

/** Broader "sale happened" signal used by the Product Journey timeline. */
const isJourneySaleVisit = (visit: Doc): boolean => {
  const products: unknown[] = Array.isArray(visit?.products) ? visit.products : [];
  const medicalServices: unknown[] = Array.isArray(visit?.medicalServices) ? visit.medicalServices : [];
  return !!(
    visit?.hearingAidSale ||
    medicalServices.includes('hearing_aid_sale') ||
    visit?.journeyStage === 'sale' ||
    visit?.hearingAidStatus === 'sold' ||
    (products.length > 0 && ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
  );
};

const saleVisitProducts = (visit: Doc): Doc[] =>
  Array.isArray(visit?.products)
    ? visit.products
    : Array.isArray(visit?.hearingAidDetails?.products)
      ? visit.hearingAidDetails.products
      : [];

/**
 * Normalized serials that are currently sold. A serial is sold when a sale record names it
 * (minus serials returned on the same enquiry), or when its latest sale/return event is a sale.
 * Cancelled sales are ignored.
 */
function computeSoldSerials(src: SerialStockSources): Set<string> {
  // Journey: per serial, the latest of sale vs. return events wins.
  const journey = new Map<string, { sold: boolean; ts: number }[]>();
  const addEvent = (serial: unknown, sold: boolean, date: unknown) => {
    const n = normalizeSerialNumber(serial);
    if (!n) return;
    const events = journey.get(n) || [];
    events.push({ sold, ts: eventTs(date) });
    journey.set(n, events);
  };

  src.materialInward.forEach((data) => {
    const supplierName = String(data.supplier?.name || '');
    if (supplierName.includes('Stock Transfer from')) return;
    if (!supplierName.toLowerCase().includes('sales return')) return;
    (data.products || []).forEach((prod: Doc) => {
      lineSerials(prod).forEach((sn) => addEvent(sn, false, data.receivedDate || data.createdAt));
    });
  });

  src.sales.forEach((data) => {
    if (data.cancelled === true) return;
    (data.products || []).forEach((prod: Doc) => {
      lineSerials(prod).forEach((sn) => addEvent(sn, true, data.saleDate || data.createdAt));
    });
  });

  src.enquiries.forEach((data) => {
    const visits: Doc[] = Array.isArray(data.visits) ? data.visits : [];
    visits.forEach((visit) => {
      const visitDate = visit.visitDate || data.updatedAt || data.createdAt;
      if (isJourneySaleVisit(visit)) {
        const products: Doc[] = Array.isArray(visit.products) ? visit.products : [];
        products.forEach((prod) => {
          Array.from(new Set([prod.serialNumber, prod.trialSerialNumber].filter(Boolean))).forEach((sn) =>
            addEvent(sn, true, prod.saleDate || visitDate),
          );
        });
      }
      if (visit.salesReturn) {
        expandSalesReturnLinesFromVisit(visit).forEach((line) =>
          addEvent(line.serialNumber, false, visit.returnDate || visitDate),
        );
      }
    });
    buildExchangeInventoryRestores(visits, String(data.center || '')).forEach((row) =>
      addEvent(row.serialNumber, false, data.updatedAt || data.createdAt),
    );
  });

  const soldFromJourney = new Set<string>();
  journey.forEach((events, serial) => {
    const sorted = [...events].sort((a, b) => a.ts - b.ts);
    if (sorted[sorted.length - 1]?.sold) soldFromJourney.add(serial);
  });

  // Sale records (keyed by product + serial).
  const soldKeys = new Set<string>();
  src.sales.forEach((data) => {
    if (data.cancelled === true) return;
    const saleProducts: Doc[] = Array.isArray(data.products)
      ? data.products
      : Array.isArray(data.items)
        ? data.items
        : [];
    saleProducts.forEach((prod) => {
      const productId = prod.productId || prod.id || '';
      serialCandidatesFromProduct(prod).forEach((sn) => soldKeys.add(makeSerialKey(productId, sn)));
    });
    const docLevel = splitSerialCandidates(
      data.serialNumber || data.trialSerialNumber || data.deviceSerial || data.hearingAidSerial,
    );
    new Set([...docLevel, ...serialLikeTopLevelValues(data)]).forEach((sn) =>
      soldKeys.add(makeSerialKey(data.productId || '', sn)),
    );
  });

  src.enquiries.forEach((data) => {
    const visits: Doc[] = Array.isArray(data.visits) ? data.visits : [];
    visits.forEach((visit) => {
      if (!isSaleVisit(visit)) return;
      saleVisitProducts(visit).forEach((prod) => {
        const productId = prod.productId || prod.id || prod.hearingAidProductId || '';
        serialCandidatesFromProduct(prod).forEach((sn) => soldKeys.add(makeSerialKey(productId, sn)));
      });
      const visitProductId = visit?.hearingAidProductId || visit?.hearingAidDetails?.hearingAidProductId || '';
      new Set([...serialCandidatesFromVisit(visit), ...serialLikeTopLevelValues(visit)]).forEach((sn) =>
        soldKeys.add(makeSerialKey(visitProductId, sn)),
      );
    });
  });

  // A sales return on the enquiry puts the device back in stock.
  src.enquiries.forEach((data) => {
    const visits: Doc[] = Array.isArray(data.visits) ? data.visits : [];
    visits.forEach((rv) => {
      if (!rv?.salesReturn) return;
      expandSalesReturnLinesFromVisit(rv).forEach((line) => {
        splitSerialCandidates(line.serialNumber).forEach((normRet) => {
          visits.forEach((sv) => {
            if (!isSaleVisit(sv)) return;
            saleVisitProducts(sv).forEach((prod) => {
              const productId = prod.productId || prod.id || prod.hearingAidProductId || '';
              serialCandidatesFromProduct(prod).forEach((cand) => {
                if (cand === normRet) soldKeys.delete(makeSerialKey(productId, cand));
              });
            });
          });
        });
      });
    });
  });

  const sold = new Set<string>(soldFromJourney);
  soldKeys.forEach((k) => sold.add(k.slice(k.indexOf('|') + 1)));
  return sold;
}

/**
 * Current position of every serial-tracked unit, keyed by `makeSerialKey(productId, serial)`.
 * Purchase-returned and dispatched (non-transfer material out) serials are omitted.
 */
export function computeSerialStockPositions(src: SerialStockSources): Map<string, SerialStockPosition> {
  const toLocation = (raw: unknown): string => {
    const loc = String(raw || '').trim() || src.headOfficeId;
    return src.normalizeLocation ? src.normalizeLocation(loc) : loc;
  };

  const purchaseReturned = new Set<string>();
  src.purchaseReturns.forEach((data) => {
    (data.products || []).forEach((prod: Doc) => {
      const productId = String(prod.productId || prod.id || '');
      if (!productId || !Array.isArray(prod.serialNumbers)) return;
      prod.serialNumbers.forEach((sn: unknown) => {
        if (sn) purchaseReturned.add(makeSerialKey(productId, sn));
      });
    });
  });

  // Stock-transfer material-outs are internal moves (applied below), never stock-outs.
  const pendingOut = new Set<string>();
  const dispatchedOut = new Set<string>();
  src.materialsOut.forEach((data) => {
    const notes = String(data.notes || '');
    const reason = String(data.reason || '');
    if (notes.includes('Stock Transfer') || reason.includes('Stock Transfer')) return;
    const status = String(data.status || '') || 'dispatched';
    if (status === 'returned') return;
    (data.products || []).forEach((prod: Doc) => {
      splitSerialCandidates(Array.isArray(prod.serialNumbers) ? prod.serialNumbers : prod.serialNumber).forEach(
        (sn) => {
          const key = makeSerialKey(prod.productId || prod.id || '', sn);
          if (status === 'pending') pendingOut.add(key);
          else dispatchedOut.add(key);
        },
      );
    });
  });

  const staffCustody = new Set<string>();
  src.staffTrialCustody.forEach((data) => {
    const productId = String(data.productId || '').trim();
    (Array.isArray(data.serialNumbers) ? data.serialNumbers : []).forEach((sn: unknown) => {
      if (String(sn || '').trim()) staffCustody.add(makeSerialKey(productId, sn));
    });
  });

  const sold = computeSoldSerials(src);

  const statusFor = (key: string, serial: string): SerialStockStatus => {
    if (sold.has(normalizeSerialNumber(serial))) return 'Sold';
    if (staffCustody.has(key)) return 'Staff assign';
    if (pendingOut.has(key)) return 'Reserved';
    return 'In Stock';
  };

  const positions = new Map<string, SerialStockPosition>();

  const addInbound = (data: Doc, prod: Doc, sn: string, allowMove: boolean) => {
    const productId = String(prod.productId || prod.id || '').trim();
    if (!productId) return;
    const key = makeSerialKey(productId, sn);
    if (purchaseReturned.has(key)) return;
    const productRef = src.productById.get(productId) || {};
    const businessCompany = String(data.company || productRef.company || '');
    const location = toLocation(data.location);

    const existing = positions.get(key);
    if (existing) {
      // Only a "Stock Transfer from …" inward moves a serial that is already placed.
      if (allowMove) positions.set(key, { ...existing, location, businessCompany });
      return;
    }

    const status = statusFor(key, sn);
    if (dispatchedOut.has(key) && status !== 'Sold') return;
    positions.set(key, {
      productId,
      serialNumber: sn,
      name: String(productRef.name || prod.name || 'Product'),
      type: String(prod.type || productRef.type || ''),
      company: String(productRef.company || ''),
      businessCompany,
      location,
      status,
    });
  };

  const byDate = (field: string) => (a: Doc, b: Doc) =>
    docTs(a[field]) - docTs(b[field]) || docTs(a.createdAt) - docTs(b.createdAt);

  [...src.materialInward].sort(byDate('receivedDate')).forEach((data) => {
    const isTransferIn = String(data.supplier?.name || '').includes('Stock Transfer from');
    (data.products || []).forEach((prod: Doc) => {
      lineSerials(prod).forEach((sn) => addInbound(data, prod, sn, isTransferIn));
    });
  });

  [...src.purchases].sort(byDate('purchaseDate')).forEach((data) => {
    (data.products || []).forEach((prod: Doc) => {
      lineSerials(prod).forEach((sn) => addInbound(data, prod, sn, false));
    });
  });

  // stockTransfers are the authoritative record of moves, even if the synthetic
  // "Stock Transfer from …" inward docs are missing or share a tied receivedDate.
  src.stockTransfers.forEach((tr) => {
    const toBranchRaw = String(tr.toBranch || '').trim();
    if (!toBranchRaw) return;
    const toBranch = toLocation(toBranchRaw);
    const transferCompany = String(
      tr.transferType === 'intercompany' ? tr.toCompany || tr.company || '' : tr.company || tr.toCompany || '',
    );
    (tr.products || []).forEach((p: Doc) => {
      const productId = String(p.productId || p.id || '').trim();
      if (!productId) return;
      lineSerials(p).forEach((sn) => {
        const key = makeSerialKey(productId, sn);
        const existing = positions.get(key);
        if (existing) {
          if (existing.status === 'Sold') return;
          positions.set(key, {
            ...existing,
            location: toBranch,
            businessCompany: transferCompany || existing.businessCompany,
          });
          return;
        }
        // No inbound record under this product id (legacy data): place it from the transfer
        // unless it is known to be gone.
        if (purchaseReturned.has(key) || dispatchedOut.has(key)) return;
        const productRef = src.productById.get(productId) || {};
        positions.set(key, {
          productId,
          serialNumber: sn,
          name: String(productRef.name || p.name || 'Product'),
          type: String(productRef.type || ''),
          company: String(productRef.company || ''),
          businessCompany: transferCompany || String(productRef.company || ''),
          location: toBranch,
          status: statusFor(key, sn),
        });
      });
    });
  });

  return positions;
}
