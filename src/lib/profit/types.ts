export type DatePreset = 'this-month' | 'last-quarter' | 'custom';

export type BreakdownCategory = 'Revenue' | 'Product Cost' | 'Salary' | 'Fixed Cost' | 'Cash Outflow';
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
}

export interface ProfitSummary {
  /** Top-line total of all invoiced sales in the period */
  grossRevenue: number;
  /** Matched dealer/purchase costs for resolved serials */
  totalCogs: number;
  /** grossRevenue − totalCogs  (mirrors Profit Analysis report logic) */
  grossProfit: number;
  /** Salaries paid (disbursed) in the period */
  totalSalaries: number;
  /** Rent + utilities across all centers in the period */
  totalFixedCosts: number;
  /** Sum of cashOut entries from cash daily sheets */
  totalCashOutflows: number;
  /** totalSalaries + totalFixedCosts + totalCashOutflows */
  totalOperatingExpenses: number;
  /** grossProfit − totalOperatingExpenses */
  netProfit: number;
  /** Number of serials with no matching dealer cost record */
  unresolvedSerialsCount: number;
  /** Selling value of unresolved serials (COGS assumed 0 for them) */
  unresolvedSellingValue: number;
  breakdownRows: BreakdownRow[];
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
