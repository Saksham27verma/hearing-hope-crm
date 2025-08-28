'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid as MuiGrid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  IconButton,
  InputAdornment,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  Tooltip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
  FilterList as FilterListIcon,
  TrendingUp as TrendingUpIcon,
  ShoppingCart as ShoppingCartIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Store as StoreIcon,
  Info as InfoIcon,
  LocalShipping as LocalShippingIcon,
  DateRange as DateRangeIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Category as CategoryIcon,
  Visibility as VisibilityIcon,
  Analytics as AnalyticsIcon,
  Assignment as AssignmentIcon,
  ViewList as ViewListIcon,
  Dashboard as DashboardIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { collection, query, getDocs, where, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getHeadOfficeId } from '@/utils/centerUtils';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { performanceMonitor, monitorFirebaseQuery } from '@/utils/performance';
import { dataCache, CACHE_KEYS } from '@/utils/dataCache';
import InventoryItemDialog from '@/components/inventory/InventoryItemDialog';
// Alias Grid to avoid type issues with custom Grid wrapper usage
const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

// Interface for inventory item
interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  serialNumber: string;
  type: string;
  company: string;
  location: string;
  status: 'In Stock' | 'Sold' | 'Damaged';
  dealerPrice: number;
  mrp: number;
  purchaseDate: any;
  purchaseInvoice: string;
  supplier: string;
  sourceType?: 'materialIn' | 'purchase';
  sourceDocId?: string;
  quantity?: number;
  isSerialTracked?: boolean;
  notes?: string;
  createdAt: any;
  updatedAt: any;
}

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Helper function to format date
const formatDate = (timestamp: any) => {
  if (!timestamp) return '-';
  
  const date = timestamp.toDate ? 
    timestamp.toDate() : 
    new Date(timestamp.seconds * 1000);
  
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

export default function InventoryPage() {
  const { user, isAllowedModule } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [showSoldItems, setShowSoldItems] = useState<boolean>(false);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Summary stats
  const [stats, setStats] = useState({
    totalItems: 0,
    inStock: 0,
    sold: 0,
    damaged: 0,
    inventoryValue: 0,
  });

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [serialsDialogOpen, setSerialsDialogOpen] = useState(false);
  const [serialsDialogTitle, setSerialsDialogTitle] = useState('');
  const [serialsDialogRows, setSerialsDialogRows] = useState<InventoryItem[]>([]);
  const [serialsSearch, setSerialsSearch] = useState('');
  
  // Notification state
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Refresh state
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch centers
  useEffect(() => {
    const fetchCenters = async () => {
      try {
        const centersQuery = collection(db, 'centers');
        const querySnapshot = await getDocs(centersQuery);
        const centersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setCenters(centersList);
      } catch (error) {
        console.error('Error fetching centers:', error);
      }
    };

    fetchCenters();
  }, []);

  // Fetch inventory data from Firestore (products, material in, purchases, material out, sales)
  useEffect(() => {
    const fetchInventory = async () => {
      if (!user) return;
      try {
        setLoading(true);
        
        // Get head office ID for backward compatibility
        const headOfficeId = await getHeadOfficeId();
        
        // Fetch all needed collections in parallel
        const [productsSnap, materialInSnap, purchasesSnap, materialsOutSnap, salesSnap, enquiriesSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'materialInward')),
          getDocs(collection(db, 'purchases')),
          getDocs(collection(db, 'materialsOut')),
          getDocs(collection(db, 'sales')),
          getDocs(collection(db, 'enquiries')),
        ]);

        // Products map
        const productsList = productsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setProducts(productsList);
        const productById = new Map<string, any>();
        productsList.forEach(p => productById.set(p.id, p));

        // Incoming serials for stock transfer tracking
        const stockTransferInSerials = new Set<string>();
        materialInSnap.docs.forEach(docSnap => {
          const data: any = docSnap.data();
          const supplierName = data.supplier?.name || '';
          // Check if this is a stock transfer entry
          if (supplierName.includes('Stock Transfer from')) {
            (data.products || []).forEach((prod: any) => {
              (prod.serialNumbers || []).forEach((sn: string) => {
                stockTransferInSerials.add(`${prod.productId || prod.id || ''}|${sn}`);
              });
            });
          }
        });

        // Outgoing serials: materials out and sales (excluding stock transfers that were received)
        const pendingOutSerials = new Set<string>();
        const dispatchedOutSerials = new Set<string>();
        materialsOutSnap.docs.forEach(docSnap => {
          const data: any = docSnap.data();
          const status = data.status as string;
          const notes = data.notes || '';
          
          (data.products || []).forEach((prod: any) => {
            (prod.serialNumbers || []).forEach((sn: string) => {
              const key = `${prod.productId || prod.id || ''}|${sn}`;
              
              // Skip if this is a stock transfer that has been received elsewhere
              if (notes.includes('Stock Transfer:') && stockTransferInSerials.has(key)) {
                return; // Don't mark as reserved/dispatched
              }
              
              if (status === 'pending') pendingOutSerials.add(key);
              if (status === 'dispatched') dispatchedOutSerials.add(key);
            });
          });
        });

        const soldSerials = new Set<string>();
        
        // Process sales from sales collection
        salesSnap.docs.forEach(docSnap => {
          const data: any = docSnap.data();
          (data.products || []).forEach((prod: any) => {
            // Handle both sales collection structure and enquiry-derived sales
            const productId = prod.productId || prod.id || '';
            const serialNumber = prod.serialNumber || '';
            const key = `${productId}|${serialNumber}`;
            if (serialNumber) {
              soldSerials.add(key);
              console.log(`Added sold serial: ${key} from sale ${docSnap.id}`);
            }
          });
        });

        // Also check enquiries collection for sales (to handle sales recorded in visits)
        enquiriesSnap.docs.forEach(docSnap => {
          const data: any = docSnap.data();
          const visits: any[] = Array.isArray(data.visits) ? data.visits : [];
          visits.forEach((visit: any) => {
            const isSale = !!(
              visit?.hearingAidSale ||
              (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_sale')) ||
              visit?.journeyStage === 'sale' ||
              visit?.hearingAidStatus === 'sold' ||
              (Array.isArray(visit?.products) && visit.products.length > 0 && ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
            );
            if (isSale) {
              const products: any[] = Array.isArray(visit.products) ? visit.products : [];
              products.forEach((prod: any) => {
                // Handle different product structures in enquiry visits
                const productId = prod.productId || prod.id || prod.hearingAidProductId || '';
                const serialNumber = prod.serialNumber || prod.trialSerialNumber || '';
                const key = `${productId}|${serialNumber}`;
                if (serialNumber && productId) {
                  soldSerials.add(key);
                  console.log(`Added sold serial from enquiry: ${key} from enquiry ${docSnap.id}`);
                }
              });
            }
          });
        });

        // Build lookup maps for deep links
        const challanByNumber = new Map<string, string>();
        materialInSnap.docs.forEach(d => {
          const ch = (d.data() as any).challanNumber;
          if (ch) challanByNumber.set(ch, d.id);
        });
        const invoiceByNumber = new Map<string, string>();
        purchasesSnap.docs.forEach(d => {
          const inv = (d.data() as any).invoiceNo;
          if (inv) invoiceByNumber.set(inv, d.id);
        });

        // Incoming serials from materialIn and purchases (dedupe by productId|serial)
        const incomingMap = new Map<string, InventoryItem>();
        // Non-serial incoming aggregation
        type NonSerialAgg = { qty: number; lastDate: any; lastSupplier: string; lastInvoice: string; lastSourceType?: 'materialIn' | 'purchase'; lastDocId?: string; lastLocation?: string; mrp?: number; dealerPrice?: number };
        const nonSerialInByProduct = new Map<string, NonSerialAgg>();

        // Material Inward
        materialInSnap.docs.forEach(docSnap => {
          const data: any = docSnap.data();
          const receivedDate = data.receivedDate;
          const supplierName = data.supplier?.name || '';
          const companyLocation = data.company || '';
          const documentLocation = data.location || headOfficeId; // Default to head office for backward compatibility
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id;
            const productRef = productById.get(productId) || {};
            const productName = prod.name || productRef.name || '';
            const type = prod.type || productRef.type || '';
            // Use companyLocation (from material-in form) as the primary company, fallback to product company
            const company = companyLocation || productRef.company || '';
            const mrp = prod.mrp ?? productRef.mrp ?? 0;
            const dealerPrice = prod.dealerPrice ?? prod.finalPrice ?? 0;
            const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
            const hasSerial = Array.isArray(serials) && serials.length > 0;
            if (!hasSerial) {
            const prev: NonSerialAgg = nonSerialInByProduct.get(productId) || { qty: 0, lastDate: null, lastSupplier: '', lastInvoice: '', lastLocation: '', mrp, dealerPrice };
              const thisDate = receivedDate?.toMillis ? receivedDate.toMillis() : (receivedDate?.seconds || 0);
              const prevDate = prev.lastDate?.toMillis ? prev.lastDate.toMillis() : (prev.lastDate?.seconds || 0);
              const newer = !prev.lastDate || thisDate >= prevDate;
              nonSerialInByProduct.set(productId, {
                qty: prev.qty + (prod.quantity || 0),
                lastDate: newer ? receivedDate : prev.lastDate,
                lastSupplier: newer ? supplierName : prev.lastSupplier,
                lastInvoice: newer ? (data.challanNumber || '') : prev.lastInvoice,
                lastSourceType: newer ? 'materialIn' : prev.lastSourceType,
                lastDocId: newer ? docSnap.id : prev.lastDocId,
                lastLocation: newer ? documentLocation : prev.lastLocation,
                mrp: mrp || prev.mrp,
                dealerPrice: dealerPrice || prev.dealerPrice,
              });
              return;
            }
            serials.forEach((sn: string, idx: number) => {
              const key = `${productId}|${sn}`;
              if (incomingMap.has(key)) return;
              
              // Determine status based on sales
              const isSold = soldSerials.has(key);
              const status: InventoryItem['status'] = isSold ? 'Sold' : 'In Stock';
              
              incomingMap.set(key, {
                id: `mi-${docSnap.id}-${idx}`,
                productId,
                productName,
                serialNumber: sn,
                type,
                company,
                location: documentLocation,
                status,
                dealerPrice: dealerPrice || 0,
                mrp: mrp || 0,
                purchaseDate: receivedDate,
                purchaseInvoice: data.challanNumber || '',
                sourceType: 'materialIn',
                sourceDocId: docSnap.id,
                supplier: supplierName,
                createdAt: data.createdAt || receivedDate,
                updatedAt: data.updatedAt || receivedDate,
              });
            });
          });
        });

        // Purchases (only add serials not already present from Material In)
        purchasesSnap.docs.forEach(docSnap => {
          const data: any = docSnap.data();
          const purchaseDate = data.purchaseDate;
          const supplierName = data.party?.name || '';
          const companyLocation = data.company || '';
          const documentLocation = data.location || headOfficeId; // Default to head office for backward compatibility
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id;
            const productRef = productById.get(productId) || {};
            const productName = prod.name || productRef.name || '';
            const type = prod.type || productRef.type || '';
            // Use companyLocation (from purchase form) as the primary company, fallback to product company
            const company = companyLocation || productRef.company || '';
            const mrp = prod.mrp ?? productRef.mrp ?? 0;
            const dealerPrice = prod.dealerPrice ?? prod.finalPrice ?? 0;
            const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
            const hasSerial = Array.isArray(serials) && serials.length > 0;
            if (!hasSerial) {
            const prev: NonSerialAgg = nonSerialInByProduct.get(productId) || { qty: 0, lastDate: null, lastSupplier: '', lastInvoice: '', lastLocation: '', mrp, dealerPrice };
              const thisDate = purchaseDate?.toMillis ? purchaseDate.toMillis() : (purchaseDate?.seconds || 0);
              const prevDate = prev.lastDate?.toMillis ? prev.lastDate.toMillis() : (prev.lastDate?.seconds || 0);
              const newer = !prev.lastDate || thisDate >= prevDate;
              nonSerialInByProduct.set(productId, {
                qty: prev.qty + (prod.quantity || 0),
                lastDate: newer ? purchaseDate : prev.lastDate,
                lastSupplier: newer ? supplierName : prev.lastSupplier,
                lastInvoice: newer ? (data.invoiceNo || '') : prev.lastInvoice,
                lastSourceType: newer ? 'purchase' : prev.lastSourceType,
                lastDocId: newer ? docSnap.id : prev.lastDocId,
                lastLocation: newer ? documentLocation : prev.lastLocation,
                mrp: mrp || prev.mrp,
                dealerPrice: dealerPrice || prev.dealerPrice,
              });
              return;
            }
            serials.forEach((sn: string, idx: number) => {
              const key = `${productId}|${sn}`;
              if (incomingMap.has(key)) return; // already from material in (converted)
              
              // Determine status based on sales
              const isSold = soldSerials.has(key);
              const status: InventoryItem['status'] = isSold ? 'Sold' : 'In Stock';
              
              incomingMap.set(key, {
                id: `po-${docSnap.id}-${idx}`,
                productId,
                productName,
                serialNumber: sn,
                type,
                company,
                location: documentLocation,
                status,
                dealerPrice: dealerPrice || 0,
                mrp: mrp || 0,
                purchaseDate,
                purchaseInvoice: data.invoiceNo || '',
                sourceType: 'purchase',
                sourceDocId: docSnap.id,
                supplier: supplierName,
                createdAt: data.createdAt || purchaseDate,
                updatedAt: data.updatedAt || purchaseDate,
              });
            });
          });
        });

        // Outgoing non-serial aggregation (materials out + sales)
        const nonSerialOutByProduct = new Map<string, number>();
        
        // Count materials out
        materialsOutSnap.docs.forEach(docSnap => {
          const data: any = docSnap.data();
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id;
            const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
            const hasSerial = serials && serials.length > 0;
            if (!hasSerial) {
              nonSerialOutByProduct.set(productId, (nonSerialOutByProduct.get(productId) || 0) + (prod.quantity || 0));
            }
          });
        });

        // Count sales (both from sales collection and enquiries)
        salesSnap.docs.forEach(docSnap => {
          const data: any = docSnap.data();
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id || '';
            const serialNumber = prod.serialNumber || '';
            // If no serial number, count as non-serial sale
            if (!serialNumber || serialNumber === '-') {
              const quantity = prod.quantity || 1;
              nonSerialOutByProduct.set(productId, (nonSerialOutByProduct.get(productId) || 0) + quantity);
              console.log(`Added ${quantity} non-serial sales for product ${productId}`);
            }
          });
        });

        // Count sales from enquiries
        enquiriesSnap.docs.forEach(docSnap => {
          const data: any = docSnap.data();
          const visits: any[] = Array.isArray(data.visits) ? data.visits : [];
          visits.forEach((visit: any) => {
            const isSale = !!(
              visit?.hearingAidSale ||
              (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_sale')) ||
              visit?.journeyStage === 'sale' ||
              visit?.hearingAidStatus === 'sold' ||
              (Array.isArray(visit?.products) && visit.products.length > 0 && ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
            );
            if (isSale) {
              const products: any[] = Array.isArray(visit.products) ? visit.products : [];
              products.forEach((prod: any) => {
                const productId = prod.productId || prod.id || prod.hearingAidProductId || '';
                const serialNumber = prod.serialNumber || prod.trialSerialNumber || '';
                // If no serial number, count as non-serial sale
                if (productId && (!serialNumber || serialNumber === '-')) {
                  const quantity = prod.quantity || 1;
                  nonSerialOutByProduct.set(productId, (nonSerialOutByProduct.get(productId) || 0) + quantity);
                  console.log(`Added ${quantity} non-serial sales from enquiry for product ${productId}`);
                }
              });
            }
          });
        });

        // Finalize serial items (ensure source links exist even if missing)
        const serialItems = Array.from(incomingMap.values()).map((itm) => {
          if ((!itm.sourceType || !itm.sourceDocId) && itm.purchaseInvoice) {
            if (challanByNumber.has(itm.purchaseInvoice)) {
              return { ...itm, sourceType: 'materialIn' as const, sourceDocId: challanByNumber.get(itm.purchaseInvoice)! };
            }
            if (invoiceByNumber.has(itm.purchaseInvoice)) {
              return { ...itm, sourceType: 'purchase' as const, sourceDocId: invoiceByNumber.get(itm.purchaseInvoice)! };
            }
          }
          return itm;
        });

        // Build non-serial items per product with remaining quantity
        const nonSerialItems: InventoryItem[] = [];
        nonSerialInByProduct.forEach((inInfo, productId) => {
          const productRef = productById.get(productId) || {};
          const inQty = inInfo.qty || 0;
          const outQty = nonSerialOutByProduct.get(productId) || 0;
          const remainingQty = Math.max(0, inQty - outQty);
          const isSerialTracked = !!productRef.hasSerialNumber;
          if (remainingQty > 0 && !isSerialTracked) {
            nonSerialItems.push({
              id: `qty-${productId}`,
              productId,
              productName: productRef.name || '',
              serialNumber: '-',
              type: productRef.type || '',
              company: productRef.company || '',
              location: inInfo.lastLocation || '-',
            status: 'In Stock',
              dealerPrice: inInfo.dealerPrice || 0,
              mrp: inInfo.mrp || 0,
              purchaseDate: inInfo.lastDate || null,
              purchaseInvoice: inInfo.lastInvoice || '-',
              supplier: inInfo.lastSupplier || '-',
              sourceType: inInfo.lastSourceType,
              sourceDocId: inInfo.lastDocId,
              quantity: remainingQty,
              isSerialTracked: false,
              createdAt: inInfo.lastDate || null,
              updatedAt: inInfo.lastDate || null,
            });
          }
        });

        const items = [...serialItems, ...nonSerialItems];

        // Compute stats
        const inStock = items
          .filter(i => i.status === 'In Stock')
          .reduce((sum, i) => sum + (i.quantity || 1), 0);
        const sold = items.filter(i => i.status === 'Sold').length;
        const damaged = items.filter(i => i.status === 'Damaged').length; // no data source; stays 0
        const inventoryValue = items
          .filter(i => i.status === 'In Stock')
          .reduce((sum, i) => sum + (i.dealerPrice || 0) * (i.quantity || 1), 0);

        setInventory(items);
        setFilteredInventory(items);
        setStats({
          totalItems: items.length,
          inStock,
          sold,
          damaged,
          inventoryValue,
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching inventory:', error);
        setErrorMessage('Failed to load inventory data');
        setLoading(false);
      }
    };
    
    if (user) {
      if (isAllowedModule('inventory')) {
        fetchInventory();
      } else {
        setLoading(false);
      }
    }
  }, [user, isAllowedModule, refreshKey]);
  
  // Apply filters and search
  useEffect(() => {
    if (!inventory.length) return;
    
    let filtered = [...inventory];
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.productName.toLowerCase().includes(search) ||
        item.serialNumber.toLowerCase().includes(search) ||
        item.company.toLowerCase().includes(search) ||
        item.supplier.toLowerCase().includes(search)
      );
    }
    
    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // Apply type filter
    if (typeFilter) {
      filtered = filtered.filter(item => item.type === typeFilter);
    }
    
    // Apply location filter
    if (locationFilter) {
      filtered = filtered.filter(item => item.location === locationFilter);
    }
    
    // Apply company filter
    if (companyFilter) {
      filtered = filtered.filter(item => {
        // Check both product company and purchase/material-in company location
        return item.company.toLowerCase().includes(companyFilter.toLowerCase());
      });
    }
    
    setFilteredInventory(filtered);
    // Reset pagination when filters change
    setPage(0);
  }, [inventory, searchTerm, statusFilter, typeFilter, locationFilter, companyFilter]);

  // Table pagination handlers
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setTypeFilter('');
    setLocationFilter('');
    setCompanyFilter('');
  };

  // Refresh inventory data
  const handleRefreshData = () => {
    setRefreshKey(prev => prev + 1);
    setSuccessMessage('Inventory data refreshed successfully');
  };

  // Auto-refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh if it's been more than 30 seconds since last update
      const lastUpdate = localStorage.getItem('inventory-last-update');
      const now = Date.now();
      if (!lastUpdate || now - parseInt(lastUpdate) > 30000) {
        setRefreshKey(prev => prev + 1);
        localStorage.setItem('inventory-last-update', now.toString());
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Get color for status chip
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock':
        return 'success';
      case 'Sold':
        return 'warning';
      case 'Damaged':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get center name from location ID
  const getCenterName = (locationId: string) => {
    const center = centers.find(c => c.id === locationId);
    return center ? center.name : locationId;
  };

  // Filter inventory based on selected filters
  useEffect(() => {
    let filtered = inventory;

    // Filter sold items unless toggle is enabled
    if (!showSoldItems) {
      filtered = filtered.filter(item => item.status !== 'Sold');
    }

    // Filter by location/center
    if (locationFilter) {
      filtered = filtered.filter(item => item.location === locationFilter);
    }

    // Filter by search term (if we add it later)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.productName?.toLowerCase().includes(searchLower) ||
        item.serialNumber?.toLowerCase().includes(searchLower) ||
        item.company?.toLowerCase().includes(searchLower) ||
        item.type?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Filter by type
    if (typeFilter) {
      filtered = filtered.filter(item => item.type === typeFilter);
    }

    // Filter by company
    if (companyFilter) {
      filtered = filtered.filter(item => {
        return item.company?.toLowerCase().includes(companyFilter.toLowerCase());
      });
    }

    setFilteredInventory(filtered);

    // Recalculate stats for filtered data
    const inStock = filtered.filter(i => i.status === 'In Stock').length;
    const sold = filtered.filter(i => i.status === 'Sold').length;
    const damaged = filtered.filter(i => i.status === 'Damaged').length;
    const inventoryValue = filtered
      .filter(i => i.status === 'In Stock')
      .reduce((sum, i) => sum + i.dealerPrice, 0);

    setStats({
      totalItems: filtered.length,
      inStock,
      sold,
      damaged,
      inventoryValue,
    });
  }, [inventory, locationFilter, searchTerm, statusFilter, typeFilter, companyFilter, showSoldItems]);

  // Get list of unique types, locations, and companies for filters
  const productTypes = Array.from(new Set(inventory.map(item => item.type)));
  const locations = Array.from(new Set(inventory.map(item => item.location)));
  const companies = Array.from(new Set(inventory.map(item => item.company).filter(Boolean)));

  // Grouped view: Category -> Products -> Serials (In Stock only)
  const grouped = React.useMemo(() => {
    const inStockItems = filteredInventory.filter(i => i.status === 'In Stock');
    const byCategory: Record<string, { value: number; count: number; products: Record<string, { company: string; items: InventoryItem[] }> }> = {};
    for (const item of inStockItems) {
      const cat = item.type || 'Other';
      if (!byCategory[cat]) {
        byCategory[cat] = { value: 0, count: 0, products: {} };
      }
      byCategory[cat].value += item.mrp || 0;
      byCategory[cat].count += 1;
      const key = item.productName || 'Unnamed';
      if (!byCategory[cat].products[key]) {
        byCategory[cat].products[key] = { company: item.company || '', items: [] };
      }
      byCategory[cat].products[key].items.push(item);
    }
    // Convert to array with sorted categories
    const categories = Object.keys(byCategory).sort().map(cat => ({
      category: cat,
      totalValue: byCategory[cat].value,
      totalCount: byCategory[cat].count,
      products: Object.entries(byCategory[cat].products)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([productName, data]) => ({
          productName,
          company: data.company,
          count: data.items.length,
          items: data.items
        }))
    }));
    return categories;
  }, [filteredInventory]);

  const openSerialsDialog = (category: string, productName: string, items: InventoryItem[]) => {
    setSerialsDialogTitle(`${category} • ${productName}`);
    setSerialsDialogRows(items);
    setSerialsSearch('');
    setSerialsDialogOpen(true);
  };

  // Fetch products list for the add/edit dialog
  const fetchProducts = async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setProducts(list);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };
  
  // Open dialog for adding a new item or editing an existing one
  const handleOpenDialog = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
    } else {
      setEditingItem(null);
    }
    setOpenDialog(true);
  };
  
  // Close dialog
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingItem(null);
  };
  
  // Save inventory item (add or update)
  const handleSaveItem = async (item: any) => {
    try {
      // In a real app, this would save to Firestore
      
      if (item.id) {
        // Update existing item
        const itemRef = doc(db, 'inventory', item.id);
        await updateDoc(itemRef, {
          ...item,
          updatedAt: serverTimestamp()
        });
        
        // Update local state
        setInventory(prevInventory => 
          prevInventory.map(i => i.id === item.id ? {
            ...item,
            updatedAt: { seconds: Date.now() / 1000 }
          } : i)
        );
        
        setSuccessMessage('Inventory item updated successfully');
      } else {
        // Add new item
        const newItem = {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        // In a real app, this would be an actual Firestore document reference
        // const docRef = await addDoc(collection(db, 'inventory'), newItem);
        
        // Mock adding to local state with a new ID
        const mockId = 'item' + Math.floor(Math.random() * 10000);
        
        setInventory(prevInventory => [
          {
            ...newItem,
            id: mockId,
            createdAt: { seconds: Date.now() / 1000 },
            updatedAt: { seconds: Date.now() / 1000 }
          },
          ...prevInventory
        ]);
        
        setSuccessMessage('Inventory item added successfully');
      }
      
      // Recalculate stats
      const updatedInventory = item.id 
        ? inventory.map(i => i.id === item.id ? { ...item, updatedAt: { seconds: Date.now() / 1000 } } : i)
        : [
            { 
              ...item, 
              id: 'item' + Math.floor(Math.random() * 10000),
              createdAt: { seconds: Date.now() / 1000 },
              updatedAt: { seconds: Date.now() / 1000 }
            },
            ...inventory
          ];
      
      const inStock = updatedInventory.filter(i => i.status === 'In Stock').length;
      const sold = updatedInventory.filter(i => i.status === 'Sold').length;
      const damaged = updatedInventory.filter(i => i.status === 'Damaged').length;
      const inventoryValue = updatedInventory
        .filter(i => i.status === 'In Stock')
        .reduce((sum, i) => sum + i.dealerPrice, 0);
      
      setStats({
        totalItems: updatedInventory.length,
        inStock,
        sold,
        damaged,
        inventoryValue,
      });
      
      setOpenDialog(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving inventory item:', error);
      setErrorMessage('Failed to save inventory item');
    }
  };
  
  // Delete inventory item
  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inventory item?')) {
      return;
    }
    
    try {
      // In a real app, this would delete from Firestore
      // await deleteDoc(doc(db, 'inventory', id));
      
      // Update local state
      const updatedInventory = inventory.filter(item => item.id !== id);
      setInventory(updatedInventory);
      
      // Recalculate stats
      const inStock = updatedInventory.filter(i => i.status === 'In Stock').length;
      const sold = updatedInventory.filter(i => i.status === 'Sold').length;
      const damaged = updatedInventory.filter(i => i.status === 'Damaged').length;
      const inventoryValue = updatedInventory
        .filter(i => i.status === 'In Stock')
        .reduce((sum, i) => sum + i.dealerPrice, 0);
      
      setStats({
        totalItems: updatedInventory.length,
        inStock,
        sold,
        damaged,
        inventoryValue,
      });
      
      setSuccessMessage('Inventory item deleted successfully');
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      setErrorMessage('Failed to delete inventory item');
    }
  };
  
  // Loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }
  
  // If not authorized
  if (!isAllowedModule('inventory')) {
    return (
      <Box textAlign="center" p={4}>
        <Typography variant="h5" color="error" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1">
          You do not have permission to access the inventory module.
        </Typography>
      </Box>
    );
  }
  
  // Paginated data
  const paginatedData = filteredInventory.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ 
      p: 3, 
      bgcolor: 'background.default', 
      minHeight: 'calc(100vh - 64px)',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      {/* Clean Header */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Box display="flex" alignItems="center" mb={1}>
              <DashboardIcon color="primary" sx={{ fontSize: 28, mr: 2 }} />
              <Typography variant="h4" fontWeight="600" color="text.primary">
                Inventory Management
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              Real-time stock tracking across all locations and companies
            </Typography>
            <Box display="flex" alignItems="center" sx={{ color: 'text.secondary' }}>
              <AnalyticsIcon sx={{ mr: 1, fontSize: 16 }} />
              <Typography variant="body2">
                Last updated: {new Date().toLocaleString()}
              </Typography>
            </Box>
          </Box>
          <Box textAlign="right" display="flex" gap={1} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={showSoldItems}
                  onChange={(e) => setShowSoldItems(e.target.checked)}
                  color="warning"
                />
              }
              label={
                <Box display="flex" alignItems="center">
                  <VisibilityIcon sx={{ mr: 0.5, fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    Show Sold Items
                  </Typography>
                </Box>
              }
              sx={{ mr: 2 }}
            />
            <Button
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshData}
              sx={{ borderRadius: 2 }}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ borderRadius: 2 }}
            >
              Add New Item
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Clean Stats Cards */}
      <Box display="grid" gridTemplateColumns={{ xs: '1fr 1fr', sm: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' }} gap={2} mb={3}>
        <Card elevation={0} sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
          <Box display="flex" alignItems="center" mb={1}>
            <InventoryIcon color="primary" sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="subtitle2" color="text.secondary">
              Total Items
            </Typography>
          </Box>
          <Typography variant="h4" fontWeight="bold" color="text.primary">
            {stats.totalItems}
          </Typography>
        </Card>
        
        <Card elevation={0} sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
          <Box display="flex" alignItems="center" mb={1}>
            <CheckCircleIcon color="success" sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="subtitle2" color="text.secondary">
              In Stock
            </Typography>
          </Box>
          <Typography variant="h4" fontWeight="bold" color="success.main">
            {stats.inStock}
          </Typography>
        </Card>
        
        <Card elevation={0} sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
          <Box display="flex" alignItems="center" mb={1}>
            <ShoppingCartIcon color="info" sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="subtitle2" color="text.secondary">
              Sold
            </Typography>
          </Box>
          <Typography variant="h4" fontWeight="bold" color="info.main">
            {stats.sold}
          </Typography>
        </Card>
        
        {showSoldItems && (
          <Card elevation={0} sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
            <Box display="flex" alignItems="center" mb={1}>
              <VisibilityIcon color="warning" sx={{ mr: 1, fontSize: 20 }} />
              <Typography variant="subtitle2" color="text.secondary">
                Sold Items Shown
              </Typography>
            </Box>
            <Typography variant="h4" fontWeight="bold" color="warning.main">
              {filteredInventory.filter(i => i.status === 'Sold').length}
            </Typography>
          </Card>
        )}

        
        <Card elevation={0} sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
          <Box display="flex" alignItems="center" mb={1}>
            <WarningIcon color="error" sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="subtitle2" color="text.secondary">
              Damaged
            </Typography>
          </Box>
          <Typography variant="h4" fontWeight="bold" color="error.main">
            {stats.damaged}
          </Typography>
        </Card>
        
        <Card elevation={0} sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', p: 2 }}>
          <Box display="flex" alignItems="center" mb={1}>
            <TrendingUpIcon color="primary" sx={{ mr: 1, fontSize: 20 }} />
            <Typography variant="subtitle2" color="text.secondary">
              Total Value
            </Typography>
          </Box>
          <Typography variant="h5" fontWeight="bold" color="primary.main" noWrap>
            {formatCurrency(stats.inventoryValue)}
          </Typography>
        </Card>
      </Box>

      {/* Company-wise Stock Position */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <BusinessIcon color="primary" sx={{ mr: 2 }} />
          <Typography variant="h6" fontWeight="600" color="text.primary">
            Stock Position by Company
          </Typography>
        </Box>
        
        <Grid container spacing={2}>
          {companies.map(company => {
            // Use filteredInventory if other filters are applied, otherwise use all inventory
            const baseItems = (locationFilter || statusFilter || typeFilter || searchTerm) ? filteredInventory : inventory;
            const companyItems = baseItems.filter(item => item.company === company);
            const companyStats = {
              total: companyItems.length,
              inStock: companyItems.filter(i => i.status === 'In Stock').length,
              sold: companyItems.filter(i => i.status === 'Sold').length,
              value: companyItems.filter(i => i.status === 'In Stock').reduce((sum, i) => sum + (i.dealerPrice || 0) * (i.quantity || 1), 0)
            };
            
            return (
              <Grid item xs={12} md={6} key={company}>
                <Card elevation={0} sx={{ 
                  borderRadius: 2, 
                  border: companyFilter === company ? '2px solid' : '1px solid',
                  borderColor: companyFilter === company ? 'primary.main' : 'divider',
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.light', boxShadow: 1 }
                }}
                onClick={() => setCompanyFilter(companyFilter === company ? '' : company)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Box display="flex" alignItems="center">
                        <Box sx={{ 
                          width: 40, 
                          height: 40, 
                          borderRadius: 1, 
                          bgcolor: company === 'Hope Enterprises' ? 'primary.main' : 'success.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2
                        }}>
                          <BusinessIcon sx={{ color: 'white', fontSize: 20 }} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="600" color="text.primary">
                            {company}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {companyStats.total} items total
                          </Typography>
                        </Box>
                      </Box>
                      <Chip 
                        label={companyFilter === company ? "Applied" : "Click to Filter"} 
                        color={companyFilter === company ? "primary" : "default"}
                        size="small"
                        variant={companyFilter === company ? "filled" : "outlined"}
                      />
                    </Box>
                    
                    <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={1}>
                      <Box textAlign="center" sx={{ p: 1, bgcolor: 'success.lighter', borderRadius: 1 }}>
                        <Typography variant="h6" fontWeight="bold" color="success.main">
                          {companyStats.inStock}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          In Stock
                        </Typography>
                      </Box>
                      <Box textAlign="center" sx={{ p: 1, bgcolor: 'info.lighter', borderRadius: 1 }}>
                        <Typography variant="h6" fontWeight="bold" color="info.main">
                          {companyStats.sold}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Sold
                        </Typography>
                      </Box>
                      <Box textAlign="center" sx={{ p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                        <Typography variant="h6" fontWeight="bold" color="text.primary">
                          {companyStats.total}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Total
                        </Typography>
                      </Box>
                      <Box textAlign="center" sx={{ p: 1, bgcolor: 'warning.lighter', borderRadius: 1 }}>
                        <Typography variant="body2" fontWeight="bold" color="warning.main" noWrap>
                          {formatCurrency(companyStats.value)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Value
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Center-wise Stock Overview */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <LocationIcon color="primary" sx={{ mr: 2 }} />
          <Typography variant="h6" fontWeight="600" color="text.primary">
            Stock Distribution by Center
          </Typography>
        </Box>
        
        <Grid container spacing={2}>
          {locations.map(location => {
            // Use filteredInventory if other filters are applied, otherwise use all inventory
            const baseItems = (companyFilter || statusFilter || typeFilter || searchTerm) ? filteredInventory : inventory;
            const locationItems = baseItems.filter(item => item.location === location);
            const locationStats = {
              total: locationItems.length,
              inStock: locationItems.filter(i => i.status === 'In Stock').length,
              sold: locationItems.filter(i => i.status === 'Sold').length,
              value: locationItems.filter(i => i.status === 'In Stock').reduce((sum, i) => sum + (i.dealerPrice || 0) * (i.quantity || 1), 0)
            };
            
            const centerName = getCenterName(location);
            
            return (
              <Grid item xs={12} sm={6} md={4} key={location}>
                <Card elevation={0} sx={{ 
                  borderRadius: 2, 
                  border: locationFilter === location ? '2px solid' : '1px solid',
                  borderColor: locationFilter === location ? 'primary.main' : 'divider',
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.light', boxShadow: 1 }
                }}
                onClick={() => setLocationFilter(locationFilter === location ? '' : location)}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Box display="flex" alignItems="center">
                        <Box sx={{ 
                          width: 36, 
                          height: 36, 
                          borderRadius: 1, 
                          bgcolor: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 2
                        }}>
                          <LocationIcon sx={{ color: 'white', fontSize: 18 }} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="600" color="text.primary">
                            {centerName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {locationStats.total} items
                          </Typography>
                        </Box>
                      </Box>
                      <Chip 
                        label={locationFilter === location ? "Applied" : "Filter"} 
                        color={locationFilter === location ? "primary" : "default"}
                        size="small"
                        variant={locationFilter === location ? "filled" : "outlined"}
                      />
                    </Box>
                    
                    <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={1} mt={2}>
                      <Box textAlign="center" sx={{ p: 1, bgcolor: 'success.lighter', borderRadius: 1 }}>
                        <Typography variant="body1" fontWeight="bold" color="success.main">
                          {locationStats.inStock}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          In Stock
                        </Typography>
                      </Box>
                      <Box textAlign="center" sx={{ p: 1, bgcolor: 'info.lighter', borderRadius: 1 }}>
                        <Typography variant="body1" fontWeight="bold" color="info.main">
                          {locationStats.sold}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Sold
                        </Typography>
                      </Box>
                      <Box textAlign="center" sx={{ p: 1, bgcolor: 'warning.lighter', borderRadius: 1 }}>
                        <Typography variant="caption" fontWeight="bold" color="warning.main" noWrap>
                          {formatCurrency(locationStats.value)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Value
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Stock by Category */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" mb={3}>
          <CategoryIcon color="primary" sx={{ mr: 2 }} />
          <Typography variant="h6" fontWeight="600" color="text.primary">
            Stock by Category
          </Typography>
        </Box>
        
        <Grid container spacing={2}>
          {grouped.length === 0 ? (
            <Grid item xs={12}>
              <Paper elevation={0} sx={{ p: 3, textAlign: 'center', color: 'text.secondary', borderRadius: 2, bgcolor: 'grey.50' }}>
                <InventoryIcon sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                <Typography variant="h6" gutterBottom>No in-stock items available</Typography>
                <Typography variant="body2">Add some inventory items to see category breakdown</Typography>
              </Paper>
            </Grid>
          ) : (
            grouped.map(group => (
              <Grid key={group.category} item xs={12} sm={6} md={3}>
                <Card elevation={0} sx={{ 
                  borderRadius: 2, 
                  border: '1px solid', 
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease',
                  '&:hover': { borderColor: 'primary.light', boxShadow: 1 }
                }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Typography variant="subtitle2" fontWeight="600" color="text.primary">
                        {group.category}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={`${group.totalCount} items`} 
                        color="success" 
                        variant="outlined" 
                      />
                    </Box>
                    <Typography variant="h6" fontWeight="bold" color="success.main">
                      {formatCurrency(group.totalValue)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                      Stock value
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </Paper>

      {/* Products by Category with drill-down */}
      <Box mb={4}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Products by Category</Typography>
        <Stack spacing={2}>
          {grouped.map(group => (
            <Paper key={group.category} elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>{group.category}</Typography>
                <Typography variant="body2" color="text.secondary">{group.totalCount} items • {formatCurrency(group.totalValue)}</Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell>Company</TableCell>
                      <TableCell align="right">In Stock</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.products.map(p => (
                      <TableRow key={p.productName} hover>
                        <TableCell>{p.productName}</TableCell>
                        <TableCell>{p.company || '-'}</TableCell>
                        <TableCell align="right">
                          <Chip label={p.count} size="small" color="success" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="outlined" onClick={() => openSerialsDialog(group.category, p.productName, p.items)}>View Serials</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {group.products.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 2, color: 'text.secondary' }}>No products in stock</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ))}
        </Stack>
      </Box>
      
      {/* Clean Filters and Actions */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center">
            <FilterListIcon color="primary" sx={{ mr: 2 }} />
            <Typography variant="h6" fontWeight="600" color="text.primary">
              Search & Filters
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            {(searchTerm || statusFilter || typeFilter || locationFilter || companyFilter) && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={handleResetFilters}
                size="small"
                sx={{ borderRadius: 1 }}
              >
                Reset All
              </Button>
            )}
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              size="small"
              sx={{ borderRadius: 1 }}
            >
              Add New Item
            </Button>
          </Box>
        </Box>

        {/* Search Bar */}
        <Box mb={3}>
          <TextField
            placeholder="Search by product name, serial number, company, or supplier..."
            fullWidth
            variant="outlined"
            size="medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ 
              '& .MuiOutlinedInput-root': { 
                borderRadius: 1,
                bgcolor: 'background.default',
                '&:hover': { bgcolor: 'background.paper' },
                '&.Mui-focused': { bgcolor: 'background.paper' }
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="primary" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Filter Row */}
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="medium" variant="outlined">
              <InputLabel>
                <Box display="flex" alignItems="center">
                  <CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
                  Status
                </Box>
              </InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
                sx={{ borderRadius: 1 }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="In Stock">
                  <Box display="flex" alignItems="center">
                    <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                    In Stock
                  </Box>
                </MenuItem>
                <MenuItem value="Sold">
                  <Box display="flex" alignItems="center">
                    <ShoppingCartIcon color="warning" sx={{ mr: 1 }} />
                    Sold
                  </Box>
                </MenuItem>
                <MenuItem value="Damaged">
                  <Box display="flex" alignItems="center">
                    <WarningIcon color="error" sx={{ mr: 1 }} />
                    Damaged
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="medium" variant="outlined">
              <InputLabel>
                <Box display="flex" alignItems="center">
                  <CategoryIcon sx={{ mr: 1, fontSize: 20 }} />
                  Type
                </Box>
              </InputLabel>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                label="Type"
                sx={{ borderRadius: 1 }}
              >
                <MenuItem value="">All Types</MenuItem>
                {productTypes.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="medium" variant="outlined">
              <InputLabel>
                <Box display="flex" alignItems="center">
                  <LocationIcon sx={{ mr: 1, fontSize: 20 }} />
                  Location
                </Box>
              </InputLabel>
              <Select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                label="Location"
                sx={{ borderRadius: 1 }}
              >
                <MenuItem value="">All Locations</MenuItem>
                {locations.map(location => (
                  <MenuItem key={location} value={location}>{getCenterName(location)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="medium" variant="outlined">
              <InputLabel>
                <Box display="flex" alignItems="center">
                  <BusinessIcon sx={{ mr: 1, fontSize: 20 }} />
                  Company
                </Box>
              </InputLabel>
              <Select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                label="Company"
                sx={{ borderRadius: 1 }}
              >
                <MenuItem value="">All Companies</MenuItem>
                {companies.map(company => (
                  <MenuItem key={company} value={company}>{company}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Active Filters Display */}
        {(searchTerm || statusFilter || typeFilter || locationFilter || companyFilter) && (
          <Box mt={3}>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>
              Active Filters:
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {searchTerm && (
                <Chip 
                  label={`Search: "${searchTerm}"`} 
                  onDelete={() => setSearchTerm('')}
                  color="primary"
                  variant="outlined"
                />
              )}
              {statusFilter && (
                <Chip 
                  label={`Status: ${statusFilter}`} 
                  onDelete={() => setStatusFilter('')}
                  color="primary"
                  variant="outlined"
                />
              )}
              {typeFilter && (
                <Chip 
                  label={`Type: ${typeFilter}`} 
                  onDelete={() => setTypeFilter('')}
                  color="primary"
                  variant="outlined"
                />
              )}
              {locationFilter && (
                <Chip 
                  label={`Location: ${getCenterName(locationFilter)}`} 
                  onDelete={() => setLocationFilter('')}
                  color="primary"
                  variant="outlined"
                />
              )}
              {companyFilter && (
                <Chip 
                  label={`Company: ${companyFilter}`} 
                  onDelete={() => setCompanyFilter('')}
                  color="primary"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        )}
      </Paper>
      
      {/* Clean Inventory Table */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden', bgcolor: 'background.paper' }}>
        <Box sx={{ p: 3, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <ViewListIcon color="primary" sx={{ mr: 2 }} />
              <Typography variant="h6" fontWeight="600" color="text.primary">
                Inventory Items
              </Typography>
              <Chip 
                label={`${filteredInventory.length} items`} 
                size="small" 
                color="primary" 
                variant="outlined" 
                sx={{ ml: 2 }}
              />
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<VisibilityIcon />}
              sx={{ borderRadius: 1 }}
            >
              Export Data
            </Button>
          </Box>
        </Box>

        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'background.default' }}>
                <TableCell sx={{ fontWeight: 'bold', py: 2 }}>
                  <Box display="flex" alignItems="center">
                    <AssignmentIcon sx={{ mr: 1, fontSize: 20 }} />
                    Product Details
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 2 }}>
                  <Box display="flex" alignItems="center">
                    <SearchIcon sx={{ mr: 1, fontSize: 20 }} />
                    Serial Number
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 2 }}>
                  <Box display="flex" alignItems="center">
                    <BusinessIcon sx={{ mr: 1, fontSize: 20 }} />
                    Company
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 2 }}>
                  <Box display="flex" alignItems="center">
                    <LocationIcon sx={{ mr: 1, fontSize: 20 }} />
                    Location
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 2 }}>
                  <Box display="flex" alignItems="center">
                    <CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
                    Status
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', py: 2 }}>
                  Pricing
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 2 }}>
                  Purchase Info
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', py: 2 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInventory.length > 0 ? (
                filteredInventory
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((item) => (
                    <TableRow 
                      key={item.id} 
                      hover 
                      sx={{ 
                        '&:hover': { bgcolor: 'background.default' },
                        borderBottom: '1px solid', borderColor: 'divider',
                        // Highlight sold items with subtle background
                        ...(item.status === 'Sold' && {
                          bgcolor: 'rgba(255, 193, 7, 0.08)',
                          borderLeft: '4px solid #ed6c02',
                          '&:hover': { bgcolor: 'rgba(255, 193, 7, 0.12)' }
                        })
                      }}
                    >
                      <TableCell sx={{ py: 3 }}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            {item.productName}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Chip 
                              label={item.type} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                              sx={{ fontSize: '0.75rem' }}
                            />
                            {item.quantity && item.quantity > 1 && (
                              <Chip 
                                label={`Qty: ${item.quantity}`} 
                                size="small" 
                                color="default" 
                                variant="outlined"
                                sx={{ fontSize: '0.75rem' }}
                              />
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 3 }}>
                        <Box sx={{ 
                          p: 1.5, 
                          bgcolor: 'grey.100', 
                          borderRadius: 1, 
                          border: '1px solid', 
                          borderColor: 'grey.300',
                          fontFamily: 'monospace',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          color: 'text.primary',
                          letterSpacing: '0.05em'
                        }}>
                          {item.serialNumber}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 3 }}>
                        <Box display="flex" alignItems="center">
                          <Box sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: item.company === 'Hope Enterprises' ? 'primary.main' : 'success.main',
                            mr: 1
                          }} />
                          <Typography variant="body2" fontWeight="medium">
                            {item.company}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          {getCenterName(item.location)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 3 }}>
                        <Chip 
                          label={item.status} 
                          size="small" 
                          color={getStatusColor(item.status) as any}
                          variant="filled"
                          sx={{ fontWeight: 'bold' }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ py: 3 }}>
                        <Box textAlign="right">
                          <Typography variant="body2" fontWeight="bold" color="primary">
                            {formatCurrency(item.dealerPrice)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            MRP: {formatCurrency(item.mrp)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 3 }}>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {formatDate(item.purchaseDate)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.supplier}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ py: 3 }}>
                        <Box display="flex" justifyContent="center" gap={1}>
                          <Tooltip title="View Details">
                            <IconButton 
                              size="small" 
                              color="info"
                              sx={{ 
                                bgcolor: '#e3f2fd',
                                '&:hover': { bgcolor: '#bbdefb' }
                              }}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Item">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleOpenDialog(item)}
                              sx={{ 
                                bgcolor: '#e8f5e8',
                                '&:hover': { bgcolor: '#c8e6c9' }
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Item">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleDeleteItem(item.id)}
                              sx={{ 
                                bgcolor: '#ffebee',
                                '&:hover': { bgcolor: '#ffcdd2' }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 8 }}>
                    <Box textAlign="center">
                      <InventoryIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        {inventory.length > 0 
                          ? 'No items match your filters' 
                          : 'No inventory items found'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {inventory.length > 0 
                          ? 'Try adjusting your search criteria or clearing some filters' 
                          : 'Add some items to get started with inventory tracking'}
                      </Typography>
                      {inventory.length === 0 && (
                        <Button 
                          variant="contained" 
                          startIcon={<AddIcon />}
                          onClick={() => handleOpenDialog()}
                          sx={{ mt: 2, borderRadius: 2 }}
                        >
                          Add First Item
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        {filteredInventory.length > 0 && (
          <Box sx={{ p: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
              component="div"
              count={filteredInventory.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{
                '& .MuiTablePagination-select': {
                  borderRadius: 1
                }
              }}
            />
          </Box>
        )}
      </Paper>

      {/* Serials Dialog */}
      <Dialog open={serialsDialogOpen} onClose={() => setSerialsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{serialsDialogTitle}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <TextField
              placeholder="Search serials, supplier..."
              fullWidth
              size="small"
              value={serialsSearch}
              onChange={(e)=> setSerialsSearch(e.target.value)}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
            />
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Serial Number</TableCell>
                <TableCell>Purchase/Material In Date</TableCell>
                <TableCell>Invoice/Challan</TableCell>
                <TableCell>From Whom</TableCell>
                <TableCell>Location</TableCell>
                <TableCell align="right">Open</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {serialsDialogRows
                .filter(r => {
                  const q = serialsSearch.toLowerCase();
                  if (!q) return true;
                  return (
                    r.serialNumber.toLowerCase().includes(q) ||
                    (r.supplier || '').toLowerCase().includes(q) ||
                    (r.location || '').toLowerCase().includes(q)
                  );
                })
                .map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.serialNumber}</TableCell>
                  <TableCell>{formatDate(r.purchaseDate)}</TableCell>
                  <TableCell>{r.purchaseInvoice || '-'}</TableCell>
                  <TableCell>{r.supplier || '-'}</TableCell>
                  <TableCell>{r.location || '-'}</TableCell>
                  <TableCell align="right">
                    {r.sourceType && r.sourceDocId ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          const target = r.sourceType === 'materialIn' ? '/material-in' : '/purchase-management';
                          window.open(`${target}#id=${r.sourceDocId}`, '_blank');
                        }}
                      >
                        Open
                      </Button>
                    ) : (
                      <Chip size="small" label="N/A" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {serialsDialogRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 2, color: 'text.secondary' }}>No serials</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSerialsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog for adding/editing inventory items */}
      <InventoryItemDialog 
        open={openDialog}
        onClose={handleCloseDialog}
        onSave={handleSaveItem}
        item={editingItem || undefined}
        isEditing={!!editingItem}
        products={products}
      />
      
      {/* Snackbars for success/error messages */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setSuccessMessage('')} 
          severity="success" 
          variant="filled"
          elevation={6}
        >
          {successMessage}
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={() => setErrorMessage('')} 
          severity="error" 
          variant="filled"
          elevation={6}
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
} 