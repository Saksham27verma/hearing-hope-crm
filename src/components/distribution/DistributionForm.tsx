'use client';

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
  Alert,
  Tooltip,
  Card,
  CardContent,
  LinearProgress,
  TableFooter,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid as MuiGrid,
  FormControlLabel,
  Switch,
} from '@mui/material';

// Just use MuiGrid directly
const Grid = MuiGrid;
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Timestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { 
  Delete as DeleteIcon, 
  Add as AddIcon,
  Info as InfoIcon,
  CurrencyRupee as RupeeIcon,
  Receipt as ReceiptIcon,
  DateRange as DateRangeIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  QrCode as BarcodeIcon,
  Calculate as CalculateIcon,
  QrCodeScanner as QrCodeScannerIcon,
  Summarize as SummarizeIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  Category as CategoryIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

interface Product {
  id: string;
  name: string;
  type: string;
  company: string;
  mrp: number;
  dealerPrice?: number;
  gstApplicable?: boolean;
  gstPercentage?: number;
  quantityType?: 'piece' | 'pair';
  hsnCode?: string;
}

interface Dealer {
  id: string;
  name: string;
  category?: string;
  gstType?: string;
  gstNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms?: string;
  creditLimit?: number;
}

interface DistributionProduct {
  productId: string;
  name: string;
  type: string;
  company: string;
  serialNumbers: string[];
  quantity: number;
  dealerPrice?: number;
  distributionPrice?: number;
  mrp?: number;
  discountPercent?: number;
  discountAmount?: number;
  finalPrice?: number;
  gstApplicable?: boolean;
  gstPercentage?: number;
  gstAmount?: number;
  totalAmount?: number;
  remarks?: string;
  quantityType?: 'piece' | 'pair';
  condition?: string;
  availableQuantity?: number;
}

interface Distribution {
  id?: string;
  invoiceNumber: string;
  dealer: {
    id: string;
    name: string;
  };
  company: string;
  products: DistributionProduct[];
  subtotalAmount: number;
  gstAmount: number;
  totalAmount: number;
  distributionDate: Timestamp;
  dueDate?: Timestamp;
  paymentStatus?: 'pending' | 'partial' | 'paid';
  deliveryStatus?: 'pending' | 'dispatched' | 'delivered';
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}

interface AvailableItem {
  productId: string;
  productName: string;
  name: string;
  type?: string;
  company?: string;
  serialNumber?: string;
  isSerialTracked?: boolean;
  quantity?: number;
  mrp?: number;
  dealerPrice?: number;
  distributionPrice?: number;
  discountPercent?: number;
  gstApplicable?: boolean;
  gstPercentage?: number;
  status?: string;
  location?: string;
  hsnCode?: string;
}

interface Props {
  initialData?: Distribution;
  dealers: Dealer[];
  onSave: (distribution: Distribution) => void;
  onCancel: () => void;
}

const steps = ['Distribution Details', 'Product Selection', 'Pricing & GST', 'Review & Summary'];

const DistributionForm: React.FC<Props> = ({ initialData, dealers, onSave, onCancel }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [distributionData, setDistributionData] = useState<Distribution>(
    initialData || {
      invoiceNumber: `INV-${Date.now()}`,
      dealer: { id: '', name: '' },
      company: 'Hope Enterprises',
      products: [],
      subtotalAmount: 0,
      gstAmount: 0,
      totalAmount: 0,
      distributionDate: Timestamp.now(),
      paymentStatus: 'pending',
      deliveryStatus: 'pending',
    }
  );
  
  // State for product selection
  const [availableInventory, setAvailableInventory] = useState<AvailableItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Hierarchical selection states
  const [selectedType, setSelectedType] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectionMode, setSelectionMode] = useState<'types' | 'companies' | 'models' | 'products'>('types');
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [productGroups, setProductGroups] = useState<{[key: string]: AvailableItem[]}>({});
  
  // Multiple selection states
  const [selectedItems, setSelectedItems] = useState<AvailableItem[]>([]);
  const [bulkSelectionOpen, setBulkSelectionOpen] = useState(false);
  
  // Current product being added
  const [currentProduct, setCurrentProduct] = useState<DistributionProduct>({
    productId: '',
    name: '',
    type: '',
    company: '',
    serialNumbers: [],
    quantity: 1,
    dealerPrice: 0,
    mrp: 0,
    discountPercent: 0,
    discountAmount: 0,
    finalPrice: 0,
    gstApplicable: false,
    gstPercentage: 0,
    gstAmount: 0,
    totalAmount: 0,
    quantityType: 'piece',
    condition: 'new',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serialNumber, setSerialNumber] = useState('');

  // Load available inventory on component mount
  useEffect(() => {
    fetchAvailableInventory();
  }, []);

  const fetchAvailableInventory = async () => {
    setInventoryLoading(true);
    try {
      console.log('🚀 Starting to fetch available inventory for distribution...');
      
      // Get all products
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      console.log(`📦 Found ${products.length} products`);
      
      // Build product map
      const prodMap = new Map<string, Product>();
      products.forEach((product: any) => {
        prodMap.set(product.id, product as Product);
      });
      
      // Get all material inward entries
      const materialInwardSnapshot = await getDocs(collection(db, 'materialInward'));
      const materialInward = materialInwardSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string; products: any[] }));
      console.log(`📥 Found ${materialInward.length} material inward entries`);
      
      // Get all purchases
      const purchasesSnapshot = await getDocs(collection(db, 'purchases'));
      const purchases = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string; products: any[] }));
      console.log(`🛒 Found ${purchases.length} purchase entries`);
      
      // Get all material outward entries
      const materialOutSnapshot = await getDocs(collection(db, 'materialsOut'));
      const materialOut = materialOutSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string; products: any[] }));
      console.log(`📤 Found ${materialOut.length} material outward entries`);
      
      // Get all distribution entries to exclude already distributed items
      const distributionsSnapshot = await getDocs(collection(db, 'distributions'));
      const distributions = distributionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string; products: any[] }));
      console.log(`🚚 Found ${distributions.length} distribution entries`);
      
      // Track serials and quantities by product
      const serialsByProduct = new Map();
      const qtyByProduct = new Map();
      
      // Add from material inward
      materialInward.forEach(entry => {
        entry.products?.forEach((product: any) => {
          const prodId = product.productId;
          if (!serialsByProduct.has(prodId)) {
            serialsByProduct.set(prodId, new Set());
            qtyByProduct.set(prodId, 0);
          }
          
          if (product.serialNumbers && product.serialNumbers.length > 0) {
            product.serialNumbers.forEach((serial: string) => {
              serialsByProduct.get(prodId).add(serial);
            });
          } else {
            qtyByProduct.set(prodId, qtyByProduct.get(prodId) + (product.quantity || 0));
          }
        });
      });
      
      // Add from purchases
      purchases.forEach(purchase => {
        purchase.products?.forEach((product: any) => {
          const prodId = product.productId;
          if (!serialsByProduct.has(prodId)) {
            serialsByProduct.set(prodId, new Set());
            qtyByProduct.set(prodId, 0);
          }
          
          if (product.serialNumbers && product.serialNumbers.length > 0) {
            product.serialNumbers.forEach((serial: string) => {
              serialsByProduct.get(prodId).add(serial);
            });
          } else {
            qtyByProduct.set(prodId, qtyByProduct.get(prodId) + (product.quantity || 0));
          }
        });
      });
      
      // Remove from material outward
      materialOut.forEach(entry => {
        entry.products?.forEach((product: any) => {
          const prodId = product.productId;
          if (serialsByProduct.has(prodId)) {
            if (product.serialNumbers && product.serialNumbers.length > 0) {
              product.serialNumbers.forEach((serial: string) => {
                serialsByProduct.get(prodId).delete(serial);
              });
            } else {
              qtyByProduct.set(prodId, Math.max(0, qtyByProduct.get(prodId) - (product.quantity || 0)));
            }
          }
        });
      });
      
      // Remove from distributions
      distributions.forEach(distribution => {
        distribution.products?.forEach((product: any) => {
          const prodId = product.productId;
          if (serialsByProduct.has(prodId)) {
            if (product.serialNumbers && product.serialNumbers.length > 0) {
              product.serialNumbers.forEach((serial: string) => {
                serialsByProduct.get(prodId).delete(serial);
              });
            } else {
              qtyByProduct.set(prodId, Math.max(0, qtyByProduct.get(prodId) - (product.quantity || 0)));
            }
          }
        });
      });
      
      // Build available items list
      const items: AvailableItem[] = [];
      
      serialsByProduct.forEach((serials, productId) => {
        const product = prodMap.get(productId);
        if (!product) return;
        
        // Add serial-tracked items
        serials.forEach((serial: string) => {
          items.push({
            productId,
            productName: product.name,
            name: product.name,
            type: product.type,
            company: product.company,
            serialNumber: serial,
            isSerialTracked: true,
            quantity: 1,
            mrp: Number(product.mrp) || 0,
            dealerPrice: Number(product.dealerPrice) || 0,
            gstApplicable: product.gstApplicable || false,
            gstPercentage: Number(product.gstPercentage) || 18,
            status: 'In Stock',
            location: 'Main Warehouse',
            hsnCode: product.hsnCode || '',
          });
        });
        
        // Add quantity-based items
        const availableQty = qtyByProduct.get(productId) || 0;
        if (availableQty > 0) {
          items.push({
            productId,
            productName: product.name,
            name: product.name,
            type: product.type,
            company: product.company,
            isSerialTracked: false,
            quantity: availableQty,
            mrp: Number(product.mrp) || 0,
            dealerPrice: Number(product.dealerPrice) || 0,
            gstApplicable: product.gstApplicable || false,
            gstPercentage: Number(product.gstPercentage) || 18,
            status: 'In Stock',
            location: 'Main Warehouse',
            hsnCode: product.hsnCode || '',
          });
        }
      });
      
      console.log(`✅ Built ${items.length} available inventory items`);
      setAvailableInventory(items);
      
    } catch (error) {
      console.error('❌ Error fetching available inventory:', error);
    } finally {
      setInventoryLoading(false);
    }
  };



  // Get unique values for filters
  // Helper functions for hierarchical navigation
  const getUniqueTypes = () => {
    return [...new Set(availableInventory.map(item => item.type).filter(Boolean))];
  };

  const getCompaniesByType = (type: string) => {
    return [...new Set(availableInventory
      .filter(item => item.type === type)
      .map(item => item.company)
      .filter(Boolean))];
  };

  const getModelsByTypeAndCompany = (type: string, company: string) => {
    const productsByTypeCompany = availableInventory.filter(item => 
      item.type === type && item.company === company
    );
    // Group by product name (model)
    const modelMap = new Map();
    productsByTypeCompany.forEach(item => {
      if (!modelMap.has(item.productName)) {
        modelMap.set(item.productName, {
          modelName: item.productName,
          productId: item.productId,
          totalUnits: 0,
          serialNumbers: [],
          items: []
        });
      }
      const model = modelMap.get(item.productName);
      model.totalUnits += item.isSerialTracked ? 1 : (item.quantity || 0);
      if (item.serialNumber) {
        model.serialNumbers.push(item.serialNumber);
      }
      model.items.push(item);
    });
    return Array.from(modelMap.values());
  };

  const getProductsByTypeCompanyModel = (type: string, company: string, model: string) => {
    return availableInventory.filter(item => 
      item.type === type && 
      item.company === company && 
      item.productName === model
    );
  };

  const resetSelection = () => {
    setSelectedType('');
    setSelectedCompany('');
    setSelectedModel('');
    setSelectionMode('types');
    setSelectedItems([]);
    setSearchTerm('');
  };

  const uniqueTypes = getUniqueTypes();
  const uniqueCompanies = selectedType ? getCompaniesByType(selectedType) : [];
  const availableModels = selectedType && selectedCompany ? getModelsByTypeAndCompany(selectedType, selectedCompany) : [];
  const availableProducts = selectedType && selectedCompany && selectedModel ? getProductsByTypeCompanyModel(selectedType, selectedCompany, selectedModel) : [];

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = distributionData.products.reduce((sum, product) => {
      const productTotal = (product.finalPrice || product.dealerPrice || 0) * product.quantity;
      return sum + productTotal;
    }, 0);
    
    const totalGst = distributionData.products.reduce((sum, product) => {
      if (product.gstApplicable) {
        const productTotal = (product.finalPrice || product.dealerPrice || 0) * product.quantity;
        const gstAmount = (productTotal * (product.gstPercentage || 18)) / 100;
        return sum + gstAmount;
      }
      return sum;
    }, 0);
    
    const total = subtotal + totalGst;
    
    setDistributionData(prev => ({
      ...prev,
      subtotalAmount: subtotal,
      gstAmount: totalGst,
      totalAmount: total,
    }));
  };

  // Update totals when products change
  useEffect(() => {
    calculateTotals();
  }, [distributionData.products]);

  // Add single product to distribution
  const addProduct = () => {
    if (!currentProduct.productId) {
      setErrors({ product: 'Please select a product' });
      return;
    }
    
    if (currentProduct.quantity <= 0) {
      setErrors({ quantity: 'Quantity must be greater than 0' });
      return;
    }
    
    // Check available quantity for non-serial items
    if (!currentProduct.serialNumbers.length) {
      const availableItem = availableInventory.find(item => 
        item.productId === currentProduct.productId && !item.isSerialTracked
      );
      if (availableItem && currentProduct.quantity > availableItem.quantity!) {
        setErrors({ quantity: `Only ${availableItem.quantity} units available` });
        return;
      }
    }
    
    const newProduct: DistributionProduct = {
      ...currentProduct,
      finalPrice: currentProduct.dealerPrice! - (currentProduct.discountAmount || 0),
      gstAmount: currentProduct.gstApplicable 
        ? ((currentProduct.dealerPrice! - (currentProduct.discountAmount || 0)) * currentProduct.quantity * (currentProduct.gstPercentage! / 100))
        : 0,
      totalAmount: ((currentProduct.dealerPrice! - (currentProduct.discountAmount || 0)) * currentProduct.quantity) + 
                   (currentProduct.gstApplicable 
                     ? ((currentProduct.dealerPrice! - (currentProduct.discountAmount || 0)) * currentProduct.quantity * (currentProduct.gstPercentage! / 100))
                     : 0),
    };
    
    setDistributionData(prev => ({
      ...prev,
      products: [...prev.products, newProduct]
    }));
    
    // Reset current product
    setCurrentProduct({
      productId: '',
      name: '',
      type: '',
      company: '',
      serialNumbers: [],
      quantity: 1,
      dealerPrice: 0,
      mrp: 0,
      discountPercent: 0,
      discountAmount: 0,
      finalPrice: 0,
      gstApplicable: false,
      gstPercentage: 0,
      gstAmount: 0,
      totalAmount: 0,
      quantityType: 'piece',
      condition: 'new',
    });
    setSerialNumber('');
    setErrors({});
  };

  // Add multiple selected products to distribution
  const addSelectedProducts = () => {
    if (selectedItems.length === 0) {
      setErrors({ bulk: 'Please select at least one product' });
      return;
    }

    const newProducts: DistributionProduct[] = [];
    
    // Group selected items by product
    const groupedItems = selectedItems.reduce((acc, item) => {
      if (!acc[item.productId]) {
        acc[item.productId] = {
          productInfo: item,
          serialNumbers: [],
          totalQuantity: 0
        };
      }
      
      if (item.serialNumber) {
        acc[item.productId].serialNumbers.push(item.serialNumber);
        acc[item.productId].totalQuantity += 1;
      } else {
        acc[item.productId].totalQuantity += item.quantity || 1;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Create distribution products from grouped items
    Object.values(groupedItems).forEach((group: any) => {
      const item = group.productInfo;
      const basePrice = item.dealerPrice || 0;
      const distributionPrice = item.distributionPrice || basePrice;
      const finalPrice = distributionPrice;
      const quantity = group.totalQuantity;
      
      const gstAmount = item.gstApplicable 
        ? (finalPrice * quantity * (item.gstPercentage / 100))
        : 0;
      
      const totalAmount = (finalPrice * quantity) + gstAmount;
      const discountPercent = ((basePrice - distributionPrice) / basePrice) * 100;

      newProducts.push({
        productId: item.productId,
        name: item.productName,
        type: item.type || '',
        company: item.company || '',
        serialNumbers: group.serialNumbers,
        quantity: quantity,
        dealerPrice: basePrice,
        distributionPrice: distributionPrice,
        mrp: item.mrp || 0,
        discountPercent: discountPercent,
        discountAmount: basePrice - distributionPrice,
        finalPrice: finalPrice,
        gstApplicable: item.gstApplicable || false,
        gstPercentage: item.gstPercentage || 18,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        quantityType: 'piece',
        condition: 'new',
      });
    });

    setDistributionData(prev => ({
      ...prev,
      products: [...prev.products, ...newProducts]
    }));

    // Reset selection
    setSelectedItems([]);
    setBulkSelectionOpen(false);
    setInventoryDialogOpen(false);
    resetSelection();
    setErrors({});
  };

  // Remove product from distribution
  const removeProduct = (index: number) => {
    setDistributionData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  // Select inventory item
  const selectInventoryItem = (item: AvailableItem) => {
    setCurrentProduct({
      productId: item.productId,
      name: item.productName,
      type: item.type || '',
      company: item.company || '',
      serialNumbers: item.serialNumber ? [item.serialNumber] : [],
      quantity: item.isSerialTracked ? 1 : Math.min(item.quantity || 1, 1),
      dealerPrice: item.dealerPrice || 0,
      mrp: item.mrp || 0,
      discountPercent: 0,
      discountAmount: 0,
      finalPrice: item.dealerPrice || 0,
      gstApplicable: item.gstApplicable || false,
      gstPercentage: item.gstPercentage || 18,
      gstAmount: 0,
      totalAmount: 0,
      quantityType: 'piece',
      condition: 'new',
      availableQuantity: item.quantity || 1,
    });
    setInventoryDialogOpen(false);
  };

  // Navigation
  const handleNext = () => {
    if (validateStep()) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const validateStep = () => {
    const newErrors: Record<string, string> = {};
    
    switch (activeStep) {
      case 0:
        if (!distributionData.invoiceNumber) newErrors.invoiceNumber = 'Invoice number is required';
        if (!distributionData.dealer.id) newErrors.dealer = 'Please select a dealer';
        break;
      case 1:
        if (distributionData.products.length === 0) {
          newErrors.products = 'Please add at least one product';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateStep()) {
      onSave(distributionData);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Distribution Details</Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Invoice Number"
                  value={distributionData.invoiceNumber}
                  onChange={(e) => setDistributionData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                  error={!!errors.invoiceNumber}
                  helperText={errors.invoiceNumber}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={dealers}
                  getOptionLabel={(option) => option.name}
                  value={dealers.find(d => d.id === distributionData.dealer.id) || null}
                  onChange={(event, newValue) => {
                    setDistributionData(prev => ({
                      ...prev,
                      dealer: newValue ? { id: newValue.id, name: newValue.name } : { id: '', name: '' }
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Dealer"
                      error={!!errors.dealer}
                      helperText={errors.dealer}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Distribution Date"
                    value={distributionData.distributionDate.toDate()}
                    onChange={(newValue) => {
                      if (newValue) {
                        setDistributionData(prev => ({
                          ...prev,
                          distributionDate: Timestamp.fromDate(newValue)
                        }));
                      }
                    }}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} md={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Due Date (Optional)"
                    value={distributionData.dueDate?.toDate() || null}
                    onChange={(newValue) => {
                      setDistributionData(prev => ({
                        ...prev,
                        dueDate: newValue ? Timestamp.fromDate(newValue) : undefined
                      }));
                    }}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Notes (Optional)"
                  value={distributionData.notes || ''}
                  onChange={(e) => setDistributionData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Product Selection</Typography>
            
            {/* Add Product Section */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Add Products</Typography>
              
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => setInventoryDialogOpen(true)}
                  startIcon={<InventoryIcon />}
                  fullWidth
                >
                  {currentProduct.productId ? 
                    `${currentProduct.name} (${currentProduct.company})` : 
                    'Select from Available Inventory'
                  }
                </Button>
              </Stack>

              {currentProduct.productId && (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Quantity"
                      value={currentProduct.quantity}
                      onChange={(e) => setCurrentProduct(prev => ({ 
                        ...prev, 
                        quantity: parseInt(e.target.value) || 0 
                      }))}
                      inputProps={{ min: 1, max: currentProduct.availableQuantity || 999 }}
                      error={!!errors.quantity}
                      helperText={errors.quantity || `Available: ${currentProduct.availableQuantity || 0}`}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Dealer Price"
                      value={currentProduct.dealerPrice}
                      onChange={(e) => setCurrentProduct(prev => ({ 
                        ...prev, 
                        dealerPrice: parseFloat(e.target.value) || 0 
                      }))}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Discount Amount"
                      value={currentProduct.discountAmount}
                      onChange={(e) => setCurrentProduct(prev => ({ 
                        ...prev, 
                        discountAmount: parseFloat(e.target.value) || 0 
                      }))}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button
                      variant="contained"
                      onClick={addProduct}
                      startIcon={<AddIcon />}
                      fullWidth
                      sx={{ height: '56px' }}
                    >
                      Add Product
                    </Button>
                  </Grid>
                </Grid>
              )}
            </Paper>

            {/* Products Table */}
            {distributionData.products.length > 0 && (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product Details</TableCell>
                      <TableCell>Type & Company</TableCell>
                      <TableCell>Serial Numbers</TableCell>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Pricing</TableCell>
                      <TableCell>GST</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {distributionData.products.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                              {product.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {product.productId}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">{product.type}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {product.company}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {product.serialNumbers.length > 0 ? (
                            <Box>
                              {product.serialNumbers.slice(0, 3).map((serial, idx) => (
                                <Chip
                                  key={idx}
                                  label={serial}
                                  size="small"
                                  sx={{ mr: 0.5, mb: 0.5 }}
                                />
                              ))}
                              {product.serialNumbers.length > 3 && (
                                <Chip
                                  label={`+${product.serialNumbers.length - 3} more`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Bulk quantity
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="h6" color="primary">
                            {product.quantity}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {product.quantityType}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              MRP: ₹{product.mrp?.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                              Dealer: ₹{product.dealerPrice?.toLocaleString()}
                            </Typography>
                            {product.discountAmount! > 0 && (
                              <Typography variant="caption" color="warning.main">
                                Discount: ₹{product.discountAmount?.toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {product.gstApplicable ? (
                            <Box>
                              <Chip
                                label={`${product.gstPercentage}%`}
                                size="small"
                                color="secondary"
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                ₹{product.gstAmount?.toLocaleString()}
                              </Typography>
                            </Box>
                          ) : (
                            <Chip label="Exempt" size="small" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
                            ₹{product.totalAmount?.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeProduct(index)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                        Total Distribution Value:
                      </TableCell>
                      <TableCell>
                        <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold' }}>
                          ₹{distributionData.totalAmount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </TableContainer>
            )}

            {errors.products && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {errors.products}
              </Alert>
            )}
          </Box>
        );

      case 2:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Pricing & GST Details</Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Status</InputLabel>
                  <Select
                    value={distributionData.paymentStatus}
                    label="Payment Status"
                    onChange={(e) => setDistributionData(prev => ({ 
                      ...prev, 
                      paymentStatus: e.target.value as 'pending' | 'partial' | 'paid' 
                    }))}
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="partial">Partial</MenuItem>
                    <MenuItem value="paid">Paid</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Delivery Status</InputLabel>
                  <Select
                    value={distributionData.deliveryStatus}
                    label="Delivery Status"
                    onChange={(e) => setDistributionData(prev => ({ 
                      ...prev, 
                      deliveryStatus: e.target.value as 'pending' | 'dispatched' | 'delivered' 
                    }))}
                  >
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="dispatched">Dispatched</MenuItem>
                    <MenuItem value="delivered">Delivered</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Pricing Summary */}
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Pricing Summary</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="primary">
                      ₹{distributionData.subtotalAmount.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Subtotal Amount
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="warning.main">
                      ₹{distributionData.gstAmount.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      GST Amount
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center', p: 2 }}>
                    <Typography variant="h4" color="success.main">
                      ₹{distributionData.totalAmount.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Amount
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>Review & Summary</Typography>
            
            {/* Distribution Details Summary */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                Distribution Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Invoice Number:</Typography>
                  <Typography variant="body1">{distributionData.invoiceNumber}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Dealer:</Typography>
                  <Typography variant="body1">{distributionData.dealer.name}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Distribution Date:</Typography>
                  <Typography variant="body1">
                    {distributionData.distributionDate.toDate().toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Due Date:</Typography>
                  <Typography variant="body1">
                    {distributionData.dueDate?.toDate().toLocaleDateString() || 'Not specified'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            {/* Products Summary */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                Products ({distributionData.products.length} items)
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>GST</TableCell>
                      <TableCell>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {distributionData.products.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell>₹{product.finalPrice?.toLocaleString()}</TableCell>
                        <TableCell>
                          {product.gstApplicable ? `${product.gstPercentage}%` : 'Exempt'}
                        </TableCell>
                        <TableCell>₹{product.totalAmount?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Final Amount Summary */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                Amount Summary
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Subtotal:</Typography>
                <Typography>₹{distributionData.subtotalAmount.toLocaleString()}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>GST:</Typography>
                <Typography>₹{distributionData.gstAmount.toLocaleString()}</Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6">Total Amount:</Typography>
                <Typography variant="h6" color="primary">
                  ₹{distributionData.totalAmount.toLocaleString()}
                </Typography>
              </Box>
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 3 }}>
        <Button onClick={onCancel} variant="outlined">
          Cancel
        </Button>
        <Box>
          {activeStep > 0 && (
            <Button onClick={handleBack} sx={{ mr: 1 }}>
              Back
            </Button>
          )}
          {activeStep < steps.length - 1 ? (
            <Button variant="contained" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button variant="contained" onClick={handleSave}>
              Save Distribution
            </Button>
          )}
        </Box>
      </Box>

      {/* Enhanced Inventory Selection Dialog */}
      <Dialog
        open={inventoryDialogOpen}
        onClose={() => {
          setInventoryDialogOpen(false);
          resetSelection();
        }}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Select Products for Distribution ({selectedItems.length} selected)
            </Typography>
            <IconButton
              onClick={() => {
                setInventoryDialogOpen(false);
                resetSelection();
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          {inventoryLoading && <LinearProgress sx={{ mt: 1 }} />}
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          {/* Navigation Breadcrumb */}
          {!searchTerm && (
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant={selectionMode === 'types' ? 'contained' : 'text'}
                  size="small"
                  onClick={() => {
                    setSelectionMode('types');
                    setSelectedType('');
                    setSelectedCompany('');
                    setSelectedModel('');
                  }}
                >
                  Types
                </Button>
                {selectedType && (
                  <>
                    <Typography color="text.secondary">›</Typography>
                    <Button
                      variant={selectionMode === 'companies' ? 'contained' : 'text'}
                      size="small"
                      onClick={() => {
                        setSelectionMode('companies');
                        setSelectedCompany('');
                        setSelectedModel('');
                      }}
                    >
                      {selectedType}
                    </Button>
                  </>
                )}
                {selectedCompany && (
                  <>
                    <Typography color="text.secondary">›</Typography>
                    <Button
                      variant={selectionMode === 'models' ? 'contained' : 'text'}
                      size="small"
                      onClick={() => {
                        setSelectionMode('models');
                        setSelectedModel('');
                      }}
                    >
                      {selectedCompany}
                    </Button>
                  </>
                )}
                {selectedModel && (
                  <>
                    <Typography color="text.secondary">›</Typography>
                    <Button
                      variant={selectionMode === 'products' ? 'contained' : 'text'}
                      size="small"
                    >
                      {selectedModel}
                    </Button>
                  </>
                )}
              </Stack>
            </Box>
          )}

          {/* Search Bar */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              placeholder="Search products, models, or serial numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Content Area */}
          <Box sx={{ p: 2, height: 'calc(100% - 140px)', overflow: 'auto' }}>
            {searchTerm ? (
              // Search Results
              <Grid container spacing={2}>
                {availableInventory
                  .filter(item =>
                    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.type?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item, index) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                      <Card 
                        sx={{ 
                          cursor: 'pointer',
                          border: selectedItems.some(selected => 
                            selected.productId === item.productId && 
                            selected.serialNumber === item.serialNumber
                          ) ? 2 : 1,
                          borderColor: selectedItems.some(selected => 
                            selected.productId === item.productId && 
                            selected.serialNumber === item.serialNumber
                          ) ? 'primary.main' : 'divider',
                          transition: 'all 0.2s',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 3,
                          }
                        }}
                        onClick={() => {
                          const isSelected = selectedItems.some(selected => 
                            selected.productId === item.productId && 
                            selected.serialNumber === item.serialNumber
                          );
                          
                          if (isSelected) {
                            setSelectedItems(prev => prev.filter(selected => 
                              !(selected.productId === item.productId && 
                                selected.serialNumber === item.serialNumber)
                            ));
                          } else {
                            setSelectedItems(prev => [...prev, item]);
                          }
                        }}
                      >
                        <CardContent>
                          <Typography variant="subtitle2" noWrap>
                            {item.productName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {item.company} • {item.type}
                          </Typography>
                          
                          {item.serialNumber && (
                            <Chip
                              label={`SN: ${item.serialNumber}`}
                              size="small"
                              sx={{ mt: 1 }}
                            />
                          )}
                          
                          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                MRP: ₹{item.mrp?.toLocaleString()}
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                Dealer: ₹{item.dealerPrice?.toLocaleString()}
                              </Typography>
                            </Box>
                            <Chip
                              label={item.isSerialTracked ? '1 unit' : `${item.quantity} units`}
                              color="primary"
                              size="small"
                            />
                          </Box>
                          
                          {item.gstApplicable && (
                            <Chip
                              label={`GST: ${item.gstPercentage}%`}
                              size="small"
                              color="secondary"
                              sx={{ mt: 1 }}
                            />
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
              </Grid>
            ) : selectionMode === 'types' ? (
              // Product Types
              <Grid container spacing={3}>
                {uniqueTypes.map((type) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={type}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        textAlign: 'center',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                        transition: 'all 0.2s'
                      }}
                      onClick={() => {
                        setSelectedType(type || '');
                        setSelectionMode('companies');
                      }}
                    >
                      <CardContent>
                        <CategoryIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h6">{type}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {availableInventory.filter(item => item.type === type).length} items
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : selectionMode === 'companies' ? (
              // Companies
              <Grid container spacing={3}>
                {uniqueCompanies.map((company) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={company}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        textAlign: 'center',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                        transition: 'all 0.2s'
                      }}
                      onClick={() => {
                        setSelectedCompany(company || '');
                        setSelectionMode('models');
                      }}
                    >
                      <CardContent>
                        <BusinessIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h6">{company}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {availableInventory.filter(item => 
                            item.type === selectedType && item.company === company
                          ).length} items
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : selectionMode === 'models' ? (
              // Models
              <Grid container spacing={3}>
                {availableModels.map((model) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={model.modelName}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                        transition: 'all 0.2s'
                      }}
                      onClick={() => {
                        setSelectedModel(model.modelName);
                        setSelectionMode('products');
                      }}
                    >
                      <CardContent>
                        <Typography variant="h6" noWrap>{model.modelName}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {model.totalUnits} units available
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              MRP: ₹{model.items[0]?.mrp?.toLocaleString()}
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                              Dealer: ₹{model.items[0]?.dealerPrice?.toLocaleString()}
                            </Typography>
                          </Box>
                          {model.items[0]?.gstApplicable && (
                            <Chip
                              label={`GST: ${model.items[0]?.gstPercentage}%`}
                              size="small"
                              color="secondary"
                            />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              // Individual Products/Serial Numbers
              <Grid container spacing={2}>
                {availableProducts.map((item, index) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        border: selectedItems.some(selected => 
                          selected.productId === item.productId && 
                          selected.serialNumber === item.serialNumber
                        ) ? 2 : 1,
                        borderColor: selectedItems.some(selected => 
                          selected.productId === item.productId && 
                          selected.serialNumber === item.serialNumber
                        ) ? 'primary.main' : 'divider',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 3,
                        }
                      }}
                      onClick={() => {
                        const isSelected = selectedItems.some(selected => 
                          selected.productId === item.productId && 
                          selected.serialNumber === item.serialNumber
                        );
                        
                        if (isSelected) {
                          setSelectedItems(prev => prev.filter(selected => 
                            !(selected.productId === item.productId && 
                              selected.serialNumber === item.serialNumber)
                          ));
                        } else {
                          setSelectedItems(prev => [...prev, item]);
                        }
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle2" noWrap>
                            {item.productName}
                          </Typography>
                          {selectedItems.some(selected => 
                            selected.productId === item.productId && 
                            selected.serialNumber === item.serialNumber
                          ) && (
                            <Chip 
                              label="Selected" 
                              color="primary" 
                              size="small"
                              sx={{ fontWeight: 600 }}
                            />
                          )}
                        </Box>
                        
                        {item.serialNumber ? (
                          <Chip
                            label={`SN: ${item.serialNumber}`}
                            size="small"
                            color="info"
                            sx={{ mt: 1 }}
                          />
                        ) : (
                          <Chip
                            label={`${item.quantity} units`}
                            size="small"
                            color="info"
                            sx={{ mt: 1 }}
                          />
                        )}

                        <Box sx={{ mt: 2 }}>
                          {item.location && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              <strong>Location:</strong> {item.location}
                            </Typography>
                          )}
                          
                          {item.gstApplicable && (
                            <Box sx={{ mt: 1 }}>
                              <Chip
                                label={`GST: ${item.gstPercentage}%`}
                                size="small"
                                color="secondary"
                              />
                            </Box>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* No Results */}
            {((searchTerm && availableInventory.filter(item =>
              item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              item.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              item.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              item.type?.toLowerCase().includes(searchTerm.toLowerCase())
            ).length === 0) ||
            (selectionMode === 'types' && uniqueTypes.length === 0) ||
            (selectionMode === 'companies' && uniqueCompanies.length === 0) ||
            (selectionMode === 'models' && availableModels.length === 0) ||
            (selectionMode === 'products' && availableProducts.length === 0)) && !inventoryLoading && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <WarningIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No products available
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchTerm ? 'No products match your search criteria.' : 'No products available in this category.'}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              {selectedItems.length} items selected
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={() => {
                  setInventoryDialogOpen(false);
                  resetSelection();
                }}
                variant="outlined"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedItems.length > 0) {
                    // Group selected items by product type/name
                    const grouped = selectedItems.reduce((acc, item) => {
                      const key = `${item.productName}_${item.productId}`;
                      if (!acc[key]) {
                        acc[key] = [];
                      }
                      acc[key].push(item);
                      return acc;
                    }, {} as {[key: string]: AvailableItem[]});
                    
                    setProductGroups(grouped);
                    setPricingDialogOpen(true);
                  }
                }}
                variant="contained"
                disabled={selectedItems.length === 0}
                startIcon={<AddIcon />}
              >
                Next: Set Prices ({selectedItems.length})
              </Button>
            </Box>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Pricing Dialog */}
      <Dialog 
        open={pricingDialogOpen} 
        onClose={() => setPricingDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Set Distribution Prices
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Set dealer prices for each product group. Discount will be calculated automatically.
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {Object.entries(productGroups).map(([groupKey, items]) => {
              const firstItem = items[0];
              const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
              
              return (
                <Paper key={groupKey} sx={{ p: 3, mb: 2, border: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        {firstItem.productName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {items.length} units selected • Total Quantity: {totalQuantity}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Serial Numbers: {items.map(item => item.serialNumber).join(', ')}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" color="text.secondary">
                        Base Dealer Price
                      </Typography>
                      <Typography variant="h6" color="primary">
                        ₹{firstItem.dealerPrice?.toLocaleString() || 0}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                      label="Distribution Price (per unit)"
                      type="number"
                      value={firstItem.distributionPrice || firstItem.dealerPrice || 0}
                      onChange={(e) => {
                        const newPrice = Number(e.target.value);
                        const basePrice = firstItem.dealerPrice || 0;
                        const discountPercent = basePrice > 0 ? ((basePrice - newPrice) / basePrice * 100) : 0;
                        
                        setProductGroups(prev => ({
                          ...prev,
                          [groupKey]: items.map(item => ({
                            ...item,
                            distributionPrice: newPrice,
                            discountPercent: discountPercent
                          }))
                        }));
                      }}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                      sx={{ minWidth: 200 }}
                    />
                    
                    <Box sx={{ minWidth: 150 }}>
                      {(() => {
                        const distributionPrice = firstItem.distributionPrice || firstItem.dealerPrice || 0;
                        const dealerPrice = firstItem.dealerPrice || 0;
                        
                        if (distributionPrice !== dealerPrice && dealerPrice > 0) {
                          const discountPercent = ((dealerPrice - distributionPrice) / dealerPrice * 100);
                          const savings = (dealerPrice - distributionPrice) * totalQuantity;
                          
                          return (
                            <Box>
                              <Typography variant="body2" color="warning.main">
                                Discount: {discountPercent.toFixed(2)}%
                              </Typography>
                              <Typography variant="body2" color="success.main">
                                Total Save: ₹{savings.toLocaleString()}
                              </Typography>
                            </Box>
                          );
                        }
                        return (
                          <Typography variant="body2" color="text.secondary">
                            No discount applied
                          </Typography>
                        );
                      })()}
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={() => setPricingDialogOpen(false)}
            variant="outlined"
          >
            Back to Selection
          </Button>
          <Button
            onClick={() => {
              // Add all products with their pricing to the distribution
              const allProducts: DistributionProduct[] = [];
              
              Object.values(productGroups).flat().forEach(item => {
                const distributionPrice = item.distributionPrice || item.dealerPrice || 0;
                const basePrice = item.dealerPrice || 0;
                const discountPercent = basePrice > 0 ? ((basePrice - distributionPrice) / basePrice * 100) : 0;
                const discountAmount = basePrice - distributionPrice;
                const finalPrice = distributionPrice;
                const gstAmount = item.gstApplicable ? (finalPrice * (item.gstPercentage || 0) / 100) : 0;
                const totalAmount = finalPrice + gstAmount;

                allProducts.push({
                  productId: item.productId,
                  name: item.productName,
                  type: item.type || '',
                  company: item.company || '',
                  serialNumbers: [item.serialNumber || ''],
                  quantity: item.quantity || 1,
                  dealerPrice: basePrice,
                  distributionPrice: distributionPrice,
                  mrp: item.mrp,
                  discountPercent: discountPercent,
                  discountAmount: discountAmount,
                  finalPrice: finalPrice,
                  gstApplicable: item.gstApplicable,
                  gstPercentage: item.gstPercentage,
                  gstAmount: gstAmount,
                  totalAmount: totalAmount,
                  quantityType: 'piece',
                  condition: 'new',
                  availableQuantity: item.quantity
                });
              });

              // Add to distribution data
              setDistributionData(prev => ({
                ...prev,
                products: [...prev.products, ...allProducts]
              }));

              // Close dialogs and reset
              setPricingDialogOpen(false);
              setInventoryDialogOpen(false);
              resetSelection();
            }}
            variant="contained"
            disabled={Object.keys(productGroups).length === 0}
          >
            Add to Distribution
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DistributionForm;
