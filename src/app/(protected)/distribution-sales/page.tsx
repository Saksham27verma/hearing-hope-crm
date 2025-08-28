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
  Grid,
  Tab,
  Tabs,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  BusinessCenter as DealerIcon,
  Receipt as ReceiptIcon,
  Visibility as PreviewIcon,
  Close as CloseIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  LocalShipping as ShippingIcon,
  Store as StoreIcon,
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
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import DistributionForm from '@/components/distribution/DistributionForm';

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

interface Dealer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstType?: string;
  gstNumber?: string;
  paymentTerms?: string;
  contactPerson?: string;
  category: 'dealer' | 'distributor' | 'both';
  creditLimit?: number;
  outstandingAmount?: number;
  totalBusiness?: number;
  lastOrderDate?: Timestamp;
  registrationDate?: Timestamp;
  status?: 'active' | 'inactive';
}

interface DistributionProduct {
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
  gstAmount?: number;
  totalAmount?: number;
  remarks?: string;
  quantityType?: 'piece' | 'pair';
  condition?: string;
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

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`distribution-tabpanel-${index}`}
      aria-labelledby={`distribution-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export default function DistributionSalesPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // State management
  const [tabValue, setTabValue] = useState(0);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
  const [dealerDetailsOpen, setDealerDetailsOpen] = useState(false);
  const [distributionFormOpen, setDistributionFormOpen] = useState(false);
  const [selectedDistribution, setSelectedDistribution] = useState<Distribution | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDistributions(),
        loadDealers(),
        loadProducts()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setSnackbar({ open: true, message: 'Error loading data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadDistributions = async () => {
    try {
      const distributionsQuery = query(
        collection(db, 'distributions'),
        orderBy('distributionDate', 'desc')
      );
      const snapshot = await getDocs(distributionsQuery);
      const distributionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Distribution[];
      setDistributions(distributionsData);
    } catch (error) {
      console.error('Error loading distributions:', error);
    }
  };

  const loadDealers = async () => {
    try {
      const dealersQuery = query(
        collection(db, 'parties'),
        where('type', '==', 'Distribution Dealer')
      );
      const snapshot = await getDocs(dealersQuery);
      const dealersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Dealer[];
      
      // Calculate business totals for each dealer
      const dealersWithTotals = await Promise.all(
        dealersData.map(async (dealer) => {
          const dealerDistributions = distributions.filter(d => d.dealer.id === dealer.id);
          const totalBusiness = dealerDistributions.reduce((sum, d) => sum + d.totalAmount, 0);
          const outstandingAmount = dealerDistributions
            .filter(d => d.paymentStatus !== 'paid')
            .reduce((sum, d) => sum + d.totalAmount, 0);
          const lastOrderDate = dealerDistributions.length > 0 
            ? dealerDistributions[0].distributionDate 
            : null;
          
          return {
            ...dealer,
            totalBusiness,
            outstandingAmount,
            lastOrderDate
          };
        })
      );
      
      setDealers(dealersWithTotals);
    } catch (error) {
      console.error('Error loading dealers:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  // Handlers
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDealerSelect = (dealer: Dealer) => {
    setSelectedDealer(dealer);
    setDealerDetailsOpen(true);
  };

  const handleNewDistribution = () => {
    setSelectedDistribution(null);
    setDistributionFormOpen(true);
  };

  const handleEditDistribution = (distribution: Distribution) => {
    setSelectedDistribution(distribution);
    setDistributionFormOpen(true);
  };

  const handleDeleteDistribution = async (distributionId: string) => {
    if (confirm('Are you sure you want to delete this distribution?')) {
      try {
        await deleteDoc(doc(db, 'distributions', distributionId));
        setSnackbar({ open: true, message: 'Distribution deleted successfully', severity: 'success' });
        loadDistributions();
      } catch (error) {
        console.error('Error deleting distribution:', error);
        setSnackbar({ open: true, message: 'Error deleting distribution', severity: 'error' });
      }
    }
  };

  const handleSaveDistribution = async (distributionData: Distribution) => {
    try {
      if (selectedDistribution?.id) {
        // Update existing distribution
        await updateDoc(doc(db, 'distributions', selectedDistribution.id), {
          ...distributionData,
          updatedAt: serverTimestamp(),
        });
        setSnackbar({ open: true, message: 'Distribution updated successfully', severity: 'success' });
      } else {
        // Create new distribution
        await addDoc(collection(db, 'distributions'), {
          ...distributionData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user?.uid,
        });
        setSnackbar({ open: true, message: 'Distribution created successfully', severity: 'success' });
      }
      
      setDistributionFormOpen(false);
      setSelectedDistribution(null);
      loadData();
    } catch (error) {
      console.error('Error saving distribution:', error);
      setSnackbar({ open: true, message: 'Error saving distribution', severity: 'error' });
    }
  };

  // Filter distributions
  const filteredDistributions = distributions.filter(distribution => {
    const matchesSearch = distribution.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         distribution.dealer.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || distribution.paymentStatus === statusFilter;
    const matchesDate = !dateFilter || 
                       (distribution.distributionDate.toDate().toDateString() === dateFilter.toDateString());
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Calculate overview stats
  const overviewStats = {
    totalDistributions: distributions.length,
    totalDealers: dealers.length,
    totalRevenue: distributions.reduce((sum, d) => sum + d.totalAmount, 0),
    pendingPayments: distributions
      .filter(d => d.paymentStatus !== 'paid')
      .reduce((sum, d) => sum + d.totalAmount, 0),
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Distribution Sales
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleNewDistribution}
            sx={{ borderRadius: 2 }}
          >
            New Distribution
          </Button>
        </Box>

        {/* Overview Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {overviewStats.totalDistributions}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Total Distributions
                    </Typography>
                  </Box>
                  <ShippingIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {overviewStats.totalDealers}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Active Dealers
                    </Typography>
                  </Box>
                  <StoreIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      ₹{overviewStats.totalRevenue.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Total Revenue
                    </Typography>
                  </Box>
                  <TrendingUpIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      ₹{overviewStats.pendingPayments.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Pending Payments
                    </Typography>
                  </Box>
                  <AssessmentIcon sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ px: 2 }}>
            <Tab label="Distributions" icon={<ReceiptIcon />} iconPosition="start" />
            <Tab label="Dealers" icon={<DealerIcon />} iconPosition="start" />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        <TabPanel value={tabValue} index={0}>
          {/* Distributions Tab */}
          <Paper sx={{ p: 3 }}>
            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <TextField
                placeholder="Search distributions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ flexGrow: 1, minWidth: 200 }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Payment Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Payment Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="partial">Partial</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                </Select>
              </FormControl>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Distribution Date"
                  value={dateFilter}
                  onChange={(newValue) => setDateFilter(newValue)}
                  slotProps={{ textField: { sx: { minWidth: 150 } } }}
                />
              </LocalizationProvider>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadData}
              >
                Refresh
              </Button>
            </Box>

            {/* Distributions Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Dealer</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Products</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Payment Status</TableCell>
                    <TableCell>Delivery Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredDistributions
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((distribution) => (
                    <TableRow key={distribution.id} hover>
                      <TableCell>{distribution.invoiceNumber}</TableCell>
                      <TableCell>{distribution.dealer.name}</TableCell>
                      <TableCell>
                        {distribution.distributionDate?.toDate().toLocaleDateString()}
                      </TableCell>
                      <TableCell>{distribution.products.length} items</TableCell>
                      <TableCell>₹{distribution.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip
                          label={distribution.paymentStatus}
                          color={
                            distribution.paymentStatus === 'paid' ? 'success' :
                            distribution.paymentStatus === 'partial' ? 'warning' : 'error'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={distribution.deliveryStatus}
                          color={
                            distribution.deliveryStatus === 'delivered' ? 'success' :
                            distribution.deliveryStatus === 'dispatched' ? 'info' : 'default'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleEditDistribution(distribution)}
                            >
                              <PreviewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => handleEditDistribution(distribution)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteDistribution(distribution.id!)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredDistributions.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
            />
          </Paper>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Dealers Tab */}
          <Paper sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {dealers.map((dealer) => (
                <Grid item xs={12} sm={6} md={4} key={dealer.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      }
                    }}
                    onClick={() => handleDealerSelect(dealer)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                          <DealerIcon />
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" noWrap>
                            {dealer.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {dealer.category}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Total Business
                          </Typography>
                          <Typography variant="h6" color="primary.main">
                            ₹{dealer.totalBusiness?.toLocaleString() || '0'}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Outstanding
                          </Typography>
                          <Typography variant="h6" color="error.main">
                            ₹{dealer.outstandingAmount?.toLocaleString() || '0'}
                          </Typography>
                        </Box>
                      </Box>
                      
                      {dealer.lastOrderDate && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            Last Order: {dealer.lastOrderDate.toDate().toLocaleDateString()}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </TabPanel>

        {/* Distribution Form Dialog */}
        <Dialog
          open={distributionFormOpen}
          onClose={() => {
            setDistributionFormOpen(false);
            setSelectedDistribution(null);
          }}
          maxWidth="xl"
          fullWidth
          PaperProps={{
            sx: { height: '90vh' }
          }}
        >
          <DialogTitle>
            {selectedDistribution ? 'Edit Distribution' : 'New Distribution'}
            <IconButton
              aria-label="close"
              onClick={() => {
                setDistributionFormOpen(false);
                setSelectedDistribution(null);
              }}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <DistributionForm
              initialData={selectedDistribution || undefined}
              dealers={dealers}
              onSave={handleSaveDistribution}
              onCancel={() => {
                setDistributionFormOpen(false);
                setSelectedDistribution(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Dealer Details Dialog */}
        <Dialog
          open={dealerDetailsOpen}
          onClose={() => {
            setDealerDetailsOpen(false);
            setSelectedDealer(null);
          }}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Dealer Details: {selectedDealer?.name}
            <IconButton
              aria-label="close"
              onClick={() => {
                setDealerDetailsOpen(false);
                setSelectedDealer(null);
              }}
              sx={{ position: 'absolute', right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {selectedDealer && (
              <Box>
                {/* Dealer Information */}
                <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Dealer Information</Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Name</Typography>
                        <Typography variant="body1">{selectedDealer.name}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Category</Typography>
                        <Typography variant="body1">{selectedDealer.category}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Phone</Typography>
                        <Typography variant="body1">{selectedDealer.phone || 'Not provided'}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Email</Typography>
                        <Typography variant="body1">{selectedDealer.email || 'Not provided'}</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Address</Typography>
                        <Typography variant="body1">{selectedDealer.address || 'Not provided'}</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Business Summary */}
                <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Business Summary</Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={3}>
                      <Card sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="primary">
                          ₹{selectedDealer.totalBusiness?.toLocaleString() || '0'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Business
                        </Typography>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="error.main">
                          ₹{selectedDealer.outstandingAmount?.toLocaleString() || '0'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Outstanding Amount
                        </Typography>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="info.main">
                          {distributions.filter(d => d.dealer.id === selectedDealer.id).length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Orders
                        </Typography>
                      </Card>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Card sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" color="success.main">
                          {selectedDealer.lastOrderDate?.toDate().toLocaleDateString() || 'N/A'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Last Order
                        </Typography>
                      </Card>
                    </Grid>
                  </Grid>
                </Paper>

                {/* Transaction History */}
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Transaction History</Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Invoice #</TableCell>
                          <TableCell>Date</TableCell>
                          <TableCell>Products</TableCell>
                          <TableCell>Amount</TableCell>
                          <TableCell>Payment Status</TableCell>
                          <TableCell>Delivery Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {distributions
                          .filter(d => d.dealer.id === selectedDealer.id)
                          .slice(0, 10) // Show last 10 transactions
                          .map((distribution) => (
                          <TableRow key={distribution.id}>
                            <TableCell>{distribution.invoiceNumber}</TableCell>
                            <TableCell>
                              {distribution.distributionDate?.toDate().toLocaleDateString()}
                            </TableCell>
                            <TableCell>{distribution.products.length} items</TableCell>
                            <TableCell>₹{distribution.totalAmount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Chip
                                label={distribution.paymentStatus}
                                color={
                                  distribution.paymentStatus === 'paid' ? 'success' :
                                  distribution.paymentStatus === 'partial' ? 'warning' : 'error'
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={distribution.deliveryStatus}
                                color={
                                  distribution.deliveryStatus === 'delivered' ? 'success' :
                                  distribution.deliveryStatus === 'dispatched' ? 'info' : 'default'
                                }
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  {distributions.filter(d => d.dealer.id === selectedDealer.id).length === 0 && (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No transactions found for this dealer.
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              variant="contained"
              onClick={() => {
                setDealerDetailsOpen(false);
                setSelectedDistribution(null);
                setDistributionFormOpen(true);
              }}
            >
              Create New Distribution
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
}
