'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DomainIcon from '@mui/icons-material/Domain';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import InventoryTransfer from '@/components/admin/InventoryTransfer';

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

export default function CentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [companies, setCompanies] = useState<Array<{id: string; name: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCenter, setCurrentCenter] = useState<Center | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');

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
    if (!form.name.trim()) {
      alert('Center name is required');
      return;
    }
    try {
      setLoading(true);
      
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
      setLoading(false);
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
                              const label = u?.displayName || u?.email || uid;
                              return <Chip key={uid} label={label} size="small" />;
                            })}
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <IconButton 
                              size="small" 
                              color="primary" 
                              onClick={() => handleEdit(c)}
                              sx={{ 
                                '&:hover': { 
                                  bgcolor: 'primary.lighter' 
                                } 
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={() => handleDelete(c)}
                              disabled={c.isHeadOffice}
                              sx={{ 
                                '&:hover': { 
                                  bgcolor: 'error.lighter' 
                                } 
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
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
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSave} 
            startIcon={editMode ? <EditIcon /> : <AddIcon />} 
            disabled={!form.name.trim() || loading}
          >
            {editMode ? 'Update Center' : 'Add Center'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Inventory Transfer Dialog */}
      <InventoryTransfer 
        open={transferDialogOpen}
        onClose={() => setTransferDialogOpen(false)}
      />
    </Box>
  );
}


