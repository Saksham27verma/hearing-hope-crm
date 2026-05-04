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
  Tabs,
  Tab,
  Drawer,
  List,
  ListSubheader,
  ListItemButton,
  ListItemText,
  LinearProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
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
  Link as LinkIcon,
} from '@mui/icons-material';
import { collection, query, getDocs, where, orderBy, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getHeadOfficeId } from '@/utils/centerUtils';
import { businessCompanyChipColor } from '@/utils/businessCompanies';
import { expandSalesReturnLinesFromVisit } from '@/utils/salesReturnFromVisit';
import { useAuth } from '@/context/AuthContext';
import { useCenterScope } from '@/hooks/useCenterScope';
import { inventoryItemMatchesDataScope } from '@/lib/tenant/centerScope';
import { useRouter } from 'next/navigation';
// Temporarily disabled performance monitoring to prevent bundling issues
// import { performanceMonitor, monitorFirebaseQuery } from '@/utils/performance';
// import { dataCache, CACHE_KEYS } from '@/utils/dataCache';
import InventoryItemDialog from '@/components/inventory/InventoryItemDialog';
// Alias Grid to avoid type issues with custom Grid wrapper usage
const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

// Interface for inventory item
interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  serialNumber: string;
  serialNumbers?: string[]; // For pair items or multi-serial tracking
  pairSource?: 'serialPairs' | 'manualOverride' | 'legacyFallback' | 'unpaired';
  pairGroupKey?: string;
  type: string;
  company: string;
  originalProductCompany?: string; // Original product company from products collection
  location: string;
  status: 'In Stock' | 'Sold' | 'Reserved' | 'Damaged';
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

interface JourneyEvent {
  id: string;
  serialNumber: string;
  productId: string;
  productName: string;
  eventType:
    | 'purchase'
    | 'material-in'
    | 'stock-transfer-in'
    | 'stock-transfer-out'
    | 'material-out'
    | 'trial'
    | 'booking'
    | 'sale'
    | 'sale-return'
    | 'visit-update';
  title: string;
  description: string;
  date: any;
  sortOrder: number;
  location?: string;
  counterparty?: string;
  referenceNo?: string;
  notes?: string;
  sourceLabel?: string;
  sourcePath?: string;
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

  let date: Date | null = null;
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  }

  if (!date) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const formatDateTime = (timestamp: any) => {
  if (!timestamp) return '-';

  let date: Date | null = null;
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  }

  if (!date) return typeof timestamp === 'string' ? timestamp : '-';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getTimestampValue = (timestamp: any) => {
  if (!timestamp) return 0;
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (timestamp instanceof Date) return timestamp.getTime();
  if (timestamp.toDate) return timestamp.toDate().getTime();
  if (timestamp.seconds) return timestamp.seconds * 1000;
  return 0;
};

