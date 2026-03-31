'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Divider,
} from '@mui/material';
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
  Dashboard as DashboardIcon,
  ArrowBack as ArrowBackIcon,
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { v4 as uuidv4 } from 'uuid';

interface DailyRow {
  id: string;
  partyName: string;
  itemDetails: string;
  quantity: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  amount: number;
}

interface DailySheetDoc {
  date: Timestamp;
  centerId?: string;
  centerName?: string;
  cashIn: DailyRow[];
  cashOut: DailyRow[];
  totals: {
    netIn: number;
    netOut: number;
    cashIn: number;
    cashOut: number;
    balance: number;
    cashBalance: number;
  };
  createdAt: Timestamp;
}

interface Center {
  id: string;
  name: string;
  isHeadOffice?: boolean;
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
const endOfMonthDate = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const startOfWeekMonday = (d: Date) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(d, diff));
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const CashRegisterPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { effectiveScopeCenterId, lockedCenterId } = useCenterScope();
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
    { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 },
  ]);
  const [cashOutRows, setCashOutRows] = useState<DailyRow[]>([
    { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 },
  ]);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [previewSheet, setPreviewSheet] = useState<{ id: string; doc: DailySheetDoc } | null>(null);

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

  useEffect(() => {
    if (authLoading || !user) return;
    loadAllSheets();
  }, [user, authLoading]);

  const visibleCenters = useMemo(() => {
    if (!effectiveScopeCenterId) return centers;
    return centers.filter((c) => c.id === effectiveScopeCenterId);
  }, [centers, effectiveScopeCenterId]);

  const scopedSheets = useMemo(() => {
    if (!effectiveScopeCenterId) return allSheets;
    return allSheets.filter((s) => s.doc.centerId === effectiveScopeCenterId);
  }, [allSheets, effectiveScopeCenterId]);

  useEffect(() => {
    if (!centers.length || !effectiveScopeCenterId) return;
    const c = centers.find((x) => x.id === effectiveScopeCenterId);
    if (c) setSelectedCenter(c);
  }, [centers, effectiveScopeCenterId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadAllSheets = async () => {
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
  };

  // Sheets filtered to current center (data already limited by CRM scope when applicable)
  const centerSheets = useMemo(() => {
    if (!selectedCenter) return [];
    return scopedSheets.filter((s) => {
      if (s.doc.centerId) return s.doc.centerId === selectedCenter.id;
      return false; // legacy sheets without centerId don't belong to any center
    });
  }, [scopedSheets, selectedCenter]);

  // --- Daily form helpers ---
  const addCashInRow = () =>
    setCashInRows((prev) => [...prev, { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 }]);
  const addCashOutRow = () =>
    setCashOutRows((prev) => [...prev, { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 }]);
  const removeCashInRow = (id: string) => setCashInRows((prev) => prev.filter((r) => r.id !== id));
  const removeCashOutRow = (id: string) => setCashOutRows((prev) => prev.filter((r) => r.id !== id));

  const updateRow = (table: 'in' | 'out', id: string, patch: Partial<DailyRow>) => {
    const setter = table === 'in' ? setCashInRows : setCashOutRows;
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const dailyTotals = () => {
    const netIn = cashInRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const netOut = cashOutRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const cashIn = cashInRows.filter((r) => r.paymentMethod === 'cash').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const cashOut = cashOutRows.filter((r) => r.paymentMethod === 'cash').reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return { netIn, netOut, cashIn, cashOut, balance: netIn - netOut, cashBalance: cashIn - cashOut };
  };

  const resetDailyForm = () => {
    setEntryDate(new Date());
    setCashInRows([{ id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 }]);
    setCashOutRows([{ id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 }]);
    setEditingSheetId(null);
  };

  const saveDailySheet = async () => {
    if (!selectedCenter) {
      setErrorMsg('Please select a center first');
      return;
    }
    try {
      const totals = dailyTotals();
      const payload: any = {
        date: Timestamp.fromDate(entryDate),
        centerId: selectedCenter.id,
        centerName: selectedCenter.name,
        cashIn: cashInRows,
        cashOut: cashOutRows,
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
      await loadAllSheets();
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to save daily cash sheet');
    }
  };

  // --- Date range helpers ---
  const applyQuickRange = (type: string) => {
    const today = startOfDay(new Date());
    if (type === 'clear') { setRangeStart(null); setRangeEnd(null); }
    else if (type === 'today') { setRangeStart(today); setRangeEnd(endOfDay(today)); }
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

  // --- Render helpers ---
  const renderDateRangeControls = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <DatePicker label="From" value={rangeStart} onChange={(d) => setRangeStart(d)} slotProps={{ textField: { size: 'small' } }} />
        <DatePicker label="To" value={rangeEnd} onChange={(d) => setRangeEnd(d)} slotProps={{ textField: { size: 'small' } }} />
      </LocalizationProvider>
      {['clear', 'today', 'yesterday', 'prevWeek', 'last7', 'last30', 'thisMonth', 'lastMonth'].map((type) => (
        <Button key={type} variant="outlined" size="small" onClick={() => applyQuickRange(type)}>
          {type === 'clear' ? 'Clear' : type === 'today' ? 'Today' : type === 'yesterday' ? 'Yesterday' : type === 'prevWeek' ? 'Prev Week' : type === 'last7' ? 'Last 7d' : type === 'last30' ? 'Last 30d' : type === 'thisMonth' ? 'This Month' : 'Last Month'}
        </Button>
      ))}
    </Box>
  );

  const renderSummaryCards = (totals: { netIn: number; netOut: number; balance: number; cashBalance: number }) => (
    <Grid container spacing={3} mb={4}>
      {[
        { label: 'Balance', value: totals.balance, icon: <BalanceIcon color="primary" fontSize="large" />, color: undefined },
        { label: 'Net In', value: totals.netIn, icon: <IncomeIcon color="success" fontSize="large" />, color: 'success.main' },
        { label: 'Net Out', value: totals.netOut, icon: <ExpenseIcon color="error" fontSize="large" />, color: 'error.main' },
        { label: 'Cash Balance', value: totals.cashBalance, icon: <MoneyIcon color="info" fontSize="large" />, color: 'info.main' },
      ].map((card) => (
        <Grid key={card.label} sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
          <Card elevation={0} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                {card.icon}
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                  {summaryLoading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <Typography variant="h5" fontWeight="bold" color={card.color}>{formatCurrency(card.value)}</Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderDailyTable = (rows: DailyRow[], table: 'in' | 'out') => {
    const isIn = table === 'in';
    const setRows = isIn ? setCashInRows : setCashOutRows;
    const addRow = isIn ? addCashInRow : addCashOutRow;
    const removeRow = isIn ? removeCashInRow : removeCashOutRow;
    const totals = dailyTotals();
    const net = isIn ? totals.netIn : totals.netOut;
    const cashOnly = isIn ? totals.cashIn : totals.cashOut;

    return (
      <Box sx={{ p: 2, pt: isIn ? 2 : 0 }}>
        <Typography variant="subtitle1" sx={{ mb: 1, color: isIn ? 'success.main' : 'error.main', fontWeight: 700 }}>
          {isIn ? 'Cash In' : 'Cash Out'}
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{isIn ? 'Receipt From' : 'Cash To'}</TableCell>
                <TableCell>Item Details</TableCell>
                <TableCell width={110}>Qty</TableCell>
                <TableCell width={180}>Mode of Payment</TableCell>
                <TableCell width={160} align="right">Amount</TableCell>
                <TableCell width={60} align="right">&nbsp;</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><TextField size="small" fullWidth placeholder={isIn ? 'From whom' : 'To whom'} value={r.partyName} onChange={(e) => updateRow(table, r.id, { partyName: e.target.value })} /></TableCell>
                  <TableCell><TextField size="small" fullWidth placeholder="Item details" value={r.itemDetails} onChange={(e) => updateRow(table, r.id, { itemDetails: e.target.value })} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={r.quantity} onChange={(e) => updateRow(table, r.id, { quantity: Number(e.target.value) || 0 })} /></TableCell>
                  <TableCell>
                    <FormControl fullWidth size="small">
                      <Select value={r.paymentMethod} onChange={(e) => updateRow(table, r.id, { paymentMethod: e.target.value as any })}>
                        {paymentMethods.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell align="right"><TextField size="small" type="number" value={r.amount} onChange={(e) => updateRow(table, r.id, { amount: Number(e.target.value) || 0 })} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} /></TableCell>
                  <TableCell align="right"><IconButton size="small" color="error" onClick={() => removeRow(r.id)}><DeleteIcon fontSize="small" /></IconButton></TableCell>
                </TableRow>
              ))}
              <TableRow><TableCell colSpan={6}><Button startIcon={<AddIcon />} onClick={addRow} size="small">Add Row</Button></TableCell></TableRow>
              <TableRow><TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>Net Amount {isIn ? 'In' : 'Out'}</TableCell><TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(net)}</TableCell><TableCell /></TableRow>
              <TableRow><TableCell colSpan={4} align="right">{isIn ? 'Received' : 'Spent'} via Cash</TableCell><TableCell align="right">{formatCurrency(cashOnly)}</TableCell><TableCell /></TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderSavedSheetsTable = (sheets: typeof allSheets) => {
    const filtered = filterByRange(sheets);
    const totals = computeTotals(filtered);

    return (
      <>
        {renderSummaryCards(totals)}
        <Paper elevation={0} variant="outlined" sx={{ mb: 4 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Typography variant="h6" fontWeight={700}>Saved Daily Sheets</Typography>
            {renderDateRangeControls()}
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  {activeTab === 1 && <TableCell>Center</TableCell>}
                  <TableCell align="right">Net In</TableCell>
                  <TableCell align="right">Net Out</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="right">Cash In</TableCell>
                  <TableCell align="right">Cash Out</TableCell>
                  <TableCell align="right">Cash Balance</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>{new Date(s.doc.date.seconds * 1000).toLocaleDateString('en-IN')}</TableCell>
                    {activeTab === 1 && <TableCell><Chip label={s.doc.centerName || 'Legacy'} size="small" /></TableCell>}
                    <TableCell align="right">{formatCurrency(s.doc.totals.netIn)}</TableCell>
                    <TableCell align="right">{formatCurrency(s.doc.totals.netOut)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(s.doc.totals.balance)}</TableCell>
                    <TableCell align="right">{formatCurrency(s.doc.totals.cashIn)}</TableCell>
                    <TableCell align="right">{formatCurrency(s.doc.totals.cashOut)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(s.doc.totals.cashBalance)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" onClick={() => setPreviewSheet(s)}><ReceiptIcon fontSize="small" /></IconButton>
                      {activeTab === 0 && (
                        <IconButton size="small" color="success" onClick={() => {
                          setEntryDate(new Date(s.doc.date.seconds * 1000));
                          setCashInRows(s.doc.cashIn as any);
                          setCashOutRows(s.doc.cashOut as any);
                          setEditingSheetId(s.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      {isAdmin && (
                        <IconButton size="small" color="error" onClick={async () => { await deleteDoc(doc(db, 'cashDailySheets', s.id)); await loadAllSheets(); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={activeTab === 1 ? 9 : 8} align="center" sx={{ py: 3 }}>No daily sheets found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </>
    );
  };

  const renderPreviewDialog = () => (
    <Dialog open={!!previewSheet} onClose={() => setPreviewSheet(null)} maxWidth="md" fullWidth>
      <DialogTitle>
        Daily Sheet — {previewSheet ? new Date(previewSheet.doc.date.seconds * 1000).toLocaleDateString('en-IN') : ''}
        {previewSheet?.doc.centerName && <Chip label={previewSheet.doc.centerName} size="small" sx={{ ml: 1 }} />}
      </DialogTitle>
      <DialogContent dividers>
        {previewSheet && (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'success.main', fontWeight: 700 }}>Cash In</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Receipt From</TableCell><TableCell>Item Details</TableCell><TableCell>Qty</TableCell><TableCell>Mode</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
              <TableBody>
                {previewSheet.doc.cashIn.map((r, idx) => (
                  <TableRow key={idx}><TableCell>{r.partyName}</TableCell><TableCell>{r.itemDetails}</TableCell><TableCell>{r.quantity}</TableCell><TableCell>{paymentMethods.find((m) => m.value === r.paymentMethod)?.label || r.paymentMethod}</TableCell><TableCell align="right">{formatCurrency(r.amount as any)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'error.main', fontWeight: 700 }}>Cash Out</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Cash To</TableCell><TableCell>Item Details</TableCell><TableCell>Qty</TableCell><TableCell>Mode</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
              <TableBody>
                {previewSheet.doc.cashOut.map((r, idx) => (
                  <TableRow key={idx}><TableCell>{r.partyName}</TableCell><TableCell>{r.itemDetails}</TableCell><TableCell>{r.quantity}</TableCell><TableCell>{paymentMethods.find((m) => m.value === r.paymentMethod)?.label || r.paymentMethod}</TableCell><TableCell align="right">{formatCurrency(r.amount as any)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Chip label={`Net In: ${formatCurrency(previewSheet.doc.totals.netIn)}`} color="success" variant="outlined" />
              <Chip label={`Net Out: ${formatCurrency(previewSheet.doc.totals.netOut)}`} color="error" variant="outlined" />
              <Chip label={`Balance: ${formatCurrency(previewSheet.doc.totals.balance)}`} variant="outlined" />
              <Chip label={`Cash Balance: ${formatCurrency(previewSheet.doc.totals.cashBalance)}`} variant="outlined" />
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions><Button onClick={() => setPreviewSheet(null)}>Close</Button></DialogActions>
    </Dialog>
  );

  // --- Overall admin view ---
  const renderOverallDashboard = () => {
    const rangeFiltered = filterByRange(scopedSheets);
    const overall = computeTotals(rangeFiltered);

    const byCenterId = new Map<string, { centerName: string; sheets: typeof allSheets }>();
    rangeFiltered.forEach((s) => {
      const cId = s.doc.centerId || '__legacy__';
      const cName = s.doc.centerName || 'Unassigned (Legacy)';
      if (!byCenterId.has(cId)) byCenterId.set(cId, { centerName: cName, sheets: [] });
      byCenterId.get(cId)!.sheets.push(s);
    });

    const centerSummaries = Array.from(byCenterId.entries())
      .map(([cId, { centerName, sheets }]) => ({ centerId: cId, centerName, ...computeTotals(sheets), sheetCount: sheets.length }))
      .sort((a, b) => a.centerName.localeCompare(b.centerName));

    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={3}>Overall Cash Register</Typography>

        {renderSummaryCards(overall)}

        <Paper elevation={0} variant="outlined" sx={{ mb: 4 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={700} mb={2}>Center-wise Summary</Typography>
            {renderDateRangeControls()}
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Center</TableCell>
                  <TableCell align="right">Sheets</TableCell>
                  <TableCell align="right">Net In</TableCell>
                  <TableCell align="right">Net Out</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="right">Cash Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {centerSummaries.map((cs) => (
                  <TableRow key={cs.centerId} hover>
                    <TableCell><Chip icon={<StoreIcon />} label={cs.centerName} size="small" variant="outlined" /></TableCell>
                    <TableCell align="right">{cs.sheetCount}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>{formatCurrency(cs.netIn)}</TableCell>
                    <TableCell align="right" sx={{ color: 'error.main' }}>{formatCurrency(cs.netOut)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(cs.balance)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(cs.cashBalance)}</TableCell>
                  </TableRow>
                ))}
                {centerSummaries.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3 }}>No data found</TableCell></TableRow>
                )}
                {centerSummaries.length > 1 && (
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Total (All Centers)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{rangeFiltered.length}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(overall.netIn)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>{formatCurrency(overall.netOut)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(overall.balance)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(overall.cashBalance)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {renderSavedSheetsTable(scopedSheets)}
      </Box>
    );
  };

  // --- Center Register view (entry + sheets for selected center) ---
  const renderCenterRegister = () => {
    const filteredCenterSheets = filterByRange(centerSheets);
    const totals = computeTotals(filteredCenterSheets);

    return (
      <Box>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          {!lockedCenterId && (
            <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => { setSelectedCenter(null); resetDailyForm(); }}>
              Change Center
            </Button>
          )}
          <Chip icon={<StoreIcon />} label={selectedCenter?.name} color="primary" variant="outlined" sx={{ fontSize: '1rem', py: 2.5, px: 1 }} />
        </Box>

        {/* Daily Cash Entry Form */}
        <Paper elevation={0} variant="outlined" sx={{ mb: 4 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight={700}>Daily Cash Entry</Typography>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker label="Entry Date" value={entryDate} onChange={(d) => d && setEntryDate(d)} slotProps={{ textField: { size: 'small' } }} />
            </LocalizationProvider>
          </Box>
          {renderDailyTable(cashInRows, 'in')}
          {renderDailyTable(cashOutRows, 'out')}
          <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Chip label={`Balance: ${formatCurrency(dailyTotals().balance)}`} color={dailyTotals().balance >= 0 ? 'success' : 'error'} variant="outlined" />
            <Chip label={`Cash Balance: ${formatCurrency(dailyTotals().cashBalance)}`} color={dailyTotals().cashBalance >= 0 ? 'success' : 'error'} variant="outlined" />
            <Button variant="contained" onClick={saveDailySheet} startIcon={<ReceiptIcon />}>
              {editingSheetId ? 'Update Sheet' : 'Save Daily Sheet'}
            </Button>
          </Box>
        </Paper>

        {renderSavedSheetsTable(centerSheets)}
      </Box>
    );
  };

  // --- Center selection screen ---
  const renderCenterSelector = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <StoreIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
      <Typography variant="h5" fontWeight={700} mb={1}>Select Center</Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>Choose a center to view and manage its cash register</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', maxWidth: 800 }}>
        {visibleCenters.map((c) => (
          <Card
            key={c.id}
            variant="outlined"
            sx={{
              width: 220,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': { borderColor: 'primary.main', boxShadow: 3, transform: 'translateY(-2px)' },
            }}
            onClick={() => { setSelectedCenter(c); setActiveTab(0); }}
          >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <StoreIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="h6" fontWeight={600}>{c.name}</Typography>
              {c.isHeadOffice && <Chip label="Head Office" size="small" color="primary" sx={{ mt: 1 }} />}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );

  // --- Main render ---
  if (authLoading || centersLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"><CircularProgress /></Box>;
  }

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" color="primary" mb={1}>Cash Register</Typography>
      <Typography variant="body1" color="text.secondary" mb={2}>
        Record daily cash in/out per center and view saved daily sheets
      </Typography>

      {isAdmin && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={selectedCenter ? 0 : activeTab === 1 ? 1 : -1} onChange={(_, v) => {
            if (v === 1) { setSelectedCenter(null); setActiveTab(1); }
            else { setActiveTab(0); }
          }}>
            <Tab icon={<StoreIcon />} iconPosition="start" label="Center Register" value={0} />
            <Tab icon={<DashboardIcon />} iconPosition="start" label="Overall (Admin)" value={1} />
          </Tabs>
        </Box>
      )}

      {activeTab === 1 && isAdmin && !selectedCenter
        ? renderOverallDashboard()
        : selectedCenter
          ? renderCenterRegister()
          : renderCenterSelector()
      }

      {renderPreviewDialog()}

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
