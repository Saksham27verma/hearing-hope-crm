'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { auth, db } from '@/firebase/config';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  CRM_SALE_MILESTONE_NOTIFY_COLLECTION,
  CRM_SALE_MILESTONE_NOTIFY_DOC_ID,
} from '@/lib/crmSettings/saleMilestoneNotify';

export default function SaleMilestoneNotifySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [notificationUserIds, setNotificationUserIds] = useState<string[]>([]);
  const [userOptions, setUserOptions] = useState<
    Array<{ uid: string; displayName: string; email: string }>
  >([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = auth?.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const statusRes = await fetch('/api/settings/sale-milestone-notify-status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statusRes.ok) {
        const data = await statusRes.json();
        setEnabled(data.enabled !== false);
        setNotificationUserIds(data.notificationUserIds || []);
        setUserOptions(data.userOptions || []);
      } else {
        const snap = await getDoc(
          doc(db, CRM_SALE_MILESTONE_NOTIFY_COLLECTION, CRM_SALE_MILESTONE_NOTIFY_DOC_ID),
        );
        const data = snap.data() || {};
        setEnabled(data.enabled !== false);
        setNotificationUserIds(
          Array.isArray(data.notificationUserIds) ? data.notificationUserIds : [],
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(
        doc(db, CRM_SALE_MILESTONE_NOTIFY_COLLECTION, CRM_SALE_MILESTONE_NOTIFY_DOC_ID),
        {
          enabled,
          notificationUserIds,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setMessage({ type: 'success', text: 'Sale milestone notification settings saved.' });
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

  const selectedUsers = userOptions.filter((u) => notificationUserIds.includes(u.uid));

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Customer Lifecycle notifications
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        When the lifecycle app detects a sale anniversary, CRM users below receive a notification in
        the bell. Legacy sales data stays in the lifecycle app (Turso), not Firebase.
      </Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <FormControlLabel
        control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
        label="Enable sale milestone notifications"
      />
      <Box sx={{ mt: 2 }}>
        <Autocomplete
          multiple
          options={userOptions}
          getOptionLabel={(o) => `${o.displayName || o.email} (${o.email})`}
          value={selectedUsers}
          onChange={(_, v) => setNotificationUserIds(v.map((x) => x.uid))}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip {...getTagProps({ index })} key={option.uid} label={option.displayName || option.email} />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} label="Notify these CRM users (empty = all admins)" />
          )}
        />
      </Box>
      <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
        <Button variant="contained" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>
    </Paper>
  );
}
