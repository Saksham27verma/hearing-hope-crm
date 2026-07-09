'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import type { AccountingInvoice, AccountingInvoiceStatus } from '@/lib/accounting/types';
import { formatINR } from '@/lib/accounting/computations';

const STATUS_OPTS: (AccountingInvoiceStatus | 'all')[] = [
  'all',
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'cancelled',
];

const statusColor: Record<AccountingInvoiceStatus, 'default' | 'primary' | 'warning' | 'success' | 'error' | 'info'> = {
  draft: 'default',
  sent: 'info',
  partial: 'warning',
  paid: 'success',
  overdue: 'error',
  cancelled: 'default',
};

export default function AccountingInvoicesListPage() {
  const router = useRouter();
  const { selectedCompanyId } = useAccountingCompany();
  const [rows, setRows] = useState<AccountingInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AccountingInvoiceStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      let q = query(
        collection(db, 'accountingInvoices'),
        where('companyId', '==', selectedCompanyId),
        orderBy('invoiceDate', 'desc'),
      );
      let snap;
      try {
        snap = await getDocs(q);
      } catch {
        q = query(
          collection(db, 'accountingInvoices'),
          where('companyId', '==', selectedCompanyId),
        );
        snap = await getDocs(q);
      }
      const list: AccountingInvoice[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AccountingInvoice, 'id'>),
      }));
      list.sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || ''));
      setRows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false;
      if (dateFrom && (r.invoiceDate || '') < dateFrom) return false;
      if (dateTo && (r.invoiceDate || '') > dateTo) return false;
      if (!s) return true;
      return (
        r.invoiceNumber?.toLowerCase().includes(s) ||
        r.clientSnapshot?.name?.toLowerCase().includes(s)
      );
    });
  }, [rows, search, status, dateFrom, dateTo]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.grand += Number(r.grandTotal || 0);
        acc.paid += Number(r.amountPaid || 0);
        acc.due += Math.max(0, Number(r.grandTotal || 0) - Number(r.amountPaid || 0));
        return acc;
      },
      { grand: 0, paid: 0, due: 0 },
    );
  }, [filtered]);

  if (!selectedCompanyId) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Invoices
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage tax invoices for this company.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/accounting/invoices/new')}
        >
          New Invoice
        </Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search by invoice # or client name"
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
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as AccountingInvoiceStatus | 'all')}
            sx={{ minWidth: 140 }}
          >
            {STATUS_OPTS.map((s) => (
              <MenuItem key={s} value={s}>
                {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
              </MenuItem>
            ))}
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

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Chip label={`Total: ${formatINR(totals.grand)}`} />
        <Chip label={`Collected: ${formatINR(totals.paid)}`} color="success" variant="outlined" />
        <Chip label={`Outstanding: ${formatINR(totals.due)}`} color="warning" variant="outlined" />
        <Chip label={`${filtered.length} invoice(s)`} variant="outlined" />
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Invoice #</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Client</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Paid</TableCell>
              <TableCell align="right">Due</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">No invoices match your filters.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const due = Math.max(0, Number(r.grandTotal || 0) - Number(r.amountPaid || 0));
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography fontWeight={600}>{r.invoiceNumber}</Typography>
                    </TableCell>
                    <TableCell>{r.invoiceDate || '—'}</TableCell>
                    <TableCell>{r.clientSnapshot?.name || '—'}</TableCell>
                    <TableCell align="right">{formatINR(r.grandTotal)}</TableCell>
                    <TableCell align="right">{formatINR(r.amountPaid)}</TableCell>
                    <TableCell align="right">{formatINR(due)}</TableCell>
                    <TableCell>
                      <Chip
                        label={String(r.status).toUpperCase()}
                        size="small"
                        color={statusColor[r.status] || 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Open">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/accounting/invoices/${r.id}`)}
                        >
                          <OpenIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
