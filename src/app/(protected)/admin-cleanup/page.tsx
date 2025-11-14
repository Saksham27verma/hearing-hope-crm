'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  LinearProgress,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  DeleteSweep as DeleteIcon,
  Storage as DatabaseIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Lock as LockIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  writeBatch,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';

interface CleanupStats {
  collectionName: string;
  status: 'pending' | 'cleaning' | 'completed' | 'error';
  documentsDeleted: number;
  totalDocuments: number;
  error?: string;
}

const collectionsToClean = [
  { name: 'stockTransfers', label: 'Stock Transfers' },
  { name: 'enquiries', label: 'Enquiries' },
  { name: 'purchases', label: 'Purchases' },
  { name: 'materialInward', label: 'Material Inward' },
  { name: 'materialsOut', label: 'Material Outward' },
  { name: 'sales', label: 'Sales' },
  { name: 'distributions', label: 'Distribution Sales' },
  { name: 'parties', label: 'Parties' },
  { name: 'telecallingRecords', label: 'Telecalling Records' },
  { name: 'staff', label: 'Staff Management' },
  { name: 'visitors', label: 'Visitors' },
  { name: 'inventory', label: 'Inventory Records' },
  { name: 'cashRegister', label: 'Cash Register' },
  { name: 'appointments', label: 'Appointments' },
  { name: 'interaction', label: 'Interactions' },
];

const preservedCollections = [
  'centers',
  'users',
  'products',
];

