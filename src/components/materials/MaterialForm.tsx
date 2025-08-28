import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid as MuiGrid,
  Autocomplete,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Divider,
  Stack,
  Chip,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
  FormHelperText,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Calculate as CalculateIcon,
  Receipt as ReceiptIcon,
  Business as BusinessIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Summarize as SummarizeIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';

// Product types for filtering
const PRODUCT_TYPES = ['Hearing Aid', 'Battery', 'Accessory', 'Charger', 'Remote Control', 'Cleaning Kit', 'Other'];

// GST Type options
const GST_TYPES = ['LGST', 'IGST', 'GST Exempted'];

// Company options
const COMPANY_OPTIONS = ['Hope Enterprises', 'HDIPL'];

interface MaterialProduct {
  productId: string;
  name: string;
  type: string;
  serialNumbers: string[];
  quantity: number;
  dealerPrice: number;
  mrp: number;
  discountPercent?: number;
  discountAmount?: number;
  finalPrice?: number;
  gstApplicable?: boolean;
  quantityType?: 'piece' | 'pair';
}

interface Material {
  id?: string;
  challanNumber: string;
  party: {
    id: string;
    name: string;
  };
  company: string;
  products: MaterialProduct[];
  gstType: string;
  gstPercentage: number;
  totalAmount: number;
  reference?: string;
  challanFile?: string;
  receivedDate: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  convertedToPurchase?: boolean;
  purchaseId?: string;
  purchaseInvoiceNo?: string;
}

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

interface Party {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstType?: string;
  gstNumber?: string;
  paymentTerms?: string;
  contactPerson?: string;
  category: 'supplier' | 'customer' | 'both';
}

interface MaterialFormProps {
  initialData?: Material;
  products: Product[];
  parties: Party[];
  onSave: (material: Material) => void;
  onCancel: () => void;
}

// Define a Grid component that works with our props
const Grid = MuiGrid;

