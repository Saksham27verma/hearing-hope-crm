'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Define interfaces for our data types
interface SalesGSTItem {
  id: string;
  date: Date;
  customerName: string;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  total: number;
}

interface PurchaseGSTItem {
  id: string;
  date: Date;
  vendorName: string;
  subtotal: number;
  gstPercentage: number;
  gstAmount: number;
  total: number;
}

interface GSTSummary {
  totalCollected: number;
  totalPaid: number;
  netGST: number;
}

interface GSTData {
  salesGST: SalesGSTItem[];
  purchaseGST: PurchaseGSTItem[];
  summary: GSTSummary;
}

export default function GSTReportTab() {
  const [loading, setLoading] = useState(true);
  const [gstData, setGstData] = useState<GSTData>({
    salesGST: [],
    purchaseGST: [],
    summary: {
      totalCollected: 0,
      totalPaid: 0,
      netGST: 0
    }
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );

  const fetchGSTData = useCallback(async () => {
    setLoading(true);
    try {
      // Month boundaries
      const start = new Date(`${selectedMonth}-01T00:00:00`);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      // Fetch sales + purchases within month
      const [salesSnap, purchasesSnap, enquiriesSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'sales'),
            where('saleDate', '>=', Timestamp.fromDate(start)),
            where('saleDate', '<', Timestamp.fromDate(end))
          )
        ),
        getDocs(
          query(
            collection(db, 'purchases'),
            where('purchaseDate', '>=', Timestamp.fromDate(start)),
            where('purchaseDate', '<', Timestamp.fromDate(end))
          )
        ),
        // Enquiry sale dates are stored as strings in visits, so we fetch and filter client-side
        getDocs(collection(db, 'enquiries')),
      ]);

      const salesGST: SalesGSTItem[] = [];

      // Sales collection
      salesSnap.docs.forEach((docSnap) => {
        const data: any = docSnap.data();
        const ts: Timestamp | undefined = data.saleDate;
        const date = ts?.toDate ? ts.toDate() : start;
        const subtotal = Number(data.totalAmount || 0);
        const gstAmount = Number(data.gstAmount || 0);
        const total = subtotal + gstAmount;
        const gstPercentage = Number(data.gstPercentage || (subtotal ? (gstAmount * 100) / subtotal : 0));
        salesGST.push({
          id: docSnap.id,
          date,
          customerName: (data.patientName || '—').toString(),
          subtotal,
          gstPercentage,
          gstAmount,
          total,
        });
      });

      // Enquiries (sales recorded in visits)
      enquiriesSnap.docs.forEach((docSnap) => {
        const e: any = docSnap.data();
        const visits: any[] = Array.isArray(e.visits) ? e.visits : [];
        const customerName = (e.name || e.patientName || e.fullName || '—').toString();
        visits.forEach((visit: any, idx: number) => {
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

          const dateStr: string = visit.purchaseDate || visit.hearingAidPurchaseDate || visit.visitDate || '';
          const date = dateStr ? new Date(dateStr) : (e.updatedAt?.toDate ? e.updatedAt.toDate() : start);
          if (Number.isNaN(date.getTime())) return;
          if (date < start || date >= end) return;

          const products: any[] = Array.isArray(visit.products) ? visit.products : [];
          const subtotal =
            Number(visit.grossSalesBeforeTax || 0) ||
            products.reduce((sum, p) => sum + Number(p.sellingPrice || 0), 0);
          const gstAmount =
            Number(visit.taxAmount || 0) ||
            products.reduce((sum, p) => sum + Number(p.gstAmount || 0), 0);
          const total =
            Number(visit.salesAfterTax || 0) ||
            products.reduce((sum, p) => sum + Number(p.finalAmount || 0), 0);
          const gstPercentage = subtotal ? (gstAmount * 100) / subtotal : 0;

          salesGST.push({
            id: `ENQ-${docSnap.id}-V${visit.id || idx}`,
            date,
            customerName,
            subtotal,
            gstPercentage,
            gstAmount,
            total,
          });
        });
      });

      salesGST.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Purchases (Input tax)
      const purchaseGST: PurchaseGSTItem[] = purchasesSnap.docs.map((docSnap) => {
        const data: any = docSnap.data();
        const ts: Timestamp | undefined = data.purchaseDate;
        const date = ts?.toDate ? ts.toDate() : start;
        const subtotal = Number(data.totalAmount || 0);
        const gstType = (data.gstType || '').toString();
        const gstPercentage = gstType === 'GST Exempted' ? 0 : Number(data.gstPercentage || 0);
        const gstAmount = gstType === 'GST Exempted' ? 0 : (subtotal * gstPercentage) / 100;
        const total = subtotal + gstAmount;
        return {
          id: data.invoiceNo || docSnap.id,
          date,
          vendorName: (data.party?.name || '—').toString(),
          subtotal,
          gstPercentage,
          gstAmount,
          total,
        };
      });

      const totalCollected = salesGST.reduce((sum, item) => sum + item.gstAmount, 0);
      const totalPaid = purchaseGST.reduce((sum, item) => sum + item.gstAmount, 0);

      setGstData({
        salesGST,
        purchaseGST,
        summary: {
          totalCollected,
          totalPaid,
          netGST: totalCollected - totalPaid,
        },
      });
    } catch (error) {
      console.error('Error fetching GST data:', error);
      setGstData({
        salesGST: [],
        purchaseGST: [],
        summary: { totalCollected: 0, totalPaid: 0, netGST: 0 },
      });
    }
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    fetchGSTData();
  }, [fetchGSTData]);

  // Chart data for GST summary
  const gstSummaryData = [
    { name: 'GST Collected', value: gstData.summary.totalCollected },
    { name: 'GST Paid', value: gstData.summary.totalPaid },
    { name: 'Net GST', value: Math.abs(gstData.summary.netGST) }
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Month Selector */}
      <Box mb={3} display="flex" alignItems="center" gap={2}>
        <TextField
          label="Month"
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          size="small"
          sx={{ width: 200 }}
          InputLabelProps={{ shrink: true }}
        />
        <Button 
          variant="outlined" 
          color="primary"
          onClick={() => fetchGSTData()}
          disabled={loading}
        >
          Update Report
        </Button>
      </Box>
      
      {/* GST Summary */}
      <Grid container spacing={3} mb={3}>
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 8' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={3}>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
                <Typography variant="subtitle1" gutterBottom>GST Collected</Typography>
                <Typography variant="h5" color="success.main">
                  {formatCurrency(gstData.summary.totalCollected)}
                </Typography>
              </Grid>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
                <Typography variant="subtitle1" gutterBottom>GST Paid</Typography>
                <Typography variant="h5" color="error.main">
                  {formatCurrency(gstData.summary.totalPaid)}
                </Typography>
              </Grid>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
                <Typography variant="subtitle1" gutterBottom>Net GST (Payable/Refund)</Typography>
                <Typography 
                  variant="h5" 
                  color={gstData.summary.netGST >= 0 ? 'primary.main' : 'secondary.main'}
                >
                  {formatCurrency(gstData.summary.netGST)}
                </Typography>
                <Typography variant="caption">
                  {gstData.summary.netGST >= 0 ? 'Payable to Government' : 'Refund from Government'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 4' } }}>
          <Paper elevation={0} variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>GST Summary</Typography>
            <Box height={150}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={gstSummaryData}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* GST Collected (Output Tax) */}
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
        GST Collected (Output Tax)
      </Typography>
      <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Invoice ID</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">GST %</TableCell>
              <TableCell align="right">GST Amount</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {gstData.salesGST.length > 0 ? (
              gstData.salesGST.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.date.toLocaleDateString()}</TableCell>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.customerName}</TableCell>
                  <TableCell align="right">{formatCurrency(item.subtotal)}</TableCell>
                  <TableCell align="right">{item.gstPercentage}%</TableCell>
                  <TableCell align="right">{formatCurrency(item.gstAmount)}</TableCell>
                  <TableCell align="right">{formatCurrency(item.total)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No GST collected for this period
                </TableCell>
              </TableRow>
            )}
            {gstData.salesGST.length > 0 && (
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={5}><strong>Total</strong></TableCell>
                <TableCell align="right"><strong>{formatCurrency(gstData.summary.totalCollected)}</strong></TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(gstData.salesGST.reduce((sum, item) => sum + item.total, 0))}</strong>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* GST Paid (Input Tax) */}
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 3 }}>
        GST Paid (Input Tax)
      </Typography>
      <TableContainer component={Paper} elevation={0} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Invoice ID</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell align="right">Subtotal</TableCell>
              <TableCell align="right">GST %</TableCell>
              <TableCell align="right">GST Amount</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {gstData.purchaseGST.length > 0 ? (
              gstData.purchaseGST.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.date.toLocaleDateString()}</TableCell>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.vendorName}</TableCell>
                  <TableCell align="right">{formatCurrency(item.subtotal)}</TableCell>
                  <TableCell align="right">{item.gstPercentage}%</TableCell>
                  <TableCell align="right">{formatCurrency(item.gstAmount)}</TableCell>
                  <TableCell align="right">{formatCurrency(item.total)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No GST paid for this period
                </TableCell>
              </TableRow>
            )}
            {gstData.purchaseGST.length > 0 && (
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell colSpan={5}><strong>Total</strong></TableCell>
                <TableCell align="right"><strong>{formatCurrency(gstData.summary.totalPaid)}</strong></TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(gstData.purchaseGST.reduce((sum, item) => sum + item.total, 0))}</strong>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
} 