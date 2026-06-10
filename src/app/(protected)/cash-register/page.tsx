'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Tab,
  Tabs,
  Avatar,
  Tooltip,
  Skeleton,
  Drawer,
  Toolbar,
  Divider,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowUpward as IncomeIcon,
  ArrowDownward as ExpenseIcon,
  AttachMoney as MoneyIcon,
  AccountBalance as BalanceIcon,
  Receipt as ReceiptIcon,
  Store as StoreIcon,
  Storefront as StorefrontIcon,
  Dashboard as DashboardIcon,
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { useCenterScope } from '@/hooks/useCenterScope';
import { resolveDataScope } from '@/lib/tenant/centerScope';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { v4 as uuidv4 } from 'uuid';
import { cashRegisterExpenseAmount } from '@/lib/cash-register/expenseOutflow';
import {
  type DailySheetDoc,
  type TodayDrawerSnapshot,
  buildTotalsPayload,
  computeAggregatedPeriodDrawerBalances,
  computeAggregatedTodayDrawerBalances,
  computeClosingCashBalance,
  computePeriodDrawerBalances,
  effectiveDrawerCashFromSnapshot,
  findLatestSheetForCenter,
  findSheetForCenterOnDate,
  getTodayDrawerSnapshot,
  netCashInForDay,
  normalizeSheetBalances,
  resolveDrawerBalancesForSheet,
  sheetDateFromDoc,
  suggestOpeningCashBalance,
} from '@/lib/cash-register/dailySheetBalances';
import { RADIUS_2XL } from '@/components/Layout/crm-theme';

const dialogPaperProps = { sx: { borderRadius: 2 } } as const;

const listPanelPaperSx = {
  mb: 2,
  borderRadius: RADIUS_2XL,
  overflow: 'hidden',
  border: 1,
  borderColor: 'divider',
  boxShadow: 'none',
  bgcolor: 'background.paper',
} as const;

const filterBarPaperSx = {
  mb: 2,
  p: 2,
  borderRadius: 2,
  border: 1,
  borderColor: 'divider',
  boxShadow: 'none',
  bgcolor: 'background.paper',
} as const;

const QUICK_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'prevWeek', label: 'Previous week' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
];

type CashInCategory = 'payment_record' | 'from_other_centers' | 'miscellaneous';
type CashOutCategory = 'handed_over' | 'expenses' | 'miscellaneous';
type TransactionCategory = CashInCategory | CashOutCategory;

interface DailyRow {
  id: string;
  partyName: string;
  itemDetails: string;
  quantity: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  amount: number;
  transactionCategory: TransactionCategory;
}

const CASH_IN_CATEGORIES: { value: CashInCategory; label: string }[] = [
  { value: 'payment_record', label: 'Payment Record' },
  { value: 'from_other_centers', label: 'From other centers' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

const CASH_OUT_CATEGORIES: { value: CashOutCategory; label: string }[] = [
  { value: 'handed_over', label: 'Handed over' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

const CASH_IN_CATEGORY_SET = new Set<string>(CASH_IN_CATEGORIES.map((c) => c.value));
const CASH_OUT_CATEGORY_SET = new Set<string>(CASH_OUT_CATEGORIES.map((c) => c.value));

const DEFAULT_CASH_IN_CATEGORY: CashInCategory = 'miscellaneous';
const DEFAULT_CASH_OUT_CATEGORY: CashOutCategory = 'miscellaneous';

function normalizeDailyRow(raw: Record<string, unknown>, direction: 'in' | 'out'): DailyRow {
  const pm = raw.paymentMethod;
  const paymentMethod: DailyRow['paymentMethod'] =
    pm === 'cash' || pm === 'card' || pm === 'upi' || pm === 'bank_transfer' || pm === 'cheque'
      ? pm
      : 'cash';
  const allowed = direction === 'in' ? CASH_IN_CATEGORY_SET : CASH_OUT_CATEGORY_SET;
  const tc = raw.transactionCategory;
  const transactionCategory: TransactionCategory =
    typeof tc === 'string' && allowed.has(tc) ? (tc as TransactionCategory) : direction === 'in' ? DEFAULT_CASH_IN_CATEGORY : DEFAULT_CASH_OUT_CATEGORY;
  return {
    id: typeof raw.id === 'string' ? raw.id : uuidv4(),
    partyName: String(raw.partyName ?? ''),
    itemDetails: String(raw.itemDetails ?? ''),
    quantity: Number(raw.quantity) || 0,
    paymentMethod,
    amount: Number(raw.amount) || 0,
    transactionCategory,
  };
}

function normalizeCashInRows(rows: unknown): DailyRow[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [{ id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0, transactionCategory: DEFAULT_CASH_IN_CATEGORY }];
  }
  return rows.map((r) => normalizeDailyRow(r as Record<string, unknown>, 'in'));
}

function normalizeCashOutRows(rows: unknown): DailyRow[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [{ id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0, transactionCategory: DEFAULT_CASH_OUT_CATEGORY }];
  }
  return rows.map((r) => normalizeDailyRow(r as Record<string, unknown>, 'out'));
}

function sumCategorizedCashOutExpenses(sheets: Array<{ doc: DailySheetDoc }>): number {
  let sum = 0;
  for (const s of sheets) {
    const rows = Array.isArray(s.doc.cashOut) ? s.doc.cashOut : [];
    for (const raw of rows) {
      sum += cashRegisterExpenseAmount(raw as Record<string, unknown>);
    }
  }
  return sum;
}

function labelForCashInCategory(c: TransactionCategory) {
  return CASH_IN_CATEGORIES.find((x) => x.value === c)?.label ?? 'Miscellaneous';
}

function labelForCashOutCategory(c: TransactionCategory) {
  return CASH_OUT_CATEGORIES.find((x) => x.value === c)?.label ?? 'Miscellaneous';
}

interface Center {
  id: string;
  name: string;
  isHeadOffice?: boolean;
  /** Optional; shown as muted sub-label on center cards when present in Firestore */
  address?: string;
  city?: string;
}

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfWeekMonday = (d: Date) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(d, diff));
};

/** Non-admins: only today and yesterday (local calendar). Admins: unrestricted. */
function isCashRegisterSheetVisibleForRole(sheetDate: Date, now: Date, admin: boolean): boolean {
  if (admin) return true;
  const d0 = startOfDay(sheetDate);
  const yesterday0 = startOfDay(addDays(startOfDay(now), -1));
  const today0 = startOfDay(now);
  return d0.getTime() >= yesterday0.getTime() && d0.getTime() <= today0.getTime();
}

