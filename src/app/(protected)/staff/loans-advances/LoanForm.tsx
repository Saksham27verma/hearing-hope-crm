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
  FormHelperText,
  Chip,
  Stack,
  Slider,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { format, addMonths, differenceInMonths } from 'date-fns';
import {
  CalendarMonth as CalendarIcon,
  AttachMoney as MoneyIcon,
  LocalAtm as LoanIcon,
  Percent as PercentIcon,
  EventNote as EventNoteIcon,
  Payments as PaymentsIcon,
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

// Define Loan/Advance interface
interface LoanAdvance {
  id?: string;
  staffId: string;
  type: 'loan' | 'advance';
  amount: number;
  interestRate: number; // only for loans
  emiAmount: number; // only for loans
  totalAmount: number; // including interest
  issueDate: Timestamp;
  startDeductionDate: Timestamp;
  endDate?: Timestamp;
  reason: string;
  status: 'active' | 'completed' | 'cancelled';
  remainingAmount: number;
  monthlyDeduction: number;
  numberOfInstallments: number;
  completedInstallments: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface LoanFormProps {
  staff: Staff[];
  initialData?: LoanAdvance;
  selectedStaff?: Staff | null;
  onSave: (data: LoanAdvance) => void;
  onCancel: () => void;
}

export default function LoanForm({ staff, initialData, selectedStaff, onSave, onCancel }: LoanFormProps) {
  // Initialize form state with initial data or default values
  const [formData, setFormData] = useState<LoanAdvance>({
    id: initialData?.id,
    staffId: initialData?.staffId || selectedStaff?.id || '',
    type: initialData?.type || 'loan',
    amount: initialData?.amount || 0,
    interestRate: initialData?.interestRate || 0,
    emiAmount: initialData?.emiAmount || 0,
    totalAmount: initialData?.totalAmount || 0,
    issueDate: initialData?.issueDate || Timestamp.now(),
    startDeductionDate: initialData?.startDeductionDate || Timestamp.fromDate(addMonths(new Date(), 1)),
    reason: initialData?.reason || '',
    status: initialData?.status || 'active',
    remainingAmount: initialData?.remainingAmount || 0,
    monthlyDeduction: initialData?.monthlyDeduction || 0,
    numberOfInstallments: initialData?.numberOfInstallments || 12,
    completedInstallments: initialData?.completedInstallments || 0,
  });

  // For date pickers
  const [issueDate, setIssueDate] = useState<Date>(
    formData.issueDate ? new Date(formData.issueDate.seconds * 1000) : new Date()
  );
  const [deductionDate, setDeductionDate] = useState<Date>(
    formData.startDeductionDate ? new Date(formData.startDeductionDate.seconds * 1000) : addMonths(new Date(), 1)
  );

  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loanSummary, setLoanSummary] = useState<{
    totalAmount: number;
    monthlyPayment: number;
    duration: number;
  }>({
    totalAmount: 0,
    monthlyPayment: 0,
    duration: 0
  });

  // Calculate loan details whenever relevant fields change
  useEffect(() => {
    if (formData.type === 'loan') {
      calculateLoan();
    } else {
      // For advances, total amount is the same as principal
      const monthlyPayment = formData.amount / formData.numberOfInstallments;
      setLoanSummary({
        totalAmount: formData.amount,
        monthlyPayment: Math.round(monthlyPayment),
        duration: formData.numberOfInstallments
      });
      
      // Update form data
      setFormData(prev => ({
        ...prev,
        totalAmount: formData.amount,
        remainingAmount: formData.amount,
        monthlyDeduction: Math.round(monthlyPayment),
        interestRate: 0,
        emiAmount: Math.round(monthlyPayment)
      }));
    }
  }, [formData.amount, formData.interestRate, formData.numberOfInstallments, formData.type]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Handle numeric values
    if (['amount', 'interestRate', 'numberOfInstallments'].includes(name)) {
      const numValue = parseFloat(value) || 0;
      setFormData(prev => ({ ...prev, [name]: numValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Handle select changes
  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle date changes
  const handleIssueDateChange = (date: Date | null) => {
    if (date) {
      setIssueDate(date);
      setFormData(prev => ({
        ...prev,
        issueDate: Timestamp.fromDate(date)
      }));
    }
  };

  const handleDeductionDateChange = (date: Date | null) => {
    if (date) {
      setDeductionDate(date);
      setFormData(prev => ({
        ...prev,
        startDeductionDate: Timestamp.fromDate(date)
      }));
    }
  };

  // Calculate loan details
  const calculateLoan = () => {
    const principal = formData.amount;
    const interestRate = formData.interestRate;
    const months = formData.numberOfInstallments;
    
    // Simple interest calculation
    const interestAmount = (principal * interestRate * months) / 1200; // Convert percent to decimal and years to months
    const totalAmount = principal + interestAmount;
    const monthlyPayment = totalAmount / months;
    
    setLoanSummary({
      totalAmount: Math.round(totalAmount),
      monthlyPayment: Math.round(monthlyPayment),
      duration: months
    });
    
    // Update form data
    setFormData(prev => ({
      ...prev,
      totalAmount: Math.round(totalAmount),
      remainingAmount: Math.round(totalAmount),
      monthlyDeduction: Math.round(monthlyPayment),
      emiAmount: Math.round(monthlyPayment)
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.staffId) newErrors.staffId = 'Staff member is required';
    if (formData.amount <= 0) newErrors.amount = 'Amount must be greater than zero';
    if (!formData.reason.trim()) newErrors.reason = 'Reason is required';
    
    // Loan specific validations
    if (formData.type === 'loan') {
      if (formData.interestRate < 0) newErrors.interestRate = 'Interest rate cannot be negative';
    }
    
    // Installments validation
    if (formData.numberOfInstallments < 1) newErrors.numberOfInstallments = 'Number of installments must be at least 1';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSave(formData);
    }
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
          {initialData?.id ? 'Edit Loan/Advance' : 'New Loan/Advance'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {initialData?.id 
            ? `Modify existing ${formData.type} details` 
            : 'Create a new loan or salary advance'
          }
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LoanIcon /> Basic Details
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Stack spacing={3}>
              <FormControl fullWidth error={!!errors.staffId} required>
                <InputLabel>Staff Member</InputLabel>
                <Select
                  name="staffId"
                  value={formData.staffId}
                  onChange={handleSelectChange}
                  label="Staff Member"
                  disabled={!!selectedStaff || !!initialData}
                >
                  {staff.map((staffMember) => (
                    <MenuItem key={staffMember.id} value={staffMember.id}>
                      {staffMember.name} ({staffMember.jobRole})
                    </MenuItem>
                  ))}
                </Select>
                {errors.staffId && <FormHelperText>{errors.staffId}</FormHelperText>}
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Type</InputLabel>
                <Select
                  name="type"
                  value={formData.type}
                  onChange={handleSelectChange}
                  label="Type"
                  disabled={!!initialData} // Cannot change type once created
                >
                  <MenuItem value="loan">Loan</MenuItem>
                  <MenuItem value="advance">Salary Advance</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Amount"
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleChange}
                error={!!errors.amount}
                helperText={errors.amount}
                required
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
              />

              {formData.type === 'loan' && (
                <TextField
                  fullWidth
                  label="Interest Rate"
                  name="interestRate"
                  type="number"
                  value={formData.interestRate}
                  onChange={handleChange}
                  error={!!errors.interestRate}
                  helperText={errors.interestRate}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><PercentIcon fontSize="small" /></InputAdornment>,
                    inputProps: { step: 0.5, min: 0 }
                  }}
                />
              )}

              <Box>
                <Typography gutterBottom>Number of Installments</Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs>
                    <Slider
                      value={formData.numberOfInstallments}
                      onChange={(_, value) => setFormData(prev => ({ ...prev, numberOfInstallments: value as number }))}
                      step={1}
                      marks
                      min={1}
                      max={36}
                      valueLabelDisplay="auto"
                    />
                  </Grid>
                  <Grid item>
                    <TextField
                      name="numberOfInstallments"
                      value={formData.numberOfInstallments}
                      onChange={handleChange}
                      type="number"
                      size="small"
                      InputProps={{
                        inputProps: { min: 1, max: 36 }
                      }}
                      sx={{ width: 70 }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Stack>
          </Paper>

          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventNoteIcon /> Purpose & Notes
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Reason / Purpose"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              error={!!errors.reason}
              helperText={errors.reason}
              required
              placeholder="Enter the reason for this loan or advance..."
            />
          </Paper>
        </Grid>

        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon /> Dates
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Stack spacing={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Issue Date"
                  value={issueDate}
                  onChange={handleIssueDateChange}
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

              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Deduction From"
                  value={deductionDate}
                  onChange={handleDeductionDateChange}
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

              {initialData && (
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleSelectChange}
                    label="Status"
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Paper>

          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: '#f9f9f9' }}>
            <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PaymentsIcon /> Repayment Summary
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Stack spacing={2}>
              {formData.type === 'loan' && (
                <Box>
                  <Typography variant="body2" color="text.secondary">Principal Amount</Typography>
                  <Typography variant="h6">{formatCurrency(formData.amount)}</Typography>
                </Box>
              )}

              <Box>
                <Typography variant="body2" color="text.secondary">
                  {formData.type === 'loan' ? 'Total Amount (With Interest)' : 'Total Amount'}
                </Typography>
                <Typography variant="h6" color="primary.main" fontWeight="bold">
                  {formatCurrency(loanSummary.totalAmount)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">Monthly Deduction</Typography>
                <Typography variant="h6" color="error.main">
                  {formatCurrency(loanSummary.monthlyPayment)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary">Duration</Typography>
                <Typography variant="h6">
                  {loanSummary.duration} {loanSummary.duration === 1 ? 'month' : 'months'}
                </Typography>
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                This amount will be automatically deducted from the staff member's monthly salary starting from {format(deductionDate, 'MMMM yyyy')}.
              </Alert>
            </Stack>
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
          {initialData?.id ? 'Update' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
} 