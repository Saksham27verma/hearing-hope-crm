'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Stack,
  Typography,
  Grid,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Payments as PaymentsIcon,
  MenuBook as LedgerIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import type {
  AccountingInvoice,
  AccountingPayment,
} from '@/lib/accounting/types';
import { formatINR } from '@/lib/accounting/computations';

function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AccountingDashboardPage() {
  const router = useRouter();
  const { selectedCompanyId, selectedCompanyName } = useAccountingCompany();

  const [invoices, setInvoices] = useState<AccountingInvoice[]>([]);
  const [payments, setPayments] = useState<AccountingPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const [invSnap, paySnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'accountingInvoices'),
            where('companyId', '==', selectedCompanyId),
          ),
        ),
        getDocs(
          query(
            collection(db, 'accountingPayments'),
            where('companyId', '==', selectedCompanyId),
          ),
        ),
      ]);
      setInvoices(
        invSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingInvoice, 'id'>) })),
      );
      setPayments(
        paySnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingPayment, 'id'>) })),
      );
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const monthStart = firstOfMonthISO();
    const now = todayISO();
    let receivables = 0;
    let invoicedMonth = 0;
    let overdueCount = 0;
    let overdueAmt = 0;
    const perClient: Record<string, { name: string; due: number }> = {};

    for (const inv of invoices) {
      if (inv.status === 'cancelled' || inv.status === 'draft') continue;
      const due = Math.max(0, Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0) - Number((inv as any).tdsDeducted || 0));
      receivables += due;
      if ((inv.invoiceDate || '') >= monthStart && (inv.invoiceDate || '') <= now) {
        invoicedMonth += Number(inv.grandTotal || 0);
      }
      if (due > 0 && inv.dueDate && inv.dueDate < now) {
        overdueCount += 1;
        overdueAmt += due;
      }
      if (due > 0) {
        const key = inv.clientId || 'unknown';
        const name = inv.clientSnapshot?.name || 'Unknown';
        perClient[key] = {
          name,
          due: (perClient[key]?.due || 0) + due,
        };
      }
    }

    let collectedMonth = 0;
    for (const p of payments) {
      if ((p.paymentDate || '') >= monthStart && (p.paymentDate || '') <= now) {
        collectedMonth += Number(p.amount || 0);
      }
    }

    const topOverdue = Object.entries(perClient)
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.due - a.due)
      .slice(0, 5);

    return {
      receivables,
      invoicedMonth,
      collectedMonth,
      overdueCount,
      overdueAmt,
      topOverdue,
    };
  }, [invoices, payments]);

  if (!selectedCompanyId) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Accounting Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Overview for {selectedCompanyName}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/accounting/invoices/new')}
          >
            New Invoice
          </Button>
          <Button
            variant="outlined"
            startIcon={<PaymentsIcon />}
            onClick={() => router.push('/accounting/payments?action=new')}
          >
            Log Payment
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={2}>
        <KpiCard
          title="Total Receivables"
          value={formatINR(stats.receivables)}
          color="#ef6c00"
          loading={loading}
        />
        <KpiCard
          title="Invoiced This Month"
          value={formatINR(stats.invoicedMonth)}
          color="#1976d2"
          loading={loading}
        />
        <KpiCard
          title="Collected This Month"
          value={formatINR(stats.collectedMonth)}
          color="#2e7d32"
          loading={loading}
        />
        <KpiCard
          title="Overdue"
          value={`${stats.overdueCount} · ${formatINR(stats.overdueAmt)}`}
          color="#c62828"
          loading={loading}
        />
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              Top clients with outstanding balance
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {loading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            ) : stats.topOverdue.length === 0 ? (
              <Typography color="text.secondary" variant="body2" sx={{ py: 3, textAlign: 'center' }}>
                No outstanding invoices. Everything is settled.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell align="right">Outstanding</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.topOverdue.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{r.name}</TableCell>
                      <TableCell align="right">
                        <Chip label={formatINR(r.due)} color="warning" size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          onClick={() => router.push(`/accounting/ledger?clientId=${r.id}`)}
                        >
                          Ledger
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>
              Quick Links
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PersonIcon />}
                onClick={() => router.push('/accounting/clients')}
              >
                Clients
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ReceiptIcon />}
                onClick={() => router.push('/accounting/invoices')}
              >
                Invoices
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<PaymentsIcon />}
                onClick={() => router.push('/accounting/payments')}
              >
                Payments
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<LedgerIcon />}
                onClick={() => router.push('/accounting/ledger')}
              >
                Ledger
              </Button>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => router.push('/accounting/settings')}
              >
                Settings
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function KpiCard({
  title,
  value,
  color,
  loading,
}: {
  title: string;
  value: string;
  color: string;
  loading?: boolean;
}) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Paper variant="outlined" sx={{ p: 2, borderLeft: `4px solid ${color}` }}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        {loading ? (
          <CircularProgress size={20} sx={{ mt: 1 }} />
        ) : (
          <Typography variant="h6" fontWeight={700} sx={{ color }}>
            {value}
          </Typography>
        )}
      </Paper>
    </Grid>
  );
}
