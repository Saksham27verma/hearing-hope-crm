'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  IconButton,
  InputAdornment,
  Autocomplete,
  Stack,
  Grid,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  SwapHoriz as TransferIcon,
  Inventory as InventoryIcon,
  Store as StoreIcon,
  InfoOutlined as InfoIcon,
  Summarize as SummarizeIcon,
  LocationOn as LocationIcon,
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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { getHeadOfficeId } from '@/utils/centerUtils';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Types
interface Product {
  id: string;
  name: string;
  type: string;
  company: string;
  serialNumber?: string; // For tracking individual items
  hasSerialNumber?: boolean;
}

interface StockTransferProduct {
  productId: string;
  name: string;
  serialNumbers: string[];
  quantity: number;
  dealerPrice?: number;
  mrp?: number;
}

interface StockTransfer {
  id?: string;
  transferNumber: string;
  fromBranch: string;
  toBranch: string;
  products: StockTransferProduct[];
  reason: string;
  notes?: string;
  transferDate: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Available stock item for selection
interface AvailableStockItem {
  productId: string;
  name: string;
  type: string;
  company?: string;
  location: string;
  isSerialTracked: boolean;
  serialNumber?: string; // present when serial-tracked
  quantity?: number; // for non-serial tracked at this location
}

// Component
const StockTransferPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [filteredTransfers, setFilteredTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentTransfer, setCurrentTransfer] = useState<StockTransfer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [availableStock, setAvailableStock] = useState<AvailableStockItem[]>([]);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  // Selection state inside dialog
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  type SerialOption = { label: string; value: string; location: string };
  const [selectedSerials, setSelectedSerials] = useState<SerialOption[]>([]);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  
  const [centers, setCenters] = useState<{id: string, name: string}[]>([]);
  // Branch options derived from centers collection
  const branchOptions = useMemo(() => centers, [centers]);

  // Helper function to get center name from ID
  const getCenterName = (centerId: string) => {
    const center = centers.find(c => c.id === centerId);
    return center ? center.name : centerId; // Fallback to ID if not found
  };

  // Filter available stock by source center
  const filteredAvailableStock = useMemo(() => {
    if (!currentTransfer?.fromBranch) return [];
    return availableStock.filter(item => item.location === currentTransfer.fromBranch);
  }, [availableStock, currentTransfer?.fromBranch]);

