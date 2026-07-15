'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  MenuItem,
  IconButton,
  Button,
  Stack,
  Chip,
  Autocomplete,
  Divider,
  InputAdornment,
  Alert,
  Tooltip,
  Avatar,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Person as PersonIcon,
  ReceiptLong as ReceiptIcon,
  CalendarToday as CalendarIcon,
  EventBusy as DueIcon,
  DateRange as MonthIcon,
  ShoppingCart as CartIcon,
  Notes as NotesIcon,
  Gavel as TermsIcon,
  Summarize as SummaryIcon,
  Category as CategoryIcon,
  Hearing as HearingIcon,
  Biotech as BiotechIcon,
  MedicalServices as MedicalIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import type {
  AccountingClient,
  AccountingInvoice,
  AccountingInvoiceItem,
} from '@/lib/accounting/types';
import { computeInvoiceTotals, formatINR, amountInWords, priceFieldLabelForItem, rateColumnLabelForItems } from '@/lib/accounting/computations';
import { formatInvoiceMonth } from '@/lib/accounting/invoiceTemplate';
import type { AccountingCompanyProfile } from '@/lib/accounting/companyProfile';
import ServiceItemPickerDialog from '@/components/accounting/ServiceItemPickerDialog';
import type { ServiceCatalogItem } from '@/lib/accounting/serviceCatalog';
import { rememberServicePrices } from '@/lib/accounting/serviceCatalog';

type Props = {
  companyProfile: AccountingCompanyProfile | null;
  clients: AccountingClient[];
  value: AccountingInvoice;
  onChange: (invoice: AccountingInvoice) => void;
};

const GST_OPTIONS = [0, 5, 12, 18, 28];

type EnrichedItem = AccountingInvoiceItem & {
  catalogKey?: string;
  kind?: 'hearing_aid' | 'test' | 'ent' | 'custom';
  meta?: { company?: string; productType?: string };
};

const needsSerialNumber = (it: EnrichedItem): boolean =>
  it.kind === 'hearing_aid' ||
  it.hasSerialNumber === true ||
  (typeof it.catalogKey === 'string' && it.catalogKey.startsWith('product:'));

const newItem = (): EnrichedItem => ({
  id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  description: '',
  hsnSac: '',
  quantity: 1,
  rate: 0,
  gstPercent: 18,
  amount: 0,
  kind: 'custom',
  serialNumber: '',
  hasSerialNumber: false,
});

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
        sx={{ bgcolor: `${color}18`, color, width: 34, height: 34 }}
      >
        {icon}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" fontWeight={700}>
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

const kindIcon = (k?: string) => {
  if (k === 'hearing_aid') return <HearingIcon fontSize="small" />;
  if (k === 'test') return <BiotechIcon fontSize="small" />;
  if (k === 'ent') return <MedicalIcon fontSize="small" />;
  return <CategoryIcon fontSize="small" />;
};

const kindColor = (k?: string) => {
  if (k === 'hearing_aid') return '#1976d2';
  if (k === 'test') return '#7b1fa2';
  if (k === 'ent') return '#00897b';
  return '#616161';
};

const kindLabel = (k?: string) => {
  if (k === 'hearing_aid') return 'Hearing Aid';
  if (k === 'test') return 'Test';
  if (k === 'ent') return 'ENT';
  return 'Custom';
};

