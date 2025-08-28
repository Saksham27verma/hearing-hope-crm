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
import { useOptimizedDashboard, useOptimizedCollection } from '@/hooks/useOptimizedFirebase';

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
  
  // Use optimized hooks for better performance
  const { stats, loading: statsLoading, error: statsError, refresh: refreshStats } = useOptimizedDashboard();
  
  const { 
    data: recentSales, 
    loading: salesLoading 
  } = useOptimizedCollection('sales', {
    cacheKey: 'recent_sales',
    cacheTTL: 2 * 60 * 1000, // 2 minutes for recent data
    orderByField: 'saleDate',
    orderDirection: 'desc',
    enablePagination: true,
    pageSize: 5
  });

  const { 
    data: recentVisitors, 
    loading: visitorsLoading 
  } = useOptimizedCollection('visitors', {
    cacheKey: 'recent_visitors',
    cacheTTL: 2 * 60 * 1000, // 2 minutes for recent data
    orderByField: 'createdAt',
    orderDirection: 'desc',
    enablePagination: true,
    pageSize: 5
  });

  const loading = statsLoading || salesLoading || visitorsLoading;

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