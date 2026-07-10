'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Divider,
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
} from '@mui/material';
import AsyncActionButton from '@/components/common/AsyncActionButton';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { format, parse, startOfMonth, isValid } from 'date-fns';
import {
  Home as RentIcon,
  ElectricalServices as UtilitiesIcon,
  Build as MaintenanceIcon,
  MoreHoriz as OtherIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as CircleIcon,
  Close as CloseIcon,
  Domain as DomainIcon,
} from '@mui/icons-material';

export interface Center {
  id: string;
  name: string;
  monthlyRent?: number;
  monthlyElectricity?: number;
  isHeadOffice?: boolean;
}

export interface CenterExpense {
  id?: string;
  centerId: string;
  month: string; // YYYY-MM

  // Rent & Lease
  rent: number;
  parking: number;

  // Utilities
  electricity: number;
  water: number;
  internet: number;

  // Maintenance
  maintenance: number;
  repairWork: number;
  housekeeping: number;

  // Other
  miscellaneous: number;

  // Computed
  totalExpenses: number;

  // Payment
  isPaid: boolean;
  paidDate?: Timestamp;
  remarks?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CenterExpenseHistorySummary {
  id: string;
  month: string;
  totalExpenses: number;
  isPaid: boolean;
}

interface CenterExpensesFormProps {
  center: Center;
  initialData?: CenterExpense;
  /** Explicitly selected month (YYYY-MM). Survives when no Firestore record exists. */
  selectedMonth: string;
  expenseHistory?: CenterExpenseHistorySummary[];
  onMonthChange?: (month: string) => Promise<void> | void;
  onSave: (data: CenterExpense) => Promise<void> | void;
  onCancel: () => void;
  isSaving?: boolean;
  loading?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Normalize to zero-padded YYYY-MM. */
export const normalizeExpenseMonth = (month: string | undefined | null, fallback?: string): string => {
  const fb = fallback || format(new Date(), 'yyyy-MM');
  if (!month) return fb;
  const match = String(month).trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return fb;
  return `${match[1]}-${match[2].padStart(2, '0')}`;
};

export const resolveTotalExpenses = (data: Partial<CenterExpense> | Record<string, unknown>): number => {
  const stored = num(data.totalExpenses, NaN);
  if (Number.isFinite(stored) && stored !== 0) return stored;

  const computed =
    num(data.rent) +
    num(data.parking) +
    num(data.electricity) +
    num(data.water) +
    num(data.internet) +
    num(data.maintenance) +
    num(data.repairWork) +
    num(data.housekeeping) +
    num(data.miscellaneous);

  if (computed !== 0) return computed;
  return Number.isFinite(stored) ? stored : 0;
};

const hasComponentValues = (data: Partial<CenterExpense>) =>
  num(data.rent) !== 0 ||
  num(data.parking) !== 0 ||
  num(data.electricity) !== 0 ||
  num(data.water) !== 0 ||
  num(data.internet) !== 0 ||
  num(data.maintenance) !== 0 ||
  num(data.repairWork) !== 0 ||
  num(data.housekeeping) !== 0 ||
  num(data.miscellaneous) !== 0;

const blankExpense = (center: Center, month: string): CenterExpense => {
  const rent = num(center.monthlyRent);
  const electricity = num(center.monthlyElectricity);
  return {
    centerId: center.id,
    month: normalizeExpenseMonth(month),
    rent,
    parking: 0,
    electricity,
    water: 0,
    internet: 0,
    maintenance: 0,
    repairWork: 0,
    housekeeping: 0,
    miscellaneous: 0,
    totalExpenses: rent + electricity,
    isPaid: false,
    remarks: '',
  };
};

const hydrateExpense = (
  data: CenterExpense | undefined,
  center: Center,
  selectedMonth: string
): CenterExpense => {
  const month = normalizeExpenseMonth(data?.month || selectedMonth);

  if (!data) {
    return blankExpense(center, month);
  }

  // Legacy records may only store totalExpenses without component breakdown.
  let rent = num(data.rent, NaN);
  let electricity = num(data.electricity, NaN);
  const parking = num(data.parking);
  const water = num(data.water);
  const internet = num(data.internet);
  const maintenance = num(data.maintenance);
  const repairWork = num(data.repairWork);
  const housekeeping = num(data.housekeeping);
  const miscellaneous = num(data.miscellaneous);

  if (!hasComponentValues(data)) {
    const fallbackTotal = resolveTotalExpenses(data);
    if (fallbackTotal !== 0) {
      rent = fallbackTotal;
      electricity = 0;
    } else {
      rent = num(center.monthlyRent);
      electricity = num(center.monthlyElectricity);
    }
  } else {
    if (!Number.isFinite(rent)) rent = num(center.monthlyRent);
    if (!Number.isFinite(electricity)) electricity = num(center.monthlyElectricity);
  }

  const totalExpenses =
    rent +
    parking +
    electricity +
    water +
    internet +
    maintenance +
    repairWork +
    housekeeping +
    miscellaneous;

  return {
    id: data.id,
    centerId: center.id,
    month,
    rent,
    parking,
    electricity,
    water,
    internet,
    maintenance,
    repairWork,
    housekeeping,
    miscellaneous,
    totalExpenses,
    isPaid: !!data.isPaid,
    paidDate: data.paidDate,
    remarks: data.remarks ?? '',
  };
};

const parseMonthDate = (month: string): Date => {
  const normalized = normalizeExpenseMonth(month);
  const d = parse(normalized, 'yyyy-MM', new Date());
  return isValid(d) ? startOfMonth(d) : startOfMonth(new Date());
};

const NUMERIC_FIELDS: (keyof CenterExpense)[] = [
  'rent',
  'parking',
  'electricity',
  'water',
  'internet',
  'maintenance',
  'repairWork',
  'housekeeping',
  'miscellaneous',
];

const ExpenseField = React.memo(function ExpenseField({
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

export default function CenterExpensesForm({
  center,
  initialData,
  selectedMonth,
  expenseHistory = [],
  onMonthChange,
  onSave,
  onCancel,
  isSaving = false,
  loading = false,
}: CenterExpensesFormProps) {
  const [formData, setFormData] = useState<CenterExpense>(() =>
    hydrateExpense(initialData, center, selectedMonth)
  );
  const [monthDate, setMonthDate] = useState<Date | null>(() => parseMonthDate(selectedMonth));
  const [paymentDate, setPaymentDate] = useState<Date | null>(
    formData.paidDate ? new Date(formData.paidDate.seconds * 1000) : null
  );

  useEffect(() => {
    const next = hydrateExpense(initialData, center, selectedMonth);
    setFormData(next);
    setMonthDate(parseMonthDate(selectedMonth));
    setPaymentDate(next.paidDate ? new Date(next.paidDate.seconds * 1000) : null);
  }, [initialData, selectedMonth, center.id, center.monthlyRent, center.monthlyElectricity]);

  useEffect(() => {
    const total =
      formData.rent +
      formData.parking +
      formData.electricity +
      formData.water +
      formData.internet +
      formData.maintenance +
      formData.repairWork +
      formData.housekeeping +
      formData.miscellaneous;
    setFormData((p) => (p.totalExpenses === total ? p : { ...p, totalExpenses: total }));
  }, [
    formData.rent,
    formData.parking,
    formData.electricity,
    formData.water,
    formData.internet,
    formData.maintenance,
    formData.repairWork,
    formData.housekeeping,
    formData.miscellaneous,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({
      ...p,
      [name]: NUMERIC_FIELDS.includes(name as keyof CenterExpense) ? parseFloat(value) || 0 : value,
    }));
  };

  const handleMonthPickerChange = (date: Date | null) => {
    if (!date || !isValid(date)) return;
    setMonthDate(startOfMonth(date));
  };

  const handleMonthAccept = (date: Date | null) => {
    if (!date || !isValid(date)) return;
    const m = normalizeExpenseMonth(format(startOfMonth(date), 'yyyy-MM'));
    setMonthDate(startOfMonth(date));
    setFormData((p) => ({ ...p, month: m }));
    if (m !== selectedMonth) {
      void onMonthChange?.(m);
    }
  };

  const selectHistoryMonth = (month: string) => {
    const m = normalizeExpenseMonth(month);
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
    onSave({ ...formData, month: normalizeExpenseMonth(formData.month || selectedMonth) });
  };

  const isNew = !initialData?.id;
  const displayMonth = useMemo(() => {
    try {
      return format(parseMonthDate(formData.month || selectedMonth), 'MMMM yyyy');
    } catch {
      return formData.month || selectedMonth;
    }
  }, [formData.month, selectedMonth]);

  const rentTotal = formData.rent + formData.parking;
  const utilitiesTotal = formData.electricity + formData.water + formData.internet;
  const maintenanceTotal = formData.maintenance + formData.repairWork + formData.housekeeping;

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
        <Avatar sx={{ bgcolor: 'primary.main', width: 42, height: 42 }}>
          <DomainIcon />
        </Avatar>

        <Box flex={1} minWidth={0}>
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ lineHeight: 1.3 }}>
            {center.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Rent &amp; Maintenance
          </Typography>
        </Box>

        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Expense month"
            value={monthDate}
            onChange={handleMonthPickerChange}
            onAccept={handleMonthAccept}
            onClose={() => setMonthDate(parseMonthDate(formData.month || selectedMonth))}
            views={['year', 'month']}
            openTo="month"
            disabled={loading || isSaving}
            slotProps={{
              textField: { size: 'small', sx: { width: 180 } },
              actionBar: { actions: ['accept', 'cancel'] },
            }}
          />
        </LocalizationProvider>

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
            {expenseHistory.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography variant="caption" color="text.disabled">
                  No saved expenses yet. Pick a month and save.
                </Typography>
              </Box>
            ) : (
              expenseHistory.map((row) => {
                const active = normalizeExpenseMonth(row.month) === normalizeExpenseMonth(formData.month);
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
                      {fmt(row.totalExpenses)}
                      {row.isPaid ? ' · Paid' : ' · Pending'}
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
                  {isNew ? 'New month — fill amounts and save' : 'Editing saved expense record'}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={formData.isPaid ? 'Paid' : 'Pending'}
                color={formData.isPaid ? 'success' : 'default'}
                variant={formData.isPaid ? 'filled' : 'outlined'}
                icon={formData.isPaid ? <CheckIcon sx={{ fontSize: '13px !important' }} /> : undefined}
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <RentIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  Rent &amp; Lease
                </Typography>
                <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ ml: 'auto' }}>
                  {fmt(rentTotal)}
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.75 }}>
                <ExpenseField label="Monthly Rent" name="rent" value={formData.rent} onChange={handleChange} />
                <ExpenseField label="Parking / Garage" name="parking" value={formData.parking} onChange={handleChange} />
              </Box>
            </Box>

            <Divider />

            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <UtilitiesIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  Utilities
                </Typography>
                <Typography variant="body2" fontWeight={700} color="warning.main" sx={{ ml: 'auto' }}>
                  {fmt(utilitiesTotal)}
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.75 }}>
                <ExpenseField label="Electricity" name="electricity" value={formData.electricity} onChange={handleChange} />
                <ExpenseField label="Water / Drainage" name="water" value={formData.water} onChange={handleChange} />
                <ExpenseField label="Internet / Broadband" name="internet" value={formData.internet} onChange={handleChange} />
              </Box>
            </Box>

