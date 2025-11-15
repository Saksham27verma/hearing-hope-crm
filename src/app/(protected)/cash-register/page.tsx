'use client';

import React, { useState, useEffect } from 'react';
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
  TablePagination,
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
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ArrowUpward as IncomeIcon,
  ArrowDownward as ExpenseIcon,
  AttachMoney as MoneyIcon,
  AccountBalance as BalanceIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { v4 as uuidv4 } from 'uuid';

// Types
interface CashTransaction {
  id?: string;
  transactionNumber: string;
  type: 'income' | 'expense';
  amount: number;
  category: string; // kept for compatibility, not shown in new UI
  description: string; // legacy notes
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  transactionDate: Timestamp;
  referenceNumber?: string;
  branch: string; // optional now
  handledBy: string; // optional now
  // New friendly fields for UI
  partyName?: string; // Receipt From whom / Cash to whom
  itemDetails?: string;
  quantity?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Daily entry types
interface DailyRow {
  id: string;
  partyName: string; // receipt from / cash to
  itemDetails: string;
  quantity: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  amount: number;
}

interface DailySheetDoc {
  date: Timestamp;
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

// Component
const CashRegisterPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<CashTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [cashSummary, setCashSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0,
    cashInHand: 0,
  });
  // Daily form state
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [cashInRows, setCashInRows] = useState<DailyRow[]>([
    { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 },
  ]);
  const [cashOutRows, setCashOutRows] = useState<DailyRow[]>([
    { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 },
  ]);
  const [dailySheets, setDailySheets] = useState<Array<{ id: string; doc: DailySheetDoc }>>([]);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [previewSheet, setPreviewSheet] = useState<{ id: string; doc: DailySheetDoc } | null>(null);
  const addCashInRow = () => setCashInRows(prev => [...prev, { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 }]);
  const addCashOutRow = () => setCashOutRows(prev => [...prev, { id: uuidv4(), partyName: '', itemDetails: '', quantity: 1, paymentMethod: 'cash', amount: 0 }]);
  const removeCashInRow = (id: string) => setCashInRows(prev => prev.filter(r => r.id !== id));
  const removeCashOutRow = (id: string) => setCashOutRows(prev => prev.filter(r => r.id !== id));

  const updateRow = (table: 'in'|'out', id: string, patch: Partial<DailyRow>) => {
    if (table === 'in') {
      setCashInRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    } else {
      setCashOutRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    }
  };

  const dailyTotals = () => {
    const netIn = cashInRows.reduce((s,r)=> s + (Number(r.amount)||0), 0);
    const netOut = cashOutRows.reduce((s,r)=> s + (Number(r.amount)||0), 0);
    const cashIn = cashInRows.filter(r=>r.paymentMethod==='cash').reduce((s,r)=> s + (Number(r.amount)||0), 0);
    const cashOut = cashOutRows.filter(r=>r.paymentMethod==='cash').reduce((s,r)=> s + (Number(r.amount)||0), 0);
    const balance = netIn - netOut;
    const cashBalance = cashIn - cashOut;
    return { netIn, netOut, cashIn, cashOut, balance, cashBalance };
  };

  const saveDailySheet = async () => {
    try {
      const totals = dailyTotals();
      const payload: DailySheetDoc = {
        date: Timestamp.fromDate(entryDate),
        cashIn: cashInRows,
        cashOut: cashOutRows,
        totals: {
          netIn: totals.netIn,
          netOut: totals.netOut,
          cashIn: totals.cashIn,
          cashOut: totals.cashOut,
          balance: totals.balance,
          cashBalance: totals.cashBalance,
        },
        createdAt: Timestamp.now(),
      };
      if (editingSheetId) {
        await updateDoc(doc(db, 'cashDailySheets', editingSheetId), payload as any);
        setSuccessMsg('Daily cash sheet updated');
        setEditingSheetId(null);
      } else {
        await addDoc(collection(db, 'cashDailySheets'), payload);
        setSuccessMsg('Daily cash sheet saved');
      }
      await loadDailySheets();
    } catch (e) {
      console.error(e);
      setErrorMsg('Failed to save daily cash sheet');
    }
  };

