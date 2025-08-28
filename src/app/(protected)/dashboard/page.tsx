'use client';

import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
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
  Button
} from '@mui/material';
import { 
  InventoryOutlined, 
  GroupOutlined, 
  ReceiptOutlined, 
  TrendingUpOutlined,
  AttachMoneyOutlined
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
// Temporarily disabled optimized hooks to prevent bundling issues
// import { useOptimizedDashboard, useOptimizedCollection } from '@/hooks/useOptimizedFirebase';

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
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalVisitors: 0,
    totalSales: 0,
    monthlySales: 0,
    monthlyRevenue: 0
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [recentVisitors, setRecentVisitors] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Get counts
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const visitorsSnapshot = await getDocs(collection(db, 'visitors'));
        const salesSnapshot = await getDocs(collection(db, 'sales'));
        
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
        
        // Recent visitors
        const recentVisitorsQuery = query(
          collection(db, 'visitors'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const recentVisitorsSnapshot = await getDocs(recentVisitorsQuery);
        const recentVisitorsData = recentVisitorsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setStats({
          totalProducts: productsSnapshot.size,
          totalVisitors: visitorsSnapshot.size,
          totalSales: salesSnapshot.size,
          monthlySales: monthlySalesSnapshot.size,
          monthlyRevenue
        });
        
        setRecentSales(recentSalesData);
        setRecentVisitors(recentVisitorsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };
    
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4', lg: 'span 2.4' } }}>
          <Card sx={{ 
            bgcolor: '#fef4eb', 
            color: '#EE6417',
            height: '100%',
            '&:hover': { boxShadow: 3 }
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Total Products
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalProducts}
                  </Typography>
                </Box>
                <InventoryOutlined fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4', lg: 'span 2.4' } }}>
          <Card sx={{ 
            bgcolor: '#ecf9f6', 
            color: '#3aa986',
            height: '100%',
            '&:hover': { boxShadow: 3 }
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Total Visitors
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalVisitors}
                  </Typography>
                </Box>
                <GroupOutlined fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4', lg: 'span 2.4' } }}>
          <Card sx={{ 
            bgcolor: '#eef5ff', 
            color: '#4285F4',
            height: '100%',
            '&:hover': { boxShadow: 3 }
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Total Sales
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.totalSales}
                  </Typography>
                </Box>
                <ReceiptOutlined fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4', lg: 'span 2.4' } }}>
          <Card sx={{ 
            bgcolor: '#fff4e6', 
            color: '#ff9800',
            height: '100%',
            '&:hover': { boxShadow: 3 }
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Monthly Sales
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {stats.monthlySales}
                  </Typography>
                </Box>
                <TrendingUpOutlined fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4', lg: 'span 2.4' } }}>
          <Card sx={{ 
            bgcolor: '#f5f5f5', 
            color: '#757575',
            height: '100%',
            '&:hover': { boxShadow: 3 }
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    Monthly Revenue
                  </Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {formatCurrency(stats.monthlyRevenue)}
                  </Typography>
                </Box>
                <AttachMoneyOutlined fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Recent Activity Section */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" color="primary" fontWeight="medium">
          Recent Activity
        </Typography>
      </Box>
      
      <Grid container spacing={3}>
        {/* Recent Sales */}
        <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight="medium">
                Recent Sales
              </Typography>
              <Button 
                variant="text" 
                color="primary" 
                size="small"
                onClick={() => router.push('/sales')}
              >
                View All
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentSales.length > 0 ? (
                    recentSales.map((sale) => (
                      <TableRow key={sale.id} hover>
                        <TableCell>{formatDate(sale.saleDate)}</TableCell>
                        <TableCell>{sale.customerName}</TableCell>
                        <TableCell align="right">{formatCurrency(sale.totalAmount || 0)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center">No recent sales</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        
        {/* Recent Visitors */}
        <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight="medium">
                Recent Visitors
              </Typography>
              <Button 
                variant="text" 
                color="primary" 
                size="small"
                onClick={() => router.push('/visitors')}
              >
                View All
              </Button>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Purpose</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentVisitors.length > 0 ? (
                    recentVisitors.map((visitor) => (
                      <TableRow key={visitor.id} hover>
                        <TableCell>{formatDate(visitor.createdAt)}</TableCell>
                        <TableCell>{visitor.name}</TableCell>
                        <TableCell>{visitor.phone}</TableCell>
                        <TableCell>{visitor.purpose}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">No recent visitors</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
} 