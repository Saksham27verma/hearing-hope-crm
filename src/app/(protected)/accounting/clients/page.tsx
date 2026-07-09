'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as InvoiceIcon,
  MoreVert as MoreIcon,
  AccountBalance as LedgerIcon,
  Payments as PaymentsIcon,
} from '@mui/icons-material';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import AccountingClientDialog from '@/components/accounting/AccountingClientDialog';
import type { AccountingClient } from '@/lib/accounting/types';
import { formatINR } from '@/lib/accounting/computations';

export default function AccountingClientsPage() {
  const router = useRouter();
  const { selectedCompanyId } = useAccountingCompany();

  const [clients, setClients] = useState<AccountingClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountingClient | null>(null);
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuClient, setMenuClient] = useState<AccountingClient | null>(null);

  const load = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'accountingClients'),
        where('companyId', '==', selectedCompanyId),
      );
      const snap = await getDocs(q);
      const rows: AccountingClient[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AccountingClient, 'id'>),
      }));
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setClients(rows);
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Failed to load clients', sev: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.gstin || '').toLowerCase().includes(s) ||
        (c.phone || '').toLowerCase().includes(s) ||
        (c.email || '').toLowerCase().includes(s),
    );
  }, [clients, search]);

  const handleCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (c: AccountingClient) => {
    setEditing(c);
    setDialogOpen(true);
  };

  const handleSubmit = async (data: AccountingClient) => {
    if (!selectedCompanyId) return;
    try {
      if (data.id) {
        const { id, createdAt, ...rest } = data;
        void createdAt;
        await updateDoc(doc(db, 'accountingClients', id), {
          ...rest,
          companyId: selectedCompanyId,
          updatedAt: serverTimestamp(),
        });
        setSnack({ msg: 'Client updated', sev: 'success' });
      } else {
        const { id, ...rest } = data;
        void id;
        await addDoc(collection(db, 'accountingClients'), {
          ...rest,
          companyId: selectedCompanyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSnack({ msg: 'Client created', sev: 'success' });
      }
      await load();
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Save failed', sev: 'error' });
    }
  };

  const handleDelete = async (c: AccountingClient) => {
    if (!c.id) return;
    if (!confirm(`Delete client "${c.name}"? Their invoices/payments will remain but become unlinked.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'accountingClients', c.id));
      setSnack({ msg: 'Client deleted', sev: 'success' });
      await load();
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Delete failed', sev: 'error' });
    }
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, c: AccountingClient) => {
    setMenuAnchor(e.currentTarget);
    setMenuClient(c);
  };
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuClient(null);
  };

  if (!selectedCompanyId) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Accounting Clients
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage the client master for invoices and ledgers.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
          Add Client
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <TextField
          fullWidth
          size="small"
          placeholder="Search by name, GSTIN, phone or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>GSTIN</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>State</TableCell>
              <TableCell align="right">Opening</TableCell>
              <TableCell align="right" width={140}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">
                    {clients.length === 0 ? 'No clients yet. Add your first one.' : 'No matches.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{c.name}</Typography>
                    {c.email && (
                      <Typography variant="caption" color="text.secondary">
                        {c.email}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{c.gstin || '—'}</TableCell>
                  <TableCell>{c.phone || '—'}</TableCell>
                  <TableCell>{c.state || '—'}</TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      label={`${formatINR(c.openingBalance || 0)} ${c.openingBalanceType === 'debit' ? 'Dr' : 'Cr'}`}
                      color={c.openingBalanceType === 'debit' ? 'warning' : 'success'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Create Invoice">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() =>
                          router.push(`/accounting/invoices/new?clientId=${c.id}`)
                        }
                      >
                        <InvoiceIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEdit(c)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="More">
                      <IconButton size="small" onClick={(e) => openMenu(e, c)}>
                        <MoreIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            const c = menuClient;
            closeMenu();
            if (c?.id) router.push(`/accounting/ledger?clientId=${c.id}`);
          }}
        >
          <ListItemIcon>
            <LedgerIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Ledger</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const c = menuClient;
            closeMenu();
            if (c?.id) router.push(`/accounting/payments?clientId=${c.id}&action=new`);
          }}
        >
          <ListItemIcon>
            <PaymentsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Log Payment</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const c = menuClient;
            closeMenu();
            if (c) void handleDelete(c);
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <AccountingClientDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        companyId={selectedCompanyId}
        initial={editing}
        onSubmit={handleSubmit}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? <Alert severity={snack.sev}>{snack.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
