'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Typography,
  InputAdornment,
  Box,
  Paper,
  Divider,
  Autocomplete,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isValid } from 'date-fns';

// Product statuses
const STATUSES = ['In Stock', 'Sold', 'Reserved', 'Damaged'];

// Locations/branches
const LOCATIONS = ['Main Branch', 'North Branch', 'South Branch', 'East Branch', 'West Branch'];

// Product types
const PRODUCT_TYPES = [
  'Hearing Aid',
  'Accessory',
  'Battery',
  'Charger',
  'Remote Control',
  'Cleaning Kit',
  'Other',
];

// Interface for inventory item
interface InventoryItem {
  id?: string;
  productId: string;
  productName: string;
  serialNumber: string;
  type: string;
  company: string;
  location: string;
  status: 'In Stock' | 'Sold' | 'Reserved' | 'Damaged';
  dealerPrice: number;
  mrp: number;
  purchaseDate: any;
  purchaseInvoice: string;
  supplier: string;
  notes?: string;
}

interface InventoryItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: InventoryItem) => void;
  item?: InventoryItem;
  isEditing: boolean;
  products: { id: string; name: string; type: string; company: string; mrp: number }[];
}

const defaultItem: InventoryItem = {
  productId: '',
  productName: '',
  serialNumber: '',
  type: '',
  company: '',
  location: 'Main Branch',
  status: 'In Stock',
  dealerPrice: 0,
  mrp: 0,
  purchaseDate: new Date(),
  purchaseInvoice: '',
  supplier: '',
  notes: '',
};

