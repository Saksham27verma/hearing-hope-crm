'use client';

import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  LinearProgress,
  Alert,
  Chip,
} from '@mui/material';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getHeadOfficeId } from '@/utils/centerUtils';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';

interface TransferStats {
  updated: number;
  skipped: number;
  total: number;
}

interface InventoryTransferProps {
  open: boolean;
  onClose: () => void;
}

const InventoryTransfer: React.FC<InventoryTransferProps> = ({ open, onClose }) => {
  const [transferring, setTransferring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCollection, setCurrentCollection] = useState('');
  const [stats, setStats] = useState<Record<string, TransferStats>>({});
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headOfficeName, setHeadOfficeName] = useState<string>('');

  const updateCollection = async (collectionName: string, headOfficeId: string): Promise<TransferStats> => {
    setCurrentCollection(collectionName);
    
    try {
      const collectionRef = collection(db, collectionName);
      const querySnapshot = await getDocs(collectionRef);
      
      let updatedCount = 0;
      let skippedCount = 0;
      const totalDocs = querySnapshot.docs.length;
      
      for (let i = 0; i < querySnapshot.docs.length; i++) {
        const docSnap = querySnapshot.docs[i];
        const data = docSnap.data();
        
        // Check if document already has the correct location
        if (data.location === headOfficeId) {
          skippedCount++;
        } else {
          // Update the document with head office location
          await updateDoc(doc(db, collectionName, docSnap.id), {
            location: headOfficeId,
            updatedAt: serverTimestamp()
          });
          updatedCount++;
        }
        
        // Update progress within this collection
        const collectionProgress = ((i + 1) / totalDocs) * 33.33; // Each collection is 1/3 of total progress
        const baseProgress = ['materialInward', 'purchases', 'materialsOut'].indexOf(collectionName) * 33.33;
        setProgress(Math.round(baseProgress + collectionProgress));
      }
      
      return { updated: updatedCount, skipped: skippedCount, total: totalDocs };
    } catch (error) {
      console.error(`Error updating ${collectionName}:`, error);
      throw error;
    }
  };

  const handleTransfer = async () => {
    setTransferring(true);
    setProgress(0);
    setStats({});
    setError(null);
    setCompleted(false);
    
    try {
      // Get head office
      const headOfficeId = await getHeadOfficeId();
      
      // Get head office name for display
      const centersQuery = collection(db, 'centers');
      const centersSnapshot = await getDocs(centersQuery);
      const headOffice = centersSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .find((center: any) => center.id === headOfficeId);
      
      setHeadOfficeName(headOffice?.name || headOfficeId);
      
      // Collections to update
      const collections = ['materialInward', 'purchases', 'materialsOut'];
      const newStats: Record<string, TransferStats> = {};
      
      // Update each collection
      for (const collectionName of collections) {
        const result = await updateCollection(collectionName, headOfficeId);
        newStats[collectionName] = result;
        setStats({ ...newStats }); // Update stats progressively
      }
      
      setProgress(100);
      setCompleted(true);
      
    } catch (error) {
      console.error('Error during transfer:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during transfer');
    } finally {
      setTransferring(false);
      setCurrentCollection('');
    }
  };

  const getTotalStats = () => {
    const totals = Object.values(stats).reduce(
      (acc, stat) => ({
        updated: acc.updated + stat.updated,
        skipped: acc.skipped + stat.skipped,
        total: acc.total + stat.total,
      }),
      { updated: 0, skipped: 0, total: 0 }
    );
    return totals;
  };

  const handleClose = () => {
    if (!transferring) {
      onClose();
      // Reset state
      setStats({});
      setCompleted(false);
      setError(null);
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TransferWithinAStationIcon color="primary" />
        Transfer Inventory to Head Office
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            This will transfer all existing inventory records (Material Inward, Purchases, and Materials Out) 
            to your designated head office for proper inventory management.
          </Typography>
          
          {headOfficeName && (
            <Alert severity="info" sx={{ mt: 2 }}>
              All inventory will be transferred to: <strong>{headOfficeName}</strong>
            </Alert>
          )}
        </Box>

        {transferring && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {currentCollection ? `Processing ${currentCollection}...` : 'Starting transfer...'}
            </Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {progress}% Complete
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Error: {error}
          </Alert>
        )}

        {Object.keys(stats).length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>Transfer Progress:</Typography>
            {Object.entries(stats).map(([collection, stat]) => (
              <Box key={collection} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {collection.charAt(0).toUpperCase() + collection.slice(1)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={`Updated: ${stat.updated}`} color="success" size="small" />
                  <Chip label={`Skipped: ${stat.skipped}`} color="default" size="small" />
                  <Chip label={`Total: ${stat.total}`} color="primary" size="small" />
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {completed && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Transfer Completed Successfully!</Typography>
            <Typography variant="body2">
              Total: {getTotalStats().updated} records updated, {getTotalStats().skipped} already correct
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={transferring}>
          {completed ? 'Close' : 'Cancel'}
        </Button>
        {!completed && (
          <Button
            variant="contained"
            onClick={handleTransfer}
            disabled={transferring}
            startIcon={<TransferWithinAStationIcon />}
          >
            {transferring ? 'Transferring...' : 'Start Transfer'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InventoryTransfer;