export default function AdminCleanupPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CleanupStats[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [totalProgress, setTotalProgress] = useState(0);
  
  // Password protection states
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  // Password change states
  const [changePasswordDialog, setChangePasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showChangePasswords, setShowChangePasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Default cleanup password
  const DEFAULT_PASSWORD = 'Saksham27*';

  const updateStats = (collectionName: string, updates: Partial<CleanupStats>) => {
    setStats(prev => {
      const index = prev.findIndex(s => s.collectionName === collectionName);
      if (index === -1) {
        return [...prev, { collectionName, status: 'pending', documentsDeleted: 0, totalDocuments: 0, ...updates }];
      } else {
        const newStats = [...prev];
        newStats[index] = { ...newStats[index], ...updates };
        return newStats;
      }
    });
  };

  // Get stored cleanup password
  const getCleanupPassword = async (): Promise<string> => {
    try {
      const passwordDoc = await getDoc(doc(db, 'settings', 'cleanupPassword'));
      if (passwordDoc.exists()) {
        return passwordDoc.data().password;
      }
      return DEFAULT_PASSWORD;
    } catch (error) {
      console.error('Error getting cleanup password:', error);
      return DEFAULT_PASSWORD;
    }
  };

  // Verify password
  const verifyPassword = async (password: string): Promise<boolean> => {
    const storedPassword = await getCleanupPassword();
    return password === storedPassword;
  };

  // Handle password verification
  const handlePasswordSubmit = async () => {
    setPasswordError('');
    
    const isValid = await verifyPassword(enteredPassword);
    if (isValid) {
      setPasswordDialog(false);
      setEnteredPassword('');
      setConfirmDialog(true);
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      alert('New passwords do not match!');
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long!');
      return;
    }

    const isCurrentValid = await verifyPassword(currentPassword);
    if (!isCurrentValid) {
      alert('Current password is incorrect!');
      return;
    }

    try {
      await setDoc(doc(db, 'settings', 'cleanupPassword'), {
        password: newPassword,
        updatedBy: user?.email,
        updatedAt: new Date()
      });
      
      alert('Password changed successfully!');
      setChangePasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Failed to change password. Please try again.');
    }
  };

  const cleanCollection = async (collectionName: string): Promise<number> => {
    updateStats(collectionName, { status: 'cleaning' });
    
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const totalDocs = querySnapshot.size;
      
      updateStats(collectionName, { totalDocuments: totalDocs });
      
      if (totalDocs === 0) {
        updateStats(collectionName, { status: 'completed', documentsDeleted: 0 });
        return 0;
      }

      // Delete in batches of 500 (Firestore limit)
      const docs = querySnapshot.docs;
      let deletedCount = 0;
      
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const batchDocs = docs.slice(i, i + 500);
        
        batchDocs.forEach((docSnapshot) => {
          batch.delete(doc(db, collectionName, docSnapshot.id));
        });
        
        await batch.commit();
        deletedCount += batchDocs.length;
        
        updateStats(collectionName, { documentsDeleted: deletedCount });
      }
      
      updateStats(collectionName, { status: 'completed', documentsDeleted: deletedCount });
      return deletedCount;
      
    } catch (error: any) {
      updateStats(collectionName, { 
        status: 'error', 
        error: error.message 
      });
      return 0;
    }
  };

  const runCleanup = async () => {
    setIsRunning(true);
    setStats([]);
    setTotalProgress(0);
    
    let totalDeleted = 0;
    
    for (let i = 0; i < collectionsToClean.length; i++) {
      const { name } = collectionsToClean[i];
      const deleted = await cleanCollection(name);
      totalDeleted += deleted;
      
      const progress = ((i + 1) / collectionsToClean.length) * 100;
      setTotalProgress(progress);
    }
    
    setIsRunning(false);
    console.log(`✨ Cleanup completed! Total documents deleted: ${totalDeleted}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'cleaning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <SuccessIcon color="success" />;
      case 'cleaning':
        return <CircularProgress size={24} />;
      case 'error':
        return <WarningIcon color="error" />;
      default:
        return <DatabaseIcon color="action" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          🧹 Database Cleanup Tool
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Clean all user data from your CRM to start fresh for testing.
        </Typography>
      </Box>

      {/* Warning Alert */}
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          ⚠️ This action cannot be undone!
        </Typography>
        <Typography variant="body2">
          This will permanently delete all data from the selected collections. 
          The following collections will be preserved: {preservedCollections.join(', ')}
        </Typography>
      </Alert>

      {/* Password Management */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => setChangePasswordDialog(true)}
          size="small"
        >
          Change Cleanup Password
        </Button>
      </Box>

      {/* Collections to Clean */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Collections to Clean
          </Typography>
          <List dense>
            {collectionsToClean.map(({ name, label }) => {
              const stat = stats.find(s => s.collectionName === name);
              return (
                <ListItem key={name}>
                  <ListItemIcon>
                    {getStatusIcon(stat?.status || 'pending')}
                  </ListItemIcon>
                  <ListItemText
                    primary={label}
                    secondary={
                      stat ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip 
                            label={stat.status} 
                            size="small" 
                            color={getStatusColor(stat.status) as any}
                            variant="outlined"
                          />
                          {stat.totalDocuments > 0 && (
                            <Typography variant="caption">
                              {stat.documentsDeleted}/{stat.totalDocuments} deleted
                            </Typography>
                          )}
                          {stat.error && (
                            <Typography variant="caption" color="error">
                              Error: {stat.error}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        `Collection: ${name}`
                      )
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Paper>

      {/* Progress */}
      {isRunning && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Cleanup Progress
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={totalProgress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
            {Math.round(totalProgress)}% Complete
          </Typography>
        </Paper>
      )}

      {/* Action Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="error"
          size="large"
          startIcon={<DeleteIcon />}
          onClick={() => setPasswordDialog(true)}
          disabled={isRunning}
          sx={{ minWidth: 200 }}
        >
          {isRunning ? 'Cleaning...' : 'Start Cleanup'}
        </Button>
      </Box>

      {/* Password Protection Dialog */}
      <Dialog open={passwordDialog} onClose={() => setPasswordDialog(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockIcon color="error" />
          Enter Cleanup Password
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This action requires administrator password verification.
          </Typography>
          <TextField
            fullWidth
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={enteredPassword}
            onChange={(e) => setEnteredPassword(e.target.value)}
            error={!!passwordError}
            helperText={passwordError}
            onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            InputProps={{
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handlePasswordSubmit}
            disabled={!enteredPassword}
          >
            Verify
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordDialog} onClose={() => setChangePasswordDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Cleanup Password</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Current Password"
              type={showChangePasswords.current ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowChangePasswords(prev => ({ ...prev, current: !prev.current }))}
                      edge="end"
                    >
                      {showChangePasswords.current ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="New Password"
              type={showChangePasswords.new ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowChangePasswords(prev => ({ ...prev, new: !prev.new }))}
                      edge="end"
                    >
                      {showChangePasswords.new ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Confirm New Password"
              type={showChangePasswords.confirm ? 'text' : 'password'}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowChangePasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      edge="end"
                    >
                      {showChangePasswords.confirm ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePasswordDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleChangePassword}
            disabled={!currentPassword || !newPassword || !confirmNewPassword}
          >
            Change Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)}>
        <DialogTitle>⚠️ Confirm Database Cleanup</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you absolutely sure you want to delete all data from the following collections?
          </Typography>
          <Box sx={{ mt: 2 }}>
            {collectionsToClean.map(({ label }) => (
              <Chip key={label} label={label} sx={{ m: 0.5 }} />
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary">
            This action will permanently delete all user data and cannot be undone.
            Collections "{preservedCollections.join('", "')}" will be preserved.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={() => {
              setConfirmDialog(false);
              runCleanup();
            }}
          >
            Yes, Delete All Data
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
