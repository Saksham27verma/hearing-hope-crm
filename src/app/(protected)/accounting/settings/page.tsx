'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Stack,
  Alert,
  Snackbar,
  Chip,
  Divider,
  Avatar,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  Dialog,
  DialogContent,
  DialogTitle,
  useTheme,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Numbers as NumbersIcon,
  Code as CodeIcon,
  Visibility as PreviewIcon,
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { db } from '@/firebase/config';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import {
  formatAccountingInvoiceNumber,
  loadAccountingNumberSettings,
  saveAccountingNumberSettings,
  loadCompanyInvoiceTemplate,
  saveCompanyInvoiceTemplate,
} from '@/services/accountingNumbering';
import type { AccountingNumberSettings } from '@/lib/accounting/types';
import { DEFAULT_ACCOUNTING_NUMBER_SETTINGS } from '@/lib/accounting/types';
import {
  applyInvoiceTemplate,
  buildInvoiceTemplateContext,
  getDefaultInvoiceTemplate,
  getHopeEnterprisesInvoiceTemplate,
  TEMPLATE_PLACEHOLDERS,
} from '@/lib/accounting/invoiceTemplate';
import { fetchAccountingCompanyProfile } from '@/lib/accounting/companyProfile';
import type { AccountingInvoice } from '@/lib/accounting/types';

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
    <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
      <Avatar variant="rounded" sx={{ bgcolor: `${color}18`, color, width: 40, height: 40 }}>
        {icon}
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {right}
    </Stack>
  );
}

function makeSampleInvoice(companyId: string, companyName: string): AccountingInvoice {
  return {
    companyId,
    companyName,
    clientId: 'sample',
    clientSnapshot: {
      name: 'ABC Diagnostics Pvt Ltd',
      gstin: '07ABCDE1234F1Z5',
      address: 'Plot 42, Sector 18',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
      phone: '+91 98765 43210',
      email: 'billing@abcdiag.example',
    },
    invoiceNumber: 'SAMPLE/25-26/0007',
    invoiceDate: new Date().toISOString().slice(0, 10),
    invoiceMonth: 'July 2026',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    items: [
      {
        id: 's1',
        description: 'Digital Hearing Aid - RIC 312\nSignia · Silk X 3Nx',
        hsnSac: '9021',
        quantity: 1,
        rate: 65000,
        gstPercent: 18,
        amount: 65000,
      },
      {
        id: 's2',
        description: 'Pure Tone Audiometry (PTA)',
        hsnSac: '9993',
        quantity: 1,
        rate: 1500,
        gstPercent: 18,
        amount: 1500,
      },
    ],
    subtotal: 66500,
    cgst: 5985,
    sgst: 5985,
    igst: 0,
    totalGst: 11970,
    roundOff: 0,
    grandTotal: 78470,
    amountPaid: 20000,
    balanceDue: 58470,
    taxMode: 'intra',
    status: 'sent',
    notes: 'Thank you for your business.',
    terms: 'Payment due within 30 days of invoice date.',
  };
}

