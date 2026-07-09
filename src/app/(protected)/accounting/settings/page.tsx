'use client';

import React, { useCallback, useEffect, useState } from 'react';
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
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { db } from '@/firebase/config';
import { useAccountingCompany } from '@/context/AccountingCompanyContext';
import {
  formatAccountingInvoiceNumber,
  loadAccountingNumberSettings,
  saveAccountingNumberSettings,
} from '@/services/accountingNumbering';
import type { AccountingNumberSettings } from '@/lib/accounting/types';
import { DEFAULT_ACCOUNTING_NUMBER_SETTINGS } from '@/lib/accounting/types';

export default function AccountingSettingsPage() {
  const { selectedCompanyId, selectedCompanyName } = useAccountingCompany();
  const [settings, setSettings] = useState<AccountingNumberSettings>(
    DEFAULT_ACCOUNTING_NUMBER_SETTINGS,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    try {
      const s = await loadAccountingNumberSettings(db, selectedCompanyId);
      setSettings(s);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof AccountingNumberSettings>(k: K, v: AccountingNumberSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);
    try {
      const saved = await saveAccountingNumberSettings(db, selectedCompanyId, settings);
      setSettings(saved);
      setSnack({ msg: 'Settings saved', sev: 'success' });
    } catch (e) {
      console.error(e);
      setSnack({ msg: 'Save failed', sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!selectedCompanyId) return null;

  const preview = formatAccountingInvoiceNumber(settings, settings.nextNumber);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Accounting Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Configure invoice numbering for {selectedCompanyName}.
      </Typography>

      <Paper sx={{ p: 3 }} variant="outlined">
        <Typography variant="h6" mb={2}>
          Invoice Numbering
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
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
              type="number"
              label="Padding"
              value={settings.padding}
              onChange={(e) => set('padding', Math.max(1, Math.min(10, Number(e.target.value) || 4)))}
              helperText="Digits"
              disabled={loading}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              fullWidth
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
              <Chip label={preview} color="primary" variant="outlined" />
            </Stack>
          </Grid>
        </Grid>
        <Stack direction="row" spacing={1} mt={3}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={() => void load()} disabled={loading}>
            Reload
          </Button>
        </Stack>
        <Alert severity="info" sx={{ mt: 3 }}>
          Each business company has its own counter. Changing the next number won't retroactively renumber existing invoices.
        </Alert>
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