/** Allowed entry/save dates for non-admin users (same window as visibility). */
function isCashRegisterEntryDateAllowedForNonAdmin(entryDate: Date, now: Date): boolean {
  return isCashRegisterSheetVisibleForRole(entryDate, now, false);
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function centerCardSublabel(c: Center): string {
  const parts = [c.address, c.city].filter((x) => typeof x === 'string' && x.trim().length > 0) as string[];
  return parts.join(' · ').trim();
}

const CashRegisterPage = () => {
  const theme = useTheme();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { effectiveScopeCenterId, allowedCenterIds, lockedCenterId } = useCenterScope();
  const router = useRouter();
  const isAdmin = userProfile?.role === 'admin';

  const [centers, setCenters] = useState<Center[]>([]);
  const [centersLoading, setCentersLoading] = useState(true);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);

  // 0 = center register, 1 = overall (admin only)
  const [activeTab, setActiveTab] = useState(0);

  const [allSheets, setAllSheets] = useState<Array<{ id: string; doc: DailySheetDoc }>>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Daily form state
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [cashInRows, setCashInRows] = useState<DailyRow[]>([
    { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0, transactionCategory: DEFAULT_CASH_IN_CATEGORY },
  ]);
  const [cashOutRows, setCashOutRows] = useState<DailyRow[]>([
    { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0, transactionCategory: DEFAULT_CASH_OUT_CATEGORY },
  ]);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [previewSheet, setPreviewSheet] = useState<{ id: string; doc: DailySheetDoc } | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<{ id: string; doc: DailySheetDoc } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [quickRangePreset, setQuickRangePreset] = useState('');
  const [entryDrawerOpen, setEntryDrawerOpen] = useState(false);
  const [openingCashBalance, setOpeningCashBalance] = useState(0);
  const [openingManuallyEdited, setOpeningManuallyEdited] = useState(false);
  const [carriedForwardFromDate, setCarriedForwardFromDate] = useState<Date | null>(null);
  const [sheetRemarks, setSheetRemarks] = useState('');

  // Date range filters
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  // --- Data loading ---
  useEffect(() => {
    if (authLoading || !user) return;
    const load = async () => {
      setCentersLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'centers'), orderBy('name')));
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Center[];
        setCenters(list);
      } catch (e) {
        console.error('Failed to load centers', e);
      } finally {
        setCentersLoading(false);
      }
    };
    load();
  }, [user, authLoading]);

  const loadAllSheets = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const snap = await getDocs(query(collection(db, 'cashDailySheets'), orderBy('date', 'desc')));
      const rows = snap.docs.map((d) => ({ id: d.id, doc: d.data() as DailySheetDoc }));
      setAllSheets(rows);
    } catch (e) {
      console.error('Failed to load daily sheets', e);
      setErrorMsg('Failed to load daily sheets');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    loadAllSheets();
  }, [user, authLoading, loadAllSheets]);

  const visibleCenters = useMemo(() => {
    const mode = resolveDataScope(effectiveScopeCenterId, allowedCenterIds);
    if (mode.type === 'global') return centers;
    if (mode.type === 'union') {
      return centers.filter((c) => mode.centerIds.includes(c.id));
    }
    return centers.filter((c) => c.id === mode.centerId);
  }, [centers, effectiveScopeCenterId, allowedCenterIds]);

  const scopedSheets = useMemo(() => {
    const mode = resolveDataScope(effectiveScopeCenterId, allowedCenterIds);
    if (mode.type === 'global') return allSheets;
    if (mode.type === 'union') {
      return allSheets.filter((s) => s.doc.centerId && mode.centerIds.includes(s.doc.centerId));
    }
    return allSheets.filter((s) => s.doc.centerId === mode.centerId);
  }, [allSheets, effectiveScopeCenterId, allowedCenterIds]);

  const registerVisibleSheets = useMemo(() => {
    const now = new Date();
    if (isAdmin) return scopedSheets;
    return scopedSheets.filter((s) => isCashRegisterSheetVisibleForRole(sheetDateFromDoc(s.doc), now, false));
  }, [scopedSheets, isAdmin]);

  useEffect(() => {
    if (!centers.length) return;
    const mode = resolveDataScope(effectiveScopeCenterId, allowedCenterIds);
    if (mode.type !== 'single') return;
    const c = centers.find((x) => x.id === mode.centerId);
    if (c) setSelectedCenter(c);
  }, [centers, effectiveScopeCenterId, allowedCenterIds]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  /** All sheets for the selected center (for summary cards — full history within CRM scope). */
  const centerSheetsAllTime = useMemo(() => {
    if (!selectedCenter) return [];
    return scopedSheets.filter((s) => {
      if (s.doc.centerId) return s.doc.centerId === selectedCenter.id;
      return false;
    });
  }, [scopedSheets, selectedCenter]);

  /** Saved-sheets table: admins see full center history; non-admins only today + yesterday. */
  const centerSheets = useMemo(() => {
    if (!selectedCenter) return [];
    return registerVisibleSheets.filter((s) => {
      if (s.doc.centerId) return s.doc.centerId === selectedCenter.id;
      return false; // legacy sheets without centerId don't belong to any center
    });
  }, [registerVisibleSheets, selectedCenter]);

  const latestSheetForSelectedCenter = useMemo(() => {
    if (!selectedCenter) return null;
    return findLatestSheetForCenter(centerSheetsAllTime, selectedCenter.id);
  }, [centerSheetsAllTime, selectedCenter]);

  const todayDrawerSnapshot = useMemo((): TodayDrawerSnapshot | null => {
    if (!selectedCenter) return null;
    return getTodayDrawerSnapshot(centerSheetsAllTime, selectedCenter.id, new Date());
  }, [centerSheetsAllTime, selectedCenter]);

  const sheetsForCenterChain = useCallback(
    (centerId: string | undefined) => {
      if (!centerId) return allSheets;
      return allSheets.filter((s) => s.doc.centerId === centerId);
    },
    [allSheets],
  );

  const suggestedOpeningForEntry = useMemo(() => {
    if (!selectedCenter) return { opening: 0, priorSheet: null as { id: string; doc: DailySheetDoc } | null };
    return suggestOpeningCashBalance(centerSheetsAllTime, selectedCenter.id, entryDate, editingSheetId);
  }, [selectedCenter, centerSheetsAllTime, entryDate, editingSheetId]);

  const hasPriorSheet = !!suggestedOpeningForEntry.priorSheet;

  const effectiveOpeningCashBalance = hasPriorSheet
    ? suggestedOpeningForEntry.opening
    : openingManuallyEdited
      ? Math.max(0, Number(openingCashBalance) || 0)
      : suggestedOpeningForEntry.opening;

  const syncOpeningFromPrior = useCallback(
    (date: Date) => {
      if (!selectedCenter) return;
      const { opening, priorSheet } = suggestOpeningCashBalance(
        centerSheetsAllTime,
        selectedCenter.id,
        date,
        editingSheetId,
      );
      setOpeningCashBalance(opening);
      setCarriedForwardFromDate(priorSheet ? sheetDateFromDoc(priorSheet.doc) : null);
      if (priorSheet) setOpeningManuallyEdited(false);
    },
    [selectedCenter, centerSheetsAllTime, editingSheetId],
  );

  useEffect(() => {
    if (!entryDrawerOpen || !selectedCenter) return;
    syncOpeningFromPrior(entryDate);
  }, [entryDate, entryDrawerOpen, selectedCenter, editingSheetId, syncOpeningFromPrior]);

  // --- Daily form helpers ---
  const addCashInRow = () =>
    setCashInRows((prev) => [
      ...prev,
      { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0, transactionCategory: DEFAULT_CASH_IN_CATEGORY },
    ]);
  const addCashOutRow = () =>
    setCashOutRows((prev) => [
      ...prev,
      { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0, transactionCategory: DEFAULT_CASH_OUT_CATEGORY },
    ]);
  const removeCashInRow = (id: string) => setCashInRows((prev) => prev.filter((r) => r.id !== id));
  const removeCashOutRow = (id: string) => setCashOutRows((prev) => prev.filter((r) => r.id !== id));

  const updateRow = (table: 'in' | 'out', id: string, patch: Partial<DailyRow>) => {
    const setter = table === 'in' ? setCashInRows : setCashOutRows;
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const dailyTotals = () => buildTotalsPayload(cashInRows, cashOutRows, effectiveOpeningCashBalance);

  const expectedClosingCash = () => {
    const t = dailyTotals();
    return t.closingCashBalance ?? computeClosingCashBalance(effectiveOpeningCashBalance, t.cashIn, t.cashOut);
  };

  const resetDailyForm = () => {
    setEntryDate(new Date());
    setCashInRows([{ id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0, transactionCategory: DEFAULT_CASH_IN_CATEGORY }]);
    setCashOutRows([{ id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0, transactionCategory: DEFAULT_CASH_OUT_CATEGORY }]);
    setEditingSheetId(null);
    setOpeningCashBalance(0);
    setOpeningManuallyEdited(false);
    setCarriedForwardFromDate(null);
    setSheetRemarks('');
  };

  const openNewDailyEntry = () => {
    resetDailyForm();
    if (selectedCenter) {
      syncOpeningFromPrior(new Date());
    }
    setEntryDrawerOpen(true);
  };

  const saveDailySheet = async () => {
    if (!selectedCenter) {
      setErrorMsg('Please select a center first');
      return;
    }
    if (!isAdmin && !isCashRegisterEntryDateAllowedForNonAdmin(entryDate, new Date())) {
      setErrorMsg('You can only save or update sheets for today and yesterday.');
      return;
    }
    const duplicate = findSheetForCenterOnDate(centerSheetsAllTime, selectedCenter.id, entryDate, editingSheetId);
    if (duplicate) {
      setErrorMsg(
        `A cash sheet already exists for ${selectedCenter.name} on ${entryDate.toLocaleDateString('en-IN')}. Edit that sheet instead.`,
      );
      return;
    }
    try {
      const { priorSheet } = suggestedOpeningForEntry;
      const opening = effectiveOpeningCashBalance;
      const totals = buildTotalsPayload(cashInRows, cashOutRows, opening);
      const openingSource = priorSheet ? 'carried_forward' : openingManuallyEdited ? 'manual' : 'carried_forward';
      const closingCashBalance = totals.closingCashBalance;
      const cashInNormalized = cashInRows.map((r) => normalizeDailyRow(r as unknown as Record<string, unknown>, 'in'));
      const cashOutNormalized = cashOutRows.map((r) => normalizeDailyRow(r as unknown as Record<string, unknown>, 'out'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        date: Timestamp.fromDate(entryDate),
        centerId: selectedCenter.id,
        centerName: selectedCenter.name,
        cashIn: cashInNormalized,
        cashOut: cashOutNormalized,
        openingCashBalance: opening,
        closingCashBalance,
        openingSource,
        remarks: sheetRemarks.trim(),
        totals,
        createdAt: Timestamp.now(),
      };
      if (editingSheetId) {
        await updateDoc(doc(db, 'cashDailySheets', editingSheetId), payload);
        setSuccessMsg('Daily cash sheet updated');
        setEditingSheetId(null);
      } else {
        await addDoc(collection(db, 'cashDailySheets'), payload);
        setSuccessMsg('Daily cash sheet saved');
      }
      resetDailyForm();
      setEntryDrawerOpen(false);
      await loadAllSheets();
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to save daily cash sheet');
    }
  };

  // --- Date range helpers ---
  const applyQuickRange = (type: string) => {
    const today = startOfDay(new Date());
    if (type === 'clear' || type === '') { setRangeStart(null); setRangeEnd(null); setQuickRangePreset(''); return; }
    setQuickRangePreset(type);
    if (type === 'today') { setRangeStart(today); setRangeEnd(endOfDay(today)); }
    else if (type === 'yesterday') { const y = addDays(today, -1); setRangeStart(startOfDay(y)); setRangeEnd(endOfDay(y)); }
    else if (type === 'last7') { setRangeStart(addDays(today, -6)); setRangeEnd(endOfDay(today)); }
    else if (type === 'last30') { setRangeStart(addDays(today, -29)); setRangeEnd(endOfDay(today)); }
    else if (type === 'thisMonth') { setRangeStart(startOfMonth(today)); setRangeEnd(endOfDay(today)); }
    else if (type === 'lastMonth') {
      const firstThis = startOfMonth(today);
      const lastMonthEnd = addDays(firstThis, -1);
      setRangeStart(startOfMonth(lastMonthEnd));
      setRangeEnd(endOfDay(lastMonthEnd));
    } else if (type === 'prevWeek') {
      const sw = startOfWeekMonday(today);
      setRangeStart(addDays(sw, -7));
      setRangeEnd(endOfDay(addDays(sw, -1)));
    }
  };

  const filterByRange = (sheets: typeof allSheets) => {
    if (!rangeStart || !rangeEnd) return sheets;
    return sheets.filter((s) => {
      const d = new Date(s.doc.date.seconds * 1000);
      return d >= startOfDay(rangeStart) && d <= endOfDay(rangeEnd);
    });
  };

  const computeTotals = (sheets: typeof allSheets) => {
    return sheets.reduce(
      (acc, s) => ({
        netIn: acc.netIn + (s.doc.totals.netIn || 0),
        netOut: acc.netOut + (s.doc.totals.netOut || 0),
        balance: acc.balance + (s.doc.totals.balance || 0),
        cashBalance: acc.cashBalance + (s.doc.totals.cashBalance || 0),
      }),
      { netIn: 0, netOut: 0, balance: 0, cashBalance: 0 }
    );
  };

  const confirmDeleteDailySheet = async () => {
    if (!sheetToDelete) return;
    setDeleteSubmitting(true);
    try {
      await deleteDoc(doc(db, 'cashDailySheets', sheetToDelete.id));
      if (editingSheetId === sheetToDelete.id) {
        setEditingSheetId(null);
        resetDailyForm();
      }
      setSheetToDelete(null);
      setSuccessMsg('Daily sheet deleted');
      await loadAllSheets();
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to delete daily sheet');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const headCellSx = useMemo(
    () => ({
      fontWeight: 600,
      bgcolor:
        theme.palette.mode === 'dark'
          ? alpha(theme.palette.common.white, 0.06)
          : theme.palette.grey[50],
      borderBottom: '1px solid',
      borderColor: 'divider',
      py: 1,
      px: 1.5,
      fontSize: '0.75rem',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      color: theme.palette.text.secondary,
    }),
    [theme],
  );

  // --- Render helpers ---
  const renderDateRangeControls = () => (
    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} flexWrap="wrap" useFlexGap>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker label="From" value={rangeStart} onChange={(d) => { setRangeStart(d); setQuickRangePreset(''); }} slotProps={{ textField: { size: 'small', variant: 'outlined', sx: { minWidth: 140 } } }} />
        <DatePicker label="To" value={rangeEnd} onChange={(d) => { setRangeEnd(d); setQuickRangePreset(''); }} slotProps={{ textField: { size: 'small', variant: 'outlined', sx: { minWidth: 140 } } }} />
      </LocalizationProvider>
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="cash-register-quick-range">Quick range</InputLabel>
        <Select
          variant="outlined"
          labelId="cash-register-quick-range"
          label="Quick range"
          value={quickRangePreset}
          onChange={(e) => {
            const v = e.target.value as string;
            applyQuickRange(v === '' ? 'clear' : v);
          }}
        >
          {QUICK_RANGE_OPTIONS.map((o) => (
            <MenuItem key={o.value || 'all'} value={o.value}>{o.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );

  const renderFilterBar = () => (
    <Paper elevation={0} sx={filterBarPaperSx}>
      {renderDateRangeControls()}
    </Paper>
  );

  const renderDrawerBalanceStrip = (opts: {
    opening: number;
    closing: number | null;
    closingNotSavedYet?: boolean;
    openingCaption?: string;
    closingCaption?: string;
    openingLabel?: string;
    closingLabel?: string;
  }) => (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.primary.main, 0.04),
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 2, sm: 4 }}
        divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {opts.openingLabel ?? 'Cash opening balance'}
          </Typography>
          {summaryLoading ? (
            <Skeleton variant="text" width="40%" height={36} sx={{ mt: 0.5 }} />
          ) : (
            <Typography variant="h5" fontWeight={800} sx={{ mt: 0.25, fontFeatureSettings: '"tnum"' }}>
              {formatCurrency(opts.opening)}
            </Typography>
          )}
          {opts.openingCaption && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {opts.openingCaption}
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {opts.closingLabel ?? 'Cash closing balance'}
          </Typography>
          {summaryLoading ? (
            <Skeleton variant="text" width="40%" height={36} sx={{ mt: 0.5 }} />
          ) : (
            <Typography variant="h5" fontWeight={800} sx={{ mt: 0.25, fontFeatureSettings: '"tnum"', color: 'primary.main' }}>
              {opts.closingNotSavedYet ? 'Not saved yet' : formatCurrency(opts.closing ?? opts.opening)}
            </Typography>
          )}
          {opts.closingCaption && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {opts.closingCaption}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );

  const renderSummaryCards = (
    totals: { netIn: number; netOut: number; balance: number; cashBalance: number },
    options?: {
      adminExpenseTotal?: number;
      showDrawerBalances?: boolean;
      showTodayDrawer?: boolean;
      todayDrawer?: TodayDrawerSnapshot | null;
      drawerBalances?: { periodOpening: number; periodClosing: number; isSingleDay: boolean; sheetCount: number };
    },
  ) => {
    const today = options?.todayDrawer;
    const period = options?.drawerBalances;
    const periodCaption =
      period && period.sheetCount > 0 && !period.isSingleDay
        ? 'First sheet opening → last sheet closing in range'
        : undefined;

    const mdSpan = options?.adminExpenseTotal !== undefined ? 2 : 3;
    const singleCardSpan = 12;
    const cardMdSpan = mdSpan;

    const drawerStrip =
      today && (options?.showDrawerBalances || options?.showTodayDrawer) ? (
        renderDrawerBalanceStrip({
          opening: today.opening,
          closing: today.closing,
          closingNotSavedYet: today.closingNotSavedYet,
          openingCaption: today.priorSheetDate
            ? `Same as ${today.priorSheetDate.toLocaleDateString('en-IN')} closing cash balance`
            : 'Start of today',
          closingCaption: today.closingNotSavedYet
            ? "Save today's sheet after cash in/out"
            : 'End of today in drawer',
        })
      ) : period && period.sheetCount > 0 && !options?.showDrawerBalances ? (
        renderDrawerBalanceStrip({
          opening: period.periodOpening,
          closing: period.periodClosing,
          openingLabel: period.isSingleDay ? 'Cash opening balance' : 'Period cash opening',
          closingLabel: period.isSingleDay ? 'Cash closing balance' : 'Period cash closing',
          openingCaption: periodCaption,
          closingCaption: periodCaption,
        })
      ) : null;

    const cards: Array<{
      label: string;
      value: number;
      valueDisplay?: string;
      icon: React.ReactElement;
      accent: string;
      iconBg: string;
      iconColor: string;
      valueColor: string;
      caption?: string;
    }> = [];

    const drawerCashBalance =
      today && (options?.showDrawerBalances || options?.showTodayDrawer)
        ? effectiveDrawerCashFromSnapshot(today)
        : period && period.sheetCount > 0
          ? period.periodClosing
          : null;

    if (!options?.showDrawerBalances) {
      cards.push(
        {
          label: 'Balance',
          value: totals.balance,
          icon: <BalanceIcon />,
          accent: theme.palette.primary.main,
          iconBg: alpha(theme.palette.primary.main, 0.14),
          iconColor: theme.palette.primary.main,
          valueColor: theme.palette.text.primary,
        },
        {
          label: 'Net In',
          value: totals.netIn,
          icon: <IncomeIcon />,
          accent: theme.palette.success.main,
          iconBg: alpha(theme.palette.success.main, 0.14),
          iconColor: theme.palette.success.dark,
          valueColor: theme.palette.success.dark,
        },
        {
          label: 'Net Out',
          value: totals.netOut,
          icon: <ExpenseIcon />,
          accent: theme.palette.error.main,
          iconBg: alpha(theme.palette.error.main, 0.12),
          iconColor: theme.palette.error.main,
          valueColor: theme.palette.error.main,
        },
        {
          label: 'Cash balance',
          value: drawerCashBalance ?? totals.cashBalance,
          icon: <MoneyIcon />,
          accent: theme.palette.info.main,
          iconBg: alpha(theme.palette.info.main, 0.14),
          iconColor: theme.palette.info.dark,
          valueColor: theme.palette.info.dark,
          caption: drawerCashBalance != null ? 'Closing cash in drawer' : undefined,
        },
      );
    }

    if (options?.adminExpenseTotal !== undefined) {
      cards.push({
        label: 'Expenses (categorized)',
        value: options.adminExpenseTotal,
        icon: <ExpenseIcon />,
        accent: theme.palette.warning.main,
        iconBg: alpha(theme.palette.warning.main, 0.18),
        iconColor: theme.palette.warning.dark,
        valueColor: theme.palette.warning.dark,
        caption: 'Cash out lines tagged Expenses',
      });
    }
    const visibleCards = cards;
    return (
      <Box mb={3}>
        {drawerStrip}
        {visibleCards.length > 0 && (
      <Grid container spacing={2}>
        {visibleCards.map((card) => (
          <Grid key={card.label} sx={{ gridColumn: { xs: `span ${singleCardSpan}`, sm: `span ${singleCardSpan}`, md: `span ${cardMdSpan}` } }}>
            <Card
              elevation={2}
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                borderTop: '4px solid',
                borderTopColor: card.accent,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" alignItems="flex-start" spacing={2}>
                  <Avatar
                    sx={{
                      width: 44,
                      height: 44,
                      bgcolor: card.iconBg,
                      color: card.iconColor,
                    }}
                  >
                    {React.cloneElement(card.icon as React.ReactElement<{ sx?: object }>, { sx: { fontSize: 22 } })}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em', lineHeight: 1.2 }}>
                      {card.label}
                    </Typography>
                    {summaryLoading ? (
                      <Skeleton variant="rounded" width="70%" height={40} sx={{ mt: 1 }} />
                    ) : (
                      <Typography
                        variant="h4"
                        fontWeight={800}
                        sx={{
                          color: card.valueColor,
                          letterSpacing: '-0.03em',
                          lineHeight: 1.15,
                          mt: 0.5,
                          fontFeatureSettings: card.valueDisplay ? undefined : '"tnum"',
                        }}
                      >
                        {card.valueDisplay ?? formatCurrency(card.value)}
                      </Typography>
                    )}
                    {card.caption && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {card.caption}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
        )}
      </Box>
    );
  };

  const lineGridFields = {
    gap: 2,
    gridTemplateColumns: {
      xs: '1fr',
      sm: 'repeat(2, minmax(0, 1fr))',
      md: 'minmax(0, 1.1fr) minmax(0, 1.1fr) 88px minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 0.95fr) 44px',
    },
    alignItems: 'start' as const,
  };

  const renderDailyTable = (rows: DailyRow[], table: 'in' | 'out') => {
    const isIn = table === 'in';
    const addRow = isIn ? addCashInRow : addCashOutRow;
    const removeRow = isIn ? removeCashInRow : removeCashOutRow;
    const totals = dailyTotals();
    const net = isIn ? totals.netIn : totals.netOut;
    const cashOnly = isIn ? totals.cashIn : totals.cashOut;
    const accent = isIn ? theme.palette.success.main : theme.palette.error.main;
    const accentSoft = isIn ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1);

    return (
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            px: 2,
            py: 1.5,
            mb: 2,
            borderRadius: 2,
            bgcolor: accentSoft,
            borderLeft: '4px solid',
            borderLeftColor: accent,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: accent, letterSpacing: '-0.01em' }}>
            {isIn ? 'Cash In' : 'Cash Out'}
          </Typography>
        </Box>

        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            ...lineGridFields,
            px: 2,
            py: 1,
            mb: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {isIn ? 'Receipt From' : 'Cash To'}
          </Typography>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Item Details
          </Typography>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Qty
          </Typography>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Mode of Payment
          </Typography>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Category
          </Typography>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
            Amount
          </Typography>
          <Box />
        </Box>

        <Stack spacing={1.5}>
          {rows.map((r) => (
            <Box
              key={r.id}
              sx={{
                display: 'grid',
                ...lineGridFields,
                p: 2,
                borderRadius: 2,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                '&:hover': {
                  borderColor: alpha(accent, 0.45),
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
                },
                '& .MuiInputBase-root': { fontSize: '0.8125rem', bgcolor: 'background.paper' },
              }}
            >
              <TextField variant="outlined" size="small" fullWidth placeholder={isIn ? 'From whom' : 'To whom'} value={r.partyName} onChange={(e) => updateRow(table, r.id, { partyName: e.target.value })} />
              <TextField variant="outlined" size="small" fullWidth placeholder="Item details" value={r.itemDetails} onChange={(e) => updateRow(table, r.id, { itemDetails: e.target.value })} />
              <TextField variant="outlined" size="small" type="number" value={r.quantity} onChange={(e) => updateRow(table, r.id, { quantity: Number(e.target.value) || 0 })} />
              <FormControl fullWidth size="small">
                <Select variant="outlined" value={r.paymentMethod} onChange={(e) => updateRow(table, r.id, { paymentMethod: e.target.value as DailyRow['paymentMethod'] })}>
                  {paymentMethods.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <Select
                  variant="outlined"
                  value={isIn ? (CASH_IN_CATEGORY_SET.has(r.transactionCategory) ? r.transactionCategory : DEFAULT_CASH_IN_CATEGORY) : (CASH_OUT_CATEGORY_SET.has(r.transactionCategory) ? r.transactionCategory : DEFAULT_CASH_OUT_CATEGORY)}
                  onChange={(e) =>
                    updateRow(table, r.id, { transactionCategory: e.target.value as TransactionCategory })
                  }
                >
                  {(isIn ? CASH_IN_CATEGORIES : CASH_OUT_CATEGORIES).map((c) => (
                    <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField variant="outlined" size="small" type="number" value={r.amount} onChange={(e) => updateRow(table, r.id, { amount: Number(e.target.value) || 0 })} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', pt: { xs: 0, md: 0.5 } }}>
                <Tooltip title="Remove line">
                  <IconButton size="small" color="error" onClick={() => removeRow(r.id)} aria-label="Remove line">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={addRow} size="small" sx={{ textTransform: 'none', fontWeight: 600 }}>
            Add Row
          </Button>
        </Box>

        <Stack spacing={1} sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" fontWeight={700}>Net Amount {isIn ? 'In' : 'Out'}</Typography>
            <Typography variant="body2" fontWeight={800} sx={{ fontFeatureSettings: '"tnum"' }}>{formatCurrency(net)}</Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">{isIn ? 'Received' : 'Spent'} via Cash</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ fontFeatureSettings: '"tnum"' }}>{formatCurrency(cashOnly)}</Typography>
          </Stack>
        </Stack>
      </Box>
    );
  };

  const renderOpeningBalanceSection = () => {
    const t = dailyTotals();
    const closing = expectedClosingCash();
    const helperText = hasPriorSheet && carriedForwardFromDate
      ? `Carried from ${carriedForwardFromDate.toLocaleDateString('en-IN')} closing cash balance`
      : 'First sheet for this center — set the starting cash in drawer';

    const formulaParts: string[] = [formatCurrency(effectiveOpeningCashBalance)];
    if (t.cashIn > 0) formulaParts.push(`+ ${formatCurrency(t.cashIn)} received`);
    if (t.cashOut > 0) formulaParts.push(`− ${formatCurrency(t.cashOut)} paid`);
    const formulaLine =
      t.cashOut > 0 && t.cashIn === 0
        ? `${formatCurrency(effectiveOpeningCashBalance)} − ${formatCurrency(t.cashOut)} = ${formatCurrency(closing)}`
        : `${formulaParts.join(' ')} = ${formatCurrency(closing)}`;

    const statementRow = (label: string, value: string, opts?: { bold?: boolean; success?: boolean }) => (
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {label}
        </Typography>
        <Typography
          variant="body1"
          fontWeight={opts?.bold ? 800 : 600}
          sx={{
            fontFeatureSettings: '"tnum"',
            color: opts?.success ? 'success.main' : 'text.primary',
          }}
        >
          {value}
        </Typography>
      </Stack>
    );

    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, letterSpacing: '-0.01em' }}>
          Daily cash balance
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          Cash payment lines only — card/UPI do not change drawer balance
        </Typography>

        <TextField
          variant="outlined"
          size="small"
          fullWidth
          type="number"
          label="Cash opening balance"
          value={effectiveOpeningCashBalance}
          onChange={(e) => {
            if (hasPriorSheet) return;
            setOpeningCashBalance(Math.max(0, Number(e.target.value) || 0));
            setOpeningManuallyEdited(true);
          }}
          inputProps={{ min: 0, step: 1, readOnly: hasPriorSheet }}
          InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
          helperText={helperText}
          sx={{ mb: 1.5 }}
        />

        <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', px: 2 }}>
          {statementRow('Cash opening balance', formatCurrency(effectiveOpeningCashBalance))}
          {statementRow('Net cash in (today)', formatCurrency(t.cashIn - t.cashOut), {
            success: t.cashIn - t.cashOut >= 0,
          })}
          {statementRow('Cash received today', formatCurrency(t.cashIn))}
          {statementRow('Cash paid today', formatCurrency(t.cashOut))}
          {statementRow('Cash closing balance', formatCurrency(closing), { bold: true, success: true })}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
          {formulaLine}
        </Typography>
      </Paper>
    );
  };

  const renderEntryDrawer = () => (
    <Drawer
      anchor="right"
      open={entryDrawerOpen}
      onClose={() => setEntryDrawerOpen(false)}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 640, md: 880, lg: 1024 },
          maxWidth: '100vw',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="h6" fontWeight={800} letterSpacing="-0.02em">
              Daily cash entry
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Record cash in and out, then save as a daily sheet
            </Typography>
          </Box>
          <IconButton aria-label="Close" onClick={() => setEntryDrawerOpen(false)} edge="end" sx={{ mt: -0.5 }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Entry date"
            value={entryDate}
            onChange={(d) => {
              if (!d) return;
              setEntryDate(d);
              syncOpeningFromPrior(d);
            }}
            slotProps={{ textField: { size: 'small', variant: 'outlined', fullWidth: true } }}
          />
        </LocalizationProvider>
        <Divider sx={{ my: 2 }} />
        {renderOpeningBalanceSection()}
        {renderDailyTable(cashInRows, 'in')}
        {renderDailyTable(cashOutRows, 'out')}
        <Divider sx={{ my: 2 }} />
        <TextField
          variant="outlined"
          size="small"
          fullWidth
          multiline
          minRows={3}
          maxRows={8}
          label="Remarks"
          placeholder="Notes for this day (optional)"
          value={sheetRemarks}
          onChange={(e) => setSheetRemarks(e.target.value)}
        />
      </Box>

      <Paper
        elevation={8}
        square
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="flex-end">
          <Stack direction="row" flexWrap="wrap" gap={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
            <Chip label={`Cash opening: ${formatCurrency(effectiveOpeningCashBalance)}`} variant="outlined" size="small" />
            <Chip
              label={`Net cash in: ${formatCurrency(dailyTotals().cashIn - dailyTotals().cashOut)}`}
              variant="outlined"
              size="small"
            />
            <Chip label={`Received: ${formatCurrency(dailyTotals().cashIn)}`} variant="outlined" size="small" color="success" />
            <Chip label={`Paid: ${formatCurrency(dailyTotals().cashOut)}`} variant="outlined" size="small" color="error" />
            <Chip
              label={`Cash closing: ${formatCurrency(expectedClosingCash())}`}
              color={expectedClosingCash() >= 0 ? 'success' : 'error'}
              variant="outlined"
              size="small"
            />
          </Stack>
          <Button variant="contained" onClick={saveDailySheet} startIcon={<ReceiptIcon />} sx={{ textTransform: 'none', fontWeight: 700, px: 3, py: 1.25 }}>
            {editingSheetId ? 'Update sheet' : 'Save daily sheet'}
          </Button>
        </Stack>
      </Paper>
    </Drawer>
  );

  const renderSavedSheetsTable = (
    sheets: typeof allSheets,
    opts?: {
      omitSummary?: boolean;
      omitFilterBar?: boolean;
      todayDrawer?: TodayDrawerSnapshot | null;
    },
  ) => {
    const tableFiltered = isAdmin ? filterByRange(sheets) : sheets;
    const totalsFiltered = isAdmin ? filterByRange(sheets) : [];
    const totals = computeTotals(totalsFiltered.length > 0 ? totalsFiltered : sheets);
    const todayDrawer = opts?.todayDrawer ?? null;
    const periodDrawerBalances =
      isAdmin && tableFiltered.length > 0
        ? computePeriodDrawerBalances(
            tableFiltered,
            selectedCenter ? sheetsForCenterChain(selectedCenter.id) : tableFiltered,
          )
        : undefined;

    return (
      <>
        {!opts?.omitSummary &&
          renderSummaryCards(totals, {
            showDrawerBalances: !isAdmin,
            showTodayDrawer: isAdmin && !!todayDrawer && !rangeStart,
            todayDrawer: rangeStart ? null : todayDrawer,
            drawerBalances: periodDrawerBalances,
          })}
        {!opts?.omitFilterBar &&
          (isAdmin ? (
            renderFilterBar()
          ) : (
            <Paper elevation={0} sx={filterBarPaperSx}>
              <Typography variant="body2" color="text.secondary">
                Showing today and yesterday only.
              </Typography>
            </Paper>
          ))}
        <Paper elevation={0} sx={listPanelPaperSx}>
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <HistoryIcon fontSize="small" color="primary" />
              <Typography variant="subtitle1" fontWeight={800} letterSpacing="-0.01em">
                Saved daily sheets
              </Typography>
            </Stack>
          </Box>
          <TableContainer sx={{ maxHeight: 560, overflowX: 'auto' }}>
            <Table size="small" stickyHeader sx={{ minWidth: 1100, '& .MuiTableCell-root': { py: 0.75, px: 1.5, fontSize: '0.8125rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCellSx}>Date</TableCell>
                  {activeTab === 1 && <TableCell sx={headCellSx}>Center</TableCell>}
                  <TableCell sx={headCellSx} align="right">Cash opening</TableCell>
                  <TableCell sx={headCellSx} align="right">Cash closing</TableCell>
                  <TableCell sx={headCellSx} align="right">Net cash in</TableCell>
                  <TableCell sx={headCellSx} align="right">Net In</TableCell>
                  <TableCell sx={headCellSx} align="right">Net Out</TableCell>
                  <TableCell sx={headCellSx} align="right">Cash In</TableCell>
                  <TableCell sx={headCellSx} align="right">Cash Out</TableCell>
                  <TableCell sx={headCellSx}>Remarks</TableCell>
                  <TableCell sx={headCellSx} align="right" width={140}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableFiltered.map((s) => {
                  const bal = resolveDrawerBalancesForSheet(sheetsForCenterChain(s.doc.centerId), s);
                  return (
                  <TableRow
                    key={s.id}
                    hover
                    sx={{
                      transition: 'background-color 0.15s ease',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                    }}
                  >
                    <TableCell>{new Date(s.doc.date.seconds * 1000).toLocaleDateString('en-IN')}</TableCell>
                    {activeTab === 1 && <TableCell><Chip label={s.doc.centerName || 'Legacy'} size="small" /></TableCell>}
                    <TableCell align="right">{formatCurrency(bal.openingCashBalance)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(bal.closingCashBalance)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency(netCashInForDay(s.doc))}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(s.doc.totals.netIn)}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main' }}>{formatCurrency(s.doc.totals.netOut)}</TableCell>
                    <TableCell align="right">{formatCurrency(s.doc.totals.cashIn)}</TableCell>
                    <TableCell align="right">{formatCurrency(s.doc.totals.cashOut)}</TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      {s.doc.remarks?.trim() ? (
                        <Tooltip title={s.doc.remarks.trim()}>
                          <Typography variant="body2" noWrap>
                            {s.doc.remarks.trim()}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Preview">
                        <IconButton size="small" color="primary" onClick={() => setPreviewSheet(s)} aria-label="Preview sheet">
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {activeTab === 0 && (
                        <Tooltip title="Edit sheet">
                          <IconButton
                            size="small"
                            color="success"
                            aria-label="Edit sheet"
                            onClick={() => {
                              const sd = sheetDateFromDoc(s.doc);
                              if (!isAdmin && !isCashRegisterSheetVisibleForRole(sd, new Date(), false)) {
                                setErrorMsg('You can only edit cash sheets for today or yesterday.');
                                return;
                              }
                              const sheetDate = new Date(s.doc.date.seconds * 1000);
                              setEntryDate(sheetDate);
                              setCashInRows(normalizeCashInRows(s.doc.cashIn));
                              setCashOutRows(normalizeCashOutRows(s.doc.cashOut));
                              setOpeningManuallyEdited(false);
                              setCarriedForwardFromDate(null);
                              setSheetRemarks(typeof s.doc.remarks === 'string' ? s.doc.remarks : '');
                              setEditingSheetId(s.id);
                              setEntryDrawerOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {isAdmin && (
                        <Tooltip title="Delete sheet">
                          <IconButton size="small" color="error" aria-label="Delete sheet" onClick={() => setSheetToDelete(s)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
                {tableFiltered.length === 0 && (
                  <TableRow><TableCell colSpan={activeTab === 1 ? 11 : 10} align="center" sx={{ py: 3 }}>No daily sheets found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </>
    );
  };

  const renderDeleteSheetDialog = () => {
    const d = sheetToDelete?.doc;
    const dateStr = d ? new Date(d.date.seconds * 1000).toLocaleDateString('en-IN') : '';
    return (
      <Dialog
        open={!!sheetToDelete}
        onClose={() => !deleteSubmitting && setSheetToDelete(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={dialogPaperProps}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <DeleteIcon /> Delete daily sheet
        </DialogTitle>
        <DialogContent>
          {sheetToDelete && (
            <>
              <Typography variant="body1" gutterBottom>
                Delete this saved daily sheet? This cannot be undone.
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary', typography: 'body2' }}>
                <li>Date: <Box component="span" fontWeight={600} color="text.primary">{dateStr}</Box></li>
                {d?.centerName ? (
                  <li>Center: <Box component="span" fontWeight={600} color="text.primary">{d.centerName}</Box></li>
                ) : null}
                <li>Cash opening: <Box component="span" fontWeight={600} color="text.primary">{formatCurrency(sheetToDelete ? resolveDrawerBalancesForSheet(sheetsForCenterChain(sheetToDelete.doc.centerId), sheetToDelete).openingCashBalance : 0)}</Box></li>
                <li>Cash closing: <Box component="span" fontWeight={600} color="text.primary">{formatCurrency(sheetToDelete ? resolveDrawerBalancesForSheet(sheetsForCenterChain(sheetToDelete.doc.centerId), sheetToDelete).closingCashBalance : 0)}</Box></li>
                {d?.remarks?.trim() ? (
                  <li>Remarks: <Box component="span" fontWeight={600} color="text.primary">{d.remarks.trim()}</Box></li>
                ) : null}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={() => setSheetToDelete(null)} disabled={deleteSubmitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmDeleteDailySheet}
            disabled={deleteSubmitting}
            startIcon={deleteSubmitting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderPreviewDialog = () => (
    <Drawer
      anchor="right"
      open={!!previewSheet}
      onClose={() => setPreviewSheet(null)}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 640, md: 880, lg: 1024 },
          maxWidth: '100vw',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700}>Daily sheet</Typography>
              {previewSheet && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {new Date(previewSheet.doc.date.seconds * 1000).toLocaleDateString('en-IN')}
                </Typography>
              )}
              {previewSheet?.doc.centerName && (
                <Box sx={{ mt: 1 }}>
                  <Chip label={previewSheet.doc.centerName} size="small" />
                </Box>
              )}
            </Box>
            <IconButton aria-label="Close" onClick={() => setPreviewSheet(null)} size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
          {previewSheet && (() => {
            const bal = resolveDrawerBalancesForSheet(
              sheetsForCenterChain(previewSheet.doc.centerId),
              previewSheet,
            );
            return (
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>
              <Chip label={`Cash opening: ${formatCurrency(bal.openingCashBalance)}`} variant="outlined" size="small" />
              <Chip label={`Cash closing: ${formatCurrency(bal.closingCashBalance)}`} color="primary" variant="outlined" size="small" />
              <Chip label={`Net cash in: ${formatCurrency(netCashInForDay(previewSheet.doc))}`} variant="outlined" size="small" />
              <Chip label={`Net In: ${formatCurrency(previewSheet.doc.totals.netIn)}`} color="success" variant="outlined" size="small" />
              <Chip label={`Net Out: ${formatCurrency(previewSheet.doc.totals.netOut)}`} color="error" variant="outlined" size="small" />
              <Chip label={`Cash In: ${formatCurrency(previewSheet.doc.totals.cashIn)}`} variant="outlined" size="small" />
              <Chip label={`Cash Out: ${formatCurrency(previewSheet.doc.totals.cashOut)}`} variant="outlined" size="small" />
            </Stack>
            );
          })()}
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', overflowX: 'auto', p: 2 }}>
          {previewSheet && (
            <Stack spacing={2} sx={{ minWidth: 0 }}>
              {previewSheet.doc.remarks?.trim() ? (
                <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Remarks
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                    {previewSheet.doc.remarks.trim()}
                  </Typography>
                </Paper>
              ) : null}
              <Card elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'success.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cash In</Typography>
                  <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.8125rem' } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={headCellSx}>Receipt From</TableCell>
                          <TableCell sx={headCellSx}>Item Details</TableCell>
                          <TableCell sx={headCellSx}>Qty</TableCell>
                          <TableCell sx={headCellSx}>Mode</TableCell>
                          <TableCell sx={headCellSx}>Category</TableCell>
                          <TableCell sx={headCellSx} align="right">Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewSheet.doc.cashIn.map((r, idx) => {
                          const n = normalizeDailyRow(r as Record<string, unknown>, 'in');
                          return (
                            <TableRow key={idx}>
                              <TableCell>{n.partyName}</TableCell>
                              <TableCell>{n.itemDetails}</TableCell>
                              <TableCell>{n.quantity}</TableCell>
                              <TableCell>{paymentMethods.find((m) => m.value === n.paymentMethod)?.label || n.paymentMethod}</TableCell>
                              <TableCell>{labelForCashInCategory(n.transactionCategory)}</TableCell>
                              <TableCell align="right">{formatCurrency(n.amount)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
              <Card elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ mb: 1.5, color: 'error.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cash Out</Typography>
                  <TableContainer sx={{ border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1, fontSize: '0.8125rem' } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={headCellSx}>Cash To</TableCell>
                          <TableCell sx={headCellSx}>Item Details</TableCell>
                          <TableCell sx={headCellSx}>Qty</TableCell>
                          <TableCell sx={headCellSx}>Mode</TableCell>
                          <TableCell sx={headCellSx}>Category</TableCell>
                          <TableCell sx={headCellSx} align="right">Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewSheet.doc.cashOut.map((r, idx) => {
                          const n = normalizeDailyRow(r as Record<string, unknown>, 'out');
                          return (
                            <TableRow key={idx}>
                              <TableCell>{n.partyName}</TableCell>
                              <TableCell>{n.itemDetails}</TableCell>
                              <TableCell>{n.quantity}</TableCell>
                              <TableCell>{paymentMethods.find((m) => m.value === n.paymentMethod)?.label || n.paymentMethod}</TableCell>
                              <TableCell>{labelForCashOutCategory(n.transactionCategory)}</TableCell>
                              <TableCell align="right">{formatCurrency(n.amount)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Stack>
          )}
        </Box>
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Button variant="text" onClick={() => setPreviewSheet(null)}>Close</Button>
        </Box>
      </Box>
    </Drawer>
  );

  // --- Overall admin view ---
  const renderOverallDashboard = () => {
    const rangeFiltered = filterByRange(scopedSheets);
    const overall = computeTotals(rangeFiltered);
    const hasDateRange = !!(rangeStart || rangeEnd);
    const chainSheets = scopedSheets;

    const byCenterId = new Map<string, { centerName: string; sheets: typeof allSheets }>();
    rangeFiltered.forEach((s) => {
      const cId = s.doc.centerId || '__legacy__';
      const cName = s.doc.centerName || 'Unassigned (Legacy)';
      if (!byCenterId.has(cId)) byCenterId.set(cId, { centerName: cName, sheets: [] });
      byCenterId.get(cId)!.sheets.push(s);
    });

    const centerSummaries = visibleCenters
      .map((c) => {
        const sheets = rangeFiltered.filter((s) => s.doc.centerId === c.id);
        const movement = computeTotals(sheets);
        const centerChain = chainSheets.filter((s) => s.doc.centerId === c.id);
        const drawer = hasDateRange
          ? computePeriodDrawerBalances(sheets, centerChain)
          : (() => {
              const snap = getTodayDrawerSnapshot(centerChain, c.id, new Date());
              return {
                periodOpening: snap.opening,
                periodClosing: effectiveDrawerCashFromSnapshot(snap),
                sheetCount: sheets.length,
              };
            })();
        return {
          centerId: c.id,
          centerName: c.name,
          ...movement,
          periodOpening: drawer.periodOpening,
          periodClosing: drawer.periodClosing,
          sheetCount: drawer.sheetCount ?? sheets.length,
        };
      })
      .concat(
        Array.from(byCenterId.entries())
          .filter(([cId]) => cId === '__legacy__' || !visibleCenters.some((c) => c.id === cId))
          .map(([cId, { centerName, sheets }]) => {
            const movement = computeTotals(sheets);
            const drawer = hasDateRange
              ? computePeriodDrawerBalances(sheets, sheets)
              : {
                  periodOpening: 0,
                  periodClosing: 0,
                  sheetCount: sheets.length,
                };
            return {
              centerId: cId,
              centerName,
              ...movement,
              periodOpening: drawer.periodOpening,
              periodClosing: drawer.periodClosing,
              sheetCount: sheets.length,
            };
          }),
      )
      .sort((a, b) => a.centerName.localeCompare(b.centerName));

    const categorizedExpensesTotal = sumCategorizedCashOutExpenses(rangeFiltered);
    const overallDrawer = hasDateRange
      ? computeAggregatedPeriodDrawerBalances(rangeFiltered, chainSheets)
      : (() => {
          const todayAgg = computeAggregatedTodayDrawerBalances(
            chainSheets,
            visibleCenters.map((c) => c.id),
          );
          return {
            periodOpening: todayAgg.periodOpening,
            periodClosing: todayAgg.periodClosing,
            isSingleDay: true,
            sheetCount: rangeFiltered.length,
            centerCount: todayAgg.centerCount,
          };
        })();

    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={1} letterSpacing="-0.02em">Overall cash register</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Aggregated totals and per-center breakdown for the selected date range
        </Typography>

        {renderSummaryCards(overall, { adminExpenseTotal: categorizedExpensesTotal, drawerBalances: overallDrawer })}

        {renderFilterBar()}

        <Paper elevation={0} sx={listPanelPaperSx}>
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
            <Typography variant="subtitle1" fontWeight={800} letterSpacing="-0.01em">
              Center-wise summary
            </Typography>
          </Box>
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader sx={{ '& .MuiTableCell-root': { py: 0.75, px: 1.5, fontSize: '0.8125rem' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={headCellSx}>Center</TableCell>
                  <TableCell sx={headCellSx} align="right">Sheets</TableCell>
                  <TableCell sx={headCellSx} align="right">Period opening</TableCell>
                  <TableCell sx={headCellSx} align="right">Period closing</TableCell>
                  <TableCell sx={headCellSx} align="right">Net In</TableCell>
                  <TableCell sx={headCellSx} align="right">Net Out</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {centerSummaries.map((cs) => (
                  <TableRow
                    key={cs.centerId}
                    hover
                    sx={{
                      transition: 'background-color 0.15s ease',
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                    }}
                  >
                    <TableCell><Chip icon={<StoreIcon />} label={cs.centerName} size="small" variant="outlined" /></TableCell>
                    <TableCell align="right">{cs.sheetCount}</TableCell>
                    <TableCell align="right">{formatCurrency(cs.periodOpening)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(cs.periodClosing)}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(cs.netIn)}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main' }}>{formatCurrency(cs.netOut)}</TableCell>
                  </TableRow>
                ))}
                {centerSummaries.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No data found</TableCell></TableRow>
                )}
                {centerSummaries.length > 0 && (
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Total (All Centers)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{rangeFiltered.length}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatCurrency(centerSummaries.reduce((s, c) => s + c.periodOpening, 0))}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatCurrency(centerSummaries.reduce((s, c) => s + c.periodClosing, 0))}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(overall.netIn)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>{formatCurrency(overall.netOut)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {renderSavedSheetsTable(scopedSheets, { omitSummary: true, omitFilterBar: true })}
      </Box>
    );
  };

  // --- Center Register view (entry + sheets for selected center) ---
  const renderCenterRegister = () => {
    return (
      <Box>
        <Toolbar
          disableGutters
          variant="dense"
          sx={{
            minHeight: 48,
            mb: 2,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: 1.5,
            bgcolor: 'transparent',
          }}
        >
          {!lockedCenterId && (
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => { setSelectedCenter(null); resetDailyForm(); setEntryDrawerOpen(false); }} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Change center
            </Button>
          )}
          <Stack alignItems="flex-end" spacing={0.5}>
            <Chip icon={<StoreIcon />} label={selectedCenter?.name} color="primary" variant="outlined" sx={{ fontWeight: 700, borderWidth: 2 }} />
            {latestSheetForSelectedCenter && (() => {
              const bal = resolveDrawerBalancesForSheet(
                sheetsForCenterChain(latestSheetForSelectedCenter.doc.centerId),
                latestSheetForSelectedCenter,
              );
              const d = sheetDateFromDoc(latestSheetForSelectedCenter.doc);
              return (
                <Typography variant="caption" color="text.secondary">
                  Prior closing cash balance: {formatCurrency(bal.closingCashBalance)} ({d.toLocaleDateString('en-IN')}) — today&apos;s opening
                </Typography>
              );
            })()}
          </Stack>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openNewDailyEntry}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Daily cash entry
          </Button>
        </Toolbar>

        {renderSavedSheetsTable(centerSheets, { todayDrawer: todayDrawerSnapshot })}
      </Box>
    );
  };

  // --- Center selection screen ---
  const renderCenterSelector = () => (
    <Box sx={{ py: 2 }}>
      <Typography variant="h5" fontWeight={800} mb={1} letterSpacing="-0.02em">
        Select a center
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3} maxWidth={520}>
        Choose where to record and review daily cash sheets
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
          gap: 2,
          maxWidth: 1200,
        }}
      >
        {visibleCenters.map((c) => {
          const sub = centerCardSublabel(c);
          return (
            <Card
              key={c.id}
              elevation={0}
              variant="outlined"
              sx={{
                cursor: 'pointer',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}, 0 8px 24px rgba(15, 23, 42, 0.08)`,
                  transform: 'translateY(-1px)',
                },
              }}
              onClick={() => { setSelectedCenter(c); setActiveTab(0); }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <StorefrontIcon sx={{ fontSize: 28, color: 'primary.main', mt: 0.25 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={800} letterSpacing="-0.01em">
                      {c.name}
                    </Typography>
                    {sub ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.45 }}>
                        {sub}
                      </Typography>
                    ) : null}
                    {c.isHeadOffice && (
                      <Chip label="Head office" size="small" color="primary" variant="outlined" sx={{ mt: 1, fontWeight: 600 }} />
                    )}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );

  // --- Main render ---
  if (authLoading || centersLoading) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default', minHeight: '100%', fontFamily: 'var(--font-inter), Roboto, system-ui, sans-serif' }}>
        <Skeleton variant="rounded" height={40} width={280} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rounded" height={22} width={420} sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((k) => (
            <Grid key={k} sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
              <Skeleton variant="rounded" height={100} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress size={36} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.default', minHeight: '100%', fontFamily: 'var(--font-inter), Roboto, system-ui, sans-serif' }}>
      <Stack spacing={0.5} mb={2}>
        <Typography variant="h4" fontWeight={800} color="text.primary" letterSpacing="-0.03em">
          Cash register
        </Typography>
        <Typography variant="body2" color="text.secondary" maxWidth={560}>
          Record daily cash in and out by center, save sheets, and review history with filters
        </Typography>
      </Stack>

      {isAdmin && (
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            borderRadius: RADIUS_2XL,
            px: 1,
            bgcolor: 'background.paper',
            border: '1px solid #e0e0e0',
            boxShadow: 'none',
          }}
        >
          <Tabs
            value={selectedCenter ? 0 : activeTab === 1 ? 1 : -1}
            onChange={(_, v) => {
              if (v === 1) { setSelectedCenter(null); setActiveTab(1); }
              else { setActiveTab(0); }
            }}
            sx={{
              minHeight: 48,
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 48 },
            }}
          >
            <Tab icon={<StoreIcon fontSize="small" />} iconPosition="start" label="Center register" value={0} />
            <Tab icon={<DashboardIcon fontSize="small" />} iconPosition="start" label="Overall (admin)" value={1} />
          </Tabs>
        </Paper>
      )}

      {activeTab === 1 && isAdmin && !selectedCenter
        ? renderOverallDashboard()
        : selectedCenter
          ? renderCenterRegister()
          : renderCenterSelector()
      }

      {renderEntryDrawer()}
      {renderPreviewDialog()}
      {renderDeleteSheetDialog()}

      <Snackbar open={!!successMsg} autoHideDuration={6000} onClose={() => setSuccessMsg('')}>
        <Alert onClose={() => setSuccessMsg('')} severity="success" variant="filled">{successMsg}</Alert>
      </Snackbar>
      <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={() => setErrorMsg('')}>
        <Alert onClose={() => setErrorMsg('')} severity="error" variant="filled">{errorMsg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default CashRegisterPage;
