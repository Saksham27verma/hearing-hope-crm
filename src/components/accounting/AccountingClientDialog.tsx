'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  Grid,
  MenuItem,
  Stack,
  InputAdornment,
  Box,
  Typography,
  Avatar,
  IconButton,
  Divider,
  Chip,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  AccountBalance as GstIcon,
  Notes as NotesIcon,
  Savings as SavingsIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as DrIcon,
  TrendingDown as CrIcon,
  CheckCircleOutline as CheckIcon,
} from '@mui/icons-material';
import type { AccountingClient } from '@/lib/accounting/types';
import { formatINR } from '@/lib/accounting/computations';

type Props = {
  open: boolean;
  onClose: () => void;
  companyId: string;
  initial?: AccountingClient | null;
  onSubmit: (data: AccountingClient) => Promise<void> | void;
};

const emptyClient = (companyId: string): AccountingClient => ({
  companyId,
  name: '',
  gstin: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  phone: '',
  email: '',
  openingBalance: 0,
  openingBalanceType: 'debit',
  openingDate: '',
  notes: '',
});

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman & Nicobar',
  'Chandigarh',
  'Dadra & Nagar Haveli',
  'Daman & Diu',
  'Lakshadweep',
  'Puducherry',
  'Ladakh',
];

function SectionHeader({
  icon,
  title,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  color: string;
}) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
      <Avatar
        variant="rounded"
        sx={{
          bgcolor: `${color}18`,
          color,
          width: 32,
          height: 32,
        }}
      >
        {icon}
      </Avatar>
      <Box>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