            <Divider />

            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <MaintenanceIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  Maintenance &amp; Repairs
                </Typography>
                <Typography variant="body2" fontWeight={700} color="secondary.main" sx={{ ml: 'auto' }}>
                  {fmt(maintenanceTotal)}
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 1.75 }}>
                <ExpenseField label="General Maintenance" name="maintenance" value={formData.maintenance} onChange={handleChange} />
                <ExpenseField label="Repairs / Renovation" name="repairWork" value={formData.repairWork} onChange={handleChange} />
                <ExpenseField label="Housekeeping / Cleaning" name="housekeeping" value={formData.housekeeping} onChange={handleChange} />
              </Box>
            </Box>

            <Divider />

            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                <OtherIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  Miscellaneous
                </Typography>
                <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ ml: 'auto' }}>
                  {fmt(formData.miscellaneous)}
                </Typography>
              </Box>
              <Box sx={{ maxWidth: 320 }}>
                <ExpenseField
                  label="Other Expenses"
                  name="miscellaneous"
                  value={formData.miscellaneous}
                  onChange={handleChange}
                />
              </Box>
            </Box>

            <Divider />

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
                        slotProps={{ textField: { size: 'small', fullWidth: true } }}
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
            Total · {displayMonth}
          </Typography>
          <Typography variant="h6" fontWeight={800} color="primary.main" sx={{ lineHeight: 1.2 }}>
            {fmt(formData.totalExpenses)}
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
          sx={{ minWidth: 150, fontWeight: 700, borderRadius: 2 }}
        >
          {isNew ? 'Save Expenses' : 'Update Expenses'}
        </AsyncActionButton>
      </Box>
    </Box>
  );
}
