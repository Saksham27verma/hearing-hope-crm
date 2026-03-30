'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Link,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import {
  formatPtaTestDateForDisplay,
  listItemToStoredLink,
  type ExternalPtaReportLink,
  type PtaReportListItem,
} from '@/lib/ptaIntegration';

type Props = {
  value: ExternalPtaReportLink | undefined;
  onChange: (next: ExternalPtaReportLink | undefined) => void;
  getIdToken: () => Promise<string | null>;
  disabled?: boolean;
};

export default function ExternalPtaReportPicker({
  value,
  onChange,
  getIdToken,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PtaReportListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const selectedOption = useMemo((): PtaReportListItem | null => {
    if (!value?.reportId) return null;
    return {
      id: value.reportId,
      patientName: value.patientLabel,
      viewUrl: value.viewUrl,
      ...(value.testDate ? { testDate: value.testDate } : {}),
    };
  }, [value]);

  const optionPrimaryLabel = (o: PtaReportListItem) => {
    const date = formatPtaTestDateForDisplay(o.testDate || o.createdAt);
    return date ? `${o.patientName} · ${date}` : o.patientName;
  };

  const fetchReports = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      setConfigError(null);
      try {
        const token = await getIdToken();
        if (!token) {
          setError('Not signed in');
          setOptions([]);
          return;
        }
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        const res = await fetch(`/api/pta-reports?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 503) {
          setConfigError(
            typeof data?.error === 'string'
              ? data.error
              : 'PTA software URL is not configured on the server.'
          );
          setOptions([]);
          return;
        }
        if (!res.ok) {
          let msg = typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
          if (typeof data?.upstreamHint === 'string' && data.upstreamHint.trim()) {
            msg += ` — ${data.upstreamHint.trim()}`;
          }
          if (typeof data?.requestedUrl === 'string' && data.requestedUrl) {
            msg += ` [called: ${data.requestedUrl}]`;
          }
          setError(msg);
          setOptions([]);
          return;
        }
        const list = Array.isArray(data?.reports) ? data.reports : [];
        setOptions(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load reports');
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [getIdToken]
  );

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      void fetchReports(input);
    }, 300);
    return () => window.clearTimeout(t);
  }, [open, input, fetchReports]);

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
        PTA report from external software
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Select a report created in your PTA app. The link is stored on this visit and shown on the patient
        profile.
      </Typography>
      {configError && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {configError}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Autocomplete<PtaReportListItem, false, false, false>
        open={open}
        onOpen={() => {
          setOpen(true);
          void fetchReports(input);
        }}
        onClose={() => setOpen(false)}
        value={selectedOption}
        onChange={(_, item) => {
          if (!item) {
            onChange(undefined);
            return;
          }
          onChange(listItemToStoredLink(item));
        }}
        inputValue={input}
        onInputChange={(_, v, reason) => {
          if (reason === 'input' || reason === 'clear') setInput(v);
        }}
        options={options}
        loading={loading}
        disabled={disabled}
        getOptionLabel={(o) => {
          if (!o?.id) return '';
          return `${optionPrimaryLabel(o)} · ${o.id}`;
        }}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id} sx={{ py: 1 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {option.patientName}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {[
                  formatPtaTestDateForDisplay(option.testDate || option.createdAt) || null,
                  `ID: ${option.id}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search PTA reports (name & date)"
            placeholder="Type to filter…"
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
      {value?.viewUrl && (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Link href={value.viewUrl} target="_blank" rel="noopener noreferrer" variant="body2">
            Open linked PTA report
          </Link>
          <Button size="small" color="inherit" disabled={disabled} onClick={() => onChange(undefined)}>
            Unlink
          </Button>
        </Box>
      )}
    </Box>
  );
}
