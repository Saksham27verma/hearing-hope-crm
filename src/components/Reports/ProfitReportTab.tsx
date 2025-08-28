'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  TextField,
  Button,
  CircularProgress,
  Chip,
} from '@mui/material';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip } from 'recharts';

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

interface ManufacturerIncentive {
  id?: string;
  company: string;
  manufacturer: string;
  month: string;
  amount: number;
  description?: string;
  createdAt?: Timestamp;
}

interface EmployeeExpense {
  id?: string;
  employeeId: string;
  employeeName: string;
  expenseType: 'commission' | 'incentive' | 'salary' | 'other';
  month: string;
  amount: number;
  description?: string;
  createdAt?: Timestamp;
}

interface ProfitSummary {
  grossSales: number;
  costOfGoods: number;
  basicProfit: number;
  manufacturerIncentives: number;
  grossProfit: number;
  employeeExpenses: number;
  netProfit: number;
}

export default function ProfitReportTab() {
  const [loading, setLoading] = useState(true);
  const [incentivesData, setIncentivesData] = useState<ManufacturerIncentive[]>([]);
  const [employeeExpensesData, setEmployeeExpensesData] = useState<EmployeeExpense[]>([]);
  const [profitSummary, setProfitSummary] = useState<ProfitSummary>({
    grossSales: 0,
    costOfGoods: 0,
    basicProfit: 0,
    manufacturerIncentives: 0,
    grossProfit: 0,
    employeeExpenses: 0,
    netProfit: 0
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );

  // Fetch profit data for selected month
  const fetchProfitData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Mock data for demo - In a real app, fetch from Firestore
      setProfitSummary({
        grossSales: 350000,
        costOfGoods: 215000,
        basicProfit: 135000,
        manufacturerIncentives: 45000,
        grossProfit: 180000,
        employeeExpenses: 75000,
        netProfit: 105000
      });
      
      // Fetch manufacturer incentives for the month
      const incentivesQuery = query(
        collection(db, 'manufacturerIncentives'), 
        where('month', '==', selectedMonth)
      );
      const incentivesSnapshot = await getDocs(incentivesQuery);
      const incentivesData = incentivesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ManufacturerIncentive[];
      
      // Fetch employee expenses for the month
      const expensesQuery = query(
        collection(db, 'employeeExpenses'), 
        where('month', '==', selectedMonth)
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      const expensesData = expensesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as EmployeeExpense[];
      
      setIncentivesData(incentivesData);
      setEmployeeExpensesData(expensesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profit data:', error);
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchProfitData();
  }, [fetchProfitData]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={3} mb={4}>
        <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 8' } }}>
          <Box mb={2} display="flex" alignItems="center" gap={2}>
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
              onClick={() => fetchProfitData()}
            >
              Update Report
            </Button>
          </Box>
          
          <Typography variant="h6" gutterBottom>
            Profit Summary for {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Typography>
          
          <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell><strong>Gross Sales</strong></TableCell>
                  <TableCell align="right">{formatCurrency(profitSummary.grossSales)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Cost of Goods</strong></TableCell>
                  <TableCell align="right">{formatCurrency(profitSummary.costOfGoods)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Basic Profit</strong></TableCell>
                  <TableCell align="right">{formatCurrency(profitSummary.basicProfit)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Manufacturer Incentives</strong></TableCell>
                  <TableCell align="right">{formatCurrency(profitSummary.manufacturerIncentives)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Gross Profit</strong></TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    {formatCurrency(profitSummary.grossProfit)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Employee Expenses</strong></TableCell>
                  <TableCell align="right">{formatCurrency(profitSummary.employeeExpenses)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Net Profit</strong></TableCell>
                  <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                    {formatCurrency(profitSummary.netProfit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        
        <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 4' } }}>
          <Card elevation={0} variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Profit Breakdown
              </Typography>
              
              <Box height={250}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Cost of Goods', value: profitSummary.costOfGoods },
                        { name: 'Basic Profit', value: profitSummary.basicProfit },
                        { name: 'Manufacturer Incentives', value: profitSummary.manufacturerIncentives },
                        { name: 'Employee Expenses', value: profitSummary.employeeExpenses },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell key="cell-0" fill="#f44336" />
                      <Cell key="cell-1" fill="#4caf50" />
                      <Cell key="cell-2" fill="#2196f3" />
                      <Cell key="cell-3" fill="#ff9800" />
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
} 