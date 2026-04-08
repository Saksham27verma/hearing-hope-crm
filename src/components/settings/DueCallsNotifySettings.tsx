'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Email as EmailIcon } from '@mui/icons-material';
import { auth, db } from '@/firebase/config';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  CRM_DUE_CALLS_NOTIFY_COLLECTION,
  CRM_DUE_CALLS_NOTIFY_DOC_ID,
} from '@/lib/crmSettings/dueCallsNotify';

type ServerStatus = {
  smtpConfigured: boolean;
  recipientCount: number;
  recipientsPreview: string[];
  schedule?: {
    enabled: boolean;
    sendHourIst: number;
    sendMinuteIst: number;
  };
  latestRun?: {
    key?: string;
    sent?: boolean;
    inProgress?: boolean;
    sentAt?: string;
    failedAt?: string;
    error?: string | null;
    dueCount?: number;
    recipientCount?: number;
  } | null;
} | null;

function parseEmailsInput(text: string): string[] {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const parts = text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts.filter((e) => EMAIL_RE.test(e)))];
}

export default function DueCallsNotifySettings() {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [sendHourIst, setSendHourIst] = useState(9);
  const [sendMinuteIst, setSendMinuteIst] = useState(0);
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
      const res = await fetch('/api/settings/due-calls-test-email', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        const schedule = (data.schedule || {}) as { enabled?: boolean; sendHourIst?: number; sendMinuteIst?: number };
        const enabledFromServer = schedule.enabled !== false;
        const hourFromServer =
          Number.isFinite(Number(schedule.sendHourIst)) && Number(schedule.sendHourIst) >= 0 && Number(schedule.sendHourIst) <= 23
            ? Number(schedule.sendHourIst)
            : 9;
        const minuteFromServer =
          Number.isFinite(Number(schedule.sendMinuteIst)) &&
          Number(schedule.sendMinuteIst) >= 0 &&
          Number(schedule.sendMinuteIst) <= 59
            ? Number(schedule.sendMinuteIst)
            : 0;
        setServerStatus({
          smtpConfigured: !!data.smtpConfigured,
          recipientCount: Number(data.recipientCount) || 0,
          recipientsPreview: Array.isArray(data.recipientsPreview) ? data.recipientsPreview : [],
          schedule: {
            enabled: enabledFromServer,
            sendHourIst: hourFromServer,
            sendMinuteIst: minuteFromServer,
          },
          latestRun: (data.latestRun || null) as ServerStatus extends { latestRun: infer T } ? T : never,
        });
        setEnabled(enabledFromServer);
        setSendHourIst(hourFromServer);
        setSendMinuteIst(minuteFromServer);
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
      const ref = doc(db, CRM_DUE_CALLS_NOTIFY_COLLECTION, CRM_DUE_CALLS_NOTIFY_DOC_ID);
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
      const ref = doc(db, CRM_DUE_CALLS_NOTIFY_COLLECTION, CRM_DUE_CALLS_NOTIFY_DOC_ID);
      await setDoc(
        ref,
        {
          emails,
          enabled,
          sendHourIst: Math.max(0, Math.min(23, Number(sendHourIst) || 0)),
          sendMinuteIst: Math.max(0, Math.min(59, Number(sendMinuteIst) || 0)),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
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
      const res = await fetch('/api/settings/due-calls-test-email', {
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
      setMessage({
        type: 'success',
        text:
          (data as { message?: string }).message ||
          `Test email sent to ${((data as { sentTo?: string[] }).sentTo || []).length} recipients.`,
      });
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setTesting(false);
      void fetchServerStatus();
    }
  };

  const preview = parseEmailsInput(rawText);
  const latestRun = serverStatus?.latestRun;

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 3 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <EmailIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Daily due-calls digest emails
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
              The system sends today&apos;s due-calls details daily at your configured <strong>IST time</strong>.
            </Typography>
          </Box>
        </Box>

        {serverStatus && !serverStatus.smtpConfigured && (
          <Alert severity="warning">SMTP is not configured on the server. Configure SMTP variables first.</Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <TextField
              label="Recipient emails"
              placeholder={'manager@clinic.com\ntelecallinglead@clinic.com'}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              multiline
              minRows={4}
              fullWidth
              disabled={saving}
              helperText="One email per line, or separate with commas/semicolons."
            />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <FormControlLabel
                control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
                label="Enable daily due-calls digest"
              />
              <TextField
                label="Send hour (IST)"
                type="number"
                value={sendHourIst}
                onChange={(e) => setSendHourIst(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                inputProps={{ min: 0, max: 23 }}
                sx={{ width: 180 }}
              />
              <TextField
                label="Send minute (IST)"
                type="number"
                value={sendMinuteIst}
                onChange={(e) => setSendMinuteIst(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                inputProps={{ min: 0, max: 59 }}
                sx={{ width: 180 }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Scheduled time: {String(sendHourIst).padStart(2, '0')}:{String(sendMinuteIst).padStart(2, '0')} IST
            </Typography>
            <Alert severity="info">
              Vercel Hobby supports only one cron run per day. If you set a custom time different from your deployed
              cron trigger, use an external scheduler (for example cron-job.org) to call{' '}
              <code>/api/cron/due-calls-digest</code> around your selected IST time with the <code>CRON_SECRET</code>{' '}
              bearer token.
            </Alert>
            {preview.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Will send to: {preview.join(', ')}
              </Typography>
            )}
            {serverStatus && serverStatus.recipientCount > 0 && (
              <Typography variant="caption" color="text.secondary" display="block">
                Server sees {serverStatus.recipientCount} recipient(s)
                {serverStatus.recipientsPreview.length > 0
                  ? ` (e.g. ${serverStatus.recipientsPreview.slice(0, 3).join(', ')}${serverStatus.recipientCount > 3 ? '…' : ''})`
                  : ''}
                .
              </Typography>
            )}
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Last run status
              </Typography>
              {!latestRun ? (
                <Typography variant="caption" color="text.secondary">
                  No run data yet.
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  <Typography variant="caption">Run key: {latestRun.key || '-'}</Typography>
                  <Typography variant="caption">
                    Status:{' '}
                    {latestRun.inProgress
                      ? 'In progress'
                      : latestRun.sent
                        ? 'Sent'
                        : latestRun.error
                          ? 'Failed'
                          : 'Not sent'}
                  </Typography>
                  <Typography variant="caption">
                    Sent at: {latestRun.sentAt || '-'} | Failed at: {latestRun.failedAt || '-'}
                  </Typography>
                  <Typography variant="caption">
                    Due calls: {latestRun.dueCount ?? '-'} | Recipients: {latestRun.recipientCount ?? '-'}
                  </Typography>
                  {latestRun.error ? (
                    <Typography variant="caption" color="error.main">
                      Error: {latestRun.error}
                    </Typography>
                  ) : null}
                </Stack>
              )}
            </Paper>
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
          </>
        )}
      </Stack>
    </Paper>
  );
}