export default function InventoryItemDialog({
  open,
  onClose,
  onSave,
  item,
  isEditing,
  products,
}: InventoryItemDialogProps) {
  const [formData, setFormData] = useState<InventoryItem>(defaultItem);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Initialize form with item data if editing
  useEffect(() => {
    if (item && isEditing) {
      setFormData({
        ...item,
      });
      
      if (item.purchaseDate) {
        const date = item.purchaseDate.toDate ? 
          item.purchaseDate.toDate() : 
          new Date(item.purchaseDate.seconds * 1000);
        setSelectedDate(date);
      }
    } else {
      setFormData(defaultItem);
      setSelectedDate(new Date());
    }
    
    // Clear errors when dialog opens
    setErrors({});
  }, [item, isEditing, open]);

  // Handle text input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric inputs
    if (name === 'dealerPrice' || name === 'mrp') {
      const numValue = parseFloat(value);
      setFormData(prev => ({
        ...prev,
        [name]: isNaN(numValue) ? 0 : numValue,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
    
    // Clear validation error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Handle select changes
  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear validation error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    // Auto-fill product details when a product is selected
    if (name === 'productId') {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        setFormData(prev => ({
          ...prev,
          productName: selectedProduct.name,
          type: selectedProduct.type,
          company: selectedProduct.company,
          mrp: selectedProduct.mrp,
          dealerPrice: Math.round(selectedProduct.mrp * 0.7), // Default dealer price as 70% of MRP
        }));
      }
    }
  };

  // Handle product selection through Autocomplete
  const handleProductSelect = (event: any, newValue: any) => {
    if (newValue) {
      setFormData(prev => ({
        ...prev,
        productId: newValue.id,
        productName: newValue.name,
        type: newValue.type,
        company: newValue.company,
        mrp: newValue.mrp,
        dealerPrice: Math.round(newValue.mrp * 0.7), // Default dealer price as 70% of MRP
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        productId: '',
        productName: '',
        type: '',
        company: '',
        mrp: 0,
        dealerPrice: 0,
      }));
    }
  };

  // Handle date change
  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
    if (date && isValid(date)) {
      setFormData(prev => ({
        ...prev,
        purchaseDate: date,
      }));
    }
    
    // Clear validation error for purchase date
    if (errors.purchaseDate) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.purchaseDate;
        return newErrors;
      });
    }
  };

  // Validate the form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.serialNumber.trim()) {
      newErrors.serialNumber = 'Serial number is required';
    }
    
    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
    }
    
    if (!formData.type) {
      newErrors.type = 'Type is required';
    }
    
    if (!formData.company.trim()) {
      newErrors.company = 'Company is required';
    }
    
    if (!formData.location) {
      newErrors.location = 'Location is required';
    }
    
    if (!formData.status) {
      newErrors.status = 'Status is required';
    }
    
    if (formData.dealerPrice <= 0) {
      newErrors.dealerPrice = 'Dealer price must be greater than 0';
    }
    
    if (formData.mrp <= 0) {
      newErrors.mrp = 'MRP must be greater than 0';
    }
    
    if (!formData.purchaseInvoice.trim()) {
      newErrors.purchaseInvoice = 'Purchase invoice is required';
    }
    
    if (!formData.supplier.trim()) {
      newErrors.supplier = 'Supplier is required';
    }
    
    if (!selectedDate) {
      newErrors.purchaseDate = 'Purchase date is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      onSave({
        ...formData,
        id: item?.id,
      });
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
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ 
        sx: { 
          borderRadius: 2,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
        } 
      }}
    >
      <DialogTitle>
        <Typography variant="h5" fontWeight={600}>
          {isEditing ? 'Edit Inventory Item' : 'Add New Inventory Item'}
        </Typography>
      </DialogTitle>
      
      <DialogContent dividers>
        <Box component="form" noValidate sx={{ mt: 1 }}>
          {/* Product Information Section */}
          <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} color="primary" gutterBottom>
              Product Information
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              {/* Product Selection (for adding new item) */}
              {!isEditing && (
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={products}
                    getOptionLabel={(option) => `${option.name} (${option.company})`}
                    onChange={handleProductSelect}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Product"
                        variant="outlined"
                        fullWidth
                        error={!!errors.productId}
                        helperText={errors.productId}
                      />
                    )}
                  />
                </Grid>
              )}
              
              <Grid item xs={12} md={isEditing ? 6 : 6}>
                <TextField
                  name="serialNumber"
                  label="Serial Number"
                  value={formData.serialNumber}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  required
                  error={!!errors.serialNumber}
                  helperText={errors.serialNumber}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  name="productName"
                  label="Product Name"
                  value={formData.productName}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  required
                  error={!!errors.productName}
                  helperText={errors.productName}
                  InputProps={{
                    readOnly: isEditing,
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!errors.type} required variant="outlined">
                  <InputLabel>Product Type</InputLabel>
                  <Select
                    name="type"
                    value={formData.type}
                    onChange={handleSelectChange}
                    label="Product Type"
                    disabled={isEditing}
                  >
                    {PRODUCT_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.type && <FormHelperText>{errors.type}</FormHelperText>}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  name="company"
                  label="Manufacturer/Company"
                  value={formData.company}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  required
                  error={!!errors.company}
                  helperText={errors.company}
                  InputProps={{
                    readOnly: isEditing,
                  }}
                />
              </Grid>
            </Grid>
          </Paper>
          
          {/* Pricing & Status Section */}
          <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} color="primary" gutterBottom>
              Pricing & Status
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  name="mrp"
                  label="MRP"
                  type="number"
                  value={formData.mrp}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  required
                  error={!!errors.mrp}
                  helperText={errors.mrp}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  name="dealerPrice"
                  label="Dealer Price"
                  type="number"
                  value={formData.dealerPrice}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  required
                  error={!!errors.dealerPrice}
                  helperText={errors.dealerPrice}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!errors.status} required variant="outlined">
                  <InputLabel>Status</InputLabel>
                  <Select
                    name="status"
                    value={formData.status}
                    onChange={handleSelectChange}
                    label="Status"
                  >
                    {STATUSES.map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={!!errors.location} required variant="outlined">
                  <InputLabel>Location</InputLabel>
                  <Select
                    name="location"
                    value={formData.location}
                    onChange={handleSelectChange}
                    label="Location"
                  >
                    {LOCATIONS.map((location) => (
                      <MenuItem key={location} value={location}>
                        {location}
                      </MenuItem>
                    ))}
                  </Select>
                  {errors.location && <FormHelperText>{errors.location}</FormHelperText>}
                </FormControl>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Purchase Information Section */}
          <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} color="primary" gutterBottom>
              Purchase Information
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  name="purchaseInvoice"
                  label="Purchase Invoice"
                  value={formData.purchaseInvoice}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  required
                  error={!!errors.purchaseInvoice}
                  helperText={errors.purchaseInvoice}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Purchase Date"
                    value={selectedDate}
                    onChange={handleDateChange}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        variant: 'outlined',
                        required: true,
                        error: !!errors.purchaseDate,
                        helperText: errors.purchaseDate,
                      }
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  name="supplier"
                  label="Supplier"
                  value={formData.supplier}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  required
                  error={!!errors.supplier}
                  helperText={errors.supplier}
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  name="notes"
                  label="Notes"
                  value={formData.notes || ''}
                  onChange={handleInputChange}
                  fullWidth
                  variant="outlined"
                  multiline
                  rows={3}
                />
              </Grid>
            </Grid>
          </Paper>
          
          {/* Summary */}
          <Box sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Summary</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">Product: <strong>{formData.productName || 'Not selected'}</strong></Typography>
                <Typography variant="body2">Serial #: <strong>{formData.serialNumber || 'Not provided'}</strong></Typography>
                <Typography variant="body2">Status: <strong>{formData.status || 'Not set'}</strong></Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">MRP: <strong>{formatCurrency(formData.mrp || 0)}</strong></Typography>
                <Typography variant="body2">Dealer Price: <strong>{formatCurrency(formData.dealerPrice || 0)}</strong></Typography>
                <Typography variant="body2">Location: <strong>{formData.location || 'Not set'}</strong></Typography>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined" color="primary">
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          sx={{ px: 3 }}
        >
          {isEditing ? 'Update' : 'Add'} Item
        </Button>
      </DialogActions>
    </Dialog>
  );
} 