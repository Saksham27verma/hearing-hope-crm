'use client';

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import { Timestamp } from 'firebase/firestore';
import DiffIcon from '@mui/icons-material/CompareArrows';
import type { ActivityLogDoc } from './types';
import type { ActivityAction } from '@/lib/activityLogger';

// ── Action badge config ────────────────────────────────────────────────────────
const ACTION_CONFIG: Record<
  ActivityAction,
  { label: string; bg: string; color: string; dot: string }
> = {
  CREATE: { label: 'Create', bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  UPDATE: { label: 'Update', bg: '#fef9c3', color: '#854d0e', dot: '#eab308' },
  DELETE: { label: 'Delete', bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  STATUS_CHANGE: { label: 'Status', bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  CANCEL: { label: 'Cancel', bg: '#ffedd5', color: '#9a3412', dot: '#f97316' },
  FOLLOW_UP: { label: 'Follow-up', bg: '#ede9fe', color: '#6d28d9', dot: '#8b5cf6' },
  RESCHEDULE: { label: 'Reschedule', bg: '#cffafe', color: '#0e7490', dot: '#06b6d4' },
  LOGIN: { label: 'Login', bg: '#f0fdf4', color: '#166534', dot: '#4ade80' },
  IMPORT: { label: 'Import', bg: '#f8fafc', color: '#475569', dot: '#94a3b8' },
};

const MODULE_COLORS: Record<string, string> = {
  Enquiries: '#3b82f6',
  Sales: '#22c55e',
  Purchases: '#f59e0b',
  'Material In': '#14b8a6',
  'Material Out': '#f97316',
  Appointments: '#8b5cf6',
  Telecalling: '#ec4899',
  'Stock Transfer': '#06b6d4',
  Users: '#64748b',
  Staff: '#78716c',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  try {
    if (ts.toMillis() <= 0) return '—';
    const d = ts.toDate();
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

function formatTimeRelative(ts: Timestamp | undefined): string {
  if (!ts) return '';
  try {
    if (ts.toMillis() <= 0) return '';
    const diff = Date.now() - ts.toMillis();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

interface Props {
  log: ActivityLogDoc;
  onViewDiff: (log: ActivityLogDoc) => void;
}

export default function ActivityLogItem({ log, onViewDiff }: Props) {
  const actionCfg = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.UPDATE;
  const moduleColor = MODULE_COLORS[log.module] ?? '#64748b';
  const hasDiff = log.changes && Object.keys(log.changes).length > 0;
  const roleLabel = log.userRole === 'admin' ? 'Admin' : log.userRole === 'staff' ? 'Staff' : 'Audiologist';

  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        py: 1.5,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '160px 1fr 100px 130px 110px 48px' },
        gap: { xs: 1, md: 2 },
        alignItems: 'center',
        '&:hover': { bgcolor: alpha('#000', 0.02) },
        transition: 'background 0.15s',
      }}
    >
      {/* Time */}
      <Box>
        <Typography
          variant="caption"
          fontWeight={600}
          color="text.primary"
          display="block"
          sx={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}
        >
          {formatTime(log.timestamp)}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
          {formatTimeRelative(log.timestamp)}
        </Typography>
      </Box>

      {/* User + description */}
      <Stack direction="row" alignItems="flex-start" gap={1.5} minWidth={0}>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: 12,
            fontWeight: 700,
            bgcolor: alpha(moduleColor, 0.15),
            color: moduleColor,
            flexShrink: 0,
            mt: 0.25,
          }}
        >
          {getInitials(log.userName || '?')}
        </Avatar>
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
            <Typography variant="body2" fontWeight={600} noWrap>
              {log.userName || log.userEmail || 'Unknown'}
            </Typography>
            <Chip
              label={roleLabel}
              size="small"
              sx={{
                height: 16,
                fontSize: 9,
                fontWeight: 700,
                bgcolor: alpha('#64748b', 0.1),
                color: '#475569',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: { xs: '100%', md: 360 },
            }}
          >
            {log.description}
          </Typography>
        </Box>
      </Stack>

      {/* Module */}
      <Box>
        <Chip
          label={log.module}
          size="small"
          sx={{
            height: 22,
            fontSize: 11,
            fontWeight: 600,
            bgcolor: alpha(moduleColor, 0.1),
            color: moduleColor,
            border: `1px solid ${alpha(moduleColor, 0.25)}`,
            '& .MuiChip-label': { px: 1 },
          }}
        />
      </Box>

      {/* Action badge */}
      <Box>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.25,
            py: 0.35,
            borderRadius: 99,
            bgcolor: actionCfg.bg,
            border: `1px solid ${alpha(actionCfg.dot, 0.3)}`,
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: actionCfg.dot,
              flexShrink: 0,
            }}
          />
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              color: actionCfg.color,
              letterSpacing: 0.3,
            }}
          >
            {actionCfg.label}
          </Typography>
        </Box>
      </Box>

      {/* Entity */}
      <Tooltip title={log.entityName || ''}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 110,
            display: 'block',
          }}
        >
          {log.entityName || '—'}
        </Typography>
      </Tooltip>

      {/* Diff button */}
      <Box display="flex" justifyContent="center">
        {hasDiff ? (
          <Tooltip title="View field-level changes">
            <IconButton
              size="small"
              onClick={() => onViewDiff(log)}
              sx={{
                color: '#3b82f6',
                bgcolor: alpha('#3b82f6', 0.08),
                '&:hover': { bgcolor: alpha('#3b82f6', 0.16) },
                width: 28,
                height: 28,
              }}
            >
              <DiffIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
    </Box>
  );
}
