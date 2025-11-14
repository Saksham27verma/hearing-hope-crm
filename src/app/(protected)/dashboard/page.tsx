'use client';

import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Card, 
  CardContent, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Chip,
  Avatar,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import { 
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  ShoppingCart as ShoppingCartIcon,
  LocalShipping as ShippingIcon,
  Assignment as AssignmentIcon,
  Store as StoreIcon,
  SwapHoriz as TransferIcon,
  ArrowForward as ArrowForwardIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Format date
const formatDate = (timestamp: Timestamp) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalEnquiries: 0,
    totalSales: 0,
    monthlySales: 0,
    monthlyRevenue: 0,
    totalInventory: 0,
    totalStockTransfers: 0,
    totalParties: 0,
    totalCenters: 0,
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [recentEnquiries, setRecentEnquiries] = useState<any[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<any[]>([]);

  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Get counts in parallel
      const [
        productsSnapshot,
        enquiriesSnapshot,
        salesSnapshot,
        inventorySnapshot,
        transfersSnapshot,
        partiesSnapshot,
        centersSnapshot,
      ] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'enquiries')),
        getDocs(collection(db, 'sales')),
        getDocs(query(collection(db, 'inventory'), where('status', '==', 'In Stock'))),
        getDocs(collection(db, 'stockTransfers')),
        getDocs(collection(db, 'parties')),
        getDocs(collection(db, 'centers')),
      ]);
      
      // Calculate monthly data (current month)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstDayTimestamp = Timestamp.fromDate(firstDayOfMonth);
      
      const monthlySalesQuery = query(
        collection(db, 'sales'),
        where('saleDate', '>=', firstDayTimestamp)
      );
      const monthlySalesSnapshot = await getDocs(monthlySalesQuery);
      
      let monthlyRevenue = 0;
      monthlySalesSnapshot.forEach(doc => {
        const saleData = doc.data();
        monthlyRevenue += saleData.totalAmount || 0;
      });
      
      // Recent sales
      const recentSalesQuery = query(
        collection(db, 'sales'),
        orderBy('saleDate', 'desc'),
        limit(5)
      );
      const recentSalesSnapshot = await getDocs(recentSalesQuery);
      const recentSalesData = recentSalesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Recent enquiries
      const recentEnquiriesQuery = query(
        collection(db, 'enquiries'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const recentEnquiriesSnapshot = await getDocs(recentEnquiriesQuery);
      const recentEnquiriesData = recentEnquiriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Recent stock transfers
      const recentTransfersQuery = query(
        collection(db, 'stockTransfers'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const recentTransfersSnapshot = await getDocs(recentTransfersQuery);
      const recentTransfersData = recentTransfersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setStats({
        totalProducts: productsSnapshot.size,
        totalEnquiries: enquiriesSnapshot.size,
        totalSales: salesSnapshot.size,
        monthlySales: monthlySalesSnapshot.size,
        monthlyRevenue,
        totalInventory: inventorySnapshot.size,
        totalStockTransfers: transfersSnapshot.size,
        totalParties: partiesSnapshot.size,
        totalCenters: centersSnapshot.size,
      });
      
      setRecentSales(recentSalesData);
      setRecentEnquiries(recentEnquiriesData);
      setRecentTransfers(recentTransfersData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress color="primary" size={60} />
      </Box>
    );
  }

  const statCards = [
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: <InventoryIcon sx={{ fontSize: 40 }} />,
      color: '#ff6b35',
      bgGradient: 'linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%)',
      path: '/products',
    },
    {
      title: 'Enquiries',
      value: stats.totalEnquiries,
      icon: <PeopleIcon sx={{ fontSize: 40 }} />,
      color: '#2196f3',
      bgGradient: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)',
      path: '/interaction/enquiries',
    },
    {
      title: 'Total Sales',
      value: stats.totalSales,
      icon: <ReceiptIcon sx={{ fontSize: 40 }} />,
      color: '#4caf50',
      bgGradient: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
      path: '/sales',
    },
    {
      title: 'Monthly Revenue',
      value: formatCurrency(stats.monthlyRevenue),
      icon: <MoneyIcon sx={{ fontSize: 40 }} />,
      color: '#ff9800',
      bgGradient: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
      path: '/reports',
    },
    {
      title: 'Inventory Items',
      value: stats.totalInventory,
      icon: <StoreIcon sx={{ fontSize: 40 }} />,
      color: '#9c27b0',
      bgGradient: 'linear-gradient(135deg, #9c27b0 0%, #ba68c8 100%)',
      path: '/inventory',
    },
    {
      title: 'Stock Transfers',
      value: stats.totalStockTransfers,
      icon: <TransferIcon sx={{ fontSize: 40 }} />,
      color: '#00bcd4',
      bgGradient: 'linear-gradient(135deg, #00bcd4 0%, #4dd0e1 100%)',
      path: '/stock-transfer',
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary" gutterBottom>
            Dashboard Overview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Welcome back! Here's what's happening with your business today.
          </Typography>
        </Box>
        <Tooltip title="Refresh Data">
          <IconButton 
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            sx={{ 
              bgcolor: 'primary.50',
              '&:hover': { bgcolor: 'primary.100' }
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {refreshing && (
        <LinearProgress sx={{ mb: 3, borderRadius: 1 }} />
      )}

      {/* Stats Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 3, mb: 4 }}>
        {statCards.map((card, index) => (
          <Box key={index}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                position: 'relative',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: 6,
                  borderColor: card.color,
                },
              }}
              onClick={() => router.push(card.path)}
            >
              <Box
                sx={{
                  background: card.bgGradient,
                  p: 2,
                  color: 'white',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 500 }}>
                      {card.title}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" sx={{ mt: 0.5 }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Avatar
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      width: 56,
                      height: 56,
                      color: 'white',
                    }}
                  >
                    {card.icon}
                  </Avatar>
                </Box>
              </Box>
              <Box
                sx={{
                  p: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: 'grey.50',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  View Details
                </Typography>
                <ArrowForwardIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </Box>
            </Card>
          </Box>
        ))}
      </Box>

      {/* Additional Stats Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
        <Box>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              textAlign: 'center',
              bgcolor: 'info.50',
            }}
          >
            <ShoppingCartIcon sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold" color="info.main">
              {stats.totalParties}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Parties
            </Typography>
          </Paper>
        </Box>
        <Box>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              textAlign: 'center',
              bgcolor: 'success.50',
            }}
          >
            <StoreIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold" color="success.main">
              {stats.totalCenters}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Centers
            </Typography>
          </Paper>
        </Box>
        <Box>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              textAlign: 'center',
              bgcolor: 'warning.50',
            }}
          >
            <TrendingUpIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold" color="warning.main">
              {stats.monthlySales}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sales This Month
            </Typography>
          </Paper>
        </Box>
        <Box>
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              textAlign: 'center',
              bgcolor: 'secondary.50',
            }}
          >
            <ShippingIcon sx={{ fontSize: 32, color: 'secondary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold" color="secondary.main">
              {stats.totalStockTransfers}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Stock Transfers
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Recent Activity Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" color="primary" gutterBottom>
          Recent Activity
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Latest updates from your CRM
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
        {/* Recent Sales */}
        <Box>
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              overflow: 'hidden',
              height: '100%',
            }}
          >
            <Box
              sx={{
                p: 2.5,
                bgcolor: 'success.50',
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: 'success.main', width: 40, height: 40 }}>
                  <ReceiptIcon />
                </Avatar>
                <Typography variant="h6" fontWeight="bold">
                  Recent Sales
                </Typography>
              </Box>
              <Button
                variant="text"
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push('/sales')}
              >
                View All
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Customer</strong></TableCell>
                    <TableCell align="right"><strong>Amount</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentSales.length > 0 ? (
                    recentSales.map((sale) => (
                      <TableRow
                        key={sale.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/sales`)}
                      >
                        <TableCell>
                          <Chip
                            label={formatDate(sale.saleDate)}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {sale.customerName || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {formatCurrency(sale.totalAmount || 0)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No recent sales
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        {/* Recent Enquiries */}
        <Box>
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              overflow: 'hidden',
              height: '100%',
            }}
          >
            <Box
              sx={{
                p: 2.5,
                bgcolor: 'info.50',
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: 'info.main', width: 40, height: 40 }}>
                  <PeopleIcon />
                </Avatar>
                <Typography variant="h6" fontWeight="bold">
                  Recent Enquiries
                </Typography>
              </Box>
              <Button
                variant="text"
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push('/interaction/enquiries')}
              >
                View All
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Name</strong></TableCell>
                    <TableCell><strong>Phone</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentEnquiries.length > 0 ? (
                    recentEnquiries.map((enquiry) => (
                      <TableRow
                        key={enquiry.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/interaction/enquiries/${enquiry.id}`)}
                      >
                        <TableCell>
                          <Chip
                            label={formatDate(enquiry.createdAt)}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {enquiry.name || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {enquiry.phone || 'N/A'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No recent enquiries
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>

        {/* Recent Stock Transfers */}
        <Box>
          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 3,
              overflow: 'hidden',
              height: '100%',
            }}
          >
            <Box
              sx={{
                p: 2.5,
                bgcolor: 'secondary.50',
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: 'secondary.main', width: 40, height: 40 }}>
                  <TransferIcon />
                </Avatar>
                <Typography variant="h6" fontWeight="bold">
                  Recent Transfers
                </Typography>
              </Box>
              <Button
                variant="text"
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => router.push('/stock-transfer')}
              >
                View All
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell><strong>Date</strong></TableCell>
                    <TableCell><strong>Transfer #</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentTransfers.length > 0 ? (
                    recentTransfers.map((transfer) => (
                      <TableRow
                        key={transfer.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/stock-transfer`)}
                      >
                        <TableCell>
                          <Chip
                            label={formatDate(transfer.transferDate)}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {transfer.transferNumber || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={transfer.transferType === 'intracompany' ? 'Intra' : 'Inter'}
                            size="small"
                            color={transfer.transferType === 'intracompany' ? 'primary' : 'secondary'}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No recent transfers
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
