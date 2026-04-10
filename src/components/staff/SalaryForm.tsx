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
  TrendingUp as EarningsIcon,
  TrendingDown as DeductionsIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as CircleIcon,
  Close as CloseIcon,
  Print as PrintIcon,
  EventNote as NoteIcon,
  CreditCard as PaymentIcon,
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
  name.split(' ').map((p) => p[0]).join('').toUpperCase().substring(0, 2);

const blankSalary = (staff: Staff): Salary => ({
  staffId: staff.id || '',
  month: format(new Date(), 'yyyy-MM'),
  basicSalary: staff.basicSalary || 0,
  hra: 0,
  travelAllowance: 0,
  festivalAdvance: 0,
  generalAdvance: 0,
  deductions: 0,
  incentives: 0,
  totalEarnings: 0,
  totalDeductions: 0,
  netSalary: 0,
  isPaid: false,
  remarks: '',
});

const hydrate = (initialData: Salary | undefined, staff: Staff): Salary => ({
  id: initialData?.id,
  staffId: staff.id || '',
  month: initialData?.month || format(new Date(), 'yyyy-MM'),
  basicSalary: initialData?.basicSalary ?? staff.basicSalary ?? 0,
  hra: initialData?.hra ?? 0,
  travelAllowance: initialData?.travelAllowance ?? 0,
  festivalAdvance: initialData?.festivalAdvance ?? 0,
  generalAdvance: initialData?.generalAdvance ?? 0,
  deductions: initialData?.deductions ?? 0,
  incentives: initialData?.incentives ?? 0,
  totalEarnings: initialData?.totalEarnings ?? 0,
  totalDeductions: initialData?.totalDeductions ?? 0,
  netSalary: initialData?.netSalary ?? 0,
  isPaid: initialData?.isPaid ?? false,
  paidDate: initialData?.paidDate,
  remarks: initialData?.remarks ?? '',
});

const NUMERIC_FIELDS = [
  'basicSalary', 'hra', 'travelAllowance',
  'festivalAdvance', 'generalAdvance', 'deductions', 'incentives',
];

