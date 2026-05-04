'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Autocomplete,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  SwapHoriz as TransferIcon,
  Undo as ReturnIcon,
  Refresh as RefreshIcon,
  DeleteOutline as DeleteLineIcon,
  Person as PersonIcon,
  Inventory2Outlined as StockIcon,
} from '@mui/icons-material';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';

type StaffOption = { id: string; name: string; jobRole?: string };

type AvailableSerialRow = {
  lineId: string;
  productId: string;
  name: string;
  company: string;
  type: string;
  serialNumber: string;
};

type CustodyRow = {
  id: string;
  productId: string;
  serialNumbers: string[];
  staffId: string;
  staffName: string;
  centerId?: string | null;
  assignedAt?: number;
  updatedAt?: number;
  notes?: string;
};

type ProductLite = { id: string; name?: string; quantityType?: string; quantityTypeLegacy?: string; type?: string };

type DraftLine = { localId: string; productId: string | null; serialNumbers: string[] };

type TypeFilterKey = 'all' | 'hearing' | 'battery' | 'accessory' | 'charger' | 'other';

const TYPE_FILTER_CHIPS: { key: TypeFilterKey; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'hearing', label: 'Hearing aids' },
  { key: 'battery', label: 'Batteries' },
  { key: 'accessory', label: 'Accessories' },
  { key: 'charger', label: 'Chargers' },
  { key: 'other', label: 'Other' },
];

function classifyProductType(t: string): TypeFilterKey {
  const s = t.toLowerCase();
  if (s.includes('hearing')) return 'hearing';
  if (s.includes('battery')) return 'battery';
  if (s.includes('accessory')) return 'accessory';
  if (s.includes('charger') || s.includes('charging')) return 'charger';
  return 'other';
}

