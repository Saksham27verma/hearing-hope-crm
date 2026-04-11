/**
 * Cash Register daily sheets store `cashOut[]` lines with `transactionCategory`:
 * `handed_over` | `expenses` | `miscellaneous`.
 *
 * For P&L / profit module, only `expenses` rows are operating costs.
 * Handed-over and miscellaneous outflows are excluded from net profit.
 */

export function isCashRegisterExpenseOutflow(raw: Record<string, unknown>): boolean {
  return raw.transactionCategory === 'expenses';
}

/** Positive amount only when the row is categorized as an expense outflow. */
export function cashRegisterExpenseAmount(raw: Record<string, unknown>): number {
  if (!isCashRegisterExpenseOutflow(raw)) return 0;
  const n = Number(raw.amount ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
