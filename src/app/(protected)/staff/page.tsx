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
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
  Print as PrintIcon,
  CreditCard as PaymentIcon,
  Badge as BadgeIcon,
  Description as ReportIcon,
  FilterList as FilterIcon,
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
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/context/AuthContext';
import StaffForm from '@/components/staff/StaffForm';
import SalaryForm from '@/components/staff/SalaryForm';
import { format } from 'date-fns';

// Define Staff interface
interface Staff {
  id?: string;
  name: string;
  email: string;
  phone: string;
  joiningDate: Timestamp;
  jobRole: string;
  basicSalary: number;
  status: 'active' | 'inactive';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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

export default function StaffPage() {
  const { user, isAllowedModule } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openStaffDialog, setOpenStaffDialog] = useState(false);
  const [openSalaryDialog, setOpenSalaryDialog] = useState(false);
  const [currentStaff, setCurrentStaff] = useState<Staff | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Fetch data when component mounts
  useEffect(() => {
    if (!user) return;
    
    if (isAllowedModule('staff')) {
      fetchStaff();
    } else {
      setLoading(false);
    }
  }, [user, isAllowedModule]);

  // Filter staff when search term changes
  useEffect(() => {
    if (staff.length === 0) {
      setFilteredStaff([]);
      return;
    }
    
    let filtered = [...staff];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        s.email.toLowerCase().includes(searchLower) ||
        s.jobRole.toLowerCase().includes(searchLower) ||
        s.phone.includes(searchLower)
      );
    }
    
