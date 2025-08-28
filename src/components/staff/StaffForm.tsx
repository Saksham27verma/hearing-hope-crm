'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  Paper,
  Divider,
  InputAdornment,
  Avatar,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
  Stack,
  Chip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { 
  Person as PersonIcon, 
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  LocationCity as LocationCityIcon,
  CreditCard as CreditCardIcon,
  CalendarToday as CalendarIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  AccountCircle as AccountCircleIcon,
  Badge as BadgeIcon,
  AttachMoney as MoneyIcon,
} from '@mui/icons-material';

// Define job roles
const JOB_ROLES = [
  'Manager',
  'Audiologist',
  'Sales Executive',
  'Technician',
  'Receptionist',
  'Accountant',
  'Administrator',
  'Customer Support',
  'Marketing Executive',
  'Telecaller',
];

interface Staff {
  id?: string;
  name: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  joiningDate: Timestamp;
  jobRole: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContact?: string;
  emergencyName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
  aadharNumber?: string;
  basicSalary: number;
  status: 'active' | 'inactive';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface StaffFormProps {
  initialData?: Staff;
  onSave: (data: Staff) => void;
  onCancel: () => void;
}

export default function StaffForm({ initialData, onSave, onCancel }: StaffFormProps) {
  // Initialize form state with initial data or default values
  const [formData, setFormData] = useState<Staff>({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    alternatePhone: initialData?.alternatePhone || '',
    joiningDate: initialData?.joiningDate || Timestamp.now(),
    jobRole: initialData?.jobRole || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    pincode: initialData?.pincode || '',
    emergencyContact: initialData?.emergencyContact || '',
    emergencyName: initialData?.emergencyName || '',
    bankName: initialData?.bankName || '',
    accountNumber: initialData?.accountNumber || '',
    ifscCode: initialData?.ifscCode || '',
    panNumber: initialData?.panNumber || '',
    aadharNumber: initialData?.aadharNumber || '',
    basicSalary: initialData?.basicSalary || 0,
    status: initialData?.status || 'active',
  });

  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState('personal');

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Handle numeric values
    if (name === 'basicSalary') {
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

  // Handle date change
  const handleDateChange = (date: Date | null) => {
    if (date) {
      setFormData(prev => ({
        ...prev,
        joiningDate: Timestamp.fromDate(date)
      }));
      
      // Clear error
      if (errors.joiningDate) {
        setErrors(prev => ({ ...prev, joiningDate: '' }));
      }
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.jobRole.trim()) newErrors.jobRole = 'Job role is required';
    
    // Email validation
    if (formData.email.trim() && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    
    // Phone validation
    if (formData.phone.trim() && !/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'Phone should be 10 digits';
    }

    if (formData.alternatePhone && !/^\d{10}$/.test(formData.alternatePhone)) {
      newErrors.alternatePhone = 'Phone should be 10 digits';
    }

    if (formData.emergencyContact && !/^\d{10}$/.test(formData.emergencyContact)) {
      newErrors.emergencyContact = 'Phone should be 10 digits';
    }

    if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
      newErrors.panNumber = 'Invalid PAN number format';
    }

    if (formData.aadharNumber && !/^\d{12}$/.test(formData.aadharNumber)) {
      newErrors.aadharNumber = 'Aadhar should be 12 digits';
    }
    
    // Basic salary validation
    if (formData.basicSalary <= 0) {
      newErrors.basicSalary = 'Basic salary must be greater than zero';
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

  // Get name initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Avatar 
          sx={{ 
            width: 64, 
            height: 64, 
            bgcolor: 'primary.main',
            mr: 2
          }}
        >
          {formData.name ? getInitials(formData.name) : <PersonIcon />}
        </Avatar>
        <Box>
          <Typography variant="h5" fontWeight="bold">
            {initialData?.id ? 'Edit Staff Member' : 'Add New Staff Member'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {initialData?.id ? 'Update existing staff information' : 'Fill in the details to add a new staff member'}
          </Typography>
        </Box>
      </Box>

      {/* Section Navigation */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Chip 
          icon={<PersonIcon />} 
          label="Personal Details" 
          onClick={() => setActiveSection('personal')}
          color={activeSection === 'personal' ? 'primary' : 'default'}
          variant={activeSection === 'personal' ? 'filled' : 'outlined'}
          sx={{ fontWeight: activeSection === 'personal' ? 'bold' : 'normal' }}
        />
        <Chip 
          icon={<WorkIcon />} 
          label="Job Details" 
          onClick={() => setActiveSection('job')}
          color={activeSection === 'job' ? 'primary' : 'default'}
          variant={activeSection === 'job' ? 'filled' : 'outlined'}
          sx={{ fontWeight: activeSection === 'job' ? 'bold' : 'normal' }}
        />
        <Chip 
          icon={<HomeIcon />} 
          label="Address" 
          onClick={() => setActiveSection('address')}
          color={activeSection === 'address' ? 'primary' : 'default'}
          variant={activeSection === 'address' ? 'filled' : 'outlined'}
          sx={{ fontWeight: activeSection === 'address' ? 'bold' : 'normal' }}
        />
        <Chip 
          icon={<CreditCardIcon />} 
          label="Bank & Documents" 
          onClick={() => setActiveSection('bank')}
          color={activeSection === 'bank' ? 'primary' : 'default'}
          variant={activeSection === 'bank' ? 'filled' : 'outlined'}
          sx={{ fontWeight: activeSection === 'bank' ? 'bold' : 'normal' }}
        />
        <Chip 
          icon={<GroupIcon />} 
          label="Emergency Contact" 
          onClick={() => setActiveSection('emergency')}
          color={activeSection === 'emergency' ? 'primary' : 'default'}
          variant={activeSection === 'emergency' ? 'filled' : 'outlined'}
          sx={{ fontWeight: activeSection === 'emergency' ? 'bold' : 'normal' }}
        />
      </Box>
      
      {/* Personal Information */}
      {activeSection === 'personal' && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon /> Personal Information
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={!!errors.name}
                helperText={errors.name}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccountCircleIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={!!errors.phone}
                helperText={errors.phone}
                inputProps={{ maxLength: 10 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="Alternate Phone (Optional)"
                name="alternatePhone"
                value={formData.alternatePhone}
                onChange={handleChange}
                error={!!errors.alternatePhone}
                helperText={errors.alternatePhone}
                inputProps={{ maxLength: 10 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {/* Job Details */}
      {activeSection === 'job' && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WorkIcon /> Job Details
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <FormControl fullWidth error={!!errors.jobRole} required sx={{ minWidth: 200 }}>
                <InputLabel>Job Role</InputLabel>
                <Select
                  name="jobRole"
                  value={formData.jobRole}
                  onChange={handleSelectChange}
                  label="Job Role"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        minWidth: 200
                      }
                    }
                  }}
                >
                  {JOB_ROLES.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
                {errors.jobRole && <FormHelperText>{errors.jobRole}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Joining Date"
                  value={new Date(formData.joiningDate.seconds * 1000)}
                  onChange={handleDateChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.joiningDate,
                      helperText: errors.joiningDate,
                      required: true,
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
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <FormControl fullWidth required>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleSelectChange}
                  label="Status"
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                type="number"
                label="Basic Salary"
                name="basicSalary"
                value={formData.basicSalary}
                onChange={handleChange}
                error={!!errors.basicSalary}
                helperText={errors.basicSalary || "Monthly base salary amount"}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <MoneyIcon fontSize="small" color="action" />
                      ₹
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
              <Typography variant="body2" color="text.secondary" mt={2}>
                Note: Additional components like HRA, travel allowance, and incentives will be added when processing monthly salary.
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {/* Address Information */}
      {activeSection === 'address' && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HomeIcon /> Address Information
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <HomeIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
              <TextField
                fullWidth
                label="City"
                name="city"
                value={formData.city}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LocationCityIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
              <TextField
                fullWidth
                label="State"
                name="state"
                value={formData.state}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
              <TextField
                fullWidth
                label="Pincode"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                inputProps={{ maxLength: 6 }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {/* Bank and Document Information */}
      {activeSection === 'bank' && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CreditCardIcon /> Bank & Document Information
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="Bank Name"
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="Account Number"
                name="accountNumber"
                value={formData.accountNumber}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="IFSC Code"
                name="ifscCode"
                value={formData.ifscCode}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="PAN Number"
                name="panNumber"
                value={formData.panNumber}
                onChange={handleChange}
                error={!!errors.panNumber}
                helperText={errors.panNumber}
                inputProps={{ maxLength: 10 }}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="Aadhar Number"
                name="aadharNumber"
                value={formData.aadharNumber}
                onChange={handleChange}
                error={!!errors.aadharNumber}
                helperText={errors.aadharNumber}
                inputProps={{ maxLength: 12 }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}
      
      {/* Emergency Contact Information */}
      {activeSection === 'emergency' && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 2, borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)' }}>
          <Typography variant="subtitle1" fontWeight="bold" mb={2} color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupIcon /> Emergency Contact Information
          </Typography>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="Emergency Contact Name"
                name="emergencyName"
                value={formData.emergencyName}
                onChange={handleChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6' } }}>
              <TextField
                fullWidth
                label="Emergency Contact Number"
                name="emergencyContact"
                value={formData.emergencyContact}
                onChange={handleChange}
                error={!!errors.emergencyContact}
                helperText={errors.emergencyContact}
                inputProps={{ maxLength: 10 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </Paper>
      )}
      
      <Box display="flex" justifyContent="space-between" gap={2}>
        <Button
          variant="outlined"
          onClick={onCancel}
          sx={{ borderRadius: 1.5, px: 3 }}
        >
          Cancel
        </Button>

        <Box>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            sx={{ borderRadius: 1.5, px: 4 }}
          >
            {initialData?.id ? 'Update Staff' : 'Add Staff'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
} 