export default function SalaryForm({
  staff,
  initialData,
  salaryHistory = [],
  onMonthChange,
  onSave,
  onCancel,
  isSaving = false,
  loading = false,
}: SalaryFormProps) {
  const [formData, setFormData] = useState<Salary>(() => hydrate(initialData, staff));
  const [monthDate, setMonthDate] = useState<Date | null>(() =>
    parse(formData.month, 'yyyy-MM', new Date())
  );
  const [paymentDate, setPaymentDate] = useState<Date | null>(
    formData.paidDate ? new Date(formData.paidDate.seconds * 1000) : null
  );

  useEffect(() => {
    const next = hydrate(initialData, staff);
    setFormData(next);
    setMonthDate(parse(next.month, 'yyyy-MM', new Date()));
    setPaymentDate(next.paidDate ? new Date(next.paidDate.seconds * 1000) : null);
  }, [initialData, staff.id, staff.basicSalary]);

  useEffect(() => {
    const totalEarnings = formData.basicSalary + formData.hra + formData.incentives + formData.travelAllowance;
    const totalDeductions = formData.festivalAdvance + formData.generalAdvance + formData.deductions;
    setFormData((p) => ({ ...p, totalEarnings, totalDeductions, netSalary: totalEarnings - totalDeductions }));
  }, [formData.basicSalary, formData.hra, formData.festivalAdvance, formData.generalAdvance, formData.deductions, formData.incentives, formData.travelAllowance]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: NUMERIC_FIELDS.includes(name) ? parseFloat(value) || 0 : value }));
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

  const AmountField = ({ label, name, value }: { label: string; name: string; value: number }) => (
    <TextField
      fullWidth
      size="small"
      label={label}
      name={name}
      type="number"
      value={value}
      onChange={handleChange}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Typography variant="caption" color="text.secondary" fontWeight={600}>₹</Typography>
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
          {initials(staff.name)}
        </Avatar>

        <Box flex={1} minWidth={0}>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.25, letterSpacing: '-0.3px' }}>
            {staff.name}
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.75, display: 'block' }}>
            {staff.jobRole} &nbsp;·&nbsp; Salary Management
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

        <Tooltip title="Open Salary Slip" arrow>
          <IconButton
            size="small"
            onClick={() => window.open(`/staff/salary-slip/${staff.id}?month=${formData.month}`, '_blank')}
            sx={{ color: alpha('#fff', 0.75), '&:hover': { color: 'white', bgcolor: alpha('#fff', 0.12) } }}
          >
            <PrintIcon fontSize="small" />
          </IconButton>
        </Tooltip>

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

      {/* Progress bar while loading */}
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
            bgcolor: (theme) => alpha(theme.palette.grey[50], 0.7),
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
            {salaryHistory.length > 0 && (
              <Chip
                label={salaryHistory.length}
                size="small"
                sx={{
                  height: 16,
                  fontSize: 10,
                  fontWeight: 700,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {salaryHistory.length === 0 ? (
              <Box sx={{ p: 2.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.disabled" display="block">
                  No records yet.
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Pick a month above to start.
                </Typography>
              </Box>
            ) : (
              salaryHistory.map((row) => {
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
                      {fmt(row.netSalary)}
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
              <Skeleton variant="rounded" height={180} />
              <Skeleton variant="rounded" height={180} />
              <Skeleton variant="rounded" height={80} />
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
                  label={formData.isPaid ? 'Paid' : 'Unpaid'}
                  color={formData.isPaid ? 'success' : 'default'}
                  variant={formData.isPaid ? 'filled' : 'outlined'}
                  icon={formData.isPaid ? <CheckIcon sx={{ fontSize: '13px !important' }} /> : undefined}
                  sx={{ fontWeight: 600, fontSize: 11 }}
                />
              </Box>

              {/* ─── EARNINGS ─── */}
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: (t) => alpha(t.palette.success.main, 0.25),
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
                    bgcolor: (t) => alpha(t.palette.success.main, 0.07),
                    borderBottom: '1px solid',
                    borderBottomColor: (t) => alpha(t.palette.success.main, 0.2),
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: 1.5,
                      bgcolor: (t) => alpha(t.palette.success.main, 0.15),
                    }}
                  >
                    <EarningsIcon sx={{ fontSize: 17, color: 'success.dark' }} />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="subtitle2" fontWeight={700} color="success.dark">
                      Earnings
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={700} color="success.main">
                    {fmt(formData.totalEarnings)}
                  </Typography>
                </Box>
                <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <AmountField label="Basic Salary" name="basicSalary" value={formData.basicSalary} />
                  <AmountField label="HRA" name="hra" value={formData.hra} />
                  <AmountField label="Travel Allowance" name="travelAllowance" value={formData.travelAllowance} />
                  <AmountField label="Incentives / Bonus" name="incentives" value={formData.incentives} />
                </Box>
              </Box>

              {/* ─── DEDUCTIONS ─── */}
              <Box
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: (t) => alpha(t.palette.error.main, 0.25),
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
                    bgcolor: (t) => alpha(t.palette.error.main, 0.07),
                    borderBottom: '1px solid',
                    borderBottomColor: (t) => alpha(t.palette.error.main, 0.2),
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: 1.5,
                      bgcolor: (t) => alpha(t.palette.error.main, 0.15),
                    }}
                  >
                    <DeductionsIcon sx={{ fontSize: 17, color: 'error.dark' }} />
                  </Box>
                  <Box flex={1}>
                    <Typography variant="subtitle2" fontWeight={700} color="error.dark">
                      Deductions
                    </Typography>
                  </Box>
                  <Typography variant="body2" fontWeight={700} color="error.main">
                    {fmt(formData.totalDeductions)}
                  </Typography>
                </Box>
                <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <AmountField label="Festival Advance" name="festivalAdvance" value={formData.festivalAdvance} />
                  <AmountField label="General Advance" name="generalAdvance" value={formData.generalAdvance} />
                  <AmountField label="Other Deductions" name="deductions" value={formData.deductions} />
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: 1.5,
                      bgcolor: (t) => alpha(t.palette.grey[600], 0.1),
                    }}
                  >
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
                        {formData.isPaid ? 'Salary has been paid' : 'Mark salary as paid'}
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
                              helperText: 'Date on which salary was disbursed',
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
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 30,
                      height: 30,
                      borderRadius: 1.5,
                      bgcolor: (t) => alpha(t.palette.grey[600], 0.1),
                    }}
                  >
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
                    placeholder="Add any notes about this salary — e.g. adjustments, explanations…"
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
        {/* Summary pills */}
        <Stack direction="row" spacing={2.5} sx={{ flex: 1 }} alignItems="center">
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ lineHeight: 1.2, mb: 0.25 }}>
              Earnings
            </Typography>
            <Typography variant="body2" fontWeight={700} color="success.main">
              {fmt(formData.totalEarnings)}
            </Typography>
          </Box>

          <Box
            sx={{
              width: 1,
              height: 32,
              bgcolor: 'divider',
              display: { xs: 'none', md: 'block' },
            }}
          />

          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ lineHeight: 1.2, mb: 0.25 }}>
              Deductions
            </Typography>
            <Typography variant="body2" fontWeight={700} color="error.main">
              {fmt(formData.totalDeductions)}
            </Typography>
          </Box>

          <Box
            sx={{
              width: 1,
              height: 32,
              bgcolor: 'divider',
              display: { xs: 'none', md: 'block' },
            }}
          />

          <Box>
            <Typography variant="caption" color="text.disabled" display="block" sx={{ lineHeight: 1.2, mb: 0.25 }}>
              Net Pay
            </Typography>
            <Typography
              variant="h6"
              fontWeight={800}
              color="primary.main"
              sx={{ lineHeight: 1, letterSpacing: '-0.5px' }}
            >
              {fmt(formData.netSalary)}
            </Typography>
          </Box>
        </Stack>

        {/* Actions */}
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
          sx={{
            minWidth: 140,
            fontWeight: 700,
            borderRadius: 2,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          }}
        >
          {isNew ? 'Save Salary' : 'Update Salary'}
        </AsyncActionButton>
      </Box>
    </Box>
  );
}
