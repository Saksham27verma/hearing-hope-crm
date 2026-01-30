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
  Grid as MuiGrid,
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
  Stack,
  Alert,
  Tooltip,
  Card,
  CardContent,
  LinearProgress,
  TableFooter,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp } from 'firebase/firestore';
import { getHeadOfficeId } from '@/utils/centerUtils';
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
} from '@mui/icons-material';
import { format } from 'date-fns';

// Types
interface Product {
  id: string;
  name: string;
  type: string;
  company: string;
  mrp: number;
  dealerPrice?: number;
  gstApplicable?: boolean;
  quantityType?: 'piece' | 'pair';
  hasSerialNumber?: boolean;
}

interface Party {
  id: string;
  name: string;
  gstType: string;
}

interface PurchaseProduct {
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

interface Purchase {
  id?: string;
  invoiceNo: string;
  party: {
    id: string;
    name: string;
  };
  company: string;
  location?: string;
  products: PurchaseProduct[];
  gstType: string;
  gstPercentage: number;
  totalAmount: number;
  reference?: string;
  invoiceFile?: string;
  purchaseDate: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// GST Type options
const GST_TYPES = ['LGST', 'IGST', 'GST Exempted'];

// Company options
const COMPANY_OPTIONS = ['Hope Enterprises', 'HDIPL'];

// Product types for filtering
const PRODUCT_TYPES = ['Hearing Aid', 'Battery', 'Accessory', 'Charger', 'Remote Control', 'Cleaning Kit', 'Other'];

interface PurchaseFormProps {
  initialData?: Purchase;
  products: Product[];
  parties: Party[];
  onSave: (purchase: Purchase) => void;
  onCancel: () => void;
}

// Define a Grid component that works with our props
const Grid = MuiGrid;

const PurchaseForm: React.FC<PurchaseFormProps> = ({
  initialData,
  products,
  parties,
  onSave,
  onCancel
}) => {
  console.log('PurchaseForm rendered with multi-step design');
  // Steps for the form
  const steps = ['Invoice Details', 'Product Details', 'Review & Summary'];
  
  // State
  const [activeStep, setActiveStep] = useState(0);
  const [purchaseData, setPurchaseData] = useState<Purchase>(
    initialData || {
      invoiceNo: '',
      party: { id: '', name: '' },
      company: 'Hope Enterprises',
      location: '', // Will be set to head office dynamically
      products: [],
      gstType: 'LGST',
      gstPercentage: 18,
      totalAmount: 0,
      purchaseDate: Timestamp.now(),
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

  // Set head office as default location
  useEffect(() => {
    const setHeadOfficeLocation = async () => {
      if (!purchaseData.location && !initialData) {
        const headOfficeId = await getHeadOfficeId();
        setPurchaseData(prev => ({
          ...prev,
          location: headOfficeId
        }));
      }
    };

    setHeadOfficeLocation();
  }, [initialData, purchaseData.location]);

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

  // Legacy discount calculation for places still using percent input
  const calculateDiscount = (price: number, percent: number): number => {
    return (price * percent) / 100;
  };

  const calculateFinalPrice = (price: number, percent: number): number => {
    return price - calculateDiscount(price, percent);
  };

  // Calculate grand total including GST
  const calculateGrandTotal = useMemo(() => {
    const subtotal = purchaseData.totalAmount;
    if (purchaseData.gstType === 'GST Exempted') {
      return subtotal;
    }
    return subtotal * (1 + purchaseData.gstPercentage / 100);
  }, [purchaseData.totalAmount, purchaseData.gstType, purchaseData.gstPercentage]);

  const isSerialTrackedForCurrent = useMemo(() => {
    // Backwards-compatible fallback: hearing aids are always serial-tracked in this system.
    return Boolean(currentProduct?.hasSerialNumber || currentProduct?.type === 'Hearing Aid');
  }, [currentProduct?.hasSerialNumber, currentProduct?.type]);

  const requiredSerialCountForCurrent = useMemo(() => {
    if (!currentProduct || !isSerialTrackedForCurrent) return 0;
    if (currentProduct.type === 'Hearing Aid' && currentProduct.quantityType === 'pair') {
      return quantity * 2;
    }
    return quantity;
  }, [currentProduct, isSerialTrackedForCurrent, quantity]);
  
  // Handle changing the step
  const handleNext = () => {
    if (activeStep === 0) {
      // Validate first step
      const stepErrors: Record<string, string> = {};
      
      if (!purchaseData.invoiceNo) {
        stepErrors.invoiceNo = 'Invoice number is required';
      }
      
      if (!purchaseData.party.id) {
        stepErrors.party = 'Supplier is required';
      }
      
      if (!purchaseData.company) {
        stepErrors.company = 'Company is required';
      }
      
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        return;
      }
    } else if (activeStep === 1) {
      // Validate second step
      if (purchaseData.products.length === 0) {
        setErrors({ products: 'At least one product is required' });
        return;
      }
    }
    
    setErrors({});
    setActiveStep((prevStep) => prevStep + 1);
  };
  
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };
  
  // Handle invoice details change
  const handleInvoiceDetailsChange = (field: string, value: any) => {
    setPurchaseData((prev) => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  // Handle party change
  const handlePartyChange = (party: Party | null) => {
    if (party) {
      setPurchaseData((prev) => ({
        ...prev,
        party: {
          id: party.id,
          name: party.name
        },
        gstType: party.gstType
      }));
      
      // Clear error
      if (errors.party) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.party;
          return newErrors;
        });
      }
    }
  };
  
