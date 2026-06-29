'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import PeopleIcon from '@mui/icons-material/People';
import { useAuth } from '@/context/AuthContext';

type LifecycleStats = {
  dueToday?: number;
  upcoming7?: number;
  whatsappSentToday?: number;
  totalSales?: number;
  milestoneRulesCount?: number;
  dueByMilestone?: Record<string, number>;
};

export default function CustomerLifecyclePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<LifecycleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  const lifecycleBase = process.env.NEXT_PUBLIC_LIFECYCLE_APP_URL || '';

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/lifecycle/stats-proxy');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load stats');
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lifecycle stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const openLifecycleApp = async (path = '/dashboard') => {
    if (!user) return;
    setOpening(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/lifecycle/issue-app-token', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open app');
      const base = lifecycleBase || data.url?.split('?')[0] || '';
      const url = data.url?.includes(path)
        ? data.url.replace('/dashboard', path)
        : `${base.replace(/\/$/, '')}${path}?token=${encodeURIComponent(data.token)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open lifecycle app');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Customer Lifecycle
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Post-sale marketing for legacy Zoho sales. Data lives in the lifecycle app; CRM shows alerts
        and sends WhatsApp via Pinnacle.
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          startIcon={<OpenInNewIcon />}
          disabled={opening}
          onClick={() => void openLifecycleApp('/dashboard')}
        >
          Open Lifecycle App
        </Button>
        <Button variant="outlined" onClick={() => void openLifecycleApp('/sales?filter=due_today')}>
          Today&apos;s due list
        </Button>
        <Button
          variant="outlined"
          color="success"
          startIcon={<WhatsAppIcon />}
          onClick={() => void openLifecycleApp('/whatsapp/bulk?date=today')}
        >
          Bulk WhatsApp
        </Button>
        <Button variant="outlined" onClick={() => void openLifecycleApp('/sales/import')}>
          Import CSV
        </Button>
      </Stack>

      {loading ? (
        <CircularProgress />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          {[
            { label: 'Due today', value: stats?.dueToday ?? 0 },
            { label: 'Upcoming 7 days', value: stats?.upcoming7 ?? 0 },
            { label: 'WA sent today', value: stats?.whatsappSentToday ?? 0 },
            { label: 'Total legacy sales', value: stats?.totalSales ?? 0 },
          ].map((c) => (
            <Card key={c.label}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  {c.label}
                </Typography>
                <Typography variant="h4" fontWeight={700}>
                  {c.value}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {stats?.dueByMilestone && Object.keys(stats.dueByMilestone).length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Due today by milestone
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(stats.dueByMilestone).map(([k, v]) => (
              <Typography key={k} variant="body2">
                {k}: <strong>{v}</strong>
              </Typography>
            ))}
          </Stack>
        </Box>
      )}

      <Alert severity="info" icon={<PeopleIcon />} sx={{ mt: 3 }}>
        Configure who receives CRM bell notifications in Settings → Customer Lifecycle notifications.
        Set <code>LIFECYCLE_APP_URL</code> and matching secrets on both apps.
      </Alert>
    </Box>
  );
}
