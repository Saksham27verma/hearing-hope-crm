'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  Autocomplete,
  Stack,
  Grid,
  Alert,
  InputAdornment,
  Chip,
  Typography,
  Box,
  Avatar,
  IconButton,
  Paper,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Payments as PaymentsIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Notes as NotesIcon,
  Receipt as ReceiptIcon,
  AttachMoney as MoneyIcon,
  AutoFixHigh as AutoAllocIcon,
  ClearAll as ClearIcon,
  CheckCircle as CheckIcon,
  AccountBalance as BankIcon,
  QrCode2 as UpiIcon,
  CreditCard as CardIcon,
  Article as ChequeIcon,
  Savings as CashIcon,
  MoreHoriz as OtherIcon,
} from '@mui/icons-material';
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type {
  AccountingClient,
  AccountingInvoice,
  AccountingPaymentAllocation,
  AccountingPaymentMode,
} from '@/lib/accounting/types';
import { formatINR } from '@/lib/accounting/computations';
import { useAuth } from '@/hooks/useAuth';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  companyId: string;
  clients: AccountingClient[];
  presetClientId?: string;
};

const MODES: {
  value: AccountingPaymentMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: 'cash', label: 'Cash', icon: <CashIcon fontSize="small" /> },
  { value: 'upi', label: 'UPI', icon: <UpiIcon fontSize="small" /> },
  { value: 'bank', label: 'Bank', icon: <BankIcon fontSize="small" /> },
  { value: 'cheque', label: 'Cheque', icon: <ChequeIcon fontSize="small" /> },
  { value: 'card', label: 'Card', icon: <CardIcon fontSize="small" /> },
  { value: 'other', label: 'Other', icon: <OtherIcon fontSize="small" /> },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

function SectionHeader({
  icon,
  title,
  subtitle,
  color,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  color: string;
  right?: React.ReactNode;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
      <Avatar
        variant="rounded"
        sx={{ bgcolor: `${color}18`, color, width: 32, height: 32 }}
      >
        {icon}
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {right}
    </Stack>
  );
}