export default function AccountingSettingsPage() {
  const theme = useTheme();
  const { selectedCompanyId, selectedCompanyName } = useAccountingCompany();
  const [tab, setTab] = useState<'numbering' | 'template'>('numbering');
  const [settings, setSettings] = useState<AccountingNumberSettings>(
    DEFAULT_ACCOUNTING_NUMBER_SETTINGS,
  );
  const [templateHtml, setTemplateHtml] = useState<string>('');
  const [templateInitial, setTemplateInitial] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<Awaited<
    ReturnType<typeof fetchAccountingCompanyProfile>
  > | null>(null);

  const load = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const [s, tmpl, profile] = await Promise.all([
        loadAccountingNumberSettings(db, selectedCompanyId),
        loadCompanyInvoiceTemplate(db, selectedCompanyId),
        fetchAccountingCompanyProfile(selectedCompanyId),
      ]);
      setSettings(s);
      const t = tmpl || '';
      setTemplateHtml(t);
      setTemplateInitial(t);
      setCompanyProfile(profile);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof AccountingNumberSettings>(k: K, v: AccountingNumberSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const handleSaveNumbering = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);
    try {
      const saved = await saveAccountingNumberSettings(db, selectedCompanyId, settings);
      setSettings(saved);
      setSnack({ msg: 'Numbering saved', sev: 'success' });
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Save failed', sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedCompanyId) return;
    setSavingTemplate(true);
    try {
      const value = templateHtml.trim().length > 0 ? templateHtml : null;
      await saveCompanyInvoiceTemplate(db, selectedCompanyId, value);
      setTemplateInitial(templateHtml);
      setSnack({
        msg: value ? 'Template saved' : 'Reverted to built-in template',
        sev: 'success',
      });
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Save failed', sev: 'error' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const loadDefault = () => {
    setTemplateHtml(getDefaultInvoiceTemplate());
    setSnack({ msg: 'Loaded default template. Edit and Save when ready.', sev: 'info' });
  };

  const loadHopeEnterprises = () => {
    setTemplateHtml(getHopeEnterprisesInvoiceTemplate());
    setSnack({
      msg: 'Loaded Hope Enterprises template. Review logo/signature URLs, then Save.',
      sev: 'info',
    });
  };

  const clearTemplate = () => {
    if (!confirm('Clear the custom template and use the built-in one for future invoices?'))
      return;
    setTemplateHtml('');
  };

  const copyPlaceholder = (key: string) => {
    const s = `{{${key}}}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(s);
      setSnack({ msg: `Copied ${s}`, sev: 'info' });
    }
  };

  const previewHtml = useMemo(() => {
    if (!selectedCompanyId) return '';
    const sample = makeSampleInvoice(selectedCompanyId, selectedCompanyName || 'Your Company');
    const ctx = buildInvoiceTemplateContext(sample, companyProfile);
    const source = templateHtml.trim() || getDefaultInvoiceTemplate();
    try {
      return applyInvoiceTemplate(source, ctx);
    } catch (e) {
      return `<pre>Template error: ${String((e as Error).message)}</pre>`;
    }
  }, [templateHtml, selectedCompanyId, selectedCompanyName, companyProfile]);

  if (!selectedCompanyId) return null;

  const numberingPreview = formatAccountingInvoiceNumber(settings, settings.nextNumber);
  const isTemplateDirty = templateHtml !== templateInitial;
  const usingCustom = templateInitial.trim().length > 0;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Accounting Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Configure invoice numbering and the printable invoice template for {selectedCompanyName}.
      </Typography>

      <Paper variant="outlined" sx={{ mb: 2, borderRadius: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 48 }}
        >
          <Tab
            value="numbering"
            iconPosition="start"
            icon={<NumbersIcon fontSize="small" />}
            label="Invoice Numbering"
            sx={{ textTransform: 'none', minHeight: 48 }}
          />
          <Tab
            value="template"
            iconPosition="start"
            icon={<CodeIcon fontSize="small" />}
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Invoice Template (HTML)</span>
                {usingCustom && (
                  <Chip size="small" label="Custom" color="primary" sx={{ height: 20 }} />
                )}
              </Stack>
            }
            sx={{ textTransform: 'none', minHeight: 48 }}
          />
        </Tabs>
      </Paper>

      {tab === 'numbering' && (
        <Paper sx={{ p: 3, borderRadius: 2 }} variant="outlined">
          <SectionHeader
            icon={<NumbersIcon />}
            title="Invoice Numbering"
            subtitle="Each company has its own atomic counter."
            color={theme.palette.primary.main}
          />
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Prefix"
                value={settings.prefix}
                onChange={(e) => set('prefix', e.target.value)}
                helperText="e.g. HDIPL/25-26/, HE/ACC/"
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Suffix"
                value={settings.suffix}
                onChange={(e) => set('suffix', e.target.value)}
                helperText="Optional"
                disabled={loading}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Padding"
                value={settings.padding}
                onChange={(e) =>
                  set('padding', Math.max(1, Math.min(10, Number(e.target.value) || 4)))
                }
                helperText="Digits"
                disabled={loading}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Next Number"
                value={settings.nextNumber}
                onChange={(e) => set('nextNumber', Math.max(1, Number(e.target.value) || 1))}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="body2" color="text.secondary">
                  Preview:
                </Typography>
                <Chip label={numberingPreview} color="primary" variant="outlined" />
              </Stack>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} mt={3}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSaveNumbering}
              disabled={saving || loading}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              {saving ? 'Saving\u2026' : 'Save Numbering'}
            </Button>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => void load()}
              disabled={loading}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              Reload
            </Button>
          </Stack>
        </Paper>
      )}

      {tab === 'template' && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, borderRadius: 2 }} variant="outlined">
              <SectionHeader
                icon={<CodeIcon />}
                title="Invoice HTML Template"
                subtitle={
                  usingCustom
                    ? 'A custom template is currently in effect for this company.'
                    : 'No custom template. Built-in default is used.'
                }
                color={theme.palette.secondary.main}
                right={
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setPreviewOpen(true)}
                      startIcon={<PreviewIcon />}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Preview
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={loadDefault}
                      startIcon={<RestoreIcon />}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Load default
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      onClick={loadHopeEnterprises}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Load Hope Enterprises
                    </Button>
                    {templateHtml && (
                      <Tooltip title="Clear custom template">
                        <IconButton size="small" onClick={clearTemplate} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                }
              />

              <TextField
                fullWidth
                multiline
                value={templateHtml}
                onChange={(e) => setTemplateHtml(e.target.value)}
                placeholder="Paste custom HTML here. Leave blank to use the built-in template."
                minRows={22}
                maxRows={32}
                InputProps={{
                  sx: {
                    fontFamily: '"JetBrains Mono", "Fira Code", Menlo, Consolas, monospace',
                    fontSize: 12,
                    lineHeight: 1.55,
                    bgcolor: '#0d1117',
                    color: '#e6edf3',
                    borderRadius: 1.5,
                    p: 1.5,
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  },
                }}
              />

              <Stack direction="row" spacing={1} mt={2} alignItems="center" flexWrap="wrap">
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate || !isTemplateDirty}
                  sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                  {savingTemplate ? 'Saving\u2026' : 'Save Template'}
                </Button>
                {isTemplateDirty && (
                  <Chip size="small" color="warning" label="Unsaved changes" />
                )}
                {!isTemplateDirty && usingCustom && (
                  <Chip size="small" color="success" label="Saved" />
                )}
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {templateHtml.length.toLocaleString()} chars
                </Typography>
              </Stack>

              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2, borderRadius: 2 }}>
                Uses simple <code>{'{{placeholder}}'}</code> substitution and
                <code>{' {{#if key}}\u2026{{/if}} '}</code> conditionals. The preview on the right
                shows a live render with sample data.
              </Alert>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, borderRadius: 2 }} variant="outlined">
              <SectionHeader
                icon={<InfoIcon />}
                title="Placeholders"
                subtitle="Click to copy."
                color={theme.palette.info.main}
              />
              <Box sx={{ maxHeight: 480, overflowY: 'auto', pr: 0.5 }}>
                <Stack spacing={1}>
                  {TEMPLATE_PLACEHOLDERS.map((p) => (
                    <Paper
                      key={p.key as string}
                      variant="outlined"
                      onClick={() => copyPlaceholder(p.key as string)}
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color: 'primary.main',
                            fontWeight: 600,
                          }}
                        >
                          {`{{${p.key}}}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap title={p.desc}>
                          {p.desc}
                        </Typography>
                      </Box>
                      <CopyIcon fontSize="small" color="action" />
                    </Paper>
                  ))}
                </Stack>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary">
                Tip: keep the outer <code>&lt;html&gt;</code> / <code>&lt;style&gt;</code> and only
                tweak layout/colours to keep browser print working reliably.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { height: '90vh', borderRadius: 3, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PreviewIcon color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Template Preview
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Rendered with sample data.
            </Typography>
          </Box>
          <IconButton onClick={() => setPreviewOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <iframe
            title="template-preview"
            srcDoc={previewHtml}
            style={{ width: '100%', height: '100%', border: 0 }}
          />
        </DialogContent>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={2500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? <Alert severity={snack.sev}>{snack.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
