import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertExplicitSuperAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';
import type { BreakdownRow, ProfitSummary } from '@/lib/profit/types';
import { parseISO, startOfDay, endOfDay, format } from 'date-fns';
import { computeGrossProfit, type RawDoc } from '@/lib/profit/computeGrossProfit';
import { buildStaffSalaryShareByCenter } from '@/lib/profit/staffCenterAllocation';
import {
  mergeCenterProfitRows,
  UNALLOCATED_KEY,
  type CenterOpexSlice,
} from '@/lib/profit/mergeCenterProfit';
import { cashRegisterExpenseAmount } from '@/lib/cash-register/expenseOutflow';
import type { ManagedExpense } from '@/lib/expenses/types';
import { aggregateManagedExpenses } from '@/lib/expenses/aggregation';

// ── Utilities ────────────────────────────────────────────────────────────────

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}
function tsToJsDate(t: unknown): Date | null {
  if (!t) return null;
  if (typeof t === 'object' && t !== null && 'toDate' in t) {
    return (t as { toDate(): Date }).toDate();
  }
  if (typeof t === 'string') {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof t === 'number') return new Date(t);
  return null;
}

function addOpexSlice(map: Map<string, CenterOpexSlice>, key: string, field: keyof CenterOpexSlice, amount: number) {
  if (amount <= 0) return;
  const cur = map.get(key) ?? { salaries: 0, fixedCosts: 0, cashOutflows: 0, managedExpenses: 0 };
  cur[field] += amount;
  map.set(key, cur);
}

