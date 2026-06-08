import type { Timestamp } from 'firebase/firestore';

export type OpeningSource = 'carried_forward' | 'manual';

export interface DailySheetTotals {
  netIn: number;
  netOut: number;
  cashIn: number;
  cashOut: number;
  balance: number;
  cashBalance: number;
  /** Cash received minus cash paid (cash payment method only) for the day */
  netCashIn?: number;
  openingCashBalance?: number;
  closingCashBalance?: number;
}

export interface DailySheetDoc {
  date: Timestamp;
  centerId?: string;
  centerName?: string;
  cashIn: unknown[];
  cashOut: unknown[];
  openingCashBalance?: number;
  closingCashBalance?: number;
  openingSource?: OpeningSource;
  remarks?: string;
  totals: DailySheetTotals;
  createdAt: Timestamp;
}

/** Net cash in for the day (cash-method lines only). */
export function netCashInForDay(doc: DailySheetDoc): number {
  const cashIn = Number(doc.totals?.cashIn) || 0;
  const cashOut = Number(doc.totals?.cashOut) || 0;
  const stored = doc.totals?.netCashIn;
  if (typeof stored === 'number' && Number.isFinite(stored)) return stored;
  if (typeof doc.totals?.cashBalance === 'number' && Number.isFinite(doc.totals.cashBalance)) {
    return doc.totals.cashBalance;
  }
  return cashIn - cashOut;
}

export type CashDailySheetRef = { id: string; doc: DailySheetDoc };

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function sameCalendarDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function sheetDateFromDoc(doc: DailySheetDoc): Date {
  return new Date(doc.date.seconds * 1000);
}

export function computeClosingCashBalance(opening: number, cashIn: number, cashOut: number): number {
  const o = Number(opening) || 0;
  const ci = Number(cashIn) || 0;
  const co = Number(cashOut) || 0;
  return o + ci - co;
}

/** Drawer opening/closing for one sheet; priorClosing = previous day's closing cash balance. */
export function resolveDrawerBalances(
  doc: DailySheetDoc,
  priorClosing: number | null = null,
): {
  openingCashBalance: number;
  closingCashBalance: number;
  cashMovement: number;
} {
  const cashIn = Number(doc.totals?.cashIn) || 0;
  const cashOut = Number(doc.totals?.cashOut) || 0;
  const cashMovement = Number(doc.totals?.cashBalance) ?? cashIn - cashOut;

  const hasStoredClosing =
    typeof doc.closingCashBalance === 'number' && Number.isFinite(doc.closingCashBalance);
  const hasStoredOpening =
    typeof doc.openingCashBalance === 'number' && Number.isFinite(doc.openingCashBalance);

  // Opening always equals prior day's closing cash balance when a prior sheet exists.
  let openingCashBalance: number;
  if (priorClosing != null) {
    openingCashBalance = priorClosing;
  } else if (hasStoredOpening) {
    openingCashBalance = doc.openingCashBalance!;
  } else if (hasStoredClosing) {
    openingCashBalance = doc.closingCashBalance! - cashIn + cashOut;
  } else {
    openingCashBalance = 0;
  }

  const closingCashBalance = hasStoredClosing
    ? doc.closingCashBalance!
    : computeClosingCashBalance(openingCashBalance, cashIn, cashOut);

  return { openingCashBalance, closingCashBalance, cashMovement };
}

export function resolveDrawerBalancesForSheet(
  sheets: CashDailySheetRef[],
  sheet: CashDailySheetRef,
): ReturnType<typeof resolveDrawerBalances> {
  const centerId = sheet.doc.centerId;
  if (!centerId) return resolveDrawerBalances(sheet.doc, null);
  const prior = findPriorSheetForCenter(sheets, centerId, sheetDateFromDoc(sheet.doc));
  const priorClosing = prior
    ? resolveDrawerBalancesForSheet(sheets, prior).closingCashBalance
    : null;
  return resolveDrawerBalances(sheet.doc, priorClosing);
}

export function getPriorDrawerClosing(
  sheets: CashDailySheetRef[],
  centerId: string,
  beforeDate: Date,
): number {
  const prior = findPriorSheetForCenter(sheets, centerId, beforeDate);
  if (!prior) return 0;
  return resolveDrawerBalancesForSheet(sheets, prior).closingCashBalance;
}

export function normalizeSheetBalances(doc: DailySheetDoc): {
  openingCashBalance: number;
  closingCashBalance: number;
  cashMovement: number;
} {
  return resolveDrawerBalances(doc, null);
}

/** Bank-style snapshot for one center on one calendar day. */
export interface TodayDrawerSnapshot {
  todaySheet: CashDailySheetRef | null;
  hasSheet: boolean;
  opening: number;
  /** Null when no sheet saved yet for this day. */
  closing: number | null;
  cashIn: number;
  cashOut: number;
  cashMovement: number;
  priorSheetDate: Date | null;
  closingNotSavedYet: boolean;
}

export function findSheetForCenterOnCalendarDay(
  sheets: CashDailySheetRef[],
  centerId: string,
  date: Date,
  excludeSheetId?: string | null,
): CashDailySheetRef | null {
  return findSheetForCenterOnDate(sheets, centerId, date, excludeSheetId);
}

