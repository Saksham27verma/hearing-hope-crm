'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Stack,
} from '@mui/material';
import { PrintOutlined as PrintIcon } from '@mui/icons-material';
import { collection, getDocs, doc, getDoc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

// Define Staff interface
interface Staff {
  id?: string;
  name: string;
  staffNumber: string;
  email: string;
  phone: string;
  joiningDate: Timestamp;
  jobRole: string;
  department: string;
  basicSalary: number;
  hra: number;
  status: 'active' | 'inactive';
}

// Define Salary interface
interface Salary {
  id?: string;
  staffId: string;
  month: string; // Format: YYYY-MM
  basicSalary: number;
  hra: number;
  travelAllowance: number;
  festivalAdvance: number;
  generalAdvance: number;
  deductions: number;
  incentives: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  isPaid: boolean;
  paidDate?: Timestamp;
  remarks?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export default function SalarySlipPage({ params }: { params: { id: string } }) {
  const { user, isAllowedModule } = useAuth();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    if (isAllowedModule('staff')) {
      fetchStaffAndSalary();
    } else {
      setLoading(false);
      setError('You do not have permission to access this page');
    }
  }, [user, params.id, isAllowedModule]);

  const fetchStaffAndSalary = async () => {
    try {
      setLoading(true);
      
      // Fetch staff data
      const staffDoc = await getDoc(doc(db, 'staff', params.id));
      if (!staffDoc.exists()) {
        setError('Staff not found');
        setLoading(false);
        return;
      }
      
      const staffData = { id: staffDoc.id, ...staffDoc.data() } as Staff;
      setStaff(staffData);
      
      // Fetch the most recent salary for this staff
      const salaryCollection = collection(db, 'salaries');
      const salaryQuery = query(
        salaryCollection,
        where('staffId', '==', params.id),
        orderBy('month', 'desc'),
        limit(1)
      );
      
      const salarySnapshot = await getDocs(salaryQuery);
      
      if (salarySnapshot.empty) {
        setError('No salary records found for this staff member');
        setLoading(false);
        return;
      }
      
      const salaryData = { 
        id: salarySnapshot.docs[0].id, 
        ...salarySnapshot.docs[0].data() 
      } as Salary;
      
      setSalary(salaryData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching staff and salary:', error);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format date for display
  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'N/A';
    return format(new Date(timestamp.seconds * 1000), 'dd MMM yyyy');
  };

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, 'MMMM yyyy');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (error || !staff || !salary) {
    return (
      <Box textAlign="center" p={4}>
        <Typography variant="h5" color="error" gutterBottom>
          {error || 'Data not available'}
        </Typography>
        <Button 
          variant="outlined" 
          color="primary" 
          href="/staff"
          sx={{ mt: 2 }}
        >
          Return to Staff List
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3} className="salary-slip-container">
      {/* Print button - only visible on screen */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          mb: 2,
          '@media print': {
            display: 'none'
          }
        }}
      >
        <Button
          variant="contained"
          color="primary"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
        >
          Print Salary Slip
        </Button>
      </Box>
      
      {/* Salary Slip */}
      <Paper 
        elevation={1} 
        sx={{ 
          p: 3, 
          maxWidth: '800px', 
          mx: 'auto',
          '@media print': {
            boxShadow: 'none',
            p: 0
          }
        }}
      >
        {/* Header */}
        <Box 
          sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            alignItems: { xs: 'flex-start', sm: 'center' },
            mb: 3
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Hearing Hope Center
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Salary Slip
            </Typography>
          </Box>
          
          <Box sx={{ mt: { xs: 2, sm: 0 } }}>
            <Typography variant="body1" fontWeight="medium">
              For the month of {formatMonth(salary.month)}
            </Typography>
            {salary.isPaid && salary.paidDate && (
              <Typography variant="body2" color="success.main">
                Paid on: {formatDate(salary.paidDate)}
              </Typography>
            )}
          </Box>
        </Box>
        
        <Divider sx={{ mb: 3 }} />
        
        {/* Employee Details */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Employee Details
          </Typography>
          
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 2
          }}>
            <Stack spacing={1}>
              <Box>
                <Typography variant="body2" color="text.secondary">Name</Typography>
                <Typography variant="body1">{staff.name}</Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">Employee ID</Typography>
                <Typography variant="body1">{staff.staffNumber}</Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">Department</Typography>
                <Typography variant="body1">{staff.department}</Typography>
              </Box>
            </Stack>
            
            <Stack spacing={1}>
              <Box>
                <Typography variant="body2" color="text.secondary">Designation</Typography>
                <Typography variant="body1">{staff.jobRole}</Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">Joining Date</Typography>
                <Typography variant="body1">{formatDate(staff.joiningDate)}</Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">Email</Typography>
                <Typography variant="body1">{staff.email || 'N/A'}</Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
        
        {/* Salary Details */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Salary Details
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell width="40%"><Typography fontWeight="bold">Earnings</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Amount</Typography></TableCell>
                  <TableCell width="40%"><Typography fontWeight="bold">Deductions</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">Amount</Typography></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Basic Salary</TableCell>
                  <TableCell align="right">{formatCurrency(salary.basicSalary)}</TableCell>
                  <TableCell>Festival Advance</TableCell>
                  <TableCell align="right">{formatCurrency(salary.festivalAdvance)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>HRA</TableCell>
                  <TableCell align="right">{formatCurrency(salary.hra)}</TableCell>
                  <TableCell>General Advance</TableCell>
                  <TableCell align="right">{formatCurrency(salary.generalAdvance)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Travel Allowance</TableCell>
                  <TableCell align="right">{formatCurrency(salary.travelAllowance)}</TableCell>
                  <TableCell>Other Deductions</TableCell>
                  <TableCell align="right">{formatCurrency(salary.deductions)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Incentives</TableCell>
                  <TableCell align="right">{formatCurrency(salary.incentives)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell align="right"></TableCell>
                </TableRow>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell><Typography fontWeight="bold">Total Earnings</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">{formatCurrency(salary.totalEarnings)}</Typography></TableCell>
                  <TableCell><Typography fontWeight="bold">Total Deductions</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight="bold">{formatCurrency(salary.totalDeductions)}</Typography></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        
        {/* Net Salary */}
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            p: 2,
            backgroundColor: '#f8f9fa',
            borderRadius: 1,
            mb: 3
          }}
        >
          <Typography variant="h6" fontWeight="bold">
            Net Salary:
          </Typography>
          <Typography variant="h6" fontWeight="bold" color="primary.main">
            {formatCurrency(salary.netSalary)}
          </Typography>
        </Box>
        
        {/* Remarks */}
        {salary.remarks && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Remarks:
            </Typography>
            <Typography variant="body2">
              {salary.remarks}
            </Typography>
          </Box>
        )}
        
        {/* Footer */}
        <Box 
          sx={{ 
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            mt: 6,
            pt: 2
          }}
        >
          <Box sx={{ textAlign: 'center', flex: 1 }}>
            <Divider sx={{ width: '80%', mx: 'auto', mb: 1 }} />
            <Typography variant="body2">Employee Signature</Typography>
          </Box>
          
          <Box sx={{ textAlign: 'center', flex: 1, mt: { xs: 4, sm: 0 } }}>
            <Divider sx={{ width: '80%', mx: 'auto', mb: 1 }} />
            <Typography variant="body2">Authorized Signature</Typography>
          </Box>
        </Box>
        
        <Typography 
          variant="caption" 
          color="text.secondary" 
          align="center" 
          sx={{ 
            display: 'block', 
            mt: 4,
            '@media print': { mt: 8 }
          }}
        >
          This is a computer-generated document. No signature is required.
        </Typography>
      </Paper>
    </Box>
  );
} 