'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Chip,
  InputAdornment,
  IconButton,
  Divider,
  CircularProgress,
  Paper,
  Avatar,
  Fade,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  LocalShipping as ShippingIcon,
  Store as StoreIcon,
  Hearing as HearingIcon,
  ContactPhone as ContactIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  getDocs, 
  query, 
  limit,
  where
} from 'firebase/firestore';
import { db } from '@/firebase/config';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'enquiry' | 'product' | 'party' | 'material-in' | 'material-out' | 'purchase' | 'sale' | 'center';
  path: string;
  icon: React.ReactNode;
  color: string;
  description?: string;
  metadata?: Record<string, any>;
}

interface UniversalSearchProps {
  open: boolean;
  onClose: () => void;
}

// Quick actions for the search dialog
const quickActions = [
  { name: 'New Enquiry', path: '/interaction/enquiries/new', icon: <PersonIcon />, color: '#2196f3' },
  { name: 'Add Product', path: '/products', icon: <HearingIcon />, color: '#ff9800' },
  { name: 'View Inventory', path: '/inventory', icon: <InventoryIcon />, color: '#4caf50' },
  { name: 'Sales Report', path: '/reports', icon: <AssignmentIcon />, color: '#9c27b0' },
];

const navigationShortcuts = [
  { text: 'Dashboard', path: '/dashboard', icon: <AssignmentIcon />, color: '#2196f3' },
  { text: 'Products', path: '/products', icon: <HearingIcon />, color: '#ff9800' },
  { text: 'Inventory', path: '/inventory', icon: <InventoryIcon />, color: '#4caf50' },
  { text: 'Material Out', path: '/material-out', icon: <ShippingIcon />, color: '#f44336' },
  { text: 'Sales', path: '/sales', icon: <ReceiptIcon />, color: '#9c27b0' },
  { text: 'Parties', path: '/parties', icon: <BusinessIcon />, color: '#00bcd4' },
];

