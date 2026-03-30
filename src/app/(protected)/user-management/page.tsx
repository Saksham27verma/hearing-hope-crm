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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
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
  Add as AddIcon,
  DeleteOutline as DeleteOutlineIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useAuth } from '@/context/AuthContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { CRM_MODULE_ACCESS_OPTIONS } from '@/components/Layout/crm-nav-config';

interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'staff' | 'audiologist';
  allowedModules?: string[];
}

export default function UserManagementPage() {
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

  // Admin: create user
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [createUserEmail, setCreateUserEmail] = useState('');
  const [createUserName, setCreateUserName] = useState('');
  const [createUserRole, setCreateUserRole] = useState<'admin' | 'staff' | 'audiologist'>('staff');
  const [createUserModules, setCreateUserModules] = useState<string[]>([]);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [editAccessRole, setEditAccessRole] = useState<'admin' | 'staff' | 'audiologist'>('staff');
  const [editAccessModules, setEditAccessModules] = useState<string[]>([]);

  // UI state
  const [usersLoading, setUsersLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchUsers();
    }
  }, [userProfile]);

  useEffect(() => {
    if (createUserRole === 'admin') setCreateUserModules([]);
  }, [createUserRole]);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const usersQuery = query(collection(db, 'users'), orderBy('email', 'asc'));
      const snapshot = await getDocs(usersQuery);
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data(),
      })) as User[];
      setUsers(usersData);
      setUsersLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setErrorMsg('Failed to load users');
      setUsersLoading(false);
    }
  };

  const adminApi = async (path: string, init: RequestInit) => {
    if (!user) throw new Error('Not signed in');
    const token = await user.getIdToken();
    const res = await fetch(path, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Request failed');
    }
    return data;
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

      setActionLoading(true);
      await changePassword(currentPassword, newPassword);
      
      setSuccessMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActionLoading(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      setErrorMsg(error.message || 'Failed to change password');
      setActionLoading(false);
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

      setActionLoading(true);
      await changeEmail(newEmail, emailPassword);
      
      setSuccessMsg('Email changed successfully!');
      setNewEmail('');
      setEmailPassword('');
      setActionLoading(false);
    } catch (error: any) {
      console.error('Error changing email:', error);
      setErrorMsg(error.message || 'Failed to change email');
      setActionLoading(false);
    }
  };

  const handleResetUserPassword = async () => {
    if (!selectedUser) return;

    try {
      setErrorMsg('');
      setSuccessMsg('');
      setActionLoading(true);

      await resetUserPassword(selectedUser.email);
      
      setSuccessMsg(`Password reset email sent to ${selectedUser.email}`);
      setResetDialogOpen(false);
      setSelectedUser(null);
      setActionLoading(false);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      setErrorMsg(error.message || 'Failed to send password reset email');
      setActionLoading(false);
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

      setActionLoading(true);
      await updateUserPassword(selectedUser.uid, userNewPassword);
      
      setSuccessMsg(`Password updated for ${selectedUser.email}`);
      setChangePasswordDialogOpen(false);
      setSelectedUser(null);
      setUserNewPassword('');
      setUserConfirmPassword('');
      setActionLoading(false);
    } catch (error: any) {
      console.error('Error changing user password:', error);
      setErrorMsg(error.message || 'Failed to update user password');
      setActionLoading(false);
    }
  };

  const handleChangeUserEmail = async () => {
    if (!selectedUser || !user) return;

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

      setActionLoading(true);
      if (userProfile?.role === 'admin' && selectedUser.uid !== user.uid) {
        await adminApi('/api/admin/update-user', {
          method: 'PATCH',
          body: JSON.stringify({ uid: selectedUser.uid, email: userNewEmail.trim().toLowerCase() }),
        });
        setSuccessMsg(`Email updated for ${selectedUser.email}.`);
      } else {
        await updateUserEmail(selectedUser.uid, userNewEmail);
        setSuccessMsg(`Email updated. Note: some auth changes may still require a Cloud Function.`);
      }
      setChangeEmailDialogOpen(false);
      setSelectedUser(null);
      setUserNewEmail('');
      await fetchUsers();
      setActionLoading(false);
    } catch (error: any) {
      console.error('Error changing user email:', error);
      setErrorMsg(error.message || 'Failed to update user email');
      setActionLoading(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleCreateUser = async () => {
    try {
      setErrorMsg('');
      setSuccessMsg('');

      const email = createUserEmail.trim().toLowerCase();
      const displayName = createUserName.trim();
      const role = createUserRole;

      if (!email) {
        setErrorMsg('Please enter an email address');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setErrorMsg('Invalid email format');
        return;
      }
      if (!user) {
        setErrorMsg('You must be signed in as admin');
        return;
      }

      setActionLoading(true);
      const token = await user.getIdToken();
      const payload: Record<string, unknown> = { email, displayName, role };
      if (role !== 'admin' && createUserModules.length > 0) {
        payload.allowedModules = createUserModules;
      }
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.error || 'Failed to create user');
        setActionLoading(false);
        return;
      }

      // Send password setup email (Firebase password reset)
      await resetUserPassword(email);

      setSuccessMsg(`User created: ${email}. Password setup email sent.`);
      setCreateUserDialogOpen(false);
      setCreateUserEmail('');
      setCreateUserName('');
      setCreateUserRole('staff');
      setCreateUserModules([]);
      await fetchUsers();
      setActionLoading(false);
    } catch (error: any) {
      console.error('Error creating user:', error);
      setErrorMsg(error?.message || 'Failed to create user');
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      setErrorMsg('');
      setSuccessMsg('');
      setActionLoading(true);
      await adminApi('/api/admin/delete-user', {
        method: 'DELETE',
        body: JSON.stringify({ uid: selectedUser.uid }),
      });
      setSuccessMsg(`User ${selectedUser.email} was removed.`);
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      await fetchUsers();
      setActionLoading(false);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to delete user');
      setActionLoading(false);
    }
  };

  const openAccessDialog = (u: User) => {
    setSelectedUser(u);
    setEditAccessRole(u.role);
    const raw = u.allowedModules?.map((m) => m.toLowerCase()) ?? [];
    if (u.role === 'admin' || raw.includes('*')) {
      setEditAccessModules([]);
    } else {
      setEditAccessModules(raw.filter((k) => k !== '*'));
    }
    setAccessDialogOpen(true);
  };

  const toggleEditModule = (key: string) => {
    setEditAccessModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSaveAccess = async () => {
    if (!selectedUser) return;
    if (editAccessRole !== 'admin' && editAccessModules.length === 0) {
      setErrorMsg('Select at least one module, or assign the Admin role for full access.');
      return;
    }
    try {
      setErrorMsg('');
      setSuccessMsg('');
      setActionLoading(true);
      const body: Record<string, unknown> = {
        uid: selectedUser.uid,
        role: editAccessRole,
      };
      if (editAccessRole === 'admin') {
        body.allowedModules = ['*'];
      } else {
        body.allowedModules = editAccessModules;
      }
      await adminApi('/api/admin/update-user', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setSuccessMsg(`Access updated for ${selectedUser.email}. They may need to refresh the app.`);
      setAccessDialogOpen(false);
      setSelectedUser(null);
      await fetchUsers();
      setActionLoading(false);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to update access');
      setActionLoading(false);
    }
  };

  if (authLoading) {
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
        User Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage your sign-in details and (as admin) add or remove users, roles, module access, email, and passwords.
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
                  disabled={actionLoading || !currentPassword || !newPassword || !confirmPassword}
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
                  disabled={actionLoading || !newEmail || !emailPassword}
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
                  Users
                </Typography>
              </Box>
              <Divider sx={{ mb: 3 }} />

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add users, set roles and module access, update email and passwords, or remove accounts.
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateUserDialogOpen(true)}
                >
                  Add user
                </Button>
              </Box>

              {usersLoading ? (
                <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={32} />
                </Box>
              ) : (
              <Box sx={{ maxHeight: 560, overflow: 'auto' }}>
                <List>
                  {users.map((u) => (
                    <ListItem
                      key={u.uid}
                      alignItems="flex-start"
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ display: 'flex', width: '100%', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <PersonIcon color="primary" />
                        </ListItemIcon>
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {u.displayName || u.email}
                          </Typography>
                          <Typography variant="caption" display="block" color="text.secondary">
                            {u.email}
                          </Typography>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                            <Chip
                              size="small"
                              label={u.role === 'admin' ? 'Admin' : u.role === 'audiologist' ? 'Audiologist' : 'Staff'}
                              color={u.role === 'admin' ? 'error' : u.role === 'audiologist' ? 'info' : 'default'}
                              variant="outlined"
                            />
                            {u.uid === user?.uid && (
                              <Chip size="small" label="You" color="primary" variant="outlined" />
                            )}
                          </Stack>
                        </Box>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<TuneIcon />}
                            onClick={() => openAccessDialog(u)}
                          >
                            Access
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LockIcon />}
                            disabled={u.uid === user?.uid}
                            onClick={() => {
                              setSelectedUser(u);
                              setChangePasswordDialogOpen(true);
                            }}
                          >
                            Password
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EmailIcon />}
                            disabled={u.uid === user?.uid}
                            onClick={() => {
                              setSelectedUser(u);
                              setUserNewEmail(u.email);
                              setChangeEmailDialogOpen(true);
                            }}
                          >
                            Email
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
                            Reset link
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            disabled={u.uid === user?.uid}
                            onClick={() => {
                              setSelectedUser(u);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Box>
              )}
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
              {userProfile?.role === 'admin' && selectedUser?.uid !== user?.uid
                ? 'Updates both Firebase Authentication and the user profile.'
                : 'Note: Email update in Firestore will be immediate. Auth email update may require a Cloud Function.'}
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

      {/* Delete user */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete user</DialogTitle>
        <DialogContent>
          <Typography>
            Permanently remove <strong>{selectedUser?.email}</strong> from Authentication and the CRM user list? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteUser} disabled={actionLoading}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role & module access */}
      <Dialog open={accessDialogOpen} onClose={() => setAccessDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Role &amp; access — {selectedUser?.email}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={editAccessRole}
                label="Role"
                onChange={(e) => setEditAccessRole(e.target.value as 'admin' | 'staff' | 'audiologist')}
              >
                <MenuItem value="staff">Staff</MenuItem>
                <MenuItem value="audiologist">Audiologist</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            {editAccessRole === 'admin' ? (
              <Alert severity="info">Administrators have full access to every module.</Alert>
            ) : (
              <>
                <Typography variant="subtitle2">Modules</Typography>
                <FormGroup sx={{ maxHeight: 280, overflow: 'auto', pl: 0.5 }}>
                  {CRM_MODULE_ACCESS_OPTIONS.map((opt) => (
                    <FormControlLabel
                      key={opt.key}
                      control={
                        <Checkbox
                          size="small"
                          checked={editAccessModules.includes(opt.key)}
                          onChange={() => toggleEditModule(opt.key)}
                        />
                      }
                      label={opt.label}
                    />
                  ))}
                </FormGroup>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccessDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveAccess} disabled={actionLoading}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create User Dialog (Admin) */}
      <Dialog open={createUserDialogOpen} onClose={() => setCreateUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={createUserEmail}
              onChange={(e) => setCreateUserEmail(e.target.value)}
              placeholder="new.user@example.com"
            />
            <TextField
              fullWidth
              label="Display Name (optional)"
              value={createUserName}
              onChange={(e) => setCreateUserName(e.target.value)}
              placeholder="New User"
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={createUserRole}
                label="Role"
                onChange={(e) => setCreateUserRole(e.target.value as 'admin' | 'staff' | 'audiologist')}
              >
                <MenuItem value="staff">Staff</MenuItem>
                <MenuItem value="audiologist">Audiologist</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            {(createUserRole === 'staff' || createUserRole === 'audiologist') && (
              <>
                <Typography variant="subtitle2" color="text.secondary">
                  Module access (optional — defaults apply if none selected)
                </Typography>
                <FormGroup sx={{ maxHeight: 220, overflow: 'auto', pl: 0.5 }}>
                  {CRM_MODULE_ACCESS_OPTIONS.map((opt) => (
                    <FormControlLabel
                      key={opt.key}
                      control={
                        <Checkbox
                          size="small"
                          checked={createUserModules.includes(opt.key)}
                          onChange={() => {
                            setCreateUserModules((prev) =>
                              prev.includes(opt.key) ? prev.filter((k) => k !== opt.key) : [...prev, opt.key],
                            );
                          }}
                        />
                      }
                      label={opt.label}
                    />
                  ))}
                </FormGroup>
              </>
            )}
            <Alert severity="info">
              After creation, the user will receive a password setup email (password reset link).
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateUserDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateUser} disabled={actionLoading || !createUserEmail.trim()}>
            Create & Send Email
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

