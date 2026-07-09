'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Visibility as PreviewIcon,
  WhatsApp as WhatsAppIcon,
  Send as SendIcon,
  MoreVert as MoreIcon,
  CheckCircle as PaidIcon,
} from '@mui/icons-material';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import InvoiceEditor from '@/components/accounting/InvoiceEditor';
import type {
  AccountingClient,
  AccountingInvoice,
  AccountingInvoiceStatus,
} from '@/lib/accounting/types';
import {
  fetchAccountingCompanyProfile,
  type AccountingCompanyProfile,
} from '@/lib/accounting/companyProfile';
import { formatINR } from '@/lib/accounting/computations';
import {
  buildWhatsAppShareUrl,
  openInvoiceHtmlInNewTab,
  printInvoiceHtml,
  renderAccountingInvoiceHtml,
} from '@/lib/accounting/invoiceHtml';

const statusColor: Record<AccountingInvoiceStatus, 'default' | 'primary' | 'warning' | 'success' | 'error' | 'info'> = {
  draft: 'default',
  sent: 'info',
  partial: 'warning',
  paid: 'success',
  overdue: 'error',
  cancelled: 'default',
};

export default function AccountingInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const invoiceId = params?.id as string;
  const { selectedCompanyId } = useAccountingCompany();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<AccountingInvoice | null>(null);
  const [clients, setClients] = useState<AccountingClient[]>([]);
  const [companyProfile, setCompanyProfile] = useState<AccountingCompanyProfile | null>(null);
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  const load = useCallback(async () => {
    if (!invoiceId || !selectedCompanyId) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'accountingInvoices', invoiceId));
      if (!snap.exists()) {
        setSnack({ msg: 'Invoice not found', sev: 'error' });
        setInvoice(null);
        return;
      }
      const data = { id: snap.id, ...(snap.data() as Omit<AccountingInvoice, 'id'>) };
      setInvoice(data);
      const [clientSnap, profile] = await Promise.all([
        getDocs(
          query(
            collection(db, 'accountingClients'),
            where('companyId', '==', data.companyId),
          ),
        ),
        fetchAccountingCompanyProfile(data.companyId),
      ]);
      const rows: AccountingClient[] = clientSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AccountingClient, 'id'>),
      }));
      rows.sort((a, b) => a.name.localeCompare(b.name));
      setClients(rows);
      setCompanyProfile(profile);
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Failed to load invoice', sev: 'error' });
    } finally {
      setLoading(false);
    }
  }, [invoiceId, selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isEditable = invoice?.status === 'draft';
  const html = useMemo(
    () => (invoice ? renderAccountingInvoiceHtml(invoice, companyProfile) : ''),
    [invoice, companyProfile],
  );

  const handleSave = async () => {
    if (!invoice?.id) return;
    setSaving(true);
    try {
      const { id, createdAt, ...rest } = invoice;
      void id;
      void createdAt;
      await updateDoc(doc(db, 'accountingInvoices', invoice.id), {
        ...rest,
        amountPaid: Number(invoice.amountPaid || 0),
        balanceDue: Math.max(0, invoice.grandTotal - Number(invoice.amountPaid || 0)),
        updatedAt: serverTimestamp(),
      });
      setSnack({ msg: 'Saved', sev: 'success' });
      await load();
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Save failed', sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: AccountingInvoiceStatus) => {
    if (!invoice?.id) return;
    try {
      await updateDoc(doc(db, 'accountingInvoices', invoice.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      setSnack({ msg: `Marked as ${status}`, sev: 'success' });
      await load();
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Update failed', sev: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!invoice?.id) return;
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'accountingInvoices', invoice.id));
      router.push('/accounting/invoices');
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Delete failed', sev: 'error' });
    }
  };

  const handlePreview = () => html && openInvoiceHtmlInNewTab(html);
  const handlePrint = () => html && printInvoiceHtml(html);
  const handleWhatsApp = () => {
    if (!invoice) return;
    const url = buildWhatsAppShareUrl({
      phone: invoice.clientSnapshot?.phone,
      companyName: invoice.companyName,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.grandTotal,
      dueDate: invoice.dueDate,
    });
    window.open(url, '_blank');
  };

  if (loading || !invoice) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} mb={2} flexWrap="wrap">
        <Button startIcon={<BackIcon />} onClick={() => router.push('/accounting/invoices')}>
          Back
        </Button>
        <Chip
          label={String(invoice.status).toUpperCase()}
          color={statusColor[invoice.status] || 'default'}
          size="small"
          sx={{ fontWeight: 700 }}
        />
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<PreviewIcon />} onClick={handlePreview}>
          Preview
        </Button>
        <Button startIcon={<PrintIcon />} onClick={handlePrint}>
          Print / PDF
        </Button>
        <Button startIcon={<WhatsAppIcon />} color="success" onClick={handleWhatsApp}>
          WhatsApp
        </Button>
        {isEditable && (
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}
        <Button
          endIcon={<MoreIcon />}
          onClick={(e) => setMoreAnchor(e.currentTarget)}
          variant="outlined"
        >
          More
        </Button>
      </Stack>

      <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}>
        {invoice.status === 'draft' && (
          <MenuItem
            onClick={() => {
              setMoreAnchor(null);
              void setStatus('sent');
            }}
          >
            <ListItemIcon>
              <SendIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Mark as Sent</ListItemText>
          </MenuItem>
        )}
        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <MenuItem
            onClick={() => {
              setMoreAnchor(null);
              void setStatus('paid');
            }}
          >
            <ListItemIcon>
              <PaidIcon fontSize="small" color="success" />
            </ListItemIcon>
            <ListItemText>Mark as Paid</ListItemText>
          </MenuItem>
        )}
        {invoice.status !== 'cancelled' && (
          <MenuItem
            onClick={() => {
              setMoreAnchor(null);
              void setStatus('cancelled');
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Mark as Cancelled</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setMoreAnchor(null);
            void handleDelete();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Invoice</ListItemText>
        </MenuItem>
      </Menu>

      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} flexWrap="wrap">
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {invoice.invoiceNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {invoice.companyName} · {invoice.clientSnapshot?.name || 'Client'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Chip label={`Total: ${formatINR(invoice.grandTotal)}`} />
          <Chip label={`Paid: ${formatINR(invoice.amountPaid)}`} color="success" variant="outlined" />
          <Chip
            label={`Due: ${formatINR(Math.max(0, invoice.grandTotal - invoice.amountPaid))}`}
            color="warning"
            variant="outlined"
          />
        </Stack>
      </Stack>

      {isEditable ? (
        <InvoiceEditor
          companyProfile={companyProfile}
          clients={clients}
          value={invoice}
          onChange={setInvoice}
        />
      ) : (
        <Paper variant="outlined" sx={{ p: 0, overflow: 'hidden' }}>
          <Box
            sx={{ background: '#fafafa', p: 1, borderBottom: '1px solid #eee' }}
          >
            <Typography variant="caption" color="text.secondary">
              Read-only preview (invoice is no longer a draft). Use Preview / Print to open the styled PDF.
            </Typography>
          </Box>
          <Box sx={{ p: 0 }}>
            <iframe
              title="invoice-preview"
              srcDoc={html}
              style={{ width: '100%', height: '80vh', border: 0 }}
            />
          </Box>
        </Paper>
      )}

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