export default function InvoiceEditor({ companyProfile, clients, value, onChange }: Props) {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [inv, setInv] = useState<AccountingInvoice>(value);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setInv(value);
  }, [value]);

  const patch = (upd: Partial<AccountingInvoice>) => {
    const merged = { ...inv, ...upd };
    setInv(merged);
    onChange(merged);
  };

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === inv.clientId) || null,
    [clients, inv.clientId],
  );

  const taxMode: 'intra' | 'inter' = useMemo(() => {
    const cState = (companyProfile?.state || '').trim().toLowerCase();
    const clState = (selectedClient?.state || inv.clientSnapshot?.state || '').trim().toLowerCase();
    if (!cState || !clState) return 'intra';
    return cState === clState ? 'intra' : 'inter';
  }, [companyProfile?.state, selectedClient?.state, inv.clientSnapshot?.state]);

  const netPayablePercent =
    inv.netPayablePercent == null || Number(inv.netPayablePercent) <= 0
      ? 100
      : Math.min(100, Math.max(0.01, Number(inv.netPayablePercent)));

  const rateColumnLabel = useMemo(
    () => rateColumnLabelForItems((inv.items || []) as AccountingInvoiceItem[]),
    [inv.items],
  );

  const totals = useMemo(
    () => computeInvoiceTotals(inv.items || [], taxMode, netPayablePercent),
    [inv.items, taxMode, netPayablePercent],
  );

  useEffect(() => {
    if (
      inv.subtotal === totals.subtotal &&
      inv.totalGst === totals.totalGst &&
      inv.grandTotal === totals.grandTotal &&
      inv.taxMode === taxMode &&
      inv.grossSubtotal === totals.grossSubtotal &&
      inv.grossGrandTotal === totals.grossGrandTotal
    ) {
      return;
    }
    patch({
      subtotal: totals.subtotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      totalGst: totals.totalGst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      grossSubtotal: totals.grossSubtotal,
      grossGrandTotal: totals.grossGrandTotal,
      netPayablePercent,
      taxMode,
      balanceDue: Math.max(0, totals.grandTotal - (inv.amountPaid || 0) - Number(inv.tdsDeducted || 0)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.subtotal, totals.totalGst, totals.grandTotal, totals.grossGrandTotal, taxMode, netPayablePercent]);

  const setItem = (idx: number, upd: Partial<EnrichedItem>) => {
    const next = (inv.items as EnrichedItem[]).map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...upd };
      merged.amount = Number(merged.quantity || 0) * Number(merged.rate || 0);
      return merged;
    });
    patch({ items: next });
  };

  const addBlankItem = () => patch({ items: [...(inv.items || []), newItem()] });
  const removeItem = (idx: number) =>
    patch({ items: inv.items.filter((_, i) => i !== idx) });
  const duplicateItem = (idx: number) => {
    const src = inv.items[idx] as EnrichedItem;
    const clone: EnrichedItem = { ...src, id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` };
    const next = [...(inv.items as EnrichedItem[])];
    next.splice(idx + 1, 0, clone);
    patch({ items: next });
  };

  const handleClientChange = (c: AccountingClient | null) => {
    if (!c) {
      patch({ clientId: '', clientSnapshot: { name: '' } });
      return;
    }
    patch({
      clientId: c.id || '',
      clientSnapshot: {
        name: c.name,
        gstin: c.gstin,
        address: c.address,
        city: c.city,
        state: c.state,
        pincode: c.pincode,
        phone: c.phone,
        email: c.email,
      },
    });
  };

  const handlePickCatalog = (items: ServiceCatalogItem[]) => {
    const existing = inv.items as EnrichedItem[];
    const kept = existing.filter(
      (it) => it.description.trim() || it.rate > 0 || it.catalogKey,
    );
    const added: EnrichedItem[] = items.map((s, i) => {
      const trackSerial =
        s.kind === 'hearing_aid' || s.hasSerialNumber === true;
      const nameLine =
        s.kind === 'hearing_aid'
          ? [s.name, [s.company, s.productType].filter(Boolean).join(' · ')]
              .filter(Boolean)
              .join('\n')
          : s.name;
      return {
        id: `it-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        description: nameLine,
        hsnSac: s.hsnSac || '',
        quantity: 1,
        rate: Number(s.suggestedRate || 0),
        gstPercent: Number(s.gstPercent || 0),
        amount: Number(s.suggestedRate || 0),
        catalogKey: s.key,
        kind: s.kind,
        meta: { company: s.company, productType: s.productType },
        hasSerialNumber: trackSerial,
        serialNumber: '',
      };
    });
    patch({ items: [...kept, ...added] });
  };

  // Remember prices at every change so future adds pre-fill
  useEffect(() => {
    if (!inv.companyId) return;
    const enriched = inv.items as EnrichedItem[];
    const entries = enriched
      .filter((it) => it.catalogKey && Number(it.rate) > 0)
      .map((it) => ({ key: it.catalogKey!, rate: Number(it.rate) }));
    if (entries.length === 0) return;
    const t = setTimeout(() => {
      void rememberServicePrices(inv.companyId, entries);
    }, 1200);
    return () => clearTimeout(t);
  }, [inv.items, inv.companyId]);

  return (
    <>
      <Stack spacing={2}>
        {/* Header: client + meta */}
        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}0a 0%, ${theme.palette.primary.main}00 60%)`,
          }}
        >
          <SectionHeader
            icon={<ReceiptIcon fontSize="small" />}
            title="Invoice Header"
            subtitle="Who is this invoice for and when."
            color={theme.palette.primary.main}
          />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={clients}
                getOptionLabel={(o) => o.name}
                value={selectedClient}
                onChange={(_, v) => handleClientChange(v)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Client"
                    required
                    size="small"
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
                isOptionEqualToValue={(a, b) => a.id === b.id}
              />
              {selectedClient && (
                <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap">
                  {selectedClient.gstin && (
                    <Chip size="small" variant="outlined" label={`GSTIN: ${selectedClient.gstin}`} />
                  )}
                  {selectedClient.state && (
                    <Chip size="small" variant="outlined" label={selectedClient.state} />
                  )}
                  <Chip
                    size="small"
                    label={taxMode === 'intra' ? 'CGST + SGST' : 'IGST'}
                    color={taxMode === 'intra' ? 'primary' : 'secondary'}
                  />
                </Stack>
              )}
            </Grid>
            <Grid item xs={12} sm={4} md={2}>
              <TextField
                size="small"
                fullWidth
                label="Invoice #"
                value={inv.invoiceNumber}
                onChange={(e) => patch({ invoiceNumber: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <ReceiptIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField
                size="small"
                fullWidth
                type="date"
                label="Invoice Date"
                InputLabelProps={{ shrink: true }}
                value={inv.invoiceDate}
                onChange={(e) => patch({ invoiceDate: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <TextField
                size="small"
                fullWidth
                type="date"
                label="Due Date"
                InputLabelProps={{ shrink: true }}
                value={inv.dueDate || ''}
                onChange={(e) => patch({ dueDate: e.target.value })}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <DueIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={8} md={4}>
              <TextField
                size="small"
                fullWidth
                label="Invoice Month"
                placeholder="e.g. July 2026"
                value={inv.invoiceMonth || ''}
                onChange={(e) => patch({ invoiceMonth: e.target.value })}
                helperText="Optional — appears on the printed invoice only when filled"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MonthIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: inv.invoiceDate ? (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        sx={{ minWidth: 0, textTransform: 'none', fontSize: 11 }}
                        onClick={() =>
                          patch({ invoiceMonth: formatInvoiceMonth(inv.invoiceDate) })
                        }
                      >
                        From date
                      </Button>
                    </InputAdornment>
                  ) : undefined,
                }}
              />
            </Grid>
          </Grid>
          {!companyProfile?.state && (
            <Alert
              severity="info"
              icon={<InfoIcon fontSize="small" />}
              sx={{ mt: 2, borderRadius: 2 }}
            >
              Set the state on this company in the Companies module to auto-detect intra vs inter-state GST.
            </Alert>
          )}
        </Paper>

        <Grid container spacing={2} alignItems="stretch">
          {/* Line items */}
          <Grid item xs={12} md={8}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
              <SectionHeader
                icon={<CartIcon fontSize="small" />}
                title="Line Items"
                subtitle="Add hearing aids, tests, ENT procedures, or custom lines."
                color={theme.palette.warning.dark}
                right={
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      onClick={addBlankItem}
                      variant="outlined"
                      startIcon={<AddIcon />}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Custom
                    </Button>
                    <Button
                      size="small"
                      onClick={() => setPickerOpen(true)}
                      variant="contained"
                      startIcon={<CategoryIcon />}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Add from Catalog
                    </Button>
                  </Stack>
                }
              />

              {(inv.items || []).length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    borderStyle: 'dashed',
                    borderRadius: 2,
                    bgcolor: 'grey.50',
                  }}
                >
                  <CartIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    No line items yet. Add from the catalog or create a custom line.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CategoryIcon />}
                    onClick={() => setPickerOpen(true)}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Add from Catalog
                  </Button>
                </Paper>
              ) : (
                <Stack spacing={1.25}>
                  {(inv.items as EnrichedItem[]).map((it, idx) => {
                    const color = kindColor(it.kind);
                    const priceLabel = priceFieldLabelForItem(it);
                    const mrpLine =
                      Number(it.quantity || 0) * Number(it.rate || 0);
                    const payableLine = mrpLine * (netPayablePercent / 100);
                    return (
                      <Paper
                        key={it.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          borderLeft: `4px solid ${color}`,
                        }}
                      >
                        <Grid container spacing={1.25} alignItems="flex-start">
                          <Grid item xs={12}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar
                                variant="rounded"
                                sx={{
                                  bgcolor: `${color}22`,
                                  color,
                                  width: 30,
                                  height: 30,
                                }}
                              >
                                {kindIcon(it.kind)}
                              </Avatar>
                              <Chip
                                size="small"
                                label={`${idx + 1}. ${kindLabel(it.kind)}`}
                                sx={{
                                  bgcolor: `${color}18`,
                                  color,
                                  fontWeight: 600,
                                  height: 22,
                                }}
                              />
                              {it.meta?.company && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={it.meta.company}
                                  sx={{ height: 22 }}
                                />
                              )}
                              {it.meta?.productType && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={it.meta.productType}
                                  sx={{ height: 22 }}
                                />
                              )}
                              <Box sx={{ flex: 1 }} />
                              <Tooltip title="Duplicate">
                                <IconButton size="small" onClick={() => duplicateItem(idx)}>
                                  <CopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Remove">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => removeItem(idx)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Grid>

                          <Grid item xs={12} md={needsSerialNumber(it) ? 5 : 8}>
                            <TextField
                              size="small"
                              fullWidth
                              label="Description"
                              value={it.description}
                              onChange={(e) => setItem(idx, { description: e.target.value })}
                              multiline
                              minRows={1}
                              maxRows={4}
                              placeholder="What is being billed?"
                            />
                          </Grid>
                          {needsSerialNumber(it) && (
                            <Grid item xs={12} md={4}>
                              <TextField
                                size="small"
                                fullWidth
                                required
                                label="Serial Number"
                                value={it.serialNumber || ''}
                                onChange={(e) =>
                                  setItem(idx, { serialNumber: e.target.value })
                                }
                                placeholder={
                                  Number(it.quantity) > 1
                                    ? 'e.g. SN001, SN002 (one per unit)'
                                    : 'Enter hearing aid serial number'
                                }
                                helperText={
                                  !(it.serialNumber || '').trim()
                                    ? 'Required for hearing aids — will appear on the invoice'
                                    : Number(it.quantity) > 1
                                      ? 'Use commas to separate serials when quantity is more than 1'
                                      : 'Shown on the printed invoice'
                                }
                                error={!(it.serialNumber || '').trim()}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <HearingIcon fontSize="small" color="action" />
                                    </InputAdornment>
                                  ),
                                }}
                              />
                            </Grid>
                          )}
                          <Grid item xs={12} md={needsSerialNumber(it) ? 3 : 4}>
                            <TextField
                              size="small"
                              fullWidth
                              label="HSN / SAC"
                              value={it.hsnSac || ''}
                              onChange={(e) => setItem(idx, { hsnSac: e.target.value })}
                            />
                          </Grid>

                          <Grid item xs={6} sm={3} md={2}>
                            <TextField
                              size="small"
                              fullWidth
                              type="number"
                              label="Qty"
                              value={it.quantity}
                              onChange={(e) =>
                                setItem(idx, { quantity: Number(e.target.value) })
                              }
                              inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                            />
                          </Grid>
                          <Grid item xs={6} sm={3} md={3}>
                            <TextField
                              size="small"
                              fullWidth
                              type="number"
                              label={priceLabel}
                              value={it.rate}
                              onChange={(e) => setItem(idx, { rate: Number(e.target.value) })}
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <Typography fontWeight={700} fontSize={13}>
                                      &#8377;
                                    </Typography>
                                  </InputAdornment>
                                ),
                                inputProps: { min: 0, step: 'any', style: { textAlign: 'right' } },
                              }}
                            />
                          </Grid>
                          <Grid item xs={6} sm={3} md={3}>
                            <TextField
                              size="small"
                              select
                              fullWidth
                              label="GST %"
                              value={it.gstPercent}
                              onChange={(e) =>
                                setItem(idx, { gstPercent: Number(e.target.value) })
                              }
                            >
                              {GST_OPTIONS.map((g) => (
                                <MenuItem key={g} value={g}>
                                  {g}%
                                </MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                          <Grid item xs={6} sm={3} md={4}>
                            <Box
                              sx={{
                                p: 1,
                                borderRadius: 1.5,
                                bgcolor: 'grey.100',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                minHeight: 40,
                                gap: 0.25,
                              }}
                            >
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="flex-end"
                                spacing={1}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  {priceLabel} total
                                </Typography>
                                <Typography
                                  variant="body2"
                                  fontWeight={netPayablePercent < 100 ? 500 : 700}
                                  sx={
                                    netPayablePercent < 100
                                      ? { textDecoration: 'line-through', color: 'text.secondary' }
                                      : undefined
                                  }
                                >
                                  {formatINR(mrpLine)}
                                </Typography>
                              </Stack>
                              {netPayablePercent < 100 && (
                                <Stack
                                  direction="row"
                                  alignItems="center"
                                  justifyContent="flex-end"
                                  spacing={1}
                                >
                                  <Typography variant="caption" color="warning.dark">
                                    Amount payable ({netPayablePercent}%)
                                  </Typography>
                                  <Typography variant="body2" fontWeight={700} color="warning.dark">
                                    {formatINR(payableLine)}
                                  </Typography>
                                </Stack>
                              )}
                            </Box>
                          </Grid>
                        </Grid>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Totals panel */}
          <Grid item xs={12} md={4}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2,
                position: isMdUp ? 'sticky' : 'static',
                top: 16,
                background: `linear-gradient(180deg, ${theme.palette.success.main}0a 0%, ${theme.palette.background.paper} 100%)`,
              }}
            >
              <SectionHeader
                icon={<SummaryIcon fontSize="small" />}
                title="Summary"
                subtitle={`${(inv.items || []).length} line item(s)`}
                color={theme.palette.success.main}
              />
              <Stack spacing={0.5}>
                {netPayablePercent < 100 && (
                  <>
                    <Row
                      label={`${rateColumnLabel} Total`}
                      value={formatINR(totals.grossSubtotal)}
                      muted
                    />
                    <Row
                      label={`Discount (${(100 - netPayablePercent).toFixed(
                        Number.isInteger(100 - netPayablePercent) ? 0 : 2,
                      )}%)`}
                      value={`\u2212 ${formatINR(totals.grossSubtotal - totals.subtotal)}`}
                      muted
                    />
                  </>
                )}
                <Row
                  label={netPayablePercent < 100 ? 'Taxable (payable)' : 'Subtotal'}
                  value={formatINR(totals.subtotal)}
                />
                {taxMode === 'intra' ? (
                  <>
                    <Row label="CGST" value={formatINR(totals.cgst)} muted />
                    <Row label="SGST" value={formatINR(totals.sgst)} muted />
                  </>
                ) : (
                  <Row label="IGST" value={formatINR(totals.igst)} muted />
                )}
                <Row label="Total GST" value={formatINR(totals.totalGst)} />
                <Row label="Round Off" value={formatINR(totals.roundOff)} muted />
                <Divider sx={{ my: 1 }} />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={700}>
                    {netPayablePercent < 100 ? 'Amount Payable' : 'Grand Total'}
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={800}
                    sx={{ color: theme.palette.success.dark }}
                  >
                    {formatINR(totals.grandTotal)}
                  </Typography>
                </Stack>
                {netPayablePercent < 100 && (
                  <Typography variant="caption" color="text.secondary">
                    {rateColumnLabel} grand total was {formatINR(totals.grossGrandTotal)}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" mt={0.5}>
                  {amountInWords(totals.grandTotal)}
                </Typography>
              </Stack>

              <Divider sx={{ my: 2 }} />
              <Stack spacing={1} sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    BILL % OF {rateColumnLabel.toUpperCase()}
                  </Typography>
                  <Tooltip title={`Keep ${rateColumnLabel} as the unit price. Choosing 50% bills half as Amount Payable (GST scales with it).`}>
                    <InfoIcon fontSize="inherit" color="action" />
                  </Tooltip>
                  <Box sx={{ flex: 1 }} />
                  <Chip
                    size="small"
                    label={`${netPayablePercent}%`}
                    color={netPayablePercent < 100 ? 'warning' : 'default'}
                    variant={netPayablePercent < 100 ? 'filled' : 'outlined'}
                  />
                </Stack>
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                  {[25, 50, 75, 100].map((p) => (
                    <Button
                      key={p}
                      size="small"
                      variant={netPayablePercent === p ? 'contained' : 'outlined'}
                      color={p === 100 ? 'primary' : 'warning'}
                      sx={{ minWidth: 46, textTransform: 'none', px: 1 }}
                      onClick={() => patch({ netPayablePercent: p })}
                    >
                      {p}%
                    </Button>
                  ))}
                  <TextField
                    size="small"
                    type="number"
                    value={netPayablePercent}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const clamped = Math.min(
                        100,
                        Math.max(0.01, Number.isFinite(v) && v > 0 ? v : 100),
                      );
                      patch({ netPayablePercent: clamped });
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography fontWeight={700}>%</Typography>
                        </InputAdornment>
                      ),
                      inputProps: { min: 0.01, max: 100, step: 'any' },
                    }}
                    sx={{ width: 110 }}
                  />
                </Stack>
                {netPayablePercent < 100 && (
                  <Alert
                    severity="warning"
                    variant="outlined"
                    sx={{ py: 0.25, borderRadius: 2, '& .MuiAlert-message': { py: 0.5 } }}
                    icon={false}
                  >
                    Amount payable = <b>{netPayablePercent}%</b> of {rateColumnLabel}{' '}
                    {formatINR(totals.grossGrandTotal)} →{' '}
                    <b>{formatINR(totals.grandTotal)}</b>
                  </Alert>
                )}
              </Stack>
              <TextField
                size="small"
                fullWidth
                type="number"
                label="Amount Received"
                value={inv.amountPaid || 0}
                onChange={(e) => {
                  const paid = Math.max(0, Number(e.target.value) || 0);
                  patch({
                    amountPaid: paid,
                    balanceDue: Math.max(0, totals.grandTotal - paid - Number(inv.tdsDeducted || 0)),
                  });
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography fontWeight={700}>&#8377;</Typography>
                    </InputAdornment>
                  ),
                }}
              />
              <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap">
                <Chip
                  size="small"
                  label={`Paid: ${formatINR(inv.amountPaid || 0)}`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Due: ${formatINR(Math.max(0, totals.grandTotal - (inv.amountPaid || 0) - Number(inv.tdsDeducted || 0)))}`}
                  color="warning"
                  variant="outlined"
                />
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* Notes & terms */}
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
              <SectionHeader
                icon={<NotesIcon fontSize="small" />}
                title="Notes"
                subtitle="Printed on the invoice"
                color={theme.palette.grey[700]}
              />
              <TextField
                fullWidth
                size="small"
                value={inv.notes || ''}
                onChange={(e) => patch({ notes: e.target.value })}
                multiline
                minRows={3}
                placeholder="e.g. Thank you for your business."
              />
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, height: '100%' }}>
              <SectionHeader
                icon={<TermsIcon fontSize="small" />}
                title="Terms & Conditions"
                color={theme.palette.grey[700]}
              />
              <TextField
                fullWidth
                size="small"
                value={inv.terms || ''}
                onChange={(e) => patch({ terms: e.target.value })}
                multiline
                minRows={3}
                placeholder="e.g. Payment due within 30 days."
              />
            </Paper>
          </Grid>
        </Grid>
      </Stack>

      <ServiceItemPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        companyId={inv.companyId}
        onPick={handlePickCatalog}
      />
    </>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color={muted ? 'text.secondary' : 'text.primary'}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={muted ? 500 : 700}>
        {value}
      </Typography>
    </Stack>
  );
}
