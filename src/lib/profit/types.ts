export type DatePreset = 'this-month' | 'last-quarter' | 'custom';

export type BreakdownCategory =
  | 'Revenue'
  | 'Product Cost'
  | 'Salary'
  | 'Fixed Cost'
  | 'Cash Outflow'
  | 'Managed Expense';
export type BreakdownType = 'in' | 'out';

export interface BreakdownRow {
  id: string;
  date: string;
  description: string;
  category: BreakdownCategory;
  type: BreakdownType;
  amount: number;
  reference?: string;
  centerName?: string;
  /** Revenue rows: pre-GST invoice subtotal (same as Sales Report "selling") */
  invoiceSubtotal?: number;
  /**
   * Internal grouping key for center-wise rollups: real Firestore center id when known,
   * else the same key used in `CenterProfitRow.rowKey` (e.g. orphan / unassigned).
   */
  profitCenterKey?: string;
}

/** One row in the center-wise net profit table / chart. */
export interface CenterProfitRow {
  /** Merge key: center Firestore id when known, else synthetic (orphan / unallocated). */
  rowKey: string;
  /** Empty when the row is synthetic (orphan sales, unallocated salary, etc.). */
  centerId: string;
  centerName: string;
  grossRevenue: number;
  /** Sum of invoice subtotals (pre-GST); matches Sales Report center-wise "selling". */
  sellingSubtotal: number;
  grossProfit: number;
  salaries: number;
  fixedCosts: number;
  cashOutflows: number;
  managedExpenses: number;
  totalExpenses: number;
  netProfit: number;
}

export interface ProfitSummary {
  /** Top-line total of all invoiced sales in the period */
  grossRevenue: number;
  /** Sum of pre-GST / taxable amounts (invoice subtotal) — same basis as Sales Report "selling" */
  sellingSubtotal: number;
  /** Matched dealer/purchase costs for resolved serials */
  totalCogs: number;
  /** grossRevenue − totalCogs  (mirrors Profit Analysis report logic) */
  grossProfit: number;
  /** Salaries paid (disbursed) in the period */
  totalSalaries: number;
  /** Rent + utilities across all centers in the period */
  totalFixedCosts: number;
  /** Sum of cash-out lines on daily sheets with Cash Register category "Expenses" only */
  totalCashOutflows: number;
  /** Managed expenses from dedicated `expenses` collection */
  totalManagedExpenses: number;
  /** Managed expenses marked scopeType=center */
  centerManagedExpenses: number;
  /** Managed expenses marked scopeType=global */
  globalManagedExpenses: number;
  /** totalSalaries + totalFixedCosts + totalCashOutflows + totalManagedExpenses */
  totalOperatingExpenses: number;
  /** grossProfit − totalOperatingExpenses */
  netProfit: number;
  /** Number of serials with no matching dealer cost record */
  unresolvedSerialsCount: number;
  /** Selling value of unresolved serials (COGS assumed 0 for them) */
  unresolvedSellingValue: number;
  breakdownRows: BreakdownRow[];
  /** Net profitability by center (salaries from Centers → Staff assignment; split equally if staff on multiple centers). */
  centerRows: CenterProfitRow[];
  dateFrom: string;
  dateTo: string;
}

export interface ProfitApiResponse {
  ok: true;
  data: ProfitSummary;
}

export interface ProfitApiError {
  ok: false;
  error: string;
}