const MaterialForm: React.FC<MaterialFormProps> = ({
  initialData,
  products,
  parties,
  onSave,
  onCancel,
}) => {
  // Steps for the form
  const steps = ['Challan Details', 'Product Details', 'Review & Summary'];
  
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [materialData, setMaterialData] = useState<Material>(
    initialData || {
    challanNumber: '',
    party: { id: '', name: '' },
    company: 'Hope Enterprises',
    products: [],
    gstType: 'LGST',
    gstPercentage: 18,
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
  
  // Add a state variable for barcode scanner mode 
  const [scannerMode, setScannerMode] = useState(false);
  const serialInputRef = React.useRef<HTMLInputElement>(null);
  
  // filtered products state
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  
  // Initialize form with initial data if provided
  useEffect(() => {
    if (initialData) {
      setMaterialData(initialData);
    }
    
    // Initialize filtered products
      setFilteredProducts(products);
  }, [initialData, products]);

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const calculateDiscount = (price: number, percent: number): number => {
    return (price * percent) / 100;
  };
  
  const calculateFinalPrice = (price: number, percent: number): number => {
    return price - calculateDiscount(price, percent);
  };
  
  // Navigation handlers
  const handleNext = () => {
    // Validate current step
    if (activeStep === 0) {
      // Validate challan details
      const validationErrors: Record<string, string> = {};
      
      if (!materialData.challanNumber) {
        validationErrors.challanNumber = 'Challan number is required';
      }
      
      if (!materialData.party.id) {
        validationErrors.party = 'Supplier is required';
      }
      
      if (!materialData.company) {
        validationErrors.company = 'Company is required';
      }
      
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }
    
    if (activeStep === 1 && materialData.products.length === 0) {
      setErrors({ products: 'Add at least one product before proceeding' });
      return;
    }
    
    setErrors({});
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };
  
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };
  
  // Form field handlers
  const handleChallanDetailsChange = (field: string, value: any) => {
    setMaterialData(prevData => ({
      ...prevData,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };
  
  const handlePartyChange = (party: Party | null) => {
    if (party) {
      setMaterialData(prevData => ({
        ...prevData,
        party: {
          id: party.id,
          name: party.name
        },
        gstType: party.gstType || 'LGST'
      }));
      
      if (errors.party) {
        setErrors(prev => {
          const updated = { ...prev };
          delete updated.party;
          return updated;
        });
      }
    }
  };
  
  const handleProductSelect = (product: Product | null) => {
    setCurrentProduct(product);
    setSerialNumbers([]);
    setQuantity(1);
    
    if (product) {
      setDealerPrice(product.dealerPrice || 0);
      setMrp(product.mrp);
      setDiscountPercent(0);
      
      // For hearing aids, add the appropriate number of serial number fields
      if (product.type === 'Hearing Aid') {
        if (product.quantityType === 'pair') {
          setSerialNumbers(Array(2).fill(''));
        } else {
          setSerialNumbers(['']);
        }
      }
    }
  };
  
  const handleMrpChange = (newMrp: number) => {
    setMrp(newMrp);
    
    // If dealer price is higher than MRP, adjust it
    if (dealerPrice > newMrp) {
      setDealerPrice(newMrp);
    }
  };
  
  const handleDealerPriceChange = (newDealerPrice: number) => {
    setDealerPrice(newDealerPrice);
    
    // If MRP is lower than dealer price, adjust it
    if (mrp < newDealerPrice) {
      setMrp(newDealerPrice);
    }
  };
  
  const handleDiscountChange = (newDiscountPercent: number) => {
    setDiscountPercent(Math.min(100, Math.max(0, newDiscountPercent)));
  };
  
  // Serial number handlers
  const handleAddSerialNumber = () => {
    setSerialNumbers(prev => [...prev, '']);
  };
  
  const handleSerialNumberChange = (index: number, value: string) => {
    const updatedSerialNumbers = [...serialNumbers];
    updatedSerialNumbers[index] = value;
    setSerialNumbers(updatedSerialNumbers);
  };
  
  const handleRemoveSerialNumber = (index: number) => {
    const updatedSerialNumbers = [...serialNumbers];
    updatedSerialNumbers.splice(index, 1);
    setSerialNumbers(updatedSerialNumbers);
  };
  
  // Handle adding a product to the material
  const handleAddProductToMaterial = () => {
    if (!currentProduct) {
      return;
    }

    // Validation
    const validationErrors: string[] = [];
    
    if (quantity <= 0) {
      validationErrors.push('Quantity must be greater than zero');
    }
    
    if (dealerPrice <= 0) {
      validationErrors.push('Dealer price must be greater than zero');
    }
    
    if (currentProduct.type === 'Hearing Aid' && serialNumbers.length === 0) {
      validationErrors.push('At least one serial number is required for hearing aids');
    }
    
    if (currentProduct.type === 'Hearing Aid' && 
        currentProduct.quantityType === 'pair' && 
        quantity * 2 !== serialNumbers.length) {
      validationErrors.push(`For pairs of hearing aids, you need ${quantity * 2} serial numbers (${quantity} pairs)`);
    }
    
    if (currentProduct.type === 'Hearing Aid' && 
        (!currentProduct.quantityType || currentProduct.quantityType === 'piece') && 
        quantity !== serialNumbers.length) {
      validationErrors.push(`Number of serial numbers (${serialNumbers.length}) must match quantity (${quantity})`);
    }
    
    if (validationErrors.length > 0) {
      setErrors({
        ...errors,
        productEntry: validationErrors.join(', ')
      });
      return;
    }

    // Calculate final price after discount
    const discountAmount = calculateDiscount(dealerPrice, discountPercent);
    const finalPrice = calculateFinalPrice(dealerPrice, discountPercent);
    const total = finalPrice * quantity;
    
    // New product entry
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
      gstApplicable: currentProduct.gstApplicable,
      quantityType: currentProduct.quantityType,
    };
    
    // Add product to material data
    const updatedProducts = [...materialData.products, newProduct];
    
    // Calculate new total
    const totalAmount = updatedProducts.reduce((total, product) => {
      return total + (product.finalPrice || product.dealerPrice) * product.quantity;
    }, 0);
    
    setMaterialData((prev) => ({
      ...prev,
      products: updatedProducts,
      totalAmount
    }));
    
    // Reset product form
    setCurrentProduct(null);
    setSerialNumbers([]);
    setQuantity(1);
    setDealerPrice(0);
    setMrp(0);
    setDiscountPercent(0);
    setErrors({});
  };
  
  // Handle removing a product from the material
  const handleRemoveProduct = (index: number) => {
    const updatedProducts = [...materialData.products];
    updatedProducts.splice(index, 1);
    
    // Recalculate total
    const totalAmount = updatedProducts.reduce((total, product) => {
      return total + (product.finalPrice || product.dealerPrice) * product.quantity;
    }, 0);
    
    setMaterialData((prev) => ({
      ...prev,
      products: updatedProducts,
      totalAmount
    }));
  };
  
  // Handle form submission
  const handleSubmit = () => {
    onSave(materialData);
  };
  
  // Toggle preview mode
  const togglePreviewMode = () => {
    setPreviewMode(!previewMode);
  };
  
  // Toggle scanner mode
  const toggleScannerMode = () => {
    setScannerMode(!scannerMode);
    
    // Focus on the serial input after toggling scanner mode on
    if (!scannerMode && serialInputRef.current) {
      setTimeout(() => {
        serialInputRef.current?.focus();
      }, 100);
    }
  };

  // Render the challan details step
  const renderChallanDetails = () => (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <ReceiptIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6" fontWeight={600} color="primary">
            Challan Information
          </Typography>
        </Box>
        
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
              onChange={(e) => handleChallanDetailsChange('challanNumber', e.target.value)}
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
            <FormControl fullWidth error={!!errors.gstType} size="medium">
              <InputLabel>GST Type</InputLabel>
              <Select
                value={materialData.gstType}
                label="GST Type"
                onChange={(e) => handleChallanDetailsChange('gstType', e.target.value)}
              >
                {GST_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
              {errors.gstType && <FormHelperText>{errors.gstType}</FormHelperText>}
            </FormControl>
          </Box>
          
          <Box>
            <Autocomplete
              options={parties}
              getOptionLabel={(option) => option.name}
              value={parties.find(p => p.id === materialData.party.id) || null}
              onChange={(_, newValue) => handlePartyChange(newValue)}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="Supplier (Manufacturer)" 
                  error={!!errors.party}
                  helperText={errors.party}
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
            <FormControl fullWidth error={!!errors.company} size="medium">
              <InputLabel>Company Billed To</InputLabel>
              <Select
                value={materialData.company}
                label="Company Billed To"
                onChange={(e) => handleChallanDetailsChange('company', e.target.value)}
              >
                {COMPANY_OPTIONS.map((company) => (
                  <MenuItem key={company} value={company}>
                    {company}
                  </MenuItem>
                ))}
              </Select>
              {errors.company && <FormHelperText>{errors.company}</FormHelperText>}
            </FormControl>
          </Box>
          
          <Box>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Challan Date"
                value={new Date(materialData.receivedDate.seconds * 1000)}
                onChange={(newValue) => {
                  if (newValue) {
                    handleChallanDetailsChange('receivedDate', Timestamp.fromDate(newValue));
                  }
                }}
                slotProps={{ 
                  textField: { 
                    fullWidth: true,
                    required: true,
                    error: !!errors.receivedDate,
                    helperText: errors.receivedDate,
                  } 
                }}
              />
            </LocalizationProvider>
          </Box>
          
          <Box>
            <TextField
              label="Reference"
              fullWidth
              placeholder="Optional reference, e.g., challan ID, order number, etc."
              value={materialData.reference || ''}
              onChange={(e) => handleChallanDetailsChange('reference', e.target.value)}
              size="medium"
            />
          </Box>
        </Box>
      </Paper>
      
      {/* Add additional information section for attachment if needed */}
      {/* <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Attachment color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6" fontWeight={600} color="primary">
            Attachments (Optional)
          </Typography>
        </Box>
        
                <TextField
                  fullWidth
          label="Challan File URL"
          placeholder="Link to the scanned challan document, if any"
          value={materialData.challanFile || ''}
          onChange={(e) => handleChallanDetailsChange('challanFile', e.target.value)}
          size="medium"
          sx={{ mb: 2 }}
        />
      </Paper> */}
        </Box>
      );
    
  // Render the product details step
  const renderProductDetails = () => (
    <Box>
      {/* Product selection form - Improved UI */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <AddIcon color="primary" sx={{ mr: 1.5 }} />
            <Typography variant="h6" fontWeight={600} color="primary">
              Add Product to Material Challan
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
                onClick={() => {
                  // Find first product of this type and select it
                  const productOfType = products.find(p => p.type === type);
                  if (productOfType) {
                    handleProductSelect(productOfType);
                  }
                }}
                color="primary"
                variant="outlined"
                size="small"
                sx={{ borderRadius: 1 }}
              />
            ))}
          </Box>
          
          {/* Step 1: Select Product - Enhanced with search */}
          <Box>
            <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, mb: 2 }}>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Step 1: Select Product
              </Typography>
          <Autocomplete
                options={products}
                getOptionLabel={(option) => `${option.name} (${option.company})`}
                groupBy={(option) => option.type}
            value={currentProduct}
                onChange={(_, newValue) => handleProductSelect(newValue)}
            renderInput={(params) => (
                  <TextField {...params} 
                    label="Search Product" 
                    size="medium" 
                    fullWidth 
                    placeholder="Type to search by name or company..."
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
                          {option.company} • {option.type}
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
                      <strong>Suggested Dealer Price:</strong> {formatCurrency(currentProduct.dealerPrice)}
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
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        InputProps={{ 
                          inputProps: { min: 1 },
                          startAdornment: (
                            <InputAdornment position="start">
                              <Typography variant="caption" color="text.secondary">#</Typography>
                            </InputAdornment>
                          ),
                        }}
                        size="medium"
                        helperText={
                          currentProduct.type === 'Hearing Aid' && currentProduct.quantityType === 'pair' 
                            ? `${quantity} pairs (${quantity * 2} units)` 
                            : null
                        }
                      />
                    </Box>
                    
                    <Box>
              <TextField
                        label="MRP"
                fullWidth
                        type="number"
                        value={mrp}
                        onChange={(e) => handleMrpChange(Math.max(0, parseFloat(e.target.value) || 0))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
                        size="medium"
                        helperText="Manufacturer's suggested price"
              />
                    </Box>
            
                    <Box>
              <TextField
                        label="Dealer Price"
                fullWidth
                        type="number"
                        value={dealerPrice}
                        onChange={(e) => handleDealerPriceChange(Math.max(0, parseFloat(e.target.value) || 0))}
                InputProps={{
                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                }}
                        size="medium"
                        helperText="Your purchase price"
                        color="primary"
                        focused
              />
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
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        }}
                        size="medium"
                        helperText={`Saves ${formatCurrency(calculateDiscount(dealerPrice, discountPercent))}`}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>
              
              {/* Step 3: Enter Serial Numbers - For Hearing Aids */}
              {currentProduct.type === 'Hearing Aid' && (
                <Box>
                  <Box sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="subtitle2" color="primary" gutterBottom>
                        Step 3: Enter Serial Numbers
                      </Typography>
                      
                      <IconButton 
                        color={scannerMode ? 'primary' : 'default'}
                        onClick={toggleScannerMode}
                        size="small"
                        sx={{ border: '1px solid', borderColor: scannerMode ? 'primary.main' : 'divider' }}
                      >
                        <Tooltip title={scannerMode ? "Scanner Mode Active" : "Activate Barcode Scanner Mode"}>
                          <QrCodeScannerIcon fontSize="small" />
                        </Tooltip>
                      </IconButton>
                    </Box>
                    
                    {scannerMode && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Scanner mode active. Scan barcodes to automatically fill serial numbers.
                      </Alert>
                    )}
                    
                    {serialNumbers.map((serialNum, index) => (
                      <Box key={index} sx={{ display: 'flex', mb: 1, gap: 1, alignItems: 'center' }}>
                        <TextField
                fullWidth
                          label={`Serial Number ${index + 1}`}
                          value={serialNum}
                          onChange={(e) => handleSerialNumberChange(index, e.target.value)}
                size="small"
                          inputRef={index === 0 ? serialInputRef : undefined}
                          autoFocus={index === 0 && scannerMode}
                        />
                        {serialNumbers.length > 1 && (
                          <IconButton size="small" onClick={() => handleRemoveSerialNumber(index)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                    
                    {/* Only show add button if we need more serial numbers */}
                    {currentProduct.quantityType === 'pair' && serialNumbers.length < quantity * 2 || 
                     (!currentProduct.quantityType || currentProduct.quantityType === 'piece') && serialNumbers.length < quantity && (
                      <Button 
                        startIcon={<AddIcon />} 
                        onClick={handleAddSerialNumber}
                        size="small"
                        sx={{ mt: 1 }}
                      >
                        Add Serial Number
                      </Button>
                    )}
                  </Box>
                </Box>
              )}
              
              {/* Product Summary */}
              <Box sx={{ mb: 2 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" color="primary" fontWeight="medium">
                        Material Summary
                      </Typography>
                      <Typography variant="subtitle1" fontWeight="bold" color="primary">
                        {formatCurrency(calculateFinalPrice(dealerPrice, discountPercent) * quantity)}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, 
                      gap: 2 
                    }}>
                    <Box>
                        <Typography variant="body2" color="text.secondary">Quantity:</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {quantity} {currentProduct.type === 'Hearing Aid' && currentProduct.quantityType === 'pair' ? 'pairs' : 'units'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Unit Price:</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {formatCurrency(dealerPrice)}
                        </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Discount:</Typography>
                        <Typography variant="body1">
                          {discountPercent}% ({formatCurrency(calculateDiscount(dealerPrice, discountPercent))})
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="body2" color="text.secondary">Final Price (each):</Typography>
                        <Typography variant="body1" fontWeight="medium">
                        {formatCurrency(calculateFinalPrice(dealerPrice, discountPercent))}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              </Box>
              
              {/* Add to Material Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={handleAddProductToMaterial}
                  size="large"
                >
                  Add to Material Challan
                </Button>
              </Box>
          </>
        )}
    </Box>
      </Paper>
      
      {/* Products Table - Show added products */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <ReceiptIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6" fontWeight={600} color="primary">
            Products in this Material Challan
        </Typography>
        </Box>
        
        {materialData.products.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            No products added yet. Add products using the form above.
          </Alert>
        ) : (
          <>
            <TableContainer>
              <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
                    <TableCell align="center">Type</TableCell>
                    <TableCell align="center">Quantity</TableCell>
                    <TableCell align="right">Rate</TableCell>
              <TableCell align="right">Discount</TableCell>
              <TableCell align="right">Amount</TableCell>
                    <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materialData.products.map((product, index) => (
              <TableRow key={index}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {product.name}
                        </Typography>
                        {product.serialNumbers.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            SN: {product.serialNumbers.join(', ')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={product.type} 
                          size="small" 
                          variant="outlined"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {product.quantity} {product.type === 'Hearing Aid' && product.quantityType === 'pair' ? 'pairs' : 'units'}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(product.dealerPrice)}
                      </TableCell>
                      <TableCell align="right">
                        {product.discountPercent}%
                      </TableCell>
                <TableCell align="right">
                  {formatCurrency((product.finalPrice || product.dealerPrice) * product.quantity)}
                </TableCell>
                <TableCell align="center">
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => handleRemoveProduct(index)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Typography variant="h6">
                Total: {formatCurrency(materialData.totalAmount)}
              </Typography>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );

  // Render Summary step
  const renderSummary = () => (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <SummarizeIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6" fontWeight={600} color="primary">
            Material Challan Summary
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          {/* Challan Details Summary */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" color="primary" fontWeight="medium" gutterBottom>
                  Challan Information
                </Typography>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">Challan Number:</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {materialData.challanNumber}
                  </Typography>
                </Box>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">Date:</Typography>
                  <Typography variant="body1">
                    {new Date(materialData.receivedDate.seconds * 1000).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </Typography>
                </Box>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">Supplier:</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {materialData.party.name}
                  </Typography>
                </Box>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">Company:</Typography>
                  <Typography variant="body1">
                    {materialData.company}
                  </Typography>
                </Box>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">GST Type:</Typography>
                  <Typography variant="body1">
                    {materialData.gstType}
                  </Typography>
                </Box>
                
                {materialData.reference && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">Reference:</Typography>
                    <Typography variant="body1">
                      {materialData.reference}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Financial Summary */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" color="primary" fontWeight="medium" gutterBottom>
                  Financial Summary
                </Typography>
                
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Total Products:</Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {materialData.products.length} items
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Total Quantity:</Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {materialData.products.reduce((sum, p) => sum + p.quantity, 0)} units
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Sub Total:</Typography>
                    <Typography variant="body2">
                      {formatCurrency(materialData.totalAmount)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">GST ({materialData.gstPercentage}%):</Typography>
                    <Typography variant="body2">
                      {formatCurrency(materialData.totalAmount * (materialData.gstPercentage / 100))}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1" fontWeight="bold">Grand Total:</Typography>
                    <Typography variant="subtitle1" fontWeight="bold" color="primary">
                      {formatCurrency(materialData.totalAmount * (1 + materialData.gstPercentage / 100))}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Products Table */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <ReceiptIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="h6" fontWeight={600} color="primary">
            Products in this Material Challan
          </Typography>
        </Box>
        
        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>Product</TableCell>
                <TableCell align="center">Type</TableCell>
                <TableCell align="center">Quantity</TableCell>
                <TableCell align="right">Rate</TableCell>
                <TableCell align="right">Discount</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {materialData.products.map((product, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {product.name}
                    </Typography>
                    {product.serialNumbers.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        SN: {product.serialNumbers.join(', ')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Chip 
                      label={product.type} 
                      size="small" 
                      variant="outlined"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="center">
                    {product.quantity} {product.type === 'Hearing Aid' && product.quantityType === 'pair' ? 'pairs' : 'units'}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(product.dealerPrice)}
                  </TableCell>
                  <TableCell align="right">
                    {product.discountPercent}%
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency((product.finalPrice || product.dealerPrice) * product.quantity)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      </Paper>
    </Box>
  );
  
  // Render preview mode (print view)
  const renderPreview = () => (
    <Box sx={{ 
      p: { xs: 1, sm: 2, md: 4 }, 
      bgcolor: 'white', 
      borderRadius: 2,
      boxShadow: 3
    }}>
      {/* Header with action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          Material Challan
        </Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<PrintIcon />} 
            sx={{ mr: 1 }}
            onClick={() => window.print()}
          >
            Print
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<CloseIcon />}
            onClick={togglePreviewMode}
          >
            Close Preview
          </Button>
        </Box>
      </Box>
      
      {/* Company and Challan Information */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={6}>
          <Typography variant="h6" gutterBottom fontWeight="bold" color="text.primary">
            {materialData.company}
        </Typography>
          <Typography variant="body2" color="text.secondary">
            GST Type: {materialData.gstType}
          </Typography>
          </Grid>
        <Grid item xs={6} sx={{ textAlign: 'right' }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Challan #: {materialData.challanNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Date: {new Date(materialData.receivedDate.seconds * 1000).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })}
          </Typography>
        </Grid>
          </Grid>
          
      {/* Party Information */}
      <Box sx={{ mb: 4, p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
        <Typography variant="subtitle1" gutterBottom fontWeight="bold">
          Supplier Information:
        </Typography>
        <Typography variant="body1">
          {materialData.party.name}
        </Typography>
      </Box>
      
      {/* Products Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f5f5f5' }}>
            <TableRow>
              <TableCell><Typography fontWeight="bold">Product</Typography></TableCell>
              <TableCell align="center"><Typography fontWeight="bold">Type</Typography></TableCell>
              <TableCell align="center"><Typography fontWeight="bold">Serial Numbers</Typography></TableCell>
              <TableCell align="center"><Typography fontWeight="bold">Quantity</Typography></TableCell>
              <TableCell align="right"><Typography fontWeight="bold">Rate</Typography></TableCell>
              <TableCell align="right"><Typography fontWeight="bold">Amount</Typography></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materialData.products.map((product, index) => (
              <TableRow key={index}>
                <TableCell>{product.name}</TableCell>
                <TableCell align="center">{product.type}</TableCell>
                <TableCell align="center">
                  {product.serialNumbers.length > 0 
                    ? product.serialNumbers.join(', ') 
                    : '-'}
                </TableCell>
                <TableCell align="center">
                  {product.quantity} {product.type === 'Hearing Aid' && product.quantityType === 'pair' ? 'pairs' : 'units'}
                </TableCell>
                <TableCell align="right">{formatCurrency(product.dealerPrice)}</TableCell>
                <TableCell align="right">
                  {formatCurrency((product.finalPrice || product.dealerPrice) * product.quantity)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Summary */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
        <Box sx={{ width: { xs: '100%', sm: '50%', md: '40%' } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography>Subtotal:</Typography>
            <Typography>{formatCurrency(materialData.totalAmount)}</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography>GST ({materialData.gstPercentage}%):</Typography>
            <Typography>
              {formatCurrency(materialData.totalAmount * (materialData.gstPercentage / 100))}
            </Typography>
          </Box>
          
          <Divider sx={{ my: 1 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">Total:</Typography>
            <Typography variant="subtitle1" fontWeight="bold">
              {formatCurrency(materialData.totalAmount * (1 + materialData.gstPercentage / 100))}
            </Typography>
          </Box>
        </Box>
      </Box>
      
      {/* Notes and Signature */}
      <Grid container spacing={3} sx={{ mt: 4, pt: 4, borderTop: '1px dashed #e0e0e0' }}>
        <Grid item xs={12} sm={6}>
          <Typography variant="subtitle2" gutterBottom>Notes:</Typography>
          <Typography variant="body2" color="text.secondary">
            {materialData.reference || 'No additional notes.'}
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6} sx={{ textAlign: 'right' }}>
          <Typography variant="subtitle2" gutterBottom>Authorized Signature:</Typography>
          <Box sx={{ mt: 4, borderTop: '1px solid #000', width: '200px', ml: 'auto' }}></Box>
          </Grid>
        </Grid>
      </Box>
  );

  return (
    <Box sx={{ width: '100%' }}>
      {!previewMode ? (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" component="h2" color="primary" fontWeight="medium">
              {initialData ? 'Edit Material Challan' : 'New Material Challan'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<CloseIcon />}
                onClick={onCancel}
                color="inherit"
              >
                Cancel
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={togglePreviewMode}
              >
                Preview
              </Button>
            </Box>
          </Box>
          
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          
          {/* Render different content based on active step */}
          {activeStep === 0 && renderChallanDetails()}
          {activeStep === 1 && renderProductDetails()}
          {activeStep === 2 && renderSummary()}
          
          {/* Navigation buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button
              variant="outlined"
              onClick={onCancel}
              sx={{ display: activeStep === 0 ? 'inline-flex' : 'none' }}
            >
              Cancel
            </Button>
            <Button
              variant="outlined"
              onClick={handleBack}
              startIcon={<ArrowBackIcon />}
              sx={{ display: activeStep === 0 ? 'none' : 'inline-flex' }}
            >
              Back
            </Button>
            
            <Box>
              {activeStep === steps.length - 1 ? (
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleSubmit}
                  startIcon={<SaveIcon />}
                >
                  Save Challan
                </Button>
              ) : (
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleNext}
                  endIcon={<ArrowForwardIcon />}
                >
                  Next
                </Button>
              )}
        </Box>
          </Box>
        </>
      ) : (
        renderPreview()
      )}
    </Box>
  );
};

export default MaterialForm; 