'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { ConfirmationNumber as ReceiptIcon } from '@mui/icons-material';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import {
  formatBookingReceiptPreview,
  formatTrialReceiptPreview,
  loadReceiptNumberSettings,
  saveReceiptNumberSettings,
  type ReceiptNumberSettings,
} from '@/services/receiptNumbering';

export default function ReceiptNumberingSettingsCard() {
  const { user, userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [bookingNext, setBookingNext] = useState(1);
  const [trialNext, setTrialNext] = useState(1);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const draft: ReceiptNumberSettings = useMemo(
    () => ({
      booking_next_number: Math.max(1, Math.floor(bookingNext) || 1),
      trial_next_number: Math.max(1, Math.floor(trialNext) || 1),
    }),
    [bookingNext, trialNext]
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const s = await loadReceiptNumberSettings(db);
      setBookingNext(s.booking_next_number);
      setTrialNext(s.trial_next_number);
    } catch (e) {
      console.error(e);
      setError('Could not load receipt numbering settings.');
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
      await saveReceiptNumberSettings(db, draft);
      setSavedMsg('Receipt numbering saved. New booking/trial receipts will use this sequence.');
    } catch (e) {
      console.error(e);
      setError('Failed to save receipt numbering settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackfill = async () => {
    if (!user || !isAdmin) return;
    setBackfilling(true);
    setError('');
    setSavedMsg('');
    try {
      const res = await fetch('/api/admin/backfill-receipt-numbers', { method: 'POST' });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        docsUpdated?: number;
        bookingRewritten?: number;
        trialRewritten?: number;
      };
      if (!res.ok || !j?.ok) throw new Error(j?.error || 'Backfill failed');
      setSavedMsg(
        `Backfill complete. Updated ${j.docsUpdated || 0} enquiries (${j.bookingRewritten || 0} booking + ${j.trialRewritten || 0} trial numbers).`
      );
      await load();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Backfill failed.');
    } finally {
      setBackfilling(false);
    }
  };

  if (!user) return null;

  return (
    <Paper elevation={0} sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, py: 2, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={1.5}>
          <ReceiptIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Receipt numbering
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Separate strict sequences for Booking (`BR-`) and Trial (`TR-`) receipts.
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
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Booking next number"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 1 }}
                  value={bookingNext}
                  onChange={(e) => setBookingNext(parseInt(e.target.value, 10) || 1)}
                  disabled={!isAdmin}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Trial next number"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 1 }}
                  value={trialNext}
                  onChange={(e) => setTrialNext(parseInt(e.target.value, 10) || 1)}
                  disabled={!isAdmin}
                />
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Box display="flex" flexWrap="wrap" alignItems="center" gap={2}>
              <Typography variant="body2" color="text.secondary">
                Next previews:
              </Typography>
              <Chip label={formatBookingReceiptPreview(draft.booking_next_number)} sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }} />
              <Chip label={formatTrialReceiptPreview(draft.trial_next_number)} sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }} />
            </Box>
            {isAdmin ? (
              <Box display="flex" gap={1} mt={2} flexWrap="wrap">
                <Button variant="contained" onClick={handleSave} disabled={saving || backfilling}>
                  {saving ? 'Saving…' : 'Save receipt numbering'}
                </Button>
                <Button variant="outlined" onClick={load} disabled={saving || backfilling}>
                  Reload from server
                </Button>
                <Button color="warning" variant="outlined" onClick={handleBackfill} disabled={saving || backfilling}>
                  {backfilling ? 'Backfilling…' : 'Backfill legacy / duplicate receipts'}
                </Button>
              </Box>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                Only administrators can change receipt numbering or run backfill.
              </Alert>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}

