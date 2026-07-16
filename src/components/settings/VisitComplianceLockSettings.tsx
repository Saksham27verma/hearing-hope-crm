'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import {
  CRM_VISIT_COMPLIANCE_LOCK_COLLECTION,
  CRM_VISIT_COMPLIANCE_LOCK_DOC_ID,
  parseVisitComplianceLockEnabled,
} from '@/lib/crmSettings/visitComplianceLock';

export default function VisitComplianceLockSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const snap = await getDoc(
        doc(db, CRM_VISIT_COMPLIANCE_LOCK_COLLECTION, CRM_VISIT_COMPLIANCE_LOCK_DOC_ID),
      );
      setEnabled(parseVisitComplianceLockEnabled(snap.data()));
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Could not load settings',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!db) {
      setMessage({ type: 'error', text: 'Database not available' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(
        doc(db, CRM_VISIT_COMPLIANCE_LOCK_COLLECTION, CRM_VISIT_COMPLIANCE_LOCK_DOC_ID),
        {
          enabled,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setMessage({
        type: 'success',
        text: enabled
          ? 'Checkout lock is ON. Staff must finish home-visit checkout before booking / trial / sale.'
          : 'Checkout lock is OFF. Booking / trial / sale are unlocked without PWA checkout.',
      });
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : 'Failed to save',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Home visit checkout lock
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        When enabled, enquiry Sale/Booking and staff-app booking / trial / sale stay locked until the
        field agent finishes end-of-visit checkout (telecaller PIN, GPS, checklist). Turn this on after
        staff training; leave it off while you train.
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <FormControlLabel
        control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
        label={
          enabled
            ? 'Require checkout before booking / trial / sale'
            : 'Checkout not required (unlocked for training)'
        }
      />
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>
    </Paper>
  );
}
