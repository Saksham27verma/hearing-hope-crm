/**
 * Shared inventory row shape from SimplifiedEnquiryForm fetchAvailableInventory.
 */
export type EnquiryInventoryRow = {
  id: string;
  productId: string;
  productName: string;
  name?: string;
  type?: string;
  company?: string;
  serialNumber?: string;
  /** Physical serials when this row is a bonded pair (inventory / invoicing use "S1, S2"). */
  serialNumbers?: string[];
  /** True when this row represents two devices sold together (pair product). */
  isPairRow?: boolean;
  pairSource?: 'serialPairs' | 'manualOverride' | 'legacyFallback' | 'unpaired';
  quantityType?: 'piece' | 'pair';
  isSerialTracked?: boolean;
  quantity?: number;
  mrp: number;
  dealerPrice?: number;
  gstApplicable: boolean;
  gstPercentage: number;
  gstType?: string;
  status?: string;
  /** Display label (center name). */
  location?: string;
  /** Firestore `centers` doc id — used for grouping when names differ. */
  locationId?: string;
  hsnCode?: string;
  /** From product master — used to classify serial stock (e.g. chargers). */
  productHasSerialNumber?: boolean;
};

export type GstResolveInput = {
  gstApplicable?: boolean;
  gstPercentage?: number | null;
};

/** GST rate from product master: exempt → 0; else use stored % or default 18. Preserves 0% rated. */
export function resolveGstFromProductMaster(p: GstResolveInput): {
  gstApplicable: boolean;
  gstPercent: number;
} {
  const applicable = !!p.gstApplicable;
  if (!applicable) return { gstApplicable: false, gstPercent: 0 };
  const raw = p.gstPercentage;
  if (raw != null && Number.isFinite(Number(raw))) {
    return { gstApplicable: true, gstPercent: Number(raw) };
  }
  return { gstApplicable: true, gstPercent: 18 };
}

/** When building inventory rows from Firestore product doc fields. */
export function gstFieldsForInventoryRowFromProd(prod: {
  gstApplicable?: boolean;
  gstPercentage?: number | null;
}): { gstApplicable: boolean; gstPercentage: number } {
  const { gstApplicable, gstPercent } = resolveGstFromProductMaster(prod);
  return {
    gstApplicable,
    gstPercentage: gstApplicable ? gstPercent : 0,
  };
}

function normType(type: string | undefined): string {
  return String(type || '').trim();
}

function typeLower(type: string | undefined): string {
  return normType(type).toLowerCase();
}

/** Accessory / Battery / Other (case-insensitive). */
function isConsumableAccessoryType(type: string | undefined): boolean {
  const tl = typeLower(type);
  return tl === 'accessory' || tl === 'battery' || tl === 'other';
}

function isHearingAidType(type: string | undefined): boolean {
  const tl = typeLower(type);
  return tl === 'hearing aid' || tl === 'hearingaid';
}

/** Charger in catalog — tolerate spacing/casing and common variants. */
function isChargerProductType(type: string | undefined): boolean {
  const tl = typeLower(type);
  if (!tl) return false;
  if (tl === 'charger' || tl === 'chargers') return true;
  if (tl.includes('charger')) return true;
  return false;
}

function productNameSuggestsCharger(name: string | undefined): boolean {
  const s = String(name || '');
  return (
    /\bchargers?\b|charg(?:ing)?\s+case|charge\s*&\s*go|cn?g\b|multi[-\s]*charg|charg[-\s]*multi|pure\s*charg|dry\s*&\s*clean|styletto\s*charg/i.test(
      s
    )
  );
}

/**
 * Serial-number stock row for HA sale / trial: devices, not consumable accessories.
 * Charger rows are often master-typed "Accessory" without hasSerialNumber set — use name + serial row itself.
 */
function serialRowIsDeviceInventory(item: {
  type?: string;
  productName?: string;
  productHasSerialNumber?: boolean;
}): boolean {
  if (isHearingAidType(item.type) || isChargerProductType(item.type)) return true;
  if (productNameSuggestsCharger(item.productName)) return true;
  if (!isConsumableAccessoryType(item.type)) return true;
  return false;
}

/** Hearing aid sale + home-trial serial picker. */
export function isHearingDeviceInventoryItem(item: {
  type?: string;
  isSerialTracked?: boolean;
  productName?: string;
  productHasSerialNumber?: boolean;
}): boolean {
  if (item.isSerialTracked) return serialRowIsDeviceInventory(item);
  if (isHearingAidType(item.type)) return true;
  // Bulk / qty rows: include chargers (multi-unit stock) not only RIC/BTE types
  if (isChargerProductType(item.type)) return true;
  if (productNameSuggestsCharger(item.productName)) return true;
  return false;
}

/** Accessory service stock: consumables + bulk (non-serial) chargers — excludes device serial rows. */
export function isAccessoryInventoryItem(item: {
  type?: string;
  isSerialTracked?: boolean;
  productName?: string;
  productHasSerialNumber?: boolean;
}): boolean {
  if (item.isSerialTracked) {
    if (serialRowIsDeviceInventory(item)) return false;
    return isConsumableAccessoryType(item.type);
  }
  if (isConsumableAccessoryType(item.type)) return true;
  if (isChargerProductType(item.type)) return true;
  return false;
}

export function formatGstChipPercent(item: GstResolveInput): string {
  const { gstApplicable, gstPercent } = resolveGstFromProductMaster(item);
  if (!gstApplicable) return 'GST exempt';
  return `GST: ${gstPercent}%`;
}
