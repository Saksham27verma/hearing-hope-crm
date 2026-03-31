'use client';

import React, { useState, useEffect, useMemo } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import KeyRoundIcon from '@mui/icons-material/VpnKey';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/context/AuthContext';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { CRM_MODULE_ACCESS_OPTIONS } from '@/components/Layout/crm-nav-config';
import { useCenterScope } from '@/hooks/useCenterScope';
import {
  isGlobalDataScope,
  isSuperAdminViewer,
  normalizeCenterId,
  normalizeCenterIdsFromProfile,
  userRowMatchesDataScope,
} from '@/lib/tenant/centerScope';
import { useUserPresenceHeartbeat, usePresenceOnlineMap } from '@/components/user-management/useUserPresence';
import UserDirectoryTable from '@/components/user-management/UserDirectoryTable';
import CreateUserDialog from '@/components/user-management/CreateUserDialog';

const PAGE_BG = '#f8f9fa';
const CARD_BG = '#ffffff';
const BORDER = '1px solid #e0e2e6';
const SHADOW = '0px 4px 20px rgba(0, 0, 0, 0.03)';
const BRAND = '#0d9488';
const BRAND_HOVER = '#0f766e';

const cardPaperSx = {
  elevation: 0,
  border: BORDER,
  boxShadow: SHADOW,
  bgcolor: CARD_BG,
  borderRadius: 2,
  p: 4,
} as const;

const outlinedFieldSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
} as const;

interface User {
  /** Firestore document ID (unique per row; may differ from Firebase Auth UID for legacy `addDoc` profiles) */
  uid: string;
  /** Firebase Authentication user ID — use for Auth + admin APIs */
  firebaseAuthUid: string;
  email: string;
  displayName?: string;
  role: 'admin' | 'staff' | 'audiologist';
  allowedModules?: string[];
  centerId?: string | null;
  centerIds?: string[] | null;
  branchId?: string | null;
  isSuperAdmin?: boolean;
}

function mapUserSnapshot(docSnap: { id: string; data: () => Record<string, unknown> }): User {
  const data = docSnap.data();
  const docId = docSnap.id;
  const authUid =
    typeof data.uid === 'string' && String(data.uid).trim() ? String(data.uid).trim() : docId;
  return {
    ...(data as Omit<User, 'uid' | 'firebaseAuthUid'>),
    uid: docId,
    firebaseAuthUid: authUid,
  } as User;
}