export function getTodayDrawerSnapshot(
  sheets: CashDailySheetRef[],
  centerId: string,
  asOfDate: Date = new Date(),
): TodayDrawerSnapshot {
  const day = startOfDay(asOfDate);
  const todaySheet = findSheetForCenterOnDate(sheets, centerId, day);
  const { priorSheet } = suggestOpeningCashBalance(sheets, centerId, day);
  const priorSheetDate = priorSheet ? sheetDateFromDoc(priorSheet.doc) : null;

  if (todaySheet) {
    const bal = resolveDrawerBalancesForSheet(sheets, todaySheet);
    const cashIn = Number(todaySheet.doc.totals?.cashIn) || 0;
    const cashOut = Number(todaySheet.doc.totals?.cashOut) || 0;
    return {
      todaySheet,
      hasSheet: true,
      opening: bal.openingCashBalance,
      closing: bal.closingCashBalance,
      cashIn,
      cashOut,
      cashMovement: bal.cashMovement,
      priorSheetDate,
      closingNotSavedYet: false,
    };
  }

  const priorClosing = getPriorDrawerClosing(sheets, centerId, day);
  return {
    todaySheet: null,
    hasSheet: false,
    opening: priorClosing,
    closing: null,
    cashIn: 0,
    cashOut: 0,
    cashMovement: 0,
    priorSheetDate,
    closingNotSavedYet: true,
  };
}

export function findSheetForCenterOnDate(
  sheets: CashDailySheetRef[],
  centerId: string,
  date: Date,
  excludeSheetId?: string | null,
): CashDailySheetRef | null {
  for (const s of sheets) {
    if (excludeSheetId && s.id === excludeSheetId) continue;
    if (s.doc.centerId !== centerId) continue;
    if (sameCalendarDay(sheetDateFromDoc(s.doc), date)) return s;
  }
  return null;
}

export function findPriorSheetForCenter(
  sheets: CashDailySheetRef[],
  centerId: string,
  beforeDate: Date,
): CashDailySheetRef | null {
  const cutoff = startOfDay(beforeDate).getTime();
  let best: CashDailySheetRef | null = null;
  let bestTime = -1;

  for (const s of sheets) {
    if (s.doc.centerId !== centerId) continue;
    const t = startOfDay(sheetDateFromDoc(s.doc)).getTime();
    if (t >= cutoff) continue;
    if (t > bestTime) {
      bestTime = t;
      best = s;
    }
  }
  return best;
}

export function suggestOpeningCashBalance(
  sheets: CashDailySheetRef[],
  centerId: string,
  entryDate: Date,
): { opening: number; priorSheet: CashDailySheetRef | null } {
  const prior = findPriorSheetForCenter(sheets, centerId, entryDate);
  if (!prior) return { opening: 0, priorSheet: null };
  const opening = getPriorDrawerClosing(sheets, centerId, entryDate);
  return { opening, priorSheet: prior };
}

export interface RowAmountInput {
  paymentMethod: string;
  amount: number;
}

export function computeMovementTotals(cashInRows: RowAmountInput[], cashOutRows: RowAmountInput[]) {
  const netIn = cashInRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const netOut = cashOutRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const cashIn = cashInRows
    .filter((r) => r.paymentMethod === 'cash')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const cashOut = cashOutRows
    .filter((r) => r.paymentMethod === 'cash')
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return {
    netIn,
    netOut,
    cashIn,
    cashOut,
    balance: netIn - netOut,
    cashBalance: cashIn - cashOut,
  };
}

export function buildTotalsPayload(
  cashInRows: RowAmountInput[],
  cashOutRows: RowAmountInput[],
  openingCashBalance: number,
): DailySheetTotals {
  const movement = computeMovementTotals(cashInRows, cashOutRows);
  const opening = Math.max(0, Number(openingCashBalance) || 0);
  const closingCashBalance = computeClosingCashBalance(opening, movement.cashIn, movement.cashOut);
  return {
    ...movement,
    netCashIn: movement.cashIn - movement.cashOut,
    openingCashBalance: opening,
    closingCashBalance,
  };
}

export function findLatestSheetForCenter(
  sheets: CashDailySheetRef[],
  centerId: string,
): CashDailySheetRef | null {
  let best: CashDailySheetRef | null = null;
  let bestTime = -1;
  for (const s of sheets) {
    if (s.doc.centerId !== centerId) continue;
    const t = startOfDay(sheetDateFromDoc(s.doc)).getTime();
    if (t > bestTime) {
      bestTime = t;
      best = s;
    }
  }
  return best;
}

/** Period opening/closing for a filtered set of sheets (single center or mixed). */
export function computePeriodDrawerBalances(sheets: CashDailySheetRef[]): {
  periodOpening: number;
  periodClosing: number;
  isSingleDay: boolean;
  sheetCount: number;
} {
  if (sheets.length === 0) {
    return { periodOpening: 0, periodClosing: 0, isSingleDay: false, sheetCount: 0 };
  }

  const sorted = [...sheets].sort(
    (a, b) => sheetDateFromDoc(a.doc).getTime() - sheetDateFromDoc(b.doc).getTime(),
  );

  const firstDay = startOfDay(sheetDateFromDoc(sorted[0].doc)).getTime();
  const lastDay = startOfDay(sheetDateFromDoc(sorted[sorted.length - 1].doc)).getTime();
  const isSingleDay = firstDay === lastDay && sheets.every(
    (s) => startOfDay(sheetDateFromDoc(s.doc)).getTime() === firstDay,
  );

  const firstBalances = resolveDrawerBalancesForSheet(sheets, sorted[0]);
  const lastBalances = resolveDrawerBalancesForSheet(sheets, sorted[sorted.length - 1]);

  return {
    periodOpening: firstBalances.openingCashBalance,
    periodClosing: lastBalances.closingCashBalance,
    isSingleDay,
    sheetCount: sheets.length,
  };
}
