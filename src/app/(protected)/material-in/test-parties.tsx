'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Box, Typography, Button, Paper, List, ListItem, ListItemText, Divider, Stack } from '@mui/material';

// Simple component to test fetching and displaying parties from Firestore
export default function TestParties() {
  const [parties, setParties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const fetchParties = async () => {
    try {
      setLoading(true);
      setMessage('');
      const partiesCollection = collection(db, 'parties');
      const snapshot = await getDocs(partiesCollection);
      
      const partiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log("Fetched parties:", partiesData);
      setParties(partiesData);
      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching parties:", err);
      setError(err.message || 'Failed to fetch parties');
      setLoading(false);
    }
  };

  // Add a test supplier to the database
  const addTestSupplier = async () => {
    try {
      setLoading(true);
      setMessage('');
      
      const testSupplierData = {
        name: `Test Supplier ${new Date().toISOString().slice(0, 19)}`,
        category: 'supplier',
        gstType: 'LGST',
        phone: '1234567890',
        email: 'test@example.com',
        address: 'Test Address',
        contactPerson: 'Test Contact'
      };
      
      const docRef = await addDoc(collection(db, 'parties'), testSupplierData);
      
      setMessage(`Successfully added test supplier with ID: ${docRef.id}`);
      await fetchParties();
    } catch (err: any) {
      console.error("Error adding test supplier:", err);
      setError(err.message || 'Failed to add test supplier');
      setLoading(false);
    }
  };

  // Fix existing parties by adding category if missing
  const fixParties = async () => {
    try {
      setLoading(true);
      setMessage('');
      
      let fixedCount = 0;
      
      // Find parties without category and add it
      for (const party of parties) {
        if (!party.category) {
          const partyRef = doc(db, 'parties', party.id);
          await setDoc(partyRef, { 
            ...party, 
            category: 'supplier' // Default to supplier
          }, { merge: true });
          fixedCount++;
        }
      }
      
      setMessage(`Fixed ${fixedCount} parties by adding category`);
      await fetchParties();
    } catch (err: any) {
      console.error("Error fixing parties:", err);
      setError(err.message || 'Failed to fix parties');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Parties Collection Test</Typography>
      
      <Stack direction="row" spacing={2} mb={2}>
        <Button 
          variant="contained" 
          onClick={fetchParties} 
          disabled={loading}
        >
          Refresh Parties
        </Button>
        
        <Button 
          variant="contained" 
          color="success" 
          onClick={addTestSupplier} 
          disabled={loading}
        >
          Add Test Supplier
        </Button>
        
        <Button 
          variant="contained" 
          color="warning" 
          onClick={fixParties} 
          disabled={loading}
        >
          Fix Missing Categories
        </Button>
      </Stack>
      
      {loading && <Typography>Loading parties...</Typography>}
      {error && <Typography color="error">{error}</Typography>}
      {message && <Typography color="success" sx={{ mt: 1, mb: 1 }}>{message}</Typography>}
      
      <Paper elevation={1} sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6" gutterBottom>All Parties ({parties.length})</Typography>
        <List>
          {parties.length > 0 ? (
            parties.map(party => (
              <Box key={party.id}>
                <ListItem>
                  <ListItemText 
                    primary={party.name || 'Unnamed party'} 
                    secondary={
                      <Box>
                        <Typography variant="body2">ID: {party.id}</Typography>
                        <Typography variant="body2">Category: {party.category || 'Not set'}</Typography>
                        <Typography variant="body2">GST Type: {party.gstType || 'Not set'}</Typography>
                        {party.phone && <Typography variant="body2">Phone: {party.phone}</Typography>}
                      </Box>
                    }
                  />
                </ListItem>
                <Divider />
              </Box>
            ))
          ) : (
            <Typography variant="body1">No parties found in the database</Typography>
          )}
        </List>
      </Paper>
    </Box>
  );
} 