export default function PaymentDialog({
  open,
  onClose,
  onSaved,
  companyId,
  clients,
  presetClientId,
}: Props) {
  const theme = useTheme();
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState<AccountingPaymentMode>('bank');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [openInvoices, setOpenInvoices] = useState<AccountingInvoice[]>([]);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) || null,
    [clients, clientId],
  );

  useEffect(() => {
    if (open) {
      setClientId(presetClientId || '');
      setPaymentDate(todayStr());
      setAmount(0);
      setMode('bank');
      setReference('');
      setNotes('');
      setAlloc({});
      setError(null);
    }
  }, [open, presetClientId]);

  useEffect(() => {
    if (!clientId || !companyId) {
      setOpenInvoices([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingInvoices(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, 'accountingInvoices'),
            where('companyId', '==', companyId),
            where('clientId', '==', clientId),
          ),
        );
        if (cancelled) return;
        const rows: AccountingInvoice[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingInvoice, 'id'>) }))
          .filter((r) => {
            if (r.status === 'cancelled' || r.status === 'draft') return false;
            const due = Number(r.grandTotal || 0) - Number(r.amountPaid || 0);
            return due > 0.01;
          })
          .sort((a, b) => (a.invoiceDate || '').localeCompare(b.invoiceDate || ''));
        setOpenInvoices(rows);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, companyId]);

  const totalOutstanding = useMemo(
    () =>
      openInvoices.reduce(
        (s, i) => s + Math.max(0, Number(i.grandTotal || 0) - Number(i.amountPaid || 0)),
        0,
      ),
    [openInvoices],
  );

  const allocatedTotal = useMemo(
    () => Object.values(alloc).reduce((a, b) => a + Number(b || 0), 0),
    [alloc],
  );

  const remaining = Number(amount || 0) - allocatedTotal;

  const autoAllocate = () => {
    let left = Number(amount || 0);
    const next: Record<string, number> = {};
    for (const inv of openInvoices) {
      if (!inv.id) continue;
      const due = Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0);
      const take = Math.min(due, left);
      if (take > 0) next[inv.id] = Number(take.toFixed(2));
      left -= take;
      if (left <= 0) break;
    }
    setAlloc(next);
  };

  const clearAlloc = () => setAlloc({});

  const fillFullAmount = () => setAmount(Number(totalOutstanding.toFixed(2)));

  const handleSubmit = async () => {
    setError(null);
    if (!clientId) {
      setError('Please pick a client');
      return;
    }
    if (!(amount > 0)) {
      setError('Amount must be greater than 0');
      return;
    }
    if (allocatedTotal - Number(amount || 0) > 0.01) {
      setError('Allocated amount exceeds payment amount');
      return;
    }
    setSaving(true);
    try {
      await runTransaction(db, async (tx) => {
        const allocations: AccountingPaymentAllocation[] = [];
        for (const [invoiceId, allocAmt] of Object.entries(alloc)) {
          const amt = Number(allocAmt || 0);
          if (amt <= 0) continue;
          const invRef = doc(db, 'accountingInvoices', invoiceId);
          const snap = await tx.get(invRef);
          if (!snap.exists()) continue;
          const data = snap.data() as AccountingInvoice;
          const grand = Number(data.grandTotal || 0);
          const paidBefore = Number(data.amountPaid || 0);
          const newPaid = Math.min(grand, paidBefore + amt);
          const newDue = Math.max(0, grand - newPaid);
          let status = data.status;
          if (newDue <= 0.01) status = 'paid';
          else if (newPaid > 0) status = 'partial';
          tx.update(invRef, {
            amountPaid: Number(newPaid.toFixed(2)),
            balanceDue: Number(newDue.toFixed(2)),
            status,
            updatedAt: serverTimestamp(),
          });
          allocations.push({
            invoiceId,
            invoiceNumber: data.invoiceNumber || '',
            amount: Number(amt.toFixed(2)),
          });
        }
        const paymentsRef = doc(collection(db, 'accountingPayments'));
        tx.set(paymentsRef, {
          companyId,
          clientId,
          clientName: selectedClient?.name || '',
          paymentDate,
          amount: Number(Number(amount).toFixed(2)),
          mode,
          reference: reference || '',
          notes: notes || '',
          allocations,
          unallocated: Number(Math.max(0, remaining).toFixed(2)),
          createdBy: user?.uid || '',
          createdAt: serverTimestamp(),
        });
      });
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
      setError('Save failed \u2014 please try again.');
    } finally {
      setSaving(false);
    }
  };

  const allocationProgress = amount > 0 ? Math.min(100, (allocatedTotal / amount) * 100) : 0;

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* Gradient header */}
      <Box
        sx={{
          position: 'relative',
          px: 3,
          pt: 3,
          pb: 2.5,
          color: '#fff',
          background: `linear-gradient(135deg, #2e7d32 0%, #1b5e20 55%, #004d40 100%)`,
        }}
      >
        <IconButton
          onClick={onClose}
          disabled={saving}
          sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.85)' }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            sx={{
              bgcolor: 'rgba(255,255,255,0.18)',
              color: '#fff',
              width: 56,
              height: 56,
              backdropFilter: 'blur(6px)',
            }}
          >
            <PaymentsIcon fontSize="large" />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700}>
              Log Payment
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Record a receipt and allocate it to open invoices.
            </Typography>
          </Box>
          {selectedClient && (
            <Chip
              label={selectedClient.name}
              sx={{
                bgcolor: 'rgba(255,255,255,0.15)',
                color: '#fff',
                fontWeight: 600,
              }}
              icon={<PersonIcon fontSize="small" sx={{ color: '#fff !important' }} />}
            />
          )}
        </Stack>
      </Box>

      <DialogContent sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Stack spacing={2.5}>
          {/* Payment details */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <SectionHeader
              icon={<MoneyIcon fontSize="small" />}
              title="Payment Details"
              subtitle="Who paid, how much, when and how."
              color={theme.palette.success.main}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={clients}
                  getOptionLabel={(o) => o.name}
                  value={selectedClient}
                  onChange={(_, v) => setClientId(v?.id || '')}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Client"
                      size="small"
                      required
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start">
                              <PersonIcon fontSize="small" color="action" />
                            </InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  size="small"
                  fullWidth
                  type="date"
                  label="Payment Date"
                  InputLabelProps={{ shrink: true }}
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  size="small"
                  fullWidth
                  type="number"
                  label="Amount"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography fontWeight={700}>&#8377;</Typography>
                      </InputAdornment>
                    ),
                    endAdornment:
                      selectedClient && totalOutstanding > 0 ? (
                        <InputAdornment position="end">
                          <Tooltip title={`Fill full outstanding (${formatINR(totalOutstanding)})`}>
                            <Button size="small" onClick={fillFullAmount} sx={{ minWidth: 0 }}>
                              Full
                            </Button>
                          </Tooltip>
                        </InputAdornment>
                      ) : undefined,
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                  Payment Mode
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={mode}
                  onChange={(_, v) => v && setMode(v as AccountingPaymentMode)}
                  sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButton-root': { borderRadius: '8px !important', border: '1px solid rgba(0,0,0,0.12) !important' } }}
                >
                  {MODES.map((m) => (
                    <ToggleButton key={m.value} value={m.value} sx={{ textTransform: 'none', px: 1.5 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {m.icon}
                        <span>{m.label}</span>
                      </Stack>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  size="small"
                  fullWidth
                  label="Reference / Txn ID"
                  placeholder="UTR, cheque #, UPI ref, etc."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  size="small"
                  fullWidth
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <NotesIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Allocation */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <SectionHeader
              icon={<ReceiptIcon fontSize="small" />}
              title="Allocate to Invoices"
              subtitle="Distribute this receipt across the client\u2019s open invoices."
              color={theme.palette.primary.main}
              right={
                <Stack direction="row" spacing={0.5}>
                  <Button
                    size="small"
                    startIcon={<AutoAllocIcon fontSize="small" />}
                    onClick={autoAllocate}
                    disabled={!(amount > 0) || openInvoices.length === 0}
                    sx={{ textTransform: 'none' }}
                  >
                    Auto-FIFO
                  </Button>
                  <Button
                    size="small"
                    startIcon={<ClearIcon fontSize="small" />}
                    onClick={clearAlloc}
                    disabled={allocatedTotal === 0}
                    sx={{ textTransform: 'none' }}
                    color="inherit"
                  >
                    Clear
                  </Button>
                </Stack>
              }
            />

            {!selectedClient ? (
              <Alert severity="info" variant="outlined" sx={{ borderRadius: 2 }}>
                Pick a client to see their open invoices.
              </Alert>
            ) : loadingInvoices ? (
              <Box sx={{ py: 3 }}>
                <LinearProgress />
              </Box>
            ) : openInvoices.length === 0 ? (
              <Alert severity="success" variant="outlined" sx={{ borderRadius: 2 }}>
                No open invoices. This payment will be recorded as an <b>advance</b>.
              </Alert>
            ) : (
              <Stack spacing={1.25}>
                {openInvoices.map((inv) => {
                  const due = Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0);
                  const cur = Number(alloc[inv.id || ''] || 0);
                  const pct = due > 0 ? Math.min(100, (cur / due) * 100) : 0;
                  const isFull = cur > 0 && cur >= due - 0.01;
                  return (
                    <Paper
                      key={inv.id}
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        borderLeft: `4px solid ${isFull ? theme.palette.success.main : cur > 0 ? theme.palette.warning.main : theme.palette.divider}`,
                        bgcolor: cur > 0 ? 'action.hover' : 'transparent',
                      }}
                    >
                      <Grid container spacing={1.5} alignItems="center">
                        <Grid item xs={12} sm={5}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ bgcolor: 'primary.50', color: 'primary.main', width: 32, height: 32 }}>
                              <ReceiptIcon fontSize="small" />
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography fontWeight={700} noWrap>
                                {inv.invoiceNumber}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {inv.invoiceDate}
                              </Typography>
                            </Box>
                          </Stack>
                        </Grid>
                        <Grid item xs={6} sm={2}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Total
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {formatINR(inv.grandTotal)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={2}>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Due
                          </Typography>
                          <Typography variant="body2" fontWeight={700} color="warning.dark">
                            {formatINR(due)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            size="small"
                            type="number"
                            fullWidth
                            placeholder="0.00"
                            value={alloc[inv.id || ''] || ''}
                            onChange={(e) =>
                              setAlloc((a) => ({
                                ...a,
                                [inv.id || '']: Math.max(0, Math.min(due, Number(e.target.value) || 0)),
                              }))
                            }
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <Typography fontWeight={700} fontSize={14}>&#8377;</Typography>
                                </InputAdornment>
                              ),
                              endAdornment: (
                                <InputAdornment position="end">
                                  <Tooltip title="Allocate full due">
                                    <Button
                                      size="small"
                                      sx={{ minWidth: 0, p: 0.25 }}
                                      onClick={() =>
                                        setAlloc((a) => ({ ...a, [inv.id || '']: Number(due.toFixed(2)) }))
                                      }
                                    >
                                      Max
                                    </Button>
                                  </Tooltip>
                                </InputAdornment>
                              ),
                              inputProps: { style: { textAlign: 'right' }, min: 0, step: 'any' },
                            }}
                          />
                        </Grid>
                        {cur > 0 && (
                          <Grid item xs={12}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                color={isFull ? 'success' : 'warning'}
                                sx={{ flex: 1, height: 6, borderRadius: 3 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {pct.toFixed(0)}%
                              </Typography>
                              {isFull && (
                                <Chip
                                  size="small"
                                  color="success"
                                  icon={<CheckIcon />}
                                  label="Fully paid"
                                  sx={{ height: 20 }}
                                />
                              )}
                            </Stack>
                          </Grid>
                        )}
                      </Grid>
                    </Paper>
                  );
                })}
              </Stack>
            )}

            {selectedClient && openInvoices.length > 0 && (
              <Box mt={2}>
                <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Allocation progress
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="caption" fontWeight={600}>
                    {formatINR(allocatedTotal)} / {formatINR(amount)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={allocationProgress}
                  color={remaining <= 0.01 && amount > 0 ? 'success' : 'primary'}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}
          </Paper>

          {error && (
            <Alert severity="error" variant="filled" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      {/* Sticky footer */}
      <Divider />
      <Box
        sx={{
          px: 3,
          py: 2,
          bgcolor: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip size="small" label={`Amount: ${formatINR(amount)}`} color="primary" />
          <Chip
            size="small"
            variant="outlined"
            color="primary"
            label={`Allocated: ${formatINR(allocatedTotal)}`}
          />
          <Chip
            size="small"
            variant="outlined"
            color={remaining > 0.01 ? 'warning' : 'success'}
            label={
              remaining > 0.01
                ? `Advance: ${formatINR(Math.max(0, remaining))}`
                : 'Fully allocated'
            }
            icon={remaining <= 0.01 ? <CheckIcon fontSize="small" /> : undefined}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSubmit}
            disabled={saving || !clientId || !(amount > 0)}
            sx={{ minWidth: 150, textTransform: 'none', borderRadius: 2 }}
            startIcon={<PaymentsIcon />}
          >
            {saving ? 'Saving\u2026' : 'Save Payment'}
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