function computeOperatingExpenses(params: {
  salaryDocs: RawDoc[];
  centerDocs: RawDoc[];
  centerExpenseDocs: RawDoc[];
  cashSheetDocs: RawDoc[];
  staffShares: Map<string, { centerIds: string[]; shares: number[] }>;
  dateFrom: Date;
  dateTo: Date;
  fromParam: string;
}) {
  const { salaryDocs, centerDocs, centerExpenseDocs, cashSheetDocs, staffShares, dateFrom, dateTo, fromParam } = params;
  const centerNameById = new Map<string, string>();
  for (const c of centerDocs) centerNameById.set(String(c.id), String(c.name ?? c.id));
  const rows: BreakdownRow[] = [];
  const opexByKey = new Map<string, CenterOpexSlice>();
  let totalSalaries = 0;
  let totalFixedCosts = 0;
  let totalCashOutflows = 0;

  function inRange(d: Date | null): boolean {
    if (!d) return false;
    const t = d.getTime();
    return t >= dateFrom.getTime() && t <= dateTo.getTime();
  }

  for (const d of salaryDocs) {
    const month = d.month as string | undefined;
    const paidDate = tsToJsDate(d.paidDate);
    let effectiveDate: Date | null = paidDate;
    if (!effectiveDate && month) {
      const [y, m] = month.split('-').map(Number);
      effectiveDate = new Date(y, m - 1, 1);
    }
    if (!inRange(effectiveDate)) continue;
    const amount = safeNum(d.netSalary);
    if (amount <= 0) continue;
    totalSalaries += amount;
    const dateStr = effectiveDate ? format(effectiveDate, 'yyyy-MM-dd') : fromParam;
    const staffId = String(d.staffId ?? '').trim();
    const baseDesc = `Salary — ${String(d.staffName ?? (staffId || 'Staff'))}${month ? ` (${month})` : ''}`;
    const alloc = staffShares.get(staffId);
    if (!alloc || alloc.centerIds.length === 0) {
      addOpexSlice(opexByKey, UNALLOCATED_KEY, 'salaries', amount);
      rows.push({
        id: `salary_${d.id}_unallocated`,
        date: dateStr,
        description: `${baseDesc} (not assigned to any center in Centers → Staff)`,
        category: 'Salary',
        type: 'out',
        amount,
        reference: String(d.id),
        centerName: 'Unallocated',
        profitCenterKey: UNALLOCATED_KEY,
      });
      continue;
    }
    for (let i = 0; i < alloc.centerIds.length; i++) {
      const cid = alloc.centerIds[i];
      const portion = amount * (alloc.shares[i] ?? 0);
      if (portion <= 0) continue;
      addOpexSlice(opexByKey, cid, 'salaries', portion);
      const cname = centerNameById.get(cid) ?? cid;
      rows.push({
        id: `salary_${d.id}_${cid}`,
        date: dateStr,
        description: `${baseDesc} → ${cname}`,
        category: 'Salary',
        type: 'out',
        amount: portion,
        reference: String(d.id),
        centerName: cname,
        profitCenterKey: cid,
      });
    }
  }

  type ExpenseRecord = { rent?: number; electricity?: number };
  const expenseMap = new Map<string, ExpenseRecord>();
  for (const d of centerExpenseDocs) {
    const cid = d.centerId as string | undefined;
    const month = d.month as string | undefined;
    if (!cid || !month) continue;
    expenseMap.set(`${cid}_${month}`, {
      rent: safeNum(d.rent ?? d.monthlyRent ?? 0),
      electricity: safeNum(d.electricity ?? d.monthlyElectricity ?? 0),
    });
  }
  const monthsInRange: string[] = [];
  const cursor = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), 1);
  const toMonth = new Date(dateTo.getFullYear(), dateTo.getMonth(), 1);
  while (cursor <= toMonth) {
    monthsInRange.push(format(cursor, 'yyyy-MM'));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const c of centerDocs) {
    const cid = String(c.id);
    const centerName = String(c.name ?? c.id);
    const baseRent = safeNum(c.monthlyRent ?? 0);
    const baseElec = safeNum(c.monthlyElectricity ?? 0);
    for (const month of monthsInRange) {
      const recorded = expenseMap.get(`${cid}_${month}`);
      const rent = recorded?.rent ?? baseRent;
      const elec = recorded?.electricity ?? baseElec;
      if (rent > 0) {
        totalFixedCosts += rent;
        addOpexSlice(opexByKey, cid, 'fixedCosts', rent);
        rows.push({ id: `rent_${cid}_${month}`, date: `${month}-01`, description: `Rent — ${centerName} (${month})`, category: 'Fixed Cost', type: 'out', amount: rent, centerName, profitCenterKey: cid });
      }
      if (elec > 0) {
        totalFixedCosts += elec;
        addOpexSlice(opexByKey, cid, 'fixedCosts', elec);
        rows.push({ id: `elec_${cid}_${month}`, date: `${month}-01`, description: `Electricity — ${centerName} (${month})`, category: 'Fixed Cost', type: 'out', amount: elec, centerName, profitCenterKey: cid });
      }
    }
  }

  for (const d of cashSheetDocs) {
    const sheetDate = tsToJsDate(d.date);
    if (!inRange(sheetDate)) continue;
    const dateStr = sheetDate ? format(sheetDate, 'yyyy-MM-dd') : fromParam;
    const cashCenterId = String(d.centerId ?? '').trim();
    const profitKey = cashCenterId || UNALLOCATED_KEY;
    const centerLabel = (d.centerName ? String(d.centerName) : undefined) ?? centerNameById.get(cashCenterId) ?? (profitKey === UNALLOCATED_KEY ? 'Unallocated (cash)' : undefined);
    const cashOutRows = Array.isArray(d.cashOut) ? (d.cashOut as Record<string, unknown>[]) : [];
    for (const outRow of cashOutRows) {
      const amount = cashRegisterExpenseAmount(outRow);
      if (amount <= 0) continue;
      totalCashOutflows += amount;
      addOpexSlice(opexByKey, profitKey, 'cashOutflows', amount);
      rows.push({
        id: `cash_${d.id}_${String(outRow.id ?? '')}_${Math.random().toString(36).slice(2, 8)}`,
        date: dateStr,
        description: `Cash expense (register) — ${String(outRow.itemDetails ?? outRow.partyName ?? '—')}`,
        category: 'Cash Outflow',
        type: 'out',
        amount,
        reference: String(d.id),
        centerName: centerLabel,
        profitCenterKey: profitKey,
      });
    }
  }

  return { totalSalaries, totalFixedCosts, totalCashOutflows, rows, opexByKey };
}

