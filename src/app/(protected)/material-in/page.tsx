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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  BusinessCenter as PartyIcon,
  Receipt as ReceiptIcon,
  CompareArrows as ConvertIcon,
  Preview as PreviewIcon,
  AssignmentReturn as AssignmentReturnIcon,
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
  limit,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getHeadOfficeId } from '@/utils/centerUtils';
import { useAuth } from '@/context/AuthContext';
import MaterialInForm from '@/components/material-in/MaterialInForm';
import MaterialInPreviewDialog from '@/components/material-in/MaterialInPreviewDialog';
import ConvertToPurchaseDialog from '@/components/material-in/ConvertToPurchaseDialog';

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
  gstType: string;
  category: 'supplier' | 'customer' | 'both';
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  contactPerson?: string;
}

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
  condition?: string;
}

interface MaterialInward {
  id?: string;
  challanNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  company: string;
  location?: string;
  products: MaterialProduct[];
  totalAmount: number;
  receivedDate: Timestamp;
  status: 'pending' | 'received' | 'rejected';
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  convertedToPurchase?: boolean;
  purchaseId?: string;
  purchaseInvoiceNo?: string;
}

export default function MaterialInPage() {
  const { user, userProfile, isAllowedModule } = useAuth();
  const [materials, setMaterials] = useState<MaterialInward[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<MaterialInward[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState<MaterialInward | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Filter for converted challans
  const [showConvertedChallans, setShowConvertedChallans] = useState<'all' | 'unconverted' | 'converted'>('all');
  
  // Preview dialog state
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<MaterialInward | null>(null);
  
  // Convert to purchase dialog state
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertMaterial, setConvertMaterial] = useState<MaterialInward | null>(null);

  // Trial return tracking states
  const [completedTrials, setCompletedTrials] = useState<any[]>([]);
  const [loadingTrialReturns, setLoadingTrialReturns] = useState(false);

  // Sales return tracking states
  const [salesReturns, setSalesReturns] = useState<any[]>([]);
  const [loadingSalesReturns, setLoadingSalesReturns] = useState(false);

  // Fetch data when component mounts
  useEffect(() => {
    if (!user) return;
    
    if (isAllowedModule('materials')) {
      fetchMaterials();
      fetchProducts();
      fetchParties();
      fetchCompletedTrials();
      fetchSalesReturns();
    } else {
      setLoading(false);
    }
  }, [user, isAllowedModule]);

  // Auto-open preview when navigated with #id=<docId>
  useEffect(() => {
    if (!materials.length) return;
    try {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const match = hash.match(/id=([^&]+)/);
      if (match && match[1]) {
        const target = materials.find(m => m.id === match[1]);
        if (target) {
          handlePreviewMaterial(target);
        }
      }
    } catch {}
  }, [materials]);

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
        material.supplier.name.toLowerCase().includes(searchLower) ||
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
    
    // Apply converted filter
    if (showConvertedChallans === 'unconverted') {
      filtered = filtered.filter(material => !material.convertedToPurchase);
    } else if (showConvertedChallans === 'converted') {
      filtered = filtered.filter(material => material.convertedToPurchase);
    }
    
    setFilteredMaterials(filtered);
  }, [materials, searchTerm, dateFilter, showConvertedChallans]);

  // Fetch materials from Firestore
  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const materialsCollection = collection(db, 'materialInward');
      const materialsQuery = query(materialsCollection, orderBy('receivedDate', 'desc'));
      const snapshot = await getDocs(materialsQuery);
      
      const materialsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MaterialInward[];
      
      setMaterials(materialsData);
      setFilteredMaterials(materialsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching materials:', error);
      setErrorMsg('Failed to load material data');
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
      
      // Add special "Trial Machine Return" supplier option
      const trialReturnSupplier: Party = {
        id: 'trial-return',
        name: 'Trial Machine Return',
        category: 'supplier' as 'supplier' | 'customer' | 'both',
        gstType: 'GST Exempted',
        phone: '',
        email: '',
        address: 'Internal - Trial Returns',
        contactPerson: 'Hope Enterprises'
      };

      // Add special "Sales Return" supplier option
      const salesReturnSupplier: Party = {
        id: 'sales-return',
        name: 'Sales Return',
        category: 'supplier' as 'supplier' | 'customer' | 'both',
        gstType: 'GST Exempted',
        phone: '',
        email: '',
        address: 'Internal - Sales Returns',
        contactPerson: 'Hope Enterprises'
      };
      
      // Add special suppliers to the beginning of the list
      setParties([trialReturnSupplier, salesReturnSupplier, ...partiesData]);
    } catch (error) {
      console.error('Error fetching parties:', error);
      setErrorMsg('Failed to load supplier data');
    }
  };

  // Fetch completed trials that need to be returned
  const fetchCompletedTrials = async () => {
    try {
      setLoadingTrialReturns(true);
      const enquiriesCollection = collection(db, 'enquiries');
      const snapshot = await getDocs(enquiriesCollection);
      
      const completedTrials: any[] = [];
      
      snapshot.docs.forEach(doc => {
        const enquiry = { id: doc.id, ...doc.data() } as any;
        
        if (enquiry.visits && enquiry.visits.length > 0) {
          enquiry.visits.forEach((visit: any, visitIndex: number) => {
            // Check if this visit has a completed home trial that needs return
            if (visit.hearingAidTrial && 
                visit.trialHearingAidType === 'home' && 
                visit.trialSerialNumber &&
                visit.trialEndDate) {
              
              const trialEndDate = new Date(visit.trialEndDate);
              const today = new Date();
              
              // Check if trial has ended (past end date)
              const isCompleted = trialEndDate < today;
              
              if (isCompleted) {
                completedTrials.push({
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
      
      setCompletedTrials(completedTrials);
      setLoadingTrialReturns(false);
    } catch (error) {
      console.error('Error fetching completed trials:', error);
      setLoadingTrialReturns(false);
    }
  };

  // Fetch sales returns from enquiries collection
  const fetchSalesReturns = async () => {
    if (!user) return;
    
    setLoadingSalesReturns(true);
    
    try {
      const enquiriesRef = collection(db, 'enquiries');
      const snapshot = await getDocs(enquiriesRef);
      
      const salesReturnsData: any[] = [];
      
      snapshot.docs.forEach(enquiryDoc => {
        const enquiryData = enquiryDoc.data();
        const visits = enquiryData.visits || [];
        
        visits.forEach((visit: any, visitIndex: number) => {
          if (visit.salesReturn && visit.returnSerialNumber) {
            salesReturnsData.push({
              enquiryId: enquiryDoc.id,
              enquiryName: enquiryData.name || 'Unknown',
              enquiryPhone: enquiryData.phone || 'Unknown',
              visitIndex,
              visitDate: visit.visitDate || 'Unknown',
              serialNumber: visit.returnSerialNumber,
              condition: visit.returnCondition || 'good',
              reason: visit.returnReason || '',
              penaltyAmount: visit.returnPenaltyAmount || 0,
              refundAmount: visit.returnRefundAmount || 0,
              notes: visit.returnNotes || '',
              originalSaleDate: visit.returnOriginalSaleDate || '',
              originalSaleVisitId: visit.returnOriginalSaleVisitId || ''
            });
          }
        });
      });
      
      setSalesReturns(salesReturnsData);
      setLoadingSalesReturns(false);
    } catch (error) {
      console.error('Error fetching sales returns:', error);
      setLoadingSalesReturns(false);
    }
  };

  // Handle creating material in entry for sales return
  const handleSalesReturn = async (salesReturn: any) => {
    // Generate new challan number (format: SR-YYYYMMDD-XXX for Sales Return)
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
    const challanNumber = `SR-${dateString}-${randomNum}`;
    
    // Find a generic hearing aid product for now
    // In a real scenario, you'd match the exact product based on serial number
    let product = products.find(p => 
      p.type?.toLowerCase().includes('hearing aid') || 
      p.name.toLowerCase().includes('hearing aid')
    );
    
    // If still no product found, show error
    if (!product) {
      setErrorMsg(`No hearing aid product found. Please create a hearing aid product in the Products module first.`);
      return;
    }
    
    const materialIn: MaterialInward = {
      challanNumber,
      supplier: { 
        id: 'sales-return', 
        name: 'Sales Return'
      },
      company: 'Hope Enterprises',
      location: await getHeadOfficeId(), // Returns go to Head Office
      products: [{
        productId: product.id,
        name: product.name,
        type: product.type || 'Hearing Aid',
        serialNumbers: [salesReturn.serialNumber],
        quantity: 1,
        dealerPrice: 0, // Return at 0 cost
        mrp: product.mrp || 0,
        discountPercent: 0,
        discountAmount: 0,
        finalPrice: 0, // Return at 0 cost
        gstApplicable: product.gstApplicable || false,
        quantityType: product.quantityType || 'piece',
        condition: salesReturn.condition,
        remarks: `Sales return from ${salesReturn.enquiryName} (${salesReturn.enquiryPhone}) - S/N: ${salesReturn.serialNumber} - Reason: ${salesReturn.reason}`
      }],
      totalAmount: 0, // Return at 0 cost
      status: 'received' as 'pending' | 'received' | 'rejected',
      receivedDate: Timestamp.now(),
      notes: `Sales Return - ${salesReturn.enquiryName} (${salesReturn.enquiryPhone}) - Return Date: ${salesReturn.visitDate} - Penalty: ₹${salesReturn.penaltyAmount} - Refund: ₹${salesReturn.refundAmount}`
    };
    
    setCurrentMaterial(materialIn);
    setOpenDialog(true);
  };

  const handleTrialReturn = async (trial: any) => {
    // Generate new challan number (format: TR-YYYYMMDD-XXX for Trial Return)
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
    const challanNumber = `TR-${dateString}-${randomNum}`;
    
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
    
    const materialIn: MaterialInward = {
      challanNumber,
      supplier: { 
        id: 'trial-return', 
        name: 'Trial Machine Return'
      },
      company: 'Hope Enterprises',
      location: await getHeadOfficeId(), // Trial returns go to Head Office
      products: [{
        productId: product.id, // Use the actual product ID
        name: product.name, // Use the actual product name
        type: product.type || 'Hearing Aid',
        serialNumbers: [trial.serialNumber],
        quantity: 1,
        dealerPrice: 0, // Return at 0 cost
        mrp: product.mrp || 0,
        discountPercent: 0,
        discountAmount: 0,
        finalPrice: 0, // Return at 0 cost
        gstApplicable: product.gstApplicable || false,
        quantityType: product.quantityType || 'piece',
        remarks: `Trial return from ${trial.enquiryName} (${trial.enquiryPhone}) - S/N: ${trial.serialNumber}`
      }],
      totalAmount: 0, // Return at 0 cost
      status: 'received' as 'pending' | 'received' | 'rejected',
      receivedDate: Timestamp.now(),
      notes: `Trial Return - ${trial.enquiryName} (${trial.enquiryPhone}) - Trial ended on ${trial.endDate}`
    };
    
    setCurrentMaterial(materialIn);
    setOpenDialog(true);
  };

  // Handle adding a new material
  const handleAddMaterial = async () => {
    // Generate new challan number (format: DC-YYYYMMDD-XXX)
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 900) + 100; // 3-digit random number
    const challanNumber = `DC-${dateString}-${randomNum}`;
    
    // Get head office as default location
    const headOfficeId = await getHeadOfficeId();
    
    const emptyMaterial: MaterialInward = {
      challanNumber,
      supplier: { id: '', name: '' },
      company: 'Hope Enterprises',
      location: headOfficeId, // Default to configured head office
      products: [],
      totalAmount: 0,
      receivedDate: Timestamp.now(),
      status: 'pending',
    };
    
    setCurrentMaterial(emptyMaterial);
    setOpenDialog(true);
  };

  // Handle editing a material
  const handleEditMaterial = (material: MaterialInward) => {
    setCurrentMaterial(material);
    setOpenDialog(true);
  };

  // Handle deleting a material
  const handleDeleteMaterial = async (id: string) => {
    // Get the material to check if it's converted
    const materialToDelete = materials.find(m => m.id === id);
    
    if (!materialToDelete) {
      setErrorMsg('Material not found');
      return;
    }
    
    // Prevent deletion of converted challans
    if (materialToDelete.convertedToPurchase) {
      setErrorMsg('Cannot delete a converted challan. It is marked with red color for reference.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this material?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'materialInward', id));
      setMaterials(prevMaterials => prevMaterials.filter(material => material.id !== id));
      setSuccessMsg('Material deleted successfully');
    } catch (error) {
      console.error('Error deleting material:', error);
      setErrorMsg('Failed to delete material');
    }
  };

  // Handle closing the dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentMaterial(null);
  };

  // Handle saving a material
  const handleSaveMaterialAsync = async (materialData: MaterialInward) => {
    try {
      if (currentMaterial?.id) {
        // Update existing material
        const materialRef = doc(db, 'materialInward', currentMaterial.id);
        await updateDoc(materialRef, {
          ...materialData,
          updatedAt: serverTimestamp()
        });
        
        // Update local state
        setMaterials(prevMaterials => 
          prevMaterials.map(m => 
            m.id === currentMaterial.id ? { ...materialData, id: currentMaterial.id } : m
          )
        );
        
        setSuccessMsg('Material updated successfully');
      } else {
        // Add new material
        const newMaterialData = {
          ...materialData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'materialInward'), newMaterialData);
        
        // Update local state with timestamps converted to current time for UI
        const newMaterialWithTimestamp = {
          ...materialData,
          id: docRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        setMaterials(prevMaterials => [
          newMaterialWithTimestamp,
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

  // Synchronous wrapper for handleSaveMaterialAsync
  const handleSaveMaterial = (material: any) => {
    handleSaveMaterialAsync(material as MaterialInward);
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

  // Calculate total products in a material
  const calculateTotalProducts = (material: MaterialInward) => {
    return material.products.reduce((sum, product) => sum + product.quantity, 0);
  };

  // Preview material
  const handlePreviewMaterial = (material: MaterialInward) => {
    setPreviewMaterial(material);
    setPreviewDialogOpen(true);
  };

  // Close preview dialog
  const handleClosePreview = () => {
    setPreviewDialogOpen(false);
    setPreviewMaterial(null);
  };

  // Open convert to purchase dialog
  const handleOpenConvertDialog = (material: MaterialInward) => {
    if (material.convertedToPurchase) {
      setSuccessMsg(`This challan has already been converted to Purchase Invoice ${material.purchaseInvoiceNo || ''}`);
      return;
    }
    
    setConvertMaterial(material);
    setConvertDialogOpen(true);
  };

  // Close convert dialog
  const handleCloseConvertDialog = () => {
    setConvertDialogOpen(false);
    setConvertMaterial(null);
  };

  // Convert material to purchase
  const handleConvertToPurchase = async (invoiceNo: string) => {
    if (!convertMaterial) return;
    
    try {
      // Create a new purchase object from the material
      const purchaseData = {
        invoiceNo: invoiceNo,
        party: convertMaterial.supplier,
        company: convertMaterial.company,
        products: convertMaterial.products.map(product => ({
          productId: product.productId,
          name: product.name,
          type: product.type || '',
          serialNumbers: product.serialNumbers || [],
          quantity: product.quantity,
          dealerPrice: product.dealerPrice || 0,
          mrp: product.mrp || 0,
          discountPercent: product.discountPercent || 0,
          discountAmount: product.discountAmount || 0,
          finalPrice: product.finalPrice || product.dealerPrice || 0,
          gstApplicable: product.gstApplicable || false,
          quantityType: product.quantityType || 'piece',
        })),
        gstType: parties.find(p => p.id === convertMaterial.supplier.id)?.gstType || 'LGST',
        gstPercentage: 18, // Default value
        totalAmount: convertMaterial.totalAmount || convertMaterial.products.reduce((sum, product) => 
          sum + ((product.finalPrice || product.dealerPrice || 0) * product.quantity), 0),
        reference: `Converted from Delivery Challan ${convertMaterial.challanNumber}`,
        purchaseDate: convertMaterial.receivedDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      // Add the purchase to Firestore
      const docRef = await addDoc(collection(db, 'purchases'), purchaseData);
      
      // Update the material to mark it as converted
      await updateDoc(doc(db, 'materialInward', convertMaterial.id!), {
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  // Allow staff users or users with materials module access
  if (userProfile?.role !== 'staff' && !isAllowedModule('materials')) {
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
    <Box p={3}>
      <Typography variant="h5" fontWeight="bold" mb={1}>
        Material In
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Track and manage material inward from suppliers
      </Typography>

      {/* Trial Return Actions */}
      {completedTrials.length > 0 && (
        <Paper elevation={0} variant="outlined" sx={{ mb: 4, borderRadius: 2, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <ReceiptIcon color="error" />
            <Typography variant="h6" color="error.main">
              Completed Trials - Return Actions
            </Typography>
            <Chip 
              label={`${completedTrials.length} Pending Returns`} 
              color="error" 
              size="small" 
            />
            <Button
              size="small"
              variant="outlined"
              onClick={fetchCompletedTrials}
              disabled={loadingTrialReturns}
            >
              Refresh
            </Button>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create material in entries for hearing aids that have completed their trial period
          </Typography>
          
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
            {completedTrials.map((trial, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 2, bgcolor: 'error.50' }}>
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
                    label="Return Due" 
                    color="error" 
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
                    <strong>Trial Ended:</strong> {trial.endDate}
                  </Typography>
                </Box>
                
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  fullWidth
                  startIcon={<AddIcon />}
                  onClick={() => handleTrialReturn(trial)}
                >
                  Process Return
                </Button>
              </Paper>
            ))}
          </Box>
        </Paper>
      )}

      {/* Sales Return Actions */}
      {salesReturns.length > 0 && (
        <Paper elevation={0} variant="outlined" sx={{ mb: 4, borderRadius: 2, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <AssignmentReturnIcon color="warning" />
            <Typography variant="h6" color="warning.main">
              Sales Returns - Material In Actions
            </Typography>
            <Chip 
              label={`${salesReturns.length} Pending Returns`} 
              color="warning" 
              size="small" 
            />
            <Button
              size="small"
              variant="outlined"
              onClick={fetchSalesReturns}
              disabled={loadingSalesReturns}
            >
              Refresh
            </Button>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create material in entries for hearing aids that have been returned by customers
          </Typography>
          
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
            {salesReturns.map((salesReturn, index) => (
              <Paper key={index} variant="outlined" sx={{ p: 2, bgcolor: 'warning.50' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {salesReturn.enquiryName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {salesReturn.enquiryPhone}
                    </Typography>
                  </Box>
                  <Chip 
                    label={salesReturn.condition.charAt(0).toUpperCase() + salesReturn.condition.slice(1)} 
                    color={salesReturn.condition === 'excellent' ? 'success' : 
                           salesReturn.condition === 'good' ? 'primary' : 
                           salesReturn.condition === 'fair' ? 'warning' : 'error'} 
                    size="small" 
                  />
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Serial Number:</strong> {salesReturn.serialNumber}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Return Date:</strong> {salesReturn.visitDate}
                  </Typography>
                  {salesReturn.reason && (
                    <Typography variant="body2">
                      <strong>Reason:</strong> {salesReturn.reason}
                    </Typography>
                  )}
                  {salesReturn.penaltyAmount > 0 && (
                    <Typography variant="body2" color="error.main">
                      <strong>Penalty:</strong> ₹{salesReturn.penaltyAmount}
                    </Typography>
                  )}
                  {salesReturn.refundAmount > 0 && (
                    <Typography variant="body2" color="success.main">
                      <strong>Refund:</strong> ₹{salesReturn.refundAmount}
                    </Typography>
                  )}
                </Box>
                
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  color="warning"
                  onClick={() => handleSalesReturn(salesReturn)}
                  startIcon={<AddIcon />}
                >
                  Process Return
                </Button>
              </Paper>
            ))}
          </Box>
        </Paper>
      )}
      
      {/* Filters and Actions */}
      <Box mb={4} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            placeholder="Search challan or supplier..."
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
          
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="converted-filter-label">Conversion Status</InputLabel>
            <Select
              labelId="converted-filter-label"
              value={showConvertedChallans}
              label="Conversion Status"
              onChange={(e) => setShowConvertedChallans(e.target.value as 'all' | 'unconverted' | 'converted')}
            >
              <MenuItem value="all">Show All Challans</MenuItem>
              <MenuItem value="unconverted">Unconverted Only</MenuItem>
              <MenuItem value="converted">Converted Only</MenuItem>
            </Select>
          </FormControl>
          
          {dateFilter && (
            <Button 
              variant="outlined" 
              size="small"
              onClick={() => setDateFilter(null)}
              sx={{ borderRadius: 1.5 }}
            >
              Clear Date
            </Button>
          )}
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddMaterial}
          sx={{ borderRadius: 1.5 }}
        >
          New Material In
        </Button>
      </Box>
      
      {/* Materials Table */}
      <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Challan #</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Products</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMaterials.length > 0 ? (
                filteredMaterials
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((material) => (
                    <TableRow 
                      key={material.id} 
                      hover
                      sx={{ 
                        backgroundColor: material.convertedToPurchase ? 'rgba(211, 47, 47, 0.1)' : 'inherit',
                        '&:hover': {
                          backgroundColor: material.convertedToPurchase ? 'rgba(211, 47, 47, 0.2)' : 'rgba(0, 0, 0, 0.04)'
                        }
                      }}
                    >
                      <TableCell>{formatDate(material.receivedDate)}</TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <ReceiptIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            {material.challanNumber}
                            {material.convertedToPurchase && (
                              <Typography variant="caption" color="error">
                                Converted to {material.purchaseInvoiceNo}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <PartyIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          {material.supplier.name}
                        </Box>
                      </TableCell>
                      <TableCell>{material.company}</TableCell>
                      <TableCell>
                        <Chip 
                          label={`${calculateTotalProducts(material)} items`} 
                          size="small" 
                          color={material.convertedToPurchase ? "error" : "info"} 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'medium' }}>
                        {formatCurrency(material.totalAmount || 0)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          size="small" 
                          color="info"
                          onClick={() => handlePreviewMaterial(material)}
                        >
                          <PreviewIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleEditMaterial(material)}
                          disabled={material.convertedToPurchase}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {userProfile?.role === 'admin' && (
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => material.id && handleDeleteMaterial(material.id)}
                            disabled={material.convertedToPurchase}
                            sx={{ display: material.convertedToPurchase ? 'none' : 'inline-flex' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton 
                          size="small" 
                          color="success" 
                          onClick={() => handleOpenConvertDialog(material)}
                          disabled={material.convertedToPurchase}
                          sx={{ display: material.convertedToPurchase ? 'none' : 'inline-flex' }}
                        >
                          <ConvertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      'No material records found'
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
          count={filteredMaterials.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ px: 2 }}
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
          <MaterialInForm
            initialData={currentMaterial || undefined}
            products={products}
            parties={parties}
            onSave={handleSaveMaterial}
            onCancel={handleCloseDialog}
          />
        </DialogContent>
      </Dialog>
      
      {/* Material Preview Dialog */}
      {previewMaterial && (
        <MaterialInPreviewDialog
          open={previewDialogOpen}
          material={previewMaterial}
          onClose={handleClosePreview}
        />
      )}
      
      {/* Convert to Purchase Dialog */}
      {convertMaterial && (
        <ConvertToPurchaseDialog
          open={convertDialogOpen}
          material={convertMaterial}
          onClose={handleCloseConvertDialog}
          onConvert={handleConvertToPurchase}
          db={db}
        />
      )}
      
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
    </Box>
  );
} 