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
import { db, auth } from '@/firebase/config';
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

type ServerStatus = {
  smtpConfigured: boolean;
  recipientCount: number;
  recipientsPreview: string[];
} | null;

export default function StaffPaymentNotifySettings() {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchServerStatus = useCallback(async () => {
    const user = auth?.currentUser;
    if (!user) {
      setServerStatus(null);
      return;
    }
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/settings/staff-payment-test-email', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setServerStatus({
          smtpConfigured: !!data.smtpConfigured,
          recipientCount: Number(data.recipientCount) || 0,
          recipientsPreview: Array.isArray(data.recipientsPreview) ? data.recipientsPreview : [],
        });
      } else {
        setServerStatus(null);
      }
    } catch {
      setServerStatus(null);
    }
  }, []);

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
    void fetchServerStatus();
  }, [fetchServerStatus]);

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
        text: `Saved ${emails.length} recipient${emails.length === 1 ? '' : 's'}.`,
      });
      void fetchServerStatus();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    const user = auth?.currentUser;
    if (!user) {
      setMessage({ type: 'error', text: 'Sign in to the CRM to send a test email.' });
      return;
    }
    setTesting(true);
    setMessage(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/settings/staff-payment-test-email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          type: 'error',
          text: (data as { error?: string }).error || `Test failed (${res.status})`,
        });
        void fetchServerStatus();
        return;
      }
      const sent = (data as { sentTo?: string[] }).sentTo;
      setMessage({
        type: 'success',
        text: (data as { message?: string }).message || `Sent to ${(sent || []).join(', ')}`,
      });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setTesting(false);
      void fetchServerStatus();
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
              Recipients are saved in Firestore. <strong>Emails are always sent from the server</strong> (Vercel / your
              host), not from this browser — you must configure SMTP there. Saving addresses here does not send mail by
              itself.
            </Typography>
          </Box>
        </Box>

        {serverStatus && !serverStatus.smtpConfigured && (
          <Alert severity="warning">
            <strong>SMTP is not configured</strong> on the server (missing <code>SMTP_HOST</code> /{' '}
            <code>SMTP_PORT</code>). Add them in Vercel → Environment Variables (or <code>.env.local</code> for local
            dev), then redeploy / restart <code>npm run dev</code>. Use &quot;Send test email&quot; below to verify.
          </Alert>
        )}

        {serverStatus && serverStatus.smtpConfigured && serverStatus.recipientCount === 0 && (
          <Alert severity="info">
            SMTP is set, but <strong>no recipient emails</strong> are resolved yet. Save valid addresses above or set{' '}
            <code>STAFF_PAYMENT_NOTIFY_EMAILS</code> on the server.
          </Alert>
        )}

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
            {serverStatus && serverStatus.recipientCount > 0 && (
              <Typography variant="caption" color="text.secondary" display="block">
                Server sees {serverStatus.recipientCount} recipient(s) for staff payment PDFs
                {serverStatus.recipientsPreview.length > 0
                  ? ` (e.g. ${serverStatus.recipientsPreview.slice(0, 3).join(', ')}${serverStatus.recipientCount > 3 ? '…' : ''})`
                  : ''}
                .
              </Typography>
            )}
            {message && (
              <Alert severity={message.type === 'info' ? 'info' : message.type} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save recipients'}
              </Button>
              <Button variant="outlined" onClick={() => void load()} disabled={saving || loading}>
                Reload
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => void handleTestEmail()}
                disabled={testing || saving}
              >
                {testing ? 'Sending…' : 'Send test email'}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary" component="div">
              <strong>Typical SMTP (Gmail):</strong> host <code>smtp.gmail.com</code>, port <code>587</code>, user =
              full email, password = Google &quot;App password&quot; (not your normal password).{' '}
              <strong>Local:</strong> add the same variables to <code>.env.local</code> and restart the dev server.
            </Typography>
          </>
        )}
      </Stack>
    </Paper>
  );
}
