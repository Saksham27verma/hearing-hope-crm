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
import { getHeadOfficeId } from '@/utils/centerUtils';

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
  const [filter, setFilter] = useState<{
    productType: string;
    company: string;
    dateRange: { startDate: Date | null; endDate: Date | null };
  }>({
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
      const headOfficeId = await getHeadOfficeId();

      const [productsSnap, materialInSnap, purchasesSnap, materialsOutSnap, salesSnap, enquiriesSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'materialInward')),
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'materialsOut')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'enquiries')),
      ]);

      const productById = new Map<string, any>();
      productsSnap.docs.forEach((d) => productById.set(d.id, { id: d.id, ...(d.data() as any) }));

      // Track stock transfer IN serials (so we can ignore the corresponding transfer-out and avoid double counting)
      const stockTransferInSerials = new Set<string>();
      materialInSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const supplierName = data.supplier?.name || '';
        if (!supplierName.includes('Stock Transfer from')) return;
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const serialArray: string[] = Array.isArray(prod.serialNumbers)
            ? prod.serialNumbers
            : (prod.serialNumber ? [prod.serialNumber] : []);
          serialArray.forEach((sn: string) => stockTransferInSerials.add(`${productId}|${sn}`));
        });
      });

      // Materials out: reserved/dispatched serials (ignore stock transfers)
      const pendingOutSerials = new Set<string>();
      const dispatchedOutSerials = new Set<string>();
      materialsOutSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const rawStatus = (data.status as string) || '';
        const notes = data.notes || '';
        const reason = data.reason || '';
        const isStockTransfer = notes.includes('Stock Transfer') || reason.includes('Stock Transfer');
        if (isStockTransfer) return;

        const status = rawStatus || 'dispatched';
        if (status === 'returned') return;

        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const serialArray: string[] = Array.isArray(prod.serialNumbers)
            ? prod.serialNumbers
            : (prod.serialNumber ? [prod.serialNumber] : []);
          serialArray.forEach((sn: string) => {
            const key = `${productId}|${sn}`;
            if (!productId || !sn) return;
            if (status === 'pending') pendingOutSerials.add(key);
            else dispatchedOutSerials.add(key);
          });
        });
      });

      // Sold serials (sales collection + enquiry sales)
      const soldSerials = new Set<string>();
      salesSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const serialNumber = prod.serialNumber || '';
          if (productId && serialNumber) soldSerials.add(`${productId}|${serialNumber}`);
        });
      });
      enquiriesSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const visits: any[] = Array.isArray(data.visits) ? data.visits : [];
        visits.forEach((visit: any) => {
          const isSale = !!(
            visit?.hearingAidSale ||
            (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_sale')) ||
            visit?.journeyStage === 'sale' ||
            visit?.hearingAidStatus === 'sold' ||
            (Array.isArray(visit?.products) &&
              visit.products.length > 0 &&
              ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
          );
          if (!isSale) return;
          const products: any[] = Array.isArray(visit.products) ? visit.products : [];
          products.forEach((prod: any) => {
            const productId = prod.productId || prod.id || prod.hearingAidProductId || '';
            const serialNumber = prod.serialNumber || prod.trialSerialNumber || '';
            if (productId && serialNumber) soldSerials.add(`${productId}|${serialNumber}`);
          });
        });
      });

      const items: any[] = [];

      // Material Inward serials (skip stock transfers so we don't double-count moved items)
      materialInSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const supplierName = data.supplier?.name || '';
        if (supplierName.includes('Stock Transfer from')) return;
        const receivedDate = data.receivedDate;
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const productRef = productById.get(productId) || {};
          const productName = prod.name || productRef.name || '';
          const productType = prod.type || productRef.type || '';
          const company = (data.company || productRef.company || '').toString();
          const mrp = Number(prod.mrp ?? productRef.mrp ?? 0);
          const dealerPrice = Number(prod.dealerPrice ?? prod.finalPrice ?? 0);
          const serialArray: string[] = Array.isArray(prod.serialNumbers)
            ? prod.serialNumbers
            : (prod.serialNumber ? [prod.serialNumber] : []);

          serialArray.forEach((sn: string) => {
            const key = `${productId}|${sn}`;
            if (!productId || !sn) return;
            // Exclude dispatched-out items from stock position (same as inventory snapshot)
            if (dispatchedOutSerials.has(key)) return;
            const status = soldSerials.has(key) ? 'Sold' : (pendingOutSerials.has(key) ? 'Reserved' : 'In Stock');
            items.push({
              id: `mi-${docSnap.id}-${key}`,
              serialNumber: sn,
              productName,
              productType,
              company,
              status,
              purchaseDate: receivedDate?.toDate ? receivedDate.toDate() : null,
              dealerPrice,
              mrp,
              quantity: 1,
            });
          });
        });
      });

      // Purchases serials
      purchasesSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const purchaseDate = data.purchaseDate;
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const productRef = productById.get(productId) || {};
          const productName = prod.name || productRef.name || '';
          const productType = prod.type || productRef.type || '';
          const company = (data.company || productRef.company || '').toString();
          const mrp = Number(prod.mrp ?? productRef.mrp ?? 0);
          const dealerPrice = Number(prod.dealerPrice ?? prod.finalPrice ?? 0);
          const serialArray: string[] = Array.isArray(prod.serialNumbers)
            ? prod.serialNumbers
            : (prod.serialNumber ? [prod.serialNumber] : []);

          serialArray.forEach((sn: string) => {
            const key = `${productId}|${sn}`;
            if (!productId || !sn) return;
            if (dispatchedOutSerials.has(key)) return;
            const status = soldSerials.has(key) ? 'Sold' : (pendingOutSerials.has(key) ? 'Reserved' : 'In Stock');
            items.push({
              id: `pur-${docSnap.id}-${key}`,
              serialNumber: sn,
              productName,
              productType,
              company,
              status,
              purchaseDate: purchaseDate?.toDate ? purchaseDate.toDate() : null,
              dealerPrice,
              mrp,
              quantity: 1,
            });
          });
        });
      });

      // Non-serial quantities (overall stock; excludes stock transfers, and subtracts non-serial sales + non-serial materials out)
      const nonSerialInByProduct = new Map<string, { qty: number; lastDate: Date | null; dealerPrice: number; mrp: number; productName: string; productType: string; company: string }>();
      const addNonSerialIn = (productId: string, qty: number, date: Date | null, dealerPrice: number, mrp: number, productName: string, productType: string, company: string) => {
        const prev = nonSerialInByProduct.get(productId) || { qty: 0, lastDate: null, dealerPrice, mrp, productName, productType, company };
        const prevTime = prev.lastDate ? prev.lastDate.getTime() : -1;
        const thisTime = date ? date.getTime() : -1;
        const newer = thisTime >= prevTime;
        nonSerialInByProduct.set(productId, {
          qty: prev.qty + qty,
          lastDate: newer ? date : prev.lastDate,
          dealerPrice: newer ? dealerPrice : prev.dealerPrice,
          mrp: newer ? mrp : prev.mrp,
          productName: prev.productName || productName,
          productType: prev.productType || productType,
          company: prev.company || company,
        });
      };

      materialInSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const supplierName = data.supplier?.name || '';
        if (supplierName.includes('Stock Transfer from')) return;
        const receivedDate = data.receivedDate?.toDate ? data.receivedDate.toDate() : null;
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const productRef = productById.get(productId) || {};
          const serialArray: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
          const hasSerial = serialArray.length > 0;
          if (hasSerial) return;
          const qty = Number(prod.quantity || 0);
          if (!qty) return;
          const productName = prod.name || productRef.name || '';
          const productType = prod.type || productRef.type || '';
          const company = (data.company || productRef.company || '').toString();
          const mrp = Number(prod.mrp ?? productRef.mrp ?? 0);
          const dealerPrice = Number(prod.dealerPrice ?? prod.finalPrice ?? 0);
          addNonSerialIn(productId, qty, receivedDate, dealerPrice, mrp, productName, productType, company);
        });
      });

      purchasesSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const purchaseDate = data.purchaseDate?.toDate ? data.purchaseDate.toDate() : null;
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const productRef = productById.get(productId) || {};
          const serialArray: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
          const hasSerial = serialArray.length > 0;
          if (hasSerial) return;
          const qty = Number(prod.quantity || 0);
          if (!qty) return;
          const productName = prod.name || productRef.name || '';
          const productType = prod.type || productRef.type || '';
          const company = (data.company || productRef.company || '').toString();
          const mrp = Number(prod.mrp ?? productRef.mrp ?? 0);
          const dealerPrice = Number(prod.dealerPrice ?? prod.finalPrice ?? 0);
          addNonSerialIn(productId, qty, purchaseDate, dealerPrice, mrp, productName, productType, company);
        });
      });

      const nonSerialOutByProduct = new Map<string, number>();
      const addNonSerialOut = (productId: string, qty: number) => {
        nonSerialOutByProduct.set(productId, (nonSerialOutByProduct.get(productId) || 0) + qty);
      };

      // Materials out non-serial (ignore stock transfers; ignore returned; treat missing status as dispatched)
      materialsOutSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const notes = data.notes || '';
        const reason = data.reason || '';
        const isStockTransfer = notes.includes('Stock Transfer') || reason.includes('Stock Transfer');
        if (isStockTransfer) return;
        const status = (data.status as string) || 'dispatched';
        if (status === 'returned') return;
        if (status === 'pending') return; // pending shouldn't reduce stock count, it only reserves
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const serialArray: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
          const hasSerial = serialArray.length > 0;
          if (hasSerial) return;
          const qty = Number(prod.quantity || 0);
          if (!qty) return;
          addNonSerialOut(productId, qty);
        });
      });

      // Sales non-serial (sales collection)
      salesSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const serialNumber = (prod.serialNumber || '').toString();
          if (serialNumber && serialNumber !== '-') return;
          const qty = Number(prod.quantity || 1);
          if (!productId || !qty) return;
          addNonSerialOut(productId, qty);
        });
      });

      // Sales non-serial (enquiries)
      enquiriesSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const visits: any[] = Array.isArray(data.visits) ? data.visits : [];
        visits.forEach((visit: any) => {
          const isSale = !!(
            visit?.hearingAidSale ||
            (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_sale')) ||
            visit?.journeyStage === 'sale' ||
            visit?.hearingAidStatus === 'sold' ||
            (Array.isArray(visit?.products) &&
              visit.products.length > 0 &&
              ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
          );
          if (!isSale) return;
          const products: any[] = Array.isArray(visit.products) ? visit.products : [];
          products.forEach((prod: any) => {
            const productId = prod.productId || prod.id || prod.hearingAidProductId || '';
            const serialNumber = (prod.serialNumber || prod.trialSerialNumber || '').toString();
            if (serialNumber && serialNumber !== '-') return;
            const qty = Number(prod.quantity || 1);
            if (!productId || !qty) return;
            addNonSerialOut(productId, qty);
          });
        });
      });

      nonSerialInByProduct.forEach((info, productId) => {
        const outQty = nonSerialOutByProduct.get(productId) || 0;
        const remainingQty = Math.max(0, (info.qty || 0) - outQty);
        if (!remainingQty) return;
        items.push({
          id: `qty-${productId}`,
          serialNumber: '-',
          productName: info.productName,
          productType: info.productType,
          company: info.company,
          status: 'In Stock',
          purchaseDate: info.lastDate,
          dealerPrice: info.dealerPrice,
          mrp: info.mrp,
          quantity: remainingQty,
        });
      });

      setStockData(items);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      setStockData([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStockData();
  }, [fetchStockData]);

  // Get unique product types and companies for filters
  const productTypes = [...new Set(stockData.map(item => item.productType))];
  const companies = [...new Set(stockData.map(item => item.company))];
  
  // Apply filters
  const filteredStock = stockData.filter((item) => {
    if (filter.productType && item.productType !== filter.productType) return false;
    if (filter.company && item.company !== filter.company) return false;
    const d: Date | null = item.purchaseDate instanceof Date ? item.purchaseDate : null;
    if (filter.dateRange.startDate && d && d.getTime() < filter.dateRange.startDate.getTime()) return false;
    if (filter.dateRange.endDate && d && d.getTime() > filter.dateRange.endDate.getTime()) return false;
    return true;
  });
  
  // Calculate summary statistics
  const totalItems = filteredStock.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
  const itemsInStock = filteredStock
    .filter(item => item.status === 'In Stock')
    .reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
  const itemsSold = filteredStock.filter(item => item.status === 'Sold').length;
  const itemsReserved = filteredStock.filter(item => item.status === 'Reserved').length;
  
  const inventoryValue = filteredStock
    .filter(item => item.status === 'In Stock')
    .reduce((sum, item) => sum + (item.dealerPrice || 0) * (item.quantity || 1), 0);

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
                  onChange={(date: Date | null) => setFilter({
                    ...filter, 
                    dateRange: {...filter.dateRange, startDate: date}
                  })}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DatePicker
                  label="End Date"
                  value={filter.dateRange.endDate}
                  onChange={(date: Date | null) => setFilter({
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
            <Typography variant="h6" gutterBottom>Sold / Reserved</Typography>
            <Typography variant="h4" color="primary.main">
              {itemsSold}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Reserved: {itemsReserved}
            </Typography>
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
              <TableCell align="right">Qty</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Dealer Price</TableCell>
              <TableCell align="right">MRP</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredStock.map((item) => (
              <TableRow key={item.id || `${item.productName}-${item.serialNumber}`} hover>
                <TableCell>{item.serialNumber}</TableCell>
                <TableCell>{item.productName}</TableCell>
                <TableCell>{item.productType}</TableCell>
                <TableCell>{item.company}</TableCell>
                <TableCell align="right">{item.quantity || 1}</TableCell>
                <TableCell>
                  <Chip 
                    label={item.status} 
                    color={item.status === 'In Stock' ? 'success' : (item.status === 'Reserved' ? 'warning' : 'primary')} 
                    size="small" 
                    variant="outlined" 
                  />
                </TableCell>
                <TableCell align="right">{formatCurrency(item.dealerPrice)}</TableCell>
                <TableCell align="right">{formatCurrency(item.mrp)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
} 