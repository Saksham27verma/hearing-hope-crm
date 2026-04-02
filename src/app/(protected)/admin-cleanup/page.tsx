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
  const [pendingDestructiveAction, setPendingDestructiveAction] = useState<
    'deleteAllData' | 'purgeMisclassifiedEnquirySales' | 'operationalReset' | null
  >(null);
  const [totalProgress, setTotalProgress] = useState(0);
  const [resyncingSales, setResyncingSales] = useState(false);
  const [resyncResult, setResyncResult] = useState<string>('');

  const [purgeMisclassifiedRunning, setPurgeMisclassifiedRunning] = useState(false);
  const [purgeMisclassifiedPreviewCount, setPurgeMisclassifiedPreviewCount] = useState<number | null>(null);
  const [purgeMisclassifiedResult, setPurgeMisclassifiedResult] = useState<string>('');

  const [operationalResetBusy, setOperationalResetBusy] = useState(false);
  const [operationalDryRunText, setOperationalDryRunText] = useState<string>('');
  const [operationalResetResult, setOperationalResetResult] = useState<string>('');
  
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

  const handleResyncHistoricalSales = async () => {
    try {
      if (!user) {
        alert('Please sign in again.');
        return;
      }
      setResyncingSales(true);
      setResyncResult('');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/resync-enquiry-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        processedVisits?: number;
        createdSales?: number;
        updatedSales?: number;
        allocatedInvoiceNumbers?: number;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to re-sync sales');
      }
      setResyncResult(
        `Done. Processed ${json.processedVisits || 0} sale visits, created ${json.createdSales || 0} sales docs, updated ${json.updatedSales || 0}, allocated ${json.allocatedInvoiceNumbers || 0} invoice numbers.`
      );
    } catch (e) {
      console.error(e);
      setResyncResult(`Error: ${e instanceof Error ? e.message : 'Failed to re-sync sales'}`);
    } finally {
      setResyncingSales(false);
    }
  };

  const previewAndPurgeMisclassifiedEnquirySales = async (dryRun: boolean) => {
    if (!user) {
      alert('Please sign in again.');
      return;
    }

    setPurgeMisclassifiedRunning(true);
    setPurgeMisclassifiedResult('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/purge-misclassified-enquiry-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dryRun }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; misclassifiedCount?: number; deletedCount?: number };
      if (!res.ok || !json.ok) throw new Error(json.error || 'Failed to purge misclassified enquiry sales');

      if (dryRun) {
        setPurgeMisclassifiedPreviewCount(json.misclassifiedCount || 0);
        setPurgeMisclassifiedResult(`Preview: ${json.misclassifiedCount || 0} misclassified enquiry sale(s) would be deleted.`);
      } else {
        setPurgeMisclassifiedResult(`Deleted: ${json.deletedCount || 0} misclassified enquiry sale(s).`);
        setPurgeMisclassifiedPreviewCount(null);
      }
    } catch (e) {
      console.error(e);
      setPurgeMisclassifiedResult(`Error: ${e instanceof Error ? e.message : 'Failed to purge misclassified enquiry sales'}`);
    } finally {
      setPurgeMisclassifiedRunning(false);
    }
  };

  const previewOperationalReset = async () => {
    if (!user) {
      alert('Please sign in again.');
      return;
    }
    setOperationalResetBusy(true);
    setOperationalDryRunText('');
    setOperationalResetResult('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/operational-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dryRun: true }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        collectionCounts?: Record<string, number>;
        enquiryCount?: number;
        collectionErrors?: Record<string, string>;
      };
      if (!res.ok || !json.ok) throw new Error(json.error || 'Preview failed');

      const lines: string[] = [];
      lines.push(`Enquiries to sanitize (documents kept, visits/payments cleared): ${json.enquiryCount ?? 0}`);
      lines.push('');
      lines.push('Collections to delete (document counts):');
      const entries = Object.entries(json.collectionCounts || {}).sort(([a], [b]) => a.localeCompare(b));
      for (const [name, n] of entries) {
        lines.push(`  • ${name}: ${n < 0 ? 'error' : n}`);
      }
      if (json.collectionErrors && Object.keys(json.collectionErrors).length > 0) {
        lines.push('');
        lines.push('Count errors:');
        for (const [k, v] of Object.entries(json.collectionErrors)) {
          lines.push(`  • ${k}: ${v}`);
        }
      }
      setOperationalDryRunText(lines.join('\n'));
    } catch (e) {
      console.error(e);
      setOperationalDryRunText(`Error: ${e instanceof Error ? e.message : 'Preview failed'}`);
    } finally {
      setOperationalResetBusy(false);
    }
  };

  const executeOperationalReset = async () => {
    if (!user) {
      alert('Please sign in again.');
      return;
    }
    setOperationalResetBusy(true);
    setOperationalResetResult('');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/operational-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dryRun: false }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        deletedByCollection?: Record<string, number>;
        enquiriesRewritten?: number;
        collectionErrors?: Record<string, string>;
      };
      if (!res.ok) throw new Error(json.error || 'Operational reset failed');

      const lines: string[] = [];
      lines.push(`Enquiries rewritten (patient basics only): ${json.enquiriesRewritten ?? 0}`);
      lines.push('');
      lines.push('Deleted per collection:');
      const entries = Object.entries(json.deletedByCollection || {}).sort(([a], [b]) => a.localeCompare(b));
      for (const [name, n] of entries) {
        lines.push(`  • ${name}: ${n}`);
      }
      if (json.collectionErrors && Object.keys(json.collectionErrors).length > 0) {
        lines.push('');
        lines.push('Errors (partial run possible):');
        for (const [k, v] of Object.entries(json.collectionErrors)) {
          lines.push(`  • ${k}: ${v}`);
        }
      }
      lines.push('');
      lines.push(json.ok ? 'Completed with no reported errors.' : 'Completed with errors — check list above; you can retry.');
      setOperationalResetResult(lines.join('\n'));
    } catch (e) {
      console.error(e);
      setOperationalResetResult(`Error: ${e instanceof Error ? e.message : 'Operational reset failed'}`);
    } finally {
      setOperationalResetBusy(false);
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

      {/* Operational reset: keep enquiry identities, wipe inventory / sales / visits */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Operational reset (keep patient enquiries)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Deletes inventory, sales, appointments, visitors, cash sheets, Hope AI index logs, and related transactional
          collections. <strong>Does not delete</strong> users, centers, products, companies, parties, staff, or settings.
          Each <code>enquiries</code> document is kept with the same ID but stripped to basic fields;{' '}
          <code>visits</code>, <code>followUps</code>, and <code>payments</code> are cleared.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This is separate from <strong>Start Cleanup</strong> below, which removes enquiries entirely. Use preview first,
          then run after entering the cleanup password.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Button
            variant="outlined"
            onClick={previewOperationalReset}
            disabled={operationalResetBusy || isRunning || purgeMisclassifiedRunning || resyncingSales}
          >
            {operationalResetBusy ? 'Working…' : 'Preview (dry-run)'}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setPendingDestructiveAction('operationalReset');
              setPasswordDialog(true);
            }}
            disabled={operationalResetBusy || isRunning || purgeMisclassifiedRunning || resyncingSales}
          >
            Run operational reset
          </Button>
        </Box>
        {operationalDryRunText ? (
          <Alert severity={operationalDryRunText.startsWith('Error:') ? 'error' : 'info'} sx={{ mb: 1 }}>
            <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', m: 0 }}>
              {operationalDryRunText}
            </Typography>
          </Alert>
        ) : null}
        {operationalResetResult ? (
          <Alert severity={operationalResetResult.startsWith('Error:') ? 'error' : 'warning'} sx={{ mt: 1 }}>
            <Typography component="pre" variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', m: 0 }}>
              {operationalResetResult}
            </Typography>
          </Alert>
        ) : null}
      </Paper>

      {/* Historical Sales Re-sync */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Re-sync Historical Enquiry Sales
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          One-click backfill: creates/updates `sales` records from old enquiry sale visits and assigns missing/provisional invoice numbers.
        </Typography>
        <Button
          variant="contained"
          onClick={handleResyncHistoricalSales}
          disabled={resyncingSales || isRunning || operationalResetBusy}
        >
          {resyncingSales ? 'Re-syncing…' : 'Re-sync Enquiry Sales → Sales Collection'}
        </Button>
        {resyncResult ? (
          <Alert severity={resyncResult.startsWith('Error:') ? 'error' : 'success'} sx={{ mt: 2 }}>
            {resyncResult}
          </Alert>
        ) : null}
      </Paper>

      {/* Purge Misclassified Enquiry Sales */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Purge Misclassified Enquiry Sales
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Deletes `sales` documents created from enquiry visits that are not true sale visits (prevents booking-only invoices from appearing in Sales &amp; Invoicing).
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Button
            variant="outlined"
            onClick={() => previewAndPurgeMisclassifiedEnquirySales(true)}
            disabled={purgeMisclassifiedRunning || isRunning || operationalResetBusy}
          >
            {purgeMisclassifiedRunning ? 'Checking…' : 'Preview (dry-run)'}
          </Button>

          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setPendingDestructiveAction('purgeMisclassifiedEnquirySales');
              setPasswordDialog(true);
            }}
            disabled={purgeMisclassifiedRunning || isRunning || operationalResetBusy}
          >
            Delete Misclassified
          </Button>
        </Box>

        {purgeMisclassifiedPreviewCount != null ? (
          <Alert severity={purgeMisclassifiedPreviewCount > 0 ? 'warning' : 'success'} sx={{ mb: 1 }}>
            Preview: {purgeMisclassifiedPreviewCount} misclassified enquiry sale(s).
          </Alert>
        ) : null}
        {purgeMisclassifiedResult ? (
          <Alert severity={purgeMisclassifiedResult.startsWith('Error:') ? 'error' : 'success'} sx={{ mt: 1 }}>
            {purgeMisclassifiedResult}
          </Alert>
        ) : null}
      </Paper>

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
          onClick={() => {
            setPendingDestructiveAction('deleteAllData');
            setPasswordDialog(true);
          }}
          disabled={isRunning || operationalResetBusy}
          sx={{ minWidth: 200 }}
        >
          {isRunning ? 'Cleaning...' : 'Start Cleanup'}
        </Button>
      </Box>

      {/* Password Protection Dialog */}
      <Dialog
        open={passwordDialog}
        onClose={() => {
          setPasswordDialog(false);
          setPendingDestructiveAction(null);
        }}
      >
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
          <Button
            onClick={() => {
              setPasswordDialog(false);
              setPendingDestructiveAction(null);
            }}
          >
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
      <Dialog
        open={confirmDialog}
        onClose={() => {
          setConfirmDialog(false);
          setPendingDestructiveAction(null);
        }}
      >
        <DialogTitle>⚠️ Confirm Database Cleanup</DialogTitle>
        <DialogContent>
          {pendingDestructiveAction === 'operationalReset' ? (
            <>
              <Typography variant="body1" gutterBottom>
                Run operational reset?
              </Typography>
              <Alert severity="warning" sx={{ my: 2 }}>
                This permanently deletes sales, purchases, stock movements, appointments, visitors, cash sheets, Hope AI
                index data, and other transactional collections. Enquiry documents stay but lose visits, follow-ups, and
                payments—only basic patient/lead fields remain. Users, centers, products, parties, and staff are not
                deleted.
              </Alert>
              <Typography variant="body2" color="text.secondary">
                Run preview first if you have not checked counts. Large databases may need more than one run if the
                server times out.
              </Typography>
            </>
          ) : pendingDestructiveAction === 'purgeMisclassifiedEnquirySales' ? (
            <>
              <Typography variant="body1" gutterBottom>
                Delete misclassified enquiry sales from `sales`?
              </Typography>
              <Alert severity="warning" sx={{ my: 2 }}>
                This will delete misclassified `sales` docs (`source="enquiry"`) whose linked enquiry visit is not marked as a true sale.
              </Alert>
              {purgeMisclassifiedPreviewCount != null ? (
                <Typography variant="body2" color="text.secondary">
                  Preview count: {purgeMisclassifiedPreviewCount} document(s).
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Preview count not available yet (run dry-run first if you need exact numbers).
                </Typography>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setConfirmDialog(false);
              setPendingDestructiveAction(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={async () => {
              setConfirmDialog(false);
              const action = pendingDestructiveAction;
              setPendingDestructiveAction(null);
              if (action === 'purgeMisclassifiedEnquirySales') {
                await previewAndPurgeMisclassifiedEnquirySales(false);
              } else if (action === 'operationalReset') {
                await executeOperationalReset();
              } else {
                runCleanup();
              }
            }}
          >
            {pendingDestructiveAction === 'operationalReset'
              ? 'Yes, run operational reset'
              : pendingDestructiveAction === 'purgeMisclassifiedEnquirySales'
                ? 'Yes, Delete Misclassified'
                : 'Yes, Delete All Data'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
