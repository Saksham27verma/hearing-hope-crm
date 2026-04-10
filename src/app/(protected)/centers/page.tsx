'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  Tooltip,
} from '@mui/material';
import AsyncActionButton from '@/components/common/AsyncActionButton';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DomainIcon from '@mui/icons-material/Domain';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, updateDoc, doc, deleteDoc, getDoc, setDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import InventoryTransfer from '@/components/admin/InventoryTransfer';
import CenterExpensesForm, { CenterExpense, CenterExpenseHistorySummary } from '@/components/centers/CenterExpensesForm';
import { useAuth } from '@/context/AuthContext';

interface Center {
  id: string;
  name: string;
  monthlyRent: number;
  monthlyElectricity: number;
  otherMonthlyExpenses: number;
  staffIds: string[];
  companies?: string[]; // Array of company names
  isHeadOffice?: boolean;
  createdAt?: any;
}

interface StaffUser {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildExpenseDocId(centerId: string, month: string) {
  return `${centerId}_${month}`;
}

function stripUndefinedForFirestore(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(data).filter(([key, value]) => value !== undefined && key !== 'id'),
  );
}

function getFirestoreErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message;
  switch (code) {
    case 'permission-denied':
      return `${fallback}: you do not have permission for this action.`;
    case 'failed-precondition':
      return `${fallback}: Firestore index/config is missing. Please contact admin.`;
    case 'unavailable':
      return `${fallback}: Firestore service is temporarily unavailable. Please retry.`;
    case 'deadline-exceeded':
      return `${fallback}: request timed out. Please retry.`;
    case 'network-request-failed':
      return `${fallback}: network issue detected. Check internet and retry.`;
    default:
      return message ? `${fallback}: ${message}` : fallback;
  }
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CentersPage() {
  const { userProfile } = useAuth();
  const canManageExpenses = userProfile?.isSuperAdmin || userProfile?.role === 'admin';

  const [centers, setCenters] = useState<Center[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [companies, setCompanies] = useState<Array<{id: string; name: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [savingCenter, setSavingCenter] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCenter, setCurrentCenter] = useState<Center | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');

  // Expense tracking state
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseCenter, setExpenseCenter] = useState<Center | null>(null);
  const [currentExpenseData, setCurrentExpenseData] = useState<CenterExpense | undefined>();
  const [expenseHistory, setExpenseHistory] = useState<CenterExpenseHistorySummary[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [savingExpenses, setSavingExpenses] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    name: '',
    monthlyRent: '',
    monthlyElectricity: '',
    otherMonthlyExpenses: '',
    staffIds: [] as string[],
    companies: [] as string[],
    isHeadOffice: false,
  });

  const totalMonthly = useMemo(() => (center: Center) => {
    return (
      (center.monthlyRent || 0) +
      (center.monthlyElectricity || 0) +
      (center.otherMonthlyExpenses || 0)
    );
  }, []);

  // ── Expense context loader ───────────────────────────────────────────────
  const loadExpenseContext = async (center: Center) => {
    setLoadingExpenses(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'centerExpenses'), where('centerId', '==', center.id)),
      );
      const raw: CenterExpense[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CenterExpense, 'id'>),
      }));

      // Deduplicate by month — keep the deterministic-ID record when both exist
      const byMonth = new Map<string, CenterExpense>();
      raw.forEach((exp) => {
        const existing = byMonth.get(exp.month);
        if (!existing) {
          byMonth.set(exp.month, exp);
        } else {
          const deterministicId = buildExpenseDocId(center.id, exp.month);
          if (exp.id === deterministicId) byMonth.set(exp.month, exp);
        }
      });

      const history: CenterExpenseHistorySummary[] = Array.from(byMonth.values())
        .sort((a, b) => b.month.localeCompare(a.month))
        .map((e) => ({
          id: e.id!,
          month: e.month,
          totalExpenses: e.totalExpenses,
          isPaid: e.isPaid,
        }));

      setExpenseHistory(history);

      // Default to latest month record (or blank for current month)
      const latest = history[0] ? byMonth.get(history[0].month) : undefined;
      setCurrentExpenseData(latest);
    } catch (err) {
      console.error('Error loading expense context:', err);
      setErrorMsg(getFirestoreErrorMessage(err, 'Failed to load expense history'));
    } finally {
      setLoadingExpenses(false);
    }
  };

  const handleExpenseMonthChange = async (month: string) => {
    if (!expenseCenter) return;
    setLoadingExpenses(true);
    try {
      const deterministicRef = doc(db, 'centerExpenses', buildExpenseDocId(expenseCenter.id, month));
      const deterministicSnap = await getDoc(deterministicRef);
      if (deterministicSnap.exists()) {
        setCurrentExpenseData({ id: deterministicSnap.id, ...(deterministicSnap.data() as Omit<CenterExpense, 'id'>) });
      } else {
        // Fallback: query by centerId + month (legacy record)
        const snap = await getDocs(
          query(
            collection(db, 'centerExpenses'),
            where('centerId', '==', expenseCenter.id),
            where('month', '==', month),
          ),
        );
        if (!snap.empty) {
          const d = snap.docs[0];
          setCurrentExpenseData({ id: d.id, ...(d.data() as Omit<CenterExpense, 'id'>) });
        } else {
          setCurrentExpenseData(undefined);
        }
      }
    } catch (err) {
      console.error('Error loading expense month:', err);
      setErrorMsg(getFirestoreErrorMessage(err, 'Failed to load expenses for selected month'));
    } finally {
      setLoadingExpenses(false);
    }
  };

  const handleOpenExpenses = async (center: Center) => {
    setExpenseCenter(center);
    setExpenseDialogOpen(true);
    await loadExpenseContext(center);
  };

  const handleSaveExpenses = async (expenseData: CenterExpense) => {
    if (savingExpenses) return;
    try {
      setSavingExpenses(true);
      const docId = buildExpenseDocId(expenseData.centerId, expenseData.month);
      const expenseRef = doc(db, 'centerExpenses', docId);
      const existingDoc = await getDoc(expenseRef);

      const cleanData = stripUndefinedForFirestore(expenseData as unknown as Record<string, unknown>);
      const payload: Record<string, unknown> = {
        ...cleanData,
        centerId: expenseData.centerId,
        month: expenseData.month,
        updatedAt: serverTimestamp(),
        ...(existingDoc.exists() ? {} : { createdAt: serverTimestamp() }),
      };

      await setDoc(expenseRef, payload, { merge: true });
      await loadExpenseContext(expenseCenter!);
      setSuccessMsg(existingDoc.exists() ? 'Expenses updated successfully' : 'Expenses saved successfully');
      setExpenseDialogOpen(false);
      setExpenseCenter(null);
      setCurrentExpenseData(undefined);
      setExpenseHistory([]);
    } catch (err) {
      console.error('Error saving expenses:', err);
      setErrorMsg(getFirestoreErrorMessage(err, 'Failed to save expenses'));
    } finally {
      setSavingExpenses(false);
    }
  };

  // ── Centers loader ──────────────────────────────────────────────────────
  const loadCenters = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'centers'), orderBy('name'));
      const snap = await getDocs(q);
      const list: Center[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setCenters(list);
    } catch (err) {
      console.error('Failed to load centers', err);
      alert('Failed to load centers');
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    try {
      // Load strictly from 'staff' module for curated staff list
      const staffSnap = await getDocs(query(collection(db, 'staff'), orderBy('name', 'asc')));
      const list: StaffUser[] = staffSnap.docs.map((d) => {
        const data = d.data() as any;
        return { uid: d.id, name: data.name, email: data.email, phone: data.phone };
      });
      setStaff(list);
    } catch (err) {
      console.error('Failed to load staff', err);
    }
  };

  const loadCompanies = async () => {
    try {
      const companiesSnap = await getDocs(query(collection(db, 'companies'), orderBy('name', 'asc')));
      const list = companiesSnap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || d.id
      }));
      setCompanies(list);
    } catch (err) {
      console.error('Failed to load companies', err);
    }
  };

  useEffect(() => {
    loadCenters();
    loadStaff();
    loadCompanies();
  }, []);

  const resetForm = () => {
    setForm({ name: '', monthlyRent: '', monthlyElectricity: '', otherMonthlyExpenses: '', staffIds: [], companies: [], isHeadOffice: false });
    setEditMode(false);
    setCurrentCenter(null);
  };

  const handleSave = async () => {
    if (savingCenter) return;
    if (!form.name.trim()) {
      alert('Center name is required');
      return;
    }
    try {
      setSavingCenter(true);
      
      // If this center is being marked as head office, unmark all others
      if (form.isHeadOffice) {
        const headOfficeUpdates = centers
          .filter(center => center.isHeadOffice && center.id !== currentCenter?.id)
          .map(center => updateDoc(doc(db, 'centers', center.id), { isHeadOffice: false }));
        await Promise.all(headOfficeUpdates);
      }
      
      const payload = {
        name: form.name.trim(),
        monthlyRent: Number(form.monthlyRent) || 0,
        monthlyElectricity: Number(form.monthlyElectricity) || 0,
        otherMonthlyExpenses: Number(form.otherMonthlyExpenses) || 0,
        staffIds: form.staffIds,
        companies: form.companies,
        isHeadOffice: form.isHeadOffice,
      };

      if (editMode && currentCenter) {
        // Update existing center
        await updateDoc(doc(db, 'centers', currentCenter.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Add new center
        await addDoc(collection(db, 'centers'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }
      
      setOpenDialog(false);
      resetForm();
      await loadCenters();
    } catch (err) {
      console.error('Failed to save center', err);
      alert('Failed to save center');
    } finally {
      setSavingCenter(false);
    }
  };

  const handleEdit = (center: Center) => {
    setCurrentCenter(center);
    setEditMode(true);
    setForm({
      name: center.name,
      monthlyRent: center.monthlyRent?.toString() || '',
      monthlyElectricity: center.monthlyElectricity?.toString() || '',
      otherMonthlyExpenses: center.otherMonthlyExpenses?.toString() || '',
      staffIds: center.staffIds || [],
      companies: center.companies || [],
      isHeadOffice: center.isHeadOffice || false,
    });
    setOpenDialog(true);
  };

  const handleDelete = async (center: Center) => {
    if (!confirm(`Are you sure you want to delete "${center.name}"? This action cannot be undone.`)) {
      return;
    }
    
    if (center.isHeadOffice) {
      alert('Cannot delete head office. Please mark another center as head office first.');
      return;
    }
    
    try {
      setLoading(true);
      await deleteDoc(doc(db, 'centers', center.id));
      await loadCenters();
    } catch (err) {
      console.error('Failed to delete center', err);
      alert('Failed to delete center');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setOpenDialog(true);
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Paper sx={{ mb: 3, p: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ bgcolor: 'primary.lighter', color: 'primary.main', p: 1, borderRadius: 1 }}>
              <DomainIcon />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>Centers</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search centers..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ minWidth: 240 }}
            />
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadCenters} disabled={loading} sx={{ borderRadius: 1.5 }}>
              Refresh
            </Button>
            <Button variant="outlined" startIcon={<TransferWithinAStationIcon />} onClick={() => setTransferDialogOpen(true)} sx={{ borderRadius: 1.5 }}>
              Transfer Inventory
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddDialog} sx={{ borderRadius: 1.5 }}>
              Add Center
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
        {centers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <DomainIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
            <Typography variant="h6">No centers added</Typography>
            <Typography variant="body2">Click "Add Center" to create your first center.</Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ 
              border: '1px solid rgba(0,0,0,0.05)', 
              borderRadius: 2,
              maxHeight: 'calc(100vh - 340px)',
              '&::-webkit-scrollbar': { width: 8, height: 8 },
              '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4 }
            }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 'bold', bgcolor: 'primary.lighter' } }}>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Companies</TableCell>
                    <TableCell align="right">Monthly Rent</TableCell>
                    <TableCell align="right">Electricity</TableCell>
                    <TableCell align="right">Other Expenses</TableCell>
                    <TableCell align="right">Total Monthly</TableCell>
                    <TableCell>Staff</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {centers
                    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((c, idx) => (
                      <TableRow key={c.id} hover sx={{ '&:nth-of-type(odd)': { bgcolor: 'background.default' } }}>
                        <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                        <TableCell>
                          {c.isHeadOffice ? (
                            <Chip 
                              label="Head Office" 
                              size="small" 
                              color="primary" 
                              variant="filled" 
                            />
                          ) : (
                            <Chip 
                              label="Branch" 
                              size="small" 
                              color="default" 
                              variant="outlined" 
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {(c.companies && c.companies.length > 0) ? (
                              c.companies.map((companyName) => (
                                <Chip 
                                  key={companyName} 
                                  label={companyName} 
                                  size="small" 
                                  color="primary"
                                  variant="outlined"
                                  icon={<DomainIcon fontSize="small" />}
                                />
                              ))
                            ) : (
                              <Typography variant="caption" color="text.secondary">-</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(c.monthlyRent)}</TableCell>
                        <TableCell align="right">{formatCurrency(c.monthlyElectricity)}</TableCell>
                        <TableCell align="right">{formatCurrency(c.otherMonthlyExpenses)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>{formatCurrency(totalMonthly(c))}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {(c.staffIds || []).map((uid) => {
                              const u = staff.find((s) => s.uid === uid);
                              const label = u?.name || u?.email || uid;
                              return <Chip key={uid} label={label} size="small" />;
                            })}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title="Edit Center">
                              <IconButton 
                                size="small" 
                                color="primary" 
                                onClick={() => handleEdit(c)}
                                sx={{ '&:hover': { bgcolor: 'primary.lighter' } }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {canManageExpenses && (
                              <Tooltip title="Track Rent & Maintenance">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenExpenses(c)}
                                  sx={{
                                    color: 'success.main',
                                    '&:hover': { bgcolor: (t) => `${t.palette.success.main}14` },
                                  }}
                                >
                                  <AccountBalanceWalletIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title={c.isHeadOffice ? 'Cannot delete head office' : 'Delete Center'}>
                              <span>
                                <IconButton 
                                  size="small" 
                                  color="error" 
                                  onClick={() => handleDelete(c)}
                                  disabled={c.isHeadOffice}
                                  sx={{ '&:hover': { bgcolor: 'error.lighter' } }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', p: 1 }}>
              <TablePagination
                component="div"
                count={centers.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).length}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </Box>
          </>
        )}
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ bgcolor: 'primary.lighter', color: 'primary.main', p: 1, borderRadius: 1 }}>
            <DomainIcon />
          </Box>
          {editMode ? 'Edit Center' : 'Add Center'}
        </DialogTitle>
        <DialogContent dividers>
          {(() => {
            const rent = Number(form.monthlyRent) || 0;
            const elec = Number(form.monthlyElectricity) || 0;
            const other = Number(form.otherMonthlyExpenses) || 0;
            const total = rent + elec + other;
            const nameError = !form.name.trim();
            const rentError = rent < 0;
            const elecError = elec < 0;
            const otherError = other < 0;
            return (
              <Box sx={{ mt: 1 }}>
                {/* Summary card */}
                <Box sx={{ mb: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Monthly Rent</Typography>
                      <Typography variant="h6">{formatCurrency(rent)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Electricity</Typography>
                      <Typography variant="h6">{formatCurrency(elec)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="caption" color="text.secondary">Total Monthly</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>{formatCurrency(total)}</Typography>
                    </Grid>
                  </Grid>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Center Name"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      required
                      error={nameError}
                      helperText={nameError ? 'Center name is required' : ' '}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Staff</InputLabel>
                      <Select
                        multiple
                        label="Staff"
                        value={form.staffIds}
                        onChange={(e) => setForm((p) => ({ ...p, staffIds: e.target.value as string[] }))}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {(selected as string[]).map((uid) => {
                              const u = staff.find((s) => s.uid === uid);
                              return <Chip key={uid} label={u?.name || uid} size="small" />;
                            })}
                          </Box>
                        )}
                      >
                        {staff.map((u) => (
                          <MenuItem key={u.uid} value={u.uid}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={(u.name || '').toString().slice(0,1).toUpperCase()} size="small" />
                              <Box>
                                <Typography>{u.name}</Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Companies</InputLabel>
                      <Select
                        multiple
                        label="Companies"
                        value={form.companies}
                        onChange={(e) => setForm((p) => ({ ...p, companies: e.target.value as string[] }))}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {(selected as string[]).map((companyName) => (
                              <Chip key={companyName} label={companyName} size="small" color="primary" />
                            ))}
                          </Box>
                        )}
                      >
                        {companies.map((company) => (
                          <MenuItem key={company.id} value={company.name}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <DomainIcon fontSize="small" color="primary" />
                              <Typography>{company.name}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      Select one or more companies that this center operates for
                    </Typography>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Monthly Rent"
                      type="number"
                      value={form.monthlyRent}
                      onChange={(e) => setForm((p) => ({ ...p, monthlyRent: e.target.value }))}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      error={rentError}
                      helperText={rentError ? 'Cannot be negative' : ' '}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Electricity (Monthly)"
                      type="number"
                      value={form.monthlyElectricity}
                      onChange={(e) => setForm((p) => ({ ...p, monthlyElectricity: e.target.value }))}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      error={elecError}
                      helperText={elecError ? 'Cannot be negative' : ' '}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Other Expenses (Monthly)"
                      type="number"
                      value={form.otherMonthlyExpenses}
                      onChange={(e) => setForm((p) => ({ ...p, otherMonthlyExpenses: e.target.value }))}
                      InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      error={otherError}
                      helperText={otherError ? 'Cannot be negative' : ' '}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.isHeadOffice}
                          onChange={(e) => setForm((p) => ({ ...p, isHeadOffice: e.target.checked }))}
                          color="primary"
                        />
                      }
                      label="Mark as Head Office"
                      sx={{ mt: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 4 }}>
                      The head office will be the default location for all purchases and material inward entries. Only one head office can be active at a time.
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => !savingCenter && setOpenDialog(false)} disabled={savingCenter}>Cancel</Button>
          <AsyncActionButton 
            variant="contained" 
            onClick={handleSave} 
            startIcon={editMode ? <EditIcon /> : <AddIcon />} 
            disabled={!form.name.trim()}
            loading={savingCenter}
            loadingText={editMode ? 'Updating Center...' : 'Saving Center...'}
          >
            {editMode ? 'Update Center' : 'Add Center'}
          </AsyncActionButton>
        </DialogActions>
      </Dialog>

      {/* Inventory Transfer Dialog */}
      <InventoryTransfer 
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
      />

      {/* Rent & Maintenance Expense Tracking Dialog */}
      <Dialog
        open={expenseDialogOpen}
        onClose={() => !savingExpenses && setExpenseDialogOpen(false)}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            height: '90vh',
            borderRadius: 3,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
          {expenseCenter && (
            <CenterExpensesForm
              center={expenseCenter}
              initialData={currentExpenseData}
              expenseHistory={expenseHistory}
              onMonthChange={handleExpenseMonthChange}
              onSave={handleSaveExpenses}
              onCancel={() => {
                if (!savingExpenses) {
                  setExpenseDialogOpen(false);
                  setExpenseCenter(null);
                  setCurrentExpenseData(undefined);
                  setExpenseHistory([]);
                }
              }}
              isSaving={savingExpenses}
              loading={loadingExpenses}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Success / Error Snackbars */}
      <Snackbar
        open={!!successMsg}
        autoHideDuration={4000}
        onClose={() => setSuccessMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSuccessMsg('')} sx={{ borderRadius: 2 }}>
          {successMsg}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!errorMsg}
        autoHideDuration={7000}
        onClose={() => setErrorMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setErrorMsg('')} sx={{ borderRadius: 2 }}>
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}