export default function UserManagementPage() {
  const { user, userProfile, changePassword, changeEmail, resetUserPassword, updateUserPassword, updateUserEmail, loading: authLoading } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { effectiveScopeCenterId, allowedCenterIds, centers, lockedCenterId } = useCenterScope();
  const scopeHeaderCenterId = effectiveScopeCenterId ?? null;
  useUserPresenceHeartbeat(user, Boolean(user));
  
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
  
  // User password/email management (allUsers = full snapshot; users = scoped for display)
  const [allUsers, setAllUsers] = useState<User[]>([]);
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
  const [createUserCenterIds, setCreateUserCenterIds] = useState<string[]>([]);
  const [createUserSuperAdmin, setCreateUserSuperAdmin] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTypeConfirm, setDeleteTypeConfirm] = useState('');
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [editAccessRole, setEditAccessRole] = useState<'admin' | 'staff' | 'audiologist'>('staff');
  const [editAccessModules, setEditAccessModules] = useState<string[]>([]);
  const [editCenterId, setEditCenterId] = useState<string>('');
  const [editSuperAdmin, setEditSuperAdmin] = useState(false);
  const [editCenterSearch, setEditCenterSearch] = useState('');

  // UI state
  const [usersLoading, setUsersLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const users = useMemo(() => {
    if (isGlobalDataScope(effectiveScopeCenterId, allowedCenterIds)) return allUsers;
    return allUsers.filter((r) => userRowMatchesDataScope(r, effectiveScopeCenterId, allowedCenterIds));
  }, [allUsers, effectiveScopeCenterId, allowedCenterIds]);

  const onlineMap = usePresenceOnlineMap(users.map((u) => u.firebaseAuthUid));

  useEffect(() => {
    if (createUserRole === 'admin') setCreateUserModules([]);
  }, [createUserRole]);

  useEffect(() => {
    if (userProfile?.role !== 'admin' || !db) {
      setAllUsers([]);
      return;
    }
    setUsersLoading(true);
    const usersQuery = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsub = onSnapshot(
      usersQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((docSnap) => mapUserSnapshot(docSnap));
        setAllUsers(rows);
        setUsersLoading(false);
      },
      (error) => {
        console.error('users snapshot error:', error);
        enqueueSnackbar('Failed to load users', { variant: 'error' });
        setUsersLoading(false);
      },
    );
    return () => unsub();
  }, [userProfile?.role, enqueueSnackbar]);

  useEffect(() => {
    if (lockedCenterId && createUserCenterIds.length === 0) {
      setCreateUserCenterIds([lockedCenterId]);
    }
  }, [lockedCenterId, createUserCenterIds.length]);

  const inviteCenters = useMemo(() => {
    if (lockedCenterId) return centers.filter((c) => c.id === lockedCenterId);
    if (userProfile && !isSuperAdminViewer(userProfile)) {
      const ids = normalizeCenterIdsFromProfile(userProfile);
      if (ids.length > 0) return centers.filter((c) => ids.includes(c.id));
    }
    return centers;
  }, [centers, lockedCenterId, userProfile]);

  const filteredCentersForEdit = useMemo(() => {
    const q = editCenterSearch.trim().toLowerCase();
    if (!q) return centers;
    return centers.filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  }, [centers, editCenterSearch]);

  const adminApi = async (path: string, init: RequestInit) => {
    if (!user) throw new Error('Not signed in');
    const token = await user.getIdToken();
    const baseHeaders: Record<string, string> = {
      ...(init.headers as Record<string, string>),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    if (scopeHeaderCenterId) {
      baseHeaders['X-CRM-Data-Scope-Center-Id'] = scopeHeaderCenterId;
    }
    const res = await fetch(path, {
      ...init,
      headers: baseHeaders,
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
    if (strength < 40) return '#ef4444';
    if (strength < 80) return '#d97706';
    return '#0d9488';
  };

  const getPasswordStrengthLabel = (strength: number): string => {
    if (strength < 40) return 'Weak';
    if (strength < 80) return 'Medium';
    return 'Strong';
  };

  const handleChangeOwnPassword = async () => {
    try {
      if (!currentPassword || !newPassword || !confirmPassword) {
        enqueueSnackbar('Please fill in all fields', { variant: 'warning' });
        return;
      }

      if (newPassword !== confirmPassword) {
        enqueueSnackbar('New passwords do not match', { variant: 'warning' });
        return;
      }

      const validation = validatePassword(newPassword);
      if (!validation.valid) {
        enqueueSnackbar(`Password requirements not met: ${validation.errors.join(', ')}`, { variant: 'warning' });
        return;
      }

      setActionLoading(true);
      await changePassword(currentPassword, newPassword);

      enqueueSnackbar('Password changed successfully', { variant: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActionLoading(false);
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to change password', { variant: 'error' });
      setActionLoading(false);
    }
  };

  const handleChangeOwnEmail = async () => {
    try {
      if (!newEmail || !emailPassword) {
        enqueueSnackbar('Please fill in all fields', { variant: 'warning' });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        enqueueSnackbar('Invalid email format', { variant: 'warning' });
        return;
      }

      setActionLoading(true);
      await changeEmail(newEmail, emailPassword);

      enqueueSnackbar('Email changed successfully', { variant: 'success' });
      setNewEmail('');
      setEmailPassword('');
      setActionLoading(false);
    } catch (error: unknown) {
      console.error('Error changing email:', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to change email', { variant: 'error' });
      setActionLoading(false);
    }
  };

  const handleResetUserPassword = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);

      await resetUserPassword(selectedUser.email);

      enqueueSnackbar(`Password reset email sent to ${selectedUser.email}`, { variant: 'success' });
      setResetDialogOpen(false);
      setSelectedUser(null);
      setActionLoading(false);
    } catch (error: unknown) {
      console.error('Error resetting password:', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to send password reset email', {
        variant: 'error',
      });
      setActionLoading(false);
    }
  };

  const handleChangeUserPassword = async () => {
    if (!selectedUser) return;

    try {
      if (!userNewPassword || !userConfirmPassword) {
        enqueueSnackbar('Please fill in all fields', { variant: 'warning' });
        return;
      }

      if (userNewPassword !== userConfirmPassword) {
        enqueueSnackbar('Passwords do not match', { variant: 'warning' });
        return;
      }

      const validation = validatePassword(userNewPassword);
      if (!validation.valid) {
        enqueueSnackbar(`Password requirements not met: ${validation.errors.join(', ')}`, { variant: 'warning' });
        return;
      }

      setActionLoading(true);
      await updateUserPassword(selectedUser.firebaseAuthUid, userNewPassword);

      enqueueSnackbar(`Password update queued for ${selectedUser.email}`, { variant: 'success' });
      setChangePasswordDialogOpen(false);
      setSelectedUser(null);
      setUserNewPassword('');
      setUserConfirmPassword('');
      setActionLoading(false);
    } catch (error: unknown) {
      console.error('Error changing user password:', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to update user password', { variant: 'error' });
      setActionLoading(false);
    }
  };

  const handleChangeUserEmail = async () => {
    if (!selectedUser || !user) return;

    try {
      if (!userNewEmail) {
        enqueueSnackbar('Please enter a new email address', { variant: 'warning' });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userNewEmail)) {
        enqueueSnackbar('Invalid email format', { variant: 'warning' });
        return;
      }

      setActionLoading(true);
      if (userProfile?.role === 'admin' && selectedUser.firebaseAuthUid !== user.uid) {
        await adminApi('/api/admin/update-user', {
          method: 'PATCH',
          body: JSON.stringify({ uid: selectedUser.firebaseAuthUid, email: userNewEmail.trim().toLowerCase() }),
        });
        enqueueSnackbar(`Email updated for ${selectedUser.email}`, { variant: 'success' });
      } else {
        await updateUserEmail(selectedUser.firebaseAuthUid, userNewEmail);
        enqueueSnackbar('Email updated', { variant: 'success' });
      }
      setChangeEmailDialogOpen(false);
      setSelectedUser(null);
      setUserNewEmail('');
      setActionLoading(false);
    } catch (error: unknown) {
      console.error('Error changing user email:', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to update user email', { variant: 'error' });
      setActionLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      const email = createUserEmail.trim().toLowerCase();
      const displayName = createUserName.trim();
      const role = createUserRole;

      if (!email) {
        enqueueSnackbar('Please enter an email address', { variant: 'warning' });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        enqueueSnackbar('Invalid email format', { variant: 'warning' });
        return;
      }
      if (!user) {
        enqueueSnackbar('You must be signed in as admin', { variant: 'warning' });
        return;
      }
      const resolvedCenterIds = lockedCenterId
        ? [lockedCenterId]
        : createUserCenterIds.length > 0
          ? createUserCenterIds
          : effectiveScopeCenterId
            ? [effectiveScopeCenterId]
            : [];
      if (lockedCenterId && resolvedCenterIds.some((id) => id !== lockedCenterId)) {
        enqueueSnackbar('Center must match your assigned center', { variant: 'warning' });
        return;
      }
      const needsCenters = role !== 'admin' || (role === 'admin' && !createUserSuperAdmin);
      if (needsCenters && resolvedCenterIds.length === 0) {
        enqueueSnackbar('Select at least one center for this user', { variant: 'warning' });
        return;
      }

      setActionLoading(true);
      const token = await user.getIdToken();
      const payload: Record<string, unknown> = { email, displayName, role };
      if (role !== 'admin' && createUserModules.length > 0) {
        payload.allowedModules = createUserModules;
      }
      if (role === 'admin') {
        payload.isSuperAdmin = createUserSuperAdmin;
      }
      if (resolvedCenterIds.length > 0) {
        payload.centerIds = resolvedCenterIds;
        payload.centerId = resolvedCenterIds[0];
      }
      const createHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (scopeHeaderCenterId) {
        createHeaders['X-CRM-Data-Scope-Center-Id'] = scopeHeaderCenterId;
      }
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: createHeaders,
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data?.ok) {
        enqueueSnackbar(data?.error || 'Failed to create user', { variant: 'error' });
        setActionLoading(false);
        return;
      }

      await resetUserPassword(email);

      enqueueSnackbar(`User created: ${email}. Password setup email sent.`, { variant: 'success' });
      setCreateUserDialogOpen(false);
      setCreateUserEmail('');
      setCreateUserName('');
      setCreateUserRole('staff');
      setCreateUserModules([]);
      setCreateUserCenterIds([]);
      setCreateUserSuperAdmin(false);
      setActionLoading(false);
    } catch (error: unknown) {
      console.error('Error creating user:', error);
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to create user', { variant: 'error' });
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser || deleteTypeConfirm !== 'DELETE') return;
    const removedUid = selectedUser.uid;
    const removedEmail = selectedUser.email;
    try {
      setActionLoading(true);
      await adminApi(`/api/admin/delete-user?uid=${encodeURIComponent(removedUid)}`, {
        method: 'DELETE',
      });
      setAllUsers((rows) => rows.filter((r) => r.uid !== removedUid));
      enqueueSnackbar(`User ${removedEmail} was removed`, { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeleteTypeConfirm('');
      setSelectedUser(null);
      setActionLoading(false);
    } catch (e: unknown) {
      enqueueSnackbar(e instanceof Error ? e.message : 'Failed to delete user', { variant: 'error' });
      setActionLoading(false);
    }
  };

  const openAccessDialog = (u: User) => {
    setSelectedUser(u);
    setEditAccessRole(u.role);
    setEditCenterId(normalizeCenterId(u) || '');
    setEditSuperAdmin(u.role === 'admin' && u.isSuperAdmin === true);
    setEditCenterSearch('');
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
      enqueueSnackbar('Select at least one module, or assign the Admin role for full access.', { variant: 'warning' });
      return;
    }
    if (
      editAccessRole === 'admin' &&
      editSuperAdmin &&
      !selectedUser.isSuperAdmin &&
      typeof window !== 'undefined' &&
      !window.confirm(
        'Grant super-admin access? This user can view all centers and use global data scope. Continue?',
      )
    ) {
      return;
    }
    const prevRows = allUsers;
    const targetDocId = selectedUser.uid;
    const targetEmail = selectedUser.email;
    const optimistic: User = {
      ...selectedUser,
      role: editAccessRole,
      allowedModules: editAccessRole === 'admin' ? ['*'] : editAccessModules,
      centerId: editCenterId || null,
      branchId: editCenterId || null,
      isSuperAdmin: editAccessRole === 'admin' ? editSuperAdmin : false,
    };
    setAllUsers((list) => list.map((row) => (row.uid === targetDocId ? optimistic : row)));
    setAccessDialogOpen(false);
    setSelectedUser(null);
    try {
      const body: Record<string, unknown> = {
        uid: selectedUser.firebaseAuthUid,
        role: editAccessRole,
        centerId: editCenterId || null,
        isSuperAdmin: editAccessRole === 'admin' ? editSuperAdmin : false,
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
      enqueueSnackbar(`Access updated for ${targetEmail}`, { variant: 'success' });
    } catch (e: unknown) {
      setAllUsers(prevRows);
      enqueueSnackbar(e instanceof Error ? e.message : 'Failed to update access', { variant: 'error' });
    }
  };

  if (authLoading) {
    return (
      <Box sx={{ bgcolor: PAGE_BG, minHeight: '100vh', py: 4 }}>
        <Container maxWidth="lg">
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Skeleton variant="rounded" width={160} height={24} />
            <Skeleton variant="rounded" width={320} height={40} />
            <Skeleton variant="rounded" width="100%" height={20} />
          </Stack>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
            <Skeleton variant="rounded" sx={{ flex: 1, borderRadius: 2, height: 420 }} />
            <Skeleton variant="rounded" sx={{ flex: 1, borderRadius: 2, height: 420 }} />
          </Stack>
          <Skeleton variant="rounded" sx={{ mt: 3, borderRadius: 2, height: 280 }} />
        </Container>
      </Box>
    );
  }

  const passwordStrength = getPasswordStrength(newPassword);

  const pwAdornment = (visible: boolean, toggle: () => void) => (
    <InputAdornment position="end">
      <IconButton
        edge="end"
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={toggle}
        size="small"
        sx={{ color: 'text.secondary' }}
      >
        {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <Box sx={{ bgcolor: PAGE_BG, minHeight: '100vh', py: { xs: 3, md: 4 }, fontFamily: 'inherit' }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Box sx={{ borderBottom: '1px solid #e8eaed', pb: 3 }}>
            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: '0.12em', color: 'text.secondary' }}>
              Administration
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mt: 1, color: 'text.primary' }}>
              User Management
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 560, lineHeight: 1.6 }}>
              Credentials, email, and access control for your organization. Changes sync in real time.
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 3,
            }}
          >
            <Paper elevation={0} sx={cardPaperSx}>
              <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 3 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    border: BORDER,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: CARD_BG,
                    boxShadow: SHADOW,
                  }}
                >
                  <KeyRoundIcon sx={{ color: 'text.secondary', fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                    Password
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Update your sign-in password
                  </Typography>
                </Box>
              </Stack>

              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                    Current password
                  </Typography>
                  <TextField
                    id="um-cur-pw"
                    fullWidth
                    size="small"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    variant="outlined"
                    InputProps={{ endAdornment: pwAdornment(showCurrentPassword, () => setShowCurrentPassword(!showCurrentPassword)) }}
                    sx={outlinedFieldSx}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                    New password
                  </Typography>
                  <TextField
                    id="um-new-pw"
                    fullWidth
                    size="small"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    variant="outlined"
                    InputProps={{ endAdornment: pwAdornment(showNewPassword, () => setShowNewPassword(!showNewPassword)) }}
                    sx={outlinedFieldSx}
                  />
                </Box>

                {newPassword ? (
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Strength
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: getPasswordStrengthColor(passwordStrength) }}>
                        {getPasswordStrengthLabel(passwordStrength)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={passwordStrength}
                      sx={{
                        height: 6,
                        borderRadius: 1,
                        bgcolor: '#e8eaed',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 1,
                          bgcolor: getPasswordStrengthColor(passwordStrength),
                        },
                      }}
                    />
                  </Box>
                ) : null}

                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                    Confirm new password
                  </Typography>
                  <TextField
                    id="um-confirm-pw"
                    fullWidth
                    size="small"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    error={confirmPassword !== '' && newPassword !== confirmPassword}
                    variant="outlined"
                    InputProps={{ endAdornment: pwAdornment(showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword)) }}
                    sx={outlinedFieldSx}
                  />
                  {confirmPassword !== '' && newPassword !== confirmPassword ? (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                      Passwords do not match
                    </Typography>
                  ) : null}
                </Box>

                <Button
                  variant="contained"
                  disableElevation
                  fullWidth
                  size="large"
                  onClick={handleChangeOwnPassword}
                  disabled={actionLoading || !currentPassword || !newPassword || !confirmPassword}
                  sx={{
                    mt: 1,
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 1.5,
                    bgcolor: BRAND,
                    '&:hover': { bgcolor: BRAND_HOVER },
                  }}
                >
                  Update password
                </Button>
              </Stack>

              <Paper
                elevation={0}
                sx={{
                  mt: 3,
                  p: 2.5,
                  bgcolor: '#f8f9fa',
                  border: '1px solid #eceef1',
                  borderRadius: 1.5,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary' }}>
                  REQUIREMENTS
                </Typography>
                <Stack spacing={1.25} sx={{ mt: 2 }}>
                  {[
                    { label: 'At least 8 characters', test: newPassword.length >= 8 },
                    { label: 'One lowercase letter', test: /(?=.*[a-z])/.test(newPassword) },
                    { label: 'One uppercase letter', test: /(?=.*[A-Z])/.test(newPassword) },
                    { label: 'One number', test: /(?=.*\d)/.test(newPassword) },
                    { label: 'One special character (@$!%*?&)', test: /(?=.*[@$!%*?&])/.test(newPassword) },
                  ].map((req, index) => (
                    <Stack direction="row" spacing={1.5} alignItems="center" key={index}>
                      {req.test ? (
                        <CheckCircleIcon sx={{ fontSize: 18, color: BRAND }} />
                      ) : (
                        <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '1px solid #dadce0' }} />
                      )}
                      <Typography variant="body2" color={req.test ? 'text.primary' : 'text.secondary'} sx={{ fontWeight: req.test ? 600 : 400 }}>
                        {req.label}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Paper>

            <Paper elevation={0} sx={cardPaperSx}>
              <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 3 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    border: BORDER,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: CARD_BG,
                    boxShadow: SHADOW,
                  }}
                >
                  <EmailOutlinedIcon sx={{ color: 'text.secondary', fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                    Email
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Change your sign-in email
                  </Typography>
                </Box>
              </Stack>

              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                    Current email
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailOutlinedIcon sx={{ color: 'action.disabled', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={outlinedFieldSx}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                    New email
                  </Typography>
                  <TextField
                    id="um-new-email"
                    fullWidth
                    size="small"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    variant="outlined"
                    sx={outlinedFieldSx}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                    Current password (confirm)
                  </Typography>
                  <TextField
                    id="um-email-pw"
                    fullWidth
                    size="small"
                    type={showEmailPassword ? 'text' : 'password'}
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    autoComplete="current-password"
                    variant="outlined"
                    InputProps={{ endAdornment: pwAdornment(showEmailPassword, () => setShowEmailPassword(!showEmailPassword)) }}
                    sx={outlinedFieldSx}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                    Required to verify this change.
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  disableElevation
                  fullWidth
                  size="large"
                  onClick={handleChangeOwnEmail}
                  disabled={actionLoading || !newEmail || !emailPassword}
                  sx={{
                    mt: 1,
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 1.5,
                    bgcolor: BRAND,
                    '&:hover': { bgcolor: BRAND_HOVER },
                  }}
                >
                  Update email
                </Button>
              </Stack>
            </Paper>
          </Box>

          {userProfile?.role === 'admin' && (
        <UserDirectoryTable
          users={users}
          centers={centers}
          onlineMap={onlineMap}
          currentUserId={user?.uid ?? null}
          usersLoading={usersLoading}
          scopeKey={`${effectiveScopeCenterId ?? 'all'}:${(allowedCenterIds ?? []).join(',')}`}
          onAddUser={() => setCreateUserDialogOpen(true)}
          onAccess={(u) => openAccessDialog(u as User)}
          onPassword={(u) => {
            setSelectedUser(u as User);
            setChangePasswordDialogOpen(true);
          }}
          onEmail={(u) => {
            setSelectedUser(u as User);
            setUserNewEmail(u.email);
            setChangeEmailDialogOpen(true);
          }}
          onReset={(u) => {
            setSelectedUser(u as User);
            setResetDialogOpen(true);
          }}
          onDelete={(u) => {
            setSelectedUser(u as User);
            setDeleteDialogOpen(true);
          }}
        />
          )}
        </Stack>
      </Container>

      {/* Reset Password Confirmation Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: 2, border: BORDER, boxShadow: '0px 8px 32px rgba(0,0,0,0.08)' } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Send password reset email</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Send a password reset email to <strong>{selectedUser?.email}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            The user will receive an email with instructions to reset their password.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleResetUserPassword}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: BRAND, '&:hover': { bgcolor: BRAND_HOVER } }}
          >
            Send reset email
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change User Password Dialog */}
      <Dialog
        open={changePasswordDialogOpen}
        onClose={() => setChangePasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2, border: BORDER, boxShadow: '0px 8px 32px rgba(0,0,0,0.08)' } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Change password — {selectedUser?.email}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                New password
              </Typography>
              <TextField
                id="um-admin-new-pw"
                fullWidth
                size="small"
                type={showUserPassword ? 'text' : 'password'}
                value={userNewPassword}
                onChange={(e) => setUserNewPassword(e.target.value)}
                autoComplete="new-password"
                variant="outlined"
                InputProps={{ endAdornment: pwAdornment(showUserPassword, () => setShowUserPassword(!showUserPassword)) }}
                sx={outlinedFieldSx}
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                Confirm new password
              </Typography>
              <TextField
                id="um-admin-confirm-pw"
                fullWidth
                size="small"
                type={showUserConfirmPassword ? 'text' : 'password'}
                value={userConfirmPassword}
                onChange={(e) => setUserConfirmPassword(e.target.value)}
                autoComplete="new-password"
                error={userConfirmPassword !== '' && userNewPassword !== userConfirmPassword}
                variant="outlined"
                InputProps={{
                  endAdornment: pwAdornment(showUserConfirmPassword, () => setShowUserConfirmPassword(!showUserConfirmPassword)),
                }}
                sx={outlinedFieldSx}
              />
              {userConfirmPassword !== '' && userNewPassword !== userConfirmPassword ? (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                  Passwords do not match
                </Typography>
              ) : null}
            </Box>
            {userNewPassword ? (
              <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Strength
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: getPasswordStrengthColor(getPasswordStrength(userNewPassword)) }}
                  >
                    {getPasswordStrengthLabel(getPasswordStrength(userNewPassword))}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={getPasswordStrength(userNewPassword)}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: '#e8eaed',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 1,
                      bgcolor: getPasswordStrengthColor(getPasswordStrength(userNewPassword)),
                    },
                  }}
                />
              </Box>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              Password updates are processed via your backend; the request may be stored in Firestore until completed.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setChangePasswordDialogOpen(false);
              setUserNewPassword('');
              setUserConfirmPassword('');
            }}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleChangeUserPassword}
            disabled={!userNewPassword || !userConfirmPassword || userNewPassword !== userConfirmPassword}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: BRAND, '&:hover': { bgcolor: BRAND_HOVER } }}
          >
            Update password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change User Email Dialog */}
      <Dialog
        open={changeEmailDialogOpen}
        onClose={() => setChangeEmailDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2, border: BORDER, boxShadow: '0px 8px 32px rgba(0,0,0,0.08)' } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Change email — {selectedUser?.displayName || selectedUser?.email}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                Current email
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="email"
                value={selectedUser?.email || ''}
                disabled
                sx={{ ...outlinedFieldSx, '& .MuiInputBase-input': { bgcolor: '#f8f9fa' } }}
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
                New email
              </Typography>
              <TextField
                id="um-admin-new-email"
                fullWidth
                size="small"
                type="email"
                value={userNewEmail}
                onChange={(e) => setUserNewEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
                variant="outlined"
                sx={outlinedFieldSx}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {userProfile?.role === 'admin' && selectedUser?.firebaseAuthUid !== user?.uid
                ? 'Updates both Firebase Authentication and the user profile where supported.'
                : 'Firestore may update immediately; Auth email changes may require a Cloud Function.'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setChangeEmailDialogOpen(false);
              setUserNewEmail('');
            }}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleChangeUserEmail}
            disabled={!userNewEmail || userNewEmail === selectedUser?.email}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: BRAND, '&:hover': { bgcolor: BRAND_HOVER } }}
          >
            Update email
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete user */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeleteTypeConfirm('');
        }}
        slotProps={{ paper: { sx: { borderRadius: 2, border: BORDER, boxShadow: '0px 8px 32px rgba(0,0,0,0.08)' } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete user</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
            Permanently remove <strong>{selectedUser?.email}</strong> from Authentication and the CRM user list? This cannot
            be undone.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Type <strong>DELETE</strong> to confirm.
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={deleteTypeConfirm}
            onChange={(e) => setDeleteTypeConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            inputProps={{ 'aria-label': 'Type DELETE to confirm' }}
            variant="outlined"
            sx={outlinedFieldSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteTypeConfirm('');
            }}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            color="error"
            onClick={handleDeleteUser}
            disabled={actionLoading || deleteTypeConfirm !== 'DELETE'}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Delete permanently
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role & module access */}
      <Dialog
        open={accessDialogOpen}
        onClose={() => setAccessDialogOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2, border: BORDER, boxShadow: '0px 8px 32px rgba(0,0,0,0.08)' } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Role &amp; access · {selectedUser?.email}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="edit-role-label">Role</InputLabel>
              <Select
                labelId="edit-role-label"
                value={editAccessRole}
                label="Role"
                onChange={(e) => setEditAccessRole(e.target.value as 'admin' | 'staff' | 'audiologist')}
              >
                <MenuItem value="staff">Staff</MenuItem>
                <MenuItem value="audiologist">Audiologist</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            {!lockedCenterId && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="Search centers"
                  value={editCenterSearch}
                  onChange={(e) => setEditCenterSearch(e.target.value)}
                  sx={outlinedFieldSx}
                />
                <FormControl fullWidth size="small">
                  <InputLabel id="edit-center-label">Center</InputLabel>
                  <Select
                    labelId="edit-center-label"
                    value={editCenterId}
                    label="Center"
                    onChange={(e) => setEditCenterId(e.target.value as string)}
                  >
                    <MenuItem value="">
                      <em>None (global)</em>
                    </MenuItem>
                    {filteredCentersForEdit.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
            {editAccessRole === 'admin' && userProfile && isSuperAdminViewer(userProfile) && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editSuperAdmin}
                    onChange={(e) => setEditSuperAdmin(e.target.checked)}
                    sx={{ color: BRAND, '&.Mui-checked': { color: BRAND } }}
                  />
                }
                label="Super admin"
              />
            )}
            {editAccessRole === 'admin' ? (
              <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                Administrators have full access to every module.
              </Alert>
            ) : (
              <>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Modules
                </Typography>
                <FormGroup sx={{ maxHeight: 280, overflow: 'auto', pl: 0.5 }}>
                  {CRM_MODULE_ACCESS_OPTIONS.map((opt) => (
                    <FormControlLabel
                      key={opt.key}
                      control={
                        <Checkbox
                          size="small"
                          checked={editAccessModules.includes(opt.key)}
                          onChange={() => toggleEditModule(opt.key)}
                          sx={{ color: BRAND, '&.Mui-checked': { color: BRAND } }}
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
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAccessDialogOpen(false)} sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveAccess}
            disabled={actionLoading}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: BRAND, '&:hover': { bgcolor: BRAND_HOVER } }}
          >
            Save changes
          </Button>
        </DialogActions>
      </Dialog>

      <CreateUserDialog
        open={createUserDialogOpen}
        onOpenChange={setCreateUserDialogOpen}
        centers={inviteCenters}
        lockedCenterId={lockedCenterId}
        userProfile={userProfile ?? null}
        createUserEmail={createUserEmail}
        setCreateUserEmail={setCreateUserEmail}
        createUserName={createUserName}
        setCreateUserName={setCreateUserName}
        createUserRole={createUserRole}
        setCreateUserRole={setCreateUserRole}
        createUserModules={createUserModules}
        setCreateUserModules={setCreateUserModules}
        createUserCenterIds={createUserCenterIds}
        setCreateUserCenterIds={setCreateUserCenterIds}
        createUserSuperAdmin={createUserSuperAdmin}
        setCreateUserSuperAdmin={setCreateUserSuperAdmin}
        actionLoading={actionLoading}
        onSubmit={handleCreateUser}
      />

    </Box>
  );
}

