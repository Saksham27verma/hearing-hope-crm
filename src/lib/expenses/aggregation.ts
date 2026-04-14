import type { BreakdownRow } from '@/lib/profit/types';
import type { CenterOpexSlice } from '@/lib/profit/mergeCenterProfit';
import { UNALLOCATED_KEY } from '@/lib/profit/mergeCenterProfit';
import type { ManagedExpense } from './types';

function parseDateOnly(date: string): Date | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(date: string, from: Date, to: Date): boolean {
  const d = parseDateOnly(date);
  if (!d) return false;
  return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
}

function addManagedExpenseToOpex(map: Map<string, CenterOpexSlice>, key: string, amount: number): void {
  if (amount <= 0) return;
  const cur = map.get(key) ?? { salaries: 0, fixedCosts: 0, cashOutflows: 0, managedExpenses: 0 };
  cur.managedExpenses += amount;
  map.set(key, cur);
}

export function aggregateManagedExpenses(params: {
  expenses: ManagedExpense[];
  from: Date;
  to: Date;
}): {
  totalManagedExpenses: number;
  centerManagedExpenses: number;
  globalManagedExpenses: number;
  rows: BreakdownRow[];
  opexByKey: Map<string, CenterOpexSlice>;
} {
  const { expenses, from, to } = params;
  const rows: BreakdownRow[] = [];
  const opexByKey = new Map<string, CenterOpexSlice>();
  let totalManagedExpenses = 0;
  let centerManagedExpenses = 0;
  let globalManagedExpenses = 0;

  for (const exp of expenses) {
    if (exp.status !== 'active') continue;
    if (!inRange(exp.date, from, to)) continue;
    const amount = Number(exp.amount) || 0;
    if (amount <= 0) continue;

    totalManagedExpenses += amount;
    const titleBits = [exp.category, exp.subCategory].filter(Boolean).join(' / ');
    const desc = `Managed expense — ${titleBits || 'General'}${exp.vendor ? ` (${exp.vendor})` : ''}`;

    if (exp.scopeType === 'center') {
      centerManagedExpenses += amount;
      const key = exp.centerId?.trim() || UNALLOCATED_KEY;
      addManagedExpenseToOpex(opexByKey, key, amount);
      rows.push({
        id: `expense_${exp.id}`,
        date: exp.date,
        description: desc,
        category: 'Managed Expense',
        type: 'out',
        amount,
        reference: exp.id,
        centerName: exp.centerName || (key === UNALLOCATED_KEY ? 'Unallocated' : undefined),
        profitCenterKey: key,
      });
      continue;
    }

    globalManagedExpenses += amount;
    addManagedExpenseToOpex(opexByKey, UNALLOCATED_KEY, amount);
    rows.push({
      id: `expense_${exp.id}`,
      date: exp.date,
      description: `${desc} (global)`,
      category: 'Managed Expense',
      type: 'out',
      amount,
      reference: exp.id,
      centerName: 'Global',
      profitCenterKey: UNALLOCATED_KEY,
    });
  }

  return {
    totalManagedExpenses,
    centerManagedExpenses,
    globalManagedExpenses,
    rows,
    opexByKey,
  };
}