function newDraftLine(): DraftLine {
  return { localId: `l-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, productId: null, serialNumbers: [] };
}

export default function StaffStockAssignPage() {
  const theme = useTheme();
  const { user, userProfile, loading: authLoading } = useAuth();
  const roleLower = String((userProfile as { role?: string } | undefined)?.role || '').toLowerCase();
  const canMutate = roleLower === 'admin' || roleLower === 'staff';

  const [custodyRows, setCustodyRows] = useState<CustodyRow[]>([]);
  const [loadingCustody, setLoadingCustody] = useState(true);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [productsById, setProductsById] = useState<Record<string, ProductLite>>({});
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);

  const [search, setSearch] = useState('');
  const [filterStaffId, setFilterStaffId] = useState<string | ''>('');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState<string | null>(null);
  const [assignCenterId, setAssignCenterId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [pickerTypeFilter, setPickerTypeFilter] = useState<TypeFilterKey>('all');
  const [availableRows, setAvailableRows] = useState<AvailableSerialRow[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const [transferRow, setTransferRow] = useState<CustodyRow | null>(null);
  const [transferToStaffId, setTransferToStaffId] = useState<string | null>(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const [returnRow, setReturnRow] = useState<CustodyRow | null>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);

  const [staffDrawer, setStaffDrawer] = useState<{ staffId: string; name: string } | null>(null);

  const bearerFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const token = user ? await user.getIdToken() : null;
      if (!token) throw new Error('Not signed in');
      return fetch(input, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    },
    [user],
  );

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      collection(db, 'staffTrialCustody'),
      (snap) => {
        const rows: CustodyRow[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>;
          const serialNumbers = Array.isArray(x.serialNumbers)
            ? (x.serialNumbers as unknown[]).map((s) => String(s || '').trim()).filter(Boolean)
            : [];
          return {
            id: d.id,
            productId: String(x.productId || ''),
            serialNumbers,
            staffId: String(x.staffId || ''),
            staffName: String(x.staffName || ''),
            centerId: (x.centerId as string | null | undefined) ?? null,
            assignedAt: typeof x.assignedAt === 'number' ? x.assignedAt : undefined,
            updatedAt: typeof x.updatedAt === 'number' ? x.updatedAt : undefined,
            notes: typeof x.notes === 'string' ? x.notes : undefined,
          };
        });
        rows.sort((a, b) => (b.updatedAt || b.assignedAt || 0) - (a.updatedAt || a.assignedAt || 0));
        setCustodyRows(rows);
        setLoadingCustody(false);
      },
      () => setLoadingCustody(false),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db) return;
    void (async () => {
      try {
        const [pSnap, cSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'centers')),
        ]);
        const pmap: Record<string, ProductLite> = {};
        pSnap.docs.forEach((d) => {
          const data = d.data() as ProductLite;
          pmap[d.id] = { id: d.id, ...data };
        });
        setProductsById(pmap);
        setCenters(
          cSnap.docs.map((d) => {
            const x = d.data() as { name?: string; displayName?: string; centerName?: string };
            const name =
              String(x.name || x.displayName || x.centerName || '').trim() || d.id;
            return { id: d.id, name };
          }),
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const loadStaff = useCallback(async () => {
    if (!user) return;
    try {
      const res = await bearerFetch('/api/staff/enquiry-options');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load staff');
      setStaffOptions(json.staff as StaffOption[]);
    } catch (e) {
      console.error(e);
      setSnack({ message: e instanceof Error ? e.message : 'Failed to load staff', severity: 'error' });
    }
  }, [bearerFetch, user]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const openAssign = async () => {
    setAssignOpen(true);
    setAssignStaffId(null);
    setAssignCenterId('');
    setAssignNotes('');
    setDraftLines([newDraftLine()]);
    setPickerTypeFilter('all');
    setLoadingAvailable(true);
    try {
      const res = await bearerFetch('/api/staff-trial-stock/available-serials');
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load available serials');
      setAvailableRows((json.items as AvailableSerialRow[]).map((r) => ({ ...r, type: r.type || '' })));
    } catch (e) {
      setSnack({ message: e instanceof Error ? e.message : 'Load failed', severity: 'error' });
      setAvailableRows([]);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const filteredAvailableRows = useMemo(() => {
    if (pickerTypeFilter === 'all') return availableRows;
    return availableRows.filter((r) => classifyProductType(r.type || '') === pickerTypeFilter);
  }, [availableRows, pickerTypeFilter]);

  const productOptionsForPicker = useMemo(() => {
    const ids = new Set<string>();
    filteredAvailableRows.forEach((r) => ids.add(r.productId));
    return [...ids].map((id) => {
      const p = productsById[id];
      const cat = classifyProductType(p?.type || '');
      return {
        id,
        label: p?.name || id,
        sublabel: `${p?.type || 'Product'} · ${id.slice(0, 8)}…`,
        category: cat,
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredAvailableRows, productsById]);

  const serialsForProduct = useCallback(
    (productId: string | null) => {
      if (!productId) return [];
      return filteredAvailableRows
        .filter((r) => r.productId === productId)
        .map((r) => r.serialNumber)
        .sort((a, b) => a.localeCompare(b));
    },
    [filteredAvailableRows],
  );

  const custodyByStaff = useMemo(() => {
    const m = new Map<string, CustodyRow[]>();
    custodyRows.forEach((r) => {
      if (!m.has(r.staffId)) m.set(r.staffId, []);
      m.get(r.staffId)!.push(r);
    });
    return m;
  }, [custodyRows]);

  const drawerItems = useMemo(() => {
    if (!staffDrawer) return [];
    return custodyByStaff.get(staffDrawer.staffId) || [];
  }, [staffDrawer, custodyByStaff]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return custodyRows.filter((row) => {
      if (filterStaffId && row.staffId !== filterStaffId) return false;
      if (!q) return true;
      const pname = (productsById[row.productId]?.name || '').toLowerCase();
      const ptype = (productsById[row.productId]?.type || '').toLowerCase();
      const serialBlob = row.serialNumbers.join(' ').toLowerCase();
      const staff = row.staffName.toLowerCase();
      return (
        pname.includes(q) ||
        ptype.includes(q) ||
        serialBlob.includes(q) ||
        staff.includes(q) ||
        row.productId.toLowerCase().includes(q)
      );
    });
  }, [custodyRows, filterStaffId, productsById, search]);

  const pagedRows = useMemo(
    () => filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredRows, page, rowsPerPage],
  );

  const updateDraftLine = (localId: string, patch: Partial<DraftLine>) => {
    setDraftLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, ...patch } : l)));
  };

  const removeDraftLine = (localId: string) => {
    setDraftLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.localId !== localId)));
  };

  const submitAssignBatch = async () => {
    if (!assignStaffId) {
      setSnack({ message: 'Choose a staff member', severity: 'error' });
      return;
    }
    const lines: { productId: string; serialNumbers: string[] }[] = [];
    for (const d of draftLines) {
      if (!d.productId) continue;
      const prod = productsById[d.productId];
      const pair = (prod?.quantityType || prod?.quantityTypeLegacy) === 'pair';
      const serials = [...new Set(d.serialNumbers.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      );
      if (serials.length === 0) continue;
      if (pair && serials.length !== 2) {
        setSnack({
          message: `Pair product "${prod?.name || d.productId}" needs exactly 2 serials in one row`,
          severity: 'error',
        });
        return;
      }
      if (!pair && serials.length !== 1) {
        setSnack({
          message: `Use one serial per row for "${prod?.name || d.productId}" (add another row for more units)`,
          severity: 'error',
        });
        return;
      }
      lines.push({ productId: d.productId, serialNumbers: serials });
    }
    if (lines.length === 0) {
      setSnack({ message: 'Add at least one product with serials', severity: 'error' });
      return;
    }

    setAssignSubmitting(true);
    try {
      const res = await bearerFetch('/api/staff-trial-stock/assign-batch', {
        method: 'POST',
        body: JSON.stringify({
          staffId: assignStaffId,
          notes: assignNotes.trim() || undefined,
          centerId: assignCenterId.trim() || null,
          lines,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Assign failed');
      setSnack({ message: `Assigned ${lines.length} line(s) to staff`, severity: 'success' });
      setAssignOpen(false);
    } catch (e) {
      setSnack({ message: e instanceof Error ? e.message : 'Assign failed', severity: 'error' });
    } finally {
      setAssignSubmitting(false);
    }
  };

  const submitTransfer = async () => {
    if (!transferRow || !transferToStaffId) return;
    setTransferSubmitting(true);
    try {
      const res = await bearerFetch('/api/staff-trial-stock/transfer', {
        method: 'POST',
        body: JSON.stringify({
          docId: transferRow.id,
          toStaffId: transferToStaffId,
          currentStaffId: transferRow.staffId,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Transfer failed');
      setSnack({ message: 'Transferred', severity: 'success' });
      setTransferRow(null);
      setTransferToStaffId(null);
    } catch (e) {
      setSnack({ message: e instanceof Error ? e.message : 'Transfer failed', severity: 'error' });
    } finally {
      setTransferSubmitting(false);
    }
  };

  const submitReturn = async () => {
    if (!returnRow) return;
    setReturnSubmitting(true);
    try {
      const res = await bearerFetch('/api/staff-trial-stock/return', {
        method: 'POST',
        body: JSON.stringify({
          docId: returnRow.id,
          currentStaffId: returnRow.staffId,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Return failed');
      setSnack({ message: 'Returned to available stock', severity: 'success' });
      setReturnRow(null);
    } catch (e) {
      setSnack({ message: e instanceof Error ? e.message : 'Return failed', severity: 'error' });
    } finally {
      setReturnSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  const panelBg =
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.primary.main, 0.08)
      : alpha(theme.palette.primary.main, 0.04);

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, maxWidth: 1480, mx: 'auto' }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2 }} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={800} letterSpacing={-0.5}>
            Staff stock assign
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 560 }}>
            Assign serial-tracked stock (hearing aids, batteries, chargers, accessories, and more) to executives. Units
            stay visible in inventory as <strong>Staff assign</strong> and are blocked from customer sales until
            returned.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Reload staff list">
            <IconButton onClick={() => void loadStaff()} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canMutate && (
            <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => void openAssign()}>
              Assign stock
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Quick open — staff with assignments
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
          {staffOptions.map((s) => {
            const n = custodyByStaff.get(s.id)?.length || 0;
            if (n === 0) return null;
            return (
              <Chip
                key={s.id}
                icon={<PersonIcon />}
                label={`${s.name} (${n})`}
                onClick={() => setStaffDrawer({ staffId: s.id, name: s.name })}
                color={staffDrawer?.staffId === s.id ? 'primary' : 'default'}
                variant={staffDrawer?.staffId === s.id ? 'filled' : 'outlined'}
                sx={{ fontWeight: 600 }}
              />
            );
          })}
          {custodyRows.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No assignments yet.
            </Typography>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search product, type, serial, staff"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            size="small"
            fullWidth
          />
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <InputLabel>Holder</InputLabel>
            <Select
              label="Holder"
              value={filterStaffId}
              onChange={(e) => {
                setFilterStaffId(e.target.value as string);
                setPage(0);
              }}
            >
              <MenuItem value="">All holders</MenuItem>
              {staffOptions.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        {loadingCustody ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                  <TableCell>Product</TableCell>
                  <TableCell>Serial(s)</TableCell>
                  <TableCell>Holder</TableCell>
                  <TableCell>Center</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell>Notes</TableCell>
                  {canMutate && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {pagedRows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {productsById[row.productId]?.name || row.productId}
                      </Typography>
                      <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap" sx={{ mt: 0.5 }}>
                        <Chip label={productsById[row.productId]?.type || '—'} size="small" variant="outlined" />
                        <Typography variant="caption" color="text.secondary">
                          {row.productId}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {row.serialNumbers.map((sn) => (
                          <Chip key={sn} label={sn} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="text"
                        size="small"
                        startIcon={<PersonIcon fontSize="small" />}
                        onClick={() => setStaffDrawer({ staffId: row.staffId, name: row.staffName })}
                        sx={{ fontWeight: 700, textTransform: 'none', justifyContent: 'flex-start', px: 0.5 }}
                      >
                        {row.staffName}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {row.centerId
                        ? centers.find((c) => c.id === row.centerId)?.name || row.centerId
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {row.updatedAt || row.assignedAt
                        ? new Date(row.updatedAt || row.assignedAt || 0).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>{row.notes || '—'}</TableCell>
                    {canMutate && (
                      <TableCell align="right">
                        <Tooltip title="Transfer">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setTransferRow(row);
                              setTransferToStaffId(null);
                            }}
                          >
                            <TransferIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Return to pool">
                          <IconButton size="small" color="warning" onClick={() => setReturnRow(row)}>
                            <ReturnIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {pagedRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canMutate ? 7 : 6} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        No stock assigned to staff yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredRows.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          </>
        )}
      </TableContainer>

      <Drawer anchor="right" open={!!staffDrawer} onClose={() => setStaffDrawer(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 440 } } }}>
        {staffDrawer && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" fontWeight={800}>
                {staffDrawer.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {drawerItems.length} item{drawerItems.length === 1 ? '' : 's'} assigned
              </Typography>
            </Box>
            <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
              {drawerItems.map((row) => (
                <React.Fragment key={row.id}>
                  <ListItem
                    secondaryAction={
                      canMutate ? (
                        <Stack direction="row">
                          <IconButton size="small" onClick={() => { setStaffDrawer(null); setTransferRow(row); }}>
                            <TransferIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="warning" onClick={() => { setStaffDrawer(null); setReturnRow(row); }}>
                            <ReturnIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : undefined
                    }
                  >
                    <ListItemText
                      primary={
                        <Typography fontWeight={700}>{productsById[row.productId]?.name || row.productId}</Typography>
                      }
                      secondary={
                        <>
                          <Chip size="small" label={row.serialNumbers.join(', ')} sx={{ mt: 0.5 }} />
                          {row.notes ? (
                            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                              {row.notes}
                            </Typography>
                          ) : null}
                        </>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              ))}
            </List>
            <Box sx={{ p: 2 }}>
              <Button fullWidth variant="outlined" onClick={() => setStaffDrawer(null)}>
                Close
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>

      <Dialog
        open={assignOpen}
        onClose={() => !assignSubmitting && setAssignOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <StockIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={800}>
                Assign stock to staff
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add one or more products below. Each row is one custody record (one serial, or two for pair hearing aids).
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: panelBg }}>
          {loadingAvailable ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={3}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom color="primary">
                  Recipient
                </Typography>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Autocomplete
                    options={staffOptions}
                    getOptionLabel={(s) => s.name}
                    value={staffOptions.find((s) => s.id === assignStaffId) || null}
                    onChange={(_, v) => setAssignStaffId(v?.id || null)}
                    renderInput={(params) => <TextField {...params} label="Staff member *" placeholder="Search name" />}
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel>Issuing center (optional)</InputLabel>
                    <Select
                      label="Issuing center (optional)"
                      value={assignCenterId}
                      onChange={(e) => setAssignCenterId(e.target.value)}
                    >
                      <MenuItem value="">—</MenuItem>
                      {centers.map((c) => (
                        <MenuItem key={c.id} value={c.id}>
                          {c.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Notes (applies to all lines in this batch)"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                    placeholder="e.g. Field trial kit for March"
                  />
                </Stack>
              </Paper>

              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Products & serials
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {availableRows.length} units available to pick
                  </Typography>
                </Stack>
                <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mb: 2 }}>
                  {TYPE_FILTER_CHIPS.map((c) => (
                    <Chip
                      key={c.key}
                      label={c.label}
                      size="small"
                      onClick={() => setPickerTypeFilter(c.key)}
                      color={pickerTypeFilter === c.key ? 'primary' : 'default'}
                      variant={pickerTypeFilter === c.key ? 'filled' : 'outlined'}
                    />
                  ))}
                </Stack>

                <Stack spacing={2}>
                  {draftLines.map((line, idx) => {
                    const prod = line.productId ? productsById[line.productId] : null;
                    const pair = prod && (prod.quantityType || prod.quantityTypeLegacy) === 'pair';
                    const serialOpts = serialsForProduct(line.productId);
                    return (
                      <Paper
                        key={line.localId}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          bgcolor: 'background.paper',
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                          <Typography variant="caption" fontWeight={800} color="text.secondary">
                            LINE {idx + 1}
                          </Typography>
                          {draftLines.length > 1 && (
                            <IconButton size="small" onClick={() => removeDraftLine(line.localId)} aria-label="Remove line">
                              <DeleteLineIcon fontSize="small" />
                            </IconButton>
                          )}
                        </Stack>
                        <Stack spacing={2}>
                          <Autocomplete
                            options={productOptionsForPicker}
                            getOptionLabel={(o) => o.label}
                            isOptionEqualToValue={(a, b) => a.id === b.id}
                            value={productOptionsForPicker.find((p) => p.id === line.productId) || null}
                            onChange={(_, v) =>
                              updateDraftLine(line.localId, { productId: v?.id || null, serialNumbers: [] })
                            }
                            groupBy={(o) => {
                              const labels: Record<TypeFilterKey, string> = {
                                all: 'Other',
                                hearing: 'Hearing aids',
                                battery: 'Batteries',
                                accessory: 'Accessories',
                                charger: 'Chargers',
                                other: 'Other',
                              };
                              return labels[o.category];
                            }}
                            renderInput={(params) => <TextField {...params} label="Product" placeholder="Search catalog" />}
                            renderOption={(props, option) => (
                              <li {...props} key={option.id}>
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>
                                    {option.label}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {option.sublabel}
                                  </Typography>
                                </Box>
                              </li>
                            )}
                          />
                          <Autocomplete
                            multiple
                            options={serialOpts}
                            value={line.serialNumbers}
                            onChange={(_, v) => updateDraftLine(line.localId, { serialNumbers: v })}
                            disabled={!line.productId}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label={pair ? 'Serial numbers (2 for pair)' : 'Serial number'}
                                placeholder={pair ? 'Pick left & right' : 'Pick one serial'}
                                helperText={
                                  pair
                                    ? 'Pair products: select exactly two serials on this line.'
                                    : 'One serial per line — add another line for more units.'
                                }
                              />
                            )}
                          />
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setDraftLines((prev) => [...prev, newDraftLine()])}
                  sx={{ mt: 2 }}
                  variant="outlined"
                >
                  Add another product line
                </Button>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: 'background.paper' }}>
          <Button onClick={() => setAssignOpen(false)} disabled={assignSubmitting}>
            Cancel
          </Button>
          <Button variant="contained" size="large" onClick={() => void submitAssignBatch()} disabled={assignSubmitting}>
            {assignSubmitting ? <CircularProgress size={24} /> : 'Assign all lines'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!transferRow}
        onClose={() => !transferSubmitting && setTransferRow(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Transfer assignment</DialogTitle>
        <DialogContent>
          {transferRow && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2">
                {productsById[transferRow.productId]?.name || transferRow.productId}:{' '}
                {transferRow.serialNumbers.join(', ')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                From: {transferRow.staffName}
              </Typography>
              <Autocomplete
                options={staffOptions.filter((s) => s.id !== transferRow.staffId)}
                getOptionLabel={(s) => s.name}
                value={staffOptions.find((s) => s.id === transferToStaffId) || null}
                onChange={(_, v) => setTransferToStaffId(v?.id || null)}
                renderInput={(params) => <TextField {...params} label="Transfer to" />}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferRow(null)} disabled={transferSubmitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void submitTransfer()} disabled={transferSubmitting}>
            {transferSubmitting ? <CircularProgress size={22} /> : 'Transfer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!returnRow} onClose={() => !returnSubmitting && setReturnRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Return to stock</DialogTitle>
        <DialogContent>
          {returnRow && (
            <Typography sx={{ mt: 1 }}>
              Remove assignment for {returnRow.staffName}? Serials {returnRow.serialNumbers.join(', ')} will be
              available for customer sales again (if still in inventory).
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReturnRow(null)} disabled={returnSubmitting}>
            Cancel
          </Button>
          <Button color="warning" variant="contained" onClick={() => void submitReturn()} disabled={returnSubmitting}>
            {returnSubmitting ? <CircularProgress size={22} /> : 'Return'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