  // Handle product selection
  const handleProductSelect = (product: Product | null) => {
    setCurrentProduct(product);
    if (product) {
      setMrp(product.mrp);
      const newDealerPrice = product.dealerPrice || product.mrp * 0.7;
      setDealerPrice(newDealerPrice);
      
      // Automatically calculate discount percentage
      if (product.mrp > 0 && newDealerPrice < product.mrp) {
        const calculatedDiscount = Math.round(((product.mrp - newDealerPrice) / product.mrp) * 100);
        setDiscountPercent(calculatedDiscount);
      } else {
        setDiscountPercent(0);
      }
    } else {
      setMrp(0);
      setDealerPrice(0);
      setDiscountPercent(0);
    }
    setSerialNumbers([]);
    setQuantity(1);
  };
  
  // Handle MRP change - recalculate discount if dealer price exists
  const handleMrpChange = (newMrp: number) => {
    setMrp(newMrp);
    if (newMrp > 0) {
      const discountPercent = calculateDiscountPercent(newMrp, dealerPrice);
      setDiscountPercent(discountPercent);
    }
  };
  
  // Handle dealer price change - recalculate discount if MRP exists
  const handleDealerPriceChange = (newDealerPrice: number) => {
    setDealerPrice(newDealerPrice);
    if (mrp > 0) {
      const discountPercent = calculateDiscountPercent(mrp, newDealerPrice);
      setDiscountPercent(discountPercent);
    }
  };
  
  // Handle discount percent change - recalculate dealer price based on MRP
  const handleDiscountChange = (newDiscountPercent: number) => {
    setDiscountPercent(newDiscountPercent);
    if (mrp > 0) {
      const newDealerPrice = mrp * (1 - newDiscountPercent / 100);
      setDealerPrice(Math.round(newDealerPrice));
    }
  };
  
  // Handle adding a serial number
  const handleAddSerialNumber = () => {
    if (serialNumber && !serialNumbers.includes(serialNumber)) {
      // Clean the serial number to remove any potential special characters
      const cleanedSerial = serialNumber
        .replace(/Shift/gi, '')
        .replace(/[^\w\d-]/g, '')
        .trim();
        
      if (cleanedSerial.length > 0) {
        setSerialNumbers([...serialNumbers, cleanedSerial]);
        setSerialNumber('');
      }
    }
  };
  
  // Handle removing a serial number
  const handleRemoveSerialNumber = (index: number) => {
    const newSerialNumbers = [...serialNumbers];
    newSerialNumbers.splice(index, 1);
    setSerialNumbers(newSerialNumbers);
  };
  
