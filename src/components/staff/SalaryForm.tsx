'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Chip,
  Avatar,
  Stack,
  alpha,
  LinearProgress,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import AsyncActionButton from '@/components/common/AsyncActionButton';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { format, parse, startOfMonth, isValid } from 'date-fns';
import {
  TrendingUp as EarningsIcon,
  TrendingDown as DeductionsIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as CircleIcon,
  Close as CloseIcon,
  Print as PrintIcon,
} from '@mui/icons-material';

interface Staff {
  id?: string;
  name: string;
  email: string;
  phone: string;
  joiningDate: Timestamp;
  jobRole: string;
  basicSalary: number;
  status: 'active' | 'inactive';
}

interface Salary {
  id?: string;
  staffId: string;
  month: string;
  basicSalary: number;
  hra: number;
  travelAllowance: number;
  festivalAdvance: number;
  generalAdvance: number;
  deductions: number;
  incentives: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  isPaid: boolean;
  paidDate?: Timestamp;
  remarks?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface SalaryFormProps {
  staff: Staff;
  initialData?: Salary;
  /** Explicitly selected month (YYYY-MM). Survives when no Firestore record exists. */
  selectedMonth: string;
  salaryHistory?: Array<{
    id: string;
    month: string;
    netSalary: number;
    isPaid: boolean;
  }>;
  onMonthChange?: (month: string) => Promise<void> | void;
  onSave: (data: Salary) => Promise<void> | void;
  onCancel: () => void;
  isSaving?: boolean;
  loading?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Normalize to zero-padded YYYY-MM. */
export const normalizeMonth = (month: string | undefined | null, fallback?: string): string => {
  const fb = fallback || format(new Date(), 'yyyy-MM');
  if (!month) return fb;
  const match = String(month).trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return fb;
  return `${match[1]}-${match[2].padStart(2, '0')}`;
};

export const resolveNetSalary = (data: Partial<Salary> | Record<string, unknown>): number => {
  const stored = num(data.netSalary, NaN);
  if (Number.isFinite(stored) && stored !== 0) return stored;

  const earnings = num(data.totalEarnings);
  const deductions = num(data.totalDeductions);
  if (earnings !== 0 || deductions !== 0) return earnings - deductions;

  const computedEarnings =
    num(data.basicSalary) + num(data.hra) + num(data.incentives) + num(data.travelAllowance);
  const computedDeductions =
    num(data.festivalAdvance) + num(data.generalAdvance) + num(data.deductions);
  const computed = computedEarnings - computedDeductions;
  if (computed !== 0) return computed;

  return Number.isFinite(stored) ? stored : 0;
};

const hasComponentValues = (data: Partial<Salary>) =>
  num(data.basicSalary) !== 0 ||
  num(data.hra) !== 0 ||
  num(data.travelAllowance) !== 0 ||
  num(data.incentives) !== 0 ||
  num(data.festivalAdvance) !== 0 ||
  num(data.generalAdvance) !== 0 ||
  num(data.deductions) !== 0;

const blankSalary = (staff: Staff, month: string): Salary => {
  const basic = num(staff.basicSalary);
  return {
    staffId: staff.id || '',
    month: normalizeMonth(month),
    basicSalary: basic,
    hra: 0,
    travelAllowance: 0,
    festivalAdvance: 0,
    generalAdvance: 0,
    deductions: 0,
    incentives: 0,
    totalEarnings: basic,
    totalDeductions: 0,
    netSalary: basic,
    isPaid: false,
    remarks: '',
  };
};

const hydrate = (initialData: Salary | undefined, staff: Staff, selectedMonth: string): Salary => {
  const month = normalizeMonth(initialData?.month || selectedMonth);

  if (!initialData) {
    return blankSalary(staff, month);
  }

  // Legacy records sometimes only stored net/total without component breakdown.
  // Seed basic salary from stored net so the form and recalc don't show ₹0.
  let basicSalary = num(initialData.basicSalary, NaN);
  if (!Number.isFinite(basicSalary) || (basicSalary === 0 && !hasComponentValues(initialData))) {
    const fallbackNet = resolveNetSalary(initialData);
    basicSalary = fallbackNet !== 0 ? fallbackNet : num(staff.basicSalary);
  }

  const hra = num(initialData.hra);
  const travelAllowance = num(initialData.travelAllowance);
  const incentives = num(initialData.incentives);
  const festivalAdvance = num(initialData.festivalAdvance);
  const generalAdvance = num(initialData.generalAdvance);
  const deductions = num(initialData.deductions);

  const totalEarnings = basicSalary + hra + incentives + travelAllowance;
  const totalDeductions = festivalAdvance + generalAdvance + deductions;

  return {
    id: initialData.id,
    staffId: staff.id || '',
    month,
    basicSalary,
    hra,
    travelAllowance,
    festivalAdvance,
    generalAdvance,
    deductions,
    incentives,
    totalEarnings,
    totalDeductions,
    netSalary: totalEarnings - totalDeductions,
    isPaid: !!initialData.isPaid,
    paidDate: initialData.paidDate,
    remarks: initialData.remarks ?? '',
  };
};

const parseMonthDate = (month: string): Date => {
  const normalized = normalizeMonth(month);
  const d = parse(normalized, 'yyyy-MM', new Date());
  return isValid(d) ? startOfMonth(d) : startOfMonth(new Date());
};

const NUMERIC_FIELDS = [
  'basicSalary',
  'hra',
  'travelAllowance',
  'festivalAdvance',
  'generalAdvance',
  'deductions',
  'incentives',
];

const AmountField = React.memo(function AmountField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}) {
  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      name={name}
      type="number"
      value={value}
      onChange={onChange}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              ₹
            </Typography>
          </InputAdornment>
        ),
      }}
      inputProps={{ min: 0, step: 100 }}
      sx={{
        '& .MuiOutlinedInput-root': {
          bgcolor: 'background.paper',
          borderRadius: 1.5,
        },
      }}
    />
  );
});

