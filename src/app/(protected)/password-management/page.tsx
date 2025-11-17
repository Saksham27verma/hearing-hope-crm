'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Stack,
  Grid,
  Divider,
  Card,
  CardContent,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Security as SecurityIcon,
  Email as EmailIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'staff';
}

export default function PasswordManagementPage() {
  const { user, userProfile, changePassword, changeEmail, resetUserPassword, updateUserPassword, updateUserEmail, loading: authLoading } = useAuth();
  
  // Own password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Own email change
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  
  // User password/email management
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [changeEmailDialogOpen, setChangeEmailDialogOpen] = useState(false);
  const [userNewPassword, setUserNewPassword] = useState('');
  const [userConfirmPassword, setUserConfirmPassword] = useState('');
  const [userNewEmail, setUserNewEmail] = useState('');
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [showUserConfirmPassword, setShowUserConfirmPassword] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchUsers();
    }
  }, [userProfile]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersQuery = query(collection(db, 'users'), orderBy('email', 'asc'));
      const snapshot = await getDocs(usersQuery);
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      })) as User[];
      setUsers(usersData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setErrorMsg('Failed to load users');
      setLoading(false);
    }
  };

  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('At least 8 characters');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('One lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('One uppercase letter');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('One number');
    }
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors.push('One special character (@$!%*?&)');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  };

  const getPasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength += 20;
    if (/(?=.*[a-z])/.test(password)) strength += 20;
    if (/(?=.*[A-Z])/.test(password)) strength += 20;
    if (/(?=.*\d)/.test(password)) strength += 20;
    if (/(?=.*[@$!%*?&])/.test(password)) strength += 20;
    return strength;
  };

  const getPasswordStrengthColor = (strength: number): string => {
    if (strength < 40) return '#f44336';
    if (strength < 80) return '#ff9800';
    return '#4caf50';
  };

  const getPasswordStrengthLabel = (strength: number): string => {
    if (strength < 40) return 'Weak';
    if (strength < 80) return 'Medium';
    return 'Strong';
  };

  const handleChangeOwnPassword = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('');

      if (!currentPassword || !newPassword || !confirmPassword) {
        setErrorMsg('Please fill in all fields');
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrorMsg('New passwords do not match');
        return;
      }

      const validation = validatePassword(newPassword);
      if (!validation.valid) {
        setErrorMsg(`Password requirements not met: ${validation.errors.join(', ')}`);
        return;
      }

      setLoading(true);
      await changePassword(currentPassword, newPassword);
      
      setSuccessMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      setErrorMsg(error.message || 'Failed to change password');
      setLoading(false);
    }
  };

  const handleChangeOwnEmail = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('');

      if (!newEmail || !emailPassword) {
        setErrorMsg('Please fill in all fields');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        setErrorMsg('Invalid email format');
        return;
      }

      setLoading(true);
      await changeEmail(newEmail, emailPassword);
      
      setSuccessMsg('Email changed successfully!');
      setNewEmail('');
      setEmailPassword('');
      setLoading(false);
    } catch (error: any) {
      console.error('Error changing email:', error);
      setErrorMsg(error.message || 'Failed to change email');
      setLoading(false);
    }
  };

  const handleResetUserPassword = async () => {
    if (!selectedUser) return;

    try {
      setErrorMsg('');
      setSuccessMsg('');
      setLoading(true);

      await resetUserPassword(selectedUser.email);
      
      setSuccessMsg(`Password reset email sent to ${selectedUser.email}`);
      setResetDialogOpen(false);
      setSelectedUser(null);
      setLoading(false);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      setErrorMsg(error.message || 'Failed to send password reset email');
      setLoading(false);
    }
  };

  const handleChangeUserPassword = async () => {
    if (!selectedUser) return;

    try {
      setErrorMsg('');
      setSuccessMsg('');

      if (!userNewPassword || !userConfirmPassword) {
        setErrorMsg('Please fill in all fields');
        return;
      }

      if (userNewPassword !== userConfirmPassword) {
        setErrorMsg('Passwords do not match');
        return;
      }

      const validation = validatePassword(userNewPassword);
      if (!validation.valid) {
        setErrorMsg(`Password requirements not met: ${validation.errors.join(', ')}`);
        return;
      }

      setLoading(true);
      await updateUserPassword(selectedUser.uid, userNewPassword);
      
      setSuccessMsg(`Password updated for ${selectedUser.email}`);
      setChangePasswordDialogOpen(false);
      setSelectedUser(null);
      setUserNewPassword('');
      setUserConfirmPassword('');
      setLoading(false);
    } catch (error: any) {
      console.error('Error changing user password:', error);
      setErrorMsg(error.message || 'Failed to update user password');
      setLoading(false);
    }
  };

  const handleChangeUserEmail = async () => {
    if (!selectedUser) return;

    try {
      setErrorMsg('');
      setSuccessMsg('');

      if (!userNewEmail) {
        setErrorMsg('Please enter a new email address');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userNewEmail)) {
        setErrorMsg('Invalid email format');
        return;
      }

      setLoading(true);
      await updateUserEmail(selectedUser.uid, userNewEmail);
      
      setSuccessMsg(`Email updated for ${selectedUser.email}. Note: Auth email update requires Cloud Function.`);
      setChangeEmailDialogOpen(false);
      setSelectedUser(null);
      setUserNewEmail('');
      await fetchUsers(); // Refresh users list
      setLoading(false);
    } catch (error: any) {
      console.error('Error changing user email:', error);
      setErrorMsg(error.message || 'Failed to update user email');
      setLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  if (authLoading || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const passwordStrength = getPasswordStrength(newPassword);
  const passwordValidation = validatePassword(newPassword);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Password Management
      </Typography>

      <Grid container spacing={3}>
        {/* Change Own Password */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <LockIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  Change Your Password
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Current Password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          edge="end"
                        >
                          {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="New Password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          edge="end"
                        >
                          {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {newPassword && (
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Password Strength
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: getPasswordStrengthColor(passwordStrength), fontWeight: 'bold' }}
                      >
                        {getPasswordStrengthLabel(passwordStrength)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={passwordStrength}
                      sx={{
                        height: 8,
                        borderRadius: 1,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: getPasswordStrengthColor(passwordStrength),
                        },
                      }}
                    />
                  </Box>
                )}

                <TextField
                  fullWidth
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={confirmPassword !== '' && newPassword !== confirmPassword}
                  helperText={
                    confirmPassword !== '' && newPassword !== confirmPassword
                      ? 'Passwords do not match'
                      : ''
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          edge="end"
                        >
                          {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleChangeOwnPassword}
                  disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                  sx={{ mt: 2 }}
                >
                  Change Password
                </Button>
              </Stack>

              {/* Password Requirements */}
              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Password Requirements:
                </Typography>
                <List dense>
                  {[
                    { label: 'At least 8 characters', test: newPassword.length >= 8 },
                    { label: 'One lowercase letter', test: /(?=.*[a-z])/.test(newPassword) },
                    { label: 'One uppercase letter', test: /(?=.*[A-Z])/.test(newPassword) },
                    { label: 'One number', test: /(?=.*\d)/.test(newPassword) },
                    { label: 'One special character (@$!%*?&)', test: /(?=.*[@$!%*?&])/.test(newPassword) },
                  ].map((req, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {req.test ? (
                          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                        ) : (
                          <CancelIcon sx={{ color: 'error.main', fontSize: 20 }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={req.label}
                        primaryTypographyProps={{
                          variant: 'caption',
                          sx: { color: req.test ? 'success.main' : 'text.secondary' },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Change Own Email */}
        <Grid item xs={12} md={6}>
          <Card elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  Change Your Email
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Current Email"
                  value={user?.email || ''}
                  disabled
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="New Email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                />

                <TextField
                  fullWidth
                  label="Confirm Password"
                  type={showEmailPassword ? 'text' : 'password'}
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  helperText="Enter your current password to confirm email change"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowEmailPassword(!showEmailPassword)}
                          edge="end"
                        >
                          {showEmailPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleChangeOwnEmail}
                  disabled={loading || !newEmail || !emailPassword}
                  sx={{ mt: 2 }}
                >
                  Change Email
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* User Management Section (Admin Only) */}
      {userProfile?.role === 'admin' && (
        <Box sx={{ mt: 4 }}>
          <Card elevation={3}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  Manage User Accounts
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Change passwords and email addresses for admin and staff users.
              </Typography>

              <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
                <List>
                  {users.map((u) => (
                    <ListItem
                      key={u.uid}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      secondaryAction={
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LockIcon />}
                            onClick={() => {
                              setSelectedUser(u);
                              setChangePasswordDialogOpen(true);
                            }}
                          >
                            Change Password
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EmailIcon />}
                            onClick={() => {
                              setSelectedUser(u);
                              setUserNewEmail(u.email);
                              setChangeEmailDialogOpen(true);
                            }}
                          >
                            Change Email
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            startIcon={<EmailIcon />}
                            onClick={() => {
                              setSelectedUser(u);
                              setResetDialogOpen(true);
                            }}
                          >
                            Reset Email
                          </Button>
                        </Stack>
                      }
                    >
                      <ListItemIcon>
                        <PersonIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={u.displayName || u.email}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {u.email}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {u.role === 'admin' ? 'Administrator' : 'Staff'}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Reset Password Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>Send Password Reset Email</DialogTitle>
        <DialogContent>
          <Typography>
            Send a password reset email to <strong>{selectedUser?.email}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            The user will receive an email with instructions to reset their password.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleResetUserPassword} variant="contained" color="primary">
            Send Reset Email
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change User Password Dialog */}
      <Dialog open={changePasswordDialogOpen} onClose={() => setChangePasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password for {selectedUser?.email}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="New Password"
              type={showUserPassword ? 'text' : 'password'}
              value={userNewPassword}
              onChange={(e) => setUserNewPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowUserPassword(!showUserPassword)}
                      edge="end"
                    >
                      {showUserPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Confirm New Password"
              type={showUserConfirmPassword ? 'text' : 'password'}
              value={userConfirmPassword}
              onChange={(e) => setUserConfirmPassword(e.target.value)}
              error={userConfirmPassword !== '' && userNewPassword !== userConfirmPassword}
              helperText={
                userConfirmPassword !== '' && userNewPassword !== userConfirmPassword
                  ? 'Passwords do not match'
                  : ''
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowUserConfirmPassword(!showUserConfirmPassword)}
                      edge="end"
                    >
                      {showUserConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {userNewPassword && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Password Strength
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: getPasswordStrengthColor(getPasswordStrength(userNewPassword)), fontWeight: 'bold' }}
                  >
                    {getPasswordStrengthLabel(getPasswordStrength(userNewPassword))}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={getPasswordStrength(userNewPassword)}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getPasswordStrengthColor(getPasswordStrength(userNewPassword)),
                    },
                  }}
                />
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              Note: Password update requires a Cloud Function to process. The request will be stored in Firestore.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setChangePasswordDialogOpen(false);
            setUserNewPassword('');
            setUserConfirmPassword('');
          }}>Cancel</Button>
          <Button
            onClick={handleChangeUserPassword}
            variant="contained"
            color="primary"
            disabled={!userNewPassword || !userConfirmPassword || userNewPassword !== userConfirmPassword}
          >
            Update Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change User Email Dialog */}
      <Dialog open={changeEmailDialogOpen} onClose={() => setChangeEmailDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Email for {selectedUser?.displayName || selectedUser?.email}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Current Email"
              value={selectedUser?.email || ''}
              disabled
            />
            <TextField
              fullWidth
              label="New Email"
              type="email"
              value={userNewEmail}
              onChange={(e) => setUserNewEmail(e.target.value)}
              placeholder="Enter new email address"
            />
            <Typography variant="caption" color="text.secondary">
              Note: Email update in Firestore will be immediate. Auth email update requires a Cloud Function to process.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setChangeEmailDialogOpen(false);
            setUserNewEmail('');
          }}>Cancel</Button>
          <Button
            onClick={handleChangeUserEmail}
            variant="contained"
            color="primary"
            disabled={!userNewEmail || userNewEmail === selectedUser?.email}
          >
            Update Email
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!successMsg}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          {successMsg}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMsg}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

