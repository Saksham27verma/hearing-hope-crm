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
  FormHelperText,
  Snackbar,
  Alert,
  TablePagination,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  Tab,
  Tabs,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Receipt as ReceiptIcon,
  Info as InfoIcon,
  Visibility as VisibilityIcon,
  Store as StoreIcon,
} from '@mui/icons-material';

import { useAuth } from '@/context/AuthContext';
import LoadingScreen from '@/components/common/LoadingScreen';
import { db } from '@/firebase/config';
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

// Define the Purchase interface to match Firestore structure
interface PurchaseParty {
  id: string;
  name: string;
}

interface Purchase {
  id: string;
  party: PurchaseParty;
  company: string;
  totalAmount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// GST Types
const GST_TYPES = [
  'CGST+SGST', // Central + State GST (within state)
  'IGST',      // Integrated GST (interstate)
  'Exempt',    // GST Exempted
];

// Party Types
const PARTY_TYPES = [
  'Supplier',
  'Customer',
  'Distribution Dealer',
  'Both',
];

interface PartyTransaction {
  hopeEnterprises: number;
  hdipl: number;
  total: number;
}

interface Party {
  id: string;
  name: string;
  type: string;          // Supplier, Customer, Dealer, Distributor, or Both
  gstType: string;
  gstNumber: string;
  address: string;
  contactPerson: string;
  phone: string;
  email: string;
  website?: string;
  notes?: string;
  // Dealer specific fields
  creditLimit?: number;
  paymentTerms?: string;
  dealerCategory?: 'A' | 'B' | 'C';
  dealerDiscount?: number;
  territoryArea?: string;
  registrationDate?: any;
  status?: 'active' | 'inactive';
  createdAt: any;
  updatedAt: any;
  // Business metrics (will be calculated, not stored)
  transactions?: PartyTransaction;
}

export default function PartiesPage() {
  const { user, userProfile, loading, isAllowedModule } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('Add New Party');
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [previewParty, setPreviewParty] = useState<Party | null>(null);
  const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState<Omit<Party, 'id' | 'createdAt' | 'updatedAt' | 'transactions'>>({
    name: '',
    type: 'Supplier',
    gstType: 'CGST+SGST',
    gstNumber: '',
    address: '',
    contactPerson: '',
    phone: '',
    email: '',
    website: '',
    notes: '',
    // Dealer specific fields
    creditLimit: 0,
    paymentTerms: '',
    dealerCategory: 'B',
    dealerDiscount: 0,
    territoryArea: '',
    registrationDate: null,
    status: 'active',
  });
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  useEffect(() => {
    const fetchParties = async () => {
      if (!user) return;
      
      try {
        const partiesCollection = collection(db, 'parties');
        const partiesSnapshot = await getDocs(partiesCollection);
        
        const partiesList = partiesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Party[];
        
        // After getting parties, calculate transaction amounts
        const partiesWithTransactions = await calculateTransactions(partiesList);
        setParties(partiesWithTransactions);
      } catch (error) {
        console.error('Error fetching parties:', error);
        setErrorMessage('Failed to load parties');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user && !loading) {
      if (isAllowedModule('parties')) {
        fetchParties();
      } else {
        setIsLoading(false);
        setErrorMessage('You do not have permission to access this module');
      }
    }
  }, [user, loading, isAllowedModule]);
  
  // Calculate transaction amounts for each party
  const calculateTransactions = async (parties: Party[]): Promise<Party[]> => {
    try {
      const purchasesCollection = collection(db, 'purchases');
      const purchasesSnapshot = await getDocs(purchasesCollection);
      const purchases = purchasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Purchase[];
      
      // Create a map to store transaction totals by party ID
      const transactionsByParty: Record<string, PartyTransaction> = {};
      
      // Initialize transaction objects for each party
      parties.forEach(party => {
        transactionsByParty[party.id] = {
          hopeEnterprises: 0,
          hdipl: 0,
          total: 0
        };
      });
      
      // Calculate purchase totals
      purchases.forEach(purchase => {
        if (purchase.party && purchase.party.id) {
          const partyId = purchase.party.id;
          const amount = purchase.totalAmount || 0;
          
          // Only process if we have this party in our list
          if (transactionsByParty[partyId]) {
            if (purchase.company === 'Hope Enterprises') {
              transactionsByParty[partyId].hopeEnterprises += amount;
            } else if (purchase.company === 'HDIPL') {
              transactionsByParty[partyId].hdipl += amount;
            }
            transactionsByParty[partyId].total += amount;
          }
        }
      });
      
      // Add transaction data to parties
      return parties.map(party => ({
        ...party,
        transactions: transactionsByParty[party.id]
      }));
    } catch (error) {
      console.error('Error calculating transactions:', error);
      return parties; // Return original parties if there's an error
    }
  };
  
  const handleOpenDialog = (party?: Party) => {
    setValidationErrors({});
    
    if (party) {
      setDialogTitle('Edit Party');
      setEditingParty(party);
      setFormData({
        name: party.name,
        type: party.type || 'Supplier',
        gstType: party.gstType,
        gstNumber: party.gstNumber,
        address: party.address,
        contactPerson: party.contactPerson || '',
        phone: party.phone || '',
        email: party.email || '',
        website: party.website || '',
        notes: party.notes || '',
      });
    } else {
      setDialogTitle('Add New Party');
      setEditingParty(null);
      setFormData({
        name: '',
        type: 'Supplier',
        gstType: 'CGST+SGST',
        gstNumber: '',
        address: '',
        contactPerson: '',
        phone: '',
        email: '',
        website: '',
        notes: '',
      });
    }
    setOpenDialog(true);
  };
  
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when field is edited
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when field is edited
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Party name is required';
    }
    
    if (!formData.type) {
      errors.type = 'Party type is required';
    }
    
    if (!formData.gstType) {
      errors.gstType = 'GST type is required';
    }
    
    if (formData.gstType !== 'Exempt' && !formData.gstNumber.trim()) {
      errors.gstNumber = 'GST number is required for non-exempt parties';
    } else if (formData.gstType !== 'Exempt' && formData.gstNumber.trim() && 
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstNumber.trim())) {
      errors.gstNumber = 'Invalid GST number format';
    }
    
