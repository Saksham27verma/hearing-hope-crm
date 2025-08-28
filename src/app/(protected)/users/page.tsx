'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  Grid,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
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
  where,
  getDoc,
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  deleteUser, 
  getAuth,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';

// Types
interface User {
  id?: string;
  uid?: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'manager' | 'staff' | 'operator';
  branch: string;
  isActive: boolean;
  permissions: string[];
  lastLogin?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Component
const UsersPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const auth = getAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  
  // Branch options
  const branchOptions = ['Main Branch', 'North Branch', 'South Branch', 'West Branch', 'East Branch'];

  // Role options
  const roleOptions = [
    { value: 'admin', label: 'Administrator' },
    { value: 'manager', label: 'Branch Manager' },
    { value: 'staff', label: 'Staff' },
    { value: 'operator', label: 'Operator' }
  ];
  
  // Permission options
  const permissionOptions = [
    { value: 'products', label: 'Products Management' },
    { value: 'inventory', label: 'Inventory Management' },
    { value: 'purchases', label: 'Purchases Management' },
    { value: 'sales', label: 'Sales Management' },
    { value: 'parties', label: 'Suppliers Management' },
    { value: 'visitors', label: 'Visitors Management' },
    { value: 'stock', label: 'Stock Transfer' },
    { value: 'deliveries', label: 'Delivery Challans' },
    { value: 'cash', label: 'Cash Register' },
    { value: 'reports', label: 'Reports' },
    { value: 'users', label: 'User Management' },
    { value: 'settings', label: 'System Settings' }
  ];
  
