'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Chip,
  alpha,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Paper,
  IconButton,
} from '@mui/material';
import { Timestamp } from 'firebase/firestore';
import CloseIcon from '@mui/icons-material/Close';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { CRM_ACCENT } from '@/components/Layout/crm-theme';
import type { ActivityLogDoc } from './types';

interface Props {
  log: ActivityLogDoc | null;
  onClose: () => void;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '(empty)';
  if (val instanceof Timestamp) {
    try {
      return val.toDate().toLocaleString('en-IN');
    } catch {
      return String(val);
    }
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function fieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export default function ActivityLogDiffModal({ log, onClose }: Props) {
  if (!log) return null;

  const changes = log.changes ? Object.entries(log.changes) : [];

  return (
    <Dialog
      open={Boolean(log)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          bgcolor: alpha(CRM_ACCENT, 0.06),
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 2,
          px: 3,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: alpha(CRM_ACCENT, 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CompareArrowsIcon sx={{ color: CRM_ACCENT, fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Field Changes
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {log.description}
              </Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Context */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: '#fafafa',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          {[
            { label: 'User', value: log.userName || log.userEmail },
            { label: 'Module', value: log.module },
            { label: 'Entity', value: log.entityName },
            {
              label: 'Time',
              value: log.timestamp instanceof Timestamp
                ? log.timestamp.toDate().toLocaleString('en-IN')
                : '—',
            },
          ].map((item) => (
            <Box key={item.label}>
              <Typography variant="caption" color="text.secondary" display="block" fontWeight={600}>
                {item.label}
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {item.value || '—'}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Diff table */}
        {changes.length === 0 ? (
          <Box display="flex" justifyContent="center" py={4}>
            <Typography color="text.secondary" variant="body2">
              No field-level changes recorded for this event.
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(CRM_ACCENT, 0.04) }}>
                <TableCell sx={{ fontWeight: 700, width: '20%', fontSize: 12 }}>Field</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '40%', fontSize: 12 }}>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#ef4444',
                      }}
                    />
                    Before
                  </Stack>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: '40%', fontSize: 12 }}>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#22c55e',
                      }}
                    />
                    After
                  </Stack>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {changes.map(([key, { before, after }]) => (
                <TableRow
                  key={key}
                  sx={{ '&:hover': { bgcolor: alpha(CRM_ACCENT, 0.03) } }}
                >
                  <TableCell>
                    <Typography variant="caption" fontWeight={600} color="text.primary">
                      {fieldLabel(key)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        bgcolor: before === null || before === undefined ? 'transparent' : alpha('#ef4444', 0.06),
                        border: before === null || before === undefined ? 'none' : `1px solid ${alpha('#ef4444', 0.2)}`,
                        borderRadius: 1,
                        px: 1,
                        py: 0.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        color={before === null || before === undefined ? 'text.disabled' : 'error'}
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          display: 'block',
                          maxHeight: 100,
                          overflow: 'auto',
                        }}
                      >
                        {formatValue(before)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        bgcolor: after === null || after === undefined ? 'transparent' : alpha('#22c55e', 0.06),
                        border: after === null || after === undefined ? 'none' : `1px solid ${alpha('#22c55e', 0.2)}`,
                        borderRadius: 1,
                        px: 1,
                        py: 0.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        color={after === null || after === undefined ? 'text.disabled' : 'success.main'}
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          display: 'block',
                          maxHeight: 100,
                          overflow: 'auto',
                        }}
                      >
                        {formatValue(after)}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Chip
          label={`${changes.length} field${changes.length !== 1 ? 's' : ''} changed`}
          size="small"
          sx={{ bgcolor: alpha(CRM_ACCENT, 0.1), color: CRM_ACCENT, fontWeight: 600 }}
        />
        <Box flex={1} />
        <Button variant="outlined" size="small" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
