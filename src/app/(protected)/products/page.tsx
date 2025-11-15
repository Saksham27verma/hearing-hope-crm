'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Snackbar,
  Alert,
  TablePagination,
  FormControlLabel,
  Switch,
  FormHelperText,
  Grid,
  InputAdornment,
  Tooltip,
  Drawer,
  Checkbox,
  ListItemText,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Divider,
  Menu,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Hearing as HearingIcon,
  Battery90 as BatteryIcon,
  ElectricBolt as ChargerIcon,
  Headphones as AccessoryIcon,
  MoreHoriz as OthersIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Sort as SortIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';

import { useAuth } from '@/context/AuthContext';
import LoadingScreen from '@/components/common/LoadingScreen';
import { db } from '@/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

// Utility function to convert numbers to words (Indian numbering system)
const numberToWords = (num: number): string => {
  if (isNaN(num)) return '';
  if (num === 0) return 'Zero Rupees Only';
  
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convertLessThanOneThousand = (n: number): string => {
    if (n === 0) return '';
    
    if (n < 20) {
      return units[n];
    }
    
    const digit = n % 10;
    const ten = Math.floor(n / 10) % 10;
    const hundred = Math.floor(n / 100) % 10;
    
    let result = '';
    
    if (hundred > 0) {
      result += units[hundred] + ' Hundred';
      if (ten > 0 || digit > 0) {
        result += ' and ';
      }
    }
    
    if (ten > 0) {
      if (ten === 1) {
        result += units[10 + digit];
        return result;
      } else {
        result += tens[ten];
        if (digit > 0) {
          result += ' ' + units[digit];
        }
      }
    } else if (digit > 0) {
      result += units[digit];
    }
    
    return result;
  };
  
  // Handle numbers up to 99,99,999 (Indian numbering system)
  if (num < 0) return 'Negative ' + numberToWords(-num);
  
  let result = '';
  
  // Convert to Indian numbering system: lakhs (100,000) and crores (10,000,000)
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  
  const remaining = num;
  
  if (crore > 0) {
    result += convertLessThanOneThousand(crore) + ' Crore ';
  }
  
  if (lakh > 0) {
    result += convertLessThanOneThousand(lakh) + ' Lakh ';
  }
  
  if (thousand > 0) {
    result += convertLessThanOneThousand(thousand) + ' Thousand ';
  }
  
  if (remaining > 0) {
    result += convertLessThanOneThousand(remaining);
  }
  
  return result.trim() + ' Rupees Only';
};

// Product types
const PRODUCT_TYPES = [
  'Hearing Aid',
  'Charger',
  'Battery',
  'Accessory',
  'Other',
];

// Product categories
const PRODUCT_CATEGORIES = [
  'Free Accessory',
  'Charged Accessory',
  'Standard Product',
];

// Add GST percentage options constant
const GST_PERCENTAGES = [5, 12, 18, 28];

interface Product {
  id: string;
  name: string;
  type: string;
  company: string;
  hasSerialNumber?: boolean;
  mrp?: number;
  isFreeOfCost?: boolean;
  gstApplicable: boolean;
  gstType?: 'CGST' | 'IGST';
  gstPercentage?: number;
  hsnCode?: string;
  quantityType?: 'piece' | 'pair';
  createdAt: any;
  updatedAt: any;
}

