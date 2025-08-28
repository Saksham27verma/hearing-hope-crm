'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Grid,
  Divider,
  InputAdornment,
  Autocomplete,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  LocalHospital as DoctorIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Types
interface Product {
  id: string;
  name: string;
  type: string;
  company: string;
  mrp: number;
  dealerPrice?: number;
}

interface ProductWithSerialNumber extends Product {
  serialNumber: string;
  sellingPrice: number;
  discount: number;
  discountPercent: number;
}

interface Accessory {
  id: string;
  name: string;
  isFree: boolean;
  quantity: number;
  price: number;
}

interface Sale {
  id?: string;
  patientId?: string;
  patientName: string;
  products: ProductWithSerialNumber[];
  accessories: Accessory[];
  referenceDoctor?: {
    id?: string;
    name: string;
  };
  salesperson: {
    id: string;
    name: string;
  };
  totalAmount: number;
  gstAmount: number;
  gstPercentage: number;
  netProfit: number;
  branch: string;
  saleDate: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Component
const SalesPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [enquirySales, setEnquirySales] = useState<any[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSale, setInvoiceSale] = useState<any | null>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [salesPersons, setSalesPersons] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductQuantity, setSelectedProductQuantity] = useState<number>(1);
  const [selectedProductDiscount, setSelectedProductDiscount] = useState<number>(0);
  
  // Initialize empty sale
  const emptySale: Sale = {
    patientName: '',
    products: [],
    accessories: [],
    referenceDoctor: {
      name: '',
    },
    salesperson: {
      id: '',
      name: '',
    },
    totalAmount: 0,
    gstAmount: 0,
    gstPercentage: 5, // Default GST percentage
    netProfit: 0,
    branch: '',
    saleDate: Timestamp.now(),
  };

  // Branch options (these could be fetched from Firestore)
  const branches = ['Main Branch', 'North Branch', 'South Branch', 'West Branch', 'East Branch'];

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Fetch sales data
    fetchSales();
    
    // Fetch products for reference
    fetchProducts();
    
    // Fetch visitors for patient selection
    fetchVisitors();
    // Fetch enquiries directly for sales-from-enquiries table
    fetchEnquirySales();
    
    // Fetch salespeople (users with staff role)
    fetchSalesPeople();
    
  }, [user, authLoading, router]);

  // Filter sales when search term or date filter changes
  useEffect(() => {
    if (sales.length === 0) {
      setFilteredSales([]);
      return;
    }
    
    let filtered = [...sales];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(sale => 
        sale.patientName.toLowerCase().includes(searchLower) ||
        (sale.referenceDoctor?.name && sale.referenceDoctor.name.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(sale => {
        const saleDate = new Date(sale.saleDate.seconds * 1000);
        return (
          saleDate.getDate() === filterDate.getDate() &&
          saleDate.getMonth() === filterDate.getMonth() &&
          saleDate.getFullYear() === filterDate.getFullYear()
        );
      });
    }
    
    setFilteredSales(filtered);
  }, [sales, searchTerm, dateFilter]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const salesQuery = query(collection(db, 'sales'), orderBy('saleDate', 'desc'));
      const snapshot = await getDocs(salesQuery);
      
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Sale[];
      
      setSales(salesData);
      setFilteredSales(salesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sales:', error);
      setErrorMsg('Failed to load sales data');
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchVisitors = async () => {
    try {
      const visitorsSnapshot = await getDocs(collection(db, 'visitors'));
      const visitorsData = visitorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVisitors(visitorsData);
      
      // For doctors, in a real app you'd fetch from a 'doctors' collection
      // This is a placeholder
      setDoctors([
        { id: '1', name: 'Dr. Smith' },
        { id: '2', name: 'Dr. Johnson' },
        { id: '3', name: 'Dr. Williams' },
      ]);

      // Also derive sales from enquiries' visits (hearingAidSale)
      const derived: any[] = [];
      visitorsData.forEach((v: any) => {
        const name = v.name || v.patientName || v.fullName || 'Unknown';
        const phone = v.phone || v.mobile || '';
        const address = v.address || v.location || '';
        const visits: any[] = Array.isArray(v.visits) ? v.visits : [];
        visits.forEach((visit: any, idx: number) => {
          const isSale = !!(
            visit?.hearingAidSale ||
            (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_sale')) ||
            visit?.journeyStage === 'sale' ||
            visit?.hearingAidStatus === 'sold' ||
            (Array.isArray(visit?.products) && visit.products.length > 0 && ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
          );
          if (!isSale) return;
          const products: any[] = Array.isArray(visit.products) ? visit.products : [];
          const saleDateStr: string = visit.visitDate || visit.purchaseDate || visit.hearingAidPurchaseDate || '';
          const saleDateTs = saleDateStr ? Timestamp.fromDate(new Date(saleDateStr)) : (v.updatedAt || Timestamp.now());
          const totalAmount = products.reduce((sum, p) => sum + (p.finalAmount || p.sellingPrice || 0), 0);
          derived.push({
            id: `${v.id}-${idx}`,
            visitorId: v.id,
            patientName: name,
            visitIndex: idx,
            visitDate: saleDateTs,
            products,
            totalAmount,
            phone,
            address,
          });
        });
      });
      derived.sort((a, b) => (b.visitDate?.seconds || 0) - (a.visitDate?.seconds || 0));
      // Merge with currently loaded enquiry-based sales later
      setEnquirySales((prev) => {
        const merged = [...prev, ...derived];
        // Deduplicate by id
        const uniq = new Map<string, any>();
        merged.forEach((x) => uniq.set(x.id, x));
        return Array.from(uniq.values()).sort((a, b) => (b.visitDate?.seconds || 0) - (a.visitDate?.seconds || 0));
      });
    } catch (error) {
      console.error('Error fetching visitors:', error);
    }
  };

  // Fetch sales from enquiries collection directly
  const fetchEnquirySales = async () => {
    try {
      const snap = await getDocs(collection(db, 'enquiries'));
      const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const derived: any[] = [];
      docs.forEach((e: any) => {
        const name = e.name || e.patientName || e.fullName || 'Unknown';
        const phone = e.phone || e.mobile || '';
        const address = e.address || e.location || '';
        const visits: any[] = Array.isArray(e.visits) ? e.visits : [];
        visits.forEach((visit: any, idx: number) => {
          const isSale = !!(
            visit?.hearingAidSale ||
            (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_sale')) ||
            visit?.journeyStage === 'sale' ||
            visit?.hearingAidStatus === 'sold' ||
            (Array.isArray(visit?.products) && visit.products.length > 0 && ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
          );
          if (!isSale) return;
          const products: any[] = Array.isArray(visit.products) ? visit.products : [];
          const dateStr: string = visit.visitDate || visit.purchaseDate || visit.hearingAidPurchaseDate || '';
          const ts = dateStr ? Timestamp.fromDate(new Date(dateStr)) : (e.updatedAt || Timestamp.now());
          const totalAmount = products.reduce((sum, p) => sum + (p.finalAmount || p.sellingPrice || 0), 0);
          derived.push({
            id: `${e.id}-${idx}`,
            enquiryId: e.id,
            patientName: name,
            visitIndex: idx,
            visitDate: ts,
            products,
            totalAmount,
            phone,
            address,
          });
        });
      });
      derived.sort((a, b) => (b.visitDate?.seconds || 0) - (a.visitDate?.seconds || 0));
      setEnquirySales((prev) => {
        const merged = [...prev, ...derived];
        const uniq = new Map<string, any>();
        merged.forEach((x) => uniq.set(x.id, x));
        return Array.from(uniq.values()).sort((a, b) => (b.visitDate?.seconds || 0) - (a.visitDate?.seconds || 0));
      });
    } catch (error) {
      console.error('Error fetching enquiry sales:', error);
    }
  };

  const fetchSalesPeople = async () => {
    try {
      // Fetch users with staff role who can be salespeople
      const usersSnapshot = await getDocs(
        query(collection(db, 'users'), where('role', 'in', ['admin', 'staff']))
      );
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().displayName || doc.data().email,
        ...doc.data(),
      }));
      setSalesPersons(usersData);
    } catch (error) {
      console.error('Error fetching salespeople:', error);
    }
  };

  const handleAddSale = () => {
    setCurrentSale({
      ...emptySale,
      // Set default salesperson to current user if they're staff
      salesperson: {
        id: user?.uid || '',
        name: userProfile?.displayName || user?.email || '',
      },
      // Set default branch if user has a branchId
      branch: userProfile?.branchId ? 
        branches.find(b => b.toLowerCase().includes(userProfile.branchId?.toLowerCase() || '')) || branches[0] : 
        branches[0],
    });
    setOpenDialog(true);
  };

  const handleEditSale = (sale: Sale) => {
    setCurrentSale(sale);
    setOpenDialog(true);
  };

  const handleDeleteSale = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this sale?')) return;
    
    try {
      await deleteDoc(doc(db, 'sales', id));
      setSales(prevSales => prevSales.filter(sale => sale.id !== id));
      setSuccessMsg('Sale deleted successfully');
    } catch (error) {
      console.error('Error deleting sale:', error);
      setErrorMsg('Failed to delete sale');
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentSale(null);
  };

  const handleSaveSale = async () => {
    if (!currentSale) return;
    
    try {
      if (currentSale.id) {
        // Update existing sale
        const saleRef = doc(db, 'sales', currentSale.id);
        await updateDoc(saleRef, {
          ...currentSale,
          updatedAt: serverTimestamp(),
        });
        
        // Update in state
        setSales(prevSales => 
          prevSales.map(sale => 
            sale.id === currentSale.id ? {...currentSale, updatedAt: Timestamp.now()} : sale
          )
        );
        
        setSuccessMsg('Sale updated successfully');
      } else {
        // Add new sale
        const newSaleData = {
          ...currentSale,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(db, 'sales'), newSaleData);
        
        // Add to state with the new ID
        const newSale = {
          ...currentSale,
          id: docRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        
        setSales(prevSales => [newSale, ...prevSales]);
        setSuccessMsg('Sale added successfully');
      }
      
      setOpenDialog(false);
    } catch (error) {
      console.error('Error saving sale:', error);
      setErrorMsg('Failed to save sale');
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCloseSnackbar = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  const formatDate = (timestamp: Timestamp) => {
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate discount amount based on MRP and discount percentage
  const calculateDiscount = (mrp: number, discountPercent: number): number => {
    return (mrp * discountPercent) / 100;
  };

  // Calculate selling price after discount
  const calculateSellingPrice = (mrp: number, discountPercent: number): number => {
    const discountAmount = calculateDiscount(mrp, discountPercent);
    return mrp - discountAmount;
  };

  // Calculate GST amount based on selling price and GST percentage
  const calculateGST = (sellingPrice: number, gstPercent: number): number => {
    return (sellingPrice * gstPercent) / 100;
  };

  // Calculate net profit based on selling price and dealer price
  const calculateNetProfit = (sellingPrice: number, dealerPrice: number): number => {
    return sellingPrice - dealerPrice;
  };

  // Function to handle adding a product to the sale
  const handleAddProduct = () => {
    if (!selectedProduct || !currentSale) return;
    
    const discountAmount = calculateDiscount(selectedProduct.mrp, selectedProductDiscount);
    const sellingPrice = calculateSellingPrice(selectedProduct.mrp, selectedProductDiscount);
    const dealerPrice = selectedProduct.dealerPrice || (selectedProduct.mrp * 0.7); // Default 30% margin if dealer price not available
    
    const productToAdd: ProductWithSerialNumber = {
      ...selectedProduct,
      serialNumber: '', // This would be selected from inventory in a real implementation
      sellingPrice: sellingPrice,
      discount: discountAmount,
      discountPercent: selectedProductDiscount,
    };
    
    // Calculate new totals
    const updatedProducts = [...currentSale.products, productToAdd];
    const newTotalAmount = updatedProducts.reduce((sum, p) => sum + p.sellingPrice, 0) + 
                           currentSale.accessories.reduce((sum, a) => a.isFree ? sum : sum + (a.price * a.quantity), 0);
    const newGstAmount = calculateGST(newTotalAmount, currentSale.gstPercentage);
    const newNetProfit = updatedProducts.reduce((sum, p) => {
      const productDealerPrice = p.dealerPrice || (p.mrp * 0.7);
      return sum + calculateNetProfit(p.sellingPrice, productDealerPrice);
    }, 0);
    
    setCurrentSale({
      ...currentSale,
      products: updatedProducts,
      totalAmount: newTotalAmount,
      gstAmount: newGstAmount,
      netProfit: newNetProfit,
    });
    
    // Reset selected product fields
    setSelectedProduct(null);
    setSelectedProductQuantity(1);
    setSelectedProductDiscount(0);
  };

  // Function to handle removing a product from the sale
  const handleRemoveProduct = (index: number) => {
    if (!currentSale) return;
    
    const updatedProducts = [...currentSale.products];
    updatedProducts.splice(index, 1);
    
    const newTotalAmount = updatedProducts.reduce((sum, p) => sum + p.sellingPrice, 0) + 
                           currentSale.accessories.reduce((sum, a) => a.isFree ? sum : sum + (a.price * a.quantity), 0);
    const newGstAmount = calculateGST(newTotalAmount, currentSale.gstPercentage);
    const newNetProfit = updatedProducts.reduce((sum, p) => {
      const productDealerPrice = p.dealerPrice || (p.mrp * 0.7);
      return sum + calculateNetProfit(p.sellingPrice, productDealerPrice);
    }, 0);
    
    setCurrentSale({
      ...currentSale,
      products: updatedProducts,
      totalAmount: newTotalAmount,
      gstAmount: newGstAmount,
      netProfit: newNetProfit,
    });
  };

  // Function to handle adding an accessory to the sale
  const handleAddAccessory = (accessory: Accessory) => {
    if (!currentSale) return;
    
    const updatedAccessories = [...currentSale.accessories, accessory];
    const newTotalAmount = currentSale.products.reduce((sum, p) => sum + p.sellingPrice, 0) + 
                           updatedAccessories.reduce((sum, a) => a.isFree ? sum : sum + (a.price * a.quantity), 0);
    const newGstAmount = calculateGST(newTotalAmount, currentSale.gstPercentage);
    
    setCurrentSale({
      ...currentSale,
      accessories: updatedAccessories,
      totalAmount: newTotalAmount,
      gstAmount: newGstAmount,
    });
  };

  // Function to handle removing an accessory from the sale
  const handleRemoveAccessory = (index: number) => {
    if (!currentSale) return;
    
    const updatedAccessories = [...currentSale.accessories];
    updatedAccessories.splice(index, 1);
    
    const newTotalAmount = currentSale.products.reduce((sum, p) => sum + p.sellingPrice, 0) + 
                           updatedAccessories.reduce((sum, a) => a.isFree ? sum : sum + (a.price * a.quantity), 0);
    const newGstAmount = calculateGST(newTotalAmount, currentSale.gstPercentage);
    
    setCurrentSale({
      ...currentSale,
      accessories: updatedAccessories,
      totalAmount: newTotalAmount,
      gstAmount: newGstAmount,
    });
  };

  // Function to handle GST percentage change
  const handleGstPercentageChange = (newGstPercentage: number) => {
    if (!currentSale) return;
    
    const newGstAmount = calculateGST(currentSale.totalAmount, newGstPercentage);
    
    setCurrentSale({
      ...currentSale,
      gstPercentage: newGstPercentage,
      gstAmount: newGstAmount,
    });
  };

  if (authLoading || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" color="primary" mb={1}>
        Sales Management
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Track and manage all product sales transactions
      </Typography>

      {/* Sales from Enquiries (Hearing Aid Sale) */}
      <Paper elevation={0} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#f8f9fa' }}>
          <Typography variant="h6">
            Sales from Enquiries
            {enquirySales.length > 0 && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                ({enquirySales.length} {enquirySales.length === 1 ? 'record' : 'records'})
              </Typography>
            )}
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Products</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {enquirySales.length > 0 ? (
                enquirySales.map((sale) => (
                  <TableRow key={sale.id} hover>
                    <TableCell>{formatDate(sale.visitDate)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">{sale.patientName}</Typography>
                      {sale.phone && (
                        <Typography variant="caption" color="text.secondary">{sale.phone}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {sale.products?.length > 0 ? (
                        <>
                          {sale.products[0].name}
                          {sale.products.length > 1 && ` +${sale.products.length - 1} more`}
                        </>
                      ) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'medium' }}>{formatCurrency(sale.totalAmount || 0)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" onClick={() => { setInvoiceSale(sale); setInvoiceOpen(true); }}>
                        <PrintIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    No hearing aid sale records from enquiries
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* Filters and Actions */}
      <Box mb={3} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            placeholder="Search patient or doctor..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 220 } }}
          />
          
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Filter by date"
              value={dateFilter}
              onChange={(newValue) => {
                setDateFilter(newValue);
              }}
              slotProps={{ 
                textField: { 
                  size: 'small',
                  sx: { width: { xs: '100%', sm: 180 } }
                } 
              }}
            />
          </LocalizationProvider>
          
          {dateFilter && (
            <Button 
              variant="outlined" 
              size="small"
              onClick={() => setDateFilter(null)}
            >
              Clear Date
            </Button>
          )}
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddSale}
        >
          New Sale
        </Button>
      </Box>
      
      {/* Sales Table */}
      <Paper elevation={0} variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSales.length > 0 ? (
                filteredSales
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((sale) => (
                    <TableRow key={sale.id} hover>
                      <TableCell>{formatDate(sale.saleDate)}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <PersonIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          {sale.patientName}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {sale.products.length > 0 ? (
                          <>
                            {sale.products[0].name}
                            {sale.products.length > 1 && ` +${sale.products.length - 1} more`}
                          </>
                        ) : 'No products'}
                      </TableCell>
                      <TableCell>{sale.branch}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                        {formatCurrency(sale.totalAmount)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleEditSale(sale)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => sale.id && handleDeleteSale(sale.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="default">
                          <PrintIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      'No sales records found'
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredSales.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      
      {/* Sale Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {currentSale?.id ? 'Edit Sale' : 'New Sale'}
        </DialogTitle>
        
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Grid container spacing={2}>
              <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
                <Typography variant="subtitle2" gutterBottom>
                  Basic Information
                </Typography>
                
                <Stack spacing={2}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Sale Date"
                      value={
                        currentSale?.saleDate 
                          ? new Date(currentSale.saleDate.seconds * 1000) 
                          : new Date()
                      }
                      onChange={(newValue) => {
                        if (currentSale && newValue) {
                          setCurrentSale({
                            ...currentSale,
                            saleDate: Timestamp.fromDate(newValue),
                          });
                        }
                      }}
                      slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                    />
                  </LocalizationProvider>
                  
                  <Autocomplete
                    options={branches}
                    value={currentSale?.branch || ''}
                    onChange={(_, newValue) => {
                      if (currentSale && newValue) {
                        setCurrentSale({
                          ...currentSale,
                          branch: newValue,
                        });
                      }
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Branch" size="small" fullWidth />
                    )}
                  />
                  
                  <Autocomplete
                    options={
                      salesPersons.map(sp => ({
                        id: sp.id,
                        name: sp.name || sp.email || 'Unknown',
                      }))
                    }
                    getOptionLabel={(option) => option.name}
                    value={currentSale?.salesperson || null}
                    onChange={(_, newValue) => {
                      if (currentSale && newValue) {
                        setCurrentSale({
                          ...currentSale,
                          salesperson: newValue,
                        });
                      }
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Salesperson" size="small" fullWidth />
                    )}
                  />
                </Stack>
              </Grid>
              
              <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
                <Typography variant="subtitle2" gutterBottom>
                  Patient & Referral
                </Typography>
                
                <Stack spacing={2}>
                  <TextField
                    label="Patient Name"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentSale?.patientName || ''}
                    onChange={(e) => {
                      if (currentSale) {
                        setCurrentSale({
                          ...currentSale,
                          patientName: e.target.value,
                        });
                      }
                    }}
                    required
                  />
                  
                  <TextField
                    label="Doctor Referral"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentSale?.referenceDoctor?.name || ''}
                    onChange={(e) => {
                      if (currentSale) {
                        setCurrentSale({
                          ...currentSale,
                          referenceDoctor: {
                            ...currentSale.referenceDoctor,
                            name: e.target.value,
                          },
                        });
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <DoctorIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  
                  <TextField
                    label="GST Percentage"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="number"
                    value={currentSale?.gstPercentage || 5}
                    onChange={(e) => {
                      if (currentSale) {
                        setCurrentSale({
                          ...currentSale,
                          gstPercentage: Number(e.target.value),
                        });
                      }
                    }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                  />
                </Stack>
              </Grid>
            </Grid>
            
            {/* Product Selection Section - In a real implementation, this would be more complex */}
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Products
              </Typography>
              
              <Box sx={{ backgroundColor: 'background.paper', p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, mb: 3 }}>
                <Grid container spacing={2} alignItems="flex-end">
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
                    <Autocomplete
                      options={products}
                      getOptionLabel={(option) => `${option.name} (${option.company})`}
                      value={selectedProduct}
                      onChange={(_, newValue) => setSelectedProduct(newValue)}
                      renderInput={(params) => (
                        <TextField {...params} label="Select Product" size="small" fullWidth />
                      )}
                    />
                  </Grid>
                  
                  <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 3', md: 'span 2' } }}>
                    <TextField
                      label="Quantity"
                      variant="outlined"
                      size="small"
                      fullWidth
                      type="number"
                      value={selectedProductQuantity}
                      onChange={(e) => setSelectedProductQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      inputProps={{ min: 1 }}
                    />
                  </Grid>
                  
                  <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 3', md: 'span 2' } }}>
                    <TextField
                      label="Discount %"
                      variant="outlined"
                      size="small"
                      fullWidth
                      type="number"
                      value={selectedProductDiscount}
                      onChange={(e) => setSelectedProductDiscount(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      inputProps={{ min: 0, max: 100 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                    />
                  </Grid>

                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 2' } }}>
                    {selectedProduct && (
                      <Box>
                        <Typography variant="caption" display="block" color="text.secondary">
                          MRP: {formatCurrency(selectedProduct.mrp)}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          After Discount: {formatCurrency(calculateSellingPrice(selectedProduct.mrp, selectedProductDiscount))}
                        </Typography>
                      </Box>
                    )}
                  </Grid>
                  
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 12', md: 'span 2' } }}>
                    <Button
                      variant="outlined"
                      color="primary"
                      fullWidth
                      onClick={handleAddProduct}
                      disabled={!selectedProduct}
                    >
                      Add
                    </Button>
                  </Grid>
                </Grid>
              </Box>
              
              {/* Selected Products List */}
              {currentSale?.products.length ? (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Serial #</TableCell>
                        <TableCell align="right">MRP</TableCell>
                        <TableCell align="right">Discount</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentSale.products.map((product, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {product.name} ({product.company})
                          </TableCell>
                          <TableCell>
                            <TextField
                              variant="outlined"
                              size="small"
                              placeholder="S/N"
                              value={product.serialNumber || ''}
                              onChange={(e) => {
                                if (currentSale) {
                                  const updatedProducts = [...currentSale.products];
                                  updatedProducts[index].serialNumber = e.target.value;
                                  setCurrentSale({
                                    ...currentSale,
                                    products: updatedProducts,
                                  });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(product.mrp)}
                          </TableCell>
                          <TableCell align="right">
                            {product.discountPercent}% ({formatCurrency(product.discount)})
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(product.sellingPrice)}
                          </TableCell>
                          <TableCell align="right">
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
              ) : (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
                  No products added yet
                </Typography>
              )}
              
              {/* Accessories Section */}
              <Typography variant="subtitle2" gutterBottom>
                Accessories
              </Typography>
              
              {/* Accessory input form would go here */}
              
              <Divider sx={{ my: 2 }} />
              
              <Box mt={3}>
                <Typography variant="subtitle2" gutterBottom>
                  Invoice Summary
                </Typography>
                
                <Grid container spacing={2} mt={1}>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                    <TextField
                      label="Subtotal"
                      variant="outlined"
                      size="small"
                      fullWidth
                      type="number"
                      value={currentSale?.totalAmount || 0}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                        readOnly: true,
                      }}
                    />
                  </Grid>
                  
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                    <TextField
                      label="GST Percentage"
                      variant="outlined"
                      size="small"
                      fullWidth
                      type="number"
                      value={currentSale?.gstPercentage || 5}
                      onChange={(e) => {
                        const newGstPercentage = Math.max(0, Math.min(28, parseInt(e.target.value) || 0));
                        handleGstPercentageChange(newGstPercentage);
                      }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                      inputProps={{ min: 0, max: 28 }}
                    />
                  </Grid>
                  
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                    <TextField
                      label="GST Amount"
                      variant="outlined"
                      size="small"
                      fullWidth
                      type="number"
                      value={currentSale?.gstAmount || 0}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                        readOnly: true,
                      }}
                    />
                  </Grid>
                  
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                    <TextField
                      label="Total Amount"
                      variant="outlined"
                      size="small"
                      fullWidth
                      type="number"
                      value={(currentSale?.totalAmount || 0) + (currentSale?.gstAmount || 0)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                        readOnly: true,
                      }}
                    />
                  </Grid>
                  
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                    <TextField
                      label="Net Profit"
                      variant="outlined"
                      size="small"
                      fullWidth
                      type="number"
                      value={currentSale?.netProfit || 0}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                        readOnly: true,
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSaveSale}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invoice Preview for Enquiry Sales */}
      <Dialog open={invoiceOpen} onClose={() => setInvoiceOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Invoice Preview
          <IconButton onClick={() => window.print()} sx={{ ml: 1 }} size="small">
            <PrintIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {invoiceSale && (
            <Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Patient</Typography>
                <Typography variant="body1" fontWeight="medium">{invoiceSale.patientName}</Typography>
                {invoiceSale.address && (
                  <Typography variant="caption" color="text.secondary">{invoiceSale.address}</Typography>
                )}
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Serial</TableCell>
                    <TableCell align="right">MRP</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">GST%</TableCell>
                    <TableCell align="right">Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoiceSale.products.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.serialNumber || '—'}</TableCell>
                      <TableCell align="right">{formatCurrency(p.mrp || 0)}</TableCell>
                      <TableCell align="right">{formatCurrency(p.sellingPrice || 0)}</TableCell>
                      <TableCell align="right">{(p.gstPercent ?? 0)}%</TableCell>
                      <TableCell align="right">{formatCurrency(p.finalAmount || p.sellingPrice || 0)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="subtitle2">Grand Total</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2">{formatCurrency(invoiceSale.totalAmount || 0)}</Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvoiceOpen(false)}>Close</Button>
          <Button variant="contained" onClick={() => window.print()} startIcon={<PrintIcon />}>Print</Button>
        </DialogActions>
      </Dialog>
      
      {/* Success/Error messages */}
      <Snackbar open={!!successMsg} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="success" variant="filled">
          {successMsg}
        </Alert>
      </Snackbar>
      
      <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="error" variant="filled">
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SalesPage; 