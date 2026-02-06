'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Autocomplete,
  Stack,
  Grid,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  SwapHoriz as TransferIcon,
  Inventory as InventoryIcon,
  Store as StoreIcon,
  InfoOutlined as InfoIcon,
  Summarize as SummarizeIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp, 
  Timestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { getHeadOfficeId } from '@/utils/centerUtils';

interface StockTransferProduct {
  productId: string;
  name: string;
  serialNumbers: string[];
  quantity: number;
}

interface StockTransfer {
  id?: string;
  transferNumber: string;
  transferType: 'intracompany' | 'intercompany';
  company?: string;
  fromCompany?: string;
  toCompany?: string;
  fromBranch: string;
  toBranch: string;
  products: StockTransferProduct[];
  reason: string;
  transferDate: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

interface Center {
  id: string;
  name: string;
  companies?: string[];
}

interface Company {
  id: string;
  name: string;
}

interface AvailableStockItem {
  productId: string;
  name: string;
  type: string;
  company?: string;
  businessCompany?: string;
  location: string;
  isSerialTracked: boolean;
  serialNumber?: string;
  quantity?: number;
}

interface SelectableStockProduct {
  productId: string;
  name: string;
  type: string;
  company?: string;
  businessCompany?: string;
  location: string;
  isSerialTracked: boolean;
  serialNumbers?: string[];
  quantity?: number;
}

const emptyTransfer: Omit<StockTransfer, 'id'> = {
  transferNumber: '',
  transferType: 'intracompany',
  fromBranch: '',
  toBranch: '',
  products: [],
  reason: '',
  transferDate: Timestamp.now(),
};

const StockTransferPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [filteredTransfers, setFilteredTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentTransfer, setCurrentTransfer] = useState<StockTransfer | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [availableStock, setAvailableStock] = useState<AvailableStockItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<SelectableStockProduct | null>(null);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [stockLoading, setStockLoading] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTransfer, setPreviewTransfer] = useState<StockTransfer | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      loadData();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    filterTransfers();
  }, [transfers, searchTerm, dateFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTransfers(),
        loadCenters(),
        loadCompanies(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setErrorMsg('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadTransfers = async () => {
    try {
      const transfersQuery = query(collection(db, 'stockTransfers'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(transfersQuery);
      const transfersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as StockTransfer[];
      setTransfers(transfersData);
    } catch (error) {
      console.error('Error loading transfers:', error);
    }
  };

  const loadCenters = async () => {
    try {
      const centersQuery = query(collection(db, 'centers'), orderBy('name', 'asc'));
      const snapshot = await getDocs(centersQuery);
      const centersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Center[];
      setCenters(centersData);
    } catch (error) {
      console.error('Error loading centers:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const companiesQuery = query(collection(db, 'companies'), orderBy('name', 'asc'));
      const snapshot = await getDocs(companiesQuery);
      
      if (snapshot.docs.length > 0) {
        const companiesData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
        })) as Company[];
        setCompanies(companiesData);
      } else {
        const defaultCompanies = [
          { id: '1', name: 'Hope Enterprises' },
          { id: '2', name: 'HDIPL' },
        ];
        setCompanies(defaultCompanies);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
      const defaultCompanies = [
        { id: '1', name: 'Hope Enterprises' },
        { id: '2', name: 'HDIPL' },
      ];
      setCompanies(defaultCompanies);
    }
  };

  // SAME LOGIC AS INVENTORY MODULE - Build available stock from materialInward and purchases
  const fetchAvailableStock = async () => {
    try {
      setStockLoading(true);
      console.log('🔍 Fetching available stock using inventory module logic...');
      
      const headOfficeId = await getHeadOfficeId();
      // Use a fresh centers snapshot here so mapping works even if state hasn't loaded yet.
      const centersSnap = await getDocs(collection(db, 'centers'));
      const centersList: Center[] = centersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any;
      if (!centers.length && centersList.length) {
        // Keep UI state in sync for getCenterName() and dropdowns
        setCenters(centersList as any);
      }
      const normalizeLocation = (loc: any): string => {
        const raw = String(loc || '').trim();
        if (!raw) return headOfficeId;
        // Already an id?
        if (centersList.some(c => c.id === raw)) return raw;
        // Legacy data may store center name instead of id
        const byName = centersList.find(c => String(c.name || '').trim() === raw);
        return byName?.id || raw;
      };
      
      const [productsSnap, materialInSnap, purchasesSnap, materialsOutSnap, salesSnap, enquiriesSnap, stockTransfersSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'materialInward')),
        getDocs(collection(db, 'purchases')),
        getDocs(collection(db, 'materialsOut')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'enquiries')),
        getDocs(collection(db, 'stockTransfers')),
      ]);

      const productById = new Map<string, any>();
      productsSnap.docs.forEach(d => productById.set(d.id, d.data()));

      const normKeyForSet = (pid: string, sn: string) =>
        `${String(pid || '').trim()}|${String(sn || '').trim()}`;
      // Track stock transfer serials that were received elsewhere (normalized keys)
      const stockTransferInSerials = new Set<string>();
      materialInSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        const supplierName = data.supplier?.name || '';
        if (supplierName.includes('Stock Transfer from')) {
          (data.products || []).forEach((prod: any) => {
            const productId = prod.productId || prod.id || '';
            const serialArray: string[] = Array.isArray(prod.serialNumbers)
              ? prod.serialNumbers
              : (prod.serialNumber ? [prod.serialNumber] : []);
            serialArray.forEach((sn: string) => {
              if (productId && sn) stockTransferInSerials.add(normKeyForSet(productId, sn));
            });
          });
        }
      });

      console.log('🔄 Stock Transfer Tracking:', {
        incomingTransferSerials: stockTransferInSerials.size,
        sampleSerials: Array.from(stockTransferInSerials).slice(0, 5)
      });

      // Track outgoing serials from materials out and sales
      const pendingOutSerials = new Set<string>();
      const dispatchedOutSerials = new Set<string>();
      let stockTransferOutCount = 0;
      let regularOutCount = 0;
      
      materialsOutSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        const status = (data.status as string) || 'dispatched';
        const notes = data.notes || '';
        const reason = data.reason || '';
        const isStockTransfer = notes.includes('Stock Transfer') || reason.includes('Stock Transfer');
        
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id || '';
          const serialArray: string[] = Array.isArray(prod.serialNumbers)
            ? prod.serialNumbers
            : (prod.serialNumber ? [prod.serialNumber] : []);
          serialArray.forEach((sn: string) => {
            const key = normKeyForSet(productId, sn);
            
            // If this is a stock transfer AND the item was received elsewhere, don't subtract it
            if (isStockTransfer && stockTransferInSerials.has(key)) {
              return;
            }
            
            if (isStockTransfer) {
              stockTransferOutCount++;
            } else {
              regularOutCount++;
            }
            
            if (status === 'pending') pendingOutSerials.add(key);
            if (status === 'dispatched') dispatchedOutSerials.add(key);
          });
        });
      });

      console.log('📤 Materials Out Tracking:', {
        stockTransferOuts: stockTransferOutCount,
        regularOuts: regularOutCount,
        totalPending: pendingOutSerials.size,
        totalDispatched: dispatchedOutSerials.size
      });

      // Sold serials: any serial sold from ANY branch must be excluded from available stock everywhere
      // Use normalized key (trimmed) so we match regardless of how material in/sales store ids
      const soldSerials = new Set<string>();
      const soldKey = (productId: string, serial: string) =>
        `${String(productId || '').trim()}|${String(serial || '').trim()}`;
      const addSoldSerial = (productId: string, serial: string) => {
        const key = soldKey(productId, serial);
        if (key.length <= 1) return; // need both parts
        soldSerials.add(key);
      };
      salesSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        (data.products || []).forEach((prod: any) => {
          const productId = (prod.productId || prod.id || '').toString();
          const single = (prod.serialNumber || '').toString().trim();
          const arr: string[] = Array.isArray(prod.serialNumbers)
            ? (prod.serialNumbers || []).map((s: any) => String(s || '').trim()).filter(Boolean)
            : [];
          if (single) addSoldSerial(productId, single);
          arr.forEach((sn: string) => addSoldSerial(productId, sn));
        });
      });

      // Enquiry visits that count as sales (same logic as inventory module)
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
              const productId = (prod.productId || prod.id || prod.hearingAidProductId || '').toString().trim();
              const single = (prod.serialNumber || prod.trialSerialNumber || '').toString().trim();
              const arr: string[] = Array.isArray(prod.serialNumbers)
                ? (prod.serialNumbers || []).map((s: any) => String(s || '').trim()).filter(Boolean)
                : [];
              if (single && productId) addSoldSerial(productId, single);
              arr.forEach((sn: string) => addSoldSerial(productId, sn));
            });
          }
        });
      });

      console.log('🚫 Sold serials (excluded from available stock):', soldSerials.size);

      // Build available stock from material inward and purchases
      const serialAvailableByKey = new Map<string, { item: AvailableStockItem; ts: number }>();
      const nonSerialInByProductLoc = new Map<string, number>();
      
      const getTs = (t: any): number => {
        if (!t) return 0;
        if (typeof t === 'number') return t;
        if (t?.toMillis) return t.toMillis();
        if (t?.seconds) return t.seconds * 1000;
        const d = new Date(t);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };

      const upsertSerial = (key: string, next: AvailableStockItem, ts: number) => {
        const existing = serialAvailableByKey.get(key);
        if (!existing || ts >= existing.ts) {
          serialAvailableByKey.set(key, { item: next, ts });
        }
      };

      // Apply stockTransfers as authoritative "moves" by transferDate.
      // This makes the Stock Transfer form match the Inventory module even if
      // legacy movement docs (material in/out) are missing or inconsistent.
      const applyStockTransferMoves = () => {
        const transfers: any[] = stockTransfersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        transfers.sort((a, b) => getTs(a.transferDate) - getTs(b.transferDate));
        for (const tr of transfers) {
          const toBranch = normalizeLocation(tr.toBranch);
          const transferCompany =
            tr.transferType === 'intercompany'
              ? (tr.toCompany || tr.company || '')
              : (tr.company || tr.toCompany || '');
          (tr.products || []).forEach((p: any) => {
            const productId = p.productId || p.id || '';
            const serials: string[] = Array.isArray(p.serialNumbers)
              ? p.serialNumbers
              : (p.serialNumber ? [p.serialNumber] : []);
            serials.forEach((sn) => {
              const key = `${productId}|${sn}`;
              const existing = serialAvailableByKey.get(key);
              if (!existing) return;
              // Move item to destination branch/company
              const moved: AvailableStockItem = {
                ...existing.item,
                location: toBranch,
                businessCompany: transferCompany || existing.item.businessCompany,
              };
              // Ensure the move wins over prior inbound timestamps
              const moveTs = getTs(tr.transferDate) || (existing.ts + 1);
              serialAvailableByKey.set(key, { item: moved, ts: Math.max(existing.ts, moveTs) });
            });
          });
        }
      };

      let materialInItemsCount = 0;
      let purchaseItemsCount = 0;

      // Process Material Inward
      console.log('📥 Processing Material Inward documents:', materialInSnap.size);
      // Sort so latest transfer-in wins deterministically
      const materialInDocsSorted = [...materialInSnap.docs].sort((a, b) => {
        const ad: any = a.data();
        const bd: any = b.data();
        return getTs(ad.receivedDate) - getTs(bd.receivedDate);
      });
      materialInDocsSorted.forEach(docSnap => {
        const data: any = docSnap.data();
        const receivedTs = getTs(data.receivedDate);
        const supplierName = data.supplier?.name || '';
        const isStockTransferIn = supplierName.includes('Stock Transfer from');
        const companyLocation = data.company || '';
        const documentLocation = normalizeLocation(data.location || headOfficeId);
        
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id;
          const productRef = productById.get(productId) || {};
          const name = prod.name || productRef.name || '';
          const type = prod.type || productRef.type || '';
          // Align with Inventory module: business company from doc.company, fallback to product.company
          const businessCompany = companyLocation || productRef.company || '';
          const manufacturerCompany = productRef.company || '';
          const serials: string[] = Array.isArray(prod.serialNumbers)
            ? prod.serialNumbers
            : (prod.serialNumber ? [prod.serialNumber] : []);
          const hasSerial = serials.length > 0;
          
          if (hasSerial) {
            serials.forEach(sn => {
              const key = `${productId}|${sn}`;
              const nk = soldKey(productId, sn);
              const reserved = pendingOutSerials.has(nk) || dispatchedOutSerials.has(nk);
              const sold = soldSerials.has(nk);
              
              if (!reserved && !sold) {
                // Stock transfer IN should override location/company (move) if newer
                if (isStockTransferIn) {
                  upsertSerial(key, {
                    productId,
                    name,
                    type,
                    company: manufacturerCompany,
                    businessCompany,
                    location: documentLocation,
                    isSerialTracked: true,
                    serialNumber: sn
                  }, receivedTs);
                } else {
                  // Normal inbound: only set if not already set by a newer movement
                  upsertSerial(key, {
                    productId,
                    name,
                    type,
                    company: manufacturerCompany,
                    businessCompany,
                    location: documentLocation,
                    isSerialTracked: true,
                    serialNumber: sn
                  }, receivedTs);
                }
              }
            });
          } else if (prod.quantity && prod.quantity > 0) {
            const k = `${productId}|${documentLocation}|${businessCompany}`;
            nonSerialInByProductLoc.set(k, (nonSerialInByProductLoc.get(k) || 0) + prod.quantity);
            materialInItemsCount++;
          }
        });
      });

      console.log('✅ Material Inward processed - Added items:', materialInItemsCount);

      // Process Purchases
      console.log('📥 Processing Purchases documents:', purchasesSnap.size);
      const purchaseDocsSorted = [...purchasesSnap.docs].sort((a, b) => {
        const ad: any = a.data();
        const bd: any = b.data();
        return getTs(ad.purchaseDate) - getTs(bd.purchaseDate);
      });
      purchaseDocsSorted.forEach(docSnap => {
        const data: any = docSnap.data();
        const purchaseTs = getTs(data.purchaseDate);
        const companyLocation = data.company || '';
        const documentLocation = normalizeLocation(data.location || headOfficeId);
        
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id;
          const productRef = productById.get(productId) || {};
          const name = prod.name || productRef.name || '';
          const type = prod.type || productRef.type || '';
          const businessCompany = companyLocation || productRef.company || '';
          const manufacturerCompany = productRef.company || '';
          const serials: string[] = Array.isArray(prod.serialNumbers)
            ? prod.serialNumbers
            : (prod.serialNumber ? [prod.serialNumber] : []);
          const hasSerial = serials.length > 0;
          
          if (hasSerial) {
            serials.forEach(sn => {
              const key = `${productId}|${sn}`;
              const nk = soldKey(productId, sn);
              const reserved = pendingOutSerials.has(nk) || dispatchedOutSerials.has(nk);
              const sold = soldSerials.has(nk);
              
              if (!reserved && !sold) {
                upsertSerial(key, {
                  productId,
                  name,
                  type,
                  company: manufacturerCompany,
                  businessCompany,
                  location: documentLocation,
                  isSerialTracked: true,
                  serialNumber: sn
                }, purchaseTs);
              }
            });
          } else if (prod.quantity && prod.quantity > 0) {
            const k = `${productId}|${documentLocation}|${businessCompany}`;
            nonSerialInByProductLoc.set(k, (nonSerialInByProductLoc.get(k) || 0) + prod.quantity);
          }
        });
      });

      // Subtract materials out
      materialsOutSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        const companyLocation = data.company || '';
        const documentLocation = normalizeLocation(data.location || headOfficeId);
        const notes = data.notes || '';
        const reason = data.reason || '';
        const isStockTransfer = notes.includes('Stock Transfer') || reason.includes('Stock Transfer');
        
        (data.products || []).forEach((prod: any) => {
          const productId = prod.productId || prod.id;
          const productRef = productById.get(productId) || {};
          const businessCompany = companyLocation || productRef.company || '';
          const hasSerial = !!productRef.hasSerialNumber;
          const serials: string[] = Array.isArray(prod.serialNumbers) ? prod.serialNumbers : (prod.serialNumber ? [prod.serialNumber] : []);
          const qty = Number(prod.quantity) || 0;
          
          if (!hasSerial && (!serials || serials.length === 0) && qty > 0) {
            if (isStockTransfer) {
              let shouldSkip = false;
              (data.products || []).forEach((p: any) => {
                (p.serialNumbers || []).forEach((sn: string) => {
                  const key = normKeyForSet(p.productId || p.id || '', sn);
                  if (stockTransferInSerials.has(key)) {
                    shouldSkip = true;
                  }
                });
              });
              if (shouldSkip) return;
            }
            
            const k = `${productId}|${documentLocation}|${businessCompany}`;
            nonSerialInByProductLoc.set(k, Math.max(0, (nonSerialInByProductLoc.get(k) || 0) - qty));
          } else if (isStockTransfer && serials.length > 0) {
            // Stock transfer out with serials: reduce non-serial count at source so transferred units
            // don't still show as available (e.g. product was received without serial, then transferred with serial)
            const k = `${productId}|${documentLocation}|${businessCompany}`;
            const deduct = serials.length;
            nonSerialInByProductLoc.set(k, Math.max(0, (nonSerialInByProductLoc.get(k) || 0) - deduct));
          }
        });
      });

      // Stock transfers collection: reduce non-serial count at SOURCE (fromBranch) so transferred/sold units don't show
      stockTransfersSnap.docs.forEach(docSnap => {
        const data: any = docSnap.data();
        const fromBranch = normalizeLocation(data.fromBranch || headOfficeId);
        const companyLocation = data.company || data.fromCompany || '';
        (data.products || []).forEach((p: any) => {
          const productId = p.productId || p.id || '';
          const serials: string[] = Array.isArray(p.serialNumbers)
            ? p.serialNumbers
            : (p.serialNumber ? [p.serialNumber] : []);
          const qty = serials.length || Math.max(0, Number(p.quantity) || 0);
          if (!productId || qty <= 0) return;
          const productRef = productById.get(productId) || {};
          const businessCompany = companyLocation || productRef.company || '';
          const k = `${productId}|${fromBranch}|${businessCompany}`;
          nonSerialInByProductLoc.set(k, Math.max(0, (nonSerialInByProductLoc.get(k) || 0) - qty));
        });
      });

      // Build non-serial available items
      const nonSerialAvailable: AvailableStockItem[] = [];
      nonSerialInByProductLoc.forEach((qty, key) => {
        if (qty <= 0) return;
        const [productId, location, businessCompanyFromKey] = key.split('|');
        const p = productById.get(productId) || {};
        nonSerialAvailable.push({
          productId,
          name: p.name || '',
          type: p.type || '',
          company: p.company || '',
          businessCompany: businessCompanyFromKey || '',
          location,
          isSerialTracked: false,
          quantity: qty,
        });
      });

      // Final pass: apply stock transfer moves (authoritative)
      applyStockTransferMoves();

      // Safety: remove any sold serial that might have slipped in (e.g. key format mismatch)
      const keysToRemove: string[] = [];
      serialAvailableByKey.forEach((_, key) => {
        const parts = key.split('|');
        const pid = parts[0] || '';
        const sn = parts.slice(1).join('|') || '';
        if (soldSerials.has(soldKey(pid, sn))) keysToRemove.push(key);
      });
      keysToRemove.forEach(k => serialAvailableByKey.delete(k));
      if (keysToRemove.length > 0) {
        console.log('🚫 Removed sold serials from available stock (safety pass):', keysToRemove.length);
      }

      const uniqueSerialAvailable: AvailableStockItem[] = Array.from(serialAvailableByKey.values()).map(v => v.item);

      const totalAvailable = [...uniqueSerialAvailable, ...nonSerialAvailable];
      
      // Log detailed information about stock by location and company
      const stockByLocationAndCompany = new Map<string, any[]>();
      totalAvailable.forEach(item => {
        const key = `${item.location}|${item.businessCompany || 'No Company'}`;
        if (!stockByLocationAndCompany.has(key)) {
          stockByLocationAndCompany.set(key, []);
        }
        stockByLocationAndCompany.get(key)!.push(item);
      });
      
      console.log('📦 Available stock summary:', {
        serialItems: uniqueSerialAvailable.length,
        nonSerialItems: nonSerialAvailable.length,
        totalItems: totalAvailable.length,
        // We now de-duplicate via a map keyed by productId|serial, so "duplicates removed"
        // isn't tracked as an array diff anymore.
        duplicatesRemoved: 0,
        byLocation: totalAvailable.reduce((acc, item) => {
          const centerName = getCenterName(item.location);
          acc[centerName] = (acc[centerName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      });

      console.log('📍 Stock by Location & Company:');
      stockByLocationAndCompany.forEach((items, key) => {
        const [location, company] = key.split('|');
        console.log(`  ${getCenterName(location)} (${company}): ${items.length} items`, {
          serialTracked: items.filter(i => i.isSerialTracked).length,
          nonSerial: items.filter(i => !i.isSerialTracked).length,
          sampleProducts: items.slice(0, 3).map(i => ({
            name: i.name,
            serial: i.serialNumber || `Qty: ${i.quantity}`,
            company: i.businessCompany
          }))
        });
      });
      
      setAvailableStock(totalAvailable);
      setStockLoading(false);
    } catch (error) {
      console.error('Error building available stock:', error);
      setStockLoading(false);
      setErrorMsg('Failed to load available stock');
    }
  };

  const filterTransfers = () => {
    let filtered = [...transfers];

    if (searchTerm) {
      filtered = filtered.filter(transfer =>
        transfer.transferNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transfer.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCenterName(transfer.fromBranch).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getCenterName(transfer.toBranch).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(transfer => {
        const transferDate = new Date(transfer.transferDate.seconds * 1000);
        return transferDate.toDateString() === filterDate.toDateString();
      });
    }

    setFilteredTransfers(filtered);
  };

  const getCenterName = (centerId: string) => {
    const center = centers.find(c => c.id === centerId);
    return center?.name || 'Unknown Center';
  };

  const fromCenterOptions = useMemo(() => {
    if (!currentTransfer) return centers;
    
    return centers.filter(center => {
      if (currentTransfer.transferType === 'intracompany') {
        return currentTransfer.company ? 
          (center.companies && center.companies.includes(currentTransfer.company)) : true;
      } else {
        return currentTransfer.fromCompany ? 
          (center.companies && center.companies.includes(currentTransfer.fromCompany)) : true;
      }
    });
  }, [centers, currentTransfer?.transferType, currentTransfer?.company, currentTransfer?.fromCompany]);

  const toCenterOptions = useMemo(() => {
    if (!currentTransfer) return centers;
    
    return centers.filter(center => {
      if (currentTransfer.transferType === 'intracompany') {
        return currentTransfer.company ? 
          (center.companies && center.companies.includes(currentTransfer.company)) : true;
      } else {
        return currentTransfer.toCompany ? 
          (center.companies && center.companies.includes(currentTransfer.toCompany)) : true;
      }
    });
  }, [centers, currentTransfer?.transferType, currentTransfer?.company, currentTransfer?.toCompany]);

  const filteredAvailableStock = useMemo(() => {
    if (!currentTransfer?.fromBranch) return [];
    
    let filtered = availableStock.filter(item => item.location === currentTransfer.fromBranch);
    
    // Filter by company if applicable
    if (currentTransfer.transferType === 'intracompany' && currentTransfer.company) {
      filtered = filtered.filter(item => 
        item.businessCompany === currentTransfer.company || !item.businessCompany
      );
    } else if (currentTransfer.transferType === 'intercompany' && currentTransfer.fromCompany) {
      filtered = filtered.filter(item => 
        item.businessCompany === currentTransfer.fromCompany || !item.businessCompany
      );
    }
    
    console.log(`📦 Filtered stock at ${getCenterName(currentTransfer.fromBranch)}: ${filtered.length} items`);
    
    return filtered;
  }, [availableStock, currentTransfer?.fromBranch, currentTransfer?.transferType, currentTransfer?.company, currentTransfer?.fromCompany]);

  const selectableProducts = useMemo<SelectableStockProduct[]>(() => {
    if (!filteredAvailableStock.length) return [];
    const out: SelectableStockProduct[] = [];
    const serialGroups = new Map<string, SelectableStockProduct>();
    const qtyGroups = new Map<string, SelectableStockProduct>();

    for (const item of filteredAvailableStock) {
      if (item.isSerialTracked) {
        const key = `${item.productId}|${item.businessCompany || ''}|${item.location}`;
        const existing = serialGroups.get(key);
        const sn = item.serialNumber ? String(item.serialNumber).trim() : '';
        if (!existing) {
          serialGroups.set(key, {
            productId: item.productId,
            name: item.name,
            type: item.type,
            company: item.company,
            businessCompany: item.businessCompany,
            location: item.location,
            isSerialTracked: true,
            serialNumbers: sn ? [sn] : [],
          });
        } else if (sn) {
          const combined = [...(existing.serialNumbers || []), sn];
          existing.serialNumbers = Array.from(new Set(combined)).sort((a, b) => a.localeCompare(b));
        }
      } else {
        const key = `${item.productId}|${item.businessCompany || ''}|${item.location}`;
        const existing = qtyGroups.get(key);
        if (!existing) {
          qtyGroups.set(key, {
            productId: item.productId,
            name: item.name,
            type: item.type,
            company: item.company,
            businessCompany: item.businessCompany,
            location: item.location,
            isSerialTracked: false,
            quantity: item.quantity || 0,
          });
        } else {
          existing.quantity = (existing.quantity || 0) + (item.quantity || 0);
        }
      }
    }

    serialGroups.forEach(v => {
      v.serialNumbers = (v.serialNumbers || []).length ? (v.serialNumbers || []).sort((a, b) => a.localeCompare(b)) : [];
      out.push(v);
    });
    qtyGroups.forEach(v => out.push(v));
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [filteredAvailableStock]);

  const handleAddTransfer = async () => {
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 900) + 100;
    const transferNumber = `TR-${dateString}-${randomNum}`;
    
    const defaultCompany = companies.length === 1 ? companies[0].name : undefined;
    
    setCurrentTransfer({
      ...emptyTransfer,
      transferNumber,
      transferType: 'intracompany',
      company: defaultCompany,
    });
    
    setSelectedProduct(null);
    setSelectedSerials([]);
    setSelectedQuantity(1);
    
    await fetchAvailableStock();
    
    setOpenDialog(true);
  };

  const handleEditTransfer = async (transfer: StockTransfer) => {
    setCurrentTransfer(transfer);
    setOpenDialog(true);
    await fetchAvailableStock();
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this stock transfer?')) return;
    
    try {
      await deleteDoc(doc(db, 'stockTransfers', id));
      setTransfers(prevTransfers => prevTransfers.filter(transfer => transfer.id !== id));
      setSuccessMsg('Stock transfer deleted successfully');
    } catch (error) {
      console.error('Error deleting stock transfer:', error);
      setErrorMsg('Failed to delete stock transfer');
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentTransfer(null);
    setAvailableStock([]);
  };

  const handleAddProductToTransfer = () => {
    if (!selectedProduct || !currentTransfer) return;
    
    if (selectedProduct.isSerialTracked && selectedSerials.length === 0) {
      setErrorMsg('Please select at least one serial number');
      return;
    }
    
    if (!selectedProduct.isSerialTracked && selectedQuantity <= 0) {
      setErrorMsg('Please enter a valid quantity');
      return;
    }

    const newProduct: StockTransferProduct = {
      productId: selectedProduct.productId,
      name: selectedProduct.name,
      serialNumbers: selectedProduct.isSerialTracked ? selectedSerials : [],
      quantity: selectedProduct.isSerialTracked ? selectedSerials.length : selectedQuantity,
    };

    setCurrentTransfer({
      ...currentTransfer,
      products: [...currentTransfer.products, newProduct],
    });

    setSelectedProduct(null);
    setSelectedSerials([]);
    setSelectedQuantity(1);
  };

  const handleRemoveProductFromTransfer = (index: number) => {
    if (!currentTransfer) return;
    
    const newProducts = [...currentTransfer.products];
    newProducts.splice(index, 1);
    
    setCurrentTransfer({
      ...currentTransfer,
      products: newProducts,
    });
  };

  // Create inventory movements for stock transfer (Material Out + Material In)
  const createInventoryMovements = async (transfer: StockTransfer) => {
    try {
      const now = new Date();
      const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomNum = Math.floor(Math.random() * 900) + 100;

      console.log('🔄 Creating inventory movements for transfer:', transfer.transferNumber);

      // Get product details from products collection and existing stock info
      const [productsSnap, materialInSnap, purchasesSnap] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'materialInward')),
        getDocs(collection(db, 'purchases')),
      ]);

      const productById = new Map<string, any>();
      productsSnap.docs.forEach(d => productById.set(d.id, d.data()));

      // Helper to get original pricing and product info from source inventory
      const getOriginalProductInfo = (productId: string, serialNumbers: string[], fromLocation: string) => {
        let dealerPrice = 0;
        let mrp = 0;
        let type = '';

        // Get product type from products collection
        const productData = productById.get(productId) || {};
        type = productData.type || 'Unknown';

        // Search in materialInward for pricing
        for (const docSnap of materialInSnap.docs) {
          const data: any = docSnap.data();
          if (data.location === fromLocation) {
            const product = (data.products || []).find((p: any) => {
              const pid = p.productId || p.id;
              const serials = Array.isArray(p.serialNumbers) ? p.serialNumbers : [];
              return pid === productId && (
                serials.length === 0 || // Non-serial item
                serialNumbers.some(sn => serials.includes(sn)) // Serial match
              );
            });
            if (product) {
              dealerPrice = product.dealerPrice || product.finalPrice || 0;
              mrp = product.mrp || 0;
              break;
            }
          }
        }

        // If not found in materialInward, search in purchases
        if (dealerPrice === 0) {
          for (const docSnap of purchasesSnap.docs) {
            const data: any = docSnap.data();
            if (data.location === fromLocation) {
              const product = (data.products || []).find((p: any) => {
                const pid = p.productId || p.id;
                const serials = Array.isArray(p.serialNumbers) ? p.serialNumbers : [];
                return pid === productId && (
                  serials.length === 0 || // Non-serial item
                  serialNumbers.some(sn => serials.includes(sn)) // Serial match
                );
              });
              if (product) {
                dealerPrice = product.dealerPrice || product.finalPrice || 0;
                mrp = product.mrp || 0;
                break;
              }
            }
          }
        }

        // Fallback to product collection data
        if (dealerPrice === 0) {
          dealerPrice = productData.dealerPrice || 0;
          mrp = productData.mrp || 0;
        }

        return { dealerPrice, mrp, type };
      };

      // Enhance products with type and pricing information from source inventory
      const enhancedProducts = transfer.products.map(product => {
        const originalInfo = getOriginalProductInfo(
          product.productId, 
          product.serialNumbers, 
          transfer.fromBranch
        );
        
        console.log(`📦 Product: ${product.name}`, {
          productId: product.productId,
          serialNumbers: product.serialNumbers,
          quantity: product.quantity,
          dealerPrice: originalInfo.dealerPrice,
          mrp: originalInfo.mrp,
          type: originalInfo.type
        });

        return {
          productId: product.productId,
          id: product.productId, // Add id for compatibility
          name: product.name,
          type: originalInfo.type,
          serialNumbers: product.serialNumbers,
          quantity: product.quantity,
          dealerPrice: originalInfo.dealerPrice,
          mrp: originalInfo.mrp,
          finalPrice: originalInfo.dealerPrice,
          gstApplicable: false,
          quantityType: 'piece'
        };
      });

      // Determine the company for material out (from source)
      const fromCompany = transfer.transferType === 'intercompany' 
        ? (transfer.fromCompany || 'Hope Enterprises')
        : (transfer.company || 'Hope Enterprises');
      
      // Create Material Out entry (from source location)
      const materialOutData = {
        challanNumber: `ST-OUT-${dateString}-${randomNum}`,
        recipient: { 
          id: 'stock-transfer', 
          name: `Stock Transfer to ${getCenterName(transfer.toBranch)}` 
        },
        company: fromCompany,
        location: transfer.fromBranch,
        products: enhancedProducts,
        totalAmount: enhancedProducts.reduce((sum, product) => sum + ((product.dealerPrice || 0) * product.quantity), 0),
        status: 'dispatched',
        reason: `Stock Transfer: ${transfer.reason} (Transfer #${transfer.transferNumber})`,
        dispatchDate: transfer.transferDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notes: `${transfer.transferType === 'intercompany' ? 'Intercompany' : 'Intracompany'} Stock Transfer`
      };

      // Determine the company for material in (to destination)
      const toCompany = transfer.transferType === 'intercompany' 
        ? (transfer.toCompany || 'Hope Enterprises')
        : (transfer.company || 'Hope Enterprises');
      
      // Create Material In entry (to destination location)
      const materialInData = {
        challanNumber: `ST-IN-${dateString}-${randomNum}`,
        supplier: { 
          id: 'stock-transfer', 
          name: `Stock Transfer from ${getCenterName(transfer.fromBranch)}` 
        },
        company: toCompany,
        location: transfer.toBranch,
        products: enhancedProducts,
        totalAmount: enhancedProducts.reduce((sum, product) => sum + ((product.dealerPrice || 0) * product.quantity), 0),
        status: 'received',
        receivedDate: transfer.transferDate,
        notes: `Stock Transfer: ${transfer.reason} (Transfer #${transfer.transferNumber}) - ${transfer.transferType === 'intercompany' ? 'Intercompany' : 'Intracompany'}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('📤 Material Out Data:', {
        challanNumber: materialOutData.challanNumber,
        company: materialOutData.company,
        location: materialOutData.location,
        productsCount: materialOutData.products.length,
        totalAmount: materialOutData.totalAmount
      });

      console.log('📥 Material In Data:', {
        challanNumber: materialInData.challanNumber,
        company: materialInData.company,
        location: materialInData.location,
        productsCount: materialInData.products.length,
        totalAmount: materialInData.totalAmount
      });

      // Create both entries
      const [materialOutDoc, materialInDoc] = await Promise.all([
        addDoc(collection(db, 'materialsOut'), materialOutData),
        addDoc(collection(db, 'materialInward'), materialInData)
      ]);

      console.log('✅ Inventory movements created successfully:', {
        materialOutId: materialOutDoc.id,
        materialInId: materialInDoc.id,
        transferNumber: transfer.transferNumber
      });

      // Verify the documents were actually created
      console.log('🔍 Verifying documents in Firebase...');
      const verifyMaterialOut = await getDocs(query(
        collection(db, 'materialsOut'),
        where('challanNumber', '==', materialOutData.challanNumber)
      ));
      const verifyMaterialIn = await getDocs(query(
        collection(db, 'materialInward'),
        where('challanNumber', '==', materialInData.challanNumber)
      ));

      console.log('✓ Verification Results:', {
        materialOutExists: !verifyMaterialOut.empty,
        materialOutCount: verifyMaterialOut.size,
        materialInExists: !verifyMaterialIn.empty,
        materialInCount: verifyMaterialIn.size
      });

      if (verifyMaterialOut.empty || verifyMaterialIn.empty) {
        console.error('❌ WARNING: Documents were not properly saved to Firebase!');
        throw new Error('Inventory movements were not saved properly. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error creating inventory movements:', error);
      throw error;
    }
  };

  const handleSaveTransfer = async () => {
    if (!currentTransfer) return;
    
    if (!currentTransfer.transferNumber || !currentTransfer.fromBranch || !currentTransfer.toBranch || !currentTransfer.reason) {
      setErrorMsg('Please fill all required fields');
      return;
    }
    
    if (currentTransfer.fromBranch === currentTransfer.toBranch) {
      setErrorMsg('Source and destination branches cannot be the same');
      return;
    }
    if (!currentTransfer.products || currentTransfer.products.length === 0) {
      setErrorMsg('Please add at least one product to transfer');
      return;
    }
    
    try {
      if (currentTransfer.id) {
        const updateData: any = {
          ...currentTransfer,
          updatedAt: serverTimestamp(),
        };
        
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });
        
        const transferRef = doc(db, 'stockTransfers', currentTransfer.id);
        await updateDoc(transferRef, updateData);
        
        setTransfers(prevTransfers => 
          prevTransfers.map(transfer => 
            transfer.id === currentTransfer.id ? {...currentTransfer, updatedAt: Timestamp.now()} : transfer
          )
        );
        
        setSuccessMsg('Stock transfer updated successfully');
      } else {
        const newTransferData: any = {
          ...currentTransfer,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        
        Object.keys(newTransferData).forEach(key => {
          if (newTransferData[key] === undefined) {
            delete newTransferData[key];
          }
        });
        
        const docRef = await addDoc(collection(db, 'stockTransfers'), newTransferData);
        
        const newTransfer = {
          ...currentTransfer,
          id: docRef.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };
        
        // Create inventory movements (material out from source, material in to destination)
        await createInventoryMovements(newTransfer);
        
        setTransfers(prevTransfers => [newTransfer, ...prevTransfers]);
        
        // Refresh available stock to reflect the changes
        await fetchAvailableStock();
        
        setSuccessMsg('Stock transfer added successfully and inventory updated');
      }
      
      setOpenDialog(false);
      setAvailableStock([]);
    } catch (error) {
      console.error('Error saving stock transfer:', error);
      setErrorMsg('Failed to save stock transfer');
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCloseSnackbar = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  const formatDate = (timestamp: Timestamp) => {
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const calculateTotalProducts = (transfer: StockTransfer) => {
    return transfer.products.reduce((total, product) => total + product.quantity, 0);
  };

  if (authLoading || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: 2, 
            bgcolor: 'primary.50',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TransferIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight="bold" color="primary">
              Stock Transfer Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Transfer inventory between centers and companies
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Transfers
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="primary.main">
                    {transfers.length}
                  </Typography>
                </Box>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'primary.50',
                }}>
                  <SummarizeIcon sx={{ fontSize: 28, color: 'primary.main' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Intracompany
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="info.main">
                    {transfers.filter(t => t.transferType === 'intracompany').length}
                  </Typography>
                </Box>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'info.50',
                }}>
                  <StoreIcon sx={{ fontSize: 28, color: 'info.main' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Intercompany
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="secondary.main">
                    {transfers.filter(t => t.transferType === 'intercompany').length}
                  </Typography>
                </Box>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'secondary.50',
                }}>
                  <BusinessIcon sx={{ fontSize: 28, color: 'secondary.main' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Items Transferred
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {transfers.reduce((sum, t) => sum + calculateTotalProducts(t), 0)}
                  </Typography>
                </Box>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  bgcolor: 'success.50',
                }}>
                  <InventoryIcon sx={{ fontSize: 28, color: 'success.main' }} />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Filters and Actions */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
          <Box display="flex" gap={2} flexWrap="wrap" flex={1}>
            <TextField
              placeholder="Search transfers..."
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 250 }}
            />
            
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Filter by date"
                value={dateFilter}
                onChange={(newValue) => setDateFilter(newValue)}
                slotProps={{ 
                  textField: { 
                    size: 'small',
                    sx: { minWidth: 180 }
                  } 
                }}
              />
            </LocalizationProvider>
            
            {(searchTerm || dateFilter) && (
              <Tooltip title="Clear Filters">
                <IconButton 
                  size="small"
                  onClick={() => {
                    setSearchTerm('');
                    setDateFilter(null);
                  }}
                  sx={{ border: '1px solid', borderColor: 'divider' }}
                >
                  <ClearIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddTransfer}
            size="large"
            sx={{ minWidth: 180 }}
          >
            New Transfer
          </Button>
        </Box>
      </Paper>
      
      {/* Transfers Table */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'grey.50' }}>
              <TableRow>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Transfer #</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell><strong>From</strong></TableCell>
                <TableCell><strong>To</strong></TableCell>
                <TableCell><strong>Products</strong></TableCell>
                <TableCell><strong>Reason</strong></TableCell>
                <TableCell align="right"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTransfers.length > 0 ? (
                filteredTransfers
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((transfer) => (
                    <TableRow 
                      key={transfer.id} 
                      hover 
                      sx={{ 
                        '&:hover': { 
                          bgcolor: 'action.hover' 
                        } 
                      }}
                    >
                      <TableCell>
                        <Chip 
                          icon={<ShippingIcon />}
                          label={formatDate(transfer.transferDate)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium" color="primary">
                          {transfer.transferNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={transfer.transferType === 'intracompany' ? 'Intracompany' : 'Intercompany'} 
                          size="small"
                          color={transfer.transferType === 'intracompany' ? 'info' : 'secondary'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {getCenterName(transfer.fromBranch)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {transfer.transferType === 'intracompany' 
                              ? transfer.company || 'N/A'
                              : transfer.fromCompany || 'N/A'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {getCenterName(transfer.toBranch)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {transfer.transferType === 'intracompany' 
                              ? transfer.company || 'N/A'
                              : transfer.toCompany || 'N/A'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={`${calculateTotalProducts(transfer)} items`} 
                          size="small" 
                          color="success" 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {transfer.reason}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View Details">
                          <IconButton 
                            size="small" 
                            color="info"
                            onClick={() => {
                              setPreviewTransfer(transfer);
                              setPreviewDialogOpen(true);
                            }}
                          >
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => handleEditTransfer(transfer)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {userProfile?.role === 'admin' && (
                          <Tooltip title="Delete">
                            <IconButton 
                              size="small" 
                              color="error" 
                              onClick={() => transfer.id && handleDeleteTransfer(transfer.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                      <Box sx={{ 
                        p: 3, 
                        borderRadius: '50%', 
                        bgcolor: 'grey.100',
                      }}>
                        <TransferIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                      </Box>
                      <Typography variant="h6" color="text.secondary">
                        No stock transfer records found
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Create your first transfer to get started
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredTransfers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
      
      {/* Transfer Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ 
          pb: 2, 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <TransferIcon sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  {currentTransfer?.id ? 'Edit Stock Transfer' : 'New Stock Transfer'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Transfer inventory between centers
                </Typography>
              </Box>
            </Box>
            <Chip 
              icon={<SummarizeIcon />} 
              label={currentTransfer?.transferNumber || 'New'} 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                fontWeight: 'bold'
              }} 
            />
          </Box>
        </DialogTitle>

        <DialogContent sx={{ mt: 2 }}>
          <Stack spacing={3}>
            {/* Transfer Type Selection */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold" color="primary">
                Transfer Type
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                <Button
                  fullWidth
                  variant={currentTransfer?.transferType === 'intracompany' ? 'contained' : 'outlined'}
                  startIcon={<StoreIcon />}
                  onClick={() => {
                    if (currentTransfer) {
                      setCurrentTransfer({
                        ...currentTransfer,
                        transferType: 'intracompany',
                        fromBranch: '',
                        toBranch: '',
                        fromCompany: undefined,
                        toCompany: undefined,
                        company: companies.length === 1 ? companies[0].name : undefined,
                      });
                    }
                  }}
                  sx={{ py: 1.5 }}
                >
                  Intracompany Transfer
                </Button>
                <Button
                  fullWidth
                  variant={currentTransfer?.transferType === 'intercompany' ? 'contained' : 'outlined'}
                  color="secondary"
                  startIcon={<BusinessIcon />}
                  onClick={() => {
                    if (currentTransfer) {
                      setCurrentTransfer({
                        ...currentTransfer,
                        transferType: 'intercompany',
                        fromBranch: '',
                        toBranch: '',
                        company: undefined,
                      });
                    }
                  }}
                  sx={{ py: 1.5 }}
                >
                  Intercompany Transfer
                </Button>
              </Stack>
            </Paper>

            {/* Basic Information */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Transfer Number"
                  value={currentTransfer?.transferNumber || ''}
                  onChange={(e) => setCurrentTransfer(prev => prev ? {...prev, transferNumber: e.target.value} : null)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SummarizeIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Reason for Transfer"
                  value={currentTransfer?.reason || ''}
                  onChange={(e) => setCurrentTransfer(prev => prev ? {...prev, reason: e.target.value} : null)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <InfoIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            {/* Company Selection */}
            {currentTransfer?.transferType === 'intracompany' && (
              <FormControl fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  value={currentTransfer?.company || ''}
                  onChange={(e) => setCurrentTransfer(prev => prev ? {...prev, company: e.target.value, fromBranch: '', toBranch: ''} : null)}
                  label="Company"
                  startAdornment={
                    <InputAdornment position="start">
                      <BusinessIcon color="action" />
                    </InputAdornment>
                  }
                >
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.name}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentTransfer?.transferType === 'intercompany' && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>From Company</InputLabel>
                    <Select
                      value={currentTransfer?.fromCompany || ''}
                      onChange={(e) => setCurrentTransfer(prev => prev ? {...prev, fromCompany: e.target.value, fromBranch: ''} : null)}
                      label="From Company"
                      startAdornment={
                        <InputAdornment position="start">
                          <BusinessIcon color="action" />
                        </InputAdornment>
                      }
                    >
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.name}>
                          {company.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>To Company</InputLabel>
                    <Select
                      value={currentTransfer?.toCompany || ''}
                      onChange={(e) => setCurrentTransfer(prev => prev ? {...prev, toCompany: e.target.value, toBranch: ''} : null)}
                      label="To Company"
                      startAdornment={
                        <InputAdornment position="start">
                          <BusinessIcon color="action" />
                        </InputAdornment>
                      }
                    >
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.name}>
                          {company.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            )}

            {/* Center Selection */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>From Center</InputLabel>
                  <Select
                    value={currentTransfer?.fromBranch || ''}
                    onChange={async (e) => {
                      setCurrentTransfer(prev => prev ? {...prev, fromBranch: e.target.value} : null);
                      await fetchAvailableStock();
                    }}
                    label="From Center"
                    startAdornment={
                      <InputAdornment position="start">
                        <LocationIcon color="action" />
                      </InputAdornment>
                    }
                  >
                    {fromCenterOptions.map((center) => (
                      <MenuItem key={center.id} value={center.id}>
                        {center.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>To Center</InputLabel>
                  <Select
                    value={currentTransfer?.toBranch || ''}
                    onChange={(e) => setCurrentTransfer(prev => prev ? {...prev, toBranch: e.target.value} : null)}
                    label="To Center"
                    startAdornment={
                      <InputAdornment position="start">
                        <LocationIcon color="action" />
                      </InputAdornment>
                    }
                  >
                    {toCenterOptions.map((center) => (
                      <MenuItem key={center.id} value={center.id}>
                        {center.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Divider />

            {/* Product Selection */}
            {currentTransfer?.fromBranch && (
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    <InventoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                    Available Stock
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Refresh Stock Data">
                      <IconButton 
                        size="small" 
                        onClick={() => fetchAvailableStock()}
                        disabled={stockLoading}
                        color="primary"
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                    <Badge badgeContent={filteredAvailableStock.length} color="primary" max={999}>
                      <Chip 
                        label={stockLoading ? 'Loading...' : `${filteredAvailableStock.length} items`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Badge>
                  </Stack>
                </Box>

                {stockLoading ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : selectableProducts.length === 0 ? (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    No available stock at {getCenterName(currentTransfer.fromBranch)}
                    {currentTransfer.transferType === 'intracompany' && currentTransfer.company ? ` for ${currentTransfer.company}` : ''}.
                    Items may be sold, transferred, or not yet received at this branch.
                  </Alert>
                ) : (
                  <>
                    <Autocomplete
                      value={selectedProduct}
                      onChange={(_, newValue) => {
                        setSelectedProduct(newValue);
                        setSelectedSerials([]);
                        setSelectedQuantity(1);
                      }}
                      options={selectableProducts}
                      getOptionLabel={(option) =>
                        `${option.name} ${option.isSerialTracked
                          ? `(${(option.serialNumbers || []).length} serials)`
                          : `(Qty: ${option.quantity || 0})`}`
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Product"
                          placeholder="Search products..."
                        />
                      )}
                      renderOption={(props, option) => (
                        <li {...props}>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {option.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" component="span" display="block">
                              {option.isSerialTracked
                                ? `Serial numbers: ${(option.serialNumbers || []).length > 0 ? (option.serialNumbers || []).join(', ') : '—'}`
                                : `Available: ${option.quantity || 0} units`
                              } • {getCenterName(option.location)}
                            </Typography>
                          </Box>
                        </li>
                      )}
                      fullWidth
                    />

                    {selectedProduct && selectedProduct.isSerialTracked && (
                      <>
                        <Autocomplete
                          multiple
                          value={selectedSerials}
                          onChange={(_, vals) => setSelectedSerials(vals)}
                          options={selectedProduct.serialNumbers || []}
                          getOptionLabel={(opt) => String(opt)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={`Select serial numbers (${(selectedProduct.serialNumbers || []).length} available)`}
                              placeholder="Choose one or more serials"
                              sx={{ mt: 2 }}
                            />
                          )}
                          renderOption={(props, option) => (
                            <li {...props}>
                              <Typography variant="body2">{option}</Typography>
                            </li>
                          )}
                        />
                        {(selectedProduct.serialNumbers || []).length === 0 && (
                          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                            No serial numbers available for this product at this location.
                          </Typography>
                        )}
                      </>
                    )}

                    {selectedProduct && !selectedProduct.isSerialTracked && (
                      <TextField
                        fullWidth
                        type="number"
                        label="Quantity"
                        value={selectedQuantity}
                        onChange={(e) => setSelectedQuantity(Math.max(1, Math.min(Number(e.target.value), selectedProduct.quantity || 1)))}
                        inputProps={{ min: 1, max: selectedProduct.quantity || 1 }}
                        sx={{ mt: 2 }}
                      />
                    )}

                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddProductToTransfer}
                      disabled={!selectedProduct}
                      sx={{ mt: 2 }}
                    >
                      Add to Transfer
                    </Button>
                  </>
                )}
              </Paper>
            )}

            {/* Selected Products List */}
            {currentTransfer && currentTransfer.products.length > 0 && (
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'success.main', borderRadius: 2, bgcolor: 'success.50' }}>
                <Typography variant="subtitle1" fontWeight="bold" color="success.dark" gutterBottom>
                  <CheckCircleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Products to Transfer ({currentTransfer.products.length})
                </Typography>
                <List>
                  {currentTransfer.products.map((product, index) => (
                    <ListItem
                      key={index}
                      secondaryAction={
                        <IconButton 
                          edge="end" 
                          onClick={() => handleRemoveProductFromTransfer(index)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                      sx={{ bgcolor: 'white', mb: 1, borderRadius: 1 }}
                    >
                      <ListItemIcon>
                        <InventoryIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={product.name}
                        secondary={product.serialNumbers.length > 0 
                          ? `Serial Numbers: ${product.serialNumbers.join(', ')}`
                          : `Quantity: ${product.quantity}`
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
          <Button onClick={handleCloseDialog} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveTransfer} 
            variant="contained" 
            startIcon={<CheckCircleIcon />}
            size="large"
          >
            {currentTransfer?.id ? 'Update' : 'Create'} Transfer
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Preview Dialog */}
      <Dialog 
        open={previewDialogOpen} 
        onClose={() => setPreviewDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ 
          pb: 2, 
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white'
        }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <InfoIcon sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight="bold">
                  Transfer Details
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {previewTransfer?.transferNumber}
                </Typography>
              </Box>
            </Box>
            <Chip 
              label={previewTransfer?.transferType === 'intracompany' ? 'Intracompany' : 'Intercompany'}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                fontWeight: 'bold'
              }} 
            />
          </Box>
        </DialogTitle>

        <DialogContent sx={{ mt: 2 }}>
          {previewTransfer && (
            <Stack spacing={3}>
              {/* Transfer Info */}
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Transfer Date
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {formatDate(previewTransfer.transferDate)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Transfer Type
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      {previewTransfer.transferType === 'intracompany' ? 'Intracompany' : 'Intercompany'}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Company Info */}
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                  <BusinessIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Company Information
                </Typography>
                <Divider sx={{ my: 1 }} />
                {previewTransfer.transferType === 'intracompany' ? (
                  <Typography variant="body2">
                    <strong>Company:</strong> {previewTransfer.company || 'N/A'}
                  </Typography>
                ) : (
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        From Company
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {previewTransfer.fromCompany || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        To Company
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {previewTransfer.toCompany || 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                )}
              </Paper>

              {/* Location Info */}
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                  <LocationIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Transfer Route
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ p: 2, bgcolor: 'error.50', borderRadius: 1 }}>
                      <Typography variant="caption" color="error.dark" fontWeight="bold">
                        FROM
                      </Typography>
                      <Typography variant="body1" fontWeight="bold" color="error.dark">
                        {getCenterName(previewTransfer.fromBranch)}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
                      <Typography variant="caption" color="success.dark" fontWeight="bold">
                        TO
                      </Typography>
                      <Typography variant="body1" fontWeight="bold" color="success.dark">
                        {getCenterName(previewTransfer.toBranch)}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* Reason */}
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                  Reason for Transfer
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {previewTransfer.reason}
                </Typography>
              </Paper>

              {/* Products List */}
              <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                  <InventoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Products ({previewTransfer.products.length})
                </Typography>
                <Divider sx={{ my: 1 }} />
                <List>
                  {previewTransfer.products.map((product, index) => (
                    <ListItem 
                      key={index}
                      sx={{ 
                        bgcolor: 'grey.50', 
                        mb: 1, 
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    >
                      <ListItemIcon>
                        <Chip 
                          label={index + 1} 
                          size="small" 
                          color="primary" 
                          sx={{ width: 32, height: 32, borderRadius: '50%' }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1" fontWeight="bold">
                            {product.name}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Quantity: <strong>{product.quantity}</strong>
                            </Typography>
                            {product.serialNumbers.length > 0 && (
                              <Typography variant="caption" color="info.main">
                                Serial Numbers: {product.serialNumbers.join(', ')}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
                
                {/* Total Summary */}
                <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                  <Typography variant="h6" fontWeight="bold" color="primary.main">
                    Total Items: {calculateTotalProducts(previewTransfer)}
                  </Typography>
                </Box>
              </Paper>
            </Stack>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
          <Button 
            onClick={() => setPreviewDialogOpen(false)} 
            variant="contained"
            startIcon={<CheckCircleIcon />}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error messages */}
      <Snackbar open={!!successMsg} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="success" variant="filled">
          {successMsg}
        </Alert>
      </Snackbar>
      
      <Snackbar open={!!errorMsg} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="error" variant="filled">
          {errorMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StockTransferPage;