// ── Main route handler ───────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);

    const requester = await getRequesterTenant(decoded.uid);
    if (!requester) return jsonError('Forbidden', 403);
    try {
      assertExplicitSuperAdmin(requester);
    } catch {
      return jsonError('Super admin access required', 403);
    }

    const url = new URL(req.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    if (!fromParam || !toParam) return jsonError('from and to query params are required', 400);

    const from = startOfDay(parseISO(fromParam));
    const to = endOfDay(parseISO(toParam));

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return jsonError('Invalid date format. Use ISO 8601 (YYYY-MM-DD)', 400);
    }

    const db = adminDb();

    const [
      salesSnap,
      enquiriesSnap,
      centersSnap,
      materialSnap,
      purchasesSnap,
      salariesSnap,
      centerExpensesSnap,
      cashSheetsSnap,
      managedExpensesSnap,
    ] = await Promise.all([
      db.collection('sales').get(),
      db.collection('enquiries').get(),
      db.collection('centers').get(),
      db.collection('materialInward').get(),
      db.collection('purchases').get(),
      db.collection('salaries').where('isPaid', '==', true).get(),
      db.collection('centerExpenses').get(),
      db.collection('cashDailySheets').get(),
      db.collection('expenses').get(),
    ]);

    const toRaw = (snap: FirebaseFirestore.QuerySnapshot): RawDoc[] =>
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as RawDoc));

    const gp = computeGrossProfit({
      salesRawDocs: toRaw(salesSnap),
      enquiryRawDocs: toRaw(enquiriesSnap),
      centresRawDocs: toRaw(centersSnap),
      materialRawDocs: toRaw(materialSnap),
      purchasesRawDocs: toRaw(purchasesSnap),
      dateFrom: from,
      dateTo: to,
    });

    const centerDocsRaw = toRaw(centersSnap);
    const staffShares = buildStaffSalaryShareByCenter(centerDocsRaw);
    const opex = computeOperatingExpenses({
      salaryDocs: toRaw(salariesSnap),
      centerDocs: centerDocsRaw,
      centerExpenseDocs: toRaw(centerExpensesSnap),
      cashSheetDocs: toRaw(cashSheetsSnap),
      staffShares,
      dateFrom: from,
      dateTo: to,
      fromParam,
    });
    const managedExpenses = aggregateManagedExpenses({
      expenses: toRaw(managedExpensesSnap) as ManagedExpense[],
      from,
      to,
    });
    managedExpenses.opexByKey.forEach((slice, key) => {
      addOpexSlice(opex.opexByKey, key, 'managedExpenses', slice.managedExpenses);
    });

    const centerNameById = new Map<string, string>();
    for (const c of centerDocsRaw) centerNameById.set(String(c.id), String(c.name ?? c.id));
    const centerRows = mergeCenterProfitRows({
      grossByKey: gp.grossByCenterKey,
      opexByKey: opex.opexByKey,
      centerNameById,
    });

    const revenueRows: BreakdownRow[] = gp.saleRows.map((r) => ({
      id: `sale_${r.id}`,
      date: r.date,
      description: r.clientName,
      category: 'Revenue',
      type: 'in',
      amount: r.grandTotal,
      reference: r.invoiceRef ?? undefined,
      centerName: r.centerName,
      profitCenterKey: r.profitCenterKey,
    }));
    const rows = [...revenueRows, ...opex.rows, ...managedExpenses.rows].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'in' ? -1 : 1;
      return b.date.localeCompare(a.date);
    });

    const totalOperatingExpenses =
      opex.totalSalaries +
      opex.totalFixedCosts +
      opex.totalCashOutflows +
      managedExpenses.totalManagedExpenses;

    const summary: ProfitSummary = {
      grossRevenue: gp.grossRevenue,
      totalCogs: gp.dealerCostTotal,
      grossProfit: gp.profitTotal,
      totalSalaries: opex.totalSalaries,
      totalFixedCosts: opex.totalFixedCosts,
      totalCashOutflows: opex.totalCashOutflows,
      totalManagedExpenses: managedExpenses.totalManagedExpenses,
      centerManagedExpenses: managedExpenses.centerManagedExpenses,
      globalManagedExpenses: managedExpenses.globalManagedExpenses,
      totalOperatingExpenses,
      netProfit: gp.profitTotal - totalOperatingExpenses,
      unresolvedSerialsCount: gp.unresolvedCount,
      unresolvedSellingValue: gp.unresolvedSellingValue,
      breakdownRows: rows,
      centerRows,
      dateFrom: fromParam,
      dateTo: toParam,
    };

    return NextResponse.json({ ok: true, data: summary });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to compute profit summary';
    console.error('profit/summary error:', err);
    if (message === 'SuperAdmin access required') return jsonError(message, 403);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}
