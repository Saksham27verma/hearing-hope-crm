'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Divider,
  InputAdornment,
  FormControl,
  FormControlLabel,
  Switch,
  Stack,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import {
  CalendarMonth as CalendarIcon,
  Payment as PaymentIcon,
  CreditCard as CreditCardIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';

// Define Staff interface
interface Staff {
  id?: string;
  name: string;
  jobRole: string;
}

// Define Loan/Advance interface
interface LoanAdvance {
  id?: string;
  staffId: string;
  type: 'loan' | 'advance';
  amount: number;
  totalAmount: number;
  remainingAmount: number;
  monthlyDeduction: number;
}

// Define Payment interface
interface Payment {
  id?: string;
  loanAdvanceId: string;
  staffId: string;
  amount: number;
  paymentDate: Timestamp;
  month: string; // Format: YYYY-MM
  deductedFromSalary: boolean;
  remarks?: string;
}

interface PaymentFormProps {
  staff: Staff;
  loan: LoanAdvance;
  onSave: (data: Payment) => void;
  onCancel: () => void;
}

export default function PaymentForm({ staff, loan, onSave, onCancel }: PaymentFormProps) {
  // Get current month in YYYY-MM format
  const getCurrentMonth = () => {
    return format(new Date(), 'yyyy-MM');
  };
  
  // Initialize form state
  const [formData, setFormData] = useState<Payment>({
    loanAdvanceId: loan.id || '',
    staffId: staff.id || '',
    amount: loan.monthlyDeduction,
    paymentDate: Timestamp.now(),
    month: getCurrentMonth(),
    deductedFromSalary: true,
    remarks: '',
  });
  
  // For date picker
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  
  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Clear error
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (name === 'amount') {
      const numValue = parseFloat(value) || 0;
      setFormData(prev => ({ ...prev, [name]: numValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // Handle switch change
  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, deductedFromSalary: e.target.checked }));
  };
  
  // Handle date change
  const handleDateChange = (date: Date | null) => {
    if (date) {
      setPaymentDate(date);
      setFormData(prev => ({
        ...prev,
        paymentDate: Timestamp.fromDate(date),
        month: format(date, 'yyyy-MM')
      }));
    }
  };
  
  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (formData.amount <= 0) {
      newErrors.amount = 'Payment amount must be greater than zero';
    }
    
    if (formData.amount > loan.remainingAmount) {
      newErrors.amount = `Payment cannot exceed the remaining amount (${formatCurrency(loan.remainingAmount)})`;
    }
    
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
          Record Payment
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Record a payment for {staff.name}'s {loan.type}
        </Typography>
      </Box>
      
      <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaymentIcon /> Payment Details
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Staff</Typography>
              <Typography variant="body1" fontWeight="medium">{staff.name}</Typography>
              <Typography variant="caption" color="text.secondary">{staff.jobRole}</Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">Type</Typography>
              <Typography variant="body1" fontWeight="medium" sx={{ textTransform: 'capitalize' }}>
                {loan.type}
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" color="text.secondary">Remaining Amount</Typography>
              <Typography variant="body1" fontWeight="medium" color="error.main">
                {formatCurrency(loan.remainingAmount)}
              </Typography>
            </Box>
          </Box>
          
          <TextField
            fullWidth
            label="Payment Amount"
            name="amount"
            type="number"
            value={formData.amount}
            onChange={handleChange}
            error={!!errors.amount}
            helperText={errors.amount || `Regular monthly installment is ${formatCurrency(loan.monthlyDeduction)}`}
            InputProps={{
              startAdornment: <InputAdornment position="start">₹</InputAdornment>,
            }}
          />
          
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Payment Date"
              value={paymentDate}
              onChange={handleDateChange}
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
          
          <FormControlLabel
            control={
              <Switch 
                checked={formData.deductedFromSalary} 
                onChange={handleSwitchChange} 
                color="primary" 
              />
            }
            label="Deduct from salary"
          />
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Remarks"
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
            placeholder="Add any additional notes about this payment..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                  <DescriptionIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      </Paper>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        {formData.deductedFromSalary 
          ? 'This amount will be deducted from the staff member\'s salary for the selected month.' 
          : 'This will be recorded as a direct payment, not deducted from salary.'}
      </Alert>
      
      <Box display="flex" justifyContent="space-between" gap={2}>
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
          Record Payment
        </Button>
      </Box>
    </Box>
  );
} 