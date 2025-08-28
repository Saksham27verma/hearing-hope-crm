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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Grid,
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
import { getHeadOfficeId } from '@/utils/centerUtils';
import MaterialOutForm from '@/components/material-out/MaterialOutForm';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

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

interface MaterialOut {
  id?: string;
  challanNumber: string;
  recipient: {
    id: string;
    name: string;
  };
  company: string;
  location?: string;
  products: MaterialProduct[];
  totalAmount: number;
  reference?: string;
  challanFile?: string;
  dispatchDate: Timestamp;
  reason?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export default function MaterialOutPage() {
  const { user, isAllowedModule } = useAuth();
  const [materials, setMaterials] = useState<MaterialOut[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<MaterialOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<MaterialOut | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [centers, setCenters] = useState<{id: string; name: string}[]>([]);
  const [recipients, setRecipients] = useState<{id: string; name: string}[]>([]);
  const [availableInventory, setAvailableInventory] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Home trial tracking states
  const [activeHomeTrials, setActiveHomeTrials] = useState<any[]>([]);
  const [loadingTrials, setLoadingTrials] = useState(false);
  
  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<MaterialOut | null>(null);

  // Fetch data when component mounts
  useEffect(() => {
    if (!user) return;
    
    if (isAllowedModule('deliveries')) {
      fetchMaterials();
      fetchProducts();
      fetchParties();
      fetchCenters();
      loadAvailableInventory();
      fetchActiveHomeTrials();
    } else {
      setLoading(false);
    }
  }, [user, isAllowedModule]);

  // Filter materials when search term, status filter, or date filter changes
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
        material.recipient.name.toLowerCase().includes(searchLower) ||
        material.company.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(material => material.status === statusFilter);
    }
    
    // Apply date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(material => {
        const materialDate = new Date(material.dispatchDate.seconds * 1000);
        return (
          materialDate.getDate() === filterDate.getDate() &&
          materialDate.getMonth() === filterDate.getMonth() &&
          materialDate.getFullYear() === filterDate.getFullYear()
        );
      });
    }
    
    setFilteredMaterials(filtered);
  }, [materials, searchTerm, statusFilter, dateFilter]);

  // Fetch materials from Firestore
  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const materialsCollection = collection(db, 'materialsOut');
      const materialsQuery = query(materialsCollection, orderBy('dispatchDate', 'desc'));
      const snapshot = await getDocs(materialsQuery);
      
      const materialsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MaterialOut[];
      
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

  // Build available inventory (only items in stock)
  const loadAvailableInventory = async () => {
    try {
      const [productsSnap, materialInSnap, purchasesSnap, materialsOutSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'materialInward')),
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'materialsOut')),
      ]);

      const prodMap: Record<string, any> = {};
      productsSnap.docs.forEach(d => { prodMap[d.id] = { id: d.id, ...(d.data() as any) }; });

      // Build availability from inbound docs
      const serialsByProduct: Record<string, Set<string>> = {};
      const qtyByProduct: Record<string, number> = {};

      const addInbound = (docs: any[]) => {
        docs.forEach(docSnap => {
          const data: any = docSnap.data();
          (data.products || []).forEach((p: any) => {
            const productId = p.productId || p.id;
            if (!productId) return;
            const serialArray: string[] = Array.isArray(p.serialNumbers) ? p.serialNumbers : (p.serialNumber ? [p.serialNumber] : []);
            if (serialArray.length > 0) {
              if (!serialsByProduct[productId]) serialsByProduct[productId] = new Set<string>();
              serialArray.forEach(sn => sn && serialsByProduct[productId].add(String(sn)));
            } else {
              const q = Number(p.quantity ?? p.qty ?? 0);
              if (!qtyByProduct[productId]) qtyByProduct[productId] = 0;
              qtyByProduct[productId] += isNaN(q) ? 0 : q;
            }
          });
        });
      };

      addInbound(materialInSnap.docs);
      addInbound(purchasesSnap.docs);

      // Subtract outflows from materialsOut
      materialsOutSnap.docs.forEach(d => {
        const data: any = d.data();
        (data.products || []).forEach((p: any) => {
          const productId = p.productId || p.id;
          if (!productId) return;
          const serialArray: string[] = Array.isArray(p.serialNumbers) ? p.serialNumbers : [];
          if (serialArray.length > 0) {
            if (!serialsByProduct[productId]) serialsByProduct[productId] = new Set<string>();
            serialArray.forEach(sn => {
              if (sn && serialsByProduct[productId].has(String(sn))) serialsByProduct[productId].delete(String(sn));
            });
          } else {
            const q = Number(p.quantity ?? 0);
            if (!qtyByProduct[productId]) qtyByProduct[productId] = 0;
            qtyByProduct[productId] = Math.max(0, qtyByProduct[productId] - (isNaN(q) ? 0 : q));
          }
        });
      });

      // Flatten to items array
      const items: any[] = [];
      Object.entries(serialsByProduct).forEach(([productId, set]) => {
        const prod = prodMap[productId] || {};
        Array.from(set).forEach(sn => {
          items.push({
            productId,
            name: prod.name || 'Product',
            type: prod.type || '',
            serialNumber: sn,
            isSerialTracked: true,
          });
        });
      });
      Object.entries(qtyByProduct).forEach(([productId, qty]) => {
        if (qty > 0) {
          const prod = prodMap[productId] || {};
          items.push({
            productId,
            name: prod.name || 'Product',
            type: prod.type || '',
            isSerialTracked: false,
            quantity: qty,
          });
        }
      });

      setAvailableInventory(items);
    } catch (e) {
      console.error('Failed loading available inventory', e);
    }
  };

  // Fetch parties from Firestore
  const fetchParties = async () => {
    try {
      const partiesCollection = collection(db, 'parties');
      const snapshot = await getDocs(partiesCollection);
      
      const partiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Party[];
      
      setParties(partiesData);
      // Update combined recipients
      setRecipients(prev => {
        const partyRecipients = partiesData.map(p => ({ id: p.id, name: p.name }));
        return [...partyRecipients, ...centers];
      });
    } catch (error) {
      console.error('Error fetching parties:', error);
      setErrorMsg('Failed to load customer data');
    }
  };

  // Fetch centers as potential recipients (branches)
  const fetchCenters = async () => {
    try {
      const centersSnap = await getDocs(collection(db, 'centers'));
      const centersData = centersSnap.docs.map(d => ({ id: d.id, name: (d.data() as any)?.name || 'Center' }));
      setCenters(centersData);
      setRecipients(prev => {
        // Merge with any existing party recipients
        const partyRecipients = parties.map(p => ({ id: p.id, name: p.name }));
        return [...partyRecipients, ...centersData];
      });
    } catch (e) {
      console.error('Error fetching centers:', e);
    }
  };

  // Fetch active home trials from enquiries
  const fetchActiveHomeTrials = async () => {
    try {
      setLoadingTrials(true);
      const enquiriesCollection = collection(db, 'enquiries');
      const snapshot = await getDocs(enquiriesCollection);
      
      const homeTrials: any[] = [];
      
      snapshot.docs.forEach(doc => {
        const enquiry = { id: doc.id, ...doc.data() };
        
        if (enquiry.visits && enquiry.visits.length > 0) {
          enquiry.visits.forEach((visit: any, visitIndex: number) => {
            // Check if this visit has an active home trial
            if (visit.hearingAidTrial && 
                visit.trialHearingAidType === 'home' && 
                visit.trialSerialNumber &&
                visit.trialStartDate) {
              
              const trialStartDate = new Date(visit.trialStartDate);
              const trialEndDate = visit.trialEndDate ? new Date(visit.trialEndDate) : null;
              const today = new Date();
              
              // Check if trial is currently active (started but not ended)
              const isActive = trialStartDate <= today && (!trialEndDate || trialEndDate >= today);
              
              if (isActive) {
                homeTrials.push({
                  enquiryId: enquiry.id,
                  enquiryName: enquiry.name || 'Unknown',
                  enquiryPhone: enquiry.phone || '',
                  visitIndex,
                  serialNumber: visit.trialSerialNumber,
                  brand: visit.trialHearingAidBrand || '',
                  model: visit.trialHearingAidModel || '',
                  startDate: visit.trialStartDate,
                  endDate: visit.trialEndDate,
                  duration: visit.trialDuration || 0
                });
              }
            }
          });
        }
      });
      
      setActiveHomeTrials(homeTrials);
      setLoadingTrials(false);
    } catch (error) {
      console.error('Error fetching active home trials:', error);
      setLoadingTrials(false);
    }
  };

  // Handle creating material out entry for home trial
  const handleTrialMaterialOut = async (trial: any) => {
    const challanNumber = generateChallanNumber();
    
    // Find the exact product that matches the trial device
    // First try to match by brand and model in product name
    let product = products.find(p => {
      const productNameLower = p.name.toLowerCase();
      const brandLower = trial.brand?.toLowerCase() || '';
      const modelLower = trial.model?.toLowerCase() || '';
      return brandLower && modelLower && 
             productNameLower.includes(brandLower) && 
             productNameLower.includes(modelLower);
    });
    
    // If not found by brand/model, try to find any hearing aid product
    if (!product) {
      product = products.find(p => 
        p.type?.toLowerCase().includes('hearing aid') || 
        p.name.toLowerCase().includes('hearing aid')
      );
    }
    
    // If still no product found, show error
    if (!product) {
      setErrorMsg(`No matching product found for ${trial.brand} ${trial.model}. Please create this product in the Products module first.`);
      return;
    }
    
    const materialOut: MaterialOut = {
      challanNumber,
      recipient: { 
        id: trial.enquiryId, 
        name: trial.enquiryName 
      },
      company: 'Hope Enterprises',
      location: await getHeadOfficeId(), // Default to configured head office
      products: [{
        productId: product.id, // Use the actual product ID
        name: product.name, // Use the actual product name
        type: product.type || 'Hearing Aid',
        serialNumbers: [trial.serialNumber],
        quantity: 1,
        dealerPrice: product.dealerPrice || 0,
        mrp: product.mrp || 0,
        discountPercent: 0,
        discountAmount: 0,
        finalPrice: 0, // Trial is at 0 cost
        gstApplicable: product.gstApplicable || false,
        quantityType: product.quantityType || 'piece'
      }],
      totalAmount: 0, // Trial is at 0 cost
      reason: `Home Trial - ${trial.enquiryName} (${trial.enquiryPhone}) - S/N: ${trial.serialNumber}`,
      dispatchDate: Timestamp.now(),
    };
    
    setCurrentMaterial(materialOut);
    setOpenDialog(true);
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
    // Format: DO-YYYYMMDD-XXX (Delivery Out)
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
    return `DO-${dateString}-${randomNum}`;
  };

  // Handle adding a new material
  const handleAddMaterial = async () => {
    const challanNumber = generateChallanNumber();
    
    // Get head office as default location
    const headOfficeId = await getHeadOfficeId();
    
    const emptyMaterial: MaterialOut = {
      challanNumber,
      recipient: { id: '', name: '' },
      company: 'Hope Enterprises',
      location: headOfficeId, // Default to configured head office
      products: [],
      totalAmount: 0,
      dispatchDate: Timestamp.now(),
    };
    
    setCurrentMaterial(emptyMaterial);
    setOpenDialog(true);
  };

  // Render Material Out form (styled like Material In)
  // replaced by full MaterialOutForm component

  // Handle editing a material
  const handleEditMaterial = (material: MaterialOut) => {
    if (material.status === 'dispatched') {
      setErrorMsg("Cannot edit material that has been already dispatched");
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
  const handleSaveMaterial = async (material: MaterialOut) => {
    try {
      const pruneUndefined = (value: any): any => {
        if (value === undefined) return undefined;
        if (value === null) return null;
        if (Array.isArray(value)) return value.map(pruneUndefined);
        if (value && typeof value === 'object') {
          const out: any = {};
          Object.entries(value).forEach(([k, v]) => {
            const pruned = pruneUndefined(v);
            if (pruned !== undefined) out[k] = pruned;
          });
          return out;
        }
        return value;
      };

      const sanitized = pruneUndefined(material) as MaterialOut;
      if (material.id) {
        // Update existing material
        await updateDoc(doc(db, 'materialsOut', material.id), {
          ...sanitized,
          updatedAt: serverTimestamp(),
        });
        
        // Update local state
        setMaterials(prevMaterials => 
          prevMaterials.map(m => m.id === material.id ? { ...sanitized, updatedAt: Timestamp.now() } as any : m)
        );
        
        setSuccessMsg('Material updated successfully');
      } else {
        // Create new material
        const materialData = {
          ...sanitized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(db, 'materialsOut'), materialData);
        
        // Update local state
        setMaterials(prevMaterials => [
          { ...sanitized, id: docRef.id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() } as any,
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
    
    if (materialToDelete?.status === 'dispatched') {
      setErrorMsg("Cannot delete material that has been dispatched");
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this material?')) {
      try {
        await deleteDoc(doc(db, 'materialsOut', materialId));
        
        // Update local state
        setMaterials(prevMaterials => prevMaterials.filter(material => material.id !== materialId));
        
        setSuccessMsg('Material deleted successfully');
      } catch (error) {
        console.error('Error deleting material:', error);
        setErrorMsg('Failed to delete material');
      }
    }
  };

  // Status removed: no status updates required

  // Preview material
  const handlePreviewMaterial = (material: MaterialOut) => {
    setPreviewMaterial(material);
    setPreviewOpen(true);
  };

  // Close preview dialog
  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewMaterial(null);
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
  const calculateTotalProducts = (material: MaterialOut) => {
    return material.products.reduce((sum, product) => sum + product.quantity, 0);
  };

  // Get status chip color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'primary';
      case 'dispatched':
        return 'success';
      case 'returned':
        return 'error';
      default:
        return 'default';
    }
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
            Material Out
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track and manage outgoing materials to customers or branches
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={handleAddMaterial}
          sx={{ borderRadius: 2 }}
        >
          New Material Out
        </Button>
      </Box>

      {/* Home Trial Actions */}
      {activeHomeTrials.length > 0 && (
        <Card sx={{ mb: 3, borderRadius: 2, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <ReceiptIcon color="primary" />
              <Typography variant="h6" color="primary">
                Active Home Trials - Quick Actions
              </Typography>
              <Chip 
                label={`${activeHomeTrials.length} Active`} 
                color="primary" 
                size="small" 
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchActiveHomeTrials}
                disabled={loadingTrials}
              >
                Refresh
              </Button>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create material out entries for hearing aids currently on home trial
            </Typography>
            
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
              {activeHomeTrials.map((trial, index) => (
                <Card key={index} variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {trial.enquiryName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {trial.enquiryPhone}
                      </Typography>
                    </Box>
                    <Chip 
                      label="Active" 
                      color="success" 
                      size="small" 
                    />
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Device:</strong> {trial.brand} {trial.model}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Serial:</strong> {trial.serialNumber}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Trial Period:</strong> {trial.startDate} to {trial.endDate || 'Ongoing'}
                    </Typography>
                  </Box>
                  
                  <Button
                    variant="contained"
                    size="small"
                    fullWidth
                    startIcon={<AddIcon />}
                    onClick={() => handleTrialMaterialOut(trial)}
                  >
                    Create Material Out
                  </Button>
                </Card>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
      
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
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="dispatched">Dispatched</MenuItem>
              <MenuItem value="returned">Returned</MenuItem>
            </Select>
          </FormControl>
          
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
                <TableCell>Recipient</TableCell>
                <TableCell>Company</TableCell>
                <TableCell align="right">Products</TableCell>
                <TableCell align="right">Amount</TableCell>
                
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMaterials
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((material) => (
                  <TableRow key={material.id} hover>
                    <TableCell>{formatDate(material.dispatchDate)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ReceiptIcon color="action" sx={{ mr: 1, fontSize: 16 }} />
                        {material.challanNumber}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <PartyIcon color="action" sx={{ mr: 1, fontSize: 16 }} />
                        {material.recipient.name}
                      </Box>
                    </TableCell>
                    <TableCell>{material.company}</TableCell>
                    <TableCell align="right">{calculateTotalProducts(material)}</TableCell>
                    <TableCell align="right">{formatCurrency(material.totalAmount)}</TableCell>
                    
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
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Delete">
                          <IconButton 
                            size="small" 
                            onClick={() => handleDeleteMaterial(material.id!)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
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
      
      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="md">
        <DialogTitle>{currentMaterial?.id ? 'Edit Material Out' : 'New Material Out'}</DialogTitle>
        <DialogContent>
          {currentMaterial && (
            <MaterialOutForm
              initialData={currentMaterial as any}
              products={products as any}
              parties={[]} 
              availableItems={availableInventory as any}
              onCancel={handleCloseDialog}
              onSave={(mat: any) => handleSaveMaterial(mat as any)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={handleClosePreview} fullWidth maxWidth="md">
        <DialogTitle>Material Out Preview</DialogTitle>
        <DialogContent>
          {previewMaterial ? (
            <Box>
              <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#f8f9fa' }}>
                <Typography variant="subtitle2" gutterBottom color="primary">Challan Details</Typography>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}><Typography variant="body2">Challan #: <strong>{previewMaterial.challanNumber}</strong></Typography></Grid>
                  <Grid item xs={12} sm={6}><Typography variant="body2">Dispatch: <strong>{new Date(previewMaterial.dispatchDate.seconds * 1000).toLocaleDateString('en-IN')}</strong></Typography></Grid>
                  <Grid item xs={12} sm={6}><Typography variant="body2">Recipient: <strong>{previewMaterial.recipient?.name}</strong></Typography></Grid>
                  <Grid item xs={12} sm={6}><Typography variant="body2">Company: <strong>{previewMaterial.company}</strong></Typography></Grid>
                  {previewMaterial.reason && (<Grid item xs={12}><Typography variant="body2">Reason: <strong>{previewMaterial.reason}</strong></Typography></Grid>)}
                </Grid>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: '#f8f9fa' }}>
                <Typography variant="subtitle2" gutterBottom color="primary">Products</Typography>
                <Divider sx={{ mb: 2 }} />
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Product</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Serials</TableCell>
                        <TableCell align="center">Qty</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Discount</TableCell>
                        <TableCell align="right">Final</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(previewMaterial.products || []).map((p, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>{p.type}</TableCell>
                          <TableCell>{p.serialNumbers && p.serialNumbers.length ? p.serialNumbers.join(', ') : '-'}</TableCell>
                          <TableCell align="center">{p.quantity}</TableCell>
                          <TableCell align="right">{formatCurrency(p.dealerPrice || 0)}</TableCell>
                          <TableCell align="right">{p.discountPercent ? `${p.discountPercent}%` : '-'}</TableCell>
                          <TableCell align="right">{formatCurrency(p.finalPrice || p.dealerPrice || 0)}</TableCell>
                          <TableCell align="right">{formatCurrency((p.finalPrice || p.dealerPrice || 0) * p.quantity)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={7} align="right"><Typography variant="subtitle1">Total Amount:</Typography></TableCell>
                        <TableCell align="right"><Typography variant="subtitle1">{formatCurrency(previewMaterial.totalAmount)}</Typography></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          ) : (
            <Typography variant="body2">No material selected.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Close</Button>
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