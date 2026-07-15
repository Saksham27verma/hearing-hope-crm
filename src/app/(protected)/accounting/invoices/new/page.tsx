'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import { Save as SaveIcon, ArrowBack as BackIcon } from '@mui/icons-material';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import InvoiceEditor from '@/components/accounting/InvoiceEditor';
import type {
  AccountingClient,
  AccountingInvoice,
  AccountingInvoiceItem,
} from '@/lib/accounting/types';
import {
  fetchAccountingCompanyProfile,
  type AccountingCompanyProfile,
} from '@/lib/accounting/companyProfile';
import {
  allocateNextAccountingInvoiceNumber,
  peekNextAccountingInvoiceNumber,
} from '@/services/accountingNumbering';

const todayStr = () => new Date().toISOString().slice(0, 10);

const stripUndefined = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as unknown as T;
  }
  return value;
};

const blankInvoice = (companyId: string, companyName: string): AccountingInvoice => ({
  companyId,
  companyName,
  clientId: '',
  clientSnapshot: { name: '' },
  invoiceNumber: '',
  invoiceDate: todayStr(),
  invoiceMonth: '',
  dueDate: '',
  items: [
    {
      id: `it-${Date.now()}`,
      description: '',
      hsnSac: '',
      quantity: 1,
      rate: 0,
      gstPercent: 18,
      amount: 0,
    },
  ],
  subtotal: 0,
  cgst: 0,
  sgst: 0,
  igst: 0,
  totalGst: 0,
  roundOff: 0,
  grandTotal: 0,
  amountPaid: 0,
  balanceDue: 0,
  netPayablePercent: 100,
  taxMode: 'intra',
  status: 'draft',
  notes: '',
  terms: 'Payment due within 30 days of invoice date.',
});

export default function NewAccountingInvoicePage() {
  const router = useRouter();
  const params = useSearchParams();
  const preselectedClientId = params.get('clientId') || '';
  const { user } = useAuth();
  const { selectedCompanyId, selectedCompanyName } = useAccountingCompany();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<AccountingClient[]>([]);
  const [companyProfile, setCompanyProfile] = useState<AccountingCompanyProfile | null>(null);
  const [invoice, setInvoice] = useState<AccountingInvoice | null>(null);
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const bootstrap = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const [clientSnap, profile, previewNumber] = await Promise.all([
        getDocs(
          query(
            collection(db, 'accountingClients'),
            where('companyId', '==', selectedCompanyId),
          ),
        ),
        fetchAccountingCompanyProfile(selectedCompanyId),
        peekNextAccountingInvoiceNumber(db, selectedCompanyId),
      ]);
      const rows: AccountingClient[] = clientSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AccountingClient, 'id'>),
      }));
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setClients(rows);
      setCompanyProfile(profile);
      const base = blankInvoice(selectedCompanyId, selectedCompanyName || '');
      base.invoiceNumber = previewNumber;
      if (preselectedClientId) {
        const c = rows.find((x) => x.id === preselectedClientId);
        if (c) {
          base.clientId = c.id!;
          base.clientSnapshot = {
            name: c.name,
            gstin: c.gstin,
            address: c.address,
            city: c.city,
            state: c.state,
            pincode: c.pincode,
            phone: c.phone,
            email: c.email,
          };
        }
      }
      setInvoice(base);
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Failed to load data', sev: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, selectedCompanyName, preselectedClientId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const canSave = useMemo(() => {
    if (!invoice) return false;
    if (!invoice.clientId) return false;
    if (!invoice.invoiceNumber.trim()) return false;
    if (!invoice.items?.length) return false;
    if (invoice.items.every((it) => !it.description.trim())) return false;
    return true;
  }, [invoice]);

  const missingSerialItems = useMemo(() => {
    if (!invoice?.items?.length) return [];
    return invoice.items.filter((it) => {
      const enriched = it as AccountingInvoiceItem & {
        kind?: string;
        catalogKey?: string;
      };
      const needs =
        enriched.kind === 'hearing_aid' ||
        it.hasSerialNumber === true ||
        (typeof enriched.catalogKey === 'string' &&
          enriched.catalogKey.startsWith('product:'));
      return needs && !String(it.serialNumber || '').trim();
    });
  }, [invoice]);

  const handleSave = async (asStatus: 'draft' | 'sent') => {
    if (!invoice || !selectedCompanyId) return;
    if (!canSave) {
      setSnack({ msg: 'Please pick a client and add at least one line item', sev: 'error' });
      return;
    }
    if (missingSerialItems.length > 0) {
      setSnack({
        msg: 'Please enter the serial number for every hearing aid line item',
        sev: 'error',
      });
      return;
    }
    setSaving(true);
    try {
      let finalNumber = invoice.invoiceNumber.trim();
      const previewedNext = await peekNextAccountingInvoiceNumber(db, selectedCompanyId);
      if (finalNumber === previewedNext) {
        finalNumber = await allocateNextAccountingInvoiceNumber(db, selectedCompanyId);
      }
      const payload = stripUndefined({
        ...invoice,
        invoiceNumber: finalNumber,
        status: asStatus,
        amountPaid: Number(invoice.amountPaid || 0),
        tdsDeducted: Number(invoice.tdsDeducted || 0),
        netPayablePercent: Number(invoice.netPayablePercent || 100),
        grossSubtotal: Number(invoice.grossSubtotal || invoice.subtotal || 0),
        grossGrandTotal: Number(invoice.grossGrandTotal || invoice.grandTotal || 0),
        balanceDue: Math.max(0, invoice.grandTotal - Number(invoice.amountPaid || 0) - Number(invoice.tdsDeducted || 0)),
        createdBy: user?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const ref = await addDoc(collection(db, 'accountingInvoices'), payload);
      setSnack({ msg: 'Invoice saved', sev: 'success' });
      router.push(`/accounting/invoices/${ref.id}`);
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Save failed', sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!selectedCompanyId) return null;

  if (loading || !invoice) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <Button startIcon={<BackIcon />} onClick={() => router.push('/accounting/invoices')}>
          Back
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          disabled={saving}
          onClick={() => handleSave('draft')}
          startIcon={<SaveIcon />}
        >
          Save Draft
        </Button>
        <Button
          variant="contained"
          disabled={saving || !canSave}
          onClick={() => handleSave('sent')}
          startIcon={<SaveIcon />}
        >
          Save & Mark Sent
        </Button>
      </Stack>

      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            New Invoice
          </Typography>
          <Typography variant="body2" color="text.secondary">
            For {selectedCompanyName}
          </Typography>
        </Box>
      </Stack>

      {clients.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => router.push('/accounting/clients')}>
              Add Clients
            </Button>
          }
        >
          You don't have any accounting clients yet. Add at least one to create an invoice.
        </Alert>
      )}

      <InvoiceEditor
        companyProfile={companyProfile}
        clients={clients}
        value={invoice}
        onChange={setInvoice}
      />

      <Paper sx={{ p: 2, mt: 2 }} variant="outlined">
        <Typography variant="body2" color="text.secondary">
          The invoice number preview ({invoice.invoiceNumber}) will be allocated atomically when you save.
          Change the prefix / next number in <b>Accounting → Settings</b>.
        </Typography>
      </Paper>

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
