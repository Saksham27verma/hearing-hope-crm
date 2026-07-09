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
  AccountingClient,
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
  const [clients, setClients] = useState<AccountingClient[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const [invSnap, paySnap, cliSnap] = await Promise.all([
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
        getDocs(
          query(
            collection(db, 'accountingClients'),
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
      setClients(
        cliSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingClient, 'id'>) })),
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
    let invoicedMonth = 0;
    let overdueCount = 0;
    let overdueAmt = 0;
    let openingReceivablesTotal = 0;

    // Per-client signed running balance: positive = they owe us (Dr), negative = we owe them (Cr).
    const perClient: Record<string, { name: string; signed: number }> = {};
    const ensure = (id: string, name: string) => {
      if (!perClient[id]) perClient[id] = { name: name || 'Unknown', signed: 0 };
      else if (!perClient[id].name && name) perClient[id].name = name;
      return perClient[id];
    };

    for (const c of clients) {
      if (!c.id) continue;
      const opening = Number(c.openingBalance || 0);
      if (!opening) {
        ensure(c.id, c.name);
        continue;
      }
      const signed = c.openingBalanceType === 'credit' ? -opening : opening;
      ensure(c.id, c.name).signed += signed;
      if (signed > 0) openingReceivablesTotal += signed;
    }

    for (const inv of invoices) {
      if (inv.status === 'cancelled' || inv.status === 'draft') continue;
      const due = Math.max(
        0,
        Number(inv.grandTotal || 0) -
          Number(inv.amountPaid || 0) -
          Number((inv as any).tdsDeducted || 0),
      );
      if ((inv.invoiceDate || '') >= monthStart && (inv.invoiceDate || '') <= now) {
        invoicedMonth += Number(inv.grandTotal || 0);
      }
      if (due > 0 && inv.dueDate && inv.dueDate < now) {
        overdueCount += 1;
        overdueAmt += due;
      }
      if (due > 0) {
        const key = inv.clientId || 'unknown';
        ensure(key, inv.clientSnapshot?.name || '').signed += due;
      }
    }

    let collectedMonth = 0;
    for (const p of payments) {
      if ((p.paymentDate || '') >= monthStart && (p.paymentDate || '') <= now) {
        collectedMonth += Number(p.amount || 0) + Number(p.tdsAmount || 0);
      }
      // Unallocated / advance portion reduces the receivable balance for that client.
      const unalloc = Number(p.unallocated || 0);
      if (unalloc > 0 && p.clientId) {
        ensure(p.clientId, p.clientName || '').signed -= unalloc;
      }
    }

    const receivables = Object.values(perClient).reduce(
      (s, v) => s + Math.max(0, v.signed),
      0,
    );

    const topOverdue = Object.entries(perClient)
      .map(([id, v]) => ({ id, name: v.name, due: v.signed }))
      .filter((r) => r.due > 0.01)
      .sort((a, b) => b.due - a.due)
      .slice(0, 5);

    return {
      receivables,
      openingReceivablesTotal,
      invoicedMonth,
      collectedMonth,
      overdueCount,
      overdueAmt,
      topOverdue,
    };
  }, [invoices, payments, clients]);

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
          subtitle={
            stats.openingReceivablesTotal > 0
              ? `incl. ${formatINR(stats.openingReceivablesTotal)} opening balance`
              : undefined
          }
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
  subtitle,
  color,
  loading,
}: {
  title: string;
  value: string;
  subtitle?: string;
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
          <>
            <Typography variant="h6" fontWeight={700} sx={{ color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" display="block">
                {subtitle}
              </Typography>
            )}
          </>
        )}
      </Paper>
    </Grid>
  );
}