  const loadDailySheets = async () => {
    try {
      setSummaryLoading(true);
      const qSheets = query(collection(db, 'cashDailySheets'), orderBy('date', 'desc'));
      const snap = await getDocs(qSheets);
      const rows = snap.docs.map(d => ({ id: d.id, doc: d.data() as DailySheetDoc }));
      setDailySheets(rows);
    } catch (e) {
      console.error('Failed to load daily sheets', e);
      setErrorMsg('Failed to load daily sheets data');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadDailySheets();
  }, []);

  // Totals from saved sheets (for selected date or today)
  const savedTotals = () => {
    // Get filtered sheets using the same logic as the table
    const filteredSheets = dailySheets.filter(s => {
      if (rangeStart && rangeEnd) {
        const d = new Date(s.doc.date.seconds * 1000);
        return d >= startOfDay(rangeStart) && d <= endOfDay(rangeEnd);
      }
      return true;
    });

    if (filteredSheets.length === 0) {
      return { netIn: 0, netOut: 0, balance: 0, cashBalance: 0 } as { netIn: number; netOut: number; balance: number; cashBalance: number };
    }

    const sum = filteredSheets.reduce((acc, s) => {
      return {
        netIn: acc.netIn + (s.doc.totals.netIn || 0),
        netOut: acc.netOut + (s.doc.totals.netOut || 0),
        balance: acc.balance + (s.doc.totals.balance || 0),
        cashBalance: acc.cashBalance + (s.doc.totals.cashBalance || 0),
      };
    }, { netIn: 0, netOut: 0, balance: 0, cashBalance: 0 });
    return sum;
  };

  // Range helpers
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  const startOfWeekMonday = (d: Date) => {
    const day = d.getDay(); // 0 Sunday
    const diff = (day === 0 ? -6 : 1 - day); // Monday as start
    return startOfDay(addDays(d, diff));
  };
  const previousWeekRange = (d: Date) => {
    const startThisWeek = startOfWeekMonday(d);
    const startPrev = addDays(startThisWeek, -7);
    const endPrev = addDays(startThisWeek, -1);
    return { start: startOfDay(startPrev), end: endOfDay(endPrev) };
  };

  const applyQuickRange = async (type: 'today'|'yesterday'|'last7'|'last30'|'thisMonth'|'lastMonth'|'prevWeek'|'clear') => {
    setSummaryLoading(true);
    const today = startOfDay(new Date());
    if (type === 'clear') { setRangeStart(null); setRangeEnd(null); }
    else if (type === 'today') { setRangeStart(today); setRangeEnd(endOfDay(today)); }
    else if (type === 'yesterday') { const y = addDays(today, -1); setRangeStart(startOfDay(y)); setRangeEnd(endOfDay(y)); }
    else if (type === 'last7') { setRangeStart(addDays(today, -6)); setRangeEnd(endOfDay(today)); }
    else if (type === 'last30') { setRangeStart(addDays(today, -29)); setRangeEnd(endOfDay(today)); }
    else if (type === 'thisMonth') { setRangeStart(startOfMonth(today)); setRangeEnd(endOfDay(today)); }
    else if (type === 'lastMonth') { const firstThis = startOfMonth(today); const lastMonthEnd = addDays(firstThis, -1); setRangeStart(startOfMonth(lastMonthEnd)); setRangeEnd(endOfDay(lastMonthEnd)); }
    else if (type === 'prevWeek') { const { start, end } = previousWeekRange(today); setRangeStart(start); setRangeEnd(end); }
    
    // Small delay to ensure state updates are processed
    await new Promise(resolve => setTimeout(resolve, 100));
    setSummaryLoading(false);
  };
  
  // Branch options
  const branchOptions = ['Main Branch', 'North Branch', 'South Branch', 'West Branch', 'East Branch'];

  // Category options
  const incomeCategories = [
    'Product Sales',
    'Service Fee',
    'Consultation Fee',
    'Maintenance Contract',
    'Other Income'
  ];
  
