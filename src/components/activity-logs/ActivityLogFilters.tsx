'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Stack,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  Collapse,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useTheme } from '@mui/material/styles';
import type { ActivityAction, ActivityModule } from '@/lib/activityLogger';

export interface FilterState {
  userId: string;
  module: string;
  action: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  search: string;
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
  disabled?: boolean;
}

const ALL_MODULES: ActivityModule[] = [
  'Enquiries', 'Sales', 'Purchases', 'Material In', 'Material Out',
  'Appointments', 'Telecalling', 'Stock Transfer', 'Distribution Sales',
  'Visitors', 'Users', 'Staff', 'Cash Register', 'Inventory', 'Products',
];

const ALL_ACTIONS: { value: ActivityAction; label: string }[] = [
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'STATUS_CHANGE', label: 'Status Change' },
  { value: 'CANCEL', label: 'Cancel' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'RESCHEDULE', label: 'Reschedule' },
];

interface UserOption {
  uid: string;
  displayName: string;
  email: string;
}

export default function ActivityLogFilters({ filters, onChange, onReset, disabled }: Props) {
  const theme = useTheme();
  const primaryMain = theme.palette.primary.main;
  const [expanded, setExpanded] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Plain collection read + client sort — avoids Firestore ordered-query watches that can
  // hit INTERNAL ASSERTION FAILED (WatchChangeAggregator) with Strict Mode / concurrent reads.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), limit(500)));
        if (cancelled) return;
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              displayName: String(data.displayName || data.email || d.id || ''),
              email: String(data.email || ''),
            };
          })
          .sort((a, b) =>
            a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
          );
        setUsers(list);
      } catch {
        if (!cancelled) setUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeFilterCount = [
    filters.userId,
    filters.module,
    filters.action,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;

  const set = (key: keyof FilterState, value: FilterState[keyof FilterState]) =>
    onChange({ ...filters, [key]: value });

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2, overflow: 'hidden' }}
      >
        {/* Search bar + expand toggle */}
        <Stack
          direction="row"
          alignItems="center"
          gap={1.5}
          px={2}
          py={1.5}
          sx={{ borderBottom: expanded ? '1px solid' : 'none', borderColor: 'divider' }}
        >
          <TextField
            size="small"
            placeholder="Search by patient, user, description…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            disabled={disabled}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: filters.search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => set('search', '')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          <Tooltip title={expanded ? 'Hide filters' : 'More filters'}>
            <Button
              size="small"
              variant={activeFilterCount > 0 ? 'contained' : 'outlined'}
              startIcon={<FilterListIcon fontSize="small" />}
              endIcon={expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              onClick={() => setExpanded((v) => !v)}
              disabled={disabled}
              sx={{
                whiteSpace: 'nowrap',
                bgcolor: activeFilterCount > 0 ? alpha(primaryMain, 0.1) : undefined,
                color: activeFilterCount > 0 ? primaryMain : undefined,
                borderColor: activeFilterCount > 0 ? alpha(primaryMain, 0.4) : undefined,
                '&:hover': { bgcolor: alpha(primaryMain, 0.15) },
                fontWeight: 600,
              }}
            >
              Filters
              {activeFilterCount > 0 && (
                <Chip
                  label={activeFilterCount}
                  size="small"
                  sx={{
                    ml: 0.5,
                    height: 18,
                    minWidth: 18,
                    fontSize: 10,
                    fontWeight: 700,
                    bgcolor: primaryMain,
                    color: theme.palette.primary.contrastText,
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              )}
            </Button>
          </Tooltip>

          {activeFilterCount > 0 && (
            <Tooltip title="Clear all filters">
              <IconButton size="small" onClick={onReset} disabled={disabled}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* Expandable filter row */}
        <Collapse in={expanded}>
          <Box
            sx={{
              px: 2,
              py: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            {/* Module */}
            <FormControl size="small" disabled={disabled}>
              <InputLabel>Module</InputLabel>
              <Select
                value={filters.module}
                label="Module"
                onChange={(e) => set('module', e.target.value)}
              >
                <MenuItem value=""><em>All Modules</em></MenuItem>
                {ALL_MODULES.map((m) => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Action */}
            <FormControl size="small" disabled={disabled}>
              <InputLabel>Action</InputLabel>
              <Select
                value={filters.action}
                label="Action"
                onChange={(e) => set('action', e.target.value)}
              >
                <MenuItem value=""><em>All Actions</em></MenuItem>
                {ALL_ACTIONS.map((a) => (
                  <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* User */}
            <FormControl size="small" disabled={disabled}>
              <InputLabel>User</InputLabel>
              <Select
                value={filters.userId}
                label="User"
                onChange={(e) => set('userId', e.target.value)}
              >
                <MenuItem value=""><em>All Users</em></MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.uid} value={u.uid}>
                    {u.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Date From */}
            <DatePicker
              label="From Date"
              value={filters.dateFrom}
              onChange={(d) => set('dateFrom', d)}
              disabled={disabled}
              slotProps={{ textField: { size: 'small' } }}
            />

            {/* Date To */}
            <DatePicker
              label="To Date"
              value={filters.dateTo}
              onChange={(d) => set('dateTo', d)}
              disabled={disabled}
              slotProps={{ textField: { size: 'small' } }}
            />
          </Box>
        </Collapse>
      </Paper>
    </LocalizationProvider>
  );
}