const normalizeSerialNumber = (serialNumber: string) =>
  String(serialNumber || '')
    .trim()
    .replace(/^['"`\s]+|['"`\s]+$/g, '')
    .toUpperCase();

/** MUI `*.lighter` stays very pale in dark mode and reads as harsh white tiles on charcoal cards. */
function inventoryStatTileBg(theme: Theme, tone: 'success' | 'info' | 'primary' | 'warning' | 'grey') {
  if (theme.palette.mode === 'dark') {
    if (tone === 'grey') return alpha(theme.palette.common.white, 0.1);
    return alpha(theme.palette[tone].main, 0.22);
  }
  const light: Record<'success' | 'info' | 'primary' | 'warning' | 'grey', string> = {
    success: 'success.lighter',
    info: 'info.lighter',
    primary: 'primary.lighter',
    warning: 'warning.lighter',
    grey: theme.palette.grey[100],
  };
  return light[tone];
}

function inventoryMutedLabelSx(theme: Theme) {
  return {
    color:
      theme.palette.mode === 'dark'
        ? alpha(theme.palette.common.white, 0.78)
        : theme.palette.text.secondary,
  } as const;
}

function normalizeProductNameForMatch(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function InventoryPage() {
  const { user, userProfile, isAllowedModule } = useAuth();
  const { effectiveScopeCenterId, allowedCenterIds } = useCenterScope();
  const router = useRouter();
  
  // Helper to check if user is staff or audiologist (both have same restricted view)
  const isRestrictedUser = userProfile?.role === 'staff' || userProfile?.role === 'audiologist';
  
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [companyFilter, setCompanyFilter] = useState<string>('');
  const [showSoldItems, setShowSoldItems] = useState<boolean>(true);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Summary stats
  const [stats, setStats] = useState({
    totalItems: 0,
    inStock: 0,
    sold: 0,
    damaged: 0,
    inventoryValueDealer: 0,
    inventoryValueMRP: 0,
  });

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [serialsDialogOpen, setSerialsDialogOpen] = useState(false);
  const [serialsDialogTitle, setSerialsDialogTitle] = useState('');
  const [serialsDialogRows, setSerialsDialogRows] = useState<InventoryItem[]>([]);
  const [serialsSearch, setSerialsSearch] = useState('');
  const [journeySerialInput, setJourneySerialInput] = useState('');
  const [journeySearchSerial, setJourneySearchSerial] = useState('');
  const [journeyDialogOpen, setJourneyDialogOpen] = useState(false);
  const [journeyBySerial, setJourneyBySerial] = useState<Record<string, JourneyEvent[]>>({});
  
  // Notification state
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Refresh state
  const [refreshKey, setRefreshKey] = useState(0);
  const [pairRepairOpen, setPairRepairOpen] = useState(false);
  const [pairRepairItem, setPairRepairItem] = useState<InventoryItem | null>(null);
  const [pairRepairSerialList, setPairRepairSerialList] = useState<string[]>([]);
  const [pairRepairInput, setPairRepairInput] = useState('');
  const [savingPairRepair, setSavingPairRepair] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'inventory' | 'pairing'>('inventory');
  const [commandViewTab, setCommandViewTab] = useState<'live' | 'analytics'>('live');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [selectedExplorerBrand, setSelectedExplorerBrand] = useState<string>('');
  const [multiStatusFilter, setMultiStatusFilter] = useState<string[]>([]);
  const [multiBrandFilter, setMultiBrandFilter] = useState<string[]>([]);
  const [multiCenterFilter, setMultiCenterFilter] = useState<string[]>([]);
  const [selectedPairProductId, setSelectedPairProductId] = useState('__all__');
  const [pairingDraftByBucket, setPairingDraftByBucket] = useState<Record<string, [string, string][]>>({});
  const [pairingSelectionByBucket, setPairingSelectionByBucket] = useState<Record<string, string[]>>({});
  const [savingBucketKey, setSavingBucketKey] = useState<string | null>(null);

  const productNameById = useMemo(() => {
    const byId = new Map<string, string>();
    products.forEach((p: any) => {
      const id = String(p?.id || '').trim();
      const name = String(p?.name || '').trim();
      if (id && name) byId.set(id, name);
    });
    return byId;
  }, [products]);

  const canonicalProductNameByLower = useMemo(() => {
    const byLower = new Map<string, string>();
    products.forEach((p: any) => {
      const name = String(p?.name || '').trim();
      if (!name) return;
      byLower.set(name.toLowerCase(), name);
    });
    return byLower;
  }, [products]);

  const canonicalProductNameByNormalized = useMemo(() => {
    const byNormalized = new Map<string, string>();
    products.forEach((p: any) => {
      const name = String(p?.name || '').trim();
      if (!name) return;
      const key = normalizeProductNameForMatch(name);
      if (!key) return;
      if (!byNormalized.has(key)) {
        byNormalized.set(key, name);
      }
    });
    return byNormalized;
  }, [products]);

  const getCanonicalSearchProductName = (item: InventoryItem): string => {
    const canonical = productNameById.get(String(item.productId || '').trim());
    if (canonical) return canonical;
    const rowName = String(item.productName || '').trim();
    const byName = canonicalProductNameByLower.get(rowName.toLowerCase());
    if (byName) return byName;
    const byNormalized = canonicalProductNameByNormalized.get(normalizeProductNameForMatch(rowName));
    return byNormalized || rowName;
  };

  const searchNameAliasesByProductId = useMemo(() => {
    const aliases = new Map<string, Set<string>>();
    inventory.forEach((item) => {
      const id = String(item.productId || '').trim();
      if (!id) return;
      if (!aliases.has(id)) aliases.set(id, new Set<string>());
      const set = aliases.get(id)!;
      const canonical = productNameById.get(id);
      const rowName = String(item.productName || '').trim();
      if (canonical) set.add(canonical.toLowerCase());
      if (rowName) set.add(rowName.toLowerCase());
    });
    return aliases;
  }, [inventory, productNameById]);

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
        
        // Fetch all needed collections in parallel, but don't fail entire page if one read is denied.
        const [
          productsRes,
          materialInRes,
          purchasesRes,
          materialsOutRes,
          salesRes,
          enquiriesRes,
          stockTransfersRes,
        ] = await Promise.allSettled([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'materialInward')),
          getDocs(collection(db, 'purchases')),
          getDocs(collection(db, 'materialsOut')),
          getDocs(collection(db, 'sales')),
          getDocs(collection(db, 'enquiries')),
          // Authoritative source of stock transfer moves; ordered by createdAt
          // (serverTimestamp) so applyStockTransferMoves runs strictly in
          // chronological order even when transferDate ties for transfers
          // created in the same browser session.
          getDocs(query(collection(db, 'stockTransfers'), orderBy('createdAt', 'asc'))),
        ]);

        const toDocs = (res: PromiseSettledResult<any>, label: string) => {
          if (res.status === 'fulfilled') return res.value;
          console.error(`Inventory source read failed: ${label}`, res.reason);
          return { docs: [] as any[] };
        };

        const productsSnap = toDocs(productsRes, 'products');
        const materialInSnap = toDocs(materialInRes, 'materialInward');
        const purchasesSnap = toDocs(purchasesRes, 'purchases');
        const materialsOutSnap = toDocs(materialsOutRes, 'materialsOut');
        const salesSnap = toDocs(salesRes, 'sales');
        const enquiriesSnap = toDocs(enquiriesRes, 'enquiries');
        const stockTransfersSnap = toDocs(stockTransfersRes, 'stockTransfers');

        // Products map
        const productsList = productsSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
        setProducts(productsList);
        const productById = new Map<string, any>();
        productsList.forEach((p: any) => productById.set(p.id, p));

        const journeyMap = new Map<string, JourneyEvent[]>();
        const addJourneyEvent = (serialNumber: string, event: Omit<JourneyEvent, 'serialNumber' | 'sortOrder'>) => {
          const normalizedSerial = normalizeSerialNumber(serialNumber || '');
          if (!normalizedSerial) return;

          const events = journeyMap.get(normalizedSerial) || [];
          events.push({
            ...event,
            serialNumber: serialNumber.trim(),
            sortOrder: getTimestampValue(event.date),
          });
          journeyMap.set(normalizedSerial, events);
        };

        const resolveProductName = (productId: string, fallbackName?: string) => {
          const productRef = productById.get(productId) || {};
          return productRef.name || fallbackName || 'Unknown Product';
        };

        const getJourneyProductInfo = (prod: any) => {
          const productId = String(prod.productId || prod.id || prod.hearingAidProductId || '').trim();
          return {
            productId,
            productName: resolveProductName(productId, prod.name),
          };
        };

        materialInSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const supplierName = data.supplier?.name || '';
          const location = data.location || headOfficeId;
          const isStockTransferIn = supplierName.includes('Stock Transfer from');

          (data.products || []).forEach((prod: any) => {
            const serialArray: string[] = Array.isArray(prod.serialNumbers)
              ? prod.serialNumbers
              : (prod.serialNumber ? [prod.serialNumber] : []);
            const { productId, productName } = getJourneyProductInfo(prod);

            serialArray.forEach((serialNumber: string) => {
              addJourneyEvent(serialNumber, {
                id: `material-in-${docSnap.id}-${serialNumber}`,
                productId,
                productName,
                eventType: isStockTransferIn ? 'stock-transfer-in' : 'material-in',
                title: isStockTransferIn ? 'Stock Transfer In' : 'Material In',
                description: isStockTransferIn
                  ? `Received via transfer from ${supplierName || 'another center'}`
                  : `Received from ${supplierName || 'supplier'}`,
                date: data.receivedDate || data.createdAt,
                location,
                counterparty: supplierName || undefined,
                referenceNo: data.challanNumber || '',
                notes: [data.status, data.notes].filter(Boolean).join(' • '),
                sourceLabel: 'Material In',
                sourcePath: `/material-in#id=${docSnap.id}`,
              });
            });
          });
        });

        purchasesSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const supplierName = data.party?.name || '';
          const location = data.location || headOfficeId;

          (data.products || []).forEach((prod: any) => {
            const serialArray: string[] = Array.isArray(prod.serialNumbers)
              ? prod.serialNumbers
              : (prod.serialNumber ? [prod.serialNumber] : []);
            const { productId, productName } = getJourneyProductInfo(prod);

            serialArray.forEach((serialNumber: string) => {
              addJourneyEvent(serialNumber, {
                id: `purchase-${docSnap.id}-${serialNumber}`,
                productId,
                productName,
                eventType: 'purchase',
                title: 'Purchased',
                description: `Purchased from ${supplierName || 'supplier'}`,
                date: data.purchaseDate || data.createdAt,
                location,
                counterparty: supplierName || undefined,
                referenceNo: data.invoiceNo || '',
                notes: data.reference || '',
                sourceLabel: 'Purchase',
                sourcePath: `/purchase-management#id=${docSnap.id}`,
              });
            });
          });
        });

        materialsOutSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const recipientName = data.recipient?.name || '';
          const location = data.location || headOfficeId;
          const reason = data.reason || '';
          const notes = data.notes || '';
          const status = data.status || 'dispatched';
          const isStockTransfer = notes.includes('Stock Transfer') || reason.includes('Stock Transfer');
          const isTrial = /trial/i.test(reason) || /trial/i.test(notes);

          (data.products || []).forEach((prod: any) => {
            const serialArray: string[] = Array.isArray(prod.serialNumbers)
              ? prod.serialNumbers
              : (prod.serialNumber ? [prod.serialNumber] : []);
            const { productId, productName } = getJourneyProductInfo(prod);

            serialArray.forEach((serialNumber: string) => {
              addJourneyEvent(serialNumber, {
                id: `material-out-${docSnap.id}-${serialNumber}`,
                productId,
                productName,
                eventType: isStockTransfer ? 'stock-transfer-out' : isTrial ? 'trial' : 'material-out',
                title: isStockTransfer
                  ? 'Stock Transfer Out'
                  : isTrial
                    ? 'Material Out for Trial'
                    : status === 'pending'
                      ? 'Material Out Pending'
                      : 'Material Out',
                description: recipientName
                  ? `Sent to ${recipientName}`
                  : 'Product moved out from inventory',
                date: data.dispatchDate || data.createdAt,
                location,
                counterparty: recipientName || undefined,
                referenceNo: data.challanNumber || '',
                notes: [status, reason, notes].filter(Boolean).join(' • '),
                sourceLabel: 'Material Out',
                sourcePath: `/material-out#id=${docSnap.id}`,
              });
            });
          });
        });

        salesSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          if (data.cancelled === true) return;
          const patientName = data.patientName || 'Unknown patient';
          const location = data.centerId || data.branch || '';

          (data.products || []).forEach((prod: any) => {
            const serialArray: string[] = Array.isArray(prod.serialNumbers)
              ? prod.serialNumbers
              : (prod.serialNumber ? [prod.serialNumber] : []);
            const { productId, productName } = getJourneyProductInfo(prod);

            serialArray.forEach((serialNumber: string) => {
              addJourneyEvent(serialNumber, {
                id: `sale-${docSnap.id}-${serialNumber}`,
                productId,
                productName,
                eventType: 'sale',
                title: 'Sold',
                description: `Sold to ${patientName}`,
                date: data.saleDate || data.createdAt,
                location,
                counterparty: patientName,
                referenceNo: data.invoiceNumber || '',
                notes: data.notes || '',
                sourceLabel: 'Sales',
                sourcePath: '/sales',
              });
            });
          });
        });

        enquiriesSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const patientName = data.name || 'Unknown patient';
          const visits: any[] = Array.isArray(data.visits) ? data.visits : [];

          visits.forEach((visit: any, visitIndex: number) => {
            const products: any[] = Array.isArray(visit.products) ? visit.products : [];
            const medicalServices: string[] = Array.isArray(visit.medicalServices) ? visit.medicalServices : [];
            const visitDate = visit.visitDate || data.updatedAt || data.createdAt;
            const isSaleVisit = !!(
              visit?.hearingAidSale ||
              medicalServices.includes('hearing_aid_sale') ||
              visit?.journeyStage === 'sale' ||
              visit?.hearingAidStatus === 'sold' ||
              (products.length > 0 && ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
            );

            products.forEach((prod: any) => {
              const { productId, productName } = getJourneyProductInfo(prod);
              const serialCandidates = Array.from(
                new Set([prod.serialNumber, prod.trialSerialNumber].filter(Boolean))
              ) as string[];
              const location = prod.location || data.center || '';

              serialCandidates.forEach((serialNumber: string) => {
                let addedSpecificEvent = false;

                if (visit?.hearingAidTrial || medicalServices.includes('hearing_aid_trial') || serialNumber === prod.trialSerialNumber) {
                  addedSpecificEvent = true;
                  addJourneyEvent(serialNumber, {
                    id: `trial-${docSnap.id}-${visit.id || visitIndex}-${serialNumber}`,
                    productId,
                    productName,
                    eventType: 'trial',
                    title: 'Trial Update',
                    description: `Trial recorded for ${patientName}`,
                    date: visit.trialStartDate || visitDate,
                    location,
                    counterparty: patientName,
                    referenceNo: visit.id || '',
                    notes: [
                      visit.trialStartDate ? `Start: ${visit.trialStartDate}` : '',
                      visit.trialEndDate ? `End: ${visit.trialEndDate}` : '',
                      visit.trialResult ? `Result: ${visit.trialResult}` : '',
                      visit.trialNotes || visit.visitNotes || '',
                    ].filter(Boolean).join(' • '),
                    sourceLabel: 'Enquiry',
                    sourcePath: `/interaction/enquiries/${docSnap.id}`,
                  });
                }

                if (visit?.hearingAidBooked || medicalServices.includes('hearing_aid_booked')) {
                  addedSpecificEvent = true;
                  addJourneyEvent(serialNumber, {
                    id: `booking-${docSnap.id}-${visit.id || visitIndex}-${serialNumber}`,
                    productId,
                    productName,
                    eventType: 'booking',
                    title: 'Booking Recorded',
                    description: `Product booked for ${patientName}`,
                    date: visit.bookingDate || visitDate,
                    location,
                    counterparty: patientName,
                    referenceNo: visit.id || '',
                    notes: [
                      visit.bookingAmount ? `Booking Amount: ${formatCurrency(visit.bookingAmount)}` : '',
                      visit.visitNotes || '',
                    ].filter(Boolean).join(' • '),
                    sourceLabel: 'Enquiry',
                    sourcePath: `/interaction/enquiries/${docSnap.id}`,
                  });
                }

                if (isSaleVisit) {
                  addedSpecificEvent = true;
                  addJourneyEvent(serialNumber, {
                    id: `enquiry-sale-${docSnap.id}-${visit.id || visitIndex}-${serialNumber}`,
                    productId,
                    productName,
                    eventType: 'sale',
                    title: 'Sale Marked in Enquiry',
                    description: `Sale noted for ${patientName}`,
                    date: prod.saleDate || visitDate,
                    location,
                    counterparty: patientName,
                    referenceNo: visit.id || '',
                    notes: [
                      visit.salesAfterTax ? `Amount: ${formatCurrency(visit.salesAfterTax)}` : '',
                      visit.visitNotes || '',
                    ].filter(Boolean).join(' • '),
                    sourceLabel: 'Enquiry',
                    sourcePath: `/interaction/enquiries/${docSnap.id}`,
                  });
                }

                if (!addedSpecificEvent && (visit.visitNotes || visit.hearingAidStatus || visit.journeyStage)) {
                  addJourneyEvent(serialNumber, {
                    id: `visit-update-${docSnap.id}-${visit.id || visitIndex}-${serialNumber}`,
                    productId,
                    productName,
                    eventType: 'visit-update',
                    title: 'Journey Update',
                    description: `Visit update for ${patientName}`,
                    date: visitDate,
                    location,
                    counterparty: patientName,
                    referenceNo: visit.id || '',
                    notes: [visit.hearingAidStatus, visit.journeyStage, visit.visitNotes].filter(Boolean).join(' • '),
                    sourceLabel: 'Enquiry',
                    sourcePath: `/interaction/enquiries/${docSnap.id}`,
                  });
                }
              });
            });

            if (visit.salesReturn) {
              const returnLines = expandSalesReturnLinesFromVisit(visit);
              returnLines.forEach((line) => {
                const sn = line.serialNumber;
                const matchedProduct = products.find((prod: any) =>
                  [prod.serialNumber, prod.trialSerialNumber].includes(sn)
                );
                const { productId, productName } = matchedProduct
                  ? getJourneyProductInfo(matchedProduct)
                  : { productId: '', productName: line.model || line.productName || 'Unknown Product' };
                addJourneyEvent(sn, {
                  id: `sale-return-${docSnap.id}-${visit.id || visitIndex}-${sn}`,
                  productId,
                  productName,
                  eventType: 'sale-return',
                  title: 'Sales Return',
                  description: `Return recorded for ${patientName}`,
                  date: visit.returnDate || visitDate,
                  location: matchedProduct?.location || data.center || '',
                  counterparty: patientName,
                  referenceNo: visit.id || visit.returnOriginalSaleVisitId || '',
                  notes: [
                    line.model ? `Model: ${line.model}` : '',
                    visit.returnReason || '',
                    visit.returnCondition || '',
                    visit.returnNotes || '',
                  ]
                    .filter(Boolean)
                    .join(' • '),
                  sourceLabel: 'Enquiry',
                  sourcePath: `/interaction/enquiries/${docSnap.id}`,
                });
              });
            }
          });
        });

        const splitSerialCandidates = (raw: unknown): string[] => {
          if (Array.isArray(raw)) {
            return raw
              .map((v) => normalizeSerialNumber(String(v || '')))
              .filter(Boolean);
          }
          const text = String(raw || '').trim();
          if (!text) return [];
          return text
            .split(/[,\n;|]+/g)
            .map((v) => normalizeSerialNumber(v))
            .filter(Boolean);
        };

        const makeSerialKey = (productId: unknown, serialNumber: unknown): string =>
          `${String(productId || '').trim()}|${normalizeSerialNumber(String(serialNumber || ''))}`;
        const makePairGroupKey = (item: InventoryItem): string =>
          [
            item.productId,
            item.location,
            item.company,
            item.status,
            item.purchaseInvoice,
            item.supplier,
          ].join('|');
        const normalizePairTuple = (pair: unknown): [string, string] | null => {
          if (!Array.isArray(pair) || pair.length < 2) return null;
          const left = normalizeSerialNumber(String(pair[0] || ''));
          const right = normalizeSerialNumber(String(pair[1] || ''));
          if (!left || !right || left === right) return null;
          return [left, right];
        };
        const normalizeSerialPairs = (value: unknown): [string, string][] => {
          if (!Array.isArray(value)) return [];
          const out: [string, string][] = [];
          value.forEach((entry) => {
            const tuple = normalizePairTuple(entry);
            if (tuple) out.push(tuple);
          });
          return out;
        };

        const serialPairHints = new Map<string, string>();
        const registerSerialPairHints = (productId: string, serialPairs: [string, string][]) => {
          serialPairs.forEach(([left, right]) => {
            serialPairHints.set(makeSerialKey(productId, left), right);
            serialPairHints.set(makeSerialKey(productId, right), left);
          });
        };

        const pairOverridesSnap = await getDocs(collection(db, 'inventoryPairOverrides'));
        const pairOverridesByGroup = new Map<string, [string, string][]>();
        pairOverridesSnap.docs.forEach((docSnap: any) => {
          const data = docSnap.data() as { groupKey?: string; pairs?: unknown };
          const groupKey = String(data?.groupKey || docSnap.id || '').trim();
          if (!groupKey) return;
          const pairs = normalizeSerialPairs(data?.pairs);
          if (pairs.length > 0) pairOverridesByGroup.set(groupKey, pairs);
        });

        const serialCandidatesFromProduct = (prod: any): string[] => {
          const direct = [
            prod?.serialNumber,
            prod?.trialSerialNumber,
            prod?.serialNo,
            prod?.serial_no,
            prod?.deviceSerial,
            prod?.hearingAidSerial,
          ];
          const all: string[] = [];
          if (Array.isArray(prod?.serialNumbers) && prod.serialNumbers.length > 0) {
            all.push(...splitSerialCandidates(prod.serialNumbers));
          }
          direct.forEach((v) => all.push(...splitSerialCandidates(v)));
          if (Array.isArray(prod?.previousSales)) {
            prod.previousSales.forEach((line: any) => {
              all.push(...splitSerialCandidates(line?.serialNumber));
            });
          }
          return Array.from(new Set(all.filter(Boolean)));
        };

        const extractSerialLikeValuesDeep = (input: unknown): string[] => {
          // Keep this intentionally shallow/safe to avoid runtime failures in production.
          if (!input || typeof input !== 'object') return [];
          const obj = input as Record<string, unknown>;
          const out: string[] = [];
          Object.entries(obj).forEach(([k, v]) => {
            const key = k.toLowerCase();
            if (key.includes('serial')) {
              out.push(...splitSerialCandidates(v));
            }
          });
          return Array.from(new Set(out.filter(Boolean)));
        };

        const serialCandidatesFromVisit = (visit: any): string[] => {
          const all: string[] = [];
          all.push(...splitSerialCandidates(visit?.trialSerialNumber));
          all.push(...splitSerialCandidates(visit?.serialNumber));
          all.push(...splitSerialCandidates(visit?.hearingAidDetails?.trialSerialNumber));
          all.push(...splitSerialCandidates(visit?.hearingAidDetails?.serialNumber));
          if (Array.isArray(visit?.hearingAidDetails?.products)) {
            visit.hearingAidDetails.products.forEach((p: any) => {
              all.push(...serialCandidatesFromProduct(p));
            });
          }
          if (Array.isArray(visit?.previousSales)) {
            visit.previousSales.forEach((line: any) => {
              all.push(...splitSerialCandidates(line?.serialNumber));
            });
          }
          if (Array.isArray(visit?.hearingAidDetails?.previousSales)) {
            visit.hearingAidDetails.previousSales.forEach((line: any) => {
              all.push(...splitSerialCandidates(line?.serialNumber));
            });
          }
          return Array.from(new Set(all.filter(Boolean)));
        };

        // Incoming serials for stock transfer tracking
        const stockTransferInSerials = new Set<string>();
        materialInSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const supplierName = data.supplier?.name || '';
          // Check if this is a stock transfer entry
          if (supplierName.includes('Stock Transfer from')) {
            (data.products || []).forEach((prod: any) => {
              const serialArray: string[] = splitSerialCandidates(
                Array.isArray(prod.serialNumbers) ? prod.serialNumbers : prod.serialNumber
              );
              serialArray.forEach((sn: string) => {
                stockTransferInSerials.add(makeSerialKey(prod.productId || prod.id || '', sn));
              });
            });
          }
        });

        // Outgoing serials: materials out and sales (excluding stock transfers that were received)
        const pendingOutSerials = new Set<string>();
        const dispatchedOutSerials = new Set<string>();
        const stockTransferOutSerials = new Map<string, string>(); // key: serial key, value: source location
        materialsOutSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const rawStatus = (data.status as string) || '';
          const notes = data.notes || '';
          const reason = data.reason || '';
          const documentLocation = data.location || headOfficeId;
          const isStockTransfer = notes.includes('Stock Transfer') || reason.includes('Stock Transfer');
          
          (data.products || []).forEach((prod: any) => {
            const serialArray: string[] = splitSerialCandidates(
              Array.isArray(prod.serialNumbers) ? prod.serialNumbers : prod.serialNumber
            );
            serialArray.forEach((sn: string) => {
              const key = makeSerialKey(prod.productId || prod.id || '', sn);
              
              // For stock transfers, track which location the serial was transferred from
              if (isStockTransfer) {
                // Skip if this stock transfer was received elsewhere (already handled)
                if (stockTransferInSerials.has(key)) {
                  return; // Don't mark as reserved/dispatched, and don't remove from source
                }
                // Track that this serial was transferred out from this location
                stockTransferOutSerials.set(key, documentLocation);
              } else {
                // Regular materials out (not stock transfers)
                // If status is missing (older docs), treat as dispatched so inventory is reduced.
                const status = rawStatus || 'dispatched';
                if (status === 'returned') return;
                if (status === 'pending') pendingOutSerials.add(key);
                else dispatchedOutSerials.add(key);
              }
            });
          });
        });

        const soldSerials = new Set<string>();
        const soldSerialOnly = new Set<string>();
        const soldSerialMetaByKey = new Map<string, {
          productId: string;
          serialNumber: string;
          productName?: string;
          type?: string;
          company?: string;
          centerId?: string;
          saleDate?: any;
          invoiceNumber?: string;
        }>();
        const soldSerialMetaBySerial = new Map<string, {
          productId: string;
          serialNumber: string;
          productName?: string;
          type?: string;
          company?: string;
          centerId?: string;
          saleDate?: any;
          invoiceNumber?: string;
        }>();

        // Align inventory sold-serial truth with Product Journey: a serial counts as sold from
        // journey only if the latest relevant event is still a sale (returns / SR material-in clear it).
        const soldFromJourneyOnly = new Set<string>();
        const journeyClearsSoldState = (e: JourneyEvent) => {
          if (e.eventType === 'sale-return') return true;
          if (e.eventType === 'material-in') {
            const c = String(e.counterparty || '').toLowerCase();
            return c.includes('sales return');
          }
          return false;
        };
        journeyMap.forEach((events, serialKey) => {
          const sorted = [...events].sort((a, b) => a.sortOrder - b.sortOrder);
          let sold = false;
          for (const ev of sorted) {
            if (ev.eventType === 'sale') sold = true;
            else if (journeyClearsSoldState(ev)) sold = false;
          }
          if (sold) {
            const normalized = normalizeSerialNumber(serialKey);
            if (normalized) soldFromJourneyOnly.add(normalized);
          }
        });
        for (const sn of soldFromJourneyOnly) {
          soldSerialOnly.add(sn);
        }
        
        // Process sales from sales collection
        salesSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          if (data.cancelled === true) return;
          const saleProducts: any[] = Array.isArray(data.products)
            ? data.products
            : (Array.isArray(data.items) ? data.items : []);
          saleProducts.forEach((prod: any) => {
            // Handle both sales collection structure and enquiry-derived sales
            const productId = prod.productId || prod.id || '';
            const serialCandidates = serialCandidatesFromProduct(prod);
            serialCandidates.forEach((serialNumber) => {
              const key = makeSerialKey(productId, serialNumber);
              if (serialNumber) {
                soldSerials.add(key);
                soldSerialOnly.add(normalizeSerialNumber(String(serialNumber || '')));
                soldSerialMetaByKey.set(key, {
                  productId: String(productId || '').trim(),
                  serialNumber: normalizeSerialNumber(String(serialNumber || '')),
                  productName: resolveProductName(String(productId || '').trim(), prod.name || data.productName || ''),
                  type: prod.type || '',
                  company: data.company || '',
                  centerId: data.centerId || '',
                  saleDate: data.saleDate || data.createdAt || null,
                  invoiceNumber: data.invoiceNumber || '',
                });
                soldSerialMetaBySerial.set(normalizeSerialNumber(String(serialNumber || '')), {
                  productId: String(productId || '').trim(),
                  serialNumber: normalizeSerialNumber(String(serialNumber || '')),
                  productName: resolveProductName(String(productId || '').trim(), prod.name || data.productName || ''),
                  type: prod.type || '',
                  company: data.company || '',
                  centerId: data.centerId || '',
                  saleDate: data.saleDate || data.createdAt || null,
                  invoiceNumber: data.invoiceNumber || '',
                });
                console.log(`Added sold serial: ${key} from sale ${docSnap.id}`);
              }
            });
          });

          // Fallback for non-standard sales docs with serials at top level.
          const docLevelSerials = splitSerialCandidates(
            data.serialNumber || data.trialSerialNumber || data.deviceSerial || data.hearingAidSerial
          );
          const deepDocSerials = extractSerialLikeValuesDeep(data);
          Array.from(new Set([...docLevelSerials, ...deepDocSerials])).forEach((serialNumber) => {
            const key = makeSerialKey(data.productId || '', serialNumber);
            soldSerials.add(key);
            soldSerialOnly.add(normalizeSerialNumber(String(serialNumber || '')));
          });
        });

        // Also check enquiries collection for sales (to handle sales recorded in visits)
        enquiriesSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const visits: any[] = Array.isArray(data.visits) ? data.visits : [];
          visits.forEach((visit: any) => {
            const visitSerialCandidates = serialCandidatesFromVisit(visit);
            const isSale = !!(
              visit?.hearingAidSale ||
                visit?.purchaseFromTrial ||
                visit?.hearingAidStatus === 'sold' ||
                visit?.hearingAidDetails?.hearingAidStatus === 'sold'
            );

            if (isSale) {
              const products: any[] = Array.isArray(visit.products)
                ? visit.products
                : (Array.isArray(visit?.hearingAidDetails?.products) ? visit.hearingAidDetails.products : []);
              const visitLevelSerials = Array.from(new Set([
                ...visitSerialCandidates,
                ...extractSerialLikeValuesDeep(visit),
              ]));
              products.forEach((prod: any) => {
                // Handle different product structures in enquiry visits
                const productId = prod.productId || prod.id || prod.hearingAidProductId || '';
                const serialCandidates = serialCandidatesFromProduct(prod);
                serialCandidates.forEach((serialNumber) => {
                  const key = makeSerialKey(productId, serialNumber);
                  if (serialNumber) {
                    soldSerials.add(key);
                    soldSerialOnly.add(normalizeSerialNumber(String(serialNumber || '')));
                    soldSerialMetaByKey.set(key, {
                      productId: String(productId || '').trim(),
                      serialNumber: normalizeSerialNumber(String(serialNumber || '')),
                      productName: resolveProductName(String(productId || '').trim(), prod.name || ''),
                      type: prod.type || '',
                      company: data.company || '',
                      centerId: visit.centerId || data.visitingCenter || data.center || '',
                      saleDate: visit.purchaseDate || visit.visitDate || data.updatedAt || data.createdAt || null,
                      invoiceNumber: visit.invoiceNumber || '',
                    });
                    soldSerialMetaBySerial.set(normalizeSerialNumber(String(serialNumber || '')), {
                      productId: String(productId || '').trim(),
                      serialNumber: normalizeSerialNumber(String(serialNumber || '')),
                      productName: resolveProductName(String(productId || '').trim(), prod.name || ''),
                      type: prod.type || '',
                      company: data.company || '',
                      centerId: visit.centerId || data.visitingCenter || data.center || '',
                      saleDate: visit.purchaseDate || visit.visitDate || data.updatedAt || data.createdAt || null,
                      invoiceNumber: visit.invoiceNumber || '',
                    });
                    console.log(`Added sold serial from enquiry: ${key} from enquiry ${docSnap.id}`);
                  }
                });
              });

              // If products are absent/malformed, still capture sold serial from visit-level fields.
              visitLevelSerials.forEach((serialNumber) => {
                const key = makeSerialKey(visit?.hearingAidProductId || visit?.hearingAidDetails?.hearingAidProductId || '', serialNumber);
                soldSerials.add(key);
                soldSerialOnly.add(normalizeSerialNumber(String(serialNumber || '')));
              });
            }
          });
        });

        // Serials on a sales return for this enquiry must not stay marked sold from visit mirrors
        // (the `sales` doc may be voided, but visit rows can still carry the sold device until edited).
        enquiriesSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const visits: any[] = Array.isArray(data.visits) ? data.visits : [];
          const stripKeys = new Set<string>();
          visits.forEach((rv: any) => {
            if (!rv?.salesReturn) return;
            expandSalesReturnLinesFromVisit(rv).forEach((line) => {
              const retTokens = splitSerialCandidates(line.serialNumber);
              retTokens.forEach((normRet) => {
                if (!normRet) return;
                visits.forEach((sv: any) => {
                  const isSale = !!(
                    sv?.hearingAidSale ||
                    sv?.purchaseFromTrial ||
                    sv?.hearingAidStatus === 'sold' ||
                    sv?.hearingAidDetails?.hearingAidStatus === 'sold'
                  );
                  if (!isSale) return;
                  const products: any[] = Array.isArray(sv.products)
                    ? sv.products
                    : Array.isArray(sv?.hearingAidDetails?.products)
                      ? sv.hearingAidDetails.products
                      : [];
                  products.forEach((prod: any) => {
                    const productId = prod.productId || prod.id || prod.hearingAidProductId || '';
                    serialCandidatesFromProduct(prod).forEach((cand) => {
                      if (normalizeSerialNumber(String(cand)) === normRet) {
                        stripKeys.add(makeSerialKey(productId, cand));
                        stripKeys.add(makeSerialKey(productId, normRet));
                      }
                    });
                  });
                });
              });
            });
          });
          stripKeys.forEach((k) => {
            soldSerials.delete(k);
            soldSerialMetaByKey.delete(k);
          });
        });

        const soldNormsFromKeys = new Set<string>();
        soldSerials.forEach((k) => {
          const pipe = k.indexOf('|');
          if (pipe >= 0) soldNormsFromKeys.add(k.slice(pipe + 1));
        });
        soldSerialOnly.clear();
        soldNormsFromKeys.forEach((n) => soldSerialOnly.add(n));
        soldFromJourneyOnly.forEach((n) => soldSerialOnly.add(n));
        soldSerialMetaBySerial.clear();
        soldSerialMetaByKey.forEach((meta) => {
          soldSerialMetaBySerial.set(meta.serialNumber, meta);
        });

        const inventoryRowIsSold = (productId: string, serialKey: string, sn: string): boolean => {
          const normSn = normalizeSerialNumber(String(sn || ''));
          if (soldSerials.has(serialKey)) return true;
          if (!soldSerialOnly.has(normSn)) return false;
          const meta = soldSerialMetaBySerial.get(normSn);
          if (!meta) return true;
          const mp = String(meta.productId || '').trim();
          if (!mp) return true;
          return mp === String(productId || '').trim();
        };

        // Build lookup maps for deep links
        const challanByNumber = new Map<string, string>();
        materialInSnap.docs.forEach((d: any) => {
          const ch = (d.data() as any).challanNumber;
          if (ch) challanByNumber.set(ch, d.id);
        });
        const invoiceByNumber = new Map<string, string>();
        purchasesSnap.docs.forEach((d: any) => {
          const inv = (d.data() as any).invoiceNo;
          if (inv) invoiceByNumber.set(inv, d.id);
        });

        // Incoming serials from materialIn and purchases (dedupe by productId|serial)
        const incomingMap = new Map<string, InventoryItem>();
        // Non-serial incoming aggregation - track by product+location for accurate stock transfers
        type NonSerialAgg = { qty: number; lastDate: any; lastSupplier: string; lastInvoice: string; lastSourceType?: 'materialIn' | 'purchase'; lastDocId?: string; lastLocation?: string; mrp?: number; dealerPrice?: number };
        const nonSerialInByProductAndLocation = new Map<string, NonSerialAgg>(); // key: `${productId}|${location}`
        const nonSerialInByProduct = new Map<string, NonSerialAgg>(); // Legacy: for backward compatibility

        // Sort materialIn / purchases chronologically so that when multiple
        // "Stock Transfer from X" docs target the same serial, the newest one
        // wins the location override. Primary key: receivedDate/purchaseDate;
        // tiebreaker: createdAt (a serverTimestamp that is strictly monotonic).
        const docTs = (val: any): number => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          if (typeof val?.toMillis === 'function') return val.toMillis();
          if (typeof val?.seconds === 'number') return val.seconds * 1000;
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        const materialInDocsSorted = [...materialInSnap.docs].sort((a: any, b: any) => {
          const ad: any = a.data();
          const bd: any = b.data();
          const primary = docTs(ad.receivedDate) - docTs(bd.receivedDate);
          if (primary !== 0) return primary;
          return docTs(ad.createdAt) - docTs(bd.createdAt);
        });
        const purchasesDocsSorted = [...purchasesSnap.docs].sort((a: any, b: any) => {
          const ad: any = a.data();
          const bd: any = b.data();
          const primary = docTs(ad.purchaseDate) - docTs(bd.purchaseDate);
          if (primary !== 0) return primary;
          return docTs(ad.createdAt) - docTs(bd.createdAt);
        });

        // Material Inward
        materialInDocsSorted.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const receivedDate = data.receivedDate;
          const supplierName = data.supplier?.name || '';
          const companyLocation = data.company || '';
          const documentLocation = data.location || headOfficeId; // Default to head office for backward compatibility
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id;
            const productRef = productById.get(productId) || {};
            const productName = resolveProductName(String(productId || '').trim(), prod.name || '');
            const type = prod.type || productRef.type || '';
            // Use companyLocation (from material-in form) as the primary company, fallback to product company
            const company = companyLocation || productRef.company || '';
            // Store original product company separately for manufacturer analysis
            const originalProductCompany = productRef.company || '';
            const mrp = prod.mrp ?? productRef.mrp ?? 0;
            const dealerPrice = prod.dealerPrice ?? prod.finalPrice ?? 0;
            const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
            registerSerialPairHints(productId, normalizeSerialPairs(prod.serialPairs));
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
            serials.forEach((sn: string) => {
              const key = makeSerialKey(productId, sn);
              const isStockTransferIn = supplierName.includes('Stock Transfer from');
              if (incomingMap.has(key)) {
                // Stock transfer IN should override the current location/company (move item)
                if (isStockTransferIn) {
                  const existing = incomingMap.get(key)!;
                  incomingMap.set(key, {
                    ...existing,
                    location: documentLocation,
                    company,
                    purchaseDate: receivedDate,
                    purchaseInvoice: data.challanNumber || existing.purchaseInvoice,
                    supplier: supplierName || existing.supplier,
                    sourceType: 'materialIn',
                    sourceDocId: docSnap.id,
                    updatedAt: data.updatedAt || receivedDate,
                  });
                }
                return;
              }
              
              const isSold = inventoryRowIsSold(productId, key, sn);
              // Exclude dispatched-out items only when they are not sold.
              // Sold devices must remain visible in inventory (Show Sold Items) for serial lock safety.
              if (dispatchedOutSerials.has(key) && !isSold) return;
              
              // Determine status based on sales / pending out
              const isReserved = pendingOutSerials.has(key);
              const status: InventoryItem['status'] = isSold ? 'Sold' : (isReserved ? 'Reserved' : 'In Stock');
              
              incomingMap.set(key, {
                // Stable unique id per product+serial (avoids collisions across products in same challan)
                id: `sn-${key}`,
                productId,
                productName,
                serialNumber: sn,
                type,
                company,
                originalProductCompany,
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
        purchasesDocsSorted.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const purchaseDate = data.purchaseDate;
          const supplierName = data.party?.name || '';
          const companyLocation = data.company || '';
          const documentLocation = data.location || headOfficeId; // Default to head office for backward compatibility
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id;
            const productRef = productById.get(productId) || {};
            const productName = resolveProductName(String(productId || '').trim(), prod.name || '');
            const type = prod.type || productRef.type || '';
            // Use companyLocation (from purchase form) as the primary company, fallback to product company
            const company = companyLocation || productRef.company || '';
            // Store original product company separately for manufacturer analysis
            const originalProductCompany = productRef.company || '';
            const mrp = prod.mrp ?? productRef.mrp ?? 0;
            const dealerPrice = prod.dealerPrice ?? prod.finalPrice ?? 0;
            const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
            registerSerialPairHints(productId, normalizeSerialPairs(prod.serialPairs));
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
            serials.forEach((sn: string) => {
              const key = makeSerialKey(productId, sn);
              if (incomingMap.has(key)) return; // already from material in (converted)
              
              const isSold = inventoryRowIsSold(productId, key, sn);
              // Exclude dispatched-out items only when they are not sold.
              if (dispatchedOutSerials.has(key) && !isSold) return;
              
              // Determine status based on sales / pending out
              const isReserved = pendingOutSerials.has(key);
              const status: InventoryItem['status'] = isSold ? 'Sold' : (isReserved ? 'Reserved' : 'In Stock');
              
              incomingMap.set(key, {
                // Same stable id strategy for purchases
                id: `sn-${key}`,
                productId,
                productName,
                serialNumber: sn,
                type,
                company,
                originalProductCompany,
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

        // Outgoing non-serial aggregation (materials out + sales) - track by productId + location
        const nonSerialOutByProductAndLocation = new Map<string, number>(); // key: `${productId}|${location}`
        const nonSerialOutByProduct = new Map<string, number>(); // Global for sales (not location-specific)
        
        // Count materials out by location (for stock transfers)
        materialsOutSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const documentLocation = data.location || headOfficeId;
          const notes = data.notes || '';
          const reason = data.reason || '';
          const isStockTransfer = notes.includes('Stock Transfer') || reason.includes('Stock Transfer');
          
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id;
            const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
            const hasSerial = serials && serials.length > 0;
            if (!hasSerial) {
              // For stock transfers, track by location; for other materials out, track globally
              if (isStockTransfer) {
                const key = `${productId}|${documentLocation}`;
                nonSerialOutByProductAndLocation.set(key, (nonSerialOutByProductAndLocation.get(key) || 0) + (prod.quantity || 0));
              } else {
                // Regular materials out (not stock transfers) - track globally
                nonSerialOutByProduct.set(productId, (nonSerialOutByProduct.get(productId) || 0) + (prod.quantity || 0));
              }
            }
          });
        });

        // Count sales (both from sales collection and enquiries)
        salesSnap.docs.forEach((docSnap: any) => {
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
        enquiriesSnap.docs.forEach((docSnap: any) => {
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

        // Authoritative stock-transfer moves for serial items. We use the
        // `stockTransfers` collection (already ordered by createdAt asc) as
        // the source of truth, so successive transfers always place the
        // serial at the latest destination — even if the synthetic
        // "Stock Transfer from X" materialInward docs are missing, ordered
        // unexpectedly, or share a tied receivedDate.
        stockTransfersSnap.docs.forEach((trDoc: any) => {
          const tr: any = trDoc.data();
          const toBranch = String(tr.toBranch || '').trim();
          if (!toBranch) return;
          const transferCompany =
            tr.transferType === 'intercompany'
              ? (tr.toCompany || tr.company || '')
              : (tr.company || tr.toCompany || '');
          (tr.products || []).forEach((p: any) => {
            const productId = p.productId || p.id || '';
            const serials: string[] = Array.isArray(p.serialNumbers)
              ? p.serialNumbers
              : (p.serialNumber ? [p.serialNumber] : []);
            serials.forEach((sn: string) => {
              const key = makeSerialKey(productId, sn);
              const existing = incomingMap.get(key);
              if (!existing) return;
              // Never move sold serials – their location must reflect where
              // the sale was recorded (already handled by sold metadata).
              if (existing.status === 'Sold') return;
              incomingMap.set(key, {
                ...existing,
                location: toBranch,
                company: transferCompany || existing.company,
              });
            });
          });
        });

        // Finalize serial items (ensure source links exist even if missing)
        const finalizedSerialItems = Array.from(incomingMap.values()).map((itm) => {
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

        // Force serial-level sold truth: if any source marks a serial as sold,
        // mark every matching inventory row for that serial as Sold (even when productId keys differ).
        incomingMap.forEach((itm, k) => {
          const normalizedSerial = normalizeSerialNumber(String(itm.serialNumber || ''));
          if (!normalizedSerial) return;
          if (soldSerialOnly.has(normalizedSerial) && itm.status !== 'Sold') {
            incomingMap.set(k, { ...itm, status: 'Sold' });
          }
        });

        // Ensure sold serials are represented even if source inward/purchase row is missing.
        // This prevents sold devices (e.g. dummy3) from disappearing from inventory table.
        soldSerialMetaByKey.forEach((meta, key) => {
          if (incomingMap.has(key)) return;
          const productRef = productById.get(meta.productId) || {};
          const location = String(meta.centerId || '').trim();
          incomingMap.set(key, {
            id: `sold-${key}`,
            productId: meta.productId,
            productName: resolveProductName(meta.productId, meta.productName),
            serialNumber: meta.serialNumber,
            type: meta.type || productRef.type || '',
            company: meta.company || productRef.company || '',
            originalProductCompany: productRef.company || '',
            location,
            status: 'Sold',
            dealerPrice: Number(productRef.dealerPrice || 0),
            mrp: Number(productRef.mrp || 0),
            purchaseDate: meta.saleDate || null,
            purchaseInvoice: meta.invoiceNumber || '',
            supplier: '',
            createdAt: meta.saleDate || null,
            updatedAt: meta.saleDate || null,
          });
        });

        // Serial-level fallback: if a serial is known sold but still missing in incomingMap
        // (productId/key mismatch edge cases), add one guaranteed Sold row.
        const existingSerials = new Set<string>();
        incomingMap.forEach((itm) => {
          const normalized = normalizeSerialNumber(String(itm.serialNumber || ''));
          if (normalized) existingSerials.add(normalized);
        });
        for (const serial of soldSerialOnly) {
          const normalizedSerial = normalizeSerialNumber(serial);
          if (!normalizedSerial || existingSerials.has(normalizedSerial)) continue;
          const meta = soldSerialMetaBySerial.get(normalizedSerial);
          const productRef = productById.get(meta?.productId || '') || {};
          const productId = String(meta?.productId || '').trim();
          const key = makeSerialKey(productId, normalizedSerial);
          incomingMap.set(key, {
            id: `sold-serial-${normalizedSerial}`,
            productId,
            productName: resolveProductName(productId, meta?.productName),
            serialNumber: normalizedSerial,
            type: meta?.type || productRef.type || '',
            company: meta?.company || productRef.company || '',
            originalProductCompany: productRef.company || '',
            location: String(meta?.centerId || '').trim(),
            status: 'Sold',
            dealerPrice: Number(productRef.dealerPrice || 0),
            mrp: Number(productRef.mrp || 0),
            purchaseDate: meta?.saleDate || null,
            purchaseInvoice: meta?.invoiceNumber || '',
            supplier: '',
            createdAt: meta?.saleDate || null,
            updatedAt: meta?.saleDate || null,
          });
        }

        // Group serial items for products that are sold in pairs
        const serialItems: InventoryItem[] = (() => {
          // Helper to group serial-tracked pair products into single rows with multiple serials
          const pairGroups = new Map<string, InventoryItem[]>();
          const singles: InventoryItem[] = [];

          finalizedSerialItems.forEach((item) => {
            const productRef = productById.get(item.productId) || {};
            const quantityType = productRef.quantityType || productRef.quantityTypeLegacy;
            const isPairProduct = quantityType === 'pair';

            // If not a pair product or missing serial, keep as single-item entry
            if (!isPairProduct || !item.serialNumber || item.serialNumber === '-') {
              singles.push({
                ...item,
                quantity: item.quantity ?? 1,
                serialNumbers: item.serialNumber && item.serialNumber !== '-' ? [item.serialNumber] : [],
              });
              return;
            }

            const groupKey = [
              item.productId,
              item.location,
              item.company,
              item.status,
              item.purchaseInvoice,
              item.supplier,
            ].join('|');

            if (!pairGroups.has(groupKey)) {
              pairGroups.set(groupKey, []);
            }
            pairGroups.get(groupKey)!.push(item);
          });

          const groupedPairs: InventoryItem[] = [];

          pairGroups.forEach((itemsForKey) => {
            const bySerial = new Map<string, InventoryItem>();
            const orderedSerials: string[] = [];
            itemsForKey.forEach((item) => {
              const serial = normalizeSerialNumber(item.serialNumber || '');
              if (!serial) return;
              bySerial.set(serial, item);
              orderedSerials.push(serial);
            });

            const used = new Set<string>();
            const groupKey = itemsForKey[0] ? makePairGroupKey(itemsForKey[0]) : '';
            const manualPairs = pairOverridesByGroup.get(groupKey) || [];

            const emitPair = (a: string, b: string, source: InventoryItem['pairSource']) => {
              const left = bySerial.get(a);
              const right = bySerial.get(b);
              if (!left || !right) return;
              used.add(a);
              used.add(b);
              groupedPairs.push({
                ...left,
                id: `${left.id}-pair-${a}-${b}`,
                serialNumber: `${a}, ${b}`,
                serialNumbers: [a, b],
                quantity: 1,
                pairSource: source,
                pairGroupKey: groupKey,
              });
            };

            manualPairs.forEach(([aRaw, bRaw]) => {
              const a = normalizeSerialNumber(aRaw);
              const b = normalizeSerialNumber(bRaw);
              if (!a || !b || used.has(a) || used.has(b)) return;
              emitPair(a, b, 'manualOverride');
            });

            orderedSerials.forEach((serial) => {
              if (used.has(serial)) return;
              const partner = serialPairHints.get(makeSerialKey(itemsForKey[0]?.productId || '', serial));
              if (!partner || used.has(partner)) return;
              emitPair(serial, partner, 'serialPairs');
            });

            const remaining = orderedSerials.filter((sn) => !used.has(sn));
            for (let i = 0; i < remaining.length; i += 2) {
              const a = remaining[i];
              const b = remaining[i + 1];
              if (b) {
                emitPair(a, b, 'legacyFallback');
              } else {
                const base = bySerial.get(a);
                if (!base) continue;
                groupedPairs.push({
                  ...base,
                  id: `${base.id}-unpaired-${a}`,
                  serialNumber: a,
                  serialNumbers: [a],
                  quantity: 1,
                  pairSource: 'unpaired',
                  pairGroupKey: groupKey,
                });
              }
            }
          });

          return [...singles, ...groupedPairs];
        })();

        // Build non-serial items per product and location with remaining quantity
        // Aggregate incoming by product + location (populate the map declared above)
        materialInSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const documentLocation = data.location || headOfficeId;
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id;
            const productRef = productById.get(productId) || {};
            const isSerialTracked = !!productRef.hasSerialNumber;
            const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
            const hasSerial = Array.isArray(serials) && serials.length > 0;
            
            if (!hasSerial && !isSerialTracked) {
              const key = `${productId}|${documentLocation}`;
              const prev = nonSerialInByProductAndLocation.get(key) || { 
                qty: 0, lastDate: null, lastSupplier: '', lastInvoice: '', 
                lastLocation: documentLocation, mrp: prod.mrp ?? productRef.mrp ?? 0, 
                dealerPrice: prod.dealerPrice ?? prod.finalPrice ?? 0,
                lastSourceType: undefined as 'materialIn' | 'purchase' | undefined,
                lastDocId: undefined as string | undefined
              };
              const receivedDate = data.receivedDate;
              const thisDate = receivedDate?.toMillis ? receivedDate.toMillis() : (receivedDate?.seconds || 0);
              const prevDate = prev.lastDate?.toMillis ? prev.lastDate.toMillis() : (prev.lastDate?.seconds || 0);
              const newer = !prev.lastDate || thisDate >= prevDate;
              
              nonSerialInByProductAndLocation.set(key, {
                qty: prev.qty + (prod.quantity || 0),
                lastDate: newer ? receivedDate : prev.lastDate,
                lastSupplier: newer ? (data.supplier?.name || '') : prev.lastSupplier,
                lastInvoice: newer ? (data.challanNumber || '') : prev.lastInvoice,
                lastSourceType: newer ? 'materialIn' : prev.lastSourceType,
                lastDocId: newer ? docSnap.id : prev.lastDocId,
                lastLocation: documentLocation,
                mrp: prod.mrp ?? productRef.mrp ?? prev.mrp ?? 0,
                dealerPrice: prod.dealerPrice ?? prod.finalPrice ?? prev.dealerPrice ?? 0,
              });
            }
          });
        });
        
        // Also add purchases by location
        purchasesSnap.docs.forEach((docSnap: any) => {
          const data: any = docSnap.data();
          const documentLocation = data.location || headOfficeId;
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id;
            const productRef = productById.get(productId) || {};
            const isSerialTracked = !!productRef.hasSerialNumber;
            const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : [];
            const hasSerial = Array.isArray(serials) && serials.length > 0;
            
            if (!hasSerial && !isSerialTracked) {
              const key = `${productId}|${documentLocation}`;
              const prev = nonSerialInByProductAndLocation.get(key) || { 
                qty: 0, lastDate: null, lastSupplier: '', lastInvoice: '', 
                lastLocation: documentLocation, mrp: prod.mrp ?? productRef.mrp ?? 0, 
                dealerPrice: prod.dealerPrice ?? prod.finalPrice ?? 0,
                lastSourceType: undefined as 'materialIn' | 'purchase' | undefined,
                lastDocId: undefined as string | undefined
              };
              const purchaseDate = data.purchaseDate;
              const thisDate = purchaseDate?.toMillis ? purchaseDate.toMillis() : (purchaseDate?.seconds || 0);
              const prevDate = prev.lastDate?.toMillis ? prev.lastDate.toMillis() : (prev.lastDate?.seconds || 0);
              const newer = !prev.lastDate || thisDate >= prevDate;
              
              nonSerialInByProductAndLocation.set(key, {
                qty: prev.qty + (prod.quantity || 0),
                lastDate: newer ? purchaseDate : prev.lastDate,
                lastSupplier: newer ? (data.party?.name || '') : prev.lastSupplier,
                lastInvoice: newer ? (data.invoiceNo || '') : prev.lastInvoice,
                lastSourceType: newer ? 'purchase' : prev.lastSourceType,
                lastDocId: newer ? docSnap.id : prev.lastDocId,
                lastLocation: documentLocation,
                mrp: prod.mrp ?? productRef.mrp ?? prev.mrp ?? 0,
                dealerPrice: prod.dealerPrice ?? prod.finalPrice ?? prev.dealerPrice ?? 0,
              });
            }
          });
        });
        
        // Safety net for non-serial quantities: if a stockTransfer was saved
        // but its synthetic materialOut/materialInward docs are missing
        // (e.g. createInventoryMovements failed midway), apply the move
        // directly to the non-serial aggregation so source/destination centers
        // reflect the move. We detect already-accounted-for transfers by
        // their transferNumber appearing in materialsOut.reason / notes.
        const accountedTransferNumbers = new Set<string>();
        materialsOutSnap.docs.forEach((d: any) => {
          const data: any = d.data();
          const reason = String(data.reason || '');
          const notes = String(data.notes || '');
          const blob = `${reason} ${notes}`;
          const match = blob.match(/Transfer\s*#\s*([A-Za-z0-9_-]+)/);
          if (match && match[1]) accountedTransferNumbers.add(match[1]);
        });
        stockTransfersSnap.docs.forEach((trDoc: any) => {
          const tr: any = trDoc.data();
          if (tr.transferNumber && accountedTransferNumbers.has(tr.transferNumber)) return;
          const fromBranch = String(tr.fromBranch || '').trim();
          const toBranch = String(tr.toBranch || '').trim();
          if (!fromBranch || !toBranch) return;
          (tr.products || []).forEach((p: any) => {
            const productId = p.productId || p.id || '';
            const serials: string[] = Array.isArray(p.serialNumbers)
              ? p.serialNumbers
              : (p.serialNumber ? [p.serialNumber] : []);
            // Serial-tracked moves are already handled via incomingMap above.
            if (!productId || serials.length > 0) return;
            const productRef = productById.get(productId) || {};
            if (productRef.hasSerialNumber) return;
            const qty = Math.max(0, Number(p.quantity) || 0);
            if (qty <= 0) return;
            const fromKey = `${productId}|${fromBranch}`;
            const toKey = `${productId}|${toBranch}`;
            const fromPrev = nonSerialInByProductAndLocation.get(fromKey);
            if (fromPrev) {
              nonSerialInByProductAndLocation.set(fromKey, {
                ...fromPrev,
                qty: Math.max(0, (fromPrev.qty || 0) - qty),
              });
            }
            const toPrev = nonSerialInByProductAndLocation.get(toKey) || {
              qty: 0,
              lastDate: tr.transferDate || null,
              lastSupplier: `Stock Transfer from ${fromBranch}`,
              lastInvoice: tr.transferNumber || '',
              lastLocation: toBranch,
              mrp: Number(productRef.mrp || 0),
              dealerPrice: Number(productRef.dealerPrice || 0),
              lastSourceType: undefined as 'materialIn' | 'purchase' | undefined,
              lastDocId: undefined as string | undefined,
            };
            nonSerialInByProductAndLocation.set(toKey, {
              ...toPrev,
              qty: (toPrev.qty || 0) + qty,
              lastDate: tr.transferDate || toPrev.lastDate,
              lastSupplier: `Stock Transfer from ${fromBranch}`,
              lastInvoice: tr.transferNumber || toPrev.lastInvoice,
              lastLocation: toBranch,
            });
          });
        });

        // Build non-serial items per product and location with remaining quantity
        const nonSerialItems: InventoryItem[] = [];
        nonSerialInByProductAndLocation.forEach((inInfo, key) => {
          const [productId, location] = key.split('|');
          const productRef = productById.get(productId) || {};
          const isSerialTracked = !!productRef.hasSerialNumber;
          if (isSerialTracked) return; // Skip serial-tracked items
          
          const inQty = inInfo.qty || 0;
          // Subtract location-specific materials out (stock transfers)
          const locationOutKey = `${productId}|${location}`;
          const locationOutQty = nonSerialOutByProductAndLocation.get(locationOutKey) || 0;
          // Also subtract global materials out (sales and non-stock-transfer materials out)
          const globalOutQty = nonSerialOutByProduct.get(productId) || 0;
          // For location-specific stock, only subtract location-specific out, not global
          // But we need to be careful: if there's a stock transfer out from this location,
          // we should subtract it. If there's a sale, it should also reduce stock at this location.
          // Actually, sales should reduce stock globally, so we should subtract both.
          const remainingQty = Math.max(0, inQty - locationOutQty - globalOutQty);
          
          if (remainingQty > 0) {
            nonSerialItems.push({
              id: `qty-${productId}-${location}`,
              productId,
              productName: productRef.name || '',
              serialNumber: '-',
              type: productRef.type || '',
              company: productRef.company || '',
              originalProductCompany: productRef.company || '',
              location: location,
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
        
        // Also handle legacy non-serial items that weren't tracked by location
        // (for backward compatibility with old data)
        nonSerialInByProduct.forEach((inInfo, productId) => {
          const productRef = productById.get(productId) || {};
          const isSerialTracked = !!productRef.hasSerialNumber;
          if (isSerialTracked) return;
          
          // Check if we already have this product+location combination
          const location = inInfo.lastLocation || headOfficeId;
          const key = `${productId}|${location}`;
          if (nonSerialInByProductAndLocation.has(key)) {
            return; // Already handled above
          }
          
          // This is legacy data without location tracking, use global calculation
          const inQty = inInfo.qty || 0;
          const outQty = nonSerialOutByProduct.get(productId) || 0;
          const remainingQty = Math.max(0, inQty - outQty);
          
          if (remainingQty > 0) {
            nonSerialItems.push({
              id: `qty-${productId}`,
              productId,
              productName: productRef.name || '',
              serialNumber: '-',
              type: productRef.type || '',
              company: productRef.company || '',
              originalProductCompany: productRef.company || '',
              location: location,
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

        const mergedItems = [...serialItems, ...nonSerialItems];
        const items = mergedItems.filter((i) =>
          inventoryItemMatchesDataScope(i.location, effectiveScopeCenterId, allowedCenterIds),
        );

        // Compute stats
        const inStock = items
          .filter(i => i.status === 'In Stock')
          .reduce((sum, i) => sum + (i.quantity || 1), 0);
        const sold = items.filter(i => i.status === 'Sold').length;
        const damaged = items.filter(i => i.status === 'Damaged').length; // no data source; stays 0
        const inventoryValueDealer = items
          .filter(i => i.status === 'In Stock')
          .reduce((sum, i) => sum + (i.dealerPrice || 0) * (i.quantity || 1), 0);
        const inventoryValueMRP = items
          .filter(i => i.status === 'In Stock')
          .reduce((sum, i) => sum + (i.mrp || 0) * (i.quantity || 1), 0);

        setInventory(items);
        setFilteredInventory(items);
        const serializedJourneyMap: Record<string, JourneyEvent[]> = {};
        const eventSourcePriority: Record<string, number> = {
          Sales: 5,
          'Material Out': 4,
          'Material In': 3,
          Purchase: 2,
          Enquiry: 1,
        };
        const normalizeJourneyText = (value?: string) => String(value || '').trim().toLowerCase();
        const journeyDedupeKey = (event: JourneyEvent) => {
          const dayBucket = Math.floor((event.sortOrder || 0) / (1000 * 60 * 60 * 24));
          return [
            event.eventType,
            dayBucket,
            normalizeJourneyText(event.location),
            normalizeJourneyText(event.counterparty),
            normalizeJourneyText(event.referenceNo),
          ].join('|');
        };
        const mergeJourneyEvents = (existing: JourneyEvent, incoming: JourneyEvent): JourneyEvent => {
          const existingPriority = eventSourcePriority[existing.sourceLabel || ''] || 0;
          const incomingPriority = eventSourcePriority[incoming.sourceLabel || ''] || 0;
          const base = incomingPriority > existingPriority ? incoming : existing;
          const alt = base === incoming ? existing : incoming;
          const mergedNotes = [base.notes, alt.notes]
            .filter(Boolean)
            .join(' • ')
            .split('•')
            .map((s) => s.trim())
            .filter(Boolean)
            .filter((part, idx, arr) => arr.indexOf(part) === idx)
            .join(' • ');
          return {
            ...base,
            notes: mergedNotes,
            description: base.description || alt.description,
            sourcePath: base.sourcePath || alt.sourcePath,
          };
        };
        journeyMap.forEach((events, serialKey) => {
          const dedupedMap = new Map<string, JourneyEvent>();
          [...events]
            .sort((a, b) => {
              if (a.sortOrder === b.sortOrder) return a.title.localeCompare(b.title);
              return a.sortOrder - b.sortOrder;
            })
            .forEach((event) => {
              const key = journeyDedupeKey(event);
              const existing = dedupedMap.get(key);
              if (!existing) {
                dedupedMap.set(key, event);
                return;
              }
              dedupedMap.set(key, mergeJourneyEvents(existing, event));
            });
          serializedJourneyMap[serialKey] = Array.from(dedupedMap.values()).sort((a, b) => {
            if (a.sortOrder === b.sortOrder) return a.title.localeCompare(b.title);
            return a.sortOrder - b.sortOrder;
          });
        });
        setJourneyBySerial(serializedJourneyMap);
        setStats({
          totalItems: items.length,
          inStock,
          sold,
          damaged,
          inventoryValueDealer,
          inventoryValueMRP,
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
  }, [user, isAllowedModule, refreshKey, effectiveScopeCenterId, allowedCenterIds]);
  
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

  // Get color for status chip
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock':
        return 'success';
      case 'Sold':
        return 'warning';
      case 'Reserved':
        return 'info';
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

  const getJourneyEventColor = (eventType: JourneyEvent['eventType']) => {
    switch (eventType) {
      case 'purchase':
        return 'info.main';
      case 'material-in':
        return 'success.main';
      case 'stock-transfer-in':
        return 'primary.main';
      case 'stock-transfer-out':
        return 'warning.main';
      case 'material-out':
        return 'warning.dark';
      case 'trial':
        return 'secondary.main';
      case 'booking':
        return 'primary.dark';
      case 'sale':
        return 'success.dark';
      case 'sale-return':
        return 'error.main';
      case 'visit-update':
      default:
        return 'text.secondary';
    }
  };

  const getJourneyEventIcon = (eventType: JourneyEvent['eventType']) => {
    switch (eventType) {
      case 'purchase':
        return <ShoppingCartIcon fontSize="small" />;
      case 'material-in':
        return <InventoryIcon fontSize="small" />;
      case 'stock-transfer-in':
      case 'stock-transfer-out':
        return <LocalShippingIcon fontSize="small" />;
      case 'material-out':
        return <TrendingDownIcon fontSize="small" />;
      case 'trial':
        return <InfoIcon fontSize="small" />;
      case 'booking':
        return <AssignmentIcon fontSize="small" />;
      case 'sale':
        return <CheckCircleIcon fontSize="small" />;
      case 'sale-return':
        return <WarningIcon fontSize="small" />;
      case 'visit-update':
      default:
        return <DateRangeIcon fontSize="small" />;
    }
  };

  const getJourneyEventTitle = (event: JourneyEvent) => {
    switch (event.eventType) {
      case 'material-in':
        return 'Received In Inventory';
      case 'stock-transfer-in':
        return 'Transferred In';
      case 'stock-transfer-out':
        return 'Transferred Out';
      case 'material-out':
        return 'Moved Out';
      case 'visit-update':
        return 'Visit Progress Update';
      default:
        return event.title;
    }
  };

  const getJourneyEventDescription = (event: JourneyEvent) => {
    const party = event.counterparty ? ` • ${event.counterparty}` : '';
    switch (event.eventType) {
      case 'purchase':
        return `Purchase recorded${party}`;
      case 'sale':
        return `Sale completed${party}`;
      case 'booking':
        return `Booking confirmed${party}`;
      case 'trial':
        return `Trial activity logged${party}`;
      case 'sale-return':
        return `Sales return recorded${party}`;
      default:
        return event.description;
    }
  };

  const selectedJourney = useMemo(() => {
    const normalizedSerial = normalizeSerialNumber(journeySearchSerial || '');
    const events = normalizedSerial ? (journeyBySerial[normalizedSerial] || []) : [];
    const inventoryItem = normalizedSerial
      ? inventory.find(item =>
          normalizeSerialNumber(item.serialNumber || '') === normalizedSerial ||
          (Array.isArray(item.serialNumbers) && item.serialNumbers.some(sn => normalizeSerialNumber(sn || '') === normalizedSerial))
        ) || null
      : null;
    const latestEvent = events.length ? [...events].sort((a, b) => b.sortOrder - a.sortOrder)[0] : null;

    return {
      normalizedSerial,
      events,
      inventoryItem,
      latestEvent,
      productName: (inventoryItem ? getCanonicalSearchProductName(inventoryItem) : '') || latestEvent?.productName || 'Unknown Product',
      displaySerial: events[0]?.serialNumber || journeySearchSerial.trim(),
    };
  }, [journeySearchSerial, journeyBySerial, inventory, productNameById, canonicalProductNameByLower]);

  const handleOpenJourney = () => {
    const serial = journeySerialInput.trim();
    if (!serial) {
      setErrorMessage('Enter a serial number to view the product journey');
      return;
    }

    const normalizedSerial = normalizeSerialNumber(serial);
    if (!journeyBySerial[normalizedSerial]?.length) {
      setErrorMessage(`No journey found for serial number ${serial}`);
      return;
    }

    setJourneySearchSerial(serial);
    setJourneyDialogOpen(true);
  };

  const handleExportData = () => {
    try {
      if (!filteredInventory || filteredInventory.length === 0) {
        setErrorMessage('No inventory items to export (try clearing filters).');
        return;
      }

      const escapeCsv = (value: any) => {
        const s = value === null || value === undefined ? '' : String(value);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const headersBase = [
        'Product Name',
        'Serial Number',
        'Type',
        'Company',
        'Manufacturer',
        'Location',
        'Location ID',
        'Status',
        'Quantity',
      ];

      const headersFinance = [
        'Dealer Price',
        'MRP',
        'Purchase Date',
        'Purchase Invoice',
        'Supplier',
        'Source Type',
      ];

      const headers = isRestrictedUser ? headersBase : [...headersBase, ...headersFinance];

      const rows = filteredInventory.map((item) => {
        const base = [
          getCanonicalSearchProductName(item) || '',
          item.serialNumber || '',
          item.type || '',
          item.company || '',
          item.originalProductCompany || '',
          getCenterName(item.location),
          item.location || '',
          item.status || '',
          item.quantity ?? '',
        ];

        if (isRestrictedUser) return base;

        const finance = [
          item.dealerPrice ?? '',
          item.mrp ?? '',
          formatDate(item.purchaseDate),
          item.purchaseInvoice || '',
          item.supplier || '',
          item.sourceType || '',
        ];

        return [...base, ...finance];
      });

      // Add UTF-8 BOM so Excel opens it correctly
      const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

      const today = new Date().toISOString().slice(0, 10);
      const fileName = `inventory-export-${today}.csv`;

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccessMessage(`Exported ${filteredInventory.length} inventory items.`);
    } catch (err) {
      console.error('Export failed:', err);
      setErrorMessage('Export failed. Please try again.');
    }
  };

  // Filter inventory based on selected filters
  useEffect(() => {
    let filtered = inventory;

    // Filter sold items unless toggle is enabled
    if (!showSoldItems && statusFilter !== 'Sold') {
      filtered = filtered.filter(item => item.status !== 'Sold');
    }

    // Filter by location/center
    if (locationFilter) {
      filtered = filtered.filter(item => item.location === locationFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.trim().toLowerCase();
      const normalizedSearch = normalizeProductNameForMatch(searchLower);
      filtered = filtered.filter(item => 
        getCanonicalSearchProductName(item).toLowerCase().includes(searchLower) ||
        normalizeProductNameForMatch(getCanonicalSearchProductName(item)).includes(normalizedSearch) ||
        Array.from(searchNameAliasesByProductId.get(String(item.productId || '').trim()) || []).some((name) => name.includes(searchLower)) ||
        item.serialNumber?.toLowerCase().includes(searchLower) ||
        (Array.isArray(item.serialNumbers) && item.serialNumbers.some((sn) => String(sn || '').toLowerCase().includes(searchLower))) ||
        item.company?.toLowerCase().includes(searchLower) ||
        item.type?.toLowerCase().includes(searchLower) ||
        item.supplier?.toLowerCase().includes(searchLower)
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

    // Filter by company (check both manufacturer and business company)
    if (companyFilter) {
      filtered = filtered.filter(item => {
        const manufacturerMatch = item.originalProductCompany?.toLowerCase().includes(companyFilter.toLowerCase());
        const businessCompanyMatch = item.company?.toLowerCase().includes(companyFilter.toLowerCase());
        return manufacturerMatch || businessCompanyMatch;
      });
    }

    setFilteredInventory(filtered);

    // Recalculate stats for filtered data
    const inStock = filtered.filter(i => i.status === 'In Stock').length;
    const sold = filtered.filter(i => i.status === 'Sold').length;
    const damaged = filtered.filter(i => i.status === 'Damaged').length;
    const inventoryValueDealer = filtered
      .filter(i => i.status === 'In Stock')
      .reduce((sum, i) => sum + (i.dealerPrice || 0) * (i.quantity || 1), 0);
    const inventoryValueMRP = filtered
      .filter(i => i.status === 'In Stock')
      .reduce((sum, i) => sum + (i.mrp || 0) * (i.quantity || 1), 0);

    setStats({
      totalItems: filtered.length,
      inStock,
      sold,
      damaged,
      inventoryValueDealer,
      inventoryValueMRP,
    });
    setPage(0);
  }, [inventory, locationFilter, searchTerm, statusFilter, typeFilter, companyFilter, showSoldItems, productNameById, searchNameAliasesByProductId, canonicalProductNameByLower, canonicalProductNameByNormalized]);

  // Get list of unique types, locations, and companies for filters
  const productTypes = Array.from(new Set(inventory.map(item => item.type)));
  const locations = Array.from(new Set(inventory.map(item => item.location)));
  const companies = Array.from(new Set(inventory.map(item => item.company).filter(Boolean)));
  const originalProductCompanies = Array.from(new Set(inventory.map(item => item.originalProductCompany).filter(Boolean)));

  // Grouped view: Category -> Products -> Serials (In Stock only)
  const grouped = React.useMemo(() => {
    const inStockItems = filteredInventory.filter(i => i.status === 'In Stock');
    const byCategory: Record<string, { dealerValue: number; mrpValue: number; count: number; products: Record<string, { company: string; items: InventoryItem[] }> }> = {};
    for (const item of inStockItems) {
      const cat = item.type || 'Other';
      if (!byCategory[cat]) {
        byCategory[cat] = { dealerValue: 0, mrpValue: 0, count: 0, products: {} };
      }
      byCategory[cat].dealerValue += (item.dealerPrice || 0) * (item.quantity || 1);
      byCategory[cat].mrpValue += (item.mrp || 0) * (item.quantity || 1);
      byCategory[cat].count += 1;
      const key = getCanonicalSearchProductName(item) || 'Unnamed';
      if (!byCategory[cat].products[key]) {
        byCategory[cat].products[key] = { company: item.company || '', items: [] };
      }
      byCategory[cat].products[key].items.push(item);
    }
    // Convert to array with sorted categories
    const categories = Object.keys(byCategory).sort().map(cat => ({
      category: cat,
      totalDealerValue: byCategory[cat].dealerValue,
      totalMRPValue: byCategory[cat].mrpValue,
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
  }, [filteredInventory, productNameById, canonicalProductNameByLower]);

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
    if (savingItem) return;
    try {
      setSavingItem(true);
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
      const inventoryValueDealer = updatedInventory
        .filter(i => i.status === 'In Stock')
        .reduce((sum, i) => sum + (i.dealerPrice || 0) * (i.quantity || 1), 0);
      const inventoryValueMRP = updatedInventory
        .filter(i => i.status === 'In Stock')
        .reduce((sum, i) => sum + (i.mrp || 0) * (i.quantity || 1), 0);
      
      setStats({
        totalItems: updatedInventory.length,
        inStock,
        sold,
        damaged,
        inventoryValueDealer,
        inventoryValueMRP,
      });
      
      setOpenDialog(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving inventory item:', error);
      setErrorMessage('Failed to save inventory item');
    } finally {
      setSavingItem(false);
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
      const inventoryValueDealer = updatedInventory
        .filter(i => i.status === 'In Stock')
        .reduce((sum, i) => sum + (i.dealerPrice || 0) * (i.quantity || 1), 0);
      const inventoryValueMRP = updatedInventory
        .filter(i => i.status === 'In Stock')
        .reduce((sum, i) => sum + (i.mrp || 0) * (i.quantity || 1), 0);
      
      setStats({
        totalItems: updatedInventory.length,
        inStock,
        sold,
        damaged,
        inventoryValueDealer,
        inventoryValueMRP,
      });
      
      setSuccessMessage('Inventory item deleted successfully');
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      setErrorMessage('Failed to delete inventory item');
    }
  };

  const handleOpenPairRepair = (item: InventoryItem) => {
    const groupKey = item.pairGroupKey;
    if (!groupKey) return;
    const serials = Array.from(
      new Set(
        inventory
          .filter((row) => row.pairGroupKey === groupKey)
          .flatMap((row) => row.serialNumbers || [])
          .map((sn) => normalizeSerialNumber(String(sn || '')))
          .filter(Boolean),
      ),
    );
    setPairRepairItem(item);
    setPairRepairSerialList(serials);
    setPairRepairInput(
      serials.length >= 2
        ? `${serials[0]}, ${serials[1]}`
        : serials.join(', '),
    );
    setPairRepairOpen(true);
  };

  const handleSavePairRepair = async () => {
    if (!pairRepairItem?.pairGroupKey) return;
    const tokens = pairRepairInput
      .split(/[,\n;|]+/g)
      .map((s) => normalizeSerialNumber(s))
      .filter(Boolean);
    if (tokens.length < 2 || tokens.length % 2 !== 0) {
      setErrorMessage('Enter an even number of serials (2, 4, 6...) to define complete pairs.');
      return;
    }
    const allowed = new Set(pairRepairSerialList);
    const invalid = tokens.filter((sn) => !allowed.has(sn));
    if (invalid.length > 0) {
      setErrorMessage(`Unknown serial(s) for this group: ${invalid.join(', ')}`);
      return;
    }
    const dedupe = new Set(tokens);
    if (dedupe.size !== tokens.length) {
      setErrorMessage('A serial can only appear once in pair mapping.');
      return;
    }
    const pairs: [string, string][] = [];
    for (let i = 0; i < tokens.length; i += 2) {
      pairs.push([tokens[i], tokens[i + 1]]);
    }

    try {
      setSavingPairRepair(true);
      const ref = doc(db, 'inventoryPairOverrides', pairRepairItem.pairGroupKey);
      await setDoc(
        ref,
        {
          groupKey: pairRepairItem.pairGroupKey,
          productId: pairRepairItem.productId,
          location: pairRepairItem.location,
          company: pairRepairItem.company,
          pairs,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || null,
        },
        { merge: true },
      );
      setSuccessMessage('Pair mapping updated. Refreshing inventory.');
      setPairRepairOpen(false);
      setPairRepairItem(null);
      setRefreshKey((k) => k + 1);
    } catch (error) {
      console.error('Failed to save pair mapping override', error);
      setErrorMessage('Failed to save pair mapping override.');
    } finally {
      setSavingPairRepair(false);
    }
  };

  const pairableProducts = useMemo(() => {
    return products
      .filter((p: any) => (p.quantityType || p.quantityTypeLegacy) === 'pair')
      .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [products]);

  useEffect(() => {
    if (selectedPairProductId === '__all__') return;
    const stillExists = pairableProducts.some((p: any) => String(p.id || '') === selectedPairProductId);
    if (!stillExists) {
      setSelectedPairProductId('__all__');
    }
  }, [pairableProducts, selectedPairProductId]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm, statusFilter, typeFilter, locationFilter, companyFilter, selectedExplorerBrand, multiStatusFilter, multiBrandFilter, multiCenterFilter]);

  const pairingBuckets = useMemo(() => {
    if (!selectedPairProductId) return [];
    const rows = inventory.filter((item) => {
      if (selectedPairProductId !== '__all__' && item.productId !== selectedPairProductId) return false;
      if (item.status === 'Sold' || item.status === 'Damaged') return false;
      return (item.serialNumbers?.length || 0) > 0 || !!item.serialNumber;
    });

    const bucketMap = new Map<string, {
      key: string;
      productId: string;
      productName: string;
      location: string;
      company: string;
      status: string;
      groupKeys: string[];
      serials: string[];
      existingPairs: [string, string][];
    }>();

    rows.forEach((row) => {
      const serials = (row.serialNumbers && row.serialNumbers.length > 0
        ? row.serialNumbers
        : [row.serialNumber]
      )
        .map((sn) => normalizeSerialNumber(String(sn || '')))
        .filter(Boolean);
      if (serials.length === 0) return;

      const rowGroupKey = row.pairGroupKey || [row.productId, row.location, row.company, row.status, row.purchaseInvoice, row.supplier].join('|');
      const key = String(row.productId || '').trim() || getCanonicalSearchProductName(row);
      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          key,
          productId: row.productId,
          productName: getCanonicalSearchProductName(row),
          location: 'multiple',
          company: 'multiple',
          status: 'In Stock',
          groupKeys: [],
          serials: [],
          existingPairs: [],
        });
      }
      const bucket = bucketMap.get(key)!;
      if (!bucket.groupKeys.includes(rowGroupKey)) {
        bucket.groupKeys.push(rowGroupKey);
      }
      bucket.serials.push(...serials);
      if (serials.length === 2 && row.pairSource !== 'unpaired') {
        bucket.existingPairs.push([serials[0], serials[1]]);
      }
    });

    return Array.from(bucketMap.values())
      .map((bucket) => ({
        ...bucket,
        serials: Array.from(new Set(bucket.serials)),
        existingPairs: bucket.existingPairs.filter(([a, b]) => !!a && !!b),
      }))
      .sort((a, b) => {
        const byProduct = String(a.productName || '').localeCompare(String(b.productName || ''));
        if (byProduct !== 0) return byProduct;
        return String(a.productId || '').localeCompare(String(b.productId || ''));
      });
  }, [inventory, selectedPairProductId, productNameById, canonicalProductNameByLower]);

  const getBucketPairs = (bucketKey: string, existingPairs: [string, string][]): [string, string][] => {
    return pairingDraftByBucket[bucketKey] || existingPairs;
  };

  const toggleBucketSerialSelection = (bucketKey: string, serial: string) => {
    setPairingSelectionByBucket((prev) => {
      const current = prev[bucketKey] || [];
      if (current.includes(serial)) {
        return { ...prev, [bucketKey]: current.filter((x) => x !== serial) };
      }
      if (current.length >= 2) return prev;
      return { ...prev, [bucketKey]: [...current, serial] };
    });
  };

  const handleCreatePairInBucket = (bucketKey: string, existingPairs: [string, string][]) => {
    const selected = pairingSelectionByBucket[bucketKey] || [];
    if (selected.length !== 2) {
      setErrorMessage('Select exactly 2 serials to create a pair.');
      return;
    }
    const [a, b] = selected;
    const currentPairs = getBucketPairs(bucketKey, existingPairs);
    const paired = new Set(currentPairs.flatMap((pair) => pair));
    if (paired.has(a) || paired.has(b)) {
      setErrorMessage('Selected serial is already part of a pair.');
      return;
    }
    setPairingDraftByBucket((prev) => ({
      ...prev,
      [bucketKey]: [...currentPairs, [a, b]],
    }));
    setPairingSelectionByBucket((prev) => ({ ...prev, [bucketKey]: [] }));
  };

  const handleRemovePairInBucket = (bucketKey: string, pair: [string, string], existingPairs: [string, string][]) => {
    const currentPairs = getBucketPairs(bucketKey, existingPairs);
    setPairingDraftByBucket((prev) => ({
      ...prev,
      [bucketKey]: currentPairs.filter(([a, b]) => !(a === pair[0] && b === pair[1])),
    }));
  };

  const handleClearPairsInBucket = (bucketKey: string) => {
    if (!window.confirm('Clear all pairs in this bucket? Serial numbers will remain unchanged.')) return;
    setPairingDraftByBucket((prev) => ({ ...prev, [bucketKey]: [] }));
  };

  const handleSaveBucketPairs = async (bucket: {
    key: string;
    productId: string;
    location: string;
    company: string;
    status: string;
    groupKeys: string[];
    existingPairs: [string, string][];
  }) => {
    const pairs = getBucketPairs(bucket.key, bucket.existingPairs);
    const flat = pairs.flatMap((pair) => pair);
    if (new Set(flat).size !== flat.length) {
      setErrorMessage('A serial cannot belong to multiple pairs.');
      return;
    }
    try {
      setSavingBucketKey(bucket.key);
      const keysToSave = bucket.groupKeys.length > 0 ? bucket.groupKeys : [bucket.key];
      await Promise.all(
        keysToSave.map((groupKey) =>
          setDoc(
            doc(db, 'inventoryPairOverrides', groupKey),
            {
              groupKey,
              productId: bucket.productId,
              location: bucket.location,
              company: bucket.company,
              status: bucket.status,
              pairs,
              updatedAt: serverTimestamp(),
              updatedBy: user?.uid || null,
            },
            { merge: true },
          ),
        ),
      );
      setSuccessMessage('Pair mapping saved successfully.');
      setRefreshKey((x) => x + 1);
    } catch (error) {
      console.error('Failed saving bucket pair mappings', error);
      setErrorMessage('Failed to save pair mapping.');
    } finally {
      setSavingBucketKey(null);
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
  
  const commandFilteredInventory = filteredInventory.filter((item) => {
    if (selectedExplorerBrand && item.originalProductCompany !== selectedExplorerBrand) return false;
    if (multiStatusFilter.length > 0 && !multiStatusFilter.includes(item.status)) return false;
    if (multiBrandFilter.length > 0 && !multiBrandFilter.includes(item.originalProductCompany || 'Unknown')) return false;
    if (multiCenterFilter.length > 0 && !multiCenterFilter.includes(item.location || '')) return false;
    return true;
  });

  // Paginated data
  const paginatedData = commandFilteredInventory.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  const compactSectionSx = { p: { xs: 1.5, md: 2 }, mb: 2, borderRadius: 1.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } as const;
  const modernPanelSx = {
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    backdropFilter: 'blur(8px)',
    bgcolor: 'background.paper',
    boxShadow: 0,
  } as const;
  const compactCardSx = {
    borderRadius: 1.5,
    border: '1px solid',
    borderColor: alpha('#64748b', 0.2),
    bgcolor: 'background.paper',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
    cursor: 'pointer',
    '&:hover': { borderColor: alpha('#6366f1', 0.28), boxShadow: `0 6px 14px ${alpha('#0f172a', 0.12)}`, transform: 'translateY(-1px)' },
  } as const;
  const categoryRows = grouped.flatMap((group) =>
    group.products.map((p) => ({
      category: group.category,
      productName: p.productName,
      count: p.count,
      items: p.items,
    })),
  );
  const movementLogRows = commandFilteredInventory
    .slice()
    .sort((a, b) => getTimestampValue(b.updatedAt || b.createdAt || b.purchaseDate) - getTimestampValue(a.updatedAt || a.createdAt || a.purchaseDate))
    .slice(0, 40);
  const inStockByCenter = locations
    .map((location) => ({
      location,
      name: getCenterName(location),
      count: commandFilteredInventory.filter((item) => item.location === location && item.status === 'In Stock').length,
    }))
    .sort((a, b) => b.count - a.count);
  const maxCenterStock = Math.max(1, ...inStockByCenter.map((row) => row.count));
  const analyticsTotal = commandFilteredInventory.length;
  const analyticsInStock = commandFilteredInventory.filter((item) => item.status === 'In Stock').length;
  const analyticsSold = commandFilteredInventory.filter((item) => item.status === 'Sold').length;
  const analyticsDamaged = commandFilteredInventory.filter((item) => item.status === 'Damaged').length;
  const topCategories = grouped
    .map((group) => ({
      category: group.category,
      count: group.totalCount,
      dealer: group.totalDealerValue,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const toggleMultiFilter = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => (prev.includes(value) ? prev.filter((entry) => entry !== value) : [...prev, value]));
  };

  return (
    <Box sx={{ 
      p: { xs: 1.5, md: 2 }, 
      bgcolor: 'background.default', 
      minHeight: 'calc(100vh - 64px)',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      {/* Clean Header */}
      <Paper elevation={0} sx={{ ...compactSectionSx, py: { xs: 1.5, md: 1.75 } }}>
        <Box display="flex" alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={1.5} flexDirection={{ xs: 'column', md: 'row' }}>
          <Box>
            <Box display="flex" alignItems="center" mb={0.5}>
              <DashboardIcon color="primary" sx={{ fontSize: 22, mr: 1 }} />
              <Typography variant="h5" fontWeight={700} color="text.primary">
                Inventory Management
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Real-time stock tracking across all locations and companies
            </Typography>
            <Box display="flex" alignItems="center" sx={{ color: 'text.secondary' }}>
              <AnalyticsIcon sx={{ mr: 0.75, fontSize: 14 }} />
              <Typography variant="caption">
                Last updated: {new Date().toLocaleString()}
              </Typography>
            </Box>
          </Box>
          <Box textAlign="right" display="flex" gap={1} alignItems="center" flexWrap="wrap">
            {!isRestrictedUser && (
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
                    <Typography variant="caption" color="text.secondary">
                      Show Sold Items
                    </Typography>
                  </Box>
                }
                sx={{ mr: 0.5 }}
              />
            )}
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleRefreshData}
              sx={{ borderRadius: 1.5 }}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ mb: 2, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
        <Tabs value={workspaceTab} onChange={(_, value) => setWorkspaceTab(value)} sx={{ px: 2, pt: 1 }}>
          <Tab value="inventory" label="Inventory View" />
          <Tab value="pairing" label="Pairing Workspace" />
        </Tabs>
      </Paper>

      {workspaceTab === 'pairing' && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" gap={2} alignItems={{ xs: 'stretch', md: 'center' }} flexDirection={{ xs: 'column', md: 'row' }} mb={2.5}>
            <FormControl sx={{ minWidth: 320 }}>
              <InputLabel id="pairing-product-label">Select Product</InputLabel>
              <Select
                labelId="pairing-product-label"
                value={selectedPairProductId}
                label="Select Product"
                onChange={(e) => {
                  setSelectedPairProductId(String(e.target.value || ''));
                  setPairingDraftByBucket({});
                  setPairingSelectionByBucket({});
                }}
              >
                <MenuItem value="__all__">All Pair Products</MenuItem>
                {pairableProducts.map((p: any) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary">
              Serial numbers are read-only. Select two unpaired serials to form a pair inside the same bucket.
            </Typography>
          </Box>

          {pairingBuckets.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No available serial inventory buckets found for the selected product.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {pairingBuckets.map((bucket) => {
                const activePairs = getBucketPairs(bucket.key, bucket.existingPairs);
                const pairedSet = new Set(activePairs.flatMap((pair) => pair));
                const unpairedSerials = bucket.serials.filter((sn) => !pairedSet.has(sn));
                const selected = pairingSelectionByBucket[bucket.key] || [];
                return (
                  <Card key={bucket.key} variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                        <Typography variant="subtitle1" fontWeight={700}>{bucket.productName}</Typography>
                        <Chip label={`${bucket.serials.length} serials`} size="small" />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Bucket: Combined view for all locations/entries of this product
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap" mb={1.5}>
                        {bucket.serials.map((sn) => {
                          const isPaired = pairedSet.has(sn);
                          const isSelected = selected.includes(sn);
                          return (
                            <Chip
                              key={sn}
                              label={sn}
                              color={isPaired ? 'success' : isSelected ? 'primary' : 'default'}
                              variant={isPaired ? 'filled' : 'outlined'}
                              onClick={isPaired ? undefined : () => toggleBucketSerialSelection(bucket.key, sn)}
                            />
                          );
                        })}
                      </Box>
                      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" mb={1.5}>
                        <Button variant="contained" size="small" disabled={selected.length !== 2} onClick={() => handleCreatePairInBucket(bucket.key, bucket.existingPairs)}>
                          Create Pair
                        </Button>
                        <Button variant="outlined" size="small" color="warning" onClick={() => handleClearPairsInBucket(bucket.key)} disabled={activePairs.length === 0}>
                          Clear All Pairs
                        </Button>
                        <Button variant="outlined" size="small" onClick={() => handleSaveBucketPairs(bucket)} disabled={savingBucketKey === bucket.key}>
                          {savingBucketKey === bucket.key ? 'Saving...' : 'Save Pairs'}
                        </Button>
                        <Chip label={`Paired: ${activePairs.length}`} size="small" color="success" variant="outlined" />
                        <Chip label={`Unpaired: ${unpairedSerials.length}`} size="small" color="warning" variant="outlined" />
                      </Box>
                      {activePairs.length > 0 && (
                        <Box display="flex" gap={1} flexWrap="wrap">
                          {activePairs.map((pair) => (
                            <Chip
                              key={`${pair[0]}-${pair[1]}`}
                              label={`${pair[0]} · ${pair[1]}`}
                              color="success"
                              onDelete={() => handleRemovePairInBucket(bucket.key, pair, bucket.existingPairs)}
                            />
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Paper>
      )}

      <Box sx={{ display: workspaceTab === 'inventory' ? 'block' : 'none' }}>
      <Paper
        elevation={0}
        sx={(t) => ({
          ...modernPanelSx,
          mb: 1.5,
          p: 1,
          position: 'sticky',
          top: 8,
          zIndex: 25,
          borderColor: alpha(t.palette.primary.main, 0.24),
          bgcolor: t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.72) : alpha(t.palette.common.white, 0.72),
          boxShadow: t.palette.mode === 'dark' ? `0 12px 28px ${alpha(t.palette.common.black, 0.35)}` : `0 10px 26px ${alpha(t.palette.common.black, 0.1)}`,
        })}
      >
        <Box display="flex" gap={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
          <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              placeholder="Omni-search by serial, product, source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ minWidth: { xs: '100%', md: 360 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Button size="small" variant="outlined" startIcon={<FilterListIcon />} onClick={() => setFilterDrawerOpen(true)}>
              Filters
            </Button>
          </Box>
          <Box display="flex" gap={0.75} alignItems="center" flexWrap="wrap">
            <Chip size="small" label={`In ${commandFilteredInventory.filter((i) => i.status === 'In Stock').length}`} />
            <Chip size="small" color="warning" variant="outlined" label={`Sold ${commandFilteredInventory.filter((i) => i.status === 'Sold').length}`} />
            <Chip size="small" color="error" variant="outlined" label={`Damaged ${commandFilteredInventory.filter((i) => i.status === 'Damaged').length}`} />
            <Button size="small" variant="text" startIcon={<RefreshIcon />} onClick={handleRefreshData}>Refresh</Button>
            <Button size="small" variant="text" startIcon={<VisibilityIcon />} onClick={handleExportData}>Export</Button>
          </Box>
        </Box>
        <Box mt={1} display="flex" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
          <Tabs
            value={commandViewTab}
            onChange={(_, v) => setCommandViewTab(v)}
            sx={{
              minHeight: 34,
              '& .MuiTab-root': { minHeight: 34, py: 0, textTransform: 'none', fontWeight: 600, letterSpacing: 0.2 },
              '& .MuiTabs-indicator': { height: 2.5, borderRadius: 3 },
            }}
          >
            <Tab value="live" label="Live Inventory" />
            <Tab value="analytics" label="Stock Analytics" />
          </Tabs>
          <Box display="flex" gap={0.5} flexWrap="wrap">
            {originalProductCompanies.map((brandRaw) => {
              const brand = String(brandRaw || '').trim();
              if (!brand) return null;
              return (
              <Chip
                key={brand}
                size="small"
                label={brand}
                color={selectedExplorerBrand === brand ? 'primary' : 'default'}
                variant={selectedExplorerBrand === brand ? 'filled' : 'outlined'}
                sx={{ borderRadius: 1, fontWeight: 600, '& .MuiChip-label': { px: 1.2 } }}
                onClick={() => {
                  const next = selectedExplorerBrand === brand ? '' : brand;
                  setSelectedExplorerBrand(next);
                  setCompanyFilter(next);
                }}
              />
              );
            })}
          </Box>
        </Box>
      </Paper>
      <Paper elevation={0} sx={{ ...compactSectionSx, ...modernPanelSx, maxHeight: { md: 430 }, overflowY: 'auto', display: commandViewTab === 'live' ? 'block' : 'none' }}>
        <Box display="flex" alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} flexDirection={{ xs: 'column', md: 'row' }}>
          <Box>
            <Box display="flex" alignItems="center" mb={1}>
              <AssignmentIcon color="primary" sx={{ mr: 1.5 }} />
              <Typography variant="h6" fontWeight={700}>Product Journey</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Enter a serial number to see the full timeline across purchase, material in, stock transfers, trials, material out, sales, and enquiry updates.
            </Typography>
          </Box>
          <Box display="flex" gap={1.5} width={{ xs: '100%', md: 520 }}>
            <TextField
              fullWidth
              size="small"
              label="Serial Number"
              placeholder="Enter product serial number"
              value={journeySerialInput}
              onChange={(e) => setJourneySerialInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleOpenJourney();
                }
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
            <Button
              variant="contained"
              onClick={handleOpenJourney}
              disabled={loading}
              sx={{ borderRadius: 2, minWidth: 140 }}
            >
              View Journey
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...compactSectionSx, display: 'none' }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Product Movement Trail</Typography>
        <TableContainer>
          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.85 } }}>
            <TableHead>
              <TableRow>
                <TableCell>Serial</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Journey Trail</TableCell>
                <TableCell align="right">Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movementLogRows.slice(0, 18).map((item) => (
                <TableRow key={`movement-${item.id}`} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{item.serialNumber || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="caption">{getCanonicalSearchProductName(item)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                      <Chip size="small" label="Received" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">→</Typography>
                      <Chip size="small" label={`Stocked (${getCenterName(item.location)})`} color="primary" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">→</Typography>
                      <Chip size="small" label={item.status === 'Sold' ? 'Sold/Delivered' : 'Active'} color={item.status === 'Sold' ? 'warning' : 'success'} />
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="caption" color="text.secondary">{formatDateTime(item.updatedAt || item.createdAt || item.purchaseDate)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
              {movementLogRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: 'text.secondary', py: 2 }}>No movement rows available</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper
        elevation={0}
        sx={(t) => ({
          ...compactSectionSx,
          ...modernPanelSx,
          display: commandViewTab === 'analytics' ? 'block' : 'none',
          borderColor: alpha(t.palette.primary.main, 0.2),
          bgcolor: t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.82) : alpha(t.palette.common.white, 0.88),
          backdropFilter: 'blur(6px)',
        })}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.25}>
          <Typography variant="subtitle1" fontWeight={700}>Center Heatmap</Typography>
          <Typography variant="caption" color="text.secondary">Live utilization map</Typography>
        </Box>
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={1}>
          {inStockByCenter.map((center) => (
            <Box
              key={center.location}
              sx={(t) => ({
                border: '1px solid',
                borderColor: alpha(t.palette.primary.main, 0.2),
                borderRadius: 1.25,
                p: 1,
                background:
                  t.palette.mode === 'dark'
                    ? `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.14)}, ${alpha(t.palette.background.paper, 0.95)})`
                    : `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.1)}, ${alpha(t.palette.common.white, 0.95)})`,
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: `0 8px 18px ${alpha(t.palette.primary.main, 0.2)}`,
                },
              })}
            >
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
                <Typography variant="caption" color="text.secondary">{center.name}</Typography>
                <Chip size="small" label={`${center.count}`} color="primary" variant="outlined" />
              </Box>
              <LinearProgress
                variant="determinate"
                value={(center.count / maxCenterStock) * 100}
                sx={{
                  height: 8,
                  borderRadius: 8,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': { borderRadius: 8 },
                }}
              />
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Compact Stats Ribbon */}
      <Paper
        elevation={0}
        sx={(t) => ({
          ...compactSectionSx,
          ...modernPanelSx,
          p: 1.25,
          display: commandViewTab === 'analytics' ? 'block' : 'none',
          borderColor: alpha(t.palette.primary.main, 0.2),
          background:
            t.palette.mode === 'dark'
              ? `linear-gradient(180deg, ${alpha(t.palette.common.white, 0.02)}, ${alpha(t.palette.primary.main, 0.06)})`
              : `linear-gradient(180deg, ${alpha(t.palette.primary.main, 0.04)}, ${alpha(t.palette.common.white, 0.92)})`,
        })}
      >
        <Box
          display="grid"
          gridTemplateColumns={{ xs: 'repeat(2, minmax(0, 1fr))', md: isRestrictedUser ? 'repeat(3, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))' }}
          gap={1}
        >
          <Box sx={(t) => ({ p: 1, borderRadius: 1.25, border: '1px solid', borderColor: alpha(t.palette.primary.main, 0.2), bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.08) })}>
            <Typography variant="caption" color="text.secondary">Total Records</Typography>
            <Typography variant="h6" fontWeight={700}>{analyticsTotal}</Typography>
          </Box>
          <Box sx={(t) => ({ p: 1, borderRadius: 1.25, border: '1px solid', borderColor: alpha(t.palette.success.main, 0.35), bgcolor: alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.18 : 0.08) })}>
            <Typography variant="caption" color="text.secondary">In Stock</Typography>
            <Typography variant="h6" fontWeight={700} color="success.main">{analyticsInStock}</Typography>
          </Box>
          <Box sx={(t) => ({ p: 1, borderRadius: 1.25, border: '1px solid', borderColor: alpha(t.palette.warning.main, 0.35), bgcolor: alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.18 : 0.08) })}>
            <Typography variant="caption" color="text.secondary">Sold</Typography>
            <Typography variant="h6" fontWeight={700} color="warning.main">{analyticsSold}</Typography>
          </Box>
          <Box sx={(t) => ({ p: 1, borderRadius: 1.25, border: '1px solid', borderColor: alpha(t.palette.error.main, 0.35), bgcolor: alpha(t.palette.error.main, t.palette.mode === 'dark' ? 0.18 : 0.08) })}>
            <Typography variant="caption" color="text.secondary">Damaged</Typography>
            <Typography variant="h6" fontWeight={700} color="error.main">{analyticsDamaged}</Typography>
          </Box>
          {!isRestrictedUser && (
            <Box sx={(t) => ({ p: 1, borderRadius: 1.25, border: '1px solid', borderColor: alpha(t.palette.primary.main, 0.32), bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.18 : 0.08) })}>
              <Typography variant="caption" color="text.secondary">Dealer Value</Typography>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" noWrap>{formatCurrency(stats.inventoryValueDealer)}</Typography>
            </Box>
          )}
          {!isRestrictedUser && (
            <Box sx={(t) => ({ p: 1, borderRadius: 1.25, border: '1px solid', borderColor: alpha(t.palette.success.main, 0.32), bgcolor: alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.18 : 0.08) })}>
              <Typography variant="caption" color="text.secondary">MRP Value</Typography>
              <Typography variant="subtitle1" fontWeight={700} color="success.main" noWrap>{formatCurrency(stats.inventoryValueMRP)}</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Company-wise Stock Position */}
      <Paper elevation={0} sx={{ ...compactSectionSx, ...modernPanelSx, maxHeight: { md: 400 }, overflowY: 'auto', display: commandViewTab === 'analytics' ? 'block' : 'none' }}>
        <Box display="flex" alignItems="center" mb={1.5}>
          <BusinessIcon color="primary" sx={{ mr: 2 }} />
          <Typography component="h2" variant="h6" sx={(t) => ({ fontWeight: 700, color: t.palette.text.primary })}>
            Stock Position by Manufacturer
          </Typography>
        </Box>
        
        <Grid container spacing={1.25}>
          {originalProductCompanies.map(company => {
            // Use filteredInventory if any filters are applied, otherwise use all inventory
            const baseItems = (locationFilter || statusFilter || typeFilter || searchTerm || companyFilter) ? filteredInventory : inventory;
            const companyItems = baseItems.filter(item => item.originalProductCompany === company);
            const companyStats = {
              total: companyItems.length,
              inStock: companyItems.filter(i => i.status === 'In Stock').length,
              sold: companyItems.filter(i => i.status === 'Sold').length,
              dealerValue: companyItems.filter(i => i.status === 'In Stock').reduce((sum, i) => sum + (i.dealerPrice || 0) * (i.quantity || 1), 0),
              mrpValue: companyItems.filter(i => i.status === 'In Stock').reduce((sum, i) => sum + (i.mrp || 0) * (i.quantity || 1), 0)
            };
            
            return (
              <Grid item xs={12} md={6} lg={4} key={company}>
                <Card elevation={0} sx={{ 
                  ...compactCardSx,
                  border: companyFilter === company ? '2px solid' : '1px solid',
                  borderColor: companyFilter === company ? 'primary.main' : 'divider',
                }}
                onClick={() => setCompanyFilter(companyFilter === company ? '' : company || '')}
                >
                  <CardContent sx={{ p: 0.9, '&:last-child': { pb: 0.9 } }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.25}>
                      <Box display="flex" alignItems="center">
                        <Box sx={{ 
                          width: 22, 
                          height: 22, 
                          borderRadius: 1, 
                          bgcolor: company === 'Phonak' ? 'primary.main' : company === 'Siemens' ? 'success.main' : 'secondary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 1
                        }}>
                          <BusinessIcon sx={{ color: 'white', fontSize: 13 }} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                            {company}
                          </Typography>
                          <Typography variant="caption" sx={(t) => ({ ...inventoryMutedLabelSx(t), fontWeight: 500 })}>
                            {companyStats.total} items total
                          </Typography>
                        </Box>
                      </Box>
                      <Chip 
                        label={companyFilter === company ? "Applied" : "Filter"} 
                        color={companyFilter === company ? "primary" : "default"}
                        size="small"
                        variant={companyFilter === company ? "filled" : "outlined"}
                      />
                    </Box>
                    
                    <Box display="grid" gridTemplateColumns={isRestrictedUser ? 'repeat(2, 1fr)' : 'repeat(5, minmax(0, 1fr))'} gap={0.5}>
                      <Box textAlign="center" sx={(t) => ({ p: 0.5, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'success') })}>
                        <Typography variant="subtitle2" fontWeight={700} color="success.main">
                          {companyStats.inStock}
                        </Typography>
                        <Typography variant="caption" sx={(t) => inventoryMutedLabelSx(t)}>
                          In Stock
                        </Typography>
                      </Box>
                      {!isRestrictedUser && (
                        <Box textAlign="center" sx={(t) => ({ p: 0.5, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'info') })}>
                          <Typography variant="subtitle2" fontWeight={700} color="info.main">
                            {companyStats.sold}
                          </Typography>
                          <Typography variant="caption" sx={(t) => inventoryMutedLabelSx(t)}>
                            Sold
                          </Typography>
                        </Box>
                      )}
                      {!isRestrictedUser && (
                        <Box textAlign="center" sx={(t) => ({ p: 0.5, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'grey') })}>
                          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                            {companyStats.total}
                          </Typography>
                          <Typography variant="caption" sx={(t) => inventoryMutedLabelSx(t)}>
                            Total
                          </Typography>
                        </Box>
                      )}
                      {!isRestrictedUser && (
                        <>
                          <Box textAlign="center" sx={(t) => ({ p: 0.5, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'primary') })}>
                            <Typography variant="caption" fontWeight={700} color="primary.main" noWrap>
                              {formatCurrency(companyStats.dealerValue)}
                            </Typography>
                            <Typography variant="caption" sx={(t) => inventoryMutedLabelSx(t)}>
                              Dealer
                            </Typography>
                          </Box>
                          <Box textAlign="center" sx={(t) => ({ p: 0.5, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'warning') })}>
                            <Typography variant="caption" fontWeight={700} color="warning.main" noWrap>
                              {formatCurrency(companyStats.mrpValue)}
                            </Typography>
                            <Typography variant="caption" sx={(t) => inventoryMutedLabelSx(t)}>
                              MRP
                            </Typography>
                          </Box>
                        </>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Stock Distribution by Manufacturer */}
      <Paper elevation={0} sx={{ ...compactSectionSx, ...modernPanelSx, display: commandViewTab === 'analytics' ? 'block' : 'none' }}>
        <Box display="flex" alignItems="center" mb={1.5}>
          <BusinessIcon color="secondary" sx={{ mr: 2 }} />
          <Typography component="h2" variant="h6" sx={(t) => ({ fontWeight: 700, color: t.palette.text.primary })}>
            Stock Position by Company
          </Typography>
        </Box>
        
        <Grid container spacing={1.25}>
          {(() => {
            // Get all inventory items (not just hearing aids)
            const allItems = (locationFilter || statusFilter || typeFilter || searchTerm || companyFilter) ? filteredInventory : inventory;
            const inStockItems = allItems.filter(item => item.status === 'In Stock');
            
            // Group by business company (from location/company field)
            const companyMap = new Map();
            inStockItems.forEach(item => {
              const businessCompany = item.company || 'Unknown';
              if (!companyMap.has(businessCompany)) {
                companyMap.set(businessCompany, {
                  name: businessCompany,
                  items: [],
                  totalCount: 0,
                  dealerValue: 0,
                  mrpValue: 0
                });
              }
              const companyData = companyMap.get(businessCompany);
              companyData.items.push(item);
              companyData.totalCount += (item.quantity || 1);
              companyData.dealerValue += (item.dealerPrice || 0) * (item.quantity || 1);
              companyData.mrpValue += (item.mrp || 0) * (item.quantity || 1);
            });
            
            // Convert to array and sort by count
            const businessCompanies = Array.from(companyMap.values())
              .sort((a, b) => b.totalCount - a.totalCount);
            
            return businessCompanies.map(company => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={company.name}>
                <Card elevation={0} sx={{ 
                  ...compactCardSx,
                  border: '1px solid',
                  borderColor: companyFilter === company.name ? businessCompanyChipColor(company.name) : 'divider',
                  '&:hover': {
                    borderColor: businessCompanyChipColor(company.name),
                    boxShadow: `0 4px 14px ${businessCompanyChipColor(company.name)}20`,
                    transform: 'translateY(-1px)',
                  },
                }}
                onClick={() => setCompanyFilter(companyFilter === company.name ? '' : company.name)}>
                  <CardContent sx={{ p: 0.9, '&:last-child': { pb: 0.9 } }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.25}>
                      <Box display="flex" alignItems="center">
                        <Box sx={{ 
                          width: 22, 
                          height: 22, 
                          borderRadius: 1, 
                          bgcolor: businessCompanyChipColor(company.name),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 1,
                          boxShadow: `0 3px 10px ${businessCompanyChipColor(company.name)}30`
                        }}>
                          <Typography variant="caption" fontWeight={700} color="white">
                            {company.name.charAt(0)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                            {company.name}
                          </Typography>
                          <Typography variant="caption" sx={(t) => ({ ...inventoryMutedLabelSx(t), fontWeight: 500 })}>
                            {company.totalCount} items
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                    
                    {!isRestrictedUser && (
                      <Box display="grid" gridTemplateColumns="1fr 1fr" gap={0.5} mt={0.75}>
                        <Box textAlign="center" sx={(t) => ({ p: 0.65, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'primary') })}>
                          <Typography variant="body2" fontWeight="bold" color="primary.main" noWrap>
                            {formatCurrency(company.dealerValue)}
                          </Typography>
                          <Typography variant="caption" sx={(t) => inventoryMutedLabelSx(t)}>
                            Dealer Value
                          </Typography>
                        </Box>
                        <Box textAlign="center" sx={(t) => ({ p: 0.65, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'success') })}>
                          <Typography variant="body2" fontWeight="bold" color="success.main" noWrap>
                            {formatCurrency(company.mrpValue)}
                          </Typography>
                          <Typography variant="caption" sx={(t) => inventoryMutedLabelSx(t)}>
                            MRP Value
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    
                    <Box
                      mt={1}
                      sx={(t) => ({
                        p: 1,
                        borderRadius: 1,
                        bgcolor: t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50],
                      })}
                    >
                      <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                        {((company.totalCount / inStockItems.length) * 100).toFixed(1)}% of total inventory
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ));
          })()}
        </Grid>
        
        {(() => {
          const allItems = (locationFilter || statusFilter || typeFilter || searchTerm) ? filteredInventory : inventory;
          const inStockItems = allItems.filter(item => item.status === 'In Stock');
          
          if (inStockItems.length === 0) {
            return (
              <Box textAlign="center" py={4}>
                <BusinessIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No items in stock
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Add some inventory to see company distribution
                </Typography>
              </Box>
            );
          }
          return null;
        })()}
      </Paper>

      {/* Center-wise Stock Overview */}
      <Paper elevation={0} sx={{ ...compactSectionSx, ...modernPanelSx, maxHeight: { md: 420 }, overflowY: 'auto', display: commandViewTab === 'analytics' ? 'block' : 'none' }}>
        <Box display="flex" alignItems="center" mb={1.5}>
          <LocationIcon color="primary" sx={{ mr: 2 }} />
          <Typography component="h2" variant="h6" sx={(t) => ({ fontWeight: 700, color: t.palette.text.primary })}>
            Stock Position by Center
          </Typography>
        </Box>
        
        <Grid container spacing={1.25}>
          {locations.map(location => {
            // Use filteredInventory if other filters are applied, otherwise use all inventory
            const baseItems = (companyFilter || statusFilter || typeFilter || searchTerm) ? filteredInventory : inventory;
            const locationItems = baseItems.filter(item => item.location === location);
            const locationStats = {
              total: locationItems.length,
              inStock: locationItems.filter(i => i.status === 'In Stock').length,
              sold: locationItems.filter(i => i.status === 'Sold').length,
              dealerValue: locationItems.filter(i => i.status === 'In Stock').reduce((sum, i) => sum + (i.dealerPrice || 0) * (i.quantity || 1), 0),
              mrpValue: locationItems.filter(i => i.status === 'In Stock').reduce((sum, i) => sum + (i.mrp || 0) * (i.quantity || 1), 0)
            };
            
            const centerName = getCenterName(location);
            
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={location}>
                <Card elevation={0} sx={{ 
                  ...compactCardSx,
                  border: locationFilter === location ? '2px solid' : '1px solid',
                  borderColor: locationFilter === location ? 'primary.main' : 'divider',
                }}
                onClick={() => setLocationFilter(locationFilter === location ? '' : location)}
                >
                  <CardContent sx={{ p: 0.9, '&:last-child': { pb: 0.9 } }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.25}>
                      <Box display="flex" alignItems="center">
                        <Box sx={{ 
                          width: 21, 
                          height: 21, 
                          borderRadius: 1, 
                          bgcolor: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 1
                        }}>
                          <LocationIcon sx={{ color: 'white', fontSize: 12 }} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="600" color="text.primary">
                            {centerName}
                          </Typography>
                          <Typography variant="caption" sx={(t) => ({ ...inventoryMutedLabelSx(t), fontWeight: 500 })}>
                            {locationStats.total} items
                          </Typography>
                        </Box>
                      </Box>
                      <Chip 
                        label={locationFilter === location ? "Applied" : "Click to Filter"} 
                        color={locationFilter === location ? "primary" : "default"}
                        size="small"
                        variant={locationFilter === location ? "filled" : "outlined"}
                      />
                    </Box>
                    
                    <Box display="grid" gridTemplateColumns={isRestrictedUser ? '1fr' : 'repeat(4, 1fr)'} gap={0.5} mt={0.75}>
                      <Box textAlign="center" sx={(t) => ({ p: 0.5, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'success') })}>
                        <Typography variant="body1" fontWeight="bold" color="success.main">
                          {locationStats.inStock}
                        </Typography>
                        <Typography variant="caption" sx={(t) => inventoryMutedLabelSx(t)}>
                          In Stock
                        </Typography>
                      </Box>
                      {!isRestrictedUser && (
                        <Box textAlign="center" sx={(t) => ({ p: 0.5, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'info') })}>
                          <Typography variant="body1" fontWeight="bold" color="info.main">
                            {locationStats.sold}
                          </Typography>
                          <Typography variant="caption" sx={(t) => inventoryMutedLabelSx(t)}>
                            Sold
                          </Typography>
                        </Box>
                      )}
                      {!isRestrictedUser && (
                        <>
                          <Box textAlign="center" sx={(t) => ({ p: 0.5, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'primary') })}>
                            <Typography variant="caption" fontWeight="bold" color="primary.main" noWrap>
                              {formatCurrency(locationStats.dealerValue)}
                            </Typography>
                            <Typography variant="caption" sx={(t) => ({ ...inventoryMutedLabelSx(t), display: 'block' })}>
                              Dealer
                            </Typography>
                          </Box>
                          <Box textAlign="center" sx={(t) => ({ p: 0.5, borderRadius: 0.9, bgcolor: inventoryStatTileBg(t, 'warning') })}>
                            <Typography variant="caption" fontWeight="bold" color="warning.main" noWrap>
                              {formatCurrency(locationStats.mrpValue)}
                            </Typography>
                            <Typography variant="caption" sx={(t) => ({ ...inventoryMutedLabelSx(t), display: 'block' })}>
                              MRP
                            </Typography>
                          </Box>
                        </>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* Stock by Category */}
      <Paper elevation={0} sx={{ ...compactSectionSx, ...modernPanelSx, maxHeight: { md: 320 }, overflowY: 'auto', display: commandViewTab === 'analytics' ? 'block' : 'none' }}>
        <Box display="flex" alignItems="center" mb={1.25}>
          <CategoryIcon color="primary" sx={{ mr: 2 }} />
          <Typography component="h2" variant="h6" sx={(t) => ({ fontWeight: 700, color: t.palette.text.primary })}>
            Stock by Category
          </Typography>
        </Box>
        
        <Grid container spacing={1}>
          {grouped.length === 0 ? (
            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={(t) => ({
                  p: 1.5,
                  textAlign: 'center',
                  color: 'text.secondary',
                  borderRadius: 2,
                  bgcolor: t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50],
                  border: 1,
                  borderColor: 'divider',
                })}
              >
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
                    {!isRestrictedUser && (
                      <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                        <Box textAlign="left">
                          <Typography variant="body1" fontWeight="bold" color="primary.main">
                            {formatCurrency(group.totalDealerValue)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Dealer Value
                          </Typography>
                        </Box>
                        <Box textAlign="right">
                          <Typography variant="body1" fontWeight="bold" color="success.main">
                            {formatCurrency(group.totalMRPValue)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            MRP Value
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      </Paper>

      <Paper
        elevation={0}
        sx={(t) => ({
          ...compactSectionSx,
          ...modernPanelSx,
          display: commandViewTab === 'analytics' ? 'block' : 'none',
          borderColor: alpha(t.palette.primary.main, 0.18),
        })}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.25}>
          <Typography variant="subtitle1" fontWeight={700}>Top Category Momentum</Typography>
          <Typography variant="caption" color="text.secondary">Highest inventory concentration</Typography>
        </Box>
        <Stack spacing={0.9}>
          {topCategories.map((row, index) => (
            <Box key={row.category} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.25, p: 1 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.6}>
                <Box display="flex" alignItems="center" gap={0.75}>
                  <Chip size="small" label={`#${index + 1}`} color={index < 2 ? 'primary' : 'default'} />
                  <Typography variant="body2" fontWeight={600}>{row.category}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">{row.count} items</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(row.count / Math.max(1, topCategories[0]?.count || 1)) * 100}
                sx={{ height: 6, borderRadius: 6, mb: 0.5 }}
              />
              {!isRestrictedUser && (
                <Typography variant="caption" color="text.secondary">
                  Dealer value: {formatCurrency(row.dealer)}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Products by Category with drill-down */}
      <Paper elevation={0} sx={{ ...compactSectionSx, ...modernPanelSx, overflow: 'hidden', display: commandViewTab === 'analytics' ? 'block' : 'none' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.25}>
          <Typography variant="subtitle1" fontWeight={700}>Products by Category</Typography>
          <Typography variant="caption" color="text.secondary">{categoryRows.length} product rows</Typography>
        </Box>
        <TableContainer>
          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.9 } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>In Stock</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Serials</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {categoryRows.map((row) => (
                <TableRow key={`${row.category}-${row.productName}`} hover>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">{row.category}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{row.productName}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Chip label={row.count} size="small" color="success" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View serial numbers">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => openSerialsDialog(row.category, row.productName, row.items)}
                        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                      >
                        <VisibilityIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {categoryRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 2, color: 'text.secondary' }}>No products in stock</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      
      {/* Clean Filters and Actions */}
      <Paper
        elevation={0}
        sx={(t) => ({
          ...compactSectionSx,
          p: 1.5,
          position: 'sticky',
          top: 8,
          zIndex: 20,
          boxShadow: t.palette.mode === 'dark' ? `0 8px 24px ${alpha(t.palette.common.black, 0.45)}` : `0 6px 18px ${alpha(t.palette.common.black, 0.08)}`,
          backdropFilter: 'blur(6px)',
          display: commandViewTab === 'live' ? 'block' : 'none',
        })}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
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
          </Box>
        </Box>

        {/* Search Bar */}
        <Box mb={1.25}>
          <TextField
            placeholder="Search by product name, serial number, company, or supplier..."
            fullWidth
            variant="outlined"
            size="small"
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
        <Box display="flex" gap={0.75} flexWrap="wrap" mb={1.25}>
          {['', 'In Stock', 'Sold', 'Damaged'].map((status) => (
            <Chip
              key={status || 'all'}
              size="small"
              label={status || 'All Statuses'}
              color={statusFilter === status ? 'primary' : 'default'}
              variant={statusFilter === status ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(status)}
            />
          ))}
          <Chip
            size="small"
            label={showSoldItems ? 'Hide Sold Rows' : 'Show Sold Rows'}
            color={showSoldItems ? 'warning' : 'default'}
            variant={showSoldItems ? 'filled' : 'outlined'}
            onClick={() => setShowSoldItems((prev) => !prev)}
          />
        </Box>

        <Grid container spacing={1} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small" variant="outlined">
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
                {!isRestrictedUser && (
                  <MenuItem value="Sold">
                    <Box display="flex" alignItems="center">
                      <ShoppingCartIcon color="warning" sx={{ mr: 1 }} />
                      Sold
                    </Box>
                  </MenuItem>
                )}
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
            <FormControl fullWidth size="small" variant="outlined">
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
            <FormControl fullWidth size="small" variant="outlined">
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
            <FormControl fullWidth size="small" variant="outlined">
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
                {originalProductCompanies.map(company => (
                  <MenuItem key={company} value={company}>{company}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Active Filters Display */}
        {(searchTerm || statusFilter || typeFilter || locationFilter || companyFilter) && (
          <Box mt={1.25}>
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
      <Paper
        elevation={0}
        sx={(t) => ({
          ...modernPanelSx,
          overflow: 'hidden',
          mb: 1,
          display: commandViewTab === 'live' ? 'block' : 'none',
          borderColor: alpha(t.palette.primary.main, 0.16),
        })}
      >
        <Box sx={{ px: 2, py: 1.25, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <ViewListIcon color="primary" sx={{ mr: 2 }} />
              <Typography variant="h6" fontWeight="600" color="text.primary">
                Inventory Items
              </Typography>
              <Chip 
                label={`${commandFilteredInventory.length} items`} 
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
              onClick={handleExportData}
            >
              Export Data
            </Button>
          </Box>
        </Box>

        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow
                sx={(t) => ({
                  bgcolor:
                    t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.background.default,
                  '& th': { color: 'text.primary' },
                })}
              >
                <TableCell sx={{ fontWeight: 'bold', py: 1.25 }}>
                  <Box display="flex" alignItems="center">
                    <AssignmentIcon sx={{ mr: 1, fontSize: 20 }} />
                    Product Details
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 1.25 }}>
                  <Box display="flex" alignItems="center">
                    <SearchIcon sx={{ mr: 1, fontSize: 20 }} />
                    Serial Number
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 1.25 }}>
                  <Box display="flex" alignItems="center">
                    <BusinessIcon sx={{ mr: 1, fontSize: 20 }} />
                    Company
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 1.25 }}>
                  <Box display="flex" alignItems="center">
                    <BusinessIcon sx={{ mr: 1, fontSize: 20, color: 'secondary.main' }} />
                    Manufacturer
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 1.25 }}>
                  <Box display="flex" alignItems="center">
                    <LocationIcon sx={{ mr: 1, fontSize: 20 }} />
                    Location
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', py: 1.25 }}>
                  <Box display="flex" alignItems="center">
                    <CheckCircleIcon sx={{ mr: 1, fontSize: 20 }} />
                    Status
                  </Box>
                </TableCell>
                {!isRestrictedUser && (
                  <>
                    <TableCell align="right" sx={{ fontWeight: 'bold', py: 1.25 }}>
                      Pricing
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', py: 1.25 }}>
                      Purchase Info
                    </TableCell>
                  </>
                )}
                <TableCell align="center" sx={{ fontWeight: 'bold', py: 1.25 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {commandFilteredInventory.length > 0 ? (
                paginatedData.map((item) => (
                    <TableRow 
                      key={item.id} 
                      hover 
                      sx={(t) => ({
                        '&:hover': { bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.14 : 0.06) },
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        ...(t.palette.mode === 'dark'
                          ? { bgcolor: alpha(t.palette.common.white, 0.01) }
                          : { bgcolor: 'transparent' }),
                        '&:nth-of-type(even)': {
                          bgcolor: t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.02) : alpha(t.palette.common.black, 0.012),
                        },
                        ...(item.status === 'Sold' && {
                          bgcolor:
                            t.palette.mode === 'dark'
                              ? alpha(t.palette.warning.main, 0.16)
                              : alpha(t.palette.warning.main, 0.09),
                          borderLeft: `3px solid ${alpha(t.palette.warning.main, 0.9)}`,
                          '&:hover': {
                            bgcolor:
                              t.palette.mode === 'dark'
                                ? alpha(t.palette.warning.main, 0.24)
                                : alpha(t.palette.warning.main, 0.14),
                          },
                        }),
                      })}
                    >
                      <TableCell sx={{ py: 1.25 }}>
                        <Box>
                          <Typography variant="body2" fontWeight={700} gutterBottom>
                            {getCanonicalSearchProductName(item)}
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
                      <TableCell sx={{ py: 1.25 }}>
                        <Box
                          sx={(t) => ({
                            p: 0.8,
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            color: 'text.primary',
                            letterSpacing: '0.05em',
                            bgcolor:
                              t.palette.mode === 'dark'
                                ? alpha(t.palette.common.white, 0.08)
                                : t.palette.grey[100],
                          })}
                        >
                          {item.serialNumber}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Box display="flex" alignItems="center">
                          <Box sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: businessCompanyChipColor(item.company || 'Unknown'),
                            mr: 1
                          }} />
                          <Typography variant="body2" fontWeight="medium">
                            {item.company}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Box display="flex" alignItems="center">
                          <Box sx={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: '50%', 
                            bgcolor: item.originalProductCompany === 'Phonak' ? 'primary.main' : 
                                     item.originalProductCompany === 'Siemens' ? 'success.main' : 
                                     item.originalProductCompany === 'ReSound' ? 'warning.main' : 
                                     'secondary.main',
                            mr: 1
                          }} />
                          <Typography variant="body2" fontWeight="medium">
                            {item.originalProductCompany || '-'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography variant="body2" color="text.secondary">
                          {getCenterName(item.location)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Box
                          component="span"
                          sx={(t) => {
                            const isStock = item.status === 'In Stock';
                            const isSold = item.status === 'Sold';
                            const isDamaged = item.status === 'Damaged';
                            const tone = isStock ? t.palette.success.main : isSold ? t.palette.warning.main : isDamaged ? t.palette.error.main : t.palette.info.main;
                            return {
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.75,
                              px: 1,
                              py: 0.35,
                              borderRadius: 99,
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: tone,
                              bgcolor: alpha(tone, t.palette.mode === 'dark' ? 0.2 : 0.12),
                            };
                          }}
                        >
                          <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'currentColor' }} />
                          {item.status}
                        </Box>
                      </TableCell>
                      {!isRestrictedUser && (
                        <>
                          <TableCell align="right" sx={{ py: 1.25 }}>
                            <Box textAlign="right">
                              <Typography variant="body2" fontWeight={700} color="primary.main">
                                {formatCurrency(item.dealerPrice)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                                MRP: {formatCurrency(item.mrp)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ py: 1.25 }}>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {formatDate(item.purchaseDate)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                                {item.supplier}
                              </Typography>
                            </Box>
                          </TableCell>
                        </>
                      )}
                      <TableCell align="center" sx={{ py: 1.25 }}>
                        <Box display="flex" justifyContent="center" gap={1}>
                          <Tooltip title="View Details">
                            <IconButton 
                              size="small" 
                              color="info"
                              sx={(t) => ({
                                bgcolor: alpha(t.palette.info.main, t.palette.mode === 'dark' ? 0.22 : 0.12),
                                '&:hover': {
                                  bgcolor: alpha(t.palette.info.main, t.palette.mode === 'dark' ? 0.32 : 0.2),
                                },
                              })}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {!isRestrictedUser && (
                            <Tooltip title="Edit Item">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => handleOpenDialog(item)}
                                sx={(t) => ({
                                  bgcolor: alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.22 : 0.12),
                                  '&:hover': {
                                    bgcolor: alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.32 : 0.2),
                                  },
                                })}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isRestrictedUser && item.serialNumbers && item.serialNumbers.length >= 1 && item.pairGroupKey && (
                            <Tooltip title="Repair Pair Mapping">
                              <IconButton
                                size="small"
                                color="secondary"
                                onClick={() => handleOpenPairRepair(item)}
                                sx={(t) => ({
                                  bgcolor: alpha(t.palette.secondary.main, t.palette.mode === 'dark' ? 0.22 : 0.12),
                                  '&:hover': {
                                    bgcolor: alpha(t.palette.secondary.main, t.palette.mode === 'dark' ? 0.32 : 0.2),
                                  },
                                })}
                              >
                                <LinkIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isRestrictedUser ? 7 : 9} sx={{ py: 8 }}>
                    <Box textAlign="center">
                      <InventoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
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
        
        {commandFilteredInventory.length > 0 && (
          <Box sx={{ p: 2, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={commandFilteredInventory.length}
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
      <Drawer anchor="right" open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)}>
        <Box sx={{ width: 320, p: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Advanced Filters</Typography>
          <Typography variant="caption" color="text.secondary">Multi-select filters for status, brand, and center.</Typography>
          <Divider sx={{ my: 1.25 }} />
          <Typography variant="caption" color="text.secondary">Status</Typography>
          <Box display="flex" flexWrap="wrap" gap={0.75} mt={0.5} mb={1.5}>
            {['In Stock', 'Sold', 'Damaged', 'Reserved'].map((status) => (
              <Chip
                key={status}
                size="small"
                label={status}
                color={multiStatusFilter.includes(status) ? 'primary' : 'default'}
                variant={multiStatusFilter.includes(status) ? 'filled' : 'outlined'}
                onClick={() => toggleMultiFilter(status, setMultiStatusFilter)}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">Brand</Typography>
          <Box display="flex" flexWrap="wrap" gap={0.75} mt={0.5} mb={1.5}>
            {originalProductCompanies.map((brandRaw) => {
              const brand = String(brandRaw || '').trim();
              if (!brand) return null;
              return (
              <Chip
                key={brand}
                size="small"
                label={brand}
                color={multiBrandFilter.includes(brand) ? 'primary' : 'default'}
                variant={multiBrandFilter.includes(brand) ? 'filled' : 'outlined'}
                onClick={() => toggleMultiFilter(brand, setMultiBrandFilter)}
              />
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary">Center</Typography>
          <Box display="flex" flexWrap="wrap" gap={0.75} mt={0.5} mb={1.5}>
            {locations.map((locRaw) => {
              const loc = String(locRaw || '').trim();
              if (!loc) return null;
              return (
              <Chip
                key={loc}
                size="small"
                label={getCenterName(loc)}
                color={multiCenterFilter.includes(loc) ? 'primary' : 'default'}
                variant={multiCenterFilter.includes(loc) ? 'filled' : 'outlined'}
                onClick={() => toggleMultiFilter(loc, setMultiCenterFilter)}
              />
              );
            })}
          </Box>
          <Divider sx={{ my: 1.25 }} />
          <Button
            fullWidth
            size="small"
            variant="outlined"
            onClick={() => {
              setMultiStatusFilter([]);
              setMultiBrandFilter([]);
              setMultiCenterFilter([]);
            }}
          >
            Clear Drawer Filters
          </Button>
        </Box>
      </Drawer>

      </Box>

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
                  <TableCell>{getCenterName(r.location || '') || '-'}</TableCell>
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

      <Dialog open={journeyDialogOpen} onClose={() => setJourneyDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{`Product Journey${selectedJourney.displaySerial ? ` • ${selectedJourney.displaySerial}` : ''}`}</DialogTitle>
        <DialogContent dividers>
          {selectedJourney.events.length === 0 ? (
            <Typography color="text.secondary">No journey found for this serial number.</Typography>
          ) : (
            <Stack spacing={2.5}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Box display="flex" justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} flexDirection={{ xs: 'column', md: 'row' }}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{selectedJourney.productName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Serial Number: {selectedJourney.displaySerial}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label={`${selectedJourney.events.length} events`} size="small" variant="outlined" />
                    {selectedJourney.inventoryItem?.status && (
                      <Chip label={`Current Status: ${selectedJourney.inventoryItem.status}`} size="small" color={getStatusColor(selectedJourney.inventoryItem.status)} />
                    )}
                    {(selectedJourney.inventoryItem?.location || selectedJourney.latestEvent?.location) && (
                      <Chip
                        label={`Latest Location: ${getCenterName(selectedJourney.inventoryItem?.location || selectedJourney.latestEvent?.location || '')}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Box>
              </Paper>

              <Stack spacing={0}>
                {selectedJourney.events.map((event, index) => (
                  <Box key={event.id} display="flex" gap={2}>
                    <Box display="flex" flexDirection="column" alignItems="center" sx={{ pt: 1, minWidth: 24 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          bgcolor: getJourneyEventColor(event.eventType),
                          border: '3px solid',
                          borderColor: 'background.paper',
                          boxShadow: 1,
                        }}
                      />
                      {index < selectedJourney.events.length - 1 && (
                        <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', minHeight: 56 }} />
                      )}
                    </Box>

                    <Paper
                      elevation={0}
                      sx={{
                        flex: 1,
                        p: 2,
                        mb: index < selectedJourney.events.length - 1 ? 1.5 : 0,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderLeftWidth: 4,
                        borderLeftColor: getJourneyEventColor(event.eventType),
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" gap={2} alignItems={{ xs: 'flex-start', md: 'center' }} flexDirection={{ xs: 'column', md: 'row' }}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box sx={{ color: getJourneyEventColor(event.eventType), display: 'flex', alignItems: 'center' }}>
                            {getJourneyEventIcon(event.eventType)}
                          </Box>
                          <Box>
                            <Typography fontWeight={700}>{getJourneyEventTitle(event)}</Typography>
                            <Typography variant="body2" color="text.secondary">{getJourneyEventDescription(event)}</Typography>
                          </Box>
                        </Box>
                        <Chip label={formatDateTime(event.date)} size="small" variant="outlined" />
                      </Box>

                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                        {event.location && (
                          <Chip size="small" label={`Location: ${getCenterName(event.location)}`} />
                        )}
                        {event.counterparty && (
                          <Chip size="small" label={event.counterparty} variant="outlined" />
                        )}
                        {event.referenceNo && (
                          <Chip size="small" label={`Ref: ${event.referenceNo}`} variant="outlined" />
                        )}
                        {event.sourceLabel && (
                          <Chip size="small" label={event.sourceLabel} variant="outlined" />
                        )}
                      </Stack>

                      {event.notes && (
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                          {event.notes
                            .split('•')
                            .map((part) => part.trim())
                            .filter(Boolean)
                            .slice(0, 4)
                            .map((part) => (
                              <Chip key={`${event.id}-${part}`} size="small" variant="outlined" label={part} />
                            ))}
                        </Stack>
                      )}

                      {event.sourcePath && (
                        <Box sx={{ mt: 1.5 }}>
                          <Button size="small" variant="outlined" onClick={() => window.open(event.sourcePath, '_blank')}>
                            Open Source Record
                          </Button>
                        </Box>
                      )}
                    </Paper>
                  </Box>
                ))}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJourneyDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pairRepairOpen} onClose={() => !savingPairRepair && setPairRepairOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Repair Pair Mapping</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Product: {pairRepairItem?.productName || '-'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Available serials in this group: {pairRepairSerialList.join(', ') || '-'}
            </Typography>
            <TextField
              label="Pairs (ordered serial list)"
              value={pairRepairInput}
              onChange={(e) => setPairRepairInput(e.target.value)}
              multiline
              minRows={3}
              placeholder="SN101, SN102, SN103, SN104"
              helperText="Enter serials in pair order: 1st+2nd = Pair 1, 3rd+4th = Pair 2, etc."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPairRepairOpen(false)} disabled={savingPairRepair}>Cancel</Button>
          <Button variant="contained" onClick={handleSavePairRepair} disabled={savingPairRepair}>
            Save Pair Mapping
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog for adding/editing inventory items */}
      <InventoryItemDialog 
        open={openDialog}
        onClose={() => {
          if (!savingItem) handleCloseDialog();
        }}
        onSave={handleSaveItem}
        item={editingItem || undefined}
        isEditing={!!editingItem}
        products={products}
        isSaving={savingItem}
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