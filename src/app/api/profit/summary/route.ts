import { NextResponse } from 'next/server';
import type { Timestamp, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { getRequesterTenant } from '@/server/tenant/requesterTenant';
import type { BreakdownRow, ProfitSummary } from '@/lib/profit/types';
import { cashRegisterExpenseAmount } from '@/lib/cash-register/expenseOutflow';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

// ── Utilities ────────────────────────────────────────────────────────────────

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function toDate(ts: Timestamp | string | number | null | undefined): Date | null {
  if (!ts) return null;
  if (typeof ts === 'object' && 'toDate' in ts) return (ts as Timestamp).toDate();
  if (typeof ts === 'string') return parseISO(ts);
  if (typeof ts === 'number') return new Date(ts);
  return null;
}

function dateInRange(d: Date | null, from: Date, to: Date): boolean {
  if (!d) return false;
  return isWithinInterval(d, { start: from, end: to });
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

// ── Serial matching helpers (mirrors ProfitReportTab logic) ──────────────────

function normalizeSerial(s: unknown): string {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}

function splitSerials(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => normalizeSerial(String(v || ''))).filter(Boolean);
  }
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(/[,\n;|]+/g)
    .map((v) => normalizeSerial(v))
    .filter(Boolean);
}

function serialsFromProduct(p: Record<string, unknown>): string[] {
  const all: string[] = [];
  if (Array.isArray(p.serialNumbers)) all.push(...splitSerials(p.serialNumbers));
  for (const key of [
    'serialNumber', 'trialSerialNumber', 'serialNo',
    'serial_no', 'deviceSerial', 'hearingAidSerial',
  ]) {
    all.push(...splitSerials(p[key]));
  }
  return [...new Set(all.filter(Boolean))];
}

function productIdsFromLine(p: Record<string, unknown>): string[] {
  return [
    ...new Set(
      [p.productId, p.id, p.hearingAidProductId]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean),
    ),
  ];
}

type CostSource = 'purchase' | 'material';

type CostLine = {
  source: CostSource;
  date: Date;
  dealerPrice: number;
};

function registerCostLine(
  byProductSerial: Map<string, CostLine[]>,
  bySerial: Map<string, CostLine[]>,
  productIds: string[],
  serial: string,
  entry: CostLine,
) {
  for (const pid of productIds) {
    const k = `${pid}|${serial}`;
    const arr = byProductSerial.get(k) ?? [];
    arr.push(entry);
    byProductSerial.set(k, arr);
  }
  const arr = bySerial.get(serial) ?? [];
  arr.push(entry);
  bySerial.set(serial, arr);
}

