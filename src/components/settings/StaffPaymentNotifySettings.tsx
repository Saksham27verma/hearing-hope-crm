'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Email as EmailIcon } from '@mui/icons-material';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import {
  CRM_STAFF_PAYMENT_NOTIFY_COLLECTION,
  CRM_STAFF_PAYMENT_NOTIFY_DOC_ID,
} from '@/lib/crmSettings/staffPaymentNotify';

function parseEmailsInput(text: string): string[] {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const parts = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts.filter((e) => EMAIL_RE.test(e)))];
}

export default function StaffPaymentNotifySettings() {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const ref = doc(db, CRM_STAFF_PAYMENT_NOTIFY_COLLECTION, CRM_STAFF_PAYMENT_NOTIFY_DOC_ID);
      const snap = await getDoc(ref);
      const emails = snap.exists() ? (snap.data()?.emails as unknown) : undefined;
      if (Array.isArray(emails) && emails.length > 0) {
        setRawText(emails.map((e) => String(e).trim()).filter(Boolean).join('\n'));
      } else {
        setRawText('');
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Could not load settings' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!db) {
      setMessage({ type: 'error', text: 'Firestore is not configured' });
      return;
    }
    const emails = parseEmailsInput(rawText);
    setSaving(true);
    setMessage(null);
    try {
      const ref = doc(db, CRM_STAFF_PAYMENT_NOTIFY_COLLECTION, CRM_STAFF_PAYMENT_NOTIFY_DOC_ID);
      await setDoc(
        ref,
        {
          emails,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setRawText(emails.join('\n'));
      setMessage({
        type: 'success',
        text: `Saved ${emails.length} recipient${emails.length === 1 ? '' : 's'}. Staff payment PDFs will be sent here (SMTP must also be configured).`,
      });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const preview = parseEmailsInput(rawText);

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <EmailIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Staff payment & receipt emails
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              When staff log a payment from the mobile app or Staff PWA, the CRM generates a PDF and emails it to these
              addresses. This list is stored in Firestore and overrides <strong>STAFF_PAYMENT_NOTIFY_EMAILS</strong> in
              the environment when at least one valid email is saved here. SMTP variables (<code>SMTP_HOST</code>, etc.)
              must still be set on the server.
            </Typography>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <TextField
              label="Recipient emails"
              placeholder={'accounts@clinic.com\nmanager@clinic.com'}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              disabled={saving}
              helperText="One email per line, or separate with commas or semicolons. Invalid addresses are ignored on save."
            />
            {preview.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Will send to: {preview.join(', ')}
              </Typography>
            )}
            {message && (
              <Alert severity={message.type} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save recipients'}
              </Button>
              <Button variant="outlined" onClick={() => void load()} disabled={saving || loading}>
                Reload
              </Button>
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}