    if (!formData.address.trim()) {
      errors.address = 'Address is required';
    }
    
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (formData.phone && !/^\d{10}$/.test(formData.phone.replace(/[^0-9]/g, ''))) {
      errors.phone = 'Phone number must be 10 digits';
    }
    
    if (formData.website && !/^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/.test(formData.website)) {
      errors.website = 'Invalid website URL';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      if (editingParty) {
        // Update existing party
        const partyRef = doc(db, 'parties', editingParty.id);
        await updateDoc(partyRef, {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        
        // Update local state
        setParties(prev => 
          prev.map(p => p.id === editingParty.id 
            ? { ...p, ...formData, updatedAt: new Date() } 
            : p
          )
        );
        
        setSuccessMessage('Party updated successfully');
      } else {
        // Add new party
        const newParty = {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(db, 'parties'), newParty);
        
        // Update local state
        const now = new Date();
        setParties(prev => [
          ...prev, 
          { 
            id: docRef.id, 
            ...formData, 
            createdAt: now, 
            updatedAt: now 
          }
        ]);
        
        setSuccessMessage('Party added successfully');
      }
      
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving party:', error);
      setErrorMessage('Failed to save party');
    }
  };
  
  const handleDeleteParty = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this party?')) {
      try {
        await deleteDoc(doc(db, 'parties', id));
        
        // Update local state
        setParties(prev => prev.filter(p => p.id !== id));
        
        setSuccessMessage('Party deleted successfully');
      } catch (error) {
        console.error('Error deleting party:', error);
        setErrorMessage('Failed to delete party');
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
  
  // Filter parties based on search term
  const filteredParties = parties.filter(party => 
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.gstNumber.includes(searchTerm) ||
    (party.contactPerson && party.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (party.phone && party.phone.includes(searchTerm)) ||
    (party.email && party.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Paginate parties
  const paginatedParties = filteredParties.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  
  // Handle preview dialog
  const handlePreviewOpen = (party: Party) => {
    setPreviewParty(party);
    setOpenPreviewDialog(true);
  };
  
  const handlePreviewClose = () => {
    setOpenPreviewDialog(false);
    setPreviewParty(null);
  };
  
  const handleEditFromPreview = () => {
    if (previewParty) {
      setOpenPreviewDialog(false);
      handleOpenDialog(previewParty);
    }
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  
  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  // Format date from Firestore timestamp
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'Not available';
    
    // Handle Firestore timestamp objects
    if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    // Handle JavaScript Date objects
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    
    // Fallback for other formats
    try {
      return new Date(timestamp).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  // Render party details for preview
  const renderPartyDetails = (party: Party) => {
    return (
      <Box>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label="Basic Info" />
          <Tab label="Business Summary" />
        </Tabs>
        
        {activeTab === 0 && (
          <Box sx={{ p: 1 }}>
            <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                {party.name}
              </Typography>
              <Chip 
                label={party.type || 'Supplier'} 
                color={party.type === 'Both' ? 'success' : party.type === 'Customer' ? 'info' : 'primary'}
                sx={{ fontWeight: 'medium' }}
              />
            </Box>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <BusinessIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1" fontWeight="medium">
                      Contact Information
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Contact Person
                    </Typography>
                    <Typography variant="body1">
                      {party.contactPerson || 'Not specified'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                    <PhoneIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body1">
                      {party.phone || 'No phone number'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <EmailIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant="body1">
                      {party.email || 'No email address'}
                    </Typography>
                  </Box>
                  
                  {party.website && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Website
                      </Typography>
                      <Typography variant="body1" component="a" href={party.website.startsWith('http') ? party.website : `https://${party.website}`} target="_blank" rel="noopener" sx={{ color: 'primary.main', textDecoration: 'none' }}>
                        {party.website}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ReceiptIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1" fontWeight="medium">
                      Tax Information
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      GST Type
                    </Typography>
                    <Typography variant="body1">
                      {party.gstType}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      GST Number
                    </Typography>
                    <Typography variant="body1">
                      {party.gstType === 'Exempt' ? 'GST Exempted' : party.gstNumber || 'Not specified'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <InfoIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1" fontWeight="medium">
                      Address
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                    {party.address}
                  </Typography>
                </Paper>
              </Grid>
              
              {party.notes && (
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                      {party.notes}
                    </Typography>
                  </Paper>
                </Grid>
              )}

              {/* Dealer Information */}
              {party.type === 'Distribution Dealer' && (
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <StoreIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" fontWeight="medium">
                        Dealer Information
                      </Typography>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Credit Limit</Typography>
                          <Typography variant="h6" color="primary.main">
                            ₹{party.creditLimit?.toLocaleString() || '0'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Default Discount</Typography>
                          <Typography variant="h6" color="success.main">
                            {party.dealerDiscount || 0}%
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Category</Typography>
                          <Typography variant="body1">
                            <Chip 
                              label={`Category ${party.dealerCategory || 'B'}`}
                              color={
                                party.dealerCategory === 'A' ? 'success' :
                                party.dealerCategory === 'B' ? 'primary' : 'warning'
                              }
                              size="small"
                            />
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Status</Typography>
                          <Typography variant="body1">
                            <Chip 
                              label={party.status || 'active'}
                              color={party.status === 'active' ? 'success' : 'error'}
                              size="small"
                            />
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Payment Terms</Typography>
                          <Typography variant="body1">{party.paymentTerms || 'Not specified'}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Territory/Area</Typography>
                          <Typography variant="body1">{party.territoryArea || 'Not specified'}</Typography>
                        </Box>
                      </Grid>
                      {party.registrationDate && (
                        <Grid item xs={12}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">Registration Date</Typography>
                            <Typography variant="body1">{formatDate(party.registrationDate)}</Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                </Grid>
              )}
            </Grid>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Created: {formatDate(party.createdAt)}
                {party.updatedAt && party.createdAt !== party.updatedAt ? 
                  ` • Last Updated: ${formatDate(party.updatedAt)}` : ''}
              </Typography>
            </Box>
          </Box>
        )}
        
        {activeTab === 1 && (
          <Box sx={{ p: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium' }}>
              Business Summary
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Card sx={{ bgcolor: 'primary.lighter', mb: 3 }}>
                  <CardContent>
                    <Typography color="primary" variant="overline">
                      Total Business
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary.dark">
                      {party.transactions ? formatCurrency(party.transactions.total) : 'No transactions'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1" color="primary" gutterBottom>
                    Hope Enterprises
                  </Typography>
                  <Typography variant="h5" fontWeight="medium">
                    {party.transactions ? formatCurrency(party.transactions.hopeEnterprises) : 'No transactions'}
                  </Typography>
                  
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {party.transactions && party.transactions.total > 0 ? 
                        `${((party.transactions.hopeEnterprises / party.transactions.total) * 100).toFixed(1)}% of total` : 
                        '0% of total'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                  <Typography variant="subtitle1" color="primary" gutterBottom>
                    HDIPL
                  </Typography>
                  <Typography variant="h5" fontWeight="medium">
                    {party.transactions ? formatCurrency(party.transactions.hdipl) : 'No transactions'}
                  </Typography>
                  
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {party.transactions && party.transactions.total > 0 ? 
                        `${((party.transactions.hdipl / party.transactions.total) * 100).toFixed(1)}% of total` : 
                        '0% of total'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>
    );
  };
  
  if (loading || isLoading) {
    return <LoadingScreen />;
  }
  
  return (
    <>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Party Management</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ borderRadius: 1.5, boxShadow: 2 }}
        >
          Add Party
        </Button>
      </Box>
      
      <Paper sx={{ mb: 4, p: 3, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Box mb={3} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
          <TextField
            fullWidth
            variant="outlined"
            label="Search Parties"
            value={searchTerm}
            onChange={handleSearch}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'primary.main' }} />,
            }}
            placeholder="Search by name, GST number, contact person, phone or email..."
            sx={{ maxWidth: { md: 400 } }}
            size="small"
          />
          
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
            Add Party
          </Button>
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
                <TableCell>GST Details</TableCell>
                <TableCell>Contact Person</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell align="right">Business Amount</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedParties.length > 0 ? (
                paginatedParties.map((party) => (
                  <TableRow 
                    key={party.id}
                    hover
                    onClick={() => handlePreviewOpen(party)}
                    sx={{ 
                      '&:nth-of-type(odd)': { bgcolor: 'background.default' },
                      '&:hover': { bgcolor: 'action.hover' },
                      cursor: 'pointer'
                    }}
                  >
                    <TableCell sx={{ fontWeight: 'medium' }}>{party.name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={party.type || 'Supplier'} 
                        color={party.type === 'Both' ? 'success' : party.type === 'Customer' ? 'info' : 'primary'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2">{party.gstType}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {party.gstType === 'Exempt' ? 'GST Exempted' : party.gstNumber || 'N/A'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{party.contactPerson || 'N/A'}</TableCell>
                    <TableCell>
                      <Box>
                        {party.phone && (
                          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
                            <PhoneIcon fontSize="small" sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                            {party.phone}
                          </Typography>
                        )}
                        {party.email && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                            <EmailIcon fontSize="small" sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                            {party.email}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {party.transactions ? (
                        <Tooltip title={`Hope Enterprises: ${formatCurrency(party.transactions.hopeEnterprises)} | HDIPL: ${formatCurrency(party.transactions.hdipl)}`}>
                          <Typography fontWeight="medium">
                            {formatCurrency(party.transactions.total)}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">No transactions</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton 
                            color="info" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewOpen(party);
                            }}
                            size="small"
                            sx={{ bgcolor: 'info.lighter', '&:hover': { bgcolor: 'info.light' } }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Party">
                          <IconButton 
                            color="primary" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDialog(party);
                            }}
                            size="small"
                            sx={{ bgcolor: 'primary.lighter', '&:hover': { bgcolor: 'primary.light' } }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Party">
                          <IconButton 
                            color="error" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteParty(party.id);
                            }}
                            size="small"
                            sx={{ bgcolor: 'error.lighter', '&:hover': { bgcolor: 'error.light' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    {searchTerm 
                      ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
                          <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                          <Typography variant="h6" color="text.secondary">No parties found matching your search</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Try different keywords or clear your search
                          </Typography>
                        </Box>
                      ) 
                      : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3 }}>
                          <AddIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                          <Typography variant="h6" color="text.secondary">No parties available</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Click the "Add Party" button to create your first party
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
          count={filteredParties.length}
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
      
      {/* Party Form Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, my: 2 }}>
            <TextField
              name="name"
              label="Party Name"
              value={formData.name}
              onChange={handleInputChange}
              fullWidth
              required
              error={!!validationErrors.name}
              helperText={validationErrors.name}
            />
            
            <FormControl 
              fullWidth 
              error={!!validationErrors.type}
            >
              <InputLabel id="party-type-label">Party Type</InputLabel>
              <Select
                labelId="party-type-label"
                name="type"
                value={formData.type}
                onChange={handleSelectChange}
                label="Party Type"
                required
              >
                {PARTY_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
              {validationErrors.type && (
                <FormHelperText>{validationErrors.type}</FormHelperText>
              )}
            </FormControl>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl 
                  fullWidth 
                  error={!!validationErrors.gstType}
                >
                  <InputLabel id="gst-type-label">GST Type</InputLabel>
                  <Select
                    labelId="gst-type-label"
                    name="gstType"
                    value={formData.gstType}
                    onChange={handleSelectChange}
                    label="GST Type"
                    required
                  >
                    {GST_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                  {validationErrors.gstType && (
                    <FormHelperText>{validationErrors.gstType}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                {formData.gstType !== 'Exempt' && (
                  <TextField
                    name="gstNumber"
                    label="GST Number"
                    value={formData.gstNumber}
                    onChange={handleInputChange}
                    fullWidth
                    required={formData.gstType !== 'Exempt'}
                    error={!!validationErrors.gstNumber}
                    helperText={validationErrors.gstNumber || "Format: 22AAAAA0000A1Z5"}
                  />
                )}
              </Grid>
            </Grid>
            
            <TextField
              name="address"
              label="Address"
              value={formData.address}
              onChange={handleInputChange}
              fullWidth
              required
              multiline
              rows={3}
              error={!!validationErrors.address}
              helperText={validationErrors.address}
            />
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  name="contactPerson"
                  label="Contact Person"
                  value={formData.contactPerson}
                  onChange={handleInputChange}
                  fullWidth
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  name="phone"
                  label="Phone Number"
                  value={formData.phone}
                  onChange={handleInputChange}
                  fullWidth
                  error={!!validationErrors.phone}
                  helperText={validationErrors.phone}
                />
              </Grid>
            </Grid>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  name="email"
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  fullWidth
                  error={!!validationErrors.email}
                  helperText={validationErrors.email}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  name="website"
                  label="Website (Optional)"
                  value={formData.website}
                  onChange={handleInputChange}
                  fullWidth
                  error={!!validationErrors.website}
                  helperText={validationErrors.website}
                />
              </Grid>
            </Grid>
            
            {/* Dealer specific fields */}
            {formData.type === 'Distribution Dealer' && (
              <>
                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Dealer Information</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      name="creditLimit"
                      label="Credit Limit"
                      type="number"
                      value={formData.creditLimit}
                      onChange={handleInputChange}
                      fullWidth
                      InputProps={{
                        startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      name="dealerDiscount"
                      label="Default Discount %"
                      type="number"
                      value={formData.dealerDiscount}
                      onChange={handleInputChange}
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Dealer Category</InputLabel>
                      <Select
                        name="dealerCategory"
                        value={formData.dealerCategory}
                        onChange={handleSelectChange}
                        label="Dealer Category"
                      >
                        <MenuItem value="A">Category A</MenuItem>
                        <MenuItem value="B">Category B</MenuItem>
                        <MenuItem value="C">Category C</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        name="status"
                        value={formData.status}
                        onChange={handleSelectChange}
                        label="Status"
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      name="paymentTerms"
                      label="Payment Terms"
                      value={formData.paymentTerms}
                      onChange={handleInputChange}
                      fullWidth
                      placeholder="e.g., Net 30"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      name="territoryArea"
                      label="Territory/Area"
                      value={formData.territoryArea}
                      onChange={handleInputChange}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        label="Registration Date"
                        value={formData.registrationDate}
                        onChange={(newValue) => {
                          setFormData(prev => ({
                            ...prev,
                            registrationDate: newValue
                          }));
                        }}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                    </LocalizationProvider>
                  </Grid>
                </Grid>
              </>
            )}

            <TextField
              name="notes"
              label="Notes (Optional)"
              value={formData.notes}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingParty ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Party Preview Dialog */}
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
            <Typography variant="h6">Party Details</Typography>
            <IconButton size="small" edge="end" onClick={handlePreviewClose}>
              <DeleteIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {previewParty && renderPartyDetails(previewParty)}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={handlePreviewClose} variant="outlined">
            Close
          </Button>
          {previewParty && (
            <>
              <Button 
                onClick={() => handleDeleteParty(previewParty.id)} 
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