  // Initialize empty user
  const emptyUser: User = {
    name: '',
    email: '',
    phone: '',
    role: 'staff',
    branch: '',
    isActive: true,
    permissions: [],
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Check if user has admin permissions
    checkAdminPermission();
    
    // Fetch users data
    fetchUsers();
    
  }, [user, authLoading, router]);

  // Filter users when search term or role filter changes
  useEffect(() => {
    if (users.length === 0) {
      setFilteredUsers([]);
      return;
    }
    
    let filtered = [...users];
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.phone.includes(searchTerm) ||
        user.branch.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply role filter
    if (roleFilter) {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  const checkAdminPermission = async () => {
    // In a real application, you would check if the current user has admin permissions
    // For now, let's assume only users with the 'admin' role can access this page
    try {
      if (!user) return;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        router.push('/dashboard');
        return;
      }
      
      const userData = userDoc.data();
      
      if (userData.role !== 'admin' && !userData.permissions.includes('users')) {
        // User doesn't have permission to access this page
        router.push('/dashboard');
        setErrorMsg('You do not have permission to manage users');
      }
    } catch (error) {
      console.error('Error checking admin permission:', error);
      router.push('/dashboard');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersQuery = query(collection(db, 'users'), orderBy('name'));
      const snapshot = await getDocs(usersQuery);
      
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
      
      setUsers(usersData);
      setFilteredUsers(usersData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setErrorMsg('Failed to load users data');
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setCurrentUser(emptyUser);
    setPassword('');
    setOpenDialog(true);
  };

  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    setPassword('');
    setOpenDialog(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Are you sure you want to delete user ${user.name}?`)) return;
    
    try {
      if (!user.id) return;
      
      await deleteDoc(doc(db, 'users', user.id));
      
      // If user has auth account, delete that too
      if (user.uid) {
        // Note: Deleting auth users requires special handling in a real application
        // This is simplified and might not work directly in a production environment
        // In reality, you might want to disable users instead of deleting them
        try {
          // This is a placeholder - actual implementation would require admin SDK or a Cloud Function
          console.log('Would delete auth user with UID:', user.uid);
        } catch (authError) {
          console.error('Error deleting auth user:', authError);
        }
      }
      
      setUsers(prevUsers => prevUsers.filter(u => u.id !== user.id));
      setSuccessMsg('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      setErrorMsg('Failed to delete user');
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentUser(null);
    setPassword('');
  };

  const handleSaveUser = async () => {
    if (!currentUser) return;
    
    // Validate user data
    if (!currentUser.name || !currentUser.email || !currentUser.role || !currentUser.branch) {
      setErrorMsg('Please fill all required fields');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(currentUser.email)) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    
    try {
      if (currentUser.id) {
        // Update existing user
        const userRef = doc(db, 'users', currentUser.id);
        await updateDoc(userRef, {
          ...currentUser,
          updatedAt: serverTimestamp(),
        });
        
        // Update in state
        setUsers(prevUsers => 
          prevUsers.map(u => 
            u.id === currentUser.id ? {...currentUser, updatedAt: Timestamp.now()} : u
          )
        );
        
        setSuccessMsg('User updated successfully');
      } else {
        // Creating a new user
        if (!password || password.length < 6) {
          setErrorMsg('Please enter a password (minimum 6 characters)');
          return;
        }
        
        // Create Firebase auth user
        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth, 
            currentUser.email, 
            password
          );
          
          // Update profile with display name
          await updateProfile(userCredential.user, {
            displayName: currentUser.name,
          });
          
          // Add to Firestore with UID reference
          const newUserData = {
            ...currentUser,
            uid: userCredential.user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          
          const docRef = await addDoc(collection(db, 'users'), newUserData);
          
          // Add to state with the new ID
          const newUser = {
            ...currentUser,
            id: docRef.id,
            uid: userCredential.user.uid,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          
          setUsers(prevUsers => [...prevUsers, newUser]);
          setSuccessMsg('User added successfully');
        } catch (authError: any) {
          console.error('Error creating auth user:', authError);
          
          if (authError.code === 'auth/email-already-in-use') {
            setErrorMsg('Email is already in use');
          } else {
            setErrorMsg(`Failed to create user: ${authError.message}`);
          }
          return;
        }
      }
      
      setOpenDialog(false);
    } catch (error) {
      console.error('Error saving user:', error);
      setErrorMsg('Failed to save user');
    }
  };

  const handleSendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset:', error);
      setErrorMsg('Failed to send password reset email');
    }
  };

  const handlePermissionChange = (permission: string) => {
    if (!currentUser) return;
    
    const newPermissions = currentUser.permissions.includes(permission)
      ? currentUser.permissions.filter(p => p !== permission)
      : [...currentUser.permissions, permission];
      
    setCurrentUser({
      ...currentUser,
      permissions: newPermissions,
    });
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCloseSnackbar = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  const formatDate = (timestamp?: Timestamp) => {
    if (!timestamp) return 'Never';
    
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getRoleBadge = (role: string) => {
    let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
    
    switch (role) {
      case 'admin':
        color = 'error';
        break;
      case 'manager':
        color = 'warning';
        break;
      case 'staff':
        color = 'info';
        break;
      case 'operator':
        color = 'secondary';
        break;
      default:
        color = 'default';
    }
    
    return (
      <Chip 
        label={roleOptions.find(r => r.value === role)?.label || role} 
        size="small" 
        color={color} 
        variant="outlined" 
      />
    );
  };

  if (authLoading || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" color="primary" mb={1}>
        Staff Management
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Manage user accounts and access permissions
      </Typography>
      
      {/* Filters and Actions */}
      <Box mb={3} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField
            placeholder="Search users..."
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
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          />
          
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 180 } }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              label="Role"
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <MenuItem value="">All Roles</MenuItem>
              {roleOptions.map((role) => (
                <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {roleFilter && (
            <Button 
              variant="outlined" 
              size="small"
              onClick={() => setRoleFilter('')}
            >
              Clear Filter
            </Button>
          )}
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddUser}
        >
          Add Staff
        </Button>
      </Box>
      
      {/* Users Table */}
      <Paper elevation={0} variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.length > 0 ? (
                filteredUsers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <Avatar 
                            sx={{ 
                              width: 32, 
                              height: 32, 
                              bgcolor: 'primary.main', 
                              fontSize: '0.875rem',
                              mr: 1 
                            }}
                          >
                            {user.name.charAt(0).toUpperCase()}
                          </Avatar>
                          {user.name}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <EmailIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          {user.email}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <PhoneIcon fontSize="small" color="action" sx={{ mr: 1 }} />
                          {user.phone}
                        </Box>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{user.branch}</TableCell>
                      <TableCell>
                        <Chip 
                          label={user.isActive ? 'Active' : 'Inactive'} 
                          size="small" 
                          color={user.isActive ? 'success' : 'default'} 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell>{formatDate(user.lastLogin)}</TableCell>
                      <TableCell align="right">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleEditUser(user)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="info" 
                          onClick={() => handleSendPasswordReset(user.email)}
                        >
                          <LockIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => handleDeleteUser(user)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                    {loading ? (
                      <CircularProgress size={24} />
                    ) : (
                      'No users found'
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
          count={filteredUsers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      
      {/* User Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {currentUser?.id ? 'Edit Staff Member' : 'Add Staff Member'}
        </DialogTitle>
        
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Grid container spacing={2}>
              <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
                <Typography variant="subtitle2" gutterBottom>
                  Basic Information
                </Typography>
                
                <Stack spacing={2}>
                  <TextField
                    label="Full Name"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentUser?.name || ''}
                    onChange={(e) => {
                      if (currentUser) {
                        setCurrentUser({
                          ...currentUser,
                          name: e.target.value,
                        });
                      }
                    }}
                    required
                  />
                  
                  <TextField
                    label="Email"
                    variant="outlined"
                    size="small"
                    fullWidth
                    type="email"
                    value={currentUser?.email || ''}
                    onChange={(e) => {
                      if (currentUser) {
                        setCurrentUser({
                          ...currentUser,
                          email: e.target.value,
                        });
                      }
                    }}
                    required
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  
                  {!currentUser?.id && (
                    <TextField
                      label="Password"
                      variant="outlined"
                      size="small"
                      fullWidth
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                  
                  <TextField
                    label="Phone Number"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={currentUser?.phone || ''}
                    onChange={(e) => {
                      if (currentUser) {
                        setCurrentUser({
                          ...currentUser,
                          phone: e.target.value,
                        });
                      }
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Stack>
              </Grid>
              
              <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
                <Typography variant="subtitle2" gutterBottom>
                  Role & Branch
                </Typography>
                
                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={currentUser?.role || 'staff'}
                      label="Role"
                      onChange={(e) => {
                        if (currentUser) {
                          setCurrentUser({
                            ...currentUser,
                            role: e.target.value as any,
                          });
                        }
                      }}
                    >
                      {roleOptions.map((role) => (
                        <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth size="small">
                    <InputLabel>Branch</InputLabel>
                    <Select
                      value={currentUser?.branch || ''}
                      label="Branch"
                      onChange={(e) => {
                        if (currentUser) {
                          setCurrentUser({
                            ...currentUser,
                            branch: e.target.value,
                          });
                        }
                      }}
                    >
                      {branchOptions.map((branch) => (
                        <MenuItem key={branch} value={branch}>{branch}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={currentUser?.isActive || false}
                        onChange={(e) => {
                          if (currentUser) {
                            setCurrentUser({
                              ...currentUser,
                              isActive: e.target.checked,
                            });
                          }
                        }}
                        color="success"
                      />
                    }
                    label="Active Account"
                  />
                </Stack>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" gutterBottom>
              Permissions
            </Typography>
            
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Select which features this user can access:
              </Typography>
              
              <Grid container spacing={1} mt={1}>
                {permissionOptions.map((permission) => (
                  <Grid key={permission.value} sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={currentUser?.permissions.includes(permission.value) || false}
                          onChange={() => handlePermissionChange(permission.value)}
                          color="primary"
                          size="small"
                        />
                      }
                      label={permission.label}
                    />
                  </Grid>
                ))}
              </Grid>
              
              {currentUser?.role === 'admin' && (
                <Typography variant="body2" color="info.main" mt={2}>
                  Note: Administrators have access to all features by default
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSaveUser}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Success/Error messages */}
      <Snackbar open={!!successMsg} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="success" variant="filled">
          {successMsg}
        </Alert>
      </Snackbar>
      
      <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="error" variant="filled">
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UsersPage; 