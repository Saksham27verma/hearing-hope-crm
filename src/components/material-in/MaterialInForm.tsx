import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  InputAdornment,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormHelperText,
  Alert,
  Tooltip,
  Card,
  CardContent,
  LinearProgress,
  TableFooter,
  Stack,
} from '@mui/material';
import { Grid as MuiGrid } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon,
  Info as InfoIcon,
  CurrencyRupee as RupeeIcon,
  Receipt as ReceiptIcon,
  BusinessCenter as BusinessIcon,
  DateRange as DateRangeIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  QrCode as BarcodeIcon,
  Calculate as CalculateIcon,
  BarcodeReader as ScannerIcon,
  Preview as PreviewIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Summarize as SummarizeIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

// Product types for filtering
const PRODUCT_TYPES = ['Hearing Aid', 'Battery', 'Accessory', 'Charger', 'Remote Control', 'Cleaning Kit', 'Other'];

// Status options


// Company options
const COMPANY_OPTIONS = ['Hope Enterprises', 'HDIPL'];

// GST Type options
const GST_TYPES = ['LGST', 'IGST', 'GST Exempted'];

// Define the interface for products
interface Product {
  id: string;
  name: string;
  type: string;
  company: string;
  mrp: number;
  dealerPrice?: number;
  gstApplicable?: boolean;
  quantityType?: 'piece' | 'pair';
}

// Define the interface for parties (suppliers)
interface Party {
  id: string;
  name: string;
  category: string;
  gstType: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  gstNumber?: string;
}

// Define the interface for material products
interface MaterialProduct {
  productId: string;
  name: string;
  type: string;
  serialNumbers: string[];
  quantity: number;
  dealerPrice?: number;
  mrp?: number;
  discountPercent?: number;
  discountAmount?: number;
  finalPrice?: number;
  gstApplicable?: boolean;
  remarks?: string;
  quantityType?: 'piece' | 'pair';
}

// Define the interface for material inward
interface MaterialInward {
  id?: string;
  challanNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  company: string;
  products: MaterialProduct[];
  totalAmount: number;
  receivedDate: Timestamp;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  convertedToPurchase?: boolean;
  purchaseId?: string;
  purchaseInvoiceNo?: string;
}

// Define the props for the MaterialInForm component
interface MaterialInFormProps {
  initialData?: MaterialInward;
  products: Product[];
  parties: Party[];
  onSave: (material: MaterialInward) => void;
  onCancel: () => void;
}

// Define a Grid component that works with our props
const Grid = MuiGrid;

