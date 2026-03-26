'use client';

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import type { PaymentStatus } from '@/lib/sales-invoicing/types';

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
];

interface SalesInvoiceFiltersPanelProps {
  open: boolean;
  onClose: () => void;
  dateFrom: Date | null;
  dateTo: Date | null;
  onDateFrom: (d: Date | null) => void;
  onDateTo: (d: Date | null) => void;
  paymentStatuses: PaymentStatus[];
  onPaymentStatuses: (v: PaymentStatus[]) => void;
  source: 'all' | 'manual' | 'enquiry';
  onSource: (v: 'all' | 'manual' | 'enquiry') => void;
  onClear: () => void;
}

export default function SalesInvoiceFiltersPanel({
  open,
  onClose,
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  paymentStatuses,
  onPaymentStatuses,
  source,
  onSource,
  onClear,
}: SalesInvoiceFiltersPanelProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 380 }, borderRadius: '12px 0 0 12px' } }}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Filters
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Narrow invoices by date, payment, and source.
        </Typography>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Stack spacing={2.5}>
            <DatePicker label="From date" value={dateFrom} onChange={onDateFrom} slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
            <DatePicker label="To date" value={dateTo} onChange={onDateTo} slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
          </Stack>
        </LocalizationProvider>

        <Divider sx={{ my: 3 }} />

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Payment status</InputLabel>
          <Select
            multiple
            value={paymentStatuses}
            onChange={(e) => onPaymentStatuses(e.target.value as PaymentStatus[])}
            input={<OutlinedInput label="Payment status" />}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected as PaymentStatus[]).map((v) => (
                  <Chip key={v} size="small" label={PAYMENT_OPTIONS.find((o) => o.value === v)?.label || v} />
                ))}
              </Box>
            )}
          >
            {PAYMENT_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <InputLabel>Source</InputLabel>
          <Select value={source} label="Source" onChange={(e) => onSource(e.target.value as 'all' | 'manual' | 'enquiry')}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="enquiry">Enquiry</MenuItem>
            <MenuItem value="manual">Manual</MenuItem>
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1}>
          <Button fullWidth variant="outlined" onClick={onClear} sx={{ borderRadius: 2 }}>
            Clear all
          </Button>
          <Button fullWidth variant="contained" onClick={onClose} sx={{ borderRadius: 2 }}>
            Done
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
