'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid as MuiGrid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  CalendarMonth,
  CurrencyRupee,
  AccountBalanceWallet,
  Business,
  Search as SearchIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAuth } from '@/context/AuthContext';
import { isSuperAdminViewer } from '@/lib/tenant/centerScope';
import type { ManagedExpense, ManagedExpenseInput } from '@/lib/expenses/types';

const Grid = ({ children, ...props }: React.ComponentProps<typeof MuiGrid>) => (
  <MuiGrid {...props}>{children}</MuiGrid>
);

function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number.isFinite(amount) ? amount : 0,
  );
}

function toDateValue(date: string): Date | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DEFAULT_FORM: ManagedExpenseInput = {
  date: new Date().toISOString().slice(0, 10),
  amount: 0,
  category: '',
  scopeType: 'center',
  centerId: '',
  centerName: '',
  status: 'active',
};

type CenterOption = { id: string; name: string };

export default function ExpensesPage() {
  const { userProfile, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const isSuperAdmin = isSuperAdminViewer(userProfile);

  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [expenses, setExpenses] = useState<ManagedExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedExpense | null>(null);
  const [form, setForm] = useState<ManagedExpenseInput>(DEFAULT_FORM);
  const [q, setQ] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'center' | 'global'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const total = useMemo(() => expenses.filter((e) => e.status === 'active').reduce((acc, row) => acc + row.amount, 0), [expenses]);
  const centerTotal = useMemo(
    () => expenses.filter((e) => e.status === 'active' && e.scopeType === 'center').reduce((acc, row) => acc + row.amount, 0),
    [expenses],
  );
  const globalTotal = useMemo(
    () => expenses.filter((e) => e.status === 'active' && e.scopeType === 'global').reduce((acc, row) => acc + row.amount, 0),
    [expenses],
  );

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    return expenses.filter((row) => {
      if (scopeFilter !== 'all' && row.scopeType !== scopeFilter) return false;
      if (!query) return true;
      return [row.category, row.subCategory, row.vendor, row.notes, row.centerName, row.date]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [expenses, q, scopeFilter]);

  const authHeader = useCallback(async (): Promise<Record<string, string>> => {
    const token = await user?.getIdToken();
    if (!token) throw new Error('Login session missing. Please sign in again.');
    return { Authorization: `Bearer ${token}` };
  }, [user]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await authHeader();

      const centersRes = await fetch('/api/expenses/centers', { headers });
      const centersPayload = (await centersRes.json()) as {
        ok?: boolean;
        data?: Array<{ id: string; name: string }>;
        error?: string;
      };
      if (!centersRes.ok || !centersPayload.ok || !Array.isArray(centersPayload.data)) {
        throw new Error(centersPayload.error || 'Unable to load centers');
      }
      const centersList = centersPayload.data;

      const res = await fetch('/api/expenses', { headers });
      const payload = (await res.json()) as { ok?: boolean; data?: ManagedExpense[]; error?: string };
      if (!res.ok || !payload.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error || 'Unable to load expenses');
      }
      const expenseRows = payload.data as ManagedExpense[];
      setExpenses(expenseRows);

      // Fallback: include any center labels present on existing expenses, even if
      // center docs are missing/renamed, so dropdown never looks empty.
      const fallbackCenters = expenseRows
        .filter((row) => row.scopeType === 'center' && row.centerId)
        .map((row) => ({ id: String(row.centerId), name: String(row.centerName || row.centerId) }));

      const merged = new Map<string, string>();
      [...centersList, ...fallbackCenters].forEach((row) => {
        const id = row.id.trim();
        if (!id) return;
        if (!merged.has(id)) merged.set(id, row.name.trim() || id);
      });
      setCenters(Array.from(merged.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'en-IN')));
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load expenses' });
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) router.replace('/dashboard');
  }, [authLoading, isSuperAdmin, router]);

  useEffect(() => {
    if (isSuperAdmin) void loadData();
  }, [isSuperAdmin, loadData]);

  const openCreateDialog = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (row: ManagedExpense) => {
    setEditing(row);
    setForm({
      date: row.date,
      amount: row.amount,
      category: row.category,
      subCategory: row.subCategory || '',
      vendor: row.vendor || '',
      notes: row.notes || '',
      scopeType: row.scopeType,
      centerId: row.centerId || '',
      centerName: row.centerName || '',
      status: row.status,
    });
    setDialogOpen(true);
  };

  const saveExpense = async () => {
    try {
      if (!form.category.trim()) throw new Error('Category is required');
      if (form.amount <= 0) throw new Error('Amount must be greater than 0');
      if (form.scopeType === 'center' && !form.centerId) throw new Error('Please select a center');
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
      const payload = {
        ...form,
        amount: Number(form.amount),
        subCategory: '',
        vendor: '',
        notes: '',
      };
      const endpoint = '/api/expenses';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(editing ? { ...payload, id: editing.id } : payload),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || 'Unable to save expense');
      setDialogOpen(false);
      setMessage({ type: 'success', text: editing ? 'Expense updated successfully.' : 'Expense added successfully.' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save expense' });
    }
  };

  const deleteExpense = async (id: string) => {
    if (!window.confirm('Delete this expense record?')) return;
    try {
      const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: await authHeader(),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error || 'Unable to delete expense');
      setMessage({ type: 'success', text: 'Expense deleted.' });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Unable to delete expense' });
    }
  };

  if (authLoading || loading) {
    return <Typography variant="body2">Loading expenses...</Typography>;
  }
  if (!isSuperAdmin) return null;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} mb={3} flexWrap="wrap">
        <Box>
          <Typography variant="h5" fontWeight={700}>Expenses</Typography>
          <Typography variant="body2" color="text.secondary">
            Track all business costs and keep net profit calculations exact.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Expense
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Total Expenses</Typography>
            <Typography variant="h6" fontWeight={700}>{formatINR(total)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Center-linked</Typography>
            <Typography variant="h6" fontWeight={700}>{formatINR(centerTotal)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary">Global</Typography>
            <Typography variant="h6" fontWeight={700}>{formatINR(globalTotal)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Box display="flex" gap={1.5} flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Search category, vendor, note..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            }}
            sx={{ minWidth: 280 }}
          />
          <TextField
            size="small"
            select
            label="Scope"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value as typeof scopeFilter)}
            sx={{ width: 160 }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="center">Center</MenuItem>
            <MenuItem value="global">Global</MenuItem>
          </TextField>
        </Box>
      </Paper>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Notes</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.date}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{row.category}</Typography>
                  {row.subCategory ? <Typography variant="caption" color="text.secondary">{row.subCategory}</Typography> : null}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.scopeType === 'center' ? row.centerName || 'Center' : 'Global'}
                    color={row.scopeType === 'center' ? 'primary' : 'secondary'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{row.vendor || '—'}</TableCell>
                <TableCell>{row.notes || '—'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{formatINR(row.amount)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEditDialog(row)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => deleteExpense(row.id)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No expenses found for the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {editing ? 'Edit Expense' : 'Add Expense'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Quick, clean entry for expense tracking
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          <Box
            sx={{
              p: 2.5,
              background: 'linear-gradient(160deg, rgba(79,70,229,0.08) 0%, rgba(14,165,233,0.06) 100%)',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Date"
                    value={toDateValue(form.date)}
                    onChange={(value) => {
                      if (!value || Number.isNaN(value.getTime())) {
                        setForm((prev) => ({ ...prev, date: '' }));
                        return;
                      }
                      const y = value.getFullYear();
                      const m = String(value.getMonth() + 1).padStart(2, '0');
                      const d = String(value.getDate()).padStart(2, '0');
                      setForm((prev) => ({ ...prev, date: `${y}-${m}-${d}` }));
                    }}
                    slots={{ openPickerIcon: CalendarMonth }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                      },
                      popper: {
                        sx: {
                          '& .MuiPaper-root': {
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)',
                          },
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Amount"
                  value={form.amount || ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CurrencyRupee fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Payment for"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Marketing, service fee, rent, electricity..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <AccountBalanceWallet fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Center"
                  value={form.centerId || ''}
                  onChange={(e) => {
                    const center = centers.find((item) => item.id === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      scopeType: 'center',
                      centerId: e.target.value,
                      centerName: center?.name || '',
                    }));
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Business fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                >
                  <MenuItem value="" disabled>
                    {centers.length > 0 ? 'Select center' : 'No centers available'}
                  </MenuItem>
                  {centers.map((center) => (
                    <MenuItem key={center.id} value={center.id}>{center.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveExpense}>{editing ? 'Update' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!message} autoHideDuration={5000} onClose={() => setMessage(null)}>
        <Alert severity={message?.type || 'success'} onClose={() => setMessage(null)}>{message?.text}</Alert>
      </Snackbar>
    </Box>
  );
}