  const expenseCategories = [
    'Purchase',
    'Rent',
    'Utilities',
    'Salaries',
    'Marketing',
    'Office Supplies',
    'Travel',
    'Miscellaneous'
  ];

  // Payment methods
  const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque', label: 'Cheque' }
  ];
  
  // Initialize empty transaction
  const emptyTransaction: CashTransaction = {
    transactionNumber: '',
    type: 'income',
    amount: 0,
    category: '',
    description: '',
    paymentMethod: 'cash',
    transactionDate: Timestamp.now(),
    branch: '',
    handledBy: '',
    partyName: '',
    itemDetails: '',
    quantity: 1,
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Fetch transactions data
    fetchTransactions();
    
  }, [user, authLoading, router]);

  // Filter transactions when search term, type filter or date filter changes
  useEffect(() => {
    if (transactions.length === 0) {
      setFilteredTransactions([]);
      return;
    }
    
    let filtered = [...transactions];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(transaction => 
        transaction.transactionNumber.toLowerCase().includes(searchLower) ||
        transaction.description.toLowerCase().includes(searchLower) ||
        transaction.category.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply type filter
    if (typeFilter) {
      filtered = filtered.filter(transaction => transaction.type === typeFilter);
    }
    
    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.transactionDate.seconds * 1000);
        return (
          transactionDate.getDate() === filterDate.getDate() &&
          transactionDate.getMonth() === filterDate.getMonth() &&
          transactionDate.getFullYear() === filterDate.getFullYear()
        );
      });
    }
    
    setFilteredTransactions(filtered);
  }, [transactions, searchTerm, typeFilter, dateFilter]);

  // Calculate cash summary and table subtotals
  useEffect(() => {
    if (transactions.length === 0) {
      setCashSummary({
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        transactionCount: 0,
        cashInHand: 0,
      });
      return;
    }
    
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const cashInHand = transactions
      .filter(t => t.paymentMethod === 'cash')
      .reduce((sum, t) => t.type === 'income' ? sum + t.amount : sum - t.amount, 0);
    
    setCashSummary({
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      transactionCount: transactions.length,
      cashInHand,
    });
  }, [transactions]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const transactionsQuery = query(collection(db, 'cashTransactions'), orderBy('transactionDate', 'desc'));
      const snapshot = await getDocs(transactionsQuery);
      
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as CashTransaction[];
      
      setTransactions(transactionsData);
      setFilteredTransactions(transactionsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching cash transactions:', error);
      setErrorMsg('Failed to load cash transactions data');
      setLoading(false);
    }
  };

  const handleAddTransaction = (type: 'income' | 'expense') => {
    // Generate new transaction number (format: TX-YYYYMMDD-XXX)
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
    const prefix = type === 'income' ? 'IN' : 'EX';
    const transactionNumber = `${prefix}-${dateString}-${randomNum}`;
    
    setCurrentTransaction({
      ...emptyTransaction,
      type,
      transactionNumber,
      category: type === 'income' ? incomeCategories[0] : expenseCategories[0],
      handledBy: user?.displayName || '',
    });
    setOpenDialog(true);
  };

  const handleEditTransaction = (transaction: CashTransaction) => {
    setCurrentTransaction(transaction);
    setOpenDialog(true);
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      await deleteDoc(doc(db, 'cashTransactions', id));
      setTransactions(prevTransactions => prevTransactions.filter(transaction => transaction.id !== id));
      setSuccessMsg('Transaction deleted successfully');
    } catch (error) {
      console.error('Error deleting transaction:', error);
      setErrorMsg('Failed to delete transaction');
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentTransaction(null);
  };

  const handleSaveTransaction = async () => {
    if (!currentTransaction) return;
    
    // Validate transaction data
    if (!currentTransaction.amount || !currentTransaction.partyName) {
      setErrorMsg('Please fill all required fields');
      return;
    }
    
    if (currentTransaction.amount <= 0) {
      setErrorMsg('Amount must be greater than zero');
      return;
    }
    
    try {
      if (currentTransaction.id) {
        // Update existing transaction
        const transactionRef = doc(db, 'cashTransactions', currentTransaction.id);
        await updateDoc(transactionRef, {
          ...currentTransaction,
          updatedAt: serverTimestamp(),
        });
        
        // Update in state
        setTransactions(prevTransactions => 
          prevTransactions.map(transaction => 
            transaction.id === currentTransaction.id ? {...currentTransaction, updatedAt: Timestamp.now()} : transaction
          )
        );
        
        setSuccessMsg('Transaction updated successfully');
      } else {
        // Add new transaction
        const newTransactionData = {
          ...currentTransaction,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(db, 'cashTransactions'), newTransactionData);
        
        // Add to state with the new ID
        const newTransaction = {
          ...currentTransaction,
          id: docRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        
        setTransactions(prevTransactions => [newTransaction, ...prevTransactions]);
        setSuccessMsg('Transaction added successfully');
      }
      
      setOpenDialog(false);
    } catch (error) {
      console.error('Error saving transaction:', error);
      setErrorMsg('Failed to save transaction');
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCloseSnackbar = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  const formatDate = (timestamp: Timestamp) => {
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (authLoading || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" color="primary" mb={1}>
        Cash Register
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
            Record daily cash in/out and view saved daily sheets
      </Typography>
      
      {/* Daily Cash Entry Form */}
      <Paper elevation={0} variant="outlined" sx={{ mb: 4 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight={700}>Daily Cash Entry</Typography>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Entry Date"
              value={entryDate}
              onChange={(d)=> d && setEntryDate(d)}
              slotProps={{ textField: { size: 'small' } }}
            />
          </LocalizationProvider>
        </Box>

        {/* Cash In editable table */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, color: 'success.main', fontWeight: 700 }}>Cash In</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Receipt From</TableCell>
                  <TableCell>Item Details</TableCell>
                  <TableCell width={110}>Qty</TableCell>
                  <TableCell width={180}>Mode of Payment</TableCell>
                  <TableCell width={160} align="right">Amount</TableCell>
                  <TableCell width={60} align="right">\u00A0</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cashInRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <TextField size="small" fullWidth placeholder="From whom" value={r.partyName} onChange={(e)=>updateRow('in', r.id, { partyName: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" fullWidth placeholder="Item details" value={r.itemDetails} onChange={(e)=>updateRow('in', r.id, { itemDetails: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" type="number" value={r.quantity} onChange={(e)=>updateRow('in', r.id, { quantity: Number(e.target.value)||0 })} />
                    </TableCell>
                    <TableCell>
                      <FormControl fullWidth size="small">
                        <Select value={r.paymentMethod} onChange={(e)=>updateRow('in', r.id, { paymentMethod: e.target.value as any })}>
                          {paymentMethods.map(m=> <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" type="number" value={r.amount} onChange={(e)=>updateRow('in', r.id, { amount: Number(e.target.value)||0 })} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={()=>removeCashInRow(r.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={6}>
                    <Button startIcon={<AddIcon />} onClick={addCashInRow} size="small">Add Row</Button>
                  </TableCell>
                </TableRow>
                {/* Subtotals */}
                <TableRow>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>Net Amount In</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(dailyTotals().netIn)}</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} align="right">Received via Cash</TableCell>
                  <TableCell align="right">{formatCurrency(dailyTotals().cashIn)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Cash Out editable table */}
        <Box sx={{ p: 2, pt: 0 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, color: 'error.main', fontWeight: 700 }}>Cash Out</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Cash To</TableCell>
                  <TableCell>Item Details</TableCell>
                  <TableCell width={110}>Qty</TableCell>
                  <TableCell width={180}>Mode of Payment</TableCell>
                  <TableCell width={160} align="right">Amount</TableCell>
                  <TableCell width={60} align="right">\u00A0</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cashOutRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <TextField size="small" fullWidth placeholder="To whom" value={r.partyName} onChange={(e)=>updateRow('out', r.id, { partyName: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" fullWidth placeholder="Item details" value={r.itemDetails} onChange={(e)=>updateRow('out', r.id, { itemDetails: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" type="number" value={r.quantity} onChange={(e)=>updateRow('out', r.id, { quantity: Number(e.target.value)||0 })} />
                    </TableCell>
                    <TableCell>
                      <FormControl fullWidth size="small">
                        <Select value={r.paymentMethod} onChange={(e)=>updateRow('out', r.id, { paymentMethod: e.target.value as any })}>
                          {paymentMethods.map(m=> <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" type="number" value={r.amount} onChange={(e)=>updateRow('out', r.id, { amount: Number(e.target.value)||0 })} InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={()=>removeCashOutRow(r.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={6}>
                    <Button startIcon={<AddIcon />} onClick={addCashOutRow} size="small">Add Row</Button>
                  </TableCell>
                </TableRow>
                {/* Subtotals */}
                <TableRow>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>Net Amount Out</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(dailyTotals().netOut)}</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} align="right">Spent via Cash</TableCell>
                  <TableCell align="right">{formatCurrency(dailyTotals().cashOut)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Overall Balances */}
        <Box sx={{ p: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Chip label={`Balance: ${formatCurrency(dailyTotals().balance)}`} color={dailyTotals().balance >= 0 ? 'success' : 'error'} variant="outlined" />
          <Chip label={`Cash Balance: ${formatCurrency(dailyTotals().cashBalance)}`} color={dailyTotals().cashBalance >= 0 ? 'success' : 'error'} variant="outlined" />
          <Button variant="contained" onClick={saveDailySheet} startIcon={<ReceiptIcon />}>Save Daily Sheet</Button>
        </Box>
      </Paper>

    {/* Saved Daily Sheets */}
    <Paper elevation={0} variant="outlined" sx={{ mb: 4 }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={700}>Saved Daily Sheets</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker 
              label="From" 
              value={rangeStart} 
              onChange={async (d)=> {
                setSummaryLoading(true);
                setRangeStart(d);
                await new Promise(resolve => setTimeout(resolve, 100));
                setSummaryLoading(false);
              }} 
              slotProps={{ textField: { size: 'small' } }} 
            />
            <DatePicker 
              label="To" 
              value={rangeEnd} 
              onChange={async (d)=> {
                setSummaryLoading(true);
                setRangeEnd(d);
                await new Promise(resolve => setTimeout(resolve, 100));
                setSummaryLoading(false);
              }} 
              slotProps={{ textField: { size: 'small' } }} 
            />
          </LocalizationProvider>
          <Button variant="outlined" size="small" onClick={()=>applyQuickRange('clear')}>Clear</Button>
          <Button variant="outlined" size="small" onClick={()=>applyQuickRange('today')}>Today</Button>
          <Button variant="outlined" size="small" onClick={()=>applyQuickRange('yesterday')}>Yesterday</Button>
          <Button variant="outlined" size="small" onClick={()=>applyQuickRange('prevWeek')}>Previous Week</Button>
          <Button variant="outlined" size="small" onClick={()=>applyQuickRange('last7')}>Last 7 days</Button>
          <Button variant="outlined" size="small" onClick={()=>applyQuickRange('last30')}>Last 30 days</Button>
          <Button variant="outlined" size="small" onClick={()=>applyQuickRange('thisMonth')}>This Month</Button>
          <Button variant="outlined" size="small" onClick={()=>applyQuickRange('lastMonth')}>Last Month</Button>
        </Box>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
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
            {dailySheets
              .filter(s => {
                if (rangeStart && rangeEnd) {
                  const d = new Date(s.doc.date.seconds * 1000);
                  return d >= startOfDay(rangeStart) && d <= endOfDay(rangeEnd);
                }
                return true;
              })
              .map(s => (
                <TableRow key={s.id} hover>
                  <TableCell>{new Date(s.doc.date.seconds * 1000).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell align="right">{formatCurrency(s.doc.totals.netIn)}</TableCell>
                  <TableCell align="right">{formatCurrency(s.doc.totals.netOut)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(s.doc.totals.balance)}</TableCell>
                  <TableCell align="right">{formatCurrency(s.doc.totals.cashIn)}</TableCell>
                  <TableCell align="right">{formatCurrency(s.doc.totals.cashOut)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(s.doc.totals.cashBalance)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="primary" onClick={() => setPreviewSheet(s)}>
                    <ReceiptIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="success" onClick={() => {
                    setEntryDate(new Date(s.doc.date.seconds * 1000));
                    setCashInRows(s.doc.cashIn as any);
                    setCashOutRows(s.doc.cashOut as any);
                    setEditingSheetId(s.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {userProfile?.role === 'admin' && (
                    <IconButton size="small" color="error" onClick={async () => { await deleteDoc(doc(db, 'cashDailySheets', s.id)); await loadDailySheets(); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
                </TableRow>
              ))}
            {dailySheets.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>No daily sheets saved yet</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>

    {/* Preview Dialog */}
    <Dialog open={!!previewSheet} onClose={() => setPreviewSheet(null)} maxWidth="md" fullWidth>
      <DialogTitle>Daily Sheet - {previewSheet ? new Date(previewSheet.doc.date.seconds * 1000).toLocaleDateString('en-IN') : ''}</DialogTitle>
      <DialogContent dividers>
        {previewSheet && (
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'success.main', fontWeight: 700 }}>Cash In</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Receipt From</TableCell>
                  <TableCell>Item Details</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewSheet.doc.cashIn.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{r.partyName}</TableCell>
                    <TableCell>{r.itemDetails}</TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell>{paymentMethods.find(m => m.value === r.paymentMethod)?.label || r.paymentMethod}</TableCell>
                    <TableCell align="right">{formatCurrency(r.amount as any)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ my: 2 }} />
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'error.main', fontWeight: 700 }}>Cash Out</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Cash To</TableCell>
                  <TableCell>Item Details</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {previewSheet.doc.cashOut.map((r, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{r.partyName}</TableCell>
                    <TableCell>{r.itemDetails}</TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell>{paymentMethods.find(m => m.value === r.paymentMethod)?.label || r.paymentMethod}</TableCell>
                    <TableCell align="right">{formatCurrency(r.amount as any)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Chip label={`Net In: ${formatCurrency(previewSheet.doc.totals.netIn)}`} color="success" variant="outlined" />
              <Chip label={`Net Out: ${formatCurrency(previewSheet.doc.totals.netOut)}`} color="error" variant="outlined" />
              <Chip label={`Balance: ${formatCurrency(previewSheet.doc.totals.balance)}`} variant="outlined" />
              <Chip label={`Cash Balance: ${formatCurrency(previewSheet.doc.totals.cashBalance)}`} variant="outlined" />
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPreviewSheet(null)}>Close</Button>
      </DialogActions>
    </Dialog>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
          <Card elevation={0} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <BalanceIcon color="primary" fontSize="large" />
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    Balance
                  </Typography>
                  {summaryLoading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <Typography variant="h5" fontWeight="bold">
                      {formatCurrency(savedTotals().balance)}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
          <Card elevation={0} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <IncomeIcon color="success" fontSize="large" />
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    Net In
                  </Typography>
                  {summaryLoading ? (
                    <CircularProgress size={20} color="success" />
                  ) : (
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      {formatCurrency(savedTotals().netIn)}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
          <Card elevation={0} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <ExpenseIcon color="error" fontSize="large" />
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    Net Out
                  </Typography>
                  {summaryLoading ? (
                    <CircularProgress size={20} color="error" />
                  ) : (
                    <Typography variant="h5" fontWeight="bold" color="error.main">
                      {formatCurrency(savedTotals().netOut)}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
          <Card elevation={0} variant="outlined">
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={2}>
                <MoneyIcon color="info" fontSize="large" />
                <Box sx={{ width: '100%' }}>
                  <Typography variant="body2" color="text.secondary">
                    Cash Balance
                  </Typography>
                  {summaryLoading ? (
                    <CircularProgress size={20} color="info" />
                  ) : (
                    <Typography variant="h5" fontWeight="bold" color="info.main">
                      {formatCurrency(savedTotals().cashBalance)}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Old transactions controls removed as requested */}
      
      
      {/* Success/Error messages */}
      <Snackbar open={!!successMsg} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="success" variant="filled">
          {successMsg}
        </Alert>
      </Snackbar>
      
      <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="error" variant="filled">
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CashRegisterPage; 