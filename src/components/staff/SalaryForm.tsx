'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Divider,
  InputAdornment,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { format, parse, startOfMonth, set } from 'date-fns';
import {
  CalendarMonth as CalendarIcon,
  Payments as PaymentsIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Money as MoneyIcon,
  CreditCard as CreditCardIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';

// Define Staff interface
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

// Define Salary interface
interface Salary {
  id?: string;
  staffId: string;
  month: string; // Format: YYYY-MM
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
  onSave: (data: Salary) => void;
  onCancel: () => void;
}

export default function SalaryForm({ staff, initialData, onSave, onCancel }: SalaryFormProps) {
  // Get current month in YYYY-MM format
  const getCurrentMonth = () => {
    return format(new Date(), 'yyyy-MM');
  };

  // Initialize form state
  const [formData, setFormData] = useState<Salary>({
    id: initialData?.id,
    staffId: staff.id || '',
    month: initialData?.month || getCurrentMonth(),
    basicSalary: initialData?.basicSalary || staff.basicSalary || 0,
    hra: initialData?.hra || 0,
    travelAllowance: initialData?.travelAllowance || 0,
    festivalAdvance: initialData?.festivalAdvance || 0,
    generalAdvance: initialData?.generalAdvance || 0,
    deductions: initialData?.deductions || 0,
    incentives: initialData?.incentives || 0,
    totalEarnings: initialData?.totalEarnings || 0,
    totalDeductions: initialData?.totalDeductions || 0,
    netSalary: initialData?.netSalary || 0,
    isPaid: initialData?.isPaid || false,
    paidDate: initialData?.paidDate,
    remarks: initialData?.remarks || '',
  });

  // For month picker
  const [monthDate, setMonthDate] = useState<Date | null>(
    formData.month ? parse(formData.month, 'yyyy-MM', new Date()) : new Date()
  );

  // For payment date picker
  const [paymentDate, setPaymentDate] = useState<Date | null>(
    formData.paidDate ? new Date(formData.paidDate.seconds * 1000) : null
  );

  // Calculate totals whenever any amount changes
  useEffect(() => {
    const totalEarnings = formData.basicSalary + formData.hra + formData.incentives + formData.travelAllowance;
    const totalDeductions = formData.festivalAdvance + formData.generalAdvance + formData.deductions;
    const netSalary = totalEarnings - totalDeductions;

    setFormData(prev => ({
      ...prev,
      totalEarnings,
      totalDeductions,
      netSalary
    }));
  }, [
    formData.basicSalary,
    formData.hra,
    formData.festivalAdvance,
    formData.generalAdvance,
    formData.deductions,
    formData.incentives,
    formData.travelAllowance
  ]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric values
    if ([
      'basicSalary', 
      'hra', 
      'travelAllowance',
      'festivalAdvance', 
      'generalAdvance', 
      'deductions', 
      'incentives'
    ].includes(name)) {
      const numValue = parseFloat(value) || 0;
      setFormData(prev => ({ ...prev, [name]: numValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle month change
  const handleMonthChange = (date: Date | null) => {
    if (date) {
      setMonthDate(date);
      // Set to first day of month and format as YYYY-MM
      const firstOfMonth = startOfMonth(date);
      const formattedMonth = format(firstOfMonth, 'yyyy-MM');
      setFormData(prev => ({ ...prev, month: formattedMonth }));
    }
  };

  // Handle payment date change
  const handlePaymentDateChange = (date: Date | null) => {
    setPaymentDate(date);
    if (date) {
      setFormData(prev => ({
        ...prev,
        isPaid: true,
        paidDate: Timestamp.fromDate(date)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        isPaid: false,
        paidDate: undefined
      }));
    }
  };

  // Handle payment status change
  const handlePaymentStatusChange = (e: any) => {
    const isPaid = e.target.value === 'paid';
    setFormData(prev => ({
      ...prev,
      isPaid,
      paidDate: isPaid && paymentDate ? Timestamp.fromDate(paymentDate) : undefined
    }));
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold">
          {initialData?.id ? 'Edit Salary' : 'Add Salary'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Staff: {staff.name} (ID: {staff.id})
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon /> Salary Period
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Month & Year"
                value={monthDate}
                onChange={handleMonthChange}
                views={['month', 'year']}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    margin: 'normal',
                    InputProps: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    },
                  },
                }}
              />
            </LocalizationProvider>
          </Paper>

          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PaymentsIcon /> Earnings
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField
                fullWidth
                label="Basic Salary"
                name="basicSalary"
                type="number"
                value={formData.basicSalary}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />

              <TextField
                fullWidth
                label="HRA"
                name="hra"
                type="number"
                value={formData.hra}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />

              <TextField
                fullWidth
                label="Travel Allowance"
                name="travelAllowance"
                type="number"
                value={formData.travelAllowance}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />

              <TextField
                fullWidth
                label="Incentives"
                name="incentives"
                type="number"
                value={formData.incentives}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />
            </Box>
          </Paper>
        </Grid>

        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RemoveIcon /> Deductions
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField
                fullWidth
                label="Festival Advance"
                name="festivalAdvance"
                type="number"
                value={formData.festivalAdvance}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />

              <TextField
                fullWidth
                label="General Advance"
                name="generalAdvance"
                type="number"
                value={formData.generalAdvance}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />

              <TextField
                fullWidth
                label="Other Deductions"
                name="deductions"
                type="number"
                value={formData.deductions}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />
            </Box>
          </Paper>

          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreditCardIcon /> Payment Status
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.isPaid ? 'paid' : 'unpaid'}
                label="Status"
                onChange={handlePaymentStatusChange}
              >
                <MenuItem value="unpaid">Unpaid</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
              </Select>
            </FormControl>

            {formData.isPaid && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Payment Date"
                  value={paymentDate}
                  onChange={handlePaymentDateChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      InputProps: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <CalendarIcon fontSize="small" color="action" />
                          </InputAdornment>
                        ),
                      },
                    },
                  }}
                />
              </LocalizationProvider>
            )}
          </Paper>
        </Grid>

        <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventNoteIcon /> Additional Notes
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Remarks"
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Any additional notes about this salary payment..."
            />
          </Paper>
        </Grid>

        <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: '#f9f9f9' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MoneyIcon /> Salary Summary
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Total Earnings</Typography>
                <Typography variant="h6" fontWeight="medium" color="success.main">
                  {formatCurrency(formData.totalEarnings)}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Basic + HRA + Travel Allowance + Incentives
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">Total Deductions</Typography>
                <Typography variant="h6" fontWeight="medium" color="error.main">
                  {formatCurrency(formData.totalDeductions)}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Advances + Other Deductions
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">Net Salary</Typography>
                <Typography variant="h5" fontWeight="bold" color="primary.main">
                  {formatCurrency(formData.netSalary)}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Chip 
                  size="small" 
                  label={formData.isPaid ? 'Paid' : 'Unpaid'} 
                  color={formData.isPaid ? 'success' : 'default'} 
                  variant="outlined"
                />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Box display="flex" justifyContent="space-between" gap={2} mt={2}>
        <Button
          variant="outlined"
          onClick={onCancel}
          sx={{ borderRadius: 1.5, px: 3 }}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          color="primary"
          type="submit"
          sx={{ borderRadius: 1.5, px: 4 }}
        >
          {initialData?.id ? 'Update Salary' : 'Save Salary'}
        </Button>
      </Box>
    </Box>
  );
} 