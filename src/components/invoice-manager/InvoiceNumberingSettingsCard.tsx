'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import { Tag as TagIcon } from '@mui/icons-material';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import {
  formatInvoiceNumber,
  loadInvoiceNumberSettings,
  saveInvoiceNumberSettings,
} from '@/services/invoiceNumbering';
import type { InvoiceNumberSettings } from '@/lib/invoice-numbering/types';

export default function InvoiceNumberingSettingsCard() {
  const { user, userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefix, setPrefix] = useState('INV-');
  const [suffix, setSuffix] = useState(`/${new Date().getFullYear()}`);
  const [padding, setPadding] = useState(4);
  const [nextNumber, setNextNumber] = useState(1);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const draftSettings: InvoiceNumberSettings = useMemo(
    () => ({
      prefix,
      suffix,
      padding: Math.min(12, Math.max(1, Math.floor(padding) || 4)),
      next_number: Math.max(1, Math.floor(nextNumber) || 1),
    }),
    [prefix, suffix, padding, nextNumber]
  );

  const previewNext = useMemo(
    () => formatInvoiceNumber(draftSettings, draftSettings.next_number),
    [draftSettings]
  );

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    setLoading(true);
    try {
      const s = await loadInvoiceNumberSettings(db);
      setPrefix(s.prefix);
      setSuffix(s.suffix);
      setPadding(s.padding);
      setNextNumber(s.next_number);
    } catch (e) {
      console.error(e);
      setError('Could not load invoice numbering settings.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!user || !isAdmin) return;
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      await saveInvoiceNumberSettings(db, {
        prefix: prefix.trim(),
        suffix: suffix.trim(),
        padding: draftSettings.padding,
        next_number: draftSettings.next_number,
      });
      setSavedMsg('Invoice numbering saved. New sales will use this format.');
    } catch (e) {
      console.error(e);
      setError('Failed to save. Check Firestore rules for invoiceSettings.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Paper elevation={0} sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, py: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <TagIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Sales invoice numbering
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Prefix, suffix, and sequence used by Sales &amp; Invoicing (stored once for your whole team).
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ p: 2.5 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            {savedMsg && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSavedMsg('')}>
                {savedMsg}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Prefix"
                  fullWidth
                  size="small"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="INV-"
                  helperText="Before the number"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Suffix"
                  fullWidth
                  size="small"
                  value={suffix}
                  onChange={(e) => setSuffix(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="/2026"
                  helperText="After the number"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Padding"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 1, max: 12 }}
                  value={padding}
                  onChange={(e) => setPadding(parseInt(e.target.value, 10) || 1)}
                  disabled={!isAdmin}
                  helperText="Digits (e.g. 4 → 0001)"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Next number"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 1 }}
                  value={nextNumber}
                  onChange={(e) => setNextNumber(parseInt(e.target.value, 10) || 1)}
                  disabled={!isAdmin}
                  helperText="Next value when a sale uses auto-number"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box display="flex" flexWrap="wrap" alignItems="center" gap={2}>
              <Typography variant="body2" color="text.secondary">
                Preview (next automatic invoice):
              </Typography>
              <Chip label={previewNext} sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }} />
            </Box>

            {!isAdmin && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Only administrators can change these fields. Ask an admin to update prefix, suffix, or sequence.
              </Alert>
            )}

            {isAdmin && (
              <Box display="flex" gap={1} mt={2} flexWrap="wrap">
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save numbering'}
                </Button>
                <Button variant="outlined" onClick={load} disabled={saving}>
                  Reload from server
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}