  // Get unique products available at the source center
  const availableProducts = useMemo(() => {
    const productMap = new Map<string, any>();
    filteredAvailableStock.forEach(item => {
      if (!productMap.has(item.productId)) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          productMap.set(item.productId, {
            ...product,
            availableCount: filteredAvailableStock.filter(s => s.productId === item.productId).length
          });
        }
      }
    });
    return Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredAvailableStock, products]);

  // Get serial options for the selected product at the source center
  const serialOptions = useMemo(() => {
    if (!selectedProduct || !currentTransfer?.fromBranch) return [];
    
    return filteredAvailableStock
      .filter(item => item.productId === selectedProduct.id && item.isSerialTracked && item.serialNumber)
      .map(item => ({
        label: item.serialNumber!,
        value: item.serialNumber!,
        location: getCenterName(item.location)
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedProduct, currentTransfer?.fromBranch, filteredAvailableStock, getCenterName]);

  // Get available quantity for non-serial tracked products
  const availableQtyForSelected = useMemo(() => {
    if (!selectedProduct || !currentTransfer?.fromBranch || selectedProduct.hasSerialNumber) return 0;
    
    const item = filteredAvailableStock.find(
      stock => stock.productId === selectedProduct.id && !stock.isSerialTracked
    );
    return item?.quantity || 0;
  }, [selectedProduct, currentTransfer?.fromBranch, filteredAvailableStock]);

  // Reasons for transfer
  const reasonOptions = [
    'Stock Balancing',
    'Customer Request',
    'Branch Opening Stock',
    'Repair or Service',
    'Promotional Activity',
    'Other'
  ];
  
  // Initialize empty transfer
  const emptyTransfer: StockTransfer = {
    transferNumber: '',
    fromBranch: '',
    toBranch: '',
    products: [],
    reason: '',
    transferDate: Timestamp.now(),
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Fetch transfers data
    fetchTransfers();
    
    // Fetch products for reference
    fetchProducts();
    // Prefetch available stock for selection
    fetchAvailableStock();
    // Load centers for from/to
    loadCenters();
    
  }, [user, authLoading, router]);

  const loadCenters = async () => {
    try {
      const snap = await getDocs(collection(db, 'centers'));
      const list = snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name })).filter(c => c.name).sort((a,b)=>a.name.localeCompare(b.name));
      setCenters(list);
    } catch (e) {
      console.error('Failed to load centers', e);
      setCenters([]);
    }
  };

  // Filter transfers when search term, status filter or date filter changes
  useEffect(() => {
    if (transfers.length === 0) {
      setFilteredTransfers([]);
      return;
    }
    
    let filtered = [...transfers];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(transfer => 
        transfer.transferNumber.toLowerCase().includes(searchLower) ||
        transfer.fromBranch.toLowerCase().includes(searchLower) ||
        transfer.toBranch.toLowerCase().includes(searchLower)
      );
    }
    

    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(transfer => {
        const transferDate = new Date(transfer.transferDate.seconds * 1000);
        return (
          transferDate.getDate() === filterDate.getDate() &&
          transferDate.getMonth() === filterDate.getMonth() &&
          transferDate.getFullYear() === filterDate.getFullYear()
        );
      });
    }
    
    setFilteredTransfers(filtered);
  }, [transfers, searchTerm, dateFilter]);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const transfersQuery = query(collection(db, 'stockTransfers'), orderBy('transferDate', 'desc'));
      const snapshot = await getDocs(transfersQuery);
      
      const transfersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as StockTransfer[];
      
      setTransfers(transfersData);
      setFilteredTransfers(transfersData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stock transfers:', error);
      setErrorMsg('Failed to load stock transfers data');
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

  // Build available stock (in-stock at each location) for selection
  const fetchAvailableStock = async () => {
    try {
      const [productsSnap, materialInSnap, purchasesSnap, materialsOutSnap, salesSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'materialInward')),
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'materialsOut')),
        getDocs(collection(db, 'sales')),
      ]);

      // Get head office ID for backward compatibility
      const headOfficeId = await getHeadOfficeId();

      const productById = new Map<string, any>();
      productsSnap.docs.forEach(d => productById.set(d.id, d.data()));

      const pendingOutSerials = new Set<string>();
      const dispatchedOutSerials = new Set<string>();
      materialsOutSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        const status = data.status as string;
        (data.products || []).forEach((prod: any) => {
          (prod.serialNumbers || []).forEach((sn: string) => {
            const key = `${prod.productId || prod.id || ''}|${sn}`;
            if (status === 'pending') pendingOutSerials.add(key);
            if (status === 'dispatched') dispatchedOutSerials.add(key);
          });
        });
      });
      const soldSerials = new Set<string>();
      salesSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        (data.products || []).forEach((prod: any) => {
          const key = `${prod.id || prod.productId || ''}|${prod.serialNumber || ''}`;
          if (prod.serialNumber) soldSerials.add(key);
        });
      });

      // Serial-tracked available list
      const serialAvailable: AvailableStockItem[] = [];
      // Non-serial aggregation: productId+location -> qty
      const nonSerialInByProductLoc = new Map<string, number>();

      // From materialIn
      materialInSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        const location = data.location || headOfficeId || '-';
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id;
          const productRef = productById.get(productId) || {};
          const name = prod.name || productRef.name || '';
          const type = prod.type || productRef.type || '';
          const company = productRef.company || '';
          const hasSerial = !!productRef.hasSerialNumber;
          const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
          if (hasSerial && serials.length > 0) {
            serials.forEach((sn: string) => {
              const key = `${productId}|${sn}`;
              const reserved = pendingOutSerials.has(key) || dispatchedOutSerials.has(key);
              const sold = soldSerials.has(key);
              if (!reserved && !sold) {
                serialAvailable.push({ productId, name, type, company, location, isSerialTracked: true, serialNumber: sn });
              }
            });
          } else if (!hasSerial) {
            const k = `${productId}|${location}`;
            nonSerialInByProductLoc.set(k, (nonSerialInByProductLoc.get(k) || 0) + (prod.quantity || 0));
          }
        });
      });

      // From purchases (ensure not overriding materialIn items)
      purchasesSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        const location = data.location || headOfficeId || '-';
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id;
          const productRef = productById.get(productId) || {};
          const name = prod.name || productRef.name || '';
          const type = prod.type || productRef.type || '';
          const company = productRef.company || '';
          const hasSerial = !!productRef.hasSerialNumber;
          const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
          if (hasSerial && serials.length > 0) {
            serials.forEach((sn: string) => {
              const key = `${productId}|${sn}`;
              const already = serialAvailable.find(s => s.productId === productId && s.serialNumber === sn);
              if (already) return;
              const reserved = pendingOutSerials.has(key) || dispatchedOutSerials.has(key);
              const sold = soldSerials.has(key);
              if (!reserved && !sold) {
                serialAvailable.push({ productId, name, type, company, location, isSerialTracked: true, serialNumber: sn });
              }
            });
          } else if (!hasSerial) {
            const k = `${productId}|${location}`;
            nonSerialInByProductLoc.set(k, (nonSerialInByProductLoc.get(k) || 0) + (prod.quantity || 0));
          }
        });
      });

      // Subtract non-serial material outs
      materialsOutSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        const location = data.company || '-';
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id;
          const productRef = productById.get(productId) || {};
          const hasSerial = !!productRef.hasSerialNumber;
          const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
          if (!hasSerial && (!serials || serials.length === 0)) {
            const k = `${productId}|${location}`;
            nonSerialInByProductLoc.set(k, Math.max(0, (nonSerialInByProductLoc.get(k) || 0) - (prod.quantity || 0)));
          }
        });
      });

      const nonSerialAvailable: AvailableStockItem[] = [];
      nonSerialInByProductLoc.forEach((qty, key) => {
        if (qty <= 0) return;
        const [productId, location] = key.split('|');
        const p = productById.get(productId) || {};
        nonSerialAvailable.push({
          productId,
          name: p.name || '',
          type: p.type || '',
          company: p.company || '',
          location,
          isSerialTracked: false,
          quantity: qty,
        });
      });

      setAvailableStock([...serialAvailable, ...nonSerialAvailable]);
    } catch (error) {
      console.error('Error building available stock:', error);
    }
  };

  const handleAddTransfer = () => {
    // Generate new transfer number (format: TR-YYYYMMDD-XXX)
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
    const transferNumber = `TR-${dateString}-${randomNum}`;
    
    setCurrentTransfer({
      ...emptyTransfer,
      transferNumber
    });
    
    // Reset selection state
    setSelectedProduct(null);
    setSelectedSerials([]);
    setSelectedQuantity(1);
    
    // Refresh available stock data
    fetchAvailableStock();
    
    setOpenDialog(true);
  };

  const handleEditTransfer = (transfer: StockTransfer) => {
    setCurrentTransfer(transfer);
    setOpenDialog(true);
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this stock transfer?')) return;
    
    try {
      await deleteDoc(doc(db, 'stockTransfers', id));
      setTransfers(prevTransfers => prevTransfers.filter(transfer => transfer.id !== id));
      setSuccessMsg('Stock transfer deleted successfully');
    } catch (error) {
      console.error('Error deleting stock transfer:', error);
      setErrorMsg('Failed to delete stock transfer');
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentTransfer(null);
  };

  // Get original pricing information from source inventory
  const getOriginalPricing = async (productId: string, serialNumbers: string[], fromBranch: string) => {
    try {
      // Fetch inventory data to get original pricing
      const [materialInSnap, purchasesSnap] = await Promise.all([
        getDocs(collection(db, 'materialInward')),
        getDocs(collection(db, 'purchases')),
      ]);

      let dealerPrice = 0;
      let mrp = 0;

      // Search in materialInward
      for (const docSnap of materialInSnap.docs) {
        const data: any = docSnap.data();
        if (data.location === fromBranch) {
          const product = (data.products || []).find((p: any) => 
            (p.productId || p.id) === productId &&
            serialNumbers.some(sn => (p.serialNumbers || []).includes(sn))
          );
          if (product) {
            dealerPrice = product.dealerPrice || product.finalPrice || 0;
            mrp = product.mrp || 0;
            break;
          }
        }
      }

      // If not found in materialInward, search in purchases
      if (dealerPrice === 0) {
        for (const docSnap of purchasesSnap.docs) {
          const data: any = docSnap.data();
          if (data.location === fromBranch) {
            const product = (data.products || []).find((p: any) => 
              (p.productId || p.id) === productId &&
              serialNumbers.some(sn => (p.serialNumbers || []).includes(sn))
            );
            if (product) {
              dealerPrice = product.dealerPrice || product.finalPrice || 0;
              mrp = product.mrp || 0;
              break;
            }
          }
        }
      }

      return { dealerPrice, mrp };
    } catch (error) {
      console.error('Error fetching original pricing:', error);
      return { dealerPrice: 0, mrp: 0 };
    }
  };

  // Create inventory movements for stock transfer
  const createInventoryMovements = async (transfer: StockTransfer) => {
    try {
      const now = new Date();
      const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomNum = Math.floor(Math.random() * 900) + 100;

      // Get enhanced products with pricing information
      const enhancedProducts = await Promise.all(
        transfer.products.map(async (product) => {
          const pricing = await getOriginalPricing(product.productId, product.serialNumbers, transfer.fromBranch);
          return {
            ...product,
            dealerPrice: pricing.dealerPrice,
            mrp: pricing.mrp
          };
        })
      );

      // Create Material Out entry (from source location)
      const materialOutData = {
        challanNumber: `ST-OUT-${dateString}-${randomNum}`,
        recipient: { 
          id: 'stock-transfer', 
          name: `Stock Transfer to ${getCenterName(transfer.toBranch)}` 
        },
        company: 'Hope Enterprises',
        location: transfer.fromBranch,
        products: enhancedProducts.map(product => ({
          productId: product.productId,
          name: product.name,
          type: 'Stock Transfer',
          serialNumbers: product.serialNumbers,
          quantity: product.quantity,
          dealerPrice: product.dealerPrice || 0,
          mrp: product.mrp || 0,
          finalPrice: product.dealerPrice || 0,
          gstApplicable: false,
          quantityType: 'piece'
        })),
        totalAmount: enhancedProducts.reduce((sum, product) => sum + ((product.dealerPrice || 0) * product.quantity), 0),
        status: 'dispatched',
        reason: `Stock Transfer: ${transfer.reason} (Transfer #${transfer.transferNumber})`,
        dispatchDate: transfer.transferDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Create Material In entry (to destination location)
      const materialInData = {
        challanNumber: `ST-IN-${dateString}-${randomNum}`,
        supplier: { 
          id: 'stock-transfer', 
          name: `Stock Transfer from ${getCenterName(transfer.fromBranch)}` 
        },
        company: 'Hope Enterprises',
        location: transfer.toBranch,
        products: enhancedProducts.map(product => ({
          productId: product.productId,
          name: product.name,
          type: 'Stock Transfer',
          serialNumbers: product.serialNumbers,
          quantity: product.quantity,
          dealerPrice: product.dealerPrice || 0,
          mrp: product.mrp || 0,
          finalPrice: product.dealerPrice || 0,
          gstApplicable: false,
          quantityType: 'piece'
        })),
        totalAmount: enhancedProducts.reduce((sum, product) => sum + ((product.dealerPrice || 0) * product.quantity), 0),
        status: 'received',
        receivedDate: transfer.transferDate,
        notes: `Stock Transfer: ${transfer.reason} (Transfer #${transfer.transferNumber})`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Create both entries
      await Promise.all([
        addDoc(collection(db, 'materialsOut'), materialOutData),
        addDoc(collection(db, 'materialInward'), materialInData)
      ]);

      console.log('✅ Inventory movements created successfully for stock transfer');
    } catch (error) {
      console.error('❌ Error creating inventory movements:', error);
      throw error;
    }
  };

  const handleSaveTransfer = async () => {
    if (!currentTransfer) return;
    
    // Validate transfer data
    if (!currentTransfer.transferNumber || !currentTransfer.fromBranch || !currentTransfer.toBranch || !currentTransfer.reason) {
      setErrorMsg('Please fill all required fields');
      return;
    }
    
    if (currentTransfer.fromBranch === currentTransfer.toBranch) {
      setErrorMsg('Source and destination branches cannot be the same');
      return;
    }
    if (!currentTransfer.products || currentTransfer.products.length === 0) {
      setErrorMsg('Please add at least one product to transfer');
      return;
    }
    
    try {
      if (currentTransfer.id) {
        // Update existing transfer
        const transferRef = doc(db, 'stockTransfers', currentTransfer.id);
        await updateDoc(transferRef, {
          ...currentTransfer,
          updatedAt: serverTimestamp(),
        });
        
        // Update in state
        setTransfers(prevTransfers => 
          prevTransfers.map(transfer => 
            transfer.id === currentTransfer.id ? {...currentTransfer, updatedAt: Timestamp.now()} : transfer
          )
        );
        
        setSuccessMsg('Stock transfer updated successfully');
      } else {
        // Add new transfer
        const newTransferData = {
          ...currentTransfer,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(db, 'stockTransfers'), newTransferData);
        
        // Add to state with the new ID
        const newTransfer = {
          ...currentTransfer,
          id: docRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        
        // Create inventory movements (material out from source, material in to destination)
        await createInventoryMovements(newTransfer);
        
        setTransfers(prevTransfers => [newTransfer, ...prevTransfers]);
        setSuccessMsg('Stock transfer added successfully and inventory updated');
      }
      
      setOpenDialog(false);
    } catch (error) {
      console.error('Error saving stock transfer:', error);
      setErrorMsg('Failed to save stock transfer');
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

  const calculateTotalProducts = (transfer: StockTransfer) => {
    return transfer.products.reduce((total, product) => total + product.quantity, 0);
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
        Stock Transfer
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Manage inventory transfers between branches
      </Typography>
      
      {/* Filters and Actions */}
      <Box mb={3} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            placeholder="Search transfers..."
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
            sx={{ width: { xs: '100%', sm: 'auto' } }}
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
              onClick={() => {
                setDateFilter(null);
              }}
            >
              Clear Filters
            </Button>
          )}
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddTransfer}
        >
          New Transfer
        </Button>
      </Box>
      
      {/* Transfers Table */}
      <Paper elevation={0} variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Transfer #</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Products</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTransfers.length > 0 ? (
                filteredTransfers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((transfer) => (
                    <TableRow key={transfer.id} hover>
                      <TableCell>{formatDate(transfer.transferDate)}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <TransferIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          {transfer.transferNumber}
                        </Box>
                      </TableCell>
                      <TableCell>{getCenterName(transfer.fromBranch)}</TableCell>
                      <TableCell>{getCenterName(transfer.toBranch)}</TableCell>
                      <TableCell>
                        <Chip 
                          label={`${calculateTotalProducts(transfer)} items`} 
                          size="small" 
                          color="info" 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell>{transfer.reason}</TableCell>
                      <TableCell align="right">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleEditTransfer(transfer)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => transfer.id && handleDeleteTransfer(transfer.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      'No stock transfer records found'
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
          count={filteredTransfers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      
      {/* Transfer Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pb: 0, background: 'linear-gradient(90deg, #f8fafc, #fff)', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: 0.2 }}>{currentTransfer?.id ? 'Edit Stock Transfer' : 'New Stock Transfer'}</Typography>
              <Typography variant="body2" color="text.secondary">Serial-aware, branch-to-branch movement</Typography>
            </Box>
            <Chip icon={<SummarizeIcon />} label={`Transfer # ${currentTransfer?.transferNumber || ''}`} color="default" variant="outlined" sx={{ fontWeight: 600 }} />
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ background: 'linear-gradient(180deg, #ffffff 0%, #fcfcff 100%)', p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Grid container spacing={2}>
              <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InfoIcon fontSize="small" /> Transfer Information
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack spacing={2}>
                  <TextField
                    label="Transfer Number"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentTransfer?.transferNumber || ''}
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                  
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Transfer Date"
                      value={
                        currentTransfer?.transferDate 
                          ? new Date(currentTransfer.transferDate.seconds * 1000) 
                          : new Date()
                      }
                      onChange={(newValue) => {
                        if (currentTransfer && newValue) {
                          setCurrentTransfer({
                            ...currentTransfer,
                            transferDate: Timestamp.fromDate(newValue),
                          });
                        }
                      }}
                      slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                    />
                  </LocalizationProvider>
                  </Stack>
                </Paper>
              </Grid>
              
              <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StoreIcon fontSize="small" /> From / To Centers
                </Typography>
                
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>From Center</InputLabel>
                    <Select
                      value={currentTransfer?.fromBranch || ''}
                      label="From Center"
                      onChange={(e) => {
                        if (currentTransfer) {
                          setCurrentTransfer({
                            ...currentTransfer,
                            fromBranch: e.target.value,
                          });
                        }
                      }}
                    >
                      {branchOptions.map((center) => (
                        <MenuItem key={center.id} value={center.id}>{center.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth size="small">
                    <InputLabel>To Center</InputLabel>
                    <Select
                      value={currentTransfer?.toBranch || ''}
                      label="To Center"
                      onChange={(e) => {
                        if (currentTransfer) {
                          setCurrentTransfer({
                            ...currentTransfer,
                            toBranch: e.target.value,
                          });
                        }
                      }}
                    >
                      {branchOptions.map((center) => (
                        <MenuItem key={center.id} value={center.id}>{center.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth size="small">
                    <InputLabel>Reason for Transfer</InputLabel>
                    <Select
                      value={currentTransfer?.reason || ''}
                      label="Reason for Transfer"
                      onChange={(e) => {
                        if (currentTransfer) {
                          setCurrentTransfer({
                            ...currentTransfer,
                            reason: e.target.value,
                          });
                        }
                      }}
                    >
                      {reasonOptions.map((reason) => (
                        <MenuItem key={reason} value={reason}>{reason}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
            
            {/* Product Selection Section */}
            <Box mt={1}>
              <Typography variant="subtitle2" gutterBottom>
                Products to Transfer
              </Typography>

              {!currentTransfer?.fromBranch && (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, bgcolor: 'info.50', borderColor: 'info.200' }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <InfoIcon color="info" fontSize="small" />
                    <Typography variant="body2" color="info.main">
                      Please select a source center first to view available products
                    </Typography>
                  </Box>
                </Paper>
              )}

              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2, boxShadow: '0 12px 28px rgba(0,0,0,0.07)' }}>
                <Grid container spacing={2} alignItems="flex-end">
                  <Grid item xs={12} md={4}>
                    <Autocomplete
                      options={availableProducts}
                      getOptionLabel={(option) => `${option.name} ${option.company ? `(${option.company})` : ''} [${option.availableCount} available]`.trim()}
                      value={selectedProduct}
                      onChange={(_, value) => {
                        setSelectedProduct(value);
                        setSelectedSerials([]);
                        setSelectedQuantity(1);
                      }}
                      renderInput={(params) => (
                        <TextField 
                          {...params} 
                          label={`Select Product ${currentTransfer?.fromBranch ? `(Available at ${getCenterName(currentTransfer.fromBranch)})` : ''}`}
                          size="small" 
                          fullWidth 
                          placeholder="Search product by name/company"
                          helperText={currentTransfer?.fromBranch ? `${availableProducts.length} products available` : 'Please select source center first'}
                        />
                      )}
                      disabled={!currentTransfer?.fromBranch}
                      renderOption={(props, option) => (
                        <li {...props} key={option.id}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <Typography variant="body2" fontWeight="medium">
                              {option.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.company && `${option.company} • `}{option.type} • {option.availableCount} available
                            </Typography>
                          </Box>
                        </li>
                      )}
                    />
                  </Grid>

                  {/* Serial selection or Quantity based on product type */}
                  {selectedProduct?.hasSerialNumber ? (
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Select serials {currentTransfer?.fromBranch ? `(from ${getCenterName(currentTransfer.fromBranch)})` : ''} • {serialOptions.length} available
                      </Typography>
                      <Autocomplete
                        multiple
                        options={serialOptions}
                        getOptionLabel={(opt) => opt.label}
                        filterSelectedOptions
                        value={selectedSerials}
                        onChange={(_, value) => setSelectedSerials(value)}
                        renderInput={(params) => (
                          <TextField {...params} size="small" fullWidth placeholder="Search or select serial numbers" />
                        )}
                        renderOption={(props, option) => (
                          <li {...props} key={option.value}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <Typography variant="body2">{option.label}</Typography>
                              <Chip label={option.location} size="small" variant="outlined" icon={<LocationIcon sx={{ fontSize: 16 }} />} />
                            </Box>
                          </li>
                        )}
                        renderTags={(value, getTagProps) => value.map((option, index) => (
                          <Chip
                            {...getTagProps({ index })}
                            key={option.value}
                            label={option.label}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                      />
                    </Grid>
                  ) : (
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={`Quantity ${currentTransfer?.fromBranch ? `(Available: ${availableQtyForSelected})` : ''}`}
                        size="small"
                        type="number"
                        fullWidth
                        value={selectedQuantity}
                        onChange={(e) => {
                          const v = Math.max(1, parseInt(e.target.value) || 1);
                          setSelectedQuantity(v);
                        }}
                        disabled={!selectedProduct}
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                  )}

                  <Grid item xs={12} md={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      disabled={!selectedProduct || !currentTransfer?.fromBranch || !currentTransfer?.toBranch || (selectedProduct.hasSerialNumber ? selectedSerials.length === 0 : selectedQuantity > availableQtyForSelected)}
                      onClick={() => {
                        if (!currentTransfer || !selectedProduct) return;
                        const newLine: StockTransferProduct = {
                          productId: selectedProduct.id,
                          name: selectedProduct.name,
                          serialNumbers: selectedProduct.hasSerialNumber ? selectedSerials.map(s => s.value) : [],
                          quantity: selectedProduct.hasSerialNumber ? selectedSerials.length : selectedQuantity,
                        };
                        setCurrentTransfer({
                          ...currentTransfer,
                          products: [...(currentTransfer.products || []), newLine],
                        });
                        setSelectedProduct(null);
                        setSelectedSerials([]);
                        setSelectedQuantity(1);
                      }}
                    >
                      Add
                    </Button>
                  </Grid>
                </Grid>
              </Paper>

              {/* Added products */}
              {currentTransfer?.products && currentTransfer.products.length > 0 ? (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2, boxShadow: '0 6px 16px rgba(0,0,0,0.05)' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Serials / Qty</TableCell>
                        <TableCell>From → To</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {currentTransfer.products.map((p, idx) => {
                        const meta = products.find(pr => pr.id === p.productId);
                        return (
                          <TableRow key={`${p.productId}-${idx}`}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell>{meta?.type || '-'}</TableCell>
                            <TableCell>
                              {p.serialNumbers && p.serialNumbers.length > 0 ? (
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                  {p.serialNumbers.slice(0, 3).map(sn => (
                                    <Chip key={sn} label={sn} size="small" />
                                  ))}
                                  {p.serialNumbers.length > 3 && (
                                    <Chip label={`+${p.serialNumbers.length - 3} more`} size="small" />
                                  )}
                                </Stack>
                              ) : (
                                <Chip label={`${p.quantity} pcs`} size="small" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip label={`${currentTransfer?.fromBranch || '-'} → ${currentTransfer?.toBranch || '-'}`} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell align="right">
                              <IconButton size="small" color="error" onClick={() => {
                                if (!currentTransfer) return;
                                const next = [...currentTransfer.products];
                                next.splice(idx, 1);
                                setCurrentTransfer({ ...currentTransfer, products: next });
                              }}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No products added yet
                </Typography>
              )}

              <TextField
                label="Notes (Optional)"
                variant="outlined"
                size="small"
                multiline
                rows={3}
                fullWidth
                value={currentTransfer?.notes || ''}
                onChange={(e) => {
                  if (currentTransfer) {
                    setCurrentTransfer({
                      ...currentTransfer,
                      notes: e.target.value,
                    });
                  }
                }}
                placeholder="Add any additional information about this transfer..."
              />
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSaveTransfer}
          >
            Save
          </Button>
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

export default StockTransferPage; 