export default function AccountingClientDialog({
  open,
  onClose,
  companyId,
  initial,
  onSubmit,
}: Props) {
  const theme = useTheme();
  const [form, setForm] = useState<AccountingClient>(emptyClient(companyId));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...emptyClient(companyId), ...initial } : emptyClient(companyId));
      setErrors({});
    }
  }, [open, initial, companyId]);

  const set = <K extends keyof AccountingClient>(k: K, v: AccountingClient[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Client name is required';
    if (form.gstin && !/^[0-9A-Z]{15}$/.test(form.gstin.trim().toUpperCase())) {
      e.gstin = 'GSTIN must be 15 characters';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Invalid email';
    }
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) {
      e.pincode = '6 digits';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        gstin: form.gstin?.trim().toUpperCase() || '',
        openingBalance: Number(form.openingBalance || 0),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!initial?.id;
  const initials = useMemo(() => {
    const s = form.name.trim();
    if (!s) return '?';
    return s
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }, [form.name]);

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* Gradient header */}
      <Box
        sx={{
          position: 'relative',
          px: 3,
          pt: 3,
          pb: 2.5,
          color: '#fff',
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 60%, #1a237e 100%)`,
        }}
      >
        <IconButton
          onClick={onClose}
          disabled={saving}
          sx={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.85)' }}
          size="small"
        >
          <CloseIcon />
        </IconButton>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            sx={{
              bgcolor: 'rgba(255,255,255,0.18)',
              color: '#fff',
              width: 56,
              height: 56,
              fontWeight: 700,
              fontSize: 20,
              backdropFilter: 'blur(6px)',
            }}
          >
            {initials || <PersonIcon />}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700}>
              {isEdit ? 'Edit Client' : 'Add Accounting Client'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              {isEdit
                ? 'Update this client\u2019s billing and ledger details.'
                : 'Add a new client to bill from this company.'}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Stack spacing={2.5}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <SectionHeader
              icon={<BusinessIcon fontSize="small" />}
              title="Basic Details"
              subtitle="Who is this client?"
              color={theme.palette.primary.main}
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Client Name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name || 'Business or individual name'}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="GSTIN"
                  value={form.gstin || ''}
                  onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                  error={!!errors.gstin}
                  helperText={errors.gstin || '15 characters (optional)'}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <GstIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Phone"
                  value={form.phone || ''}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="e.g. 98765 43210"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Email"
                  value={form.email || ''}
                  onChange={(e) => set('email', e.target.value)}
                  error={!!errors.email}
                  helperText={errors.email}
                  placeholder="billing@client.com"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <SectionHeader
              icon={<LocationIcon fontSize="small" />}
              title="Billing Address"
              subtitle="State is used to auto-decide CGST+SGST vs IGST on invoices."
              color={theme.palette.warning.main}
            />
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Address"
                  value={form.address || ''}
                  onChange={(e) => set('address', e.target.value)}
                  multiline
                  minRows={2}
                  placeholder="Street, area, landmark"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="City"
                  value={form.city || ''}
                  onChange={(e) => set('city', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="State"
                  value={form.state || ''}
                  onChange={(e) => set('state', e.target.value)}
                  helperText="Match your company state for CGST+SGST"
                >
                  <MenuItem value="">
                    <em>Select state</em>
                  </MenuItem>
                  {INDIAN_STATES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Pincode"
                  value={form.pincode || ''}
                  onChange={(e) => set('pincode', e.target.value)}
                  error={!!errors.pincode}
                  helperText={errors.pincode}
                  inputProps={{ maxLength: 6 }}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <SectionHeader
              icon={<SavingsIcon fontSize="small" />}
              title="Opening Balance"
              subtitle="Starting balance carried forward before your first invoice here."
              color={theme.palette.success.main}
            />
            <Grid container spacing={2} alignItems="stretch">
              <Grid item xs={12} md={4}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Balance Type
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={form.openingBalanceType}
                  onChange={(_, v) => v && set('openingBalanceType', v as 'debit' | 'credit')}
                >
                  <ToggleButton value="debit" sx={{ textTransform: 'none' }}>
                    <DrIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Debit (Dr)
                  </ToggleButton>
                  <ToggleButton value="credit" sx={{ textTransform: 'none' }}>
                    <CrIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Credit (Cr)
                  </ToggleButton>
                </ToggleButtonGroup>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {form.openingBalanceType === 'debit'
                    ? 'Client owes us this amount.'
                    : 'Advance already received from client.'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Amount"
                  value={form.openingBalance}
                  onChange={(e) => set('openingBalance', Number(e.target.value))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography fontWeight={700}>&#8377;</Typography>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="As of Date"
                  value={form.openingDate || ''}
                  onChange={(e) => set('openingDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              {Number(form.openingBalance) > 0 && (
                <Grid item xs={12}>
                  <Chip
                    size="small"
                    color={form.openingBalanceType === 'debit' ? 'warning' : 'success'}
                    label={`Preview: ${formatINR(Number(form.openingBalance))} ${form.openingBalanceType === 'debit' ? 'Dr (receivable)' : 'Cr (advance)'}`}
                  />
                </Grid>
              )}
            </Grid>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <SectionHeader
              icon={<NotesIcon fontSize="small" />}
              title="Internal Notes"
              subtitle="Only visible in this CRM, never printed on invoices."
              color={theme.palette.grey[700]}
            />
            <TextField
              fullWidth
              size="small"
              value={form.notes || ''}
              onChange={(e) => set('notes', e.target.value)}
              multiline
              minRows={2}
              placeholder="e.g. Payment terms, preferred contact, referrer, etc."
            />
          </Paper>
        </Stack>
      </DialogContent>

      {/* Sticky footer */}
      <Divider />
      <Box
        sx={{
          px: 3,
          py: 2,
          bgcolor: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip
            size="small"
            variant="outlined"
            label={form.name ? form.name : 'Untitled client'}
            icon={<PersonIcon fontSize="small" />}
          />
          {form.state && <Chip size="small" variant="outlined" label={form.state} />}
          {form.gstin && !errors.gstin && (
            <Chip size="small" color="primary" variant="outlined" label="GSTIN set" icon={<CheckIcon fontSize="small" />} />
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving}
            sx={{ minWidth: 130, textTransform: 'none', borderRadius: 2 }}
          >
            {saving ? 'Saving\u2026' : isEdit ? 'Update Client' : 'Create Client'}
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