  // Handle adding a product to the purchase
  const handleAddProductToPurchase = () => {
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
    
    if (isSerialTrackedForCurrent && serialNumbers.length === 0) {
      validationErrors.push('At least one serial number is required for this product');
    }
    
    if (isSerialTrackedForCurrent && requiredSerialCountForCurrent !== serialNumbers.length) {
      if (currentProduct.type === 'Hearing Aid' && currentProduct.quantityType === 'pair') {
        validationErrors.push(`For pairs of hearing aids, you need ${requiredSerialCountForCurrent} serial numbers (${quantity} pairs)`);
      } else {
        validationErrors.push(`Number of serial numbers (${serialNumbers.length}) must match quantity (${quantity})`);
      }
    }
    
    if (validationErrors.length > 0) {
      setErrors({
        ...errors,
        productEntry: validationErrors.join(', ')
      });
      return;
    }

    // Calculate discount amount and final price
    const discountAmount = calculateDiscountAmount(mrp, dealerPrice);
    const discountPercent = calculateDiscountPercent(mrp, dealerPrice);
    const finalPrice = dealerPrice; // Final price is the dealer price
    const total = finalPrice * quantity;
    
    // New product entry
    const newProduct: PurchaseProduct = {
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
    
    // Add product to purchase data
    const updatedProducts = [...purchaseData.products, newProduct];
    
    // Calculate new total
    const totalAmount = updatedProducts.reduce((total, product) => {
      return total + (product.finalPrice || product.dealerPrice) * product.quantity;
    }, 0);
    
    setPurchaseData((prev) => ({
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
  
  // Handle removing a product from the purchase
  const handleRemoveProduct = (index: number) => {
    const updatedProducts = [...purchaseData.products];
    updatedProducts.splice(index, 1);
    
    // Recalculate total
    const totalAmount = updatedProducts.reduce((total, product) => {
      return total + (product.finalPrice || product.dealerPrice) * product.quantity;
    }, 0);
    
    setPurchaseData((prev) => ({
      ...prev,
      products: updatedProducts,
      totalAmount
    }));
  };
  
  // Handle form submission
  const handleSubmit = () => {
    onSave(purchaseData);
  };
  
  // Toggle preview mode
  const togglePreviewMode = () => {
    setPreviewMode(!previewMode);
  };
  
  // Fix the barcode scanner handling logic
  useEffect(() => {
    // Only enable scanner mode if we're on the product details step with a serial-tracked product selected
    const shouldEnableScanner = scannerMode && isSerialTrackedForCurrent && activeStep === 1;

    if (!shouldEnableScanner) return;

    // Create a single buffer for the entire scan
    let scanningBuffer = '';
    let lastKeyTime = 0;
    let scanTimeoutId: NodeJS.Timeout | null = null;
    
    // This function detects barcode scanner input
    // Barcode scanners typically send data very quickly, followed by an Enter key
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys 
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      
      const currentTime = new Date().getTime();
      const timeSinceLastKey = currentTime - lastKeyTime;
      
      // Clear any pending timeout to process the scan
      if (scanTimeoutId) {
        clearTimeout(scanTimeoutId);
      }
      
      // If Enter key is pressed, process the complete barcode
      if (e.key === 'Enter') {
        e.preventDefault();
        
        // Process the scanned barcode if buffer is not empty
        if (scanningBuffer.trim()) {
          // Clean the barcode - remove any unexpected characters like Shift keys
          const cleanedBarcode = scanningBuffer
            .replace(/Shift/gi, '') // Remove any "Shift" text
            .replace(/[^\w\d-]/g, '') // Keep only alphanumeric and dash characters
            .trim();
          
          if (cleanedBarcode && cleanedBarcode.length > 3 && !serialNumbers.includes(cleanedBarcode)) {
            setSerialNumbers(prev => [...prev, cleanedBarcode]);
            // Provide feedback that scan was successful
            setSerialNumber(''); // Clear the input field
          }
        }
        
        // Reset the buffer for next scan
        scanningBuffer = '';
        return;
      }
      
      // If it's been more than 50ms since the last key and the buffer is not empty,
      // we might be starting a new scan
      if (timeSinceLastKey > 2000 && scanningBuffer.length > 0) {
        // Process the existing buffer as a complete scan before starting new input
        const cleanedBarcode = scanningBuffer
          .replace(/Shift/gi, '')
          .replace(/[^\w\d-]/g, '')
          .trim();
          
        if (cleanedBarcode && cleanedBarcode.length > 3 && !serialNumbers.includes(cleanedBarcode)) {
          setSerialNumbers(prev => [...prev, cleanedBarcode]);
        }
        
        // Reset for new scan
        scanningBuffer = '';
      }
      
      // Append the key to the scanning buffer
      scanningBuffer += e.key;
      lastKeyTime = currentTime;
      
      // Set a timeout to process the scan if no more keys are pressed
      // This handles cases where the scanner doesn't send an Enter key
      scanTimeoutId = setTimeout(() => {
        if (scanningBuffer.trim()) {
          const cleanedBarcode = scanningBuffer
            .replace(/Shift/gi, '')
            .replace(/[^\w\d-]/g, '')
            .trim();
            
          if (cleanedBarcode && cleanedBarcode.length > 3 && !serialNumbers.includes(cleanedBarcode)) {
            setSerialNumbers(prev => [...prev, cleanedBarcode]);
            setSerialNumber(''); // Clear the input field
          }
          
          scanningBuffer = '';
        }
      }, 500);
    };

    // Add keydown listener when scanner mode is active
    window.addEventListener('keydown', handleKeyDown);
    
    // Focus the input field when scanner mode is active
    if (serialInputRef.current && shouldEnableScanner) {
      serialInputRef.current.focus();
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      
      // Clear any pending timeout when unmounting
      if (scanTimeoutId) {
        clearTimeout(scanTimeoutId);
      }
    };
  }, [scannerMode, currentProduct, activeStep, serialNumbers, isSerialTrackedForCurrent]);

  // Toggle scanner mode
  const toggleScannerMode = () => {
    const newMode = !scannerMode;
    setScannerMode(newMode);
    
    // Focus the input field when enabling scanner mode
    if (newMode && serialInputRef.current) {
      setTimeout(() => {
        if (serialInputRef.current) {
          serialInputRef.current.focus();
        }
      }, 100);
    }
  };
  
  // Render different steps of the form
  const renderInvoiceDetails = () => (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <ReceiptIcon color="primary" sx={{ mr: 1.5 }} />
          <Typography variant="subtitle1" fontWeight={600} color="primary">
            Invoice Information
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
              label="Invoice Number"
              fullWidth
              value={purchaseData.invoiceNo}
              onChange={(e) => handleInvoiceDetailsChange('invoiceNo', e.target.value)}
              error={!!errors.invoiceNo}
              helperText={errors.invoiceNo}
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
                value={purchaseData.gstType}
                label="GST Type"
                onChange={(e) => handleInvoiceDetailsChange('gstType', e.target.value)}
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
              value={parties.find(p => p.id === purchaseData.party.id) || null}
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
                value={purchaseData.company}
                label="Company Billed To"
                onChange={(e) => handleInvoiceDetailsChange('company', e.target.value)}
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
                label="Invoice Date"
                value={
                  purchaseData.purchaseDate 
                    ? new Date(purchaseData.purchaseDate.seconds * 1000) 
                    : new Date()
                }
                onChange={(newValue) => {
                  if (newValue) {
                    handleInvoiceDetailsChange('purchaseDate', Timestamp.fromDate(newValue));
                  }
                }}
                slotProps={{ 
                  textField: { 
                    fullWidth: true, 
                    size: "medium",
                    required: true,
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
          
          {purchaseData.gstType !== 'GST Exempted' && (
            <Box>
              <TextField
                label="GST Percentage"
                fullWidth
                type="number"
                value={purchaseData.gstPercentage}
                onChange={(e) => handleInvoiceDetailsChange('gstPercentage', Number(e.target.value))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  startAdornment: (
                    <InputAdornment position="start">
                      <RupeeIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                size="medium"
              />
            </Box>
          )}
        </Box>
      </Paper>
      
      {/* Quick Summary Card */}
      <Card elevation={0} sx={{ bgcolor: '#f0f7ff', borderRadius: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={1}>
            <InfoIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="subtitle2" fontWeight={600}>
              Quick Summary
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography variant="body2">
                Invoice: <strong>{purchaseData.invoiceNo || 'Not specified'}</strong>
              </Typography>
              <Typography variant="body2">
                Supplier: <strong>{purchaseData.party.name || 'Not selected'}</strong>
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2">
                GST Type: <strong>{purchaseData.gstType}</strong>
              </Typography>
              <Typography variant="body2">
                Company: <strong>{purchaseData.company || 'Not selected'}</strong>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
  
  const renderProductDetails = () => (
    <Box>
      {/* Product selection form - Improved UI */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <AddIcon color="primary" sx={{ mr: 1.5 }} />
            <Typography variant="h6" fontWeight={600} color="primary">
              Add Product to Purchase
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
                        label="Discount"
                        fullWidth
                        type="number"
                        value={discountPercent}
                        onChange={(e) => handleDiscountChange(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        }}
                        size="medium"
                        helperText={`Saves ${formatCurrency(calculateDiscountAmount(mrp, dealerPrice))}`}
                      />
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Step 3: Serial Numbers - for any serial-tracked product */}
              {currentProduct && isSerialTrackedForCurrent && (
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="subtitle2" color="primary" sx={{ display: 'flex', alignItems: 'center' }}>
                      <BarcodeIcon fontSize="small" sx={{ mr: 1 }} />
                      Step 3: Add Serial Numbers
                      {currentProduct.type === 'Hearing Aid' && currentProduct.quantityType === 'pair'
                        ? ` (${requiredSerialCountForCurrent} required for ${quantity} pairs)` 
                        : ` (${requiredSerialCountForCurrent || quantity} required)`}
                    </Typography>
                    
                    {/* Scanner mode toggle */}
                    <Button
                      variant={scannerMode ? "contained" : "outlined"}
                      color={scannerMode ? "success" : "primary"}
                      size="small"
                      startIcon={<ScannerIcon />}
                      onClick={toggleScannerMode}
                      sx={{ borderRadius: 4 }}
                    >
                      {scannerMode ? "Scanner Active" : "Enable Scanner"}
                    </Button>
                  </Box>
                  
                  {/* Scanner mode instructions */}
                  {scannerMode && (
                    <Alert 
                      severity="info" 
                      variant="outlined" 
                      sx={{ mb: 2 }}
                      icon={<ScannerIcon />}
                    >
                      <Typography variant="body2">
                        Barcode scanner mode is active. Simply scan the barcode on each device to add its serial number.
                      </Typography>
                    </Alert>
                  )}
                  
                  <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                    <TextField
                      label="Serial Number"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      fullWidth
                      error={!!errors.serialNumber}
                      helperText={errors.serialNumber || (scannerMode ? 'Scan barcode or type serial number and press Enter' : 'Press Enter or click Add after each serial number')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && serialNumber.trim()) {
                          e.preventDefault();
                          handleAddSerialNumber();
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {scannerMode ? <ScannerIcon color="success" /> : <BarcodeIcon color="action" />}
                          </InputAdornment>
                        ),
                      }}
                      autoFocus={isSerialTrackedForCurrent}
                      inputRef={serialInputRef}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderColor: scannerMode ? 'success.main' : 'inherit',
                          ...(scannerMode && {
                            animation: 'pulse 2s infinite',
                            '@keyframes pulse': {
                              '0%': {
                                boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.4)'
                              },
                              '70%': {
                                boxShadow: '0 0 0 5px rgba(46, 125, 50, 0)'
                              },
                              '100%': {
                                boxShadow: '0 0 0 0 rgba(46, 125, 50, 0)'
                              }
                            }
                          })
                        }
                      }}
                    />
                    <Button 
                      onClick={handleAddSerialNumber}
                      disabled={!serialNumber.trim()}
                      variant="contained"
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      <AddIcon /> Add
                    </Button>
                  </Box>
                  
                  {/* Display progress of scanned serial numbers */}
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 1, 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    borderRadius: 1,
                    border: '1px dashed',
                    borderColor: 'divider',
                    minHeight: '60px'
                  }}>
                    {serialNumbers.length > 0 ? (
                      serialNumbers.map((sn, index) => (
                        <Chip
                          key={index}
                          label={sn}
                          onDelete={() => handleRemoveSerialNumber(index)}
                          color="primary"
                          size="small"
                          sx={{ '& .MuiChip-label': { fontSize: '0.85rem' } }}
                        />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ width: '100%', textAlign: 'center' }}>
                        {scannerMode ? 'Ready to scan barcodes' : 'No serial numbers added yet'}
                      </Typography>
                    )}
                  </Box>
                  
                  {/* Progress indicator */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, gap: 1 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={requiredSerialCountForCurrent > 0 ? (serialNumbers.length / requiredSerialCountForCurrent) * 100 : 0}
                        color={requiredSerialCountForCurrent > 0 && serialNumbers.length === requiredSerialCountForCurrent ? "success" : "primary"}
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {serialNumbers.length} / {requiredSerialCountForCurrent}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Product Summary Card - Better visualization */}
              <Box sx={{ mb: 2 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" color="primary" fontWeight="medium">
                        Purchase Summary
                      </Typography>
                      <Typography variant="subtitle1" fontWeight="bold" color="primary">
                        {formatCurrency(dealerPrice * quantity)}
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
                          {calculateDiscountPercent(mrp, dealerPrice)}% ({formatCurrency(calculateDiscountAmount(mrp, dealerPrice))})
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Final Unit Price:</Typography>
                        <Typography variant="body1" fontWeight="bold" color="primary.dark">
                          {formatCurrency(dealerPrice)}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Box>
              
              {/* Add to Purchase Button - More prominent */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleAddProductToPurchase}
                  disabled={
                    !currentProduct || 
                    (isSerialTrackedForCurrent && serialNumbers.length !== requiredSerialCountForCurrent)
                  }
                  startIcon={<AddIcon />}
                  size="large"
                  sx={{ 
                    px: 3, 
                    py: 1.5,
                    borderRadius: 2,
                    boxShadow: 2
                  }}
                >
                  Add to Purchase
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Paper>
      
      {/* Products table - Keep the existing implementation */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Box p={2} display="flex" justifyContent="space-between" alignItems="center" bgcolor="#f8f9fa">
          <Typography variant="h6" fontWeight={600}>
            Added Products {purchaseData.products.length > 0 && `(${purchaseData.products.length})`}
          </Typography>
          <Typography variant="subtitle1" fontWeight="medium" color="primary">
            Subtotal: {formatCurrency(purchaseData.totalAmount)}
          </Typography>
        </Box>
        
        {purchaseData.products.length === 0 ? (
          <Box p={4} textAlign="center">
            <Typography color="text.secondary" variant="body1">
              No products added to this purchase yet
            </Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
              Use the form above to add products
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: '400px' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width="25%">Product</TableCell>
                  <TableCell>Serial Numbers</TableCell>
                  <TableCell align="center">Quantity</TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="center">Discount</TableCell>
                  <TableCell align="right">Final Price</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchaseData.products.map((product, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {product.name}
                        {product.type === 'Hearing Aid' && product.quantityType === 'pair' && (
                          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                            (Counted in pairs)
                          </Typography>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {product.serialNumbers.length > 0 ? (
                        <Box sx={{ maxWidth: '200px', maxHeight: '60px', overflowY: 'auto' }}>
                          <Tooltip title={product.serialNumbers.join(', ')}>
                            <Box>
                              {product.serialNumbers.length <= 2 ? (
                                product.serialNumbers.join(', ')
                              ) : (
                                <>
                                  {product.serialNumbers.slice(0, 2).join(', ')}
                                  <Chip 
                                    size="small" 
                                    label={`+${product.serialNumbers.length - 2} more`} 
                                    variant="outlined" 
                                    sx={{ ml: 0.5 }}
                                  />
                                </>
                              )}
                            </Box>
                          </Tooltip>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {product.quantity} {product.type === 'Hearing Aid' && product.quantityType === 'pair' ? 'pairs' : 'pcs'}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(product.dealerPrice)}</TableCell>
                    <TableCell align="center">
                      {product.discountPercent ? (
                        <Chip 
                          label={`${product.discountPercent}%`}
                          size="small"
                          color="default"
                          variant="outlined"
                        />
                      ) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(product.finalPrice || product.dealerPrice)}
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="medium">
                        {formatCurrency((product.finalPrice || product.dealerPrice) * product.quantity)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton 
                        size="small" 
                        color="error" 
                        onClick={() => handleRemoveProduct(index)}
                        title="Remove product"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* Total Row */}
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell colSpan={6} align="right">
                    <Typography variant="subtitle2">Subtotal:</Typography>
                  </TableCell>
                  <TableCell align="right" colSpan={2}>
                    <Typography variant="subtitle2" fontWeight="bold" color="primary">
                      {formatCurrency(purchaseData.totalAmount)}
                    </Typography>
                  </TableCell>
                </TableRow>
                
                {purchaseData.gstType !== 'GST Exempted' && (
                  <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                    <TableCell colSpan={6} align="right">
                      <Typography variant="subtitle2">
                        {purchaseData.gstType} ({purchaseData.gstPercentage}%):
                      </Typography>
                    </TableCell>
                    <TableCell align="right" colSpan={2}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {formatCurrency(purchaseData.totalAmount * (purchaseData.gstPercentage / 100))}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                
                <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                  <TableCell colSpan={6} align="right">
                    <Typography variant="subtitle1" fontWeight="bold">Grand Total:</Typography>
                  </TableCell>
                  <TableCell align="right" colSpan={2}>
                    <Typography variant="subtitle1" fontWeight="bold" color="primary">
                      {formatCurrency(calculateGrandTotal)}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
        
        {errors.products && (
          <Alert severity="error" sx={{ m: 2 }}>
            {errors.products}
          </Alert>
        )}
      </Paper>
    </Box>
  );
  
  const renderSummary = () => (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: '#f8f9fa', borderRadius: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center">
            <ReceiptIcon color="primary" sx={{ mr: 1.5 }} />
            <Typography variant="subtitle1" fontWeight={600} color="primary">
              Purchase Summary
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
            {previewMode ? "Exit Preview" : "Preview Purchase"}
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
            <Typography variant="subtitle2" gutterBottom color="primary">Invoice Details</Typography>
            <Box sx={{ pl: 2, mb: 3 }}>
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Invoice Number:</Typography>
                  <Typography variant="body2" fontWeight="medium">{purchaseData.invoiceNo}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Invoice Date:</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {format(new Date(purchaseData.purchaseDate.seconds * 1000), 'dd MMM yyyy')}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Supplier:</Typography>
                  <Typography variant="body2" fontWeight="medium">{purchaseData.party.name}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Company Billed To:</Typography>
                  <Typography variant="body2" fontWeight="medium">{purchaseData.company}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">GST Type:</Typography>
                  <Typography variant="body2" fontWeight="medium">{purchaseData.gstType}</Typography>
                </Box>
                {purchaseData.gstType !== 'GST Exempted' && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">GST Rate:</Typography>
                    <Typography variant="body2" fontWeight="medium">{purchaseData.gstPercentage}%</Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          </Box>
          
          <Box>
            <Typography variant="subtitle2" gutterBottom color="primary">Purchase Totals</Typography>
            <Box sx={{ pl: 2, mb: 3 }}>
              <Stack spacing={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Products:</Typography>
                  <Typography variant="body2" fontWeight="medium">{purchaseData.products.length}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Items:</Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {purchaseData.products.reduce((sum, p) => sum + p.quantity, 0)}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                  <Typography variant="body2" fontWeight="medium">{formatCurrency(purchaseData.totalAmount)}</Typography>
                </Box>
                
                {purchaseData.gstType !== 'GST Exempted' && (
                  <>
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">GST Amount:</Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(purchaseData.totalAmount * (purchaseData.gstPercentage / 100))}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 1 }} />
                    <Box display="flex" justifyContent="space-between">
                      <Typography variant="subtitle2" color="primary">Grand Total:</Typography>
                      <Typography variant="subtitle2" fontWeight="bold" color="primary">
                        {formatCurrency(calculateGrandTotal)}
                      </Typography>
                    </Box>
                  </>
                )}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Paper>
      
      <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box p={2} bgcolor="#f5f5f5">
          <Typography variant="subtitle2" fontWeight="medium">
            Products in this Purchase
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
              {purchaseData.products.map((product, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {product.name}
                      {product.type === 'Hearing Aid' && product.quantityType === 'pair' && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                          (Counted in pairs)
                        </Typography>
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {product.quantity} {product.type === 'Hearing Aid' && product.quantityType === 'pair' ? 'pairs' : 'pcs'}
                  </TableCell>
                  <TableCell align="right">{formatCurrency(product.dealerPrice)}</TableCell>
                  <TableCell align="center">{product.discountPercent ? `${product.discountPercent}%` : '-'}</TableCell>
                  <TableCell align="right">{formatCurrency(product.finalPrice || product.dealerPrice)}</TableCell>
                  <TableCell align="right">{formatCurrency((product.finalPrice || product.dealerPrice) * product.quantity)}</TableCell>
                </TableRow>
              ))}
              
              {/* Total row */}
              <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                <TableCell colSpan={4} />
                <TableCell align="right">
                  <Typography variant="subtitle2">Subtotal</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="subtitle2">{formatCurrency(purchaseData.totalAmount)}</Typography>
                </TableCell>
              </TableRow>
              
              {purchaseData.gstType !== 'GST Exempted' && (
                <>
                  <TableRow>
                    <TableCell colSpan={4} />
                    <TableCell align="right">GST ({purchaseData.gstPercentage}%)</TableCell>
                    <TableCell align="right">
                      {formatCurrency(purchaseData.totalAmount * (purchaseData.gstPercentage / 100))}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} />
                    <TableCell align="right">
                      <Typography variant="subtitle2" fontWeight="bold">Grand Total</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" fontWeight="bold">
                        {formatCurrency(calculateGrandTotal)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* Serial Numbers Section - Show if there are any serial numbers */}
      {purchaseData.products.some(p => p.serialNumbers && p.serialNumbers.length > 0) && (
        <Paper elevation={0} sx={{ p: 3, mt: 3, borderRadius: 2, bgcolor: '#f8f9fa' }}>
          <Typography variant="subtitle1" fontWeight={600} color="primary" gutterBottom>
            Serial Numbers
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          {purchaseData.products
            .filter(p => p.serialNumbers && p.serialNumbers.length > 0)
            .map((product, idx) => (
              <Box key={idx} mb={2}>
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  {product.name}:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {product.serialNumbers.map((sn, i) => (
                    <Chip 
                      key={i} 
                      label={sn} 
                      size="small" 
                      variant="outlined" 
                      color="primary"
                    />
                  ))}
                </Box>
              </Box>
            ))
          }
        </Paper>
      )}
    </Box>
  );
  
  // Full page preview mode
  const renderPreview = () => (
    <Box sx={{ 
      position: 'relative',
      bgcolor: 'background.paper',
      borderRadius: 2,
      p: 3,
      mb: 3,
      boxShadow: 3
    }}>
      <Box sx={{ 
        position: 'absolute', 
        top: 0, 
        right: 0, 
        p: 2, 
        display: 'flex', 
        gap: 1 
      }}>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
        >
          Print
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={togglePreviewMode}
        >
          Back to Form
        </Button>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, mt: 2 }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          Purchase Invoice Preview
        </Typography>
        <Box>
          <Typography variant="body2" color="text.secondary">Invoice Number</Typography>
          <Typography variant="h6">{purchaseData.invoiceNo || "Not specified"}</Typography>
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mb: 4 }}>
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, flex: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Supplier</Typography>
          <Typography variant="body1" fontWeight="medium">{purchaseData.party.name}</Typography>
          <Typography variant="body2" color="text.secondary">GST Type: {purchaseData.gstType}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 2, flex: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Billed To</Typography>
          <Typography variant="body1" fontWeight="medium">{purchaseData.company}</Typography>
          <Typography variant="body2" color="text.secondary">
            Date: {format(new Date(purchaseData.purchaseDate.seconds * 1000), 'dd MMM yyyy')}
          </Typography>
        </Paper>
      </Box>
      
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Type</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Unit Price</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Discount</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Final Price</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {purchaseData.products.map((product, index) => (
              <TableRow key={index} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {product.name}
                    {product.type === 'Hearing Aid' && product.quantityType === 'pair' && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                        (Counted in pairs)
                      </Typography>
                    )}
                  </Typography>
                </TableCell>
                <TableCell align="center">{product.type}</TableCell>
                <TableCell align="center">
                  {product.quantity} {product.type === 'Hearing Aid' && product.quantityType === 'pair' ? 'pairs' : 'pcs'}
                </TableCell>
                <TableCell align="right">{formatCurrency(product.dealerPrice)}</TableCell>
                <TableCell align="center">{product.discountPercent ? `${product.discountPercent}%` : '-'}</TableCell>
                <TableCell align="right">{formatCurrency(product.finalPrice || product.dealerPrice)}</TableCell>
                <TableCell align="right">{formatCurrency((product.finalPrice || product.dealerPrice) * product.quantity)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} />
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Subtotal:</TableCell>
              <TableCell align="right">{formatCurrency(purchaseData.totalAmount)}</TableCell>
            </TableRow>
            {purchaseData.gstType !== 'GST Exempted' && (
              <>
                <TableRow>
                  <TableCell colSpan={5} />
                  <TableCell align="right">GST ({purchaseData.gstPercentage}%):</TableCell>
                  <TableCell align="right">
                    {formatCurrency(purchaseData.totalAmount * (purchaseData.gstPercentage / 100))}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={5} />
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Grand Total:</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                    {formatCurrency(calculateGrandTotal)}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableFooter>
        </Table>
      </TableContainer>
      
      {/* Serial Numbers Section */}
      {purchaseData.products.some(p => p.serialNumbers && p.serialNumbers.length > 0) && (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: '#f8f9fa', mb: 4 }}>
          <Typography variant="subtitle1" fontWeight={600} color="primary" gutterBottom>
            Serial Numbers
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            {purchaseData.products
              .filter(p => p.serialNumbers && p.serialNumbers.length > 0)
              .map((product, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
                    {product.name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {product.serialNumbers.map((sn, i) => (
                      <Chip 
                        key={i} 
                        label={sn} 
                        size="small" 
                        variant="outlined" 
                        color="primary"
                      />
                    ))}
                  </Box>
                </Paper>
              ))
            }
          </Box>
        </Paper>
      )}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: '1px dashed', borderColor: 'divider' }}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
          <Typography variant="body2">
            {purchaseData.reference || "No additional notes"}
          </Typography>
        </Box>
        <Box textAlign="right">
          <Typography variant="caption" color="text.secondary">Generated on</Typography>
          <Typography variant="body2">{format(new Date(), 'dd MMM yyyy, hh:mm a')}</Typography>
        </Box>
      </Box>
    </Box>
  );
  
  return (
    <Box sx={{ width: '100%' }}>
      {previewMode ? (
        renderPreview()
      ) : (
        <>
          <Stepper 
            activeStep={activeStep} 
            sx={{ 
              mb: 4,
              '& .MuiStepLabel-root .Mui-completed': {
                color: 'primary.main',
              },
              '& .MuiStepLabel-label.Mui-completed.MuiStepLabel-alternativeLabel': {
                color: 'grey.700',
              },
              '& .MuiStepLabel-root .Mui-active': {
                color: 'primary.main',
              },
            }}
          >
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          
          <Box sx={{ mt: 2, mb: 4 }}>
            {activeStep === 0 && renderInvoiceDetails()}
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
                  Complete Purchase
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

export default PurchaseForm; 