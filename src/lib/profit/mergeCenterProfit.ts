import type { CenterProfitRow } from './types';

export type CenterGrossSlice = {
  rowKey: string;
  centerId: string;
  centerName: string;
  grossRevenue: number;
  /** Pre-GST invoice subtotal — same as Sales Report "selling". */
  sellingSubtotal: number;
  grossProfit: number;
};

export type CenterOpexSlice = {
  salaries: number;
  fixedCosts: number;
  cashOutflows: number;
  managedExpenses: number;
};

/** Staff not mapped to any center, or cash sheets missing centerId. */
export const UNALLOCATED_KEY = '__unallocated__';

/** Merge gross-profit slices with per-center operating expenses into net profit rows. */
export function mergeCenterProfitRows(params: {
  grossByKey: Map<string, CenterGrossSlice>;
  opexByKey: Map<string, CenterOpexSlice>;
  /** Firestore center id → display name (for rows that only have opex). */
  centerNameById: Map<string, string>;
}): CenterProfitRow[] {
  const { grossByKey, opexByKey, centerNameById } = params;
  const keys = new Set<string>([...grossByKey.keys(), ...opexByKeys(opexByKey)]);

  const rows: CenterProfitRow[] = [];
  for (const rowKey of keys) {
    const g = grossByKey.get(rowKey);
    const o = opexByKey.get(rowKey) ?? { salaries: 0, fixedCosts: 0, cashOutflows: 0, managedExpenses: 0 };
    const grossRevenue = g?.grossRevenue ?? 0;
    const sellingSubtotal = g?.sellingSubtotal ?? 0;
    const grossProfit = g?.grossProfit ?? 0;
    const salaries = o.salaries;
    const fixedCosts = o.fixedCosts;
    const cashOutflows = o.cashOutflows;
    const managedExpenses = o.managedExpenses;
    const totalExpenses = salaries + fixedCosts + cashOutflows + managedExpenses;

    const centerName =
      g?.centerName ||
      centerNameById.get(rowKey) ||
      (rowKey === UNALLOCATED_KEY
        ? 'Unallocated (staff not on a center / cash without center)'
        : rowKey);

    rows.push({
      rowKey,
      centerId: g?.centerId ?? (/^__/.test(rowKey) ? '' : rowKey),
      centerName,
      grossRevenue,
      sellingSubtotal,
      grossProfit,
      salaries,
      fixedCosts,
      cashOutflows,
      managedExpenses,
      totalExpenses,
      netProfit: grossProfit - totalExpenses,
    });
  }

  return rows.sort((a, b) => {
    const aUn = a.rowKey === UNALLOCATED_KEY || a.rowKey.startsWith('__');
    const bUn = b.rowKey === UNALLOCATED_KEY || b.rowKey.startsWith('__');
    if (aUn !== bUn) return aUn ? 1 : -1;
    return a.centerName.localeCompare(b.centerName, 'en-IN');
  });
}

function opexByKeys(m: Map<string, CenterOpexSlice>): string[] {
  const out: string[] = [];
  m.forEach((_, k) => out.push(k));
  return out;
}