function pickBestCostLine(entries: CostLine[]): CostLine | null {
  if (!entries.length) return null;
  // Deduplicate by source + date + price
  const seen = new Set<string>();
  const unique = entries.filter((e) => {
    const k = `${e.source}:${e.date.getTime()}:${e.dealerPrice}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Purchases win over materialInward; within a source prefer newest
  const purchases = unique.filter((e) => e.source === 'purchase');
  const pool = purchases.length ? purchases : unique;
  return pool.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
}

function lookupDealerCost(
  serial: string,
  productIds: string[],
  byProductSerial: Map<string, CostLine[]>,
  bySerial: Map<string, CostLine[]>,
): number | null {
  // 1. Try productId + serial match first (most precise)
  for (const pid of productIds) {
    const entries = byProductSerial.get(`${pid}|${serial}`);
    if (entries?.length) {
      const best = pickBestCostLine(entries);
      if (best) return best.dealerPrice;
    }
  }
  // 2. Fallback: serial only
  const fallback = bySerial.get(serial);
  if (fallback?.length) {
    const best = pickBestCostLine(fallback);
    if (best) return best.dealerPrice;
  }
  return null;
}

function buildCostMaps(
  materialDocs: QueryDocumentSnapshot[],
  purchaseDocs: QueryDocumentSnapshot[],
): {
  byProductSerial: Map<string, CostLine[]>;
  bySerial: Map<string, CostLine[]>;
} {
  const byProductSerial = new Map<string, CostLine[]>();
  const bySerial = new Map<string, CostLine[]>();

  function processDoc(docSnap: QueryDocumentSnapshot, source: CostSource) {
    const data = docSnap.data() as Record<string, unknown>;
    const products = Array.isArray(data.products) ? (data.products as Record<string, unknown>[]) : [];
    const entryDate =
      toDate(
        (data.purchaseDate ?? data.receivedDate ?? data.createdAt) as
          | Timestamp
          | string
          | null,
      ) ?? new Date(0);

    for (const rawProduct of products) {
      const p = rawProduct as Record<string, unknown>;
      const serials = serialsFromProduct(p);
      if (!serials.length) continue;

      const quantity = Math.round(safeNum(p.quantity)) || 1;
      const dealerRaw = safeNum(p.dealerPrice ?? p.finalPrice ?? p.purchasePrice ?? 0);
      const lineTotal = dealerRaw * Math.max(quantity, 1);
      const units = Math.max(serials.length, quantity, 1);
      const dealerPerSerial = lineTotal / units;

      const pids = productIdsFromLine(p);

      for (const serial of serials) {
        registerCostLine(byProductSerial, bySerial, pids, serial, {
          source,
          date: entryDate,
          dealerPrice: dealerPerSerial,
        });
      }
    }
  }

  for (const doc of materialDocs) processDoc(doc, 'material');
  for (const doc of purchaseDocs) processDoc(doc, 'purchase');

  return { byProductSerial, bySerial };
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
    if (!requester.isSuperAdmin) return jsonError('SuperAdmin access required', 403);

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

    // Parallel fetch all required collections
    const [
      salesSnap,
      salariesSnap,
      centersSnap,
      centerExpensesSnap,
      cashSheetsSnap,
      materialInSnap,
      purchasesSnap,
    ] = await Promise.all([
      db.collection('sales').get(),
      db.collection('salaries').where('isPaid', '==', true).get(),
      db.collection('centers').get(),
      db.collection('centerExpenses').get(),
      db.collection('cashDailySheets').get(),
      db.collection('materialInward').get(),
      db.collection('purchases').get(),
    ]);

    // Build dealer-cost lookup maps from inbound stock records
    const { byProductSerial, bySerial } = buildCostMaps(
      materialInSnap.docs,
      purchasesSnap.docs,
    );

    const rows: BreakdownRow[] = [];
    let grossRevenue = 0;
    let totalCogs = 0;
    let unresolvedSerialsCount = 0;
    let unresolvedSellingValue = 0;

    let totalSalaries = 0;
    let totalFixedCosts = 0;
    let totalCashOutflows = 0;

    // ── 1. Revenue + COGS matching (per sale) ──────────────────────────────
    for (const doc of salesSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      if (d.cancelled === true) continue;

      const saleDate = toDate(d.saleDate as Timestamp | string | null);
      if (!dateInRange(saleDate, from, to)) continue;

      const docTotal = safeNum(d.total ?? d.grandTotal ?? d.amount ?? 0);
      if (docTotal <= 0) continue;

      const dateStr = saleDate ? format(saleDate, 'yyyy-MM-dd') : fromParam;
      const clientName =
        (d.clientName as string) || (d.patientName as string) || 'Sale';
      const invoiceRef = (d.invoiceNumber as string) || doc.id;
      const centerName =
        (d.centerName as string) || (d.branch as string) || undefined;

      grossRevenue += docTotal;

      // Match product serials to dealer costs
      const products = [
        ...(Array.isArray(d.products) ? (d.products as Record<string, unknown>[]) : []),
        ...(Array.isArray(d.accessories) ? (d.accessories as Record<string, unknown>[]) : []),
      ];

      let saleCogs = 0;
      let saleResolved = 0;
      let saleUnresolved = 0;
      let saleUnresolvedSelling = 0;

      for (const rawLine of products) {
        const p = rawLine as Record<string, unknown>;
        const serials = serialsFromProduct(p);
        const pids = productIdsFromLine(p);

        if (!serials.length) {
          // No serial → cannot match COGS; treating as 0-cost (e.g. accessories, services)
          saleUnresolved++;
          saleUnresolvedSelling += safeNum(
            p.sellingPrice ?? p.finalAmount ?? p.amount ?? 0,
          );
          continue;
        }

        const quantity = Math.max(serials.length, Math.round(safeNum(p.quantity)) || 1, 1);
        const lineTotal = safeNum(p.sellingPrice ?? p.finalAmount ?? p.amount ?? 0);
        const sellingPerSerial = lineTotal / quantity;

        for (const serial of serials) {
          const dealer = lookupDealerCost(serial, pids, byProductSerial, bySerial);
          if (dealer !== null) {
            saleCogs += dealer;
            saleResolved++;
          } else {
            saleUnresolved++;
            saleUnresolvedSelling += sellingPerSerial;
          }
        }
      }

      totalCogs += saleCogs;
      unresolvedSerialsCount += saleUnresolved;
      unresolvedSellingValue += saleUnresolvedSelling;

      // Revenue breakdown row
      rows.push({
        id: `sale_${doc.id}`,
        date: dateStr,
        description: clientName,
        category: 'Revenue',
        type: 'in',
        amount: docTotal,
        reference: invoiceRef,
        centerName,
      });

      // Product Cost (COGS) breakdown row — only when we have matched dealer costs
      if (saleCogs > 0) {
        rows.push({
          id: `cogs_${doc.id}`,
          date: dateStr,
          description: `Product Cost — ${clientName}`,
          category: 'Product Cost',
          type: 'out',
          amount: saleCogs,
          reference: invoiceRef,
          centerName,
        });
      }

      void saleResolved; // tracked in totals above
    }

    const grossProfit = grossRevenue - totalCogs;

    // ── 2. Salary costs — filtered by disbursement date (paidDate) ──────────
    for (const doc of salariesSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const month = d.month as string | undefined;

      const paidDate = toDate(d.paidDate as Timestamp | string | null);

      let effectiveDisbursementDate: Date | null = null;
      if (paidDate) {
        effectiveDisbursementDate = paidDate;
      } else if (month) {
        const [y, m] = month.split('-').map(Number);
        effectiveDisbursementDate = new Date(y, m - 1, 1);
      }

      if (!dateInRange(effectiveDisbursementDate, from, to)) continue;

      const amount = safeNum(d.netSalary ?? 0);
      if (amount <= 0) continue;

      totalSalaries += amount;
      const displayDate = effectiveDisbursementDate
        ? format(effectiveDisbursementDate, 'yyyy-MM-dd')
        : fromParam;

      const monthLabel = month ? ` (${month})` : '';
      const disbursementNote = paidDate ? '' : ' †';

      rows.push({
        id: `salary_${doc.id}`,
        date: displayDate,
        description: `Salary — ${(d.staffName as string) || (d.staffId as string) || 'Staff'}${monthLabel}${disbursementNote}`,
        category: 'Salary',
        type: 'out',
        amount,
        reference: doc.id,
      });
    }

    // ── 3. Fixed costs (rent + utilities per center per month) ───────────────
    type ExpenseRecord = { rent?: number; electricity?: number };
    const expenseMap = new Map<string, ExpenseRecord>();
    for (const doc of centerExpensesSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const centerId = d.centerId as string | undefined;
      const month = d.month as string | undefined;
      if (!centerId || !month) continue;
      expenseMap.set(`${centerId}_${month}`, {
        rent: safeNum(d.rent ?? d.monthlyRent ?? 0),
        electricity: safeNum(d.electricity ?? d.monthlyElectricity ?? 0),
      });
    }

    const monthsInRange: string[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const toMonth = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= toMonth) {
      monthsInRange.push(format(cursor, 'yyyy-MM'));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const centerDoc of centersSnap.docs) {
      const c = centerDoc.data() as Record<string, unknown>;
      const centerName = (c.name as string) || centerDoc.id;
      const baseRent = safeNum(c.monthlyRent ?? 0);
      const baseElec = safeNum(c.monthlyElectricity ?? 0);

      for (const month of monthsInRange) {
        const recorded = expenseMap.get(`${centerDoc.id}_${month}`);
        const rent = recorded?.rent ?? baseRent;
        const electricity = recorded?.electricity ?? baseElec;

        if (rent > 0) {
          totalFixedCosts += rent;
          rows.push({
            id: `rent_${centerDoc.id}_${month}`,
            date: `${month}-01`,
            description: `Rent — ${centerName} (${month})`,
            category: 'Fixed Cost',
            type: 'out',
            amount: rent,
            centerName,
          });
        }

        if (electricity > 0) {
          totalFixedCosts += electricity;
          rows.push({
            id: `elec_${centerDoc.id}_${month}`,
            date: `${month}-01`,
            description: `Electricity — ${centerName} (${month})`,
            category: 'Fixed Cost',
            type: 'out',
            amount: electricity,
            centerName,
          });
        }
      }
    }

    // ── 4. Cash Register: cash-out lines categorized as "expenses" only ───────
    for (const doc of cashSheetsSnap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const sheetDate = toDate(d.date as Timestamp | string | null);
      if (!dateInRange(sheetDate, from, to)) continue;

      const cashOutRows = Array.isArray(d.cashOut) ? d.cashOut : [];
      const centerName = (d.centerName as string) || undefined;
      const dateStr = sheetDate ? format(sheetDate, 'yyyy-MM-dd') : fromParam;

      for (const outRow of cashOutRows as Record<string, unknown>[]) {
        const amount = cashRegisterExpenseAmount(outRow);
        if (amount <= 0) continue;

        totalCashOutflows += amount;
        rows.push({
          id: `cash_${doc.id}_${outRow.id ?? Math.random()}`,
          date: dateStr,
          description: `Cash expense (register) — ${String(
            outRow.itemDetails ?? outRow.partyName ?? '—',
          )}`,
          category: 'Cash Outflow',
          type: 'out',
          amount,
          reference: doc.id,
          centerName,
        });
      }
    }

    // ── Final calculations ───────────────────────────────────────────────────
    const totalOperatingExpenses = totalSalaries + totalFixedCosts + totalCashOutflows;
    const netProfit = grossProfit - totalOperatingExpenses;

    // Sort: Revenue rows first (desc by date), then all outflows (desc by date)
    rows.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'in' ? -1 : 1;
      return b.date.localeCompare(a.date);
    });

    const summary: ProfitSummary = {
      grossRevenue,
      totalCogs,
      grossProfit,
      totalSalaries,
      totalFixedCosts,
      totalCashOutflows,
      totalOperatingExpenses,
      netProfit,
      unresolvedSerialsCount,
      unresolvedSellingValue,
      breakdownRows: rows,
      centerRows: [],
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