export default function SalaryForm({
  staff,
  initialData,
  selectedMonth,
  salaryHistory = [],
  onMonthChange,
  onSave,
  onCancel,
  isSaving = false,
  loading = false,
}: SalaryFormProps) {
  const [formData, setFormData] = useState<Salary>(() => hydrate(initialData, staff, selectedMonth));
  const [monthDate, setMonthDate] = useState<Date | null>(() => parseMonthDate(selectedMonth));
  const [paymentDate, setPaymentDate] = useState<Date | null>(
    formData.paidDate ? new Date(formData.paidDate.seconds * 1000) : null
  );

  // Keep form in sync when parent loads a different month/record.
  // selectedMonth is the source of truth for which month is active.
  useEffect(() => {
    const next = hydrate(initialData, staff, selectedMonth);
    setFormData(next);
    setMonthDate(parseMonthDate(selectedMonth));
    setPaymentDate(next.paidDate ? new Date(next.paidDate.seconds * 1000) : null);
  }, [initialData, selectedMonth, staff.id, staff.basicSalary]);

  // Live totals from component fields
  useEffect(() => {
    const totalEarnings =
      formData.basicSalary + formData.hra + formData.incentives + formData.travelAllowance;
    const totalDeductions =
      formData.festivalAdvance + formData.generalAdvance + formData.deductions;
    const netSalary = totalEarnings - totalDeductions;
    setFormData((p) => {
      if (
        p.totalEarnings === totalEarnings &&
        p.totalDeductions === totalDeductions &&
        p.netSalary === netSalary
      ) {
        return p;
      }
      return { ...p, totalEarnings, totalDeductions, netSalary };
    });
  }, [
    formData.basicSalary,
    formData.hra,
    formData.festivalAdvance,
    formData.generalAdvance,
    formData.deductions,
    formData.incentives,
    formData.travelAllowance,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({
      ...p,
      [name]: NUMERIC_FIELDS.includes(name) ? parseFloat(value) || 0 : value,
    }));
  };

  /** Local preview while picking year/month — do not fetch yet. */
  const handleMonthPickerChange = (date: Date | null) => {
    if (!date || !isValid(date)) return;
    setMonthDate(startOfMonth(date));
  };

  /** Commit month only when the picker selection is accepted (avoids mid-pick resets). */
  const handleMonthAccept = (date: Date | null) => {
    if (!date || !isValid(date)) return;
    const m = normalizeMonth(format(startOfMonth(date), 'yyyy-MM'));
    setMonthDate(startOfMonth(date));
    setFormData((p) => ({ ...p, month: m }));
    if (m !== selectedMonth) {
      void onMonthChange?.(m);
    }
  };

  const selectHistoryMonth = (month: string) => {
    const m = normalizeMonth(month);
    setMonthDate(parseMonthDate(m));
    setFormData((p) => ({ ...p, month: m }));
    if (m !== selectedMonth) {
      void onMonthChange?.(m);
    }
  };

  const handlePaymentDateChange = (date: Date | null) => {
    setPaymentDate(date);
    setFormData((p) => ({
      ...p,
      isPaid: !!date,
      paidDate: date ? Timestamp.fromDate(date) : undefined,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, month: normalizeMonth(formData.month || selectedMonth) });
  };

  const isNew = !initialData?.id;
  const displayMonth = useMemo(() => {
    try {
      return format(parseMonthDate(formData.month || selectedMonth), 'MMMM yyyy');
    } catch {
      return formData.month || selectedMonth;
    }
  }, [formData.month, selectedMonth]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'primary.main',
            width: 42,
            height: 42,
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {initials(staff.name)}
        </Avatar>

        <Box flex={1} minWidth={0}>
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ lineHeight: 1.3 }}>
            {staff.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {staff.jobRole} · Salary
          </Typography>
        </Box>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Salary month"
            value={monthDate}
            onChange={handleMonthPickerChange}
            onAccept={handleMonthAccept}
            onClose={() => setMonthDate(parseMonthDate(formData.month || selectedMonth))}
            views={['year', 'month']}
            openTo="month"
            disabled={loading || isSaving}
            slotProps={{
              textField: {
                size: 'small',
                sx: { width: 180 },
              },
              actionBar: { actions: ['accept', 'cancel'] },
            }}
          />
        </LocalizationProvider>

        <Tooltip title="Open salary slip" arrow>
          <IconButton
            size="small"
            onClick={() =>
              window.open(`/staff/salary-slip/${staff.id}?month=${formData.month}`, '_blank')
            }
          >
            <PrintIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Close" arrow>
          <IconButton size="small" onClick={onCancel}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ height: 3, flexShrink: 0 }}>{loading && <LinearProgress />}</Box>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* History */}
        <Box
          sx={{
            width: 200,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: (t) => alpha(t.palette.grey[500], 0.04),
          }}
        >
          <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}
            >
              Past months
            </Typography>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {salaryHistory.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography variant="caption" color="text.disabled">
                  No saved salaries yet. Pick a month and save.
                </Typography>
              </Box>
            ) : (
              salaryHistory.map((row) => {
                const active = normalizeMonth(row.month) === normalizeMonth(formData.month);
                return (
                  <Box
                    key={row.id}
                    onClick={() => {
                      if (loading || isSaving) return;
                      selectHistoryMonth(row.month);
                    }}
                    sx={{
                      px: 2,
                      py: 1.25,
                      cursor: loading || isSaving ? 'default' : 'pointer',
                      borderLeft: '3px solid',
                      borderLeftColor: active ? 'primary.main' : 'transparent',
                      bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.06) : 'transparent',
                      opacity: loading ? 0.7 : 1,
                      '&:hover': {
                        bgcolor: (t) =>
                          loading || isSaving
                            ? undefined
                            : alpha(t.palette.primary.main, active ? 0.06 : 0.03),
                      },
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography
                        variant="body2"
                        fontWeight={active ? 700 : 500}
                        color={active ? 'primary.main' : 'text.primary'}
                        sx={{ fontSize: 13 }}
                      >
                        {format(parseMonthDate(row.month), 'MMM yyyy')}
                      </Typography>
                      {row.isPaid ? (
                        <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      ) : (
                        <CircleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {fmt(row.netSalary)}
                      {row.isPaid ? ' · Paid' : ' · Unpaid'}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        {/* Form */}
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 3,
            opacity: loading ? 0.55 : 1,
            pointerEvents: loading ? 'none' : 'auto',
            transition: 'opacity 0.15s ease',
          }}
        >
          <Stack spacing={2.5}>
            <Box display="flex" alignItems="center" justifyContent="space-between" gap={2}>
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.3px' }}>
                  {displayMonth}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {isNew ? 'New month — fill amounts and save' : 'Editing saved salary record'}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={formData.isPaid ? 'Paid' : 'Unpaid'}
                color={formData.isPaid ? 'success' : 'default'}
                variant={formData.isPaid ? 'filled' : 'outlined'}
                icon={formData.isPaid ? <CheckIcon sx={{ fontSize: '13px !important' }} /> : undefined}
                sx={{ fontWeight: 600 }}
              />
            </Box>

            {/* Earnings */}
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <EarningsIcon sx={{ fontSize: 18, color: 'success.main' }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  Earnings
                </Typography>
                <Typography variant="body2" fontWeight={700} color="success.main" sx={{ ml: 'auto' }}>
                  {fmt(formData.totalEarnings)}
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.75 }}>
                <AmountField
                  label="Basic Salary"
                  name="basicSalary"
                  value={formData.basicSalary}
                  onChange={handleChange}
                />
                <AmountField label="HRA" name="hra" value={formData.hra} onChange={handleChange} />
                <AmountField
                  label="Travel Allowance"
                  name="travelAllowance"
                  value={formData.travelAllowance}
                  onChange={handleChange}
                />
                <AmountField
                  label="Incentives / Bonus"
                  name="incentives"
                  value={formData.incentives}
                  onChange={handleChange}
                />
              </Box>
            </Box>

            <Divider />

            {/* Deductions */}
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <DeductionsIcon sx={{ fontSize: 18, color: 'error.main' }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  Deductions
                </Typography>
                <Typography variant="body2" fontWeight={700} color="error.main" sx={{ ml: 'auto' }}>
                  {fmt(formData.totalDeductions)}
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.75 }}>
                <AmountField
                  label="Festival Advance"
                  name="festivalAdvance"
                  value={formData.festivalAdvance}
                  onChange={handleChange}
                />
                <AmountField
                  label="General Advance"
                  name="generalAdvance"
                  value={formData.generalAdvance}
                  onChange={handleChange}
                />
                <AmountField
                  label="Other Deductions"
                  name="deductions"
                  value={formData.deductions}
                  onChange={handleChange}
                />
              </Box>
            </Box>

            <Divider />

            {/* Payment + remarks in one compact block */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2.5,
                alignItems: 'start',
              }}
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>
                  Payment
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isPaid}
                      onChange={(e) => {
                        const isPaid = e.target.checked;
                        const today = new Date();
                        setFormData((p) => ({
                          ...p,
                          isPaid,
                          paidDate: isPaid
                            ? paymentDate
                              ? Timestamp.fromDate(paymentDate)
                              : Timestamp.fromDate(today)
                            : undefined,
                        }));
                        if (isPaid && !paymentDate) setPaymentDate(today);
                        if (!isPaid) setPaymentDate(null);
                      }}
                      color="success"
                    />
                  }
                  label={
                    <Typography variant="body2" color={formData.isPaid ? 'success.main' : 'text.secondary'}>
                      {formData.isPaid ? 'Marked as paid' : 'Mark as paid'}
                    </Typography>
                  }
                />
                {formData.isPaid && (
                  <Box sx={{ mt: 1.5, maxWidth: 260 }}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        label="Payment date"
                        value={paymentDate}
                        onChange={handlePaymentDateChange}
                        slotProps={{
                          textField: { size: 'small', fullWidth: true },
                        }}
                      />
                    </LocalizationProvider>
                  </Box>
                )}
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>
                  Remarks
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="Optional notes…"
                  size="small"
                />
              </Box>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Net pay · {displayMonth}
          </Typography>
          <Typography variant="h6" fontWeight={800} color="primary.main" sx={{ lineHeight: 1.2 }}>
            {fmt(formData.netSalary)}
          </Typography>
        </Box>

        <Button variant="text" onClick={onCancel} disabled={isSaving} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <AsyncActionButton
          variant="contained"
          color="primary"
          type="submit"
          loading={isSaving}
          loadingText={isNew ? 'Saving…' : 'Updating…'}
          sx={{ minWidth: 130, fontWeight: 700, borderRadius: 2 }}
        >
          {isNew ? 'Save Salary' : 'Update Salary'}
        </AsyncActionButton>
      </Box>
    </Box>
  );
}
