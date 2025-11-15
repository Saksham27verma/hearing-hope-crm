'use client';

import React, { useState, useEffect } from 'react';
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
  DialogContent,
  IconButton,
  InputAdornment,
  TextField,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  Container,
  DialogTitle,
  Stack,
  Divider,
  Card,
  CardContent,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  BusinessCenter as PartyIcon,
  Receipt as ReceiptIcon,
  Visibility as PreviewIcon,
  Close as CloseIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import PurchaseForm from '@/components/purchases/PurchaseForm';

// Types
interface Product {
  id: string;
  name: string;
  type: string;
  company: string;
  mrp: number;
  dealerPrice?: number;
  gstApplicable?: boolean;
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

export default function PurchaseManagement() {
  const { user, userProfile, isAllowedModule } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [filteredPurchases, setFilteredPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentPurchase, setCurrentPurchase] = useState<Purchase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  
  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPurchase, setPreviewPurchase] = useState<Purchase | null>(null);

  // Fetch data when component mounts
  useEffect(() => {
    if (!user) return;
    
    if (isAllowedModule('purchases')) {
      fetchPurchases();
      fetchProducts();
      fetchParties();
    } else {
      setLoading(false);
    }
  }, [user, isAllowedModule]);

  // Auto-open preview when navigated with #id=<docId>
  useEffect(() => {
    if (!purchases.length) return;
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const match = hash.match(/id=([^&]+)/);
      if (match && match[1]) {
        const target = purchases.find(p => p.id === match[1]);
        if (target) {
          setPreviewPurchase(target);
          setPreviewOpen(true);
        }
      }
    } catch {}
  }, [purchases]);

  // Filter purchases when search term or date filter changes
  useEffect(() => {
    if (purchases.length === 0) {
      setFilteredPurchases([]);
      return;
    }
    
    let filtered = [...purchases];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(purchase => 
        purchase.invoiceNo.toLowerCase().includes(searchLower) ||
        purchase.party.name.toLowerCase().includes(searchLower) ||
        purchase.company.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(purchase => {
        const purchaseDate = new Date(purchase.purchaseDate.seconds * 1000);
        return (
          purchaseDate.getDate() === filterDate.getDate() &&
          purchaseDate.getMonth() === filterDate.getMonth() &&
          purchaseDate.getFullYear() === filterDate.getFullYear()
        );
      });
    }
    
    setFilteredPurchases(filtered);
  }, [purchases, searchTerm, dateFilter]);

  // Fetch purchases from Firestore
  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const purchasesCollection = collection(db, 'purchases');
      const purchasesQuery = query(purchasesCollection, orderBy('purchaseDate', 'desc'));
      const snapshot = await getDocs(purchasesQuery);
      
      const purchasesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Purchase[];
      
      setPurchases(purchasesData);
      setFilteredPurchases(purchasesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load purchase data',
        severity: 'error'
      });
      setLoading(false);
    }
  };

  // Fetch products for reference
  const fetchProducts = async () => {
    try {
      const productsCollection = collection(db, 'products');
      const snapshot = await getDocs(productsCollection);
      
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load product data',
        severity: 'error'
      });
    }
  };

  // Fetch parties (suppliers)
  const fetchParties = async () => {
    try {
      const partiesCollection = collection(db, 'parties');
      const snapshot = await getDocs(partiesCollection);
      
      const partiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Party[];
      
      setParties(partiesData);
    } catch (error) {
      console.error('Error fetching parties:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load party data',
        severity: 'error'
      });
    }
  };

  // Handle adding a new purchase
  const handleAddPurchase = () => {
    setCurrentPurchase(null);
    setOpenDialog(true);
  };

  // Handle editing a purchase
  const handleEditPurchase = (purchase: Purchase) => {
    setCurrentPurchase(purchase);
    setOpenDialog(true);
  };

  // Handle deleting a purchase
  const handleDeletePurchase = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this purchase?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'purchases', id));
      setPurchases(prevPurchases => prevPurchases.filter(purchase => purchase.id !== id));
      setSnackbar({
        open: true,
        message: 'Purchase deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting purchase:', error);
      setSnackbar({
        open: true,
        message: 'Failed to delete purchase',
        severity: 'error'
      });
    }
  };

  // Handle closing the dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentPurchase(null);
  };

  // Handle saving a purchase
  const handleSavePurchase = async (purchaseData: Purchase) => {
    try {
      setLoading(true);
      
      if (currentPurchase?.id) {
        // Update existing purchase
        const purchaseRef = doc(db, 'purchases', currentPurchase.id);
        await updateDoc(purchaseRef, {
          ...purchaseData,
          updatedAt: serverTimestamp()
        });
        
        // Update local state
        setPurchases(prevPurchases => 
          prevPurchases.map(p => 
            p.id === currentPurchase.id ? { ...purchaseData, id: currentPurchase.id } : p
          )
        );
        
        setSnackbar({
          open: true,
          message: 'Purchase updated successfully',
          severity: 'success'
        });
      } else {
        // Add new purchase
        const newPurchaseData = {
          ...purchaseData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'purchases'), newPurchaseData);
        
        // Update local state with timestamps converted to current time for UI
        const newPurchaseWithTimestamp = {
          ...purchaseData,
          id: docRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        setPurchases(prevPurchases => [
          newPurchaseWithTimestamp,
          ...prevPurchases
        ]);
        
        setSnackbar({
          open: true,
          message: 'Purchase added successfully',
          severity: 'success'
        });
      }
      
      setOpenDialog(false);
      setCurrentPurchase(null);
    } catch (error) {
      console.error('Error saving purchase:', error);
      setSnackbar({
        open: true,
        message: 'Failed to save purchase',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Table pagination handlers
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Format date for display
  const formatDate = (timestamp: Timestamp) => {
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Calculate total products in a purchase
  const calculateTotalProducts = (purchase: Purchase) => {
    return purchase.products.reduce((sum, product) => sum + product.quantity, 0);
  };

  const handleCancel = () => {
    // Just reset or go back
    window.history.back();
  };

  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // Handle opening the preview dialog
  const handlePreviewPurchase = (purchase: Purchase) => {
    setPreviewPurchase(purchase);
    setPreviewOpen(true);
  };

  // Handle closing the preview dialog
  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewPurchase(null);
  };

  // Calculate grand total including GST
  const calculateGrandTotal = (purchase: Purchase) => {
    const subtotal = purchase.totalAmount;
    if (purchase.gstType === 'GST Exempted') {
      return subtotal;
    }
    return subtotal * (1 + purchase.gstPercentage / 100);
  };

  if (loading && products.length === 0 && parties.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isAllowedModule('purchases')) {
    return (
      <Box textAlign="center" p={4}>
        <Typography variant="h5" color="error" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1">
          You do not have permission to access the purchases module.
        </Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1">
            Purchase Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track and manage product purchases from suppliers
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={handleAddPurchase}
          sx={{ borderRadius: 2 }}
        >
          New Purchase
        </Button>
      </Box>
      
      {/* Search and filters */}
      <Paper elevation={1} sx={{ p: 2, mb: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Search invoice or supplier..."
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
            sx={{ flexGrow: 1, minWidth: '200px' }}
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
                  sx: { minWidth: '180px' }
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
      </Paper>
      
      {/* Purchases Table */}
      <Paper elevation={1} sx={{ borderRadius: 2 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: '#f8f9fa' }}>
          <Typography variant="h6">
            Purchase Records 
            {filteredPurchases.length > 0 && (
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                ({filteredPurchases.length} {filteredPurchases.length === 1 ? 'record' : 'records'})
              </Typography>
            )}
          </Typography>
        </Box>
        
        <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 'bold', bgcolor: '#f8f9fa' } }}>
                <TableCell>Date</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Products</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPurchases.length > 0 ? (
                filteredPurchases
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((purchase) => (
                    <TableRow 
                      key={purchase.id} 
                      hover
                      sx={{ 
                        '&:nth-of-type(odd)': { bgcolor: 'background.default' },
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <TableCell>{formatDate(purchase.purchaseDate)}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <ReceiptIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          {purchase.invoiceNo}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <PartyIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          {purchase.party.name}
                        </Box>
                      </TableCell>
                      <TableCell>{purchase.company}</TableCell>
                      <TableCell>
                        <Chip 
                          label={`${calculateTotalProducts(purchase)} items`} 
                          size="small" 
                          color="info" 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                        {formatCurrency(purchase.totalAmount)}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                          <Tooltip title="Preview">
                            <IconButton 
                              size="small" 
                              color="info"
                              onClick={() => handlePreviewPurchase(purchase)}
                              sx={{ 
                                bgcolor: 'info.lighter', 
                                '&:hover': { bgcolor: 'info.light' } 
                              }}
                            >
                              <PreviewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleEditPurchase(purchase)}
                              sx={{ 
                                bgcolor: 'primary.lighter', 
                                '&:hover': { bgcolor: 'primary.light' } 
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {userProfile?.role === 'admin' && (
                            <Tooltip title="Delete">
                              <IconButton 
                                size="small" 
                                color="error" 
                                onClick={() => purchase.id && handleDeletePurchase(purchase.id)}
                                sx={{ 
                                  bgcolor: 'error.lighter', 
                                  '&:hover': { bgcolor: 'error.light' } 
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    {searchTerm || dateFilter ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
                        <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                        <Typography variant="h6" color="text.secondary">No purchases match your search</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Try different search terms or clear your filters
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
                        <AddIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                        <Typography variant="h6" color="text.secondary">No purchases recorded</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          Click the "New Purchase" button to create your first purchase record
                        </Typography>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<AddIcon />}
                          onClick={handleAddPurchase}
                          sx={{ mt: 2, borderRadius: 2 }}
                        >
                          New Purchase
                        </Button>
                      </Box>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          component="div"
          count={filteredPurchases.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
          sx={{ borderTop: '1px solid', borderColor: 'divider' }}
        />
      </Paper>
      
      {/* Purchase Form Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{ 
          sx: { 
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
          } 
        }}
      >
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            {currentPurchase ? 'Edit Purchase' : 'New Purchase'}
          </Typography>
          <PurchaseForm
            initialData={currentPurchase || undefined}
            products={products}
            parties={parties}
            onSave={handleSavePurchase}
            onCancel={handleCloseDialog}
          />
        </DialogContent>
      </Dialog>
      
      {/* Purchase Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={handleClosePreview}
        maxWidth="md"
        fullWidth
        PaperProps={{ 
          sx: { 
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
          } 
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          p: 2,
          bgcolor: 'primary.lighter'
        }}>
          <Box display="flex" alignItems="center">
            <ReceiptIcon sx={{ mr: 1.5 }} color="primary" />
            <Typography variant="h6" component="div">
              Purchase Preview: {previewPurchase?.invoiceNo}
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Print">
              <IconButton 
                onClick={() => window.print()}
                sx={{ mr: 1 }}
              >
                <PrintIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={handleClosePreview}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {previewPurchase && (
            <Box>
              {/* Invoice Details */}
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
                    <Typography variant="body2" color="text.secondary">Invoice Number:</Typography>
                    <Typography variant="body1" fontWeight="medium">{previewPurchase.invoiceNo}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">Invoice Date:</Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatDate(previewPurchase.purchaseDate)}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">Supplier:</Typography>
                    <Typography variant="body1" fontWeight="medium">{previewPurchase.party.name}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">Company Billed To:</Typography>
                    <Typography variant="body1" fontWeight="medium">{previewPurchase.company}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary">GST Type:</Typography>
                    <Typography variant="body1" fontWeight="medium">{previewPurchase.gstType}</Typography>
                  </Box>
                  
                  {previewPurchase.gstType !== 'GST Exempted' && (
                    <Box>
                      <Typography variant="body2" color="text.secondary">GST Percentage:</Typography>
                      <Typography variant="body1" fontWeight="medium">{previewPurchase.gstPercentage}%</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
              
              {/* Products Table */}
              <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}>
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
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="center">Discount</TableCell>
                        <TableCell align="right">Final Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewPurchase.products.map((product, index) => (
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
                            <Typography variant="caption" color="text.secondary">
                              Type: {product.type}
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
                          <Typography variant="subtitle2">{formatCurrency(previewPurchase.totalAmount)}</Typography>
                        </TableCell>
                      </TableRow>
                      
                      {previewPurchase.gstType !== 'GST Exempted' && (
                        <>
                          <TableRow>
                            <TableCell colSpan={4} />
                            <TableCell align="right">GST ({previewPurchase.gstPercentage}%)</TableCell>
                            <TableCell align="right">
                              {formatCurrency(previewPurchase.totalAmount * (previewPurchase.gstPercentage / 100))}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={4} />
                            <TableCell align="right">
                              <Typography variant="subtitle2" fontWeight="bold">Grand Total</Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="subtitle2" fontWeight="bold">
                                {formatCurrency(calculateGrandTotal(previewPurchase))}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
              
              {/* Serial Numbers Section */}
              {previewPurchase.products.some(p => p.serialNumbers && p.serialNumbers.length > 0) && (
                <Paper elevation={0} sx={{ p: 3, borderRadius: 2, bgcolor: '#f8f9fa' }}>
                  <Typography variant="subtitle1" fontWeight={600} color="primary" gutterBottom>
                    Serial Numbers
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  {previewPurchase.products
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
          )}
        </DialogContent>
      </Dialog>
      
      {/* Snackbar for success/error messages */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity} 
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
} 