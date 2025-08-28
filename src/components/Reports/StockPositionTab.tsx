'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

export default function StockPositionTab() {
  const [loading, setLoading] = useState(true);
  const [stockData, setStockData] = useState<any[]>([]);
  const [filter, setFilter] = useState({
    productType: '',
    company: '',
    dateRange: {
      startDate: null,
      endDate: null
    }
  });

  const fetchStockData = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate API call
      setTimeout(() => {
        // Sample data
        const mockStockData = [
          {
            serialNumber: 'SN001234',
            productName: 'Hearing Aid Pro X3',
            productType: 'Hearing Aid',
            company: 'Siemens',
            status: 'In Stock',
            purchaseDate: new Date('2023-11-15'),
            salesDate: null,
            dealerPrice: 29000,
            mrp: 45000,
            sellingPrice: null
          },
          {
            serialNumber: 'SN002345',
            productName: 'Phonak Audéo Paradise',
            productType: 'Hearing Aid',
            company: 'Phonak',
            status: 'Sold',
            purchaseDate: new Date('2023-10-12'),
            salesDate: new Date('2023-12-05'),
            dealerPrice: 40000,
            mrp: 62000,
            sellingPrice: 58000
          },
          {
            serialNumber: 'SN003456',
            productName: 'Sound Amplifier Mini',
            productType: 'Hearing Aid',
            company: 'ReSound',
            status: 'In Stock',
            purchaseDate: new Date('2024-01-20'),
            salesDate: null,
            dealerPrice: 7500,
            mrp: 15000,
            sellingPrice: null
          }
        ];
        
        setStockData(mockStockData);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // Get unique product types and companies for filters
  const productTypes = [...new Set(stockData.map(item => item.productType))];
  const companies = [...new Set(stockData.map(item => item.company))];
  
  // Calculate summary statistics
  const totalItems = stockData.length;
  const itemsInStock = stockData.filter(item => item.status === 'In Stock').length;
  const itemsSold = stockData.filter(item => item.status === 'Sold').length;
  
  const inventoryValue = stockData
    .filter(item => item.status === 'In Stock')
    .reduce((sum, item) => sum + item.dealerPrice, 0);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Filter Controls */}
      <Paper elevation={0} variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Product Type</InputLabel>
              <Select
                value={filter.productType}
                label="Product Type"
                onChange={(e) => setFilter({...filter, productType: e.target.value})}
              >
                <MenuItem value="">All Types</MenuItem>
                {productTypes.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
            <FormControl fullWidth size="small">
              <InputLabel>Company</InputLabel>
              <Select
                value={filter.company}
                label="Company"
                onChange={(e) => setFilter({...filter, company: e.target.value})}
              >
                <MenuItem value="">All Companies</MenuItem>
                {companies.map(company => (
                  <MenuItem key={company} value={company}>{company}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box display="flex" gap={1}>
                <DatePicker
                  label="Start Date"
                  value={filter.dateRange.startDate}
                  onChange={(date) => setFilter({
                    ...filter, 
                    dateRange: {...filter.dateRange, startDate: date}
                  })}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DatePicker
                  label="End Date"
                  value={filter.dateRange.endDate}
                  onChange={(date) => setFilter({
                    ...filter, 
                    dateRange: {...filter.dateRange, endDate: date}
                  })}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </Box>
            </LocalizationProvider>
          </Grid>
          
          <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 2' } }}>
            <Button 
              variant="contained" 
              fullWidth
              onClick={() => fetchStockData()}
              disabled={loading}
            >
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Summary Statistics */}
      <Grid container spacing={3} mb={3}>
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Total Items</Typography>
            <Typography variant="h4">{totalItems}</Typography>
          </Paper>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>In Stock</Typography>
            <Typography variant="h4" color="success.main">{itemsInStock}</Typography>
          </Paper>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Sold</Typography>
            <Typography variant="h4" color="primary.main">{itemsSold}</Typography>
          </Paper>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 3' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Inventory Value</Typography>
            <Typography variant="h4" color="secondary.main">{formatCurrency(inventoryValue)}</Typography>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Stock Data Table */}
      <TableContainer component={Paper} elevation={0} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Serial Number</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Company</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Dealer Price</TableCell>
              <TableCell align="right">MRP</TableCell>
              <TableCell align="right">Selling Price</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stockData.map((item) => (
              <TableRow key={item.serialNumber} hover>
                <TableCell>{item.serialNumber}</TableCell>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.productType}</TableCell>
                <TableCell>{item.company}</TableCell>
                <TableCell>
                  <Chip 
                    label={item.status} 
                    color={item.status === 'In Stock' ? 'success' : 'primary'} 
                    size="small" 
                    variant="outlined" 
                  />
                </TableCell>
                <TableCell align="right">{formatCurrency(item.dealerPrice)}</TableCell>
                <TableCell align="right">{formatCurrency(item.mrp)}</TableCell>
                <TableCell align="right">
                  {item.sellingPrice ? formatCurrency(item.sellingPrice) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
} 