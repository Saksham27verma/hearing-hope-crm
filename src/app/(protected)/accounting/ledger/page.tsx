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
  TextField,
  Autocomplete,
  CircularProgress,
  Chip,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Print as PrintIcon,
  Visibility as PreviewIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import type {
  AccountingClient,
  AccountingInvoice,
  AccountingPayment,
} from '@/lib/accounting/types';
import { formatINR } from '@/lib/accounting/computations';
import { buildLedger, renderLedgerHtml, type LedgerBuildResult } from '@/lib/accounting/ledger';
import {
  fetchAccountingCompanyProfile,
  type AccountingCompanyProfile,
} from '@/lib/accounting/companyProfile';
import { openInvoiceHtmlInNewTab, printInvoiceHtml } from '@/lib/accounting/invoiceHtml';

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

export default function AccountingLedgerPage() {
  const params = useSearchParams();
  const initialClientId = params.get('clientId') || '';
  const { selectedCompanyId, selectedCompanyName } = useAccountingCompany();

  const [clients, setClients] = useState<AccountingClient[]>([]);
  const [clientId, setClientId] = useState(initialClientId);
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [companyProfile, setCompanyProfile] = useState<AccountingCompanyProfile | null>(null);
  const [invoices, setInvoices] = useState<AccountingInvoice[]>([]);
  const [payments, setPayments] = useState<AccountingPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const bootstrap = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const [cliSnap, profile] = await Promise.all([
        getDocs(
          query(
            collection(db, 'accountingClients'),
            where('companyId', '==', selectedCompanyId),
          ),
        ),
        fetchAccountingCompanyProfile(selectedCompanyId),
      ]);
      const rows: AccountingClient[] = cliSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AccountingClient, 'id'>),
      }));
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setClients(rows);
      setCompanyProfile(profile);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const loadClientData = useCallback(async () => {
    if (!selectedCompanyId || !clientId) {
      setInvoices([]);
      setPayments([]);
      return;
    }
    setLoading(true);
    try {
      const [invSnap, paySnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'accountingInvoices'),
            where('companyId', '==', selectedCompanyId),
            where('clientId', '==', clientId),
          ),
        ),
        getDocs(
          query(
            collection(db, 'accountingPayments'),
            where('companyId', '==', selectedCompanyId),
            where('clientId', '==', clientId),
          ),
        ),
      ]);
      setInvoices(
        invSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingInvoice, 'id'>) })),
      );
      setPayments(
        paySnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingPayment, 'id'>) })),
      );
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Failed to load ledger data', sev: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, clientId]);

  useEffect(() => {
    void loadClientData();
  }, [loadClientData]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) || null,
    [clients, clientId],
  );

  const ledger: LedgerBuildResult | null = useMemo(() => {
    if (!selectedClient) return null;
    return buildLedger({
      client: selectedClient,
      invoices,
      payments,
      dateFrom,
      dateTo,
    });
  }, [selectedClient, invoices, payments, dateFrom, dateTo]);

  const html = useMemo(() => {
    if (!selectedClient || !ledger) return '';
    return renderLedgerHtml(selectedClient, companyProfile, ledger, dateFrom, dateTo);
  }, [selectedClient, companyProfile, ledger, dateFrom, dateTo]);

  const handlePreview = () => html && openInvoiceHtmlInNewTab(html);
  const handlePrint = () => html && printInvoiceHtml(html);
  const handleWhatsApp = () => {
    if (!selectedClient || !ledger) return;
    const digits = String(selectedClient.phone || '').replace(/\D/g, '');
    const normalized = digits.length === 10 ? `91${digits}` : digits;
    const parts = [
      `Hello,`,
      ``,
      `Sharing your account statement from ${selectedCompanyName}:`,
      `Period: ${dateFrom} to ${dateTo}`,
      `Opening: ${formatINR(ledger.openingBalance)} ${ledger.openingType}`,
      `Total Debit: ${formatINR(ledger.totalDebit)}`,
      `Total Credit: ${formatINR(ledger.totalCredit)}`,
      `Closing: ${formatINR(ledger.closingBalance)} ${ledger.closingType}`,
      ``,
      `Please share your confirmation. Thank you.`,
    ];
    const text = encodeURIComponent(parts.join('\n'));
    const url = normalized ? `https://wa.me/${normalized}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  if (!selectedCompanyId) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Ledger / Statement
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Party ledger with running balance for {selectedCompanyName}.
          </Typography>
        </Box>
        {selectedClient && (
          <Stack direction="row" spacing={1}>
            <Button startIcon={<PreviewIcon />} onClick={handlePreview}>
              Preview
            </Button>
            <Button startIcon={<PrintIcon />} onClick={handlePrint}>
              Print / PDF
            </Button>
            <Button color="success" startIcon={<WhatsAppIcon />} onClick={handleWhatsApp}>
              WhatsApp
            </Button>
          </Stack>
        )}
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Autocomplete
            fullWidth
            options={clients}
            getOptionLabel={(o) => o.name}
            value={selectedClient}
            onChange={(_, v) => setClientId(v?.id || '')}
            renderInput={(params) => <TextField {...params} label="Client" size="small" />}
            isOptionEqualToValue={(a, b) => a.id === b.id}
          />
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

      {!selectedClient ? (
        <Alert severity="info">Select a client to view their ledger.</Alert>
      ) : loading ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : ledger ? (
        <>
          <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
            <Chip label={`Opening: ${formatINR(ledger.openingBalance)} ${ledger.openingType}`} />
            <Chip label={`Total Dr: ${formatINR(ledger.totalDebit)}`} color="warning" variant="outlined" />
            <Chip label={`Total Cr: ${formatINR(ledger.totalCredit)}`} color="success" variant="outlined" />
            <Chip
              label={`Closing: ${formatINR(ledger.closingBalance)} ${ledger.closingType}`}
              color="primary"
            />
          </Stack>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Particulars</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ledger.entries.map((e, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{e.date || '—'}</TableCell>
                    <TableCell>
                      {e.type === 'opening' ? <b>{e.particulars}</b> : e.particulars}
                    </TableCell>
                    <TableCell>{e.reference || '—'}</TableCell>
                    <TableCell align="right">{e.debit ? formatINR(e.debit) : '—'}</TableCell>
                    <TableCell align="right">{e.credit ? formatINR(e.credit) : '—'}</TableCell>
                    <TableCell align="right">
                      {formatINR(e.balance)} {e.balanceType}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : null}

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
