'use client';

import React, { useState, useEffect } from 'react';
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
  Skeleton,
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
import { format, parse, startOfMonth } from 'date-fns';
import {
  Home as RentIcon,
  ElectricalServices as UtilitiesIcon,
  Build as MaintenanceIcon,
  MoreHoriz as OtherIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as CircleIcon,
  Close as CloseIcon,
  EventNote as NoteIcon,
  CreditCard as PaymentIcon,
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

const centerInitials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

const BLANK_EXPENSE = (center: Center, month?: string): CenterExpense => ({
  centerId: center.id,
  month: month || format(new Date(), 'yyyy-MM'),
  rent: center.monthlyRent || 0,
  parking: 0,
  electricity: center.monthlyElectricity || 0,
  water: 0,
  internet: 0,
  maintenance: 0,
  repairWork: 0,
  housekeeping: 0,
  miscellaneous: 0,
  totalExpenses: 0,
  isPaid: false,
  remarks: '',
});

const hydrateExpense = (data: CenterExpense | undefined, center: Center): CenterExpense => ({
  id: data?.id,
  centerId: center.id,
  month: data?.month || format(new Date(), 'yyyy-MM'),
  rent: data?.rent ?? center.monthlyRent ?? 0,
  parking: data?.parking ?? 0,
  electricity: data?.electricity ?? center.monthlyElectricity ?? 0,
  water: data?.water ?? 0,
  internet: data?.internet ?? 0,
  maintenance: data?.maintenance ?? 0,
  repairWork: data?.repairWork ?? 0,
  housekeeping: data?.housekeeping ?? 0,
  miscellaneous: data?.miscellaneous ?? 0,
  totalExpenses: data?.totalExpenses ?? 0,
  isPaid: data?.isPaid ?? false,
  paidDate: data?.paidDate,
  remarks: data?.remarks ?? '',
});

const NUMERIC_FIELDS: (keyof CenterExpense)[] = [
  'rent', 'parking', 'electricity', 'water', 'internet',
  'maintenance', 'repairWork', 'housekeeping', 'miscellaneous',
];

// Defined OUTSIDE the component so its identity is stable across renders.
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
  expenseHistory = [],
  onMonthChange,
  onSave,
  onCancel,
  isSaving = false,
  loading = false,
}: CenterExpensesFormProps) {
  const [formData, setFormData] = useState<CenterExpense>(() => hydrateExpense(initialData, center));
  const [monthDate, setMonthDate] = useState<Date | null>(() =>
    parse(formData.month, 'yyyy-MM', new Date())
  );
  const [paymentDate, setPaymentDate] = useState<Date | null>(
    formData.paidDate ? new Date(formData.paidDate.seconds * 1000) : null
  );

  // Sync form when initialData changes (month switch)
  useEffect(() => {
    const next = hydrateExpense(initialData, center);
    setFormData(next);
    setMonthDate(parse(next.month, 'yyyy-MM', new Date()));
    setPaymentDate(next.paidDate ? new Date(next.paidDate.seconds * 1000) : null);
  }, [initialData, center.id]);

  // Recalculate total whenever any amount changes
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
    setFormData((p) => ({ ...p, totalExpenses: total }));
  }, [
    formData.rent, formData.parking,
    formData.electricity, formData.water, formData.internet,
    formData.maintenance, formData.repairWork, formData.housekeeping,
    formData.miscellaneous,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({
      ...p,
      [name]: NUMERIC_FIELDS.includes(name as keyof CenterExpense)
        ? parseFloat(value) || 0
        : value,
    }));
  };

  const handleMonthChange = (date: Date | null) => {
    if (!date) return;
    setMonthDate(date);
    const m = format(startOfMonth(date), 'yyyy-MM');
    setFormData((p) => ({ ...p, month: m }));
    void onMonthChange?.(m);
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
    onSave(formData);
  };

  const isNew = !initialData?.id;
  const displayMonth = format(parse(formData.month, 'yyyy-MM', new Date()), 'MMMM yyyy');
  const lastUpdated = initialData?.updatedAt
    ? format(new Date(initialData.updatedAt.seconds * 1000), 'dd MMM yyyy, hh:mm a')
    : null;

  // Computed section totals for summary strip
  const rentTotal = formData.rent + formData.parking;
  const utilitiesTotal = formData.electricity + formData.water + formData.internet;
  const maintenanceTotal = formData.maintenance + formData.repairWork + formData.housekeeping;

  const SectionHeader = ({
    icon,
    title,
    color,
    sectionTotal,
  }: {
    icon: React.ReactNode;
    title: string;
    color: 'primary' | 'warning' | 'secondary' | 'default';
    sectionTotal: number;
  }) => {
    const colorMap = {
      primary: { bg: 'primary.main', light: (t: any) => alpha(t.palette.primary.main, 0.07), border: (t: any) => alpha(t.palette.primary.main, 0.25), iconBg: (t: any) => alpha(t.palette.primary.main, 0.15), textColor: 'primary.dark' },
      warning: { bg: 'warning.main', light: (t: any) => alpha(t.palette.warning.main, 0.07), border: (t: any) => alpha(t.palette.warning.main, 0.25), iconBg: (t: any) => alpha(t.palette.warning.main, 0.15), textColor: 'warning.dark' },
      secondary: { bg: 'secondary.main', light: (t: any) => alpha(t.palette.secondary.main, 0.07), border: (t: any) => alpha(t.palette.secondary.main, 0.25), iconBg: (t: any) => alpha(t.palette.secondary.main, 0.15), textColor: 'secondary.dark' },
      default: { bg: 'grey.600', light: (t: any) => alpha(t.palette.grey[600], 0.07), border: (t: any) => alpha(t.palette.grey[600], 0.2), iconBg: (t: any) => alpha(t.palette.grey[600], 0.12), textColor: 'text.secondary' },
    };
    const c = colorMap[color];
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 2.5,
          py: 1.5,
          bgcolor: c.light,
          borderBottom: '1px solid',
          borderBottomColor: c.border,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 1.5, bgcolor: c.iconBg }}>
          {icon}
        </Box>
        <Typography variant="subtitle2" fontWeight={700} color={c.textColor} flex={1}>
          {title}
        </Typography>
        <Typography variant="body2" fontWeight={700} color={c.textColor}>
          {fmt(sectionTotal)}
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
    >
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <Box
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 60%, ${alpha(theme.palette.primary.light, 0.9)} 100%)`,
          color: 'white',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: -40,
            top: -40,
            width: 160,
            height: 160,
            borderRadius: '50%',
            bgcolor: alpha('#fff', 0.05),
            pointerEvents: 'none',
          },
        }}
      >
        <Avatar
          sx={{
            bgcolor: alpha('#fff', 0.18),
            color: 'white',
            width: 46,
            height: 46,
            fontWeight: 700,
            fontSize: 17,
            border: `2px solid ${alpha('#fff', 0.3)}`,
          }}
        >
          <DomainIcon />
        </Avatar>

        <Box flex={1} minWidth={0}>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.25, letterSpacing: '-0.3px' }}>
            {center.name}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75, display: 'block' }}>
            Rent &amp; Maintenance Tracker
          </Typography>
        </Box>

        {/* Month Picker */}
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            value={monthDate}
            onChange={handleMonthChange}
            views={['month', 'year']}
            slotProps={{
              textField: {
                size: 'small',
                sx: {
                  width: 175,
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    fontWeight: 600,
                    '& fieldset': { borderColor: alpha('#fff', 0.35) },
                    '&:hover fieldset': { borderColor: alpha('#fff', 0.7) },
                    '&.Mui-focused fieldset': { borderColor: 'white' },
                  },
                  '& .MuiInputLabel-root': { color: alpha('#fff', 0.7) },
                  '& .MuiInputLabel-root.Mui-focused': { color: 'white' },
                  '& .MuiSvgIcon-root': { color: alpha('#fff', 0.75) },
                },
              },
            }}
          />
        </LocalizationProvider>

        <Tooltip title="Close" arrow>
          <IconButton
            size="small"
            onClick={onCancel}
            sx={{ color: alpha('#fff', 0.75), '&:hover': { color: 'white', bgcolor: alpha('#fff', 0.12) } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Loading bar */}
      <Box sx={{ height: 3, flexShrink: 0 }}>
        {loading && <LinearProgress />}
      </Box>

      {/* ── BODY ────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* LEFT SIDEBAR: Month History */}
        <Box
          sx={{
            width: 220,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: (t) => alpha(t.palette.grey[50], 0.7),
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
            >
              History
            </Typography>
            {expenseHistory.length > 0 && (
              <Chip
                label={expenseHistory.length}
                size="small"
                sx={{ height: 16, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
              />
            )}
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {expenseHistory.length === 0 ? (
              <Box sx={{ p: 2.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.disabled" display="block">
                  No records yet.
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Pick a month above to start.
                </Typography>
              </Box>
            ) : (
              expenseHistory.map((row) => {
                const active = row.month === formData.month;
                return (
                  <Box
                    key={row.id}
                    onClick={() => {
                      setMonthDate(parse(row.month, 'yyyy-MM', new Date()));
                      setFormData((p) => ({ ...p, month: row.month }));
                      void onMonthChange?.(row.month);
                    }}
                    sx={{
                      px: 2,
                      py: 1.5,
                      cursor: 'pointer',
                      borderLeft: '3px solid',
                      borderLeftColor: active ? 'primary.main' : 'transparent',
                      bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.07) : 'transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: (t) => alpha(t.palette.primary.main, active ? 0.07 : 0.04),
                      },
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.25}>
                      <Typography
                        variant="body2"
                        fontWeight={active ? 700 : 400}
                        color={active ? 'primary.main' : 'text.primary'}
                        sx={{ fontSize: 13 }}
                      >
                        {format(parse(row.month, 'yyyy-MM', new Date()), 'MMM yyyy')}
                      </Typography>
                      {row.isPaid ? (
                        <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />
                      ) : (
                        <CircleIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                      {fmt(row.totalExpenses)}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>

        {/* RIGHT: Form Content */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3, bgcolor: (t) => alpha(t.palette.grey[50], 0.3) }}>
          {loading ? (
            <Stack spacing={2.5}>
              <Skeleton variant="rounded" height={56} />
              <Skeleton variant="rounded" height={160} />
              <Skeleton variant="rounded" height={160} />
              <Skeleton variant="rounded" height={160} />
            </Stack>
          ) : (
            <Stack spacing={3}>
              {/* Record status banner */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.75,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: isNew ? 'info.light' : 'divider',
                  bgcolor: (t) =>
                    isNew ? alpha(t.palette.info.main, 0.06) : alpha(t.palette.grey[500], 0.04),
                }}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ letterSpacing: '-0.2px' }}>
                    {displayMonth}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isNew
                      ? 'New record — not saved yet'
                      : lastUpdated
                      ? `Last updated ${lastUpdated}`
                      : 'Existing record'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={formData.isPaid ? 'Paid' : 'Pending'}
                  color={formData.isPaid ? 'success' : 'warning'}
                  variant={formData.isPaid ? 'filled' : 'outlined'}
                  icon={formData.isPaid ? <CheckIcon sx={{ fontSize: '13px !important' }} /> : undefined}
                  sx={{ fontWeight: 600, fontSize: 11 }}
                />
              </Box>

              {/* ─── RENT & LEASE ─── */}
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: (t) => alpha(t.palette.primary.main, 0.25),
                  borderRadius: 2.5,
                  overflow: 'hidden',
                }}
              >
                <SectionHeader
                  icon={<RentIcon sx={{ fontSize: 17, color: 'primary.dark' }} />}
                  title="Rent & Lease"
                  color="primary"
                  sectionTotal={rentTotal}
                />
                <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <ExpenseField label="Monthly Rent" name="rent" value={formData.rent} onChange={handleChange} />
                  <ExpenseField label="Parking / Garage" name="parking" value={formData.parking} onChange={handleChange} />
                </Box>
              </Box>

              {/* ─── UTILITIES ─── */}
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: (t) => alpha(t.palette.warning.main, 0.3),
                  borderRadius: 2.5,
                  overflow: 'hidden',
                }}
              >
                <SectionHeader
                  icon={<UtilitiesIcon sx={{ fontSize: 17, color: 'warning.dark' }} />}
                  title="Utilities"
                  color="warning"
                  sectionTotal={utilitiesTotal}
                />
                <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                  <ExpenseField label="Electricity" name="electricity" value={formData.electricity} onChange={handleChange} />
                  <ExpenseField label="Water / Drainage" name="water" value={formData.water} onChange={handleChange} />
                  <ExpenseField label="Internet / Broadband" name="internet" value={formData.internet} onChange={handleChange} />
                </Box>
              </Box>

              {/* ─── MAINTENANCE ─── */}
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: (t) => alpha(t.palette.secondary.main, 0.25),
                  borderRadius: 2.5,
                  overflow: 'hidden',
                }}
              >
                <SectionHeader
                  icon={<MaintenanceIcon sx={{ fontSize: 17, color: 'secondary.dark' }} />}
                  title="Maintenance & Repairs"
                  color="secondary"
                  sectionTotal={maintenanceTotal}
                />
                <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
                  <ExpenseField label="General Maintenance" name="maintenance" value={formData.maintenance} onChange={handleChange} />
                  <ExpenseField label="Repairs / Renovation" name="repairWork" value={formData.repairWork} onChange={handleChange} />
                  <ExpenseField label="Housekeeping / Cleaning" name="housekeeping" value={formData.housekeeping} onChange={handleChange} />
                </Box>
              </Box>

              {/* ─── OTHER ─── */}
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2.5,
                  overflow: 'hidden',
                }}
              >
                <SectionHeader
                  icon={<OtherIcon sx={{ fontSize: 17, color: 'text.secondary' }} />}
                  title="Miscellaneous"
                  color="default"
                  sectionTotal={formData.miscellaneous}
                />
                <Box sx={{ p: 2.5, maxWidth: 320 }}>
                  <ExpenseField label="Other Expenses" name="miscellaneous" value={formData.miscellaneous} onChange={handleChange} />
                </Box>
              </Box>

              {/* ─── PAYMENT STATUS ─── */}
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2.5,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 2.5,
                    py: 1.5,
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.05),
                    borderBottom: '1px solid',
                    borderBottomColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.grey[600], 0.1) }}>
                    <PaymentIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                  </Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Payment Status
                  </Typography>
                </Box>
                <Box sx={{ px: 2.5, py: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isPaid}
                        onChange={(e) => {
                          const isPaid = e.target.checked;
                          setFormData((p) => ({
                            ...p,
                            isPaid,
                            paidDate: isPaid && paymentDate ? Timestamp.fromDate(paymentDate) : undefined,
                          }));
                        }}
                        color="success"
                      />
                    }
                    label={
                      <Typography
                        variant="body2"
                        fontWeight={formData.isPaid ? 700 : 400}
                        color={formData.isPaid ? 'success.main' : 'text.secondary'}
                      >
                        {formData.isPaid ? 'Expenses settled / paid' : 'Mark expenses as paid'}
                      </Typography>
                    }
                  />
                  {formData.isPaid && (
                    <Box sx={{ mt: 2, maxWidth: 280 }}>
                      <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DatePicker
                          label="Date of Payment"
                          value={paymentDate}
                          onChange={handlePaymentDateChange}
                          slotProps={{
                            textField: {
                              size: 'small',
                              fullWidth: true,
                              helperText: 'Date on which expenses were settled',
                            },
                          }}
                        />
                      </LocalizationProvider>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* ─── REMARKS ─── */}
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2.5,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 2.5,
                    py: 1.5,
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.05),
                    borderBottom: '1px solid',
                    borderBottomColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.grey[600], 0.1) }}>
                    <NoteIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
                  </Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Remarks
                  </Typography>
                </Box>
                <Box sx={{ px: 2.5, py: 2 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    placeholder="Add any notes about this month's expenses — e.g. one-time repairs, rent changes…"
                    size="small"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                  />
                </Box>
              </Box>
            </Stack>
          )}
        </Box>
      </Box>

      {/* ── FOOTER: Live Summary + Actions ──────────────────────── */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={2.5} sx={{ flex: 1 }} alignItems="center">
          {[
            { label: 'Rent', value: rentTotal, color: 'primary.main' },
            { label: 'Utilities', value: utilitiesTotal, color: 'warning.main' },
            { label: 'Maintenance', value: maintenanceTotal, color: 'secondary.main' },
          ].map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && (
                <Box sx={{ width: 1, height: 32, bgcolor: 'divider', display: { xs: 'none', md: 'block' } }} />
              )}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Typography variant="caption" color="text.disabled" display="block" sx={{ lineHeight: 1.2, mb: 0.25 }}>
                  {item.label}
                </Typography>
                <Typography variant="body2" fontWeight={700} color={item.color}>
                  {fmt(item.value)}
                </Typography>
              </Box>
            </React.Fragment>
          ))}
          <Box sx={{ width: 1, height: 32, bgcolor: 'divider', display: { xs: 'none', md: 'block' } }} />
          <Box>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ lineHeight: 1.2, mb: 0.25 }}>
              Total &mdash; <strong style={{ color: 'inherit' }}>{displayMonth}</strong>
            </Typography>
            <Typography variant="h6" fontWeight={800} color="primary.main" sx={{ lineHeight: 1, letterSpacing: '-0.5px' }}>
              {fmt(formData.totalExpenses)}
            </Typography>
          </Box>
        </Stack>

        <Button
          variant="text"
          onClick={onCancel}
          disabled={isSaving}
          sx={{ color: 'text.secondary', fontWeight: 500, minWidth: 80 }}
        >
          Cancel
        </Button>
        <AsyncActionButton
          variant="contained"
          color="primary"
          type="submit"
          loading={isSaving}
          loadingText={isNew ? 'Saving…' : 'Updating…'}
          sx={{ minWidth: 160, fontWeight: 700, borderRadius: 2, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
        >
          {isNew ? 'Save Expenses' : 'Update Expenses'}
        </AsyncActionButton>
      </Box>
    </Box>
  );
}