const UniversalSearch: React.FC<UniversalSearchProps> = ({ open, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Debounced search function
  const debouncedSearch = useCallback(
    (term: string) => {
      const timer = setTimeout(() => {
        if (term.trim().length >= 2) {
          performSearch(term);
        } else {
          setResults([]);
        }
      }, 300);
      return () => clearTimeout(timer);
    },
    []
  );

  useEffect(() => {
    if (searchTerm) {
      setLoading(true);
      const cleanup = debouncedSearch(searchTerm);
      return cleanup;
    } else {
      setResults([]);
      setLoading(false);
    }
  }, [searchTerm, debouncedSearch]);

  const performSearch = async (term: string) => {
    try {
      setLoading(true);
      const searchResults: SearchResult[] = [];
      const searchTermLower = term.toLowerCase();

      // Search Enquiries (Patients)
      try {
        const enquiriesQuery = query(collection(db, 'enquiries'), limit(50));
        const enquiriesSnapshot = await getDocs(enquiriesQuery);
        
        enquiriesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const name = data.name || '';
          const phone = data.phone || '';
          const email = data.email || '';
          const reference = data.reference || '';
          const address = data.address || '';
          const assignedTo = data.assignedTo || '';
          const telecaller = data.telecaller || '';
          const status = data.visitStatus || data.status || '';
          
          if (
            name.toLowerCase().includes(searchTermLower) ||
            phone.includes(searchTermLower) ||
            email.toLowerCase().includes(searchTermLower) ||
            reference.toLowerCase().includes(searchTermLower) ||
            address.toLowerCase().includes(searchTermLower) ||
            assignedTo.toLowerCase().includes(searchTermLower) ||
            telecaller.toLowerCase().includes(searchTermLower)
          ) {
            searchResults.push({
              id: doc.id,
              title: name,
              subtitle: `Enquiry • ${phone} ${reference ? `• Ref: ${reference}` : ''}`,
              type: 'enquiry',
              path: `/interaction/enquiries/${doc.id}`,
              icon: <PersonIcon />,
              color: '#ff6b35',
              description: email || address || `Status: ${status}`,
              metadata: { 
                phone, 
                email, 
                reference, 
                address,
                assignedTo,
                telecaller,
                status,
                type: 'enquiry' 
              }
            });
          }
        });
      } catch (error) {
        console.error('Error searching enquiries:', error);
      }

      // Search Products
      try {
        const productsQuery = query(collection(db, 'products'), limit(30));
        const productsSnapshot = await getDocs(productsQuery);
        
        productsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const name = data.name || '';
          const company = data.company || '';
          const type = data.type || '';
          
          if (
            name.toLowerCase().includes(searchTermLower) ||
            company.toLowerCase().includes(searchTermLower) ||
            type.toLowerCase().includes(searchTermLower)
          ) {
            searchResults.push({
              id: doc.id,
              title: name,
              subtitle: `Product • ${company}`,
              type: 'product',
              path: `/products#id=${doc.id}`,
              icon: <HearingIcon />,
              color: '#ff9800',
              description: `${type} • ₹${data.mrp || 0}`,
              metadata: { company, type, mrp: data.mrp }
            });
          }
        });
      } catch (error) {
        console.error('Error searching products:', error);
      }

      // Search Parties (Suppliers/Customers)
      try {
        const partiesQuery = query(collection(db, 'parties'), limit(30));
        const partiesSnapshot = await getDocs(partiesQuery);
        
        partiesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const name = data.name || '';
          const phone = data.phone || '';
          const email = data.email || '';
          const category = data.category || '';
          
          if (
            name.toLowerCase().includes(searchTermLower) ||
            phone.includes(searchTermLower) ||
            email.toLowerCase().includes(searchTermLower)
          ) {
            searchResults.push({
              id: doc.id,
              title: name,
              subtitle: `${category.charAt(0).toUpperCase() + category.slice(1)} • ${phone}`,
              type: 'party',
              path: `/parties#id=${doc.id}`,
              icon: <BusinessIcon />,
              color: '#4caf50',
              description: email,
              metadata: { phone, email, category }
            });
          }
        });
      } catch (error) {
        console.error('Error searching parties:', error);
      }

      // Search Material In
      try {
        const materialInQuery = query(collection(db, 'materialInward'), limit(30));
        const materialInSnapshot = await getDocs(materialInQuery);
        
        materialInSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const challanNumber = data.challanNumber || '';
          const supplierName = data.supplier?.name || '';
          
          if (
            challanNumber.toLowerCase().includes(searchTermLower) ||
            supplierName.toLowerCase().includes(searchTermLower)
          ) {
            searchResults.push({
              id: doc.id,
              title: `Challan ${challanNumber}`,
              subtitle: `Material In • ${supplierName}`,
              type: 'material-in',
              path: `/material-in#id=${doc.id}`,
              icon: <ShippingIcon />,
              color: '#9c27b0',
              description: `₹${data.totalAmount || 0}`,
              metadata: { challanNumber, supplier: supplierName }
            });
          }
        });
      } catch (error) {
        console.error('Error searching material in:', error);
      }

      // Search Material Out
      try {
        const materialOutQuery = query(collection(db, 'materialsOut'), limit(30));
        const materialOutSnapshot = await getDocs(materialOutQuery);
        
        materialOutSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const challanNumber = data.challanNumber || '';
          const recipientName = data.recipient?.name || '';
          
          if (
            challanNumber.toLowerCase().includes(searchTermLower) ||
            recipientName.toLowerCase().includes(searchTermLower)
          ) {
            searchResults.push({
              id: doc.id,
              title: `Challan ${challanNumber}`,
              subtitle: `Material Out • ${recipientName}`,
              type: 'material-out',
              path: `/material-out#id=${doc.id}`,
              icon: <ShippingIcon />,
              color: '#f44336',
              description: `₹${data.totalAmount || 0}`,
              metadata: { challanNumber, recipient: recipientName }
            });
          }
        });
      } catch (error) {
        console.error('Error searching material out:', error);
      }

      // Search for Serial Numbers across all collections
      try {
        // Search in material inward
        const materialInQuery = query(collection(db, 'materialInward'), limit(20));
        const materialInSnapshot = await getDocs(materialInQuery);
        
        materialInSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const products = data.products || [];
          
          products.forEach((product: any) => {
            const serialNumbers = product.serialNumbers || [];
            serialNumbers.forEach((serial: string) => {
              if (serial && serial.toLowerCase().includes(searchTermLower)) {
                searchResults.push({
                  id: `${doc.id}-${serial}`,
                  title: `S/N: ${serial}`,
                  subtitle: `Serial Number • ${product.name}`,
                  type: 'material-in',
                  path: `/material-in#id=${doc.id}`,
                  icon: <InventoryIcon />,
                  color: '#607d8b',
                  description: `In Challan ${data.challanNumber}`,
                  metadata: { serialNumber: serial, productName: product.name }
                });
              }
            });
          });
        });
      } catch (error) {
        console.error('Error searching serial numbers:', error);
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Error performing search:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(result.path);
    onClose();
    setSearchTerm('');
  };

  const handleClose = () => {
    onClose();
    setSearchTerm('');
    setResults([]);
  };

  const getGroupedResults = () => {
    const grouped: Record<string, SearchResult[]> = {};
    results.forEach(result => {
      const key = result.type;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(result);
    });
    return grouped;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'enquiry': 'Enquiries',
      'product': 'Products',
      'party': 'Parties',
      'material-in': 'Material In',
      'material-out': 'Material Out',
      'purchase': 'Purchases',
      'sale': 'Sales',
      'center': 'Centers'
    };
    return labels[type] || type;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '80vh',
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SearchIcon color="primary" />
            Universal Search
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 1 }}>
        <TextField
          fullWidth
          placeholder="Search patients, products, serial numbers, suppliers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: loading ? (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            ) : null,
          }}
          sx={{ mb: 2 }}
          autoFocus
        />

        {/* Quick Actions - Show when no search term */}
        {!searchTerm && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>
              QUICK ACTIONS
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              {quickActions.map((action) => (
                <Paper
                  key={action.name}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: action.color,
                      bgcolor: `${action.color}10`,
                      transform: 'translateY(-2px)',
                      boxShadow: 2,
                    },
                  }}
                  onClick={() => {
                    router.push(action.path);
                    onClose();
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: action.color, width: 32, height: 32 }}>
                      {action.icon}
                    </Avatar>
                    <Typography variant="body2" fontWeight={500}>
                      {action.name}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}

        {/* Navigation Shortcuts - Show when no search term */}
        {!searchTerm && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1.5, fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>
              NAVIGATION
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {navigationShortcuts.map((nav) => (
                <Paper
                  key={nav.text}
                  elevation={0}
                  sx={{
                    p: 1,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: nav.color,
                      bgcolor: `${nav.color}10`,
                      boxShadow: 1,
                    },
                  }}
                  onClick={() => {
                    router.push(nav.path);
                    onClose();
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    <Avatar sx={{ bgcolor: nav.color, width: 28, height: 28 }}>
                      {nav.icon}
                    </Avatar>
                    <Typography variant="caption" align="center" sx={{ fontSize: '0.7rem' }}>
                      {nav.text}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}

        {/* Keyboard shortcut hint */}
        {!searchTerm && (
          <Paper 
            elevation={0} 
            sx={{ 
              p: 1.5, 
              bgcolor: 'primary.50', 
              border: '1px solid', 
              borderColor: 'primary.200',
              borderRadius: 1.5 
            }}
          >
            <Typography variant="caption" color="primary.dark" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              💡 <strong>Tip:</strong> Press{' '}
              <Chip label="Ctrl+K" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />{' '}
              to open search from anywhere
            </Typography>
          </Paper>
        )}

        {searchTerm.length > 0 && searchTerm.length < 2 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            Type at least 2 characters to search...
          </Typography>
        )}

        {searchTerm.length >= 2 && !loading && results.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No results found for "{searchTerm}"
          </Typography>
        )}

        {results.length > 0 && (
          <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
            {Object.entries(getGroupedResults()).map(([type, typeResults]) => (
              <Box key={type} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>
                  {getTypeLabel(type)} ({typeResults.length})
                </Typography>
                <Paper variant="outlined" sx={{ borderRadius: 1 }}>
                  <List dense>
                    {typeResults.map((result, index) => (
                      <React.Fragment key={result.id}>
                        <ListItem disablePadding>
                          <ListItemButton
                            onClick={() => handleResultClick(result)}
                            sx={{ py: 1 }}
                          >
                            <ListItemIcon>
                              <Avatar sx={{ bgcolor: result.color, width: 32, height: 32 }}>
                                {result.icon}
                              </Avatar>
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {result.title}
                                  </Typography>
                                  <Chip 
                                    label={result.subtitle.split(' • ')[0]} 
                                    size="small" 
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                </Box>
                              }
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    {result.subtitle.split(' • ').slice(1).join(' • ')}
                                  </Typography>
                                  {result.description && (
                                    <Typography variant="caption" color="text.secondary">
                                      {result.description}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                          </ListItemButton>
                        </ListItem>
                        {index < typeResults.length - 1 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </Paper>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UniversalSearch;