export default function ProductsPage() {
  const { user, userProfile, loading, isAllowedModule } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('Add New Product');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Form state
  const [formData, setFormData] = useState<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>({
    name: '',
    type: '',
    company: '',
    hasSerialNumber: false,
    mrp: 0,
    isFreeOfCost: false,
    gstApplicable: true,
    gstType: 'CGST',
    gstPercentage: 18,
    hsnCode: '',
    quantityType: 'piece',
  });
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Add new state for product preview
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
  
  // Filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    productTypes: [] as string[],
    companies: [] as string[],
    gstApplicable: null as boolean | null,
    hasSerialNumber: null as boolean | null,
    priceRange: [0, 100000] as [number, number],
    isFreeOfCost: null as boolean | null,
  });
  
  // Sort state
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // For populating the company filter
  const [uniqueCompanies, setUniqueCompanies] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchProducts = async () => {
      if (!user) return;
      
      try {
        const productsCollection = collection(db, 'products');
        const productsSnapshot = await getDocs(productsCollection);
        
        const productsList = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[];
        
        // Extract unique companies for filters
        const companies = new Set<string>();
        productsList.forEach(product => {
          if (product.company) {
            companies.add(product.company);
          }
        });
        
        setUniqueCompanies(Array.from(companies).sort());
        setProducts(productsList);
      } catch (error) {
        console.error('Error fetching products:', error);
        setErrorMessage('Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user && !loading) {
      if (isAllowedModule('products')) {
        fetchProducts();
      } else {
        setIsLoading(false);
        setErrorMessage('You do not have permission to access this module');
      }
    }
  }, [user, loading, isAllowedModule]);
  
  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setDialogTitle('Edit Product');
      setEditingProduct(product);
      setFormData({
        name: product.name,
        type: product.type,
        company: product.company || '',
        hasSerialNumber: product.hasSerialNumber || false,
        mrp: product.mrp,
        isFreeOfCost: product.isFreeOfCost || false,
        gstApplicable: product.gstApplicable !== false,
        gstType: product.gstType || 'CGST',
        gstPercentage: product.gstPercentage || 18,
        hsnCode: product.hsnCode || '',
        quantityType: product.quantityType || 'piece',
      });
    } else {
      setDialogTitle('Add New Product');
      setEditingProduct(null);
      setFormData({
        name: '',
        type: '',
        company: '',
        hasSerialNumber: false,
        mrp: undefined,
        isFreeOfCost: false,
        gstApplicable: true,
        gstType: 'CGST',
        gstPercentage: 18,
        hsnCode: '',
        quantityType: 'piece',
      });
    }
    setOpenDialog(true);
  };
  
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'mrp' || name === 'gstPercentage') {
      // Ensure numeric fields never become undefined - use 0 as default
      const numValue = value === '' ? 0 : parseFloat(value) || 0;
      setFormData(prev => ({ ...prev, [name]: numValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async () => {
    try {
      // Form validation
      const validationErrors = [];
      
      if (!formData.name) validationErrors.push('Product name is required');
      if (!formData.type) validationErrors.push('Product type is required');
      
      if ((formData.type === 'Hearing Aid' || formData.type === 'Charger') && !formData.company) {
        validationErrors.push('Company is required');
      }
      
      if (!formData.isFreeOfCost && (formData.mrp || 0) <= 0) {
        validationErrors.push('Please enter a valid MRP');
      }
      
      if (validationErrors.length > 0) {
        setErrorMessage(validationErrors.join(', '));
        return;
      }
      
      if (editingProduct) {
        // Update existing product
        const productRef = doc(db, 'products', editingProduct.id);
        await updateDoc(productRef, {
          ...formData,
          // Ensure no undefined values are passed to Firebase
          mrp: formData.mrp || 0,
          gstPercentage: formData.gstPercentage || 0,
          hsnCode: formData.hsnCode || '',
          quantityType: formData.quantityType || 'piece',
          updatedAt: serverTimestamp(),
        });
        
        // Update local state
        const cleanedData = {
          ...formData,
          mrp: formData.mrp || 0,
          gstPercentage: formData.gstPercentage || 0,
          hsnCode: formData.hsnCode || '',
          quantityType: formData.quantityType || 'piece',
        };
        setProducts(prev => 
          prev.map(p => p.id === editingProduct.id 
            ? { ...p, ...cleanedData, updatedAt: new Date() } 
            : p
          )
        );
        
        setSuccessMessage('Product updated successfully');
      } else {
        // Add new product
        const newProduct = {
          ...formData,
          // Ensure no undefined values are passed to Firebase
          mrp: formData.mrp || 0,
          gstPercentage: formData.gstPercentage || 0,
          hsnCode: formData.hsnCode || '',
          quantityType: formData.quantityType || 'piece',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(db, 'products'), newProduct);
        
        // Update local state
        const now = new Date();
        const cleanedData = {
          ...formData,
          mrp: formData.mrp || 0,
          gstPercentage: formData.gstPercentage || 0,
          hsnCode: formData.hsnCode || '',
          quantityType: formData.quantityType || 'piece',
        };
        setProducts(prev => [
          ...prev, 
          { 
            id: docRef.id, 
            ...cleanedData, 
            createdAt: now, 
            updatedAt: now 
          }
        ]);
        
        setSuccessMessage('Product added successfully');
      }
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving product:', error);
      setErrorMessage('Failed to save product');
    }
  };
  
  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        
        // Update local state
        setProducts(prev => prev.filter(p => p.id !== id));
        
        setSuccessMessage('Product deleted successfully');
      } catch (error) {
        console.error('Error deleting product:', error);
        setErrorMessage('Failed to delete product');
      }
    }
  };
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  const handleGstToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, gstApplicable: e.target.checked }));
  };
  
  const handleFocToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => {
      const isFreeOfCost = e.target.checked;
      return { 
        ...prev, 
        isFreeOfCost,
        mrp: isFreeOfCost ? undefined : prev.mrp
      };
    });
  };
  
  const handleSerialNumberToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, hasSerialNumber: e.target.checked }));
  };
  
  // Create a new function to handle GST type change
  const handleGstTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value as 'CGST' | 'IGST';
    setFormData(prev => ({ ...prev, gstType: value }));
  };
  
  // Create a new function to handle GST percentage change
  const handleGstPercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setFormData(prev => ({ ...prev, gstPercentage: value }));
  };
  
  // Filter products based on search term and filters
  const filteredProducts = products.filter(product => {
    // Search term filter
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.company && product.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      product.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Product type filter
    if (filters.productTypes.length > 0 && !filters.productTypes.includes(product.type)) {
      return false;
    }
    
    // Company filter
    if (filters.companies.length > 0 && !filters.companies.includes(product.company)) {
      return false;
    }
    
    // GST Applicable filter
    if (filters.gstApplicable !== null && product.gstApplicable !== filters.gstApplicable) {
      return false;
    }
    
    // Serial number tracking filter
    if (filters.hasSerialNumber !== null && product.hasSerialNumber !== filters.hasSerialNumber) {
      return false;
    }
    
    // Free of cost filter
    if (filters.isFreeOfCost !== null && product.isFreeOfCost !== filters.isFreeOfCost) {
      return false;
    }
    
    // Price range filter - only apply to products with an MRP and not FOC
    if (!product.isFreeOfCost && product.mrp !== undefined) {
      if (product.mrp < filters.priceRange[0] || product.mrp > filters.priceRange[1]) {
        return false;
      }
    }
    
    return true;
  });
  
  // Sort filtered products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'type':
        aValue = a.type.toLowerCase();
        bValue = b.type.toLowerCase();
        break;
      case 'company':
        aValue = (a.company || '').toLowerCase();
        bValue = (b.company || '').toLowerCase();
        break;
      case 'mrp':
        aValue = a.mrp || 0;
        bValue = b.mrp || 0;
        break;
      default:
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });
  
  // Count active filters
  const activeFilterCount = (
    (filters.productTypes.length > 0 ? 1 : 0) +
    (filters.companies.length > 0 ? 1 : 0) +
    (filters.gstApplicable !== null ? 1 : 0) +
    (filters.hasSerialNumber !== null ? 1 : 0) +
    (filters.isFreeOfCost !== null ? 1 : 0) +
    (filters.priceRange[0] > 0 || filters.priceRange[1] < 100000 ? 1 : 0)
  );
  
  // Paginate products
  const paginatedProducts = sortedProducts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  
  // Create a common GST and HSN section to be used for all product types
  const renderGstAndHsnSection = () => (
    <Box sx={{ 
      p: 2, 
      mt: 2, 
      mb: 2, 
      border: '1px dashed rgba(0, 0, 0, 0.12)',
      borderRadius: 1,
      bgcolor: 'rgba(76, 175, 80, 0.04)'
    }}>
      <Typography variant="subtitle2" gutterBottom color="primary">
        Tax & Classification
      </Typography>
      
      <TextField
        name="hsnCode"
        label="HSN Code"
        value={formData.hsnCode}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        helperText="Harmonized System Nomenclature code for this product"
      />
      
      <FormControl fullWidth sx={{ mt: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={formData.gstApplicable}
              onChange={handleGstToggle}
              color="primary"
            />
          }
          label={`GST: ${formData.gstApplicable ? 'Applicable' : 'Exempted'}`}
        />
        <FormHelperText>
          {formData.gstApplicable 
            ? 'GST will be applied to this product during purchases and sales' 
            : 'This product is exempted from GST'}
        </FormHelperText>
      </FormControl>
      
      {formData.gstApplicable && (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="gst-type-label">GST Type</InputLabel>
                <Select
                  labelId="gst-type-label"
                  value={formData.gstType}
                  label="GST Type"
                  onChange={(e) => handleGstTypeChange(e as any)}
                >
                  <MenuItem value="CGST">CGST</MenuItem>
                  <MenuItem value="IGST">IGST</MenuItem>
                </Select>
                <FormHelperText>
                  CGST for within state, IGST for interstate
                </FormHelperText>
              </FormControl>
            </Box>
            <Box sx={{ flex: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="gst-percentage-label">GST Percentage</InputLabel>
                <Select
                  labelId="gst-percentage-label"
                  value={formData.gstPercentage}
                  label="GST Percentage"
                  onChange={(e) => handleGstPercentageChange(e as any)}
                >
                  {GST_PERCENTAGES.map(percentage => (
                    <MenuItem key={percentage} value={percentage}>
                      {percentage}%
                    </MenuItem>
                  ))}
                  <MenuItem value={0}>Custom</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
          
          {formData.gstPercentage === 0 && (
            <Box sx={{ mt: 2 }}>
              <TextField
                label="Custom GST Percentage"
                type="number"
                value={formData.gstPercentage === 0 ? '' : formData.gstPercentage}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  gstPercentage: e.target.value === '' ? 0 : Number(e.target.value) 
                }))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                fullWidth
                size="small"
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
  
  // Create a product type selection component
  const renderProductTypeSelection = () => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" gutterBottom>
        Product Type:
      </Typography>
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' }, 
        gap: 2 
      }}>
        {[
          { type: 'Hearing Aid', icon: <HearingIcon fontSize="large" />, color: '#0288d1' },
          { type: 'Charger', icon: <ChargerIcon fontSize="large" />, color: '#00a152' },
          { type: 'Battery', icon: <BatteryIcon fontSize="large" />, color: '#f57c00' },
          { type: 'Accessory', icon: <AccessoryIcon fontSize="large" />, color: '#7b1fa2' },
          { type: 'Other', icon: <OthersIcon fontSize="large" />, color: '#757575' },
        ].map((item) => (
          <Box 
            key={item.type}
            onClick={() => handleSelectChange({ target: { name: 'type', value: item.type } } as any)}
            sx={{ 
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid',
              borderColor: formData.type === item.type ? item.color : 'divider',
              borderRadius: 2,
              bgcolor: formData.type === item.type ? `${item.color}10` : 'background.paper',
              boxShadow: formData.type === item.type ? 1 : 0,
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              minHeight: 120,
              '&:hover': {
                borderColor: item.color,
                bgcolor: `${item.color}08`,
                transform: 'translateY(-2px)'
              },
            }}
          >
            <Box 
              sx={{ 
                color: item.color,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: `${item.color}15`,
              }}
            >
              {item.icon}
            </Box>
            <Typography 
              variant="body1" 
              fontWeight={formData.type === item.type ? 'bold' : 'normal'}
              color={formData.type === item.type ? item.color : 'text.primary'}
              align="center"
            >
              {item.type}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
  
  // Handle opening the preview dialog
  const handlePreviewOpen = (product: Product) => {
    setPreviewProduct(product);
    setOpenPreviewDialog(true);
  };
  
  // Handle closing the preview dialog
  const handlePreviewClose = () => {
    setOpenPreviewDialog(false);
    setPreviewProduct(null);
  };
  
  // Handle editing from the preview dialog
  const handleEditFromPreview = () => {
    if (previewProduct) {
      setOpenPreviewDialog(false);
      handleOpenDialog(previewProduct);
    }
  };
  
  // Create a component to render product details in preview
  const renderProductDetails = (product: Product) => {
    const typeColors: Record<string, string> = {
      'Hearing Aid': '#0288d1',
      'Charger': '#00a152',
      'Battery': '#f57c00',
      'Accessory': '#7b1fa2',
      'Other': '#757575'
    };
    const color = typeColors[product.type] || '#757575';
    
    return (
      <Box>
        {/* Product Name and Type */}
        <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
            {product.name}
          </Typography>
          <Chip 
            label={product.type} 
            size="small"
            sx={{ 
              bgcolor: `${color}15`,
              color: color,
              fontWeight: 'medium',
              border: `1px solid ${color}30`,
              px: 1
            }}
          />
        </Box>
        
        {/* Product Info Cards */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 3
        }}>
          {/* Company */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Company
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {product.company || 'Not specified'}
            </Typography>
          </Paper>
          
          {/* MRP */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              MRP
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {product.isFreeOfCost ? (
                <Chip label="Free of Cost" color="secondary" size="small" />
              ) : product.mrp !== undefined ? (
                `₹${product.mrp.toLocaleString('en-IN')}`
              ) : (
                'Not specified'
              )}
            </Typography>
          </Paper>
          
          {/* HSN Code */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              HSN Code
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {product.hsnCode || 'Not specified'}
            </Typography>
          </Paper>
          
          {/* GST Info */}
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              GST Details
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {product.gstApplicable ? (
                <>
                  {product.gstType || 'CGST'} @ {product.gstPercentage || 18}%
                </>
              ) : (
                <Chip label="GST Exempted" color="default" size="small" />
              )}
            </Typography>
          </Paper>
        </Box>
        
        {/* Additional Details */}
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          Additional Details
        </Typography>
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          mb: 3
        }}>
          {/* Tracks Serial Numbers */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              Tracks Serial Numbers:
            </Typography>
            {product.hasSerialNumber ? (
              <Chip label="Yes" color="success" size="small" variant="outlined" />
            ) : (
              <Chip label="No" color="default" size="small" variant="outlined" />
            )}
          </Box>
          
          {/* Quantity Type for Hearing Aids */}
          {product.type === 'Hearing Aid' && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ mr: 1 }}>
                Quantity Type:
              </Typography>
              <Chip 
                label={product.quantityType === 'pair' ? "Pairs" : "Pieces"} 
                color="info" 
                size="small" 
                variant="outlined" 
              />
            </Box>
          )}
          
          {/* Created At */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              Created:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {product.createdAt ? new Date(product.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
            </Typography>
          </Box>
          
          {/* Updated At */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              Last Updated:
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {product.updatedAt ? new Date(product.updatedAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  };
  
  // Toggle filters drawer
  const toggleFilters = () => {
    setFiltersOpen(!filtersOpen);
  };
  
  // Update filters
  const handleFilterChange = (filterType: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };
  
  // Reset all filters
  const resetFilters = () => {
    setFilters({
      productTypes: [],
      companies: [],
      gstApplicable: null,
      hasSerialNumber: null,
      priceRange: [0, 100000],
      isFreeOfCost: null,
    });
  };
  
  // Update sort options
  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };
  
  if (loading || isLoading) {
    return <LoadingScreen />;
  }
  
  return (
    <>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Product Management</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Product
        </Button>
      </Box>
      
      <Paper sx={{ mb: 4, p: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box mb={3} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
          <TextField
            fullWidth
            variant="outlined"
            label="Search Products"
            value={searchTerm}
            onChange={handleSearch}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'primary.main' }} />,
            }}
            placeholder="Search by name, company or type..."
            sx={{ maxWidth: { md: 400 } }}
            size="small"
          />
          
          <Box display="flex" gap={2}>
            <Button 
              variant="outlined" 
              color="primary" 
              startIcon={<FilterListIcon />}
              onClick={toggleFilters}
              sx={{ 
                borderRadius: 1.5,
                position: 'relative',
              }}
            >
              Filters
              {activeFilterCount > 0 && (
                <Chip 
                  label={activeFilterCount} 
                  color="primary" 
                  size="small" 
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    height: 20,
                    minWidth: 20,
                    fontSize: '0.75rem',
                  }}
                />
              )}
            </Button>
            
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ 
                borderRadius: 1.5, 
                boxShadow: 2,
                px: 3,
                whiteSpace: 'nowrap'
              }}
            >
              Add Product
            </Button>
          </Box>
        </Box>
        
        {/* Active Filters */}
        {activeFilterCount > 0 && (
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 1, 
            mb: 2, 
            p: 1.5, 
            bgcolor: 'background.default', 
            borderRadius: 1 
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              Active Filters:
            </Typography>
            
            {filters.productTypes.length > 0 && (
              <Chip
                label={`Types: ${filters.productTypes.join(', ')}`}
                onDelete={() => handleFilterChange('productTypes', [])}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            
            {filters.companies.length > 0 && (
              <Chip
                label={`Companies: ${filters.companies.join(', ')}`}
                onDelete={() => handleFilterChange('companies', [])}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            
            {filters.gstApplicable !== null && (
              <Chip
                label={`GST: ${filters.gstApplicable ? 'Applicable' : 'Exempt'}`}
                onDelete={() => handleFilterChange('gstApplicable', null)}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            
            {filters.hasSerialNumber !== null && (
              <Chip
                label={`Serial Tracking: ${filters.hasSerialNumber ? 'Yes' : 'No'}`}
                onDelete={() => handleFilterChange('hasSerialNumber', null)}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            
            {filters.isFreeOfCost !== null && (
              <Chip
                label={`FOC: ${filters.isFreeOfCost ? 'Yes' : 'No'}`}
                onDelete={() => handleFilterChange('isFreeOfCost', null)}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            
            {(filters.priceRange[0] > 0 || filters.priceRange[1] < 100000) && (
              <Chip
                label={`MRP: ₹${filters.priceRange[0]} - ₹${filters.priceRange[1]}`}
                onDelete={() => handleFilterChange('priceRange', [0, 100000])}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            
            <Button
              size="small"
              startIcon={<ClearIcon />}
              onClick={resetFilters}
              sx={{ ml: 'auto' }}
            >
              Clear All
            </Button>
          </Box>
        )}
        
        {/* Sort Control */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end', 
          mb: 2, 
          gap: 1 
        }}>
          <Typography variant="body2" color="text.secondary">
            Sort by:
          </Typography>
          
          <ToggleButtonGroup
            size="small"
            value={sortBy}
            exclusive
            onChange={(e, value) => value && handleSortChange(value)}
            aria-label="sort by"
          >
            <ToggleButton value="name">
              Name {sortBy === 'name' && (
                sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
              )}
            </ToggleButton>
            <ToggleButton value="type">
              Type {sortBy === 'type' && (
                sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
              )}
            </ToggleButton>
            <ToggleButton value="company">
              Company {sortBy === 'company' && (
                sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
              )}
            </ToggleButton>
            <ToggleButton value="mrp">
              MRP {sortBy === 'mrp' && (
                sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
              )}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        <TableContainer sx={{ 
          border: '1px solid rgba(0,0,0,0.05)', 
          borderRadius: 2, 
          maxHeight: 'calc(100vh - 300px)', 
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '4px',
          }
        }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 'bold', bgcolor: 'primary.lighter' } }}>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>HSN Code</TableCell>
                <TableCell align="center">Tracks S/N</TableCell>
                <TableCell align="right">MRP (₹)</TableCell>
                <TableCell align="center">GST</TableCell>
                <TableCell align="center">Quantity Type</TableCell>
                <TableCell align="center">FOC</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((product) => (
                  <TableRow 
                    key={product.id}
                    hover
                    onClick={() => handlePreviewOpen(product)}
                    sx={{ 
                      '&:nth-of-type(odd)': { bgcolor: 'background.default' },
                      '&:hover': { bgcolor: 'action.hover' },
                      cursor: 'pointer'
                    }}
                  >
                    <TableCell sx={{ fontWeight: 'medium' }}>{product.name}</TableCell>
                    <TableCell>
                      {(() => {
                        const typeColors: Record<string, string> = {
                          'Hearing Aid': '#0288d1',
                          'Charger': '#00a152',
                          'Battery': '#f57c00',
                          'Accessory': '#7b1fa2',
                          'Other': '#757575'
                        };
                        const color = typeColors[product.type] || '#757575';
                        return (
                          <Chip 
                            label={product.type} 
                            size="small"
                            sx={{ 
                              bgcolor: `${color}10`,
                              color: color,
                              fontWeight: 'medium',
                              border: `1px solid ${color}30`
                            }}
                          />
                        );
                      })()}
                    </TableCell>
                    <TableCell>{product.company || '-'}</TableCell>
                    <TableCell>{product.hsnCode || '-'}</TableCell>
                    <TableCell align="center">
                      {product.hasSerialNumber ? (
                        <Chip 
                          label="Yes" 
                          color="success" 
                          variant="outlined" 
                          size="small"
                        />
                      ) : (
                        <Chip 
                          label="No" 
                          color="default" 
                          variant="outlined" 
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {product.isFreeOfCost ? (
                        '-'
                      ) : product.mrp !== undefined ? (
                        <Typography fontWeight="medium">
                          ₹{product.mrp.toLocaleString('en-IN')}
                        </Typography>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {product.gstApplicable ? (
                        <Tooltip title={`${product.gstType || 'CGST'} @ ${product.gstPercentage || 18}%`}>
                          <Chip 
                            label="Applicable" 
                            color="primary" 
                            variant="outlined" 
                            size="small"
                          />
                        </Tooltip>
                      ) : (
                        <Chip 
                          label="Exempted" 
                          color="default" 
                          variant="outlined" 
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {product.type === 'Hearing Aid' ? (
                        <Chip 
                          label={product.quantityType === 'pair' ? "Pairs" : "Pieces"} 
                          color="info" 
                          variant="outlined" 
                          size="small"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {product.isFreeOfCost ? (
                        <Chip 
                          label="FOC" 
                          color="secondary" 
                          size="small"
                        />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                        <IconButton 
                          color="primary" 
                          onClick={() => handleOpenDialog(product)}
                          size="small"
                          sx={{ bgcolor: 'primary.lighter', '&:hover': { bgcolor: 'primary.light' } }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {userProfile?.role === 'admin' && (
                          <IconButton 
                            color="error" 
                            onClick={() => handleDeleteProduct(product.id)}
                            size="small"
                            sx={{ bgcolor: 'error.lighter', '&:hover': { bgcolor: 'error.light' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    {searchTerm 
                      ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
                          <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                          <Typography variant="h6" color="text.secondary">No products found matching your search</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Try different keywords or clear your search
                          </Typography>
                        </Box>
                      ) 
                      : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
                          <AddIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                          <Typography variant="h6" color="text.secondary">No products available</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Click the "Add Product" button to create your first product
                          </Typography>
                        </Box>
                      )
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredProducts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ 
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
              fontWeight: 'medium',
            }
          }}
        />
      </Paper>
      
      {/* Filters Drawer */}
      <Drawer
        anchor="right"
        open={filtersOpen}
        onClose={toggleFilters}
        PaperProps={{
          sx: { 
            width: { xs: '100%', sm: 400 }, 
            p: 3,
            borderTopLeftRadius: { xs: 0, sm: 16 },
            borderBottomLeftRadius: { xs: 0, sm: 16 },
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">Filter Products</Typography>
          <IconButton onClick={toggleFilters} edge="end">
            <ClearIcon />
          </IconButton>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Product Type
          </Typography>
          <FormControl fullWidth>
            <Select
              multiple
              value={filters.productTypes}
              onChange={(e) => handleFilterChange('productTypes', e.target.value)}
              input={<OutlinedInput />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
              size="small"
            >
              {PRODUCT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  <Checkbox checked={filters.productTypes.indexOf(type) > -1} />
                  <ListItemText primary={type} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Company
          </Typography>
          <FormControl fullWidth>
            <Select
              multiple
              value={filters.companies}
              onChange={(e) => handleFilterChange('companies', e.target.value)}
              input={<OutlinedInput />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
              size="small"
            >
              {uniqueCompanies.map((company) => (
                <MenuItem key={company} value={company}>
                  <Checkbox checked={filters.companies.indexOf(company) > -1} />
                  <ListItemText primary={company} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            GST Status
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={filters.gstApplicable}
            onChange={(e, value) => handleFilterChange('gstApplicable', value !== null ? value : null)}
            fullWidth
            size="small"
          >
            <ToggleButton value={true}>
              Applicable
            </ToggleButton>
            <ToggleButton value={false}>
              Exempt
            </ToggleButton>
            <ToggleButton value="">
              All
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Serial Number Tracking
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={filters.hasSerialNumber}
            onChange={(e, value) => handleFilterChange('hasSerialNumber', value !== null ? value : null)}
            fullWidth
            size="small"
          >
            <ToggleButton value={true}>
              Yes
            </ToggleButton>
            <ToggleButton value={false}>
              No
            </ToggleButton>
            <ToggleButton value="">
              All
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Free of Cost
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={filters.isFreeOfCost}
            onChange={(e, value) => handleFilterChange('isFreeOfCost', value !== null ? value : null)}
            fullWidth
            size="small"
          >
            <ToggleButton value={true}>
              Yes
            </ToggleButton>
            <ToggleButton value={false}>
              No
            </ToggleButton>
            <ToggleButton value="">
              All
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom color="primary">
            Price Range
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              size="small"
              label="Min"
              type="number"
              value={filters.priceRange[0]}
              onChange={(e) => handleFilterChange('priceRange', [parseInt(e.target.value) || 0, filters.priceRange[1]])}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
            />
            <Typography variant="body1">to</Typography>
            <TextField
              size="small"
              label="Max"
              type="number"
              value={filters.priceRange[1]}
              onChange={(e) => handleFilterChange('priceRange', [filters.priceRange[0], parseInt(e.target.value) || 100000])}
              InputProps={{
                startAdornment: <InputAdornment position="start">₹</InputAdornment>,
              }}
            />
          </Box>
        </Box>
        
        <Box sx={{ mt: 'auto', display: 'flex', gap: 2 }}>
          <Button 
            fullWidth 
            variant="outlined" 
            onClick={resetFilters}
            startIcon={<ClearIcon />}
          >
            Clear All
          </Button>
          <Button 
            fullWidth 
            variant="contained" 
            onClick={toggleFilters}
            color="primary"
          >
            Apply Filters
          </Button>
        </Box>
      </Drawer>
      
      {/* Product Form Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 2 }}>
            {/* Product Type Selection - Always shown */}
            {renderProductTypeSelection()}
            
            {/* Conditional fields based on product type */}
            {formData.type === 'Accessory' && (
              <>
                {/* Accessory specific fields */}
                <TextField
                  name="name"
                  label="Accessory Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                
                <FormControl fullWidth>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isFreeOfCost || false}
                        onChange={handleFocToggle}
                        color="secondary"
                      />
                    }
                    label={`Free of Cost (FOC): ${formData.isFreeOfCost ? 'Yes' : 'No'}`}
                  />
                  <FormHelperText>
                    {formData.isFreeOfCost 
                      ? 'This accessory will be marked as free' 
                      : 'This accessory has a cost'}
                  </FormHelperText>
                </FormControl>
                
                {!formData.isFreeOfCost && (
                  <TextField
                    name="mrp"
                    label="MRP (₹)"
                    type="number"
                    value={formData.mrp || ''}
                    onChange={handleInputChange}
                    fullWidth
                    required={!formData.isFreeOfCost}
                    error={!formData.isFreeOfCost && (formData.mrp || 0) <= 0}
                    helperText={
                      !formData.isFreeOfCost && (formData.mrp || 0) <= 0
                        ? 'Please enter a valid MRP' 
                        : (formData.mrp || 0) > 0
                          ? numberToWords(formData.mrp || 0)
                          : ''
                    }
                    FormHelperTextProps={{
                      sx: { fontSize: '0.7rem', fontStyle: 'italic' }
                    }}
                  />
                )}
                
                {renderGstAndHsnSection()}
              </>
            )}
            
            {formData.type === 'Charger' && (
              <>
                {/* Charger specific fields */}
                <TextField
                  name="name"
                  label="Charger Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                
                <TextField
                  name="company"
                  label="Company"
                  value={formData.company}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                
                <FormControl fullWidth>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.hasSerialNumber || false}
                        onChange={handleSerialNumberToggle}
                        color="success"
                      />
                    }
                    label={`Track Serial Numbers: ${formData.hasSerialNumber ? 'Yes' : 'No'}`}
                  />
                  <FormHelperText>
                    {formData.hasSerialNumber 
                      ? 'Serial numbers will be required during purchase and sales' 
                      : 'No serial numbers will be tracked for this product'}
                  </FormHelperText>
                </FormControl>
                
                <FormControl fullWidth>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isFreeOfCost || false}
                        onChange={handleFocToggle}
                        color="secondary"
                      />
                    }
                    label={`Free of Cost (FOC): ${formData.isFreeOfCost ? 'Yes' : 'No'}`}
                  />
                  <FormHelperText>
                    {formData.isFreeOfCost 
                      ? 'This charger will be marked as free' 
                      : 'This charger has a cost'}
                  </FormHelperText>
                </FormControl>
                
                {!formData.isFreeOfCost && (
                  <TextField
                    name="mrp"
                    label="MRP (₹)"
                    type="number"
                    value={formData.mrp || ''}
                    onChange={handleInputChange}
                    fullWidth
                    required={!formData.isFreeOfCost}
                    error={!formData.isFreeOfCost && (formData.mrp || 0) <= 0}
                    helperText={
                      !formData.isFreeOfCost && (formData.mrp || 0) <= 0
                        ? 'Please enter a valid MRP' 
                        : (formData.mrp || 0) > 0
                          ? numberToWords(formData.mrp || 0)
                          : ''
                    }
                    FormHelperTextProps={{
                      sx: { fontSize: '0.7rem', fontStyle: 'italic' }
                    }}
                  />
                )}
                
                {renderGstAndHsnSection()}
              </>
            )}
            
            {formData.type === 'Hearing Aid' && (
              <>
                {/* Hearing Aid specific fields */}
                <TextField
                  name="name"
                  label="Product Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                
                <TextField
                  name="company"
                  label="Company"
                  value={formData.company}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                
                <Box sx={{ 
                  p: 2, 
                  mt: 2, 
                  mb: 2, 
                  border: '1px dashed rgba(0, 0, 0, 0.12)',
                  borderRadius: 1,
                  bgcolor: 'rgba(25, 118, 210, 0.04)'
                }}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Inventory Settings
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.hasSerialNumber || false}
                          onChange={handleSerialNumberToggle}
                          color="success"
                        />
                      }
                      label={`Track Serial Numbers: ${formData.hasSerialNumber ? 'Yes' : 'No'}`}
                    />
                    <FormHelperText>
                      {formData.hasSerialNumber 
                        ? 'Serial numbers will be required during purchase and sales' 
                        : 'No serial numbers will be tracked for this product'}
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
                    <Typography variant="body2" gutterBottom>
                      Quantity Type:
                    </Typography>
                    <Box sx={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: 2 
                    }}>
                      <Box 
                        onClick={() => setFormData(prev => ({ ...prev, quantityType: 'piece' }))}
                        sx={{ 
                          p: 2,
                          border: '1px solid',
                          borderColor: formData.quantityType !== 'pair' ? 'primary.main' : 'divider',
                          borderRadius: 1,
                          bgcolor: formData.quantityType !== 'pair' ? 'primary.lighter' : 'background.paper',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: formData.quantityType !== 'pair' ? 1 : 0,
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: formData.quantityType !== 'pair' ? 'primary.lighter' : 'action.hover',
                          }
                        }}
                      >
                        <Box sx={{ 
                          mb: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 60,
                          width: 60,
                          borderRadius: '50%',
                          bgcolor: formData.quantityType !== 'pair' ? 'primary.main' : 'action.selected',
                          color: formData.quantityType !== 'pair' ? 'primary.contrastText' : 'text.primary'
                        }}>
                          <Typography variant="h5">1</Typography>
                        </Box>
                        <Typography variant="subtitle1" fontWeight={formData.quantityType !== 'pair' ? 'bold' : 'normal'}>
                          Pieces
                        </Typography>
                        <Typography variant="caption" textAlign="center" sx={{ mt: 1 }}>
                          Count individually
                        </Typography>
                      </Box>
                      
                      <Box 
                        onClick={() => setFormData(prev => ({ ...prev, quantityType: 'pair' }))}
                        sx={{ 
                          p: 2,
                          border: '1px solid',
                          borderColor: formData.quantityType === 'pair' ? 'primary.main' : 'divider',
                          borderRadius: 1,
                          bgcolor: formData.quantityType === 'pair' ? 'primary.lighter' : 'background.paper',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          transition: 'all 0.2s ease',
                          boxShadow: formData.quantityType === 'pair' ? 1 : 0,
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: formData.quantityType === 'pair' ? 'primary.lighter' : 'action.hover',
                          }
                        }}
                      >
                        <Box sx={{ 
                          mb: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 60,
                          width: 60,
                          borderRadius: '50%',
                          bgcolor: formData.quantityType === 'pair' ? 'primary.main' : 'action.selected',
                          color: formData.quantityType === 'pair' ? 'primary.contrastText' : 'text.primary'
                        }}>
                          <Typography variant="h5">2</Typography>
                        </Box>
                        <Typography variant="subtitle1" fontWeight={formData.quantityType === 'pair' ? 'bold' : 'normal'}>
                          Pairs
                        </Typography>
                        <Typography variant="caption" textAlign="center" sx={{ mt: 1 }}>
                          For left & right ear
                        </Typography>
                      </Box>
                    </Box>
                    <FormHelperText>
                      Select how this hearing aid should be counted in inventory
                    </FormHelperText>
                  </FormControl>
                </Box>
                
                <TextField
                  name="mrp"
                  label="MRP (₹)"
                  type="number"
                  value={formData.mrp || ''}
                  onChange={handleInputChange}
                  fullWidth
                  required={!formData.isFreeOfCost}
                  error={!formData.isFreeOfCost && (formData.mrp || 0) <= 0}
                  helperText={
                    !formData.isFreeOfCost && (formData.mrp || 0) <= 0
                      ? 'Please enter a valid MRP' 
                      : (formData.mrp || 0) > 0
                        ? numberToWords(formData.mrp || 0)
                        : ''
                  }
                  FormHelperTextProps={{
                    sx: { fontSize: '0.7rem', fontStyle: 'italic' }
                  }}
                />
                
                {renderGstAndHsnSection()}
              </>
            )}
            
            {formData.type === 'Battery' && (
              <>
                {/* Battery specific fields */}
                <TextField
                  name="name"
                  label="Battery Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                
                <TextField
                  name="company"
                  label="Company"
                  value={formData.company}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                
                <FormControl fullWidth>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isFreeOfCost || false}
                        onChange={handleFocToggle}
                        color="secondary"
                      />
                    }
                    label={`Free of Cost (FOC): ${formData.isFreeOfCost ? 'Yes' : 'No'}`}
                  />
                  <FormHelperText>
                    {formData.isFreeOfCost 
                      ? 'This battery will be marked as free' 
                      : 'This battery has a cost'}
                  </FormHelperText>
                </FormControl>
                
                {!formData.isFreeOfCost && (
                  <TextField
                    name="mrp"
                    label="MRP (₹)"
                    type="number"
                    value={formData.mrp || ''}
                    onChange={handleInputChange}
                    fullWidth
                    required={!formData.isFreeOfCost}
                    error={!formData.isFreeOfCost && (formData.mrp || 0) <= 0}
                    helperText={
                      !formData.isFreeOfCost && (formData.mrp || 0) <= 0
                        ? 'Please enter a valid MRP' 
                        : (formData.mrp || 0) > 0
                          ? numberToWords(formData.mrp || 0)
                          : ''
                    }
                    FormHelperTextProps={{
                      sx: { fontSize: '0.7rem', fontStyle: 'italic' }
                    }}
                  />
                )}
                
                {renderGstAndHsnSection()}
              </>
            )}
            
            {/* Show name field for any other product type */}
            {formData.type && !['Accessory', 'Charger', 'Hearing Aid', 'Battery'].includes(formData.type) && (
              <>
                <TextField
                  name="name"
                  label="Product Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  fullWidth
                  required
                />
                
                <TextField
                  name="company"
                  label="Company"
                  value={formData.company}
                  onChange={handleInputChange}
                  fullWidth
                />
                
                <TextField
                  name="mrp"
                  label="MRP (₹)"
                  type="number"
                  value={formData.mrp || ''}
                  onChange={handleInputChange}
                  fullWidth
                  required={!formData.isFreeOfCost}
                  error={!formData.isFreeOfCost && (formData.mrp || 0) <= 0}
                  helperText={
                    !formData.isFreeOfCost && (formData.mrp || 0) <= 0
                      ? 'Please enter a valid MRP' 
                      : (formData.mrp || 0) > 0
                        ? numberToWords(formData.mrp || 0)
                        : ''
                  }
                  FormHelperTextProps={{
                    sx: { fontSize: '0.7rem', fontStyle: 'italic' }
                  }}
                />
                
                {renderGstAndHsnSection()}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingProduct ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Product Preview Dialog */}
      <Dialog 
        open={openPreviewDialog} 
        onClose={handlePreviewClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          elevation: 3,
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ 
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 2
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Product Details</Typography>
            <IconButton size="small" edge="end" onClick={handlePreviewClose}>
              <DeleteIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {previewProduct && renderProductDetails(previewProduct)}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handlePreviewClose} variant="outlined">
            Close
          </Button>
          {previewProduct && userProfile?.role === 'admin' && (
            <>
              <Button 
                onClick={() => handleDeleteProduct(previewProduct.id)} 
                color="error" 
                variant="outlined"
                startIcon={<DeleteIcon />}
              >
                Delete
              </Button>
              <Button 
                onClick={handleEditFromPreview} 
                variant="contained" 
                color="primary"
                startIcon={<EditIcon />}
              >
                Edit
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Success Snackbar */}
      <Snackbar 
        open={!!successMessage} 
        autoHideDuration={6000} 
        onClose={() => setSuccessMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccessMessage('')} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
      
      {/* Error Snackbar */}
      <Snackbar 
        open={!!errorMessage} 
        autoHideDuration={6000} 
        onClose={() => setErrorMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setErrorMessage('')} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
} 