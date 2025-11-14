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
  IconButton,
  InputAdornment,
  Grid,
  Chip,
  Card,
  CardContent,
  CardActions,
  Stack,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Description as DescriptionIcon,
  AccountBalance as GSTIcon,
  Language as WebsiteIcon,
  CorporateFare as CorporateIcon,
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

// Types
interface Company {
  id?: string;
  name: string;
  type: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Component
const CompaniesPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [centersCount, setCentersCount] = useState<Record<string, number>>({});

  // Initialize empty company
  const emptyCompany: Company = {
    name: '',
    type: '',
    gstNumber: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    website: '',
    description: '',
  };

  // Company type options
  const companyTypes = [
    'Hearing Aid Retail',
    'Medical Equipment',
    'Healthcare Services',
    'Manufacturing',
    'Distribution',
    'Consulting',
    'Other'
  ];

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Fetch companies data
    fetchCompanies();
    // Fetch centers count per company
    fetchCentersCount();
    
  }, [user, authLoading, router]);

  // Filter companies when search term changes
  useEffect(() => {
    if (companies.length === 0) {
      setFilteredCompanies([]);
      return;
    }
    
    let filtered = [...companies];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(company => 
        company.name.toLowerCase().includes(searchLower) ||
        company.type.toLowerCase().includes(searchLower) ||
        (company.city && company.city.toLowerCase().includes(searchLower)) ||
        (company.gstNumber && company.gstNumber.toLowerCase().includes(searchLower))
      );
    }
    
    setFilteredCompanies(filtered);
  }, [companies, searchTerm]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const companiesQuery = query(collection(db, 'companies'), orderBy('name', 'asc'));
      const snapshot = await getDocs(companiesQuery);
      
      const companiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Company[];
      
      // If no companies exist, create default ones
      if (companiesData.length === 0) {
        console.log('No companies found. Creating default companies...');
        await createDefaultCompanies();
        // Fetch again after creating defaults
        const newSnapshot = await getDocs(companiesQuery);
        const newCompaniesData = newSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Company[];
        setCompanies(newCompaniesData);
        setFilteredCompanies(newCompaniesData);
        setSuccessMsg('Default companies created successfully!');
      } else {
        setCompanies(companiesData);
        setFilteredCompanies(companiesData);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching companies:', error);
      setErrorMsg('Failed to load companies data');
      setLoading(false);
    }
  };

  const createDefaultCompanies = async () => {
    const defaultCompanies = [
      {
        name: 'Hope Enterprises',
        type: 'Hearing Aid Retail',
        gstNumber: '07AFNPM1470L1Z3',
        address: 'G-14, Ground Floor, King Mall, Twin District Center, Opp. Baba Saheb Ambedkar Hospital Rohini',
        city: 'Rohini',
        state: 'Delhi',
        pincode: '110085',
        phone: '9711871169',
        email: 'hearinghope@gmail.com',
        website: 'hearinghope.in',
        description: 'Hearing aid retail and services company',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      {
        name: 'HDIPL',
        type: 'Medical Equipment',
        gstNumber: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        phone: '',
        email: '',
        website: '',
        description: 'Hearing Devices India Private Limited',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    ];

    for (const company of defaultCompanies) {
      await addDoc(collection(db, 'companies'), company);
      console.log(`✅ Created company: ${company.name}`);
    }
  };

  const fetchCentersCount = async () => {
    try {
      const centersSnap = await getDocs(collection(db, 'centers'));
      const counts: Record<string, number> = {};
      
      centersSnap.docs.forEach(doc => {
        const data = doc.data();
        const company = data.company || data.companyId || data.companyName;
        if (company) {
          counts[company] = (counts[company] || 0) + 1;
        }
      });
      
      setCentersCount(counts);
    } catch (error) {
      console.error('Error fetching centers count:', error);
    }
  };

  const handleAddCompany = () => {
    setCurrentCompany(emptyCompany);
    setOpenDialog(true);
  };

  const handleEditCompany = (company: Company) => {
    setCurrentCompany(company);
    setOpenDialog(true);
  };

  const handleDeleteCompany = async (id: string, companyName: string) => {
    // Check if company has centers
    const centerCount = centersCount[companyName] || 0;
    if (centerCount > 0) {
      setErrorMsg(`Cannot delete ${companyName}. It has ${centerCount} center(s) assigned. Please reassign or delete those centers first.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${companyName}?`)) return;
    
    try {
      await deleteDoc(doc(db, 'companies', id));
      setCompanies(prevCompanies => prevCompanies.filter(company => company.id !== id));
      setSuccessMsg('Company deleted successfully');
    } catch (error) {
      console.error('Error deleting company:', error);
      setErrorMsg('Failed to delete company');
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentCompany(null);
  };

  const handleSaveCompany = async () => {
    if (!currentCompany) return;
    
    // Validate required fields
    if (!currentCompany.name || !currentCompany.type) {
      setErrorMsg('Please fill in all required fields (Name and Type)');
      return;
    }
    
    try {
      if (currentCompany.id) {
        // Update existing company
        const companyRef = doc(db, 'companies', currentCompany.id);
        await updateDoc(companyRef, {
          ...currentCompany,
          updatedAt: serverTimestamp(),
        });
        
        // Update in state
        setCompanies(prevCompanies => 
          prevCompanies.map(company => 
            company.id === currentCompany.id ? {...currentCompany, updatedAt: Timestamp.now()} : company
          )
        );
        
        setSuccessMsg('Company updated successfully');
      } else {
        // Add new company
        const newCompanyData = {
          ...currentCompany,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(db, 'companies'), newCompanyData);
        
        // Add to state with the new ID
        const newCompany = {
          ...currentCompany,
          id: docRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        
        setCompanies(prevCompanies => [newCompany, ...prevCompanies]);
        setSuccessMsg('Company added successfully');
      }
      
      setOpenDialog(false);
      setCurrentCompany(null);
    } catch (error) {
      console.error('Error saving company:', error);
      setErrorMsg('Failed to save company');
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
    if (!timestamp) return '-';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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
        Company Management
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Manage all companies and their information
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    {companies.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Companies
                  </Typography>
                </Box>
                <CorporateIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {Object.values(centersCount).reduce((a, b) => a + b, 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Centers
                  </Typography>
                </Box>
                <LocationIcon sx={{ fontSize: 48, color: 'success.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Filters and Actions */}
      <Box mb={3} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <TextField
          placeholder="Search companies..."
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
          sx={{ width: { xs: '100%', sm: 300 } }}
        />
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddCompany}
        >
          Add Company
        </Button>
      </Box>
      
      {/* Companies Table */}
      <Paper elevation={0} variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Company Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>GST Number</TableCell>
                <TableCell>Centers</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCompanies.length > 0 ? (
                filteredCompanies
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((company) => (
                    <TableRow key={company.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <BusinessIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {company.name}
                            </Typography>
                            {company.city && (
                              <Typography variant="caption" color="text.secondary">
                                {company.city}, {company.state}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={company.type} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Box>
                          {company.phone && (
                            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PhoneIcon fontSize="small" sx={{ fontSize: 14 }} />
                              {company.phone}
                            </Typography>
                          )}
                          {company.email && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <EmailIcon sx={{ fontSize: 12 }} />
                              {company.email}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {company.gstNumber || '-'}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${centersCount[company.name] || 0} centers`}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleEditCompany(company)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => company.id && handleDeleteCompany(company.id, company.name)}
                        >
                          <DeleteIcon fontSize="small" />
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
                      <Box>
                        <Typography variant="body1" color="text.secondary" gutterBottom>
                          No companies found
                        </Typography>
                        <Button
                          variant="outlined"
                          startIcon={<AddIcon />}
                          onClick={handleAddCompany}
                          sx={{ mt: 2 }}
                        >
                          Add Your First Company
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
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredCompanies.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      
      {/* Company Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <BusinessIcon color="primary" />
            <Typography variant="h6">
              {currentCompany?.id ? 'Edit Company' : 'Add New Company'}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Basic Information */}
            <Box>
              <Typography variant="subtitle2" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon fontSize="small" /> Basic Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    label="Company Name"
                    variant="outlined"
                    size="small"
                    fullWidth
                    required
                    value={currentCompany?.name || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          name: e.target.value,
                        });
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BusinessIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Company Type"
                    variant="outlined"
                    size="small"
                    fullWidth
                    required
                    select
                    SelectProps={{ native: true }}
                    value={currentCompany?.type || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          type: e.target.value,
                        });
                      }
                    }}
                  >
                    <option value="">Select Type</option>
                    {companyTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Description"
                    variant="outlined"
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    value={currentCompany?.description || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          description: e.target.value,
                        });
                      }
                    }}
                    placeholder="Brief description about the company..."
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Address Information */}
            <Box>
              <Typography variant="subtitle2" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LocationIcon fontSize="small" /> Address Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Address"
                    variant="outlined"
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    value={currentCompany?.address || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          address: e.target.value,
                        });
                      }
                    }}
                    placeholder="Street address, building name, etc."
                  />
                </Grid>
                <Grid item xs={12} md={5}>
                  <TextField
                    label="City"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentCompany?.city || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          city: e.target.value,
                        });
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="State"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentCompany?.state || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          state: e.target.value,
                        });
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Pincode"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentCompany?.pincode || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          pincode: e.target.value,
                        });
                      }
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Contact & Tax Information */}
            <Box>
              <Typography variant="subtitle2" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhoneIcon fontSize="small" /> Contact & Tax Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Phone"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentCompany?.phone || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          phone: e.target.value,
                        });
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Email"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="email"
                    value={currentCompany?.email || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          email: e.target.value,
                        });
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Website"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentCompany?.website || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          website: e.target.value,
                        });
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <WebsiteIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="www.example.com"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="GST Number"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentCompany?.gstNumber || ''}
                    onChange={(e) => {
                      if (currentCompany) {
                        setCurrentCompany({
                          ...currentCompany,
                          gstNumber: e.target.value.toUpperCase(),
                        });
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <GSTIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    placeholder="e.g., 07AFNPM1470L1Z3"
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSaveCompany}
            startIcon={currentCompany?.id ? <EditIcon /> : <AddIcon />}
          >
            {currentCompany?.id ? 'Update Company' : 'Add Company'}
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

export default CompaniesPage;

