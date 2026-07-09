'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
  MenuItem,
  Snackbar,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import PaymentDialog from '@/components/accounting/PaymentDialog';
import type { AccountingClient, AccountingPayment } from '@/lib/accounting/types';
import { formatINR } from '@/lib/accounting/computations';

export default function AccountingPaymentsPage() {
  const params = useSearchParams();
  const presetClientId = params.get('clientId') || '';
  const openAction = params.get('action') === 'new';

  const { selectedCompanyId } = useAccountingCompany();
  const [payments, setPayments] = useState<AccountingPayment[]>([]);
  const [clients, setClients] = useState<AccountingClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const [payS, cliS] = await Promise.all([
        getDocs(
          query(
            collection(db, 'accountingPayments'),
            where('companyId', '==', selectedCompanyId),
          ),
        ),
        getDocs(
          query(
            collection(db, 'accountingClients'),
            where('companyId', '==', selectedCompanyId),
          ),
        ),
      ]);
      const rows: AccountingPayment[] = payS.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AccountingPayment, 'id'>),
      }));
      rows.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));
      setPayments(rows);
      const cli: AccountingClient[] = cliS.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AccountingClient, 'id'>),
      }));
      cli.sort((a, b) => a.name.localeCompare(b.name));
      setClients(cli);
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Failed to load payments', sev: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (openAction) setDialogOpen(true);
  }, [openAction]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (mode !== 'all' && p.mode !== mode) return false;
      if (dateFrom && (p.paymentDate || '') < dateFrom) return false;
      if (dateTo && (p.paymentDate || '') > dateTo) return false;
      if (!s) return true;
      return (
        (p.clientName || '').toLowerCase().includes(s) ||
        (p.reference || '').toLowerCase().includes(s) ||
        p.allocations?.some((a) => (a.invoiceNumber || '').toLowerCase().includes(s))
      );
    });
  }, [payments, search, mode, dateFrom, dateTo]);

  const totalCollected = filtered.reduce((a, p) => a + Number(p.amount || 0), 0);

  if (!selectedCompanyId) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Log payments and allocate them to invoices.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Log Payment
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search client, reference, invoice #"
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
          <TextField
            size="small"
            select
            label="Mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="all">All modes</MenuItem>
            <MenuItem value="cash">Cash</MenuItem>
            <MenuItem value="upi">UPI</MenuItem>
            <MenuItem value="bank">Bank</MenuItem>
            <MenuItem value="cheque">Cheque</MenuItem>
            <MenuItem value="card">Card</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="date"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1} mb={2}>
        <Chip label={`Collected: ${formatINR(totalCollected)}`} color="success" variant="outlined" />
        <Chip label={`${filtered.length} payment(s)`} variant="outlined" />
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Client</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell>Reference</TableCell>
              <TableCell>Allocated To</TableCell>
              <TableCell align="right">Unallocated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">No payments yet.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{p.paymentDate}</TableCell>
                  <TableCell>{p.clientName || '—'}</TableCell>
                  <TableCell align="right">{formatINR(p.amount)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.mode.toUpperCase()} />
                  </TableCell>
                  <TableCell>{p.reference || '—'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {p.allocations?.length ? (
                        p.allocations.map((a) => (
                          <Chip
                            key={a.invoiceId}
                            size="small"
                            variant="outlined"
                            label={`${a.invoiceNumber}: ${formatINR(a.amount)}`}
                          />
                        ))
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Advance
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {p.unallocated > 0 ? (
                      <Chip size="small" color="warning" label={formatINR(p.unallocated)} />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <PaymentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          setSnack({ msg: 'Payment saved', sev: 'success' });
          void load();
        }}
        companyId={selectedCompanyId}
        clients={clients}
        presetClientId={presetClientId}
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