const MaterialInForm: React.FC<MaterialInFormProps> = ({
  initialData,
  products,
  parties,
  onSave,
  onCancel,
}) => {
  // Console logging to debug
  console.log("MaterialInForm received parties:", parties);
  console.log("Parties array length:", parties ? parties.length : 0);
  console.log("Parties array empty?", !parties || parties.length === 0);
  
  // Create some hardcoded test suppliers to see if Autocomplete works
  const testSuppliers = [
    { id: 'test1', name: 'Test Supplier 1', category: 'supplier', gstType: 'LGST', phone: '1234567890' },
    { id: 'test2', name: 'Test Supplier 2', category: 'supplier', gstType: 'IGST', phone: '2345678901' },
    { id: 'test3', name: 'Test Supplier 3', category: 'both', gstType: 'GST Exempted', phone: '3456789012' }
  ];
  
  // Combine real parties with test suppliers for testing
  const allParties = [...(parties || []), ...testSuppliers];
  
  // Steps for the form
  const steps = ['Challan Details', 'Product Details', 'Review & Summary'];
  
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [materialData, setMaterialData] = useState<MaterialInward>(
    initialData || {
      challanNumber: '',
      supplier: { id: '', name: '' },
      company: 'Hope Enterprises',
      products: [],
      totalAmount: 0,
      receivedDate: Timestamp.now(),

    }
  );
  
  // Preview mode state
  const [previewMode, setPreviewMode] = useState(false);
  
  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // State for product entry
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [serialNumber, setSerialNumber] = useState('');
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [dealerPrice, setDealerPrice] = useState(0);
  const [mrp, setMrp] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  const [remarks, setRemarks] = useState('');
  
  // Add a state variable for barcode scanner mode 
  const [scannerMode, setScannerMode] = useState(false);
  const serialInputRef = React.useRef<HTMLInputElement>(null);
  
  // filtered products state
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProductType, setSelectedProductType] = useState<string | null>(null);
  
  // Initialize form with initial data if provided
  useEffect(() => {
    if (initialData) {
      setMaterialData(initialData);
    }
    
    // Initialize filtered products
    setFilteredProducts(products);
  }, [initialData, products]);

  // Calculate grand total including GST
  const calculateGrandTotal = useMemo(() => {
    const subtotal = materialData.totalAmount;
    return subtotal;
  }, [materialData.totalAmount]);

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate discount percentage based on MRP and Dealer Price
  const calculateDiscountPercent = (mrp: number, dealerPrice: number): number => {
    if (mrp <= 0) return 0;
    return Math.round(((mrp - dealerPrice) / mrp) * 100);
  };

  // Calculate absolute discount amount (MRP - Dealer Price)
  const calculateDiscountAmount = (mrp: number, dealerPrice: number): number => {
    return Math.max(0, mrp - dealerPrice);
  };

  // Handle next step button
  const handleNext = () => {
    // Validate current step before proceeding
    if (activeStep === 0) {
      // Validate challan details
      const stepErrors: Record<string, string> = {};
      
      if (!materialData.challanNumber.trim()) {
        stepErrors.challanNumber = 'Challan number is required';
      }
      
      if (!materialData.supplier.id) {
        stepErrors.supplier = 'Supplier is required';
      }
      
      // If there are errors, show them and prevent proceeding
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        return;
      }
    } else if (activeStep === 1) {
      // Validate products
      if (materialData.products.length === 0) {
        setErrors({ products: 'At least one product is required' });
        return;
      }
    }
    
    // Clear any previous errors
    setErrors({});
    
    // Proceed to next step
    setActiveStep((prevStep) => prevStep + 1);
  };

  // Handle back button
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setErrors({});
  };

  // Handle basic challan details changes
  const handleDetailsChange = (field: string, value: any) => {
    setMaterialData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear any error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle supplier change
  const handleSupplierChange = (party: Party | null) => {
    if (party) {
      setMaterialData(prev => ({
        ...prev,
        supplier: {
          id: party.id,
          name: party.name
        }
      }));
      
      // Clear supplier error if exists
      if (errors.supplier) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.supplier;
          return newErrors;
        });
      }
    } else {
      // Reset supplier if null
      setMaterialData(prev => ({
        ...prev,
        supplier: {
          id: '',
          name: ''
        }
      }));
    }
  };

  // Handle filtering products by type
  const handleFilterByType = (type: string | null) => {
    setSelectedProductType(type);
    
    if (type) {
      setFilteredProducts(products.filter(product => product.type === type));
    } else {
      setFilteredProducts(products);
    }
    
    // Reset current product selection
    setCurrentProduct(null);
    setDealerPrice(0);
    setMrp(0);
    setSerialNumbers([]);
  };

  // Handle product selection
  const handleProductSelect = (product: Product | null) => {
    setCurrentProduct(product);
    if (product) {
      setMrp(product.mrp || 0);
      setDealerPrice(product.dealerPrice || 0);
      setSerialNumbers([]);
      
      // Set default quantity based on product type
      if (product.type === 'Hearing Aid') {
        setQuantity(1);
      } else {
        setQuantity(1);
      }
    } else {
      setMrp(0);
      setDealerPrice(0);
      setSerialNumbers([]);
      setQuantity(1);
    }
  };

  // Handle MRP change
  const handleMrpChange = (newMrp: number) => {
    setMrp(newMrp);
    if (newMrp > 0) {
      const discountPercent = calculateDiscountPercent(newMrp, dealerPrice);
      setDiscountPercent(discountPercent);
    }
  };

  // Handle dealer price change
  const handleDealerPriceChange = (newDealerPrice: number) => {
    setDealerPrice(newDealerPrice);
    if (mrp > 0) {
      const discountPercent = calculateDiscountPercent(mrp, newDealerPrice);
      setDiscountPercent(discountPercent);
    }
  };

  // Handle discount change
  const handleDiscountChange = (newDiscountPercent: number) => {
    setDiscountPercent(newDiscountPercent);
    if (mrp > 0) {
      // Calculate dealer price based on MRP and discount
      const newDealerPrice = mrp * (1 - newDiscountPercent / 100);
      setDealerPrice(Math.round(newDealerPrice));
    }
  };

  // Handle adding a serial number
  const handleAddSerialNumber = () => {
    if (serialNumber && !serialNumbers.includes(serialNumber)) {
      setSerialNumbers([...serialNumbers, serialNumber]);
      setSerialNumber('');
      
      // Auto-focus back to serial input in scanner mode
      if (scannerMode && serialInputRef.current) {
        setTimeout(() => {
          serialInputRef.current?.focus();
        }, 100);
      }
    }
  };

  // Handle removing a serial number
  const handleRemoveSerialNumber = (index: number) => {
    const newSerialNumbers = [...serialNumbers];
    newSerialNumbers.splice(index, 1);
    setSerialNumbers(newSerialNumbers);
  };

  // Handle adding product to material
  const handleAddProductToMaterial = () => {
    if (!currentProduct) {
      setErrors({ product: 'Please select a product' });
      return;
    }

    if (currentProduct.type === 'Hearing Aid' && serialNumbers.length === 0) {
      setErrors({ serialNumbers: 'Serial numbers are required for hearing aids' });
      return;
    }

    if (quantity <= 0) {
      setErrors({ quantity: 'Quantity must be greater than 0' });
      return;
    }

    // For hearing aids, check if quantity matches serial numbers count
    if (currentProduct.type === 'Hearing Aid' && quantity !== serialNumbers.length) {
      setErrors({ 
        serialNumbers: `Number of serial numbers (${serialNumbers.length}) does not match quantity (${quantity})`
      });
      return;
    }

    // Calculate discount amount and final price
    const discountAmount = calculateDiscountAmount(mrp, dealerPrice);
    const discountPercent = calculateDiscountPercent(mrp, dealerPrice);
    const finalPrice = dealerPrice; // Final price is the dealer price

    const newProduct: MaterialProduct = {
      productId: currentProduct.id,
      name: currentProduct.name,
      type: currentProduct.type,
      serialNumbers: [...serialNumbers],
      quantity,
      dealerPrice,
      mrp,
      discountPercent,
      discountAmount,
      finalPrice,
      quantityType: currentProduct.quantityType || 'piece',
      gstApplicable: currentProduct.gstApplicable,
      remarks
    };

    // Check if product already exists in the material with the same dealer price
    // Products with same ID but different dealer prices should be treated as separate entries
    const existingIndex = materialData.products.findIndex(p => 
      p.productId === currentProduct.id && 
      p.dealerPrice === dealerPrice
    );

    if (existingIndex >= 0) {
      // Update existing product with same dealer price
      const updatedProducts = [...materialData.products];
      
      // For non-hearing aids, we can just increase the quantity
      if (currentProduct.type !== 'Hearing Aid') {
        updatedProducts[existingIndex].quantity += quantity;
        // Merge serial numbers if any
        if (serialNumbers.length > 0) {
          updatedProducts[existingIndex].serialNumbers = [
            ...updatedProducts[existingIndex].serialNumbers,
            ...serialNumbers
          ];
        }
      } else {
        // For hearing aids, we need to add serial numbers
        updatedProducts[existingIndex].serialNumbers = [
          ...updatedProducts[existingIndex].serialNumbers,
          ...serialNumbers
        ];
        updatedProducts[existingIndex].quantity += quantity;
      }
      
      // Calculate new total amount
      const newTotalAmount = updatedProducts.reduce((sum, product) => {
        return sum + ((product.finalPrice || product.dealerPrice || 0) * product.quantity);
      }, 0);
      
      setMaterialData(prev => ({
        ...prev,
        products: updatedProducts,
        totalAmount: newTotalAmount
      }));
    } else {
      // Add new product (either new product ID or same ID with different dealer price)
      const updatedProducts = [...materialData.products, newProduct];
      
      // Calculate new total amount
      const newTotalAmount = updatedProducts.reduce((sum, product) => {
        return sum + ((product.finalPrice || product.dealerPrice || 0) * product.quantity);
      }, 0);
      
      setMaterialData(prev => ({
        ...prev,
        products: updatedProducts,
        totalAmount: newTotalAmount
      }));
    }

    // Reset product entry fields
    setCurrentProduct(null);
    setSerialNumbers([]);
    setSerialNumber('');
    setQuantity(1);
    setDealerPrice(0);
    setMrp(0);
    setDiscountPercent(0);
    setRemarks('');

    setErrors({});
  };

  // Handle removing a product from material
  const handleRemoveProduct = (index: number) => {
    const updatedProducts = [...materialData.products];
    updatedProducts.splice(index, 1);
    
    // Recalculate total amount
    const newTotalAmount = updatedProducts.reduce((sum, product) => {
      return sum + ((product.finalPrice || product.dealerPrice || 0) * product.quantity);
    }, 0);
    
    setMaterialData(prev => ({
      ...prev,
      products: updatedProducts,
      totalAmount: newTotalAmount
    }));
  };

  // Handle form submission
  const handleSubmit = () => {
    // Do final validation
    if (materialData.products.length === 0) {
      setErrors({ products: 'At least one product is required' });
      return;
    }
    
    // Call the onSave prop with the materialData
    onSave(materialData);
  };

  // Toggle preview mode
  const togglePreviewMode = () => {
    setPreviewMode(!previewMode);
  };

  // Toggle scanner mode
  const toggleScannerMode = () => {
    setScannerMode(!scannerMode);
    
    // Focus the serial input when entering scanner mode
    if (!scannerMode && serialInputRef.current) {
      setTimeout(() => {
        serialInputRef.current?.focus();
      }, 100);
    }
  };

  // Render the challan details
  const renderChallanDetails = () => (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <ReceiptIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="subtitle1" fontWeight={600} color="primary">
            Challan Information
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
            gap: 3
          }}
        >
          <Box>
            <TextField
              label="Challan Number"
              fullWidth
              value={materialData.challanNumber}
              onChange={(e) => handleDetailsChange('challanNumber', e.target.value)}
              error={!!errors.challanNumber}
              helperText={errors.challanNumber}
              required
              size="medium"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ReceiptIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          
          <Box>
            
          </Box>
          
          <Box>
            <Autocomplete
              options={allParties}
              getOptionLabel={(option) => option.name}
              value={allParties.find(p => p.id === materialData.supplier.id) || null}
              onChange={(_, newValue) => handleSupplierChange(newValue)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Supplier (Manufacturer)" 
                  error={!!errors.supplier}
                  helperText={errors.supplier}
                  required 
                  size="medium"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <BusinessIcon fontSize="small" color="action" />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Box>
          
          <Box>
            <FormControl fullWidth size="medium">
              <InputLabel>Company Billed To</InputLabel>
              <Select
                value={materialData.company}
                label="Company Billed To"
                onChange={(e) => handleDetailsChange('company', e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <BusinessIcon fontSize="small" color="action" />
                  </InputAdornment>
                }
              >
                {COMPANY_OPTIONS.map((company) => (
                  <MenuItem key={company} value={company}>
                    {company}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          <Box>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Received Date"
                value={
                  materialData.receivedDate instanceof Date
                    ? materialData.receivedDate
                    : new Date(materialData.receivedDate.seconds * 1000)
                }
                onChange={(newValue) => {
                  if (newValue) {
                    handleDetailsChange('receivedDate', Timestamp.fromDate(newValue));
                  }
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: "medium",
                    required: true,
                    error: !!errors.receivedDate,
                    helperText: errors.receivedDate,
                    InputProps: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <DateRangeIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }
                  }
                }}
              />
            </LocalizationProvider>
          </Box>
          
          <Box sx={{ gridColumn: '1 / -1' }}>
            <TextField
              label="Notes"
              value={materialData.notes || ''}
              onChange={(e) => handleDetailsChange('notes', e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="medium"
              placeholder="Add any additional notes or details about this material inward"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                    <InfoIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </Box>
      </Paper>
      
      {/* Quick Summary Card */}
      <Paper elevation={0} sx={{ p: 3, bgcolor: '#f5f5f5', borderRadius: 2 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <InfoIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="subtitle2" fontWeight={600} color="primary">
            Quick Summary
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography variant="body2">
              Challan: <strong>{materialData.challanNumber || 'Not specified'}</strong>
            </Typography>
            <Typography variant="body2">
              Supplier: <strong>{materialData.supplier.name || 'Not selected'}</strong>
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2">

            </Typography>
            <Typography variant="body2">
              Company: <strong>{materialData.company || 'Not selected'}</strong>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );

  // Render the product details form
  const renderProductDetails = () => (
    <Box>
      {/* Product selection form - Improved UI */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <AddIcon color="primary" sx={{ mr: 1.5 }} />
            <Typography variant="h6" fontWeight={600} color="primary">
              Add Product to Material
            </Typography>
          </Box>
          
          {/* Error message if any */}
          {errors.productEntry && (
            <Alert 
              severity="error" 
              variant="outlined" 
              sx={{ mt: 0, ml: 2, py: 0 }}
              action={
                <IconButton
                  size="small"
                  onClick={() => setErrors(prev => ({ ...prev, productEntry: '' }))}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              {errors.productEntry}
            </Alert>
          )}
          
          <Tooltip title={scannerMode ? "Exit Scanner Mode" : "Enter Scanner Mode"}>
            <Button
              variant={scannerMode ? "contained" : "outlined"}
              color={scannerMode ? "secondary" : "primary"}
              size="small"
              startIcon={<QrCodeScannerIcon />}
              onClick={toggleScannerMode}
            >
              {scannerMode ? "Exit Scanner Mode" : "Scanner Mode"}
            </Button>
          </Tooltip>
        </Box>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Product Type Filter Chips */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
              <FilterListIcon fontSize="small" sx={{ mr: 0.5 }} /> Quick Filter:
            </Typography>
            {PRODUCT_TYPES.map((type) => (
              <Chip
                key={type}
                label={type}
                onClick={() => handleFilterByType(type)}
                color={selectedProductType === type ? "primary" : "default"}
                variant={selectedProductType === type ? "filled" : "outlined"}
                size="small"
                sx={{ borderRadius: 1 }}
              />
            ))}
            
            {selectedProductType && (
              <Chip
                label="Clear Filter"
                onClick={() => handleFilterByType(null)}
                variant="outlined"
                size="small"
                color="secondary"
                sx={{ borderRadius: 1 }}
              />
            )}
          </Box>
          
          {/* Step 1: Select Product - Enhanced with search */}
          <Box>
            <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, mb: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Step 1: Select Product
              </Typography>
              <Autocomplete
                options={filteredProducts}
                getOptionLabel={(option) => `${option.name} (${option.type})`}
                groupBy={(option) => option.type}
                value={currentProduct}
                onChange={(_, newValue) => handleProductSelect(newValue)}
                renderInput={(params) => (
                  <TextField {...params} 
                    label="Search Product" 
                    size="medium" 
                    fullWidth 
                    error={!!errors.product}
                    helperText={errors.product}
                    placeholder="Type to search by name or type..."
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <SearchIcon color="action" />
                          </InputAdornment>
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="body1" fontWeight="medium">{option.name}</Typography>
                      <Box display="flex" justifyContent="space-between" width="100%">
                        <Typography variant="caption" color="text.secondary">
                          {option.type}
                        </Typography>
                        <Typography variant="caption" fontWeight="medium" color="primary">
                          MRP: {formatCurrency(option.mrp)}
                        </Typography>
                      </Box>
                    </Box>
                  </li>
                )}
              />
            </Box>
          </Box>

          {currentProduct && (
            <>
              {/* Current Product Card - Visual confirmation of selection */}
              <Paper 
                elevation={0}
                sx={{ 
                  p: 2, 
                  border: '1px solid', 
                  borderColor: 'primary.light',
                  borderRadius: 2,
                  bgcolor: 'primary.lighter',
                  mb: 2
                }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight="medium" color="primary.dark">
                    {currentProduct.name}
                  </Typography>
                  <Chip 
                    label={currentProduct.type} 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {currentProduct.company} 
                  {currentProduct.type === 'Hearing Aid' && 
                    ` • ${currentProduct.quantityType === 'pair' ? 'Sold in pairs' : 'Sold individually'}`
                  }
                </Typography>
                <Box display="flex" justifyContent="space-between" mt={1}>
                  <Typography variant="body2">
                    <strong>MRP:</strong> {formatCurrency(currentProduct.mrp)}
                  </Typography>
                  {currentProduct.dealerPrice && (
                    <Typography variant="body2">
                      <strong>Dealer Price:</strong> {formatCurrency(currentProduct.dealerPrice)}
                    </Typography>
                  )}
                </Box>
              </Paper>
              
              {/* Step 2: Enter Quantity and Price Details - Improved layout */}
              <Box>
                <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, mb: 2 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <CalculateIcon fontSize="small" sx={{ mr: 1 }} />
                    Step 2: Enter Quantity and Pricing
                  </Typography>
                  
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, 
                    gap: 2 
                  }}>
                    <Box>
                      <TextField
                        label="Quantity"
                        fullWidth
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                        error={!!errors.quantity}
                        helperText={errors.quantity}
                        disabled={currentProduct?.type === 'Hearing Aid' && serialNumbers.length > 0}
                        InputProps={{ 
                          inputProps: { min: 1 },
                          startAdornment: (
                            <InputAdornment position="start">
                              <Typography variant="caption" color="text.secondary">#</Typography>
                            </InputAdornment>
                          ),
                        }}
                        size="medium"
                      />
                    </Box>
                    
                    <Box>
                      <TextField
                        label="Dealer Price"
                        fullWidth
                        type="number"
                        value={dealerPrice}
                        onChange={(e) => handleDealerPriceChange(parseFloat(e.target.value) || 0)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <RupeeIcon fontSize="small" color="action" />
                            </InputAdornment>
                          ),
                          inputProps: { min: 0 },
                        }}
                        size="medium"
                      />
                      {mrp > 0 && dealerPrice > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Saves {formatCurrency(calculateDiscountAmount(mrp, dealerPrice))}
                        </Typography>
                      )}
                    </Box>
                    
                    <Box>
                      <TextField
                        label="MRP"
                        fullWidth
                        type="number"
                        value={mrp}
                        onChange={(e) => handleMrpChange(parseFloat(e.target.value) || 0)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <RupeeIcon fontSize="small" color="action" />
                            </InputAdornment>
                          ),
                          inputProps: { min: 0 },
                        }}
                        size="medium"
                      />
                      {mrp > 0 && dealerPrice > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Discount: {calculateDiscountPercent(mrp, dealerPrice)}%
                        </Typography>
                      )}
                    </Box>
                    
                    <Box>
                      <TextField
                        label="Discount %"
                        fullWidth
                        type="number"
                        value={discountPercent}
                        onChange={(e) => handleDiscountChange(parseFloat(e.target.value) || 0)}
                        InputProps={{
                          inputProps: { min: 0, max: 100 },
                          startAdornment: (
                            <InputAdornment position="start">
                              <CalculateIcon fontSize="small" color="action" />
                            </InputAdornment>
                          ),
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        }}
                        size="medium"
                      />
                    </Box>
                    

                    
                    <Box sx={{ gridColumn: { xs: '1', sm: '1 / -1' } }}>
                      <TextField
                        label="Remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        size="medium"
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                              <InfoIcon fontSize="small" color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Step 3: Serial Numbers for Hearing Aids */}
              {currentProduct?.type === 'Hearing Aid' && (
                <Box>
                  <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, mb: 2, border: errors.serialNumbers ? '1px solid #d32f2f' : 'none' }}>
                    <Typography variant="subtitle2" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                      <BarcodeIcon fontSize="small" sx={{ mr: 1 }} />
                      Step 3: Enter Serial Numbers {scannerMode && "(Scanner Mode Active)"}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', mb: 2 }}>
                      <TextField
                        label="Serial Number"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        inputRef={serialInputRef}
                        fullWidth
                        size="medium"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSerialNumber();
                          }
                        }}
                        error={!!errors.serialNumbers}
                        helperText={errors.serialNumbers}
                        sx={{ mr: 1 }}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <QrCodeScannerIcon fontSize="small" color="action" />
                            </InputAdornment>
                          ),
                        }}
                      />
                      <Button
                        variant="contained"
                        onClick={handleAddSerialNumber}
                        disabled={!serialNumber}
                        sx={{ minWidth: '120px' }}
                      >
                        Add
                      </Button>
                    </Box>
                    
                    {serialNumbers.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                          Added Serial Numbers: {serialNumbers.length}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {serialNumbers.map((sn, index) => (
                            <Chip
                              key={index}
                              label={sn}
                              onDelete={() => handleRemoveSerialNumber(index)}
                              color="primary"
                              variant="outlined"
                              sx={{ m: 0.5 }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            {currentProduct && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" mr={1}>Final Price:</Typography>
                <Typography variant="body1" fontWeight="medium">
                                            {formatCurrency(dealerPrice)}
                </Typography>
              </Box>
            )}
          </Box>
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleAddProductToMaterial}
            startIcon={<AddIcon />}
            disabled={!currentProduct}
          >
            Add to Material
          </Button>
        </Box>
      </Paper>
      
      {/* Added Products List */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: '#f8f9fa' }}>
        <Box display="flex" alignItems="center" mb={2}>
          <SummarizeIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="subtitle1" fontWeight={600} color="primary">
            Added Products
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        
        {materialData.products.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No products added yet. Add products using the form above.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="center">Quantity</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Discount</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {materialData.products.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" gutterBottom>{product.name}</Typography>
                        <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 0.5 }}>
                          Dealer Price: {formatCurrency(product.dealerPrice || 0)}
                        </Typography>
                        {product.serialNumbers.length > 0 && (
                          <Typography variant="caption" color="textSecondary" display="block">
                            {product.serialNumbers.length} serial(s)
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{product.type}</TableCell>
                    <TableCell align="center">{product.quantity} {product.quantityType}</TableCell>
                    <TableCell align="right">{formatCurrency(product.dealerPrice || 0)}</TableCell>
                    <TableCell align="right">
                      {product.discountPercent ? `${product.discountPercent}%` : '-'}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(
                      ((product.finalPrice || product.dealerPrice || 0) * product.quantity)
                    )}</TableCell>
                    <TableCell align="center">
                      <IconButton 
                        color="error" 
                        size="small" 
                        onClick={() => handleRemoveProduct(index)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                
                <TableRow>
                  <TableCell colSpan={5} align="right">
                    <Typography variant="subtitle1">Total Amount:</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle1">
                      {formatCurrency(materialData.totalAmount)}
                    </Typography>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
        
        {errors.products && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errors.products}
          </Alert>
        )}
      </Paper>
    </Box>
  );

  // Render the summary screen
  const renderSummary = () => (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <ReceiptIcon color="primary" sx={{ mr: 1.5 }} />
            <Typography variant="subtitle1" fontWeight={600} color="primary">
              Material Challan Summary
            </Typography>
          </Box>
          <Button
            variant={previewMode ? "contained" : "outlined"}
            color="info"
            size="small"
            startIcon={<PreviewIcon />}
            onClick={togglePreviewMode}
            sx={{ borderRadius: 2 }}
          >
            {previewMode ? "Exit Preview" : "Preview Material"}
          </Button>
        </Box>
        <Divider sx={{ mb: 3 }} />
        
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
            gap: 4
          }}
        >
          <Box>
            <Typography variant="subtitle2" gutterBottom color="primary">Challan Details</Typography>
            <Box sx={{ pl: 2, mb: 3 }}>
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Challan Number:</Typography>
                  <Typography variant="body2" fontWeight="medium">{materialData.challanNumber}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Received Date:</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {format(new Date(materialData.receivedDate.seconds * 1000), 'dd MMM yyyy')}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Supplier:</Typography>
                  <Typography variant="body2" fontWeight="medium">{materialData.supplier.name}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Company:</Typography>
                  <Typography variant="body2" fontWeight="medium">{materialData.company}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">

                </Box>
              </Stack>
            </Box>
          </Box>
          
          <Box>
            <Typography variant="subtitle2" gutterBottom color="primary">Material Totals</Typography>
            <Box sx={{ pl: 2, mb: 3 }}>
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Products:</Typography>
                  <Typography variant="body2" fontWeight="medium">{materialData.products.length}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Items:</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {materialData.products.reduce((sum, p) => sum + p.quantity, 0)}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Amount:</Typography>
                  <Typography variant="body2" fontWeight="medium">{formatCurrency(materialData.totalAmount)}</Typography>
                </Box>
                
                {materialData.notes && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">Notes:</Typography>
                    <Typography variant="body2" sx={{ mt: 1, bgcolor: '#eef2f6', p: 1, borderRadius: 1 }}>
                      {materialData.notes}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Paper>
      
      <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box p={2} bgcolor="#f5f5f5">
          <Typography variant="subtitle2" fontWeight="medium">
            Products in this Material
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="center">Quantity</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="center">Discount</TableCell>
                <TableCell align="right">Final Price</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {materialData.products.map((product, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium" gutterBottom>
                      {product.name}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}>
                      Dealer Price: {formatCurrency(product.dealerPrice || 0)}
                    </Typography>
                    {product.serialNumbers.length > 0 && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                        {product.serialNumbers.length} serial number(s)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {product.quantity} {product.quantityType || 'pcs'}
                  </TableCell>
                  <TableCell align="right">{formatCurrency(product.dealerPrice || 0)}</TableCell>
                  <TableCell align="center">{product.discountPercent ? `${product.discountPercent}%` : '-'}</TableCell>
                  <TableCell align="right">{formatCurrency(product.finalPrice || product.dealerPrice || 0)}</TableCell>
                  <TableCell align="right">{formatCurrency((product.finalPrice || product.dealerPrice || 0) * product.quantity)}</TableCell>
                </TableRow>
              ))}
              
              {/* Total row */}
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell colSpan={4} />
                <TableCell align="right">
                  <Typography variant="subtitle2">Total Amount</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="subtitle2">{formatCurrency(materialData.totalAmount)}</Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* Serial Numbers Section - Show if there are any serial numbers */}
      {materialData.products.some(p => p.serialNumbers && p.serialNumbers.length > 0) && (
        <Paper elevation={0} sx={{ p: 3, mt: 3, borderRadius: 2, bgcolor: '#f8f9fa' }}>
          <Typography variant="subtitle1" fontWeight={600} color="primary" gutterBottom>
            Serial Numbers
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            {materialData.products
              .filter(p => p.serialNumbers && p.serialNumbers.length > 0)
              .map((product, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>{product.name}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {product.serialNumbers.map((serial, idx) => (
                      <Chip key={idx} label={serial} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Paper>
              ))}
          </Box>
        </Paper>
      )}
      
      <Box sx={{ p: 3, mt: 3, bgcolor: '#f5f5f5', borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Please review all details carefully before saving this material challan.
          Once saved, it will be recorded in the system and can be converted to a purchase later.
        </Typography>
      </Box>
    </Box>
  );

  // Render the preview mode (print-friendly view)
  const renderPreview = () => (
    <Box sx={{ 
      p: 4, 
      backgroundColor: 'white',
      '@media print': {
        p: 0
      }
    }}>
      {materialData.convertedToPurchase && (
        <Box 
          sx={{ 
            p: 2, 
            mb: 3, 
            backgroundColor: 'rgba(211, 47, 47, 0.05)', 
            border: '1px solid rgba(211, 47, 47, 0.3)', 
            borderRadius: 2,
            '@media print': {
              border: '1px solid #ddd',
              backgroundColor: '#f8f8f8'
            }
          }}
        >
          <Typography variant="subtitle2" color="error">
            This Delivery Challan has been converted to Purchase Invoice #{materialData.purchaseInvoiceNo}
          </Typography>
        </Box>
      )}
      
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 3 
      }}>
        <Box>
          <Typography variant="h5" gutterBottom>
            {materialData.company}
          </Typography>
          <Typography variant="body2">
            Material Inward Challan
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h6" gutterBottom>
            Challan #{materialData.challanNumber}
          </Typography>
          <Typography variant="body2">
            Date: {format(new Date(materialData.receivedDate.seconds * 1000), 'dd MMM yyyy')}
          </Typography>
        </Box>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, 
          gap: 3,
          mb: 4
        }}
      >
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Supplier Information:
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>{materialData.supplier.name}</strong>
          </Typography>
        </Box>
        
        <Box>

          
          {materialData.notes && (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                Notes:
              </Typography>
              <Typography variant="body2" gutterBottom>
                {materialData.notes}
              </Typography>
            </>
          )}
        </Box>
      </Box>
      
      <Typography variant="subtitle2" gutterBottom>
        Product Details:
      </Typography>
      
      <TableContainer sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Price</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Discount</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materialData.products.map((product, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Box>
                    <Typography variant="body2" gutterBottom>{product.name}</Typography>
                    <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 0.5 }}>
                      Dealer Price: {formatCurrency(product.dealerPrice || 0)}
                    </Typography>
                    {product.serialNumbers.length > 0 && (
                      <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                        SN: {product.serialNumbers.join(', ')}
                      </Typography>
                    )}
                    {product.remarks && (
                      <Typography variant="caption" display="block">
                        Remarks: {product.remarks}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>{product.type}</TableCell>
                <TableCell align="center">{product.quantity} {product.quantityType}</TableCell>
                <TableCell align="right">{formatCurrency(product.dealerPrice || 0)}</TableCell>
                <TableCell align="right">
                  {product.discountPercent ? `${product.discountPercent}%` : '-'}
                </TableCell>
                <TableCell align="right">{formatCurrency(
                  ((product.finalPrice || product.dealerPrice || 0) * product.quantity)
                )}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} align="right" sx={{ fontWeight: 'bold' }}>
                Total Amount:
              </TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(materialData.totalAmount)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
      
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, 
          gap: 8,
          mt: 4
        }}
      >
        <Box sx={{ borderTop: '1px solid #ddd', pt: 1, mt: 6 }}>
          <Typography variant="body2" align="center">
            Received By (Signature)
          </Typography>
        </Box>
        
        <Box sx={{ borderTop: '1px solid #ddd', pt: 1, mt: 6 }}>
          <Typography variant="body2" align="center">
            Authorized Signature
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  // Main render
  return (
    <Box>
      {previewMode ? (
        <Box>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              startIcon={<CloseIcon />}
              onClick={togglePreviewMode}
            >
              Exit Preview
            </Button>
            
            <Button
              variant="contained"
              color="primary"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </Box>
          
          {renderPreview()}
        </Box>
      ) : (
        <>
          {/* Conversion status banner */}
          {materialData.convertedToPurchase && (
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                mb: 3, 
                backgroundColor: 'rgba(211, 47, 47, 0.1)', 
                border: '1px solid rgba(211, 47, 47, 0.3)', 
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Box display="flex" alignItems="center">
                <InfoIcon color="error" sx={{ mr: 1.5 }} />
                <Box>
                  <Typography variant="subtitle2" color="error">
                    This Delivery Challan has been converted to a Purchase
                  </Typography>
                  <Typography variant="body2">
                    Invoice Number: <strong>{materialData.purchaseInvoiceNo}</strong>
                  </Typography>
                </Box>
              </Box>
              <Button 
                variant="outlined" 
                color="error" 
                size="small"
                onClick={() => window.open(`/purchases?invoice=${materialData.purchaseInvoiceNo}`, '_blank')}
              >
                View Purchase
              </Button>
            </Paper>
          )}
          
          {/* Stepper */}
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          
          {/* Form content based on active step */}
          <Box sx={{ mb: 4 }}>
            {activeStep === 0 && renderChallanDetails()}
            {activeStep === 1 && renderProductDetails()}
            {activeStep === 2 && renderSummary()}
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2 }}>
            <Button
              variant="outlined"
              disabled={activeStep === 0}
              onClick={handleBack}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Box>
              <Button 
                variant="outlined" 
                onClick={onCancel} 
                sx={{ mr: 1 }}
              >
                Cancel
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleSubmit}
                  startIcon={<ReceiptIcon />}
                >
                  Complete Material
                </Button>
              ) : (
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleNext}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default MaterialInForm; 