    setFilteredStaff(filtered);
  }, [staff, searchTerm]);

  // Fetch staff from Firestore
  const fetchStaff = async () => {
    try {
      setLoading(true);
      const staffCollection = collection(db, 'staff');
      const staffQuery = query(staffCollection, orderBy('name', 'asc'));
      const snapshot = await getDocs(staffQuery);
      
      const staffData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Staff[];
      
      setStaff(staffData);
      setFilteredStaff(staffData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching staff:', error);
      setErrorMsg('Failed to load staff data');
      setLoading(false);
    }
  };

  // Handle adding a new staff member
  const handleAddStaff = () => {
    const emptyStaff: Staff = {
      name: '',
      email: '',
      phone: '',
      joiningDate: Timestamp.now(),
      jobRole: '',
      basicSalary: 0,
      status: 'active',
    };
    
    setCurrentStaff(emptyStaff);
    setOpenStaffDialog(true);
  };

  // Generate a staff number
  const generateStaffNumber = () => {
    const prefix = 'HH';
    const year = new Date().getFullYear().toString().substring(2);
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${year}${randomNum}`;
  };

  // Handle editing a staff member
  const handleEditStaff = (staffMember: Staff) => {
    setCurrentStaff(staffMember);
    setOpenStaffDialog(true);
  };

  // Handle deleting a staff member
  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this staff member? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'staff', id));
      setStaff(prevStaff => prevStaff.filter(s => s.id !== id));
      setSuccessMsg('Staff member deleted successfully');
    } catch (error) {
      console.error('Error deleting staff member:', error);
      setErrorMsg('Failed to delete staff member');
    }
  };

  // Handle opening the salary form
  const handleManageSalary = (staffMember: Staff) => {
    setCurrentStaff(staffMember);
    setOpenSalaryDialog(true);
    handleMenuClose();
  };

  // Handle printing salary slip
  const handlePrintSalarySlip = (staffMember: Staff) => {
    // Implement the print functionality
    console.log('Print salary slip for', staffMember.name);
    handleMenuClose();
    
    // Open the salary slip page in a new tab
    if (staffMember.id) {
      window.open(`/staff/salary-slip/${staffMember.id}`, '_blank');
    }
  };

  // Handle closing the staff dialog
  const handleCloseStaffDialog = () => {
    setOpenStaffDialog(false);
    setCurrentStaff(null);
  };

  // Handle closing the salary dialog
  const handleCloseSalaryDialog = () => {
    setOpenSalaryDialog(false);
    setCurrentStaff(null);
  };

  // Handle saving staff member
  const handleSaveStaff = async (staffData: Staff) => {
    try {
      if (currentStaff?.id) {
        // Update existing staff
        const staffRef = doc(db, 'staff', currentStaff.id);
        await updateDoc(staffRef, {
          ...staffData,
          updatedAt: serverTimestamp()
        });
        
        // Update local state
        setStaff(prevStaff => 
          prevStaff.map(s => 
            s.id === currentStaff.id ? { ...staffData, id: currentStaff.id } : s
          )
        );
        
        setSuccessMsg('Staff member updated successfully');
      } else {
        // Add new staff
        const newStaffData = {
          ...staffData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'staff'), newStaffData);
        
        // Update local state with timestamps converted to current time for UI
        const newStaffWithTimestamp = {
          ...staffData,
          id: docRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };
        
        setStaff(prevStaff => [
          ...prevStaff,
          newStaffWithTimestamp
        ]);
        
        setSuccessMsg('Staff member added successfully');
      }
      
      setOpenStaffDialog(false);
      setCurrentStaff(null);
    } catch (error) {
      console.error('Error saving staff member:', error);
      setErrorMsg('Failed to save staff member');
    }
  };

  // Handle saving salary
  const handleSaveSalary = async (salaryData: Salary) => {
    try {
      // Check if a salary record for this month already exists
      const salaryCollection = collection(db, 'salaries');
      const salaryQuery = query(
        salaryCollection,
        orderBy('month', 'desc')
      );
      const snapshot = await getDocs(salaryQuery);
      
      const existingSalary = snapshot.docs.find(doc => {
        const data = doc.data();
        return data.staffId === salaryData.staffId && data.month === salaryData.month;
      });
      
      if (existingSalary) {
        // Update existing salary
        const salaryRef = doc(db, 'salaries', existingSalary.id);
        await updateDoc(salaryRef, {
          ...salaryData,
          updatedAt: serverTimestamp()
        });
        
        setSuccessMsg('Salary updated successfully');
      } else {
        // Add new salary
        const newSalaryData = {
          ...salaryData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'salaries'), newSalaryData);
        
        setSuccessMsg('Salary added successfully');
      }
      
      setOpenSalaryDialog(false);
      setCurrentStaff(null);
    } catch (error) {
      console.error('Error saving salary:', error);
      setErrorMsg('Failed to save salary');
    }
  };

  // Table pagination handlers
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Format date for display
  const formatDate = (timestamp: Timestamp) => {
    return format(new Date(timestamp.seconds * 1000), 'dd MMM yyyy');
  };

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, staffId: string) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedStaffId(staffId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedStaffId(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!isAllowedModule('staff')) {
    return (
      <Box textAlign="center" p={4}>
        <Typography variant="h5" color="error" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1">
          You do not have permission to access the staff module.
        </Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight="bold" mb={1}>
        Staff Management
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Manage staff information, salaries and generate salary slips
      </Typography>
      
      {/* Filters and Actions */}
      <Box mb={4} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            placeholder="Search staff by name, ID, role..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 280 } }}
          />
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddStaff}
          sx={{ borderRadius: 1.5 }}
        >
          Add New Staff
        </Button>
      </Box>
      
      {/* Staff Table */}
      <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Job Role</TableCell>
                <TableCell>Joining Date</TableCell>
                <TableCell align="right">Basic Salary</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStaff.length > 0 ? (
                filteredStaff
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((staffMember) => (
                    <TableRow key={staffMember.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <BadgeIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          {staffMember.id?.substring(0, 8)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <PersonIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          <Box>
                            <Typography variant="body2">{staffMember.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {staffMember.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{staffMember.jobRole}</TableCell>
                      <TableCell>{formatDate(staffMember.joiningDate)}</TableCell>
                      <TableCell align="right">{formatCurrency(staffMember.basicSalary)}</TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={staffMember.status} 
                          size="small" 
                          color={staffMember.status === 'active' ? "success" : "error"} 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleEditStaff(staffMember)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={(e) => handleMenuOpen(e, staffMember.id || '')}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      'No staff members found'
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredStaff.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          sx={{ px: 2 }}
        />
      </Paper>
      
      {/* Staff Form Dialog */}
      <Dialog 
        open={openStaffDialog} 
        onClose={handleCloseStaffDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{ 
          sx: { 
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
          } 
        }}
      >
        <DialogContent sx={{ p: 3 }}>
          <StaffForm
            initialData={currentStaff || undefined}
            onSave={handleSaveStaff}
            onCancel={handleCloseStaffDialog}
          />
        </DialogContent>
      </Dialog>
      
      {/* Salary Form Dialog */}
      <Dialog 
        open={openSalaryDialog} 
        onClose={handleCloseSalaryDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{ 
          sx: { 
            borderRadius: 2,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)'
          } 
        }}
      >
        <DialogContent sx={{ p: 3 }}>
          {currentStaff && (
            <SalaryForm
              staff={currentStaff}
              onSave={handleSaveSalary}
              onCancel={handleCloseSalaryDialog}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Actions Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem 
          onClick={() => {
            const staffMember = staff.find(s => s.id === selectedStaffId);
            if (staffMember) handleManageSalary(staffMember);
          }}
        >
          <ListItemIcon>
            <PaymentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Manage Salary</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={() => {
            const staffMember = staff.find(s => s.id === selectedStaffId);
            if (staffMember) handlePrintSalarySlip(staffMember);
          }}
        >
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Print Salary Slip</ListItemText>
        </MenuItem>
        <MenuItem 
          onClick={() => {
            if (selectedStaffId) handleDeleteStaff(selectedStaffId);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Staff</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Snackbars for success/error messages */}
      <Snackbar
        open={!!successMsg}
        autoHideDuration={6000}
        onClose={() => setSuccessMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSuccessMsg('')} 
          severity="success" 
          variant="filled"
        >
          {successMsg}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!errorMsg}
        autoHideDuration={6000}
        onClose={() => setErrorMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setErrorMsg('')} 
          severity="error"
          variant="filled"
        >
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
} 