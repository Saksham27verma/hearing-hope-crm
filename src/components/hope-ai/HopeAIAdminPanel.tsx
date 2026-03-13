'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

interface Props {
  getAuthToken: () => Promise<string>;
}

interface AdminState {
  settings?: {
    provider: 'groq' | 'openrouter';
    model: string;
    temperature: number;
  };
  status?: {
    documentCount?: number;
    lastIndexedBy?: string;
    lastIndexedAt?: any;
  };
  logs?: Array<any>;
}

export default function HopeAIAdminPanel({ getAuthToken }: Props) {
  const [state, setState] = useState<AdminState>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadAdminState = async () => {
    setLoading(true);
    setMessage('');
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/hope-ai/admin', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load Hope AI admin data');
      setState(data);
    } catch (error: any) {
      setMessage(error?.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminState();
  }, []);

  const updateSettings = async () => {
    if (!state.settings) return;
    setLoading(true);
    setMessage('');
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/hope-ai/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'update-settings',
          ...state.settings,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update Hope AI settings');
      setState(prev => ({ ...prev, settings: data.settings }));
      setMessage('Hope AI settings updated successfully.');
    } catch (error: any) {
      setMessage(error?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const runReindex = async () => {
    setLoading(true);
    setMessage('');
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/hope-ai/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'reindex' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reindex Hope AI data');
      setMessage(`Hope AI reindex completed for ${data.result?.count || 0} documents.`);
      await loadAdminState();
    } catch (error: any) {
      setMessage(error?.message || 'Failed to reindex Hope AI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      {message ? <Alert severity={message.includes('successfully') || message.includes('completed') ? 'success' : 'info'}>{message}</Alert> : null}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Model Settings
        </Typography>
        <Stack spacing={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Provider</InputLabel>
            <Select
              label="Provider"
              value={state.settings?.provider || 'groq'}
              onChange={(event) => setState(prev => ({
                ...prev,
                settings: {
                  provider: event.target.value as 'groq' | 'openrouter',
                  model: prev.settings?.model || '',
                  temperature: prev.settings?.temperature ?? 0.2,
                },
              }))}
            >
              <MenuItem value="groq">Groq</MenuItem>
              <MenuItem value="openrouter">OpenRouter</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Model"
            value={state.settings?.model || ''}
            onChange={(event) => setState(prev => ({
              ...prev,
              settings: {
                provider: prev.settings?.provider || 'groq',
                model: event.target.value,
                temperature: prev.settings?.temperature ?? 0.2,
              },
            }))}
          />

          <TextField
            size="small"
            label="Temperature"
            type="number"
            inputProps={{ min: 0, max: 1, step: 0.1 }}
            value={state.settings?.temperature ?? 0.2}
            onChange={(event) => setState(prev => ({
              ...prev,
              settings: {
                provider: prev.settings?.provider || 'groq',
                model: prev.settings?.model || '',
                temperature: Number(event.target.value),
              },
            }))}
          />

          <Button variant="contained" onClick={updateSettings} disabled={loading}>
            Save Settings
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Index Status
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`Documents: ${state.status?.documentCount || 0}`} variant="outlined" />
          {state.status?.lastIndexedBy ? <Chip label={`Last by: ${state.status.lastIndexedBy}`} variant="outlined" /> : null}
        </Stack>
        <Box mt={2}>
          <Button variant="outlined" onClick={runReindex} disabled={loading}>
            Rebuild Hope AI Index
          </Button>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Recent Logs
        </Typography>
        <Stack spacing={1.25}>
          {(state.logs || []).slice(0, 8).map((log) => (
            <Paper key={log.id} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5 }}>
              <Typography variant="body2" fontWeight={600}>
                {log.message || 'Hope AI request'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {log.status || 'unknown'} {typeof log.latencyMs === 'number' ? `• ${log.latencyMs}ms` : ''}
              </Typography>
            </Paper>
          ))}
          {!state.logs?.length ? (
            <Typography variant="body2" color="text.secondary">
              No Hope AI logs available yet.
            </Typography>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}
