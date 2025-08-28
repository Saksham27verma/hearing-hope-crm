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
  DialogActions,
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
  CompareArrows as ConvertIcon,
  Refresh as RefreshIcon,
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
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import MaterialForm from '@/components/materials/MaterialForm';

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

export default function MaterialManagementPage() {
  const { user, isAllowedModule } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<Material | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  
  // Convert to purchase dialog state
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertMaterial, setConvertMaterial] = useState<Material | null>(null);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch data when component mounts
  useEffect(() => {
    if (!user) return;
    
    if (isAllowedModule('deliveries')) {
      fetchMaterials();
      fetchProducts();
      fetchParties();
    } else {
      setLoading(false);
    }
  }, [user, isAllowedModule]);

  // Filter materials when search term or date filter changes
  useEffect(() => {
    if (materials.length === 0) {
      setFilteredMaterials([]);
      return;
    }
    
    let filtered = [...materials];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(material => 
        material.challanNumber.toLowerCase().includes(searchLower) ||
        material.party.name.toLowerCase().includes(searchLower) ||
        material.company.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(material => {
        const materialDate = new Date(material.receivedDate.seconds * 1000);
        return (
          materialDate.getDate() === filterDate.getDate() &&
          materialDate.getMonth() === filterDate.getMonth() &&
          materialDate.getFullYear() === filterDate.getFullYear()
        );
      });
    }
    
    setFilteredMaterials(filtered);
  }, [materials, searchTerm, dateFilter]);

  // Fetch materials from Firestore
  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const materialsCollection = collection(db, 'materials');
      const materialsQuery = query(materialsCollection, orderBy('receivedDate', 'desc'));
      const snapshot = await getDocs(materialsQuery);
      
      const materialsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Material[];
      
      setMaterials(materialsData);
      setFilteredMaterials(materialsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching materials:', error);
      setErrorMsg('Failed to load material data');
      setLoading(false);
    }
  };

  // Fetch products from Firestore
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
      setErrorMsg('Failed to load product data');
    }
  };

  // Fetch parties from Firestore
  const fetchParties = async () => {
    try {
      const partiesCollection = collection(db, 'parties');
      const partiesQuery = query(partiesCollection, 
        where('category', 'in', ['supplier', 'both'])
      );
      const snapshot = await getDocs(partiesQuery);
      
      const partiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Party[];
      
      setParties(partiesData);
    } catch (error) {
      console.error('Error fetching parties:', error);
      setErrorMsg('Failed to load supplier data');
    }
  };

  // Handle pagination page change
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle changing rows per page
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Generate a new challan number
  const generateChallanNumber = () => {
    // Format: DC-YYYYMMDD-XXX
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
    return `DC-${dateString}-${randomNum}`;
  };

  // Generate a new invoice number for conversion
  const generateInvoiceNumber = () => {
    setIsGenerating(true);
    // Format: INV-YYYYMMDD-XXX
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
    setInvoiceNo(`INV-${dateString}-${randomNum}`);
    setIsGenerating(false);
  };

  // Handle adding a new material
  const handleAddMaterial = () => {
    const challanNumber = generateChallanNumber();
    
    const emptyMaterial: Material = {
      challanNumber,
      party: { id: '', name: '' },
      company: 'Hope Enterprises',
      products: [],
      gstType: 'LGST',
      gstPercentage: 18,
      totalAmount: 0,
      receivedDate: Timestamp.now(),
    };
    
    setCurrentMaterial(emptyMaterial);
    setOpenDialog(true);
  };

  // Handle editing a material
  const handleEditMaterial = (material: Material) => {
    if (material.convertedToPurchase) {
      setErrorMsg("Cannot edit material that has been converted to purchase");
      return;
    }
    setCurrentMaterial(material);
    setOpenDialog(true);
  };

  // Close dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentMaterial(null);
  };

  // Handle saving material (create or update)
  const handleSaveMaterial = async (material: Material) => {
    try {
      if (material.id) {
        // Update existing material
        await updateDoc(doc(db, 'materials', material.id), {
          ...material,
          updatedAt: serverTimestamp(),
        });
        
        // Update local state
        setMaterials(prevMaterials => 
          prevMaterials.map(m => m.id === material.id ? { ...material, updatedAt: Timestamp.now() } : m)
        );
        
        setSuccessMsg('Material updated successfully');
      } else {
        // Create new material
        const materialData = {
          ...material,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(db, 'materials'), materialData);
        
        // Update local state
        setMaterials(prevMaterials => [
          { ...material, id: docRef.id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
          ...prevMaterials
        ]);
        
        setSuccessMsg('Material added successfully');
      }
      
      setOpenDialog(false);
      setCurrentMaterial(null);
    } catch (error) {
      console.error('Error saving material:', error);
      setErrorMsg('Failed to save material');
    }
  };

  // Handle deleting a material
  const handleDeleteMaterial = async (materialId: string) => {
    const materialToDelete = materials.find(m => m.id === materialId);
    
    if (materialToDelete?.convertedToPurchase) {
      setErrorMsg("Cannot delete material that has been converted to purchase");
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this material?')) {
      try {
        await deleteDoc(doc(db, 'materials', materialId));
        
        // Update local state
        setMaterials(prevMaterials => prevMaterials.filter(material => material.id !== materialId));
        
        setSuccessMsg('Material deleted successfully');
      } catch (error) {
        console.error('Error deleting material:', error);
        setErrorMsg('Failed to delete material');
      }
    }
  };

  // Preview material
  const handlePreviewMaterial = (material: Material) => {
    setPreviewMaterial(material);
    setPreviewOpen(true);
  };

  // Close preview dialog
  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewMaterial(null);
  };

  // Open convert to purchase dialog
  const handleOpenConvertDialog = (material: Material) => {
    if (material.convertedToPurchase) {
      setSuccessMsg(`This challan has already been converted to Purchase Invoice ${material.purchaseInvoiceNo || ''}`);
      return;
    }
    
    setConvertMaterial(material);
    generateInvoiceNumber();
    setConvertDialogOpen(true);
  };

  // Close convert dialog
  const handleCloseConvertDialog = () => {
    setConvertDialogOpen(false);
    setConvertMaterial(null);
    setInvoiceNo('');
  };

  // Convert material to purchase
  const handleConvertToPurchase = async () => {
    if (!convertMaterial || !invoiceNo.trim()) return;
    
    try {
      // Create a new purchase object from the material
      const purchaseData = {
        invoiceNo: invoiceNo,
        party: convertMaterial.party,
        company: convertMaterial.company,
        products: convertMaterial.products,
        gstType: convertMaterial.gstType,
        gstPercentage: convertMaterial.gstPercentage,
        totalAmount: convertMaterial.totalAmount,
        reference: `Converted from Delivery Challan ${convertMaterial.challanNumber}`,
        purchaseDate: convertMaterial.receivedDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Add the purchase to Firestore
      const docRef = await addDoc(collection(db, 'purchases'), purchaseData);
      
      // Update the material to mark it as converted
      await updateDoc(doc(db, 'materials', convertMaterial.id!), {
        convertedToPurchase: true,
        purchaseId: docRef.id,
        purchaseInvoiceNo: invoiceNo,
        updatedAt: serverTimestamp(),
      });
      
      // Update local state
      setMaterials(prevMaterials => 
        prevMaterials.map(material => 
          material.id === convertMaterial.id 
            ? { 
                ...material, 
                convertedToPurchase: true, 
                purchaseId: docRef.id,
                purchaseInvoiceNo: invoiceNo,
                updatedAt: Timestamp.now() 
              } 
            : material
        )
      );
      
      setSuccessMsg(`Successfully converted to Purchase Invoice ${invoiceNo}`);
      handleCloseConvertDialog();
      
    } catch (error) {
      console.error('Error converting to purchase:', error);
      setErrorMsg('Failed to convert to purchase');
    }
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

  // Calculate total products in a material
  const calculateTotalProducts = (material: Material) => {
    return material.products.reduce((sum, product) => sum + product.quantity, 0);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!isAllowedModule('deliveries')) {
    return (
      <Box textAlign="center" p={4}>
        <Typography variant="h5" color="error" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1">
          You do not have permission to access the materials module.
        </Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1">
            Material In
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track and manage delivery challans from suppliers
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={handleAddMaterial}
          sx={{ borderRadius: 2 }}
        >
          New Material In
        </Button>
      </Box>
      
      {/* Search and filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', flex: 1 }}>
          <TextField
            placeholder="Search materials..."
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
            sx={{ minWidth: 200, flex: 1 }}
          />
          
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Filter by date"
              value={dateFilter}
              onChange={(newValue) => {
                setDateFilter(newValue);
              }}
              slotProps={{ textField: { size: 'small' } }}
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
      </Box>
      
      {/* Materials table */}
      <Paper 
        sx={{ 
          width: '100%', 
          overflow: 'hidden',
          borderRadius: 2,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
      >
        <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Challan #</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Company</TableCell>
                <TableCell align="right">Products</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMaterials
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((material) => (
                  <TableRow key={material.id} hover>
                    <TableCell>{formatDate(material.receivedDate)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ReceiptIcon color="action" sx={{ mr: 1, fontSize: 16 }} />
                        {material.challanNumber}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PartyIcon color="action" sx={{ mr: 1, fontSize: 16 }} />
                        {material.party.name}
                      </Box>
                    </TableCell>
                    <TableCell>{material.company}</TableCell>
                    <TableCell align="right">{calculateTotalProducts(material)}</TableCell>
                    <TableCell align="right">{formatCurrency(material.totalAmount)}</TableCell>
                    <TableCell align="center">
                      {material.convertedToPurchase ? (
                        <Chip 
                          label="Converted" 
                          size="small" 
                          color="success" 
                          title={`Converted to Invoice ${material.purchaseInvoiceNo}`}
                        />
                      ) : (
                        <Chip 
                          label="Pending" 
                          size="small" 
                          color="primary" 
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Tooltip title="Preview">
                          <IconButton 
                            size="small" 
                            onClick={() => handlePreviewMaterial(material)}
                            color="info"
                          >
                            <PreviewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Edit">
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditMaterial(material)}
                            disabled={material.convertedToPurchase}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Delete">
                          <IconButton 
                            size="small" 
                            onClick={() => handleDeleteMaterial(material.id!)}
                            disabled={material.convertedToPurchase}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Convert to Purchase">
                          <IconButton 
                            size="small" 
                            onClick={() => handleOpenConvertDialog(material)}
                            disabled={material.convertedToPurchase}
                            color="success"
                          >
                            <ConvertIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                
              {filteredMaterials.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                      No materials found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredMaterials.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      
      {/* Material Form Dialog */}
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
          <MaterialForm
            initialData={currentMaterial || undefined}
            products={products}
            parties={parties}
            onSave={handleSaveMaterial}
            onCancel={handleCloseDialog}
          />
        </DialogContent>
      </Dialog>
      
      {/* Convert to Purchase Dialog */}
      <Dialog
        open={convertDialogOpen}
        onClose={handleCloseConvertDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Convert to Purchase</DialogTitle>
        <DialogContent>
          <Box sx={{ my: 2 }}>
            <Typography variant="body1" gutterBottom>
              You are about to convert Delivery Challan <strong>{convertMaterial?.challanNumber}</strong> into a Purchase Invoice.
            </Typography>
            
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
              This will create a new Purchase record with all the products from this delivery challan.
              The challan will be marked as converted and cannot be edited afterward.
            </Typography>
            
            <TextField
              margin="normal"
              label="Purchase Invoice Number"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              fullWidth
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={generateInvoiceNumber}
                      disabled={isGenerating}
                      edge="end"
                    >
                      <Tooltip title="Generate New Number">
                        <RefreshIcon />
                      </Tooltip>
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            
            {convertMaterial && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Summary:
                </Typography>
                <Box sx={{ ml: 2 }}>
                  <Typography variant="body2">
                    Supplier: <strong>{convertMaterial.party?.name}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Company: <strong>{convertMaterial.company}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Product Count: <strong>{convertMaterial.products.length}</strong>
                  </Typography>
                  <Typography variant="body2">
                    Total Amount: <strong>{formatCurrency(convertMaterial.totalAmount)}</strong>
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConvertDialog} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={handleConvertToPurchase}
            color="primary" 
            variant="contained"
            disabled={!invoiceNo.trim() || isGenerating}
          >
            Convert to Purchase
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbars for success/error messages */}
      <Snackbar
        open={!!successMsg}
        autoHideDuration={6000}
        onClose={() => setSuccessMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSuccessMsg('')} 
          severity="success" 
          variant="filled"
        >
          {successMsg}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!errorMsg}
        autoHideDuration={6000}
        onClose={() => setErrorMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setErrorMsg('')} 
          severity="error"
          variant="filled"
        >
          {errorMsg}
        </Alert>
      </Snackbar>
    </Container>
  );
} 