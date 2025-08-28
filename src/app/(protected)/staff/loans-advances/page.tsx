'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Tab,
  Tabs,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Dialog,
  DialogContent,
  CircularProgress,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  CalendarToday as CalendarIcon,
  Payment as PaymentIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  LocalAtm as LoanIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, Timestamp, query, where, orderBy } from 'firebase/firestore';
import { format, isAfter, isBefore, startOfMonth, endOfMonth } from 'date-fns';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import LoanForm from './LoanForm';
import PaymentForm from './PaymentForm';

// Define interfaces
interface Staff {
  id?: string;
  name: string;
  email: string;
  phone: string;
  joiningDate: Timestamp;
  jobRole: string;
  basicSalary: number;
  status: 'active' | 'inactive';
}

interface LoanAdvance {
  id?: string;
  staffId: string;
  type: 'loan' | 'advance';
  amount: number;
  interestRate: number;
  emiAmount: number;
  totalAmount: number;
  issueDate: Timestamp;
  startDeductionDate: Timestamp;
  endDate?: Timestamp;
  reason: string;
  status: 'active' | 'completed' | 'cancelled';
  remainingAmount: number;
  monthlyDeduction: number;
  numberOfInstallments: number;
  completedInstallments: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface Payment {
  id?: string;
  loanAdvanceId: string;
  staffId: string;
  amount: number;
  paymentDate: Timestamp;
  month: string; // Format: YYYY-MM
  deductedFromSalary: boolean;
  remarks?: string;
}

// Main component
export default function LoansAdvancesPage() {
  // State
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loans, setLoans] = useState<LoanAdvance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  
  // Dialog states
  const [openLoanDialog, setOpenLoanDialog] = useState(false);
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanAdvance | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Auth context
  const { userProfile } = useAuth();
  
  // Fetch staff data
  const fetchStaff = useCallback(async () => {
    try {
      const staffQuery = query(collection(db, 'staff'), where('status', '==', 'active'));
      const staffSnapshot = await getDocs(staffQuery);
      const staffData = staffSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Staff[];
      
      setStaff(staffData);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  }, []);
  
  // Fetch loans and advances
  const fetchLoans = useCallback(async () => {
    try {
      const loansQuery = query(collection(db, 'loans_advances'), orderBy('issueDate', 'desc'));
      const loansSnapshot = await getDocs(loansQuery);
      const loansData = loansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoanAdvance[];
      
      setLoans(loansData);
    } catch (error) {
      console.error('Error fetching loans:', error);
    }
  }, []);
  
  // Fetch payments
  const fetchPayments = useCallback(async () => {
    try {
      const paymentsQuery = query(collection(db, 'loan_payments'), orderBy('paymentDate', 'desc'));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData = paymentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payment[];
      
      setPayments(paymentsData);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  }, []);
  
  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStaff(), fetchLoans(), fetchPayments()]);
      setLoading(false);
    };
    
    loadData();
  }, [fetchStaff, fetchLoans, fetchPayments]);
  
  // Filter loans
  const filteredLoans = loans.filter(loan => {
    // Filter by search term (staff name or loan ID)
    const staffMember = staff.find(s => s.id === loan.staffId);
    const staffName = staffMember?.name?.toLowerCase() || '';
    const searchMatch = 
      staffName.includes(searchTerm.toLowerCase()) || 
      loan.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.reason.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filter by staff
    const staffMatch = selectedStaffId === 'all' || loan.staffId === selectedStaffId;
    
    // Filter by status
    const statusMatch = statusFilter === 'all' || loan.status === statusFilter;
    
    // Filter by type
    const typeMatch = typeFilter === 'all' || loan.type === typeFilter;
    
    // Filter by date
    const dateMatch = (
      !dateRange.start || 
      !dateRange.end || 
      (loan.issueDate && 
        isAfter(new Date(loan.issueDate.seconds * 1000), dateRange.start) && 
        isBefore(new Date(loan.issueDate.seconds * 1000), dateRange.end))
    );
    
    return searchMatch && staffMatch && statusMatch && typeMatch && dateMatch;
  });
  
  // Pagination handling
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Dialog handlers
  const handleOpenLoanDialog = (staff?: Staff) => {
    setSelectedStaff(staff || null);
    setSelectedLoan(null);
    setOpenLoanDialog(true);
  };
  
  const handleOpenEditLoanDialog = (loan: LoanAdvance) => {
    setSelectedLoan(loan);
    setSelectedStaff(staff.find(s => s.id === loan.staffId) || null);
    setOpenLoanDialog(true);
  };
  
  const handleOpenPaymentDialog = (loan: LoanAdvance) => {
    setSelectedLoan(loan);
    setSelectedStaff(staff.find(s => s.id === loan.staffId) || null);
    setOpenPaymentDialog(true);
  };
  
  const handleCloseLoanDialog = () => {
    setOpenLoanDialog(false);
  };
  
  const handleClosePaymentDialog = () => {
    setOpenPaymentDialog(false);
  };
  
  // Save handlers
  const handleSaveLoan = async (loanData: LoanAdvance) => {
    try {
      setLoading(true);
      
      if (loanData.id) {
        // Update existing loan
        await updateDoc(doc(db, 'loans_advances', loanData.id), {
          ...loanData,
          updatedAt: Timestamp.now()
        });
      } else {
        // Add new loan
        await addDoc(collection(db, 'loans_advances'), {
          ...loanData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }
      
      // Refresh data
      await fetchLoans();
      setOpenLoanDialog(false);
      setLoading(false);
    } catch (error) {
      console.error('Error saving loan:', error);
      setLoading(false);
    }
  };
  
  const handleSavePayment = async (paymentData: Payment) => {
    try {
      if (!selectedLoan || !selectedLoan.id) return;
      
      setLoading(true);
      
      // Add payment record
      await addDoc(collection(db, 'loan_payments'), {
        ...paymentData,
        createdAt: Timestamp.now()
      });
      
      // Update loan remaining amount
      const updatedLoan = {
        ...selectedLoan,
        remainingAmount: selectedLoan.remainingAmount - paymentData.amount,
        completedInstallments: selectedLoan.completedInstallments + 1,
        status: selectedLoan.remainingAmount - paymentData.amount <= 0 ? 'completed' : 'active'
      };
      
      await updateDoc(doc(db, 'loans_advances', selectedLoan.id), updatedLoan);
      
      // Refresh data
      await Promise.all([fetchLoans(), fetchPayments()]);
      setOpenPaymentDialog(false);
      setLoading(false);
    } catch (error) {
      console.error('Error recording payment:', error);
      setLoading(false);
    }
  };
  
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
    return format(new Date(timestamp.seconds * 1000), 'dd MMM yyyy');
  };
  
  // Get staff name
  const getStaffName = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember?.name || 'Unknown';
  };
  
  // Get loan payments
  const getLoanPayments = (loanId: string) => {
    return payments.filter(p => p.loanAdvanceId === loanId);
  };
  
  if (loading && loans.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" mb={1}>
          Staff Loans & Advances
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Manage staff loans, advances, and repayment schedules
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={48} color="primary" />
        </Box>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" mb={1}>
        Staff Loans & Advances
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Manage staff loans, advances, and repayment schedules
      </Typography>
      
      {/* Filters and Actions */}
      <Paper 
        elevation={0}
        variant="outlined"
        sx={{ p: 2, mb: 3, borderRadius: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}
      >
        <TextField
          placeholder="Search staff or loan ID"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flexGrow: 1, minWidth: '200px' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        
        <FormControl size="small" sx={{ minWidth: '150px' }}>
          <InputLabel>Staff</InputLabel>
          <Select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            label="Staff"
          >
            <MenuItem value="all">All Staff</MenuItem>
            {staff.map((staffMember) => (
              <MenuItem key={staffMember.id} value={staffMember.id}>
                {staffMember.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: '120px' }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            label="Type"
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="loan">Loans</MenuItem>
            <MenuItem value="advance">Advances</MenuItem>
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: '120px' }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Status"
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>
        
        <Box sx={{ flexGrow: 1 }} />
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => handleOpenLoanDialog()}
          sx={{ borderRadius: 1.5 }}
        >
          New Loan/Advance
        </Button>
      </Paper>
      
      {/* Loans Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <Table sx={{ minWidth: 650 }} size="medium">
          <TableHead>
            <TableRow>
              <TableCell>Staff</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Issue Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Remaining</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLoans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  <Typography variant="body1" color="text.secondary">
                    No loans or advances found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredLoans
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((loan) => (
                  <TableRow key={loan.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {getStaffName(loan.staffId)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={loan.type === 'loan' ? 'Loan' : 'Advance'} 
                        color={loan.type === 'loan' ? 'primary' : 'secondary'}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatCurrency(loan.amount)}
                      </Typography>
                      {loan.type === 'loan' && loan.interestRate > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          {loan.interestRate}% interest
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {loan.issueDate && formatDate(loan.issueDate)}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={loan.status} 
                        color={
                          loan.status === 'active' ? 'info' : 
                          loan.status === 'completed' ? 'success' : 
                          'default'
                        }
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      {loan.status === 'active' ? (
                        <Typography variant="body2" fontWeight="medium" color="error.main">
                          {formatCurrency(loan.remainingAmount)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {loan.status === 'completed' ? 'Paid' : 'Cancelled'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        {loan.status === 'active' && (
                          <Tooltip title="Record Payment">
                            <IconButton 
                              size="small"
                              color="success"
                              onClick={() => handleOpenPaymentDialog(loan)}
                            >
                              <PaymentIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Edit">
                          <IconButton 
                            size="small"
                            color="primary"
                            onClick={() => handleOpenEditLoanDialog(loan)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredLoans.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
      
      {/* Dialogs */}
      <Dialog
        open={openLoanDialog}
        onClose={handleCloseLoanDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 3 }}>
          <IconButton
            onClick={handleCloseLoanDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
          
          <LoanForm
            staff={staff}
            initialData={selectedLoan || undefined}
            selectedStaff={selectedStaff}
            onSave={handleSaveLoan}
            onCancel={handleCloseLoanDialog}
          />
        </DialogContent>
      </Dialog>
      
      <Dialog
        open={openPaymentDialog}
        onClose={handleClosePaymentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogContent sx={{ p: 3 }}>
          <IconButton
            onClick={handleClosePaymentDialog}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
          
          {selectedLoan && selectedStaff && (
            <PaymentForm
              loan={selectedLoan}
              staff={selectedStaff}
              onSave={handleSavePayment}
              onCancel={handleClosePaymentDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
} 