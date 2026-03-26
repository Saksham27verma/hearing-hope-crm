'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Grid,
  Divider,
  InputAdornment,
  Autocomplete,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Tooltip,
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  LocalHospital as DoctorIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  ShoppingCart as CartIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  Store as StoreIcon,
  Payment as PaymentIcon,
  Badge as BadgeIcon,
  Inventory as InventoryIcon,
  Notes as NotesIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import AsyncActionButton from '@/components/common/AsyncActionButton';
import RefreshDataButton from '@/components/common/RefreshDataButton';
import { useAuth } from '@/hooks/useAuth';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import PDFInvoiceGenerator from '@/components/invoices/PDFInvoiceGenerator';
import { convertSaleToInvoiceData } from '@/services/invoiceService';
import SalesInvoicingCommandBar from '@/components/sales-invoicing/SalesInvoicingCommandBar';
import SalesInvoiceCommandPalette from '@/components/sales-invoicing/SalesInvoiceCommandPalette';
import SalesInvoiceFiltersPanel from '@/components/sales-invoicing/SalesInvoiceFiltersPanel';
import SalesInvoicesDataTable, { type SortKey } from '@/components/sales-invoicing/SalesInvoicesDataTable';
import InvoicePrintConfirmModal from '@/components/sales-invoicing/InvoicePrintConfirmModal';
import ManualLineItemsEditor from '@/components/sales-invoicing/ManualLineItemsEditor';
import { deriveEnquirySalesFromDocs } from '@/lib/sales-invoicing/enquiryDerivation';
import { buildUnifiedInvoiceRows } from '@/lib/sales-invoicing/mergeUnifiedRows';
import { filterUnifiedRows } from '@/lib/sales-invoicing/filterRows';
import { timestampToMs } from '@/lib/sales-invoicing/timestamps';
import type { DerivedEnquirySale, ManualLineItem, PaymentStatus, SaleRecord, UnifiedInvoiceRow } from '@/lib/sales-invoicing/types';
import { prefillSaleFromDerivedEnquiry } from '@/lib/sales-invoicing/enquiryPrefill';

// ─── Types ───

interface Product {
  id: string;
  name: string;
  type: string;
  company: string;
  mrp: number;
  dealerPrice?: number;
  quantityType?: 'piece' | 'pair';
  hasSerialNumber?: boolean;
  gstApplicable?: boolean;
  gstType?: 'CGST' | 'IGST';
  gstPercentage?: number;
  hsnCode?: string;
}

interface SaleProduct extends Product {
  serialNumber: string;
  sellingPrice: number;
  discount: number;
  discountPercent: number;
  gstPercent: number;
  gstAmount: number;
  totalWithGst: number;
}

interface Accessory {
  id: string;
  name: string;
  isFree: boolean;
  quantity: number;
  price: number;
}

interface Sale {
  id?: string;
  invoiceNumber?: string;
  patientId?: string;
  patientName: string;
  phone?: string;
  email?: string;
  address?: string;
  products: SaleProduct[];
  accessories: Accessory[];
  referenceDoctor?: { id?: string; name: string };
  salesperson: { id: string; name: string };
  totalAmount: number;
  gstAmount: number;
  gstPercentage: number;
  grandTotal: number;
  netProfit: number;
  branch: string;
  centerId?: string;
  paymentMethod?: string;
  notes?: string;
  saleDate: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  manualLineItems?: ManualLineItem[];
  paymentStatus?: PaymentStatus;
  dueDate?: Timestamp;
  source?: 'manual' | 'enquiry';
  enquiryId?: string;
  visitorId?: string;
  enquiryVisitIndex?: number;
}

interface Center {
  id: string;
  name: string;
  isHeadOffice?: boolean;
}

// ─── Constants ───

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'emi', label: 'EMI' },
  { value: 'mixed', label: 'Mixed' },
];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const formatDate = (timestamp: Timestamp) =>
  new Date(timestamp.seconds * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const generateInvoiceNumber = () => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${y}${m}${d}-${rand}`;
};

// ─── Section Header component ───

const SectionHeader = ({ icon, title, count, color = 'primary' }: { icon: React.ReactNode; title: string; count?: number; color?: string }) => {
  const theme = useTheme();
  const mainColor = color === 'primary' ? theme.palette.primary.main : color === 'success' ? theme.palette.success.main : color === 'warning' ? theme.palette.warning.main : color === 'info' ? theme.palette.info.main : theme.palette.primary.main;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(mainColor, 0.1), color: mainColor }}>
        {icon}
      </Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ color: mainColor }}>{title}</Typography>
      {count !== undefined && count > 0 && (
        <Chip label={count} size="small" sx={{ bgcolor: alpha(mainColor, 0.1), color: mainColor, fontWeight: 700, minWidth: 28 }} />
      )}
    </Box>
  );
};

// ─── Main Component ───

export default function SalesInvoicingPageInner() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isAdmin = userProfile?.role === 'admin';

  const [sales, setSales] = useState<Sale[]>([]);
  const [derivedEnquiryLines, setDerivedEnquiryLines] = useState<DerivedEnquirySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSale, setInvoiceSale] = useState<any | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<Date | null>(null);
  const [filterPaymentStatuses, setFilterPaymentStatuses] = useState<PaymentStatus[]>([]);
  const [filterSource, setFilterSource] = useState<'all' | 'manual' | 'enquiry'>('all');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printInvoiceData, setPrintInvoiceData] = useState<ReturnType<typeof convertSaleToInvoiceData> | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  // Product add form state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductSerialPrimary, setSelectedProductSerialPrimary] = useState('');
  const [selectedProductSerialSecondary, setSelectedProductSerialSecondary] = useState('');
  const [selectedPairSaleMode, setSelectedPairSaleMode] = useState<'single' | 'pair'>('pair');
  const [selectedProductDiscount, setSelectedProductDiscount] = useState<number>(0);
  const [selectedProductSellingPrice, setSelectedProductSellingPrice] = useState<number>(0);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const emptySale: Sale = {
    invoiceNumber: generateInvoiceNumber(),
    patientName: '',
    phone: '',
    email: '',
    address: '',
    products: [],
    accessories: [],
    referenceDoctor: { name: '' },
    salesperson: { id: '', name: '' },
    totalAmount: 0,
    gstAmount: 0,
    gstPercentage: 0,
    grandTotal: 0,
    netProfit: 0,
    branch: '',
    centerId: '',
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    notes: '',
    saleDate: Timestamp.now(),
    manualLineItems: [],
    source: 'manual',
  };

  // ─── Data loading ───

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetchSales();
    fetchProducts();
    fetchCenters();
    fetchDerivedEnquiryLines();
  }, [user, authLoading, router]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'sales'), orderBy('saleDate', 'desc')));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Sale[];
      setSales(data);
    } catch (e) {
      console.error('Error fetching sales:', e);
      setErrorMsg('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const snap = await getDocs(collection(db, 'products'));
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]);
    } catch (e) { console.error('Error fetching products:', e); }
  };

  const fetchCenters = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'centers'), orderBy('name')));
      setCenters(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Center[]);
    } catch (e) { console.error('Error fetching centers:', e); }
  };

  const fetchDerivedEnquiryLines = async () => {
    try {
      const [visitorSnap, enquirySnap] = await Promise.all([
        getDocs(collection(db, 'visitors')),
        getDocs(collection(db, 'enquiries')),
      ]);
      const vList = visitorSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const eList = enquirySnap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));
      const fromVisitors = deriveEnquirySalesFromDocs(vList, 'visitor');
      const fromEnquiries = deriveEnquirySalesFromDocs(eList, 'enquiry');
      const uniq = new Map<string, DerivedEnquirySale>();
      [...fromVisitors, ...fromEnquiries].forEach((x) => uniq.set(x.id, x));
      setDerivedEnquiryLines(
        Array.from(uniq.values()).sort((a, b) => timestampToMs(b.visitDate) - timestampToMs(a.visitDate))
      );
    } catch (e) {
      console.error('Error fetching enquiry-derived sales:', e);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    try {
      setRefreshing(true);
      await Promise.all([
        fetchSales(),
        fetchProducts(),
        fetchCenters(),
        fetchDerivedEnquiryLines(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // ─── Totals (catalog products + manual lines) ───

  const recalcFull = (prods: SaleProduct[], manual: ManualLineItem[]) => {
    const productSub = prods.reduce((s, p) => s + p.sellingPrice, 0);
    const productGst = prods.reduce((s, p) => s + p.gstAmount, 0);
    let manualSub = 0;
    let manualGst = 0;
    manual.forEach((m) => {
      const line = m.quantity * m.rate;
      manualSub += line;
      manualGst += Math.round((line * (m.taxPercent || 0)) / 100);
    });
    const totalAmount = productSub + manualSub;
    const gstAmount = productGst + manualGst;
    const grandTotal = totalAmount + gstAmount;
    const netProfit = prods.reduce((s, p) => s + (p.sellingPrice - (p.dealerPrice || p.mrp * 0.7)), 0);
    return { totalAmount, gstAmount, grandTotal, netProfit, gstPercentage: 0 };
  };

  const buildSaleProduct = (product: Product, serialNumber: string, sellingPrice: number, discountPercent: number): SaleProduct => {
    const discount = Math.round((product.mrp * discountPercent) / 100);
    const gstPercent = product.gstApplicable !== false ? (product.gstPercentage || 0) : 0;
    const gstAmount = Math.round((sellingPrice * gstPercent) / 100);
    return {
      ...product,
      serialNumber,
      sellingPrice,
      discount,
      discountPercent,
      gstPercent,
      gstAmount,
      totalWithGst: sellingPrice + gstAmount,
    };
  };

  // Sync selling price with discount for the "add product" form
  useEffect(() => {
    if (selectedProduct) {
      const sp = selectedProduct.mrp - (selectedProduct.mrp * selectedProductDiscount) / 100;
      setSelectedProductSellingPrice(Math.round(sp));
    }
  }, [selectedProduct, selectedProductDiscount]);

  // ─── Sale CRUD ───

  const handleAddSale = () => {
    setCurrentSale({
      ...emptySale,
      salesperson: { id: user?.uid || '', name: userProfile?.displayName || user?.email || '' },
    });
    resetProductForm();
    setOpenDialog(true);
  };

  const handleEditSale = (sale: Sale) => {
    setCurrentSale({
      ...sale,
      manualLineItems: sale.manualLineItems || [],
      paymentStatus: sale.paymentStatus || 'paid',
      source: sale.source || 'manual',
    });
    resetProductForm();
    setOpenDialog(true);
  };

  const handleDeleteSale = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this sale?')) return;
    try {
      await deleteDoc(doc(db, 'sales', id));
      setSales((prev) => prev.filter((s) => s.id !== id));
      setSuccessMsg('Sale deleted successfully');
    } catch (e) {
      console.error('Error deleting sale:', e);
      setErrorMsg('Failed to delete sale');
    }
  };

  const handleSaveSale = async () => {
    if (!currentSale || savingSale) return;
    if (!currentSale.patientName.trim()) { setErrorMsg('Patient name is required'); return; }
    const hasLines = currentSale.products.length > 0 || (currentSale.manualLineItems && currentSale.manualLineItems.length > 0);
    if (!hasLines) { setErrorMsg('Add at least one catalog product or manual line item'); return; }

    try {
      setSavingSale(true);
      const saleToSave: Sale = {
        ...currentSale,
        salesperson: {
          id: user?.uid || currentSale.salesperson?.id || '',
          name: userProfile?.displayName || user?.email || currentSale.salesperson?.name || '',
        },
      };
      const { id, ...saveData } = saleToSave as any;
      if (currentSale.id) {
        await updateDoc(doc(db, 'sales', currentSale.id), { ...saveData, updatedAt: serverTimestamp() });
        setSales((prev) => prev.map((s) => (s.id === currentSale.id ? { ...saleToSave, updatedAt: Timestamp.now() } : s)));
        setSuccessMsg('Sale updated');
      } else {
        const docRef = await addDoc(collection(db, 'sales'), { ...saveData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        setSales((prev) => [{ ...saleToSave, id: docRef.id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }, ...prev]);
        setSuccessMsg('Sale created');
      }
      setOpenDialog(false);
      setCurrentSale(null);
    } catch (e) {
      console.error('Error saving sale:', e);
      setErrorMsg('Failed to save sale');
    } finally {
      setSavingSale(false);
    }
  };

  // ─── Product helpers ───

  const resetProductForm = () => {
    setSelectedProduct(null);
    setSelectedProductSerialPrimary('');
    setSelectedProductSerialSecondary('');
    setSelectedPairSaleMode('pair');
    setSelectedProductDiscount(0);
    setSelectedProductSellingPrice(0);
  };

  const filteredProductsForPicker = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(term) ||
      p.company.toLowerCase().includes(term) ||
      p.type.toLowerCase().includes(term) ||
      (p.hsnCode || '').toLowerCase().includes(term)
    );
  }, [products, productSearch]);

  const handlePickProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedProductDiscount(0);
    setSelectedProductSerialPrimary('');
    setSelectedProductSerialSecondary('');
    setSelectedPairSaleMode(product.quantityType === 'pair' ? 'pair' : 'single');
    setSelectedProductSellingPrice(product.mrp);
    setProductPickerOpen(false);
  };

  const handleAddProduct = () => {
    if (!selectedProduct || !currentSale) return;
    const serialOne = selectedProductSerialPrimary.trim();
    const serialTwo = selectedProductSerialSecondary.trim();

    if (selectedProduct.hasSerialNumber !== false) {
      if (!serialOne) {
        setErrorMsg('Please enter serial number');
        return;
      }
      if (selectedProduct.quantityType === 'pair' && selectedPairSaleMode === 'pair' && !serialTwo) {
        setErrorMsg('Please enter both serial numbers for pair sale');
        return;
      }
    }

    const finalSerial =
      selectedProduct.quantityType === 'pair' && selectedPairSaleMode === 'pair'
        ? `${serialOne}, ${serialTwo}`.trim()
        : serialOne;

    const sp = buildSaleProduct(selectedProduct, finalSerial, selectedProductSellingPrice, selectedProductDiscount);
    const updatedProducts = [...currentSale.products, sp];
    setCurrentSale({
      ...currentSale,
      products: updatedProducts,
      ...recalcFull(updatedProducts, currentSale.manualLineItems || []),
    });
    resetProductForm();
  };

  const handleRemoveProduct = (index: number) => {
    if (!currentSale) return;
    const updatedProducts = currentSale.products.filter((_, i) => i !== index);
    setCurrentSale({
      ...currentSale,
      products: updatedProducts,
      ...recalcFull(updatedProducts, currentSale.manualLineItems || []),
    });
  };

  const updateProductField = (index: number, field: string, value: any) => {
    if (!currentSale) return;
    const prods = [...currentSale.products];
    const p = { ...prods[index] };

    if (field === 'sellingPrice') {
      p.sellingPrice = value;
      p.discount = p.mrp - value;
      p.discountPercent = p.mrp > 0 ? Math.round(((p.mrp - value) / p.mrp) * 100) : 0;
      p.gstAmount = Math.round((p.sellingPrice * p.gstPercent) / 100);
      p.totalWithGst = p.sellingPrice + p.gstAmount;
    } else if (field === 'gstPercent') {
      p.gstPercent = value;
      p.gstAmount = Math.round((p.sellingPrice * value) / 100);
      p.totalWithGst = p.sellingPrice + p.gstAmount;
    } else {
      (p as any)[field] = value;
    }

    prods[index] = p;
    setCurrentSale({ ...currentSale, products: prods, ...recalcFull(prods, currentSale.manualLineItems || []) });
  };

  const updateSaleField = (field: string, value: any) => {
    if (!currentSale) return;
    setCurrentSale({ ...currentSale, [field]: value });
  };

  const unifiedRows = useMemo(
    () => buildUnifiedInvoiceRows(sales as SaleRecord[], derivedEnquiryLines),
    [sales, derivedEnquiryLines]
  );

  const filteredTableRows = useMemo(
    () =>
      filterUnifiedRows(unifiedRows, searchTerm, {
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        paymentStatuses: filterPaymentStatuses,
        source: filterSource,
      }),
    [unifiedRows, searchTerm, filterDateFrom, filterDateTo, filterPaymentStatuses, filterSource]
  );

  const sortedTableRows = useMemo(() => {
    const copy = [...filteredTableRows];
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmpStr = (a: string, b: string) => dir * a.localeCompare(b);
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'invoiceNumber':
          return cmpStr(String(a.invoiceNumber || '\uFFFF'), String(b.invoiceNumber || '\uFFFF'));
        case 'date':
          return dir * (timestampToMs(a.date as Timestamp) - timestampToMs(b.date as Timestamp));
        case 'client':
          return cmpStr(a.clientName.toLowerCase(), b.clientName.toLowerCase());
        case 'linked':
          return cmpStr(String(a.linkedEnquiryRef || ''), String(b.linkedEnquiryRef || ''));
        case 'total':
          return dir * (a.total - b.total);
        case 'status':
          return cmpStr(a.statusLabel, b.statusLabel);
        default:
          return 0;
      }
    });
    return copy;
  }, [filteredTableRows, sortKey, sortDir]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterDateFrom) n++;
    if (filterDateTo) n++;
    if (filterPaymentStatuses.length) n++;
    if (filterSource !== 'all') n++;
    return n;
  }, [filterDateFrom, filterDateTo, filterPaymentStatuses, filterSource]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey]
  );

  const openPrintFlow = useCallback((row: UnifiedInvoiceRow) => {
    const raw = row.kind === 'saved' ? row.savedSale : row.derivedEnquiry;
    if (!raw) return;
    setPrintInvoiceData(convertSaleToInvoiceData(raw));
    setPrintModalOpen(true);
  }, []);

  const openPreviewFlow = useCallback((row: UnifiedInvoiceRow) => {
    const raw = row.kind === 'saved' ? row.savedSale : row.derivedEnquiry;
    if (!raw) return;
    setInvoiceSale(raw);
    setInvoiceOpen(true);
  }, []);

  const handleCreateInvoiceFromEnquiryRow = useCallback(
    (row: UnifiedInvoiceRow) => {
      if (row.kind !== 'enquiry_pending' || !row.derivedEnquiry) return;
      const pre = prefillSaleFromDerivedEnquiry(row.derivedEnquiry, {
        invoiceNumber: generateInvoiceNumber(),
        salesperson: { id: user?.uid || '', name: userProfile?.displayName || user?.email || '' },
      });
      setCurrentSale({ ...(pre as unknown as Sale), accessories: [] });
      resetProductForm();
      setOpenDialog(true);
    },
    [user, userProfile]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterDateFrom(null);
    setFilterDateTo(null);
    setFilterPaymentStatuses([]);
    setFilterSource('all');
  }, []);

  // ─── Render ───

  if (authLoading || loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"><CircularProgress /></Box>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1440, mx: 'auto' }}>
        <Typography variant="h4" fontWeight={800} color="primary" sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
          Sales &amp; Invoicing
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Enquiry-linked and manual invoices in one place.
        </Typography>

        <SalesInvoicingCommandBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          onOpenFilters={() => setFiltersOpen(true)}
          onCreateInvoice={handleAddSale}
          filterCount={activeFilterCount}
        />

        <Box display="flex" justifyContent="flex-end" sx={{ mb: 2 }}>
          <RefreshDataButton onClick={handleRefresh} loading={refreshing} sx={{ borderRadius: 2, textTransform: 'none' }} />
        </Box>

        <SalesInvoicesDataTable
          rows={sortedTableRows}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onEditSaved={(row) => row.savedSale && handleEditSale(row.savedSale as Sale)}
          onDeleteSaved={handleDeleteSale}
          onPrint={openPrintFlow}
          onPreview={openPreviewFlow}
          onCreateFromEnquiry={handleCreateInvoiceFromEnquiryRow}
          isAdmin={!!isAdmin}
          highlightedRowId={highlightedRowId}
        />

        <SalesInvoiceCommandPalette
          open={paletteOpen}
          onClose={() => {
            setPaletteOpen(false);
            setPaletteQuery('');
          }}
          rows={unifiedRows}
          query={paletteQuery}
          onQueryChange={setPaletteQuery}
          onSelectRow={(r) => setHighlightedRowId(r.rowId)}
        />

        <SalesInvoiceFiltersPanel
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          dateFrom={filterDateFrom}
          dateTo={filterDateTo}
          onDateFrom={setFilterDateFrom}
          onDateTo={setFilterDateTo}
          paymentStatuses={filterPaymentStatuses}
          onPaymentStatuses={setFilterPaymentStatuses}
          source={filterSource}
          onSource={setFilterSource}
          onClear={clearAllFilters}
        />

        {printInvoiceData && (
          <InvoicePrintConfirmModal
            open={printModalOpen}
            onClose={() => {
              setPrintModalOpen(false);
              setPrintInvoiceData(null);
            }}
            invoiceData={printInvoiceData}
            userId={user?.uid}
          />
        )}

      {/* ════════════════════════ SALE DIALOG ════════════════════════ */}
      <Dialog open={openDialog} onClose={() => { setOpenDialog(false); setCurrentSale(null); }} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        {/* Dialog header with gradient */}
        <Box sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`, color: 'white', px: 3, py: 2.5 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h5" fontWeight={700}>{currentSale?.id ? 'Edit Sale' : 'Create New Sale'}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>Fill in the details to create a sale and generate an invoice</Typography>
            </Box>
            {currentSale?.invoiceNumber && (
              <Chip label={currentSale.invoiceNumber} size="medium" sx={{ fontFamily: 'monospace', bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, fontSize: '0.85rem' }} />
            )}
          </Box>
        </Box>

        <DialogContent sx={{ p: 3, bgcolor: 'grey.50' }}>
          {currentSale && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

              {/* ──── SECTION 1: Customer Details ──── */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <SectionHeader icon={<PersonIcon fontSize="small" />} title="Customer Details" />
                <Grid container spacing={2}>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
                    <TextField label="Customer / Patient Name" size="small" fullWidth required value={currentSale.patientName} onChange={(e) => updateSaleField('patientName', e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" color="action" /></InputAdornment> }} />
                  </Grid>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
                    <TextField label="Phone Number" size="small" fullWidth value={currentSale.phone || ''} onChange={(e) => updateSaleField('phone', e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><PhoneIcon fontSize="small" color="action" /></InputAdornment> }} />
                  </Grid>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
                    <TextField label="Email" size="small" fullWidth type="email" value={currentSale.email || ''} onChange={(e) => updateSaleField('email', e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon fontSize="small" color="action" /></InputAdornment> }} />
                  </Grid>
                  <Grid sx={{ gridColumn: 'span 12' }}>
                    <TextField label="Address" size="small" fullWidth multiline minRows={2} value={currentSale.address || ''} onChange={(e) => updateSaleField('address', e.target.value)} />
                  </Grid>
                </Grid>
              </Paper>

              {/* ──── SECTION 2: Sale Details ──── */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <SectionHeader icon={<ReceiptIcon fontSize="small" />} title="Sale Details" color="info" />
                <Grid container spacing={2}>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker label="Sale Date" value={new Date(currentSale.saleDate.seconds * 1000)} onChange={(d) => d && updateSaleField('saleDate', Timestamp.fromDate(d))} slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
                    </LocalizationProvider>
                  </Grid>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                    <Autocomplete options={centers} getOptionLabel={(o) => o.name} value={centers.find((c) => c.id === currentSale.centerId) || null} onChange={(_, v) => { updateSaleField('centerId', v?.id || ''); updateSaleField('branch', v?.name || ''); }} renderInput={(params) => <TextField {...params} label="Center / Branch" size="small" fullWidth />} />
                  </Grid>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Method</InputLabel>
                      <Select value={currentSale.paymentMethod || 'cash'} label="Payment Method" onChange={(e) => updateSaleField('paymentMethod', e.target.value)}>
                        {PAYMENT_METHODS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
                    <TextField label="Doctor Referral" size="small" fullWidth value={currentSale.referenceDoctor?.name || ''} onChange={(e) => updateSaleField('referenceDoctor', { ...currentSale.referenceDoctor, name: e.target.value })} InputProps={{ startAdornment: <InputAdornment position="start"><DoctorIcon fontSize="small" color="action" /></InputAdornment> }} />
                  </Grid>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
                    <TextField label="Invoice Number" size="small" fullWidth value={currentSale.invoiceNumber || ''} onChange={(e) => updateSaleField('invoiceNumber', e.target.value)} InputProps={{ sx: { fontFamily: 'monospace' } }} />
                  </Grid>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment status</InputLabel>
                      <Select
                        value={currentSale.paymentStatus || 'paid'}
                        label="Payment status"
                        onChange={(e) => updateSaleField('paymentStatus', e.target.value)}
                      >
                        <MenuItem value="paid">Paid</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="overdue">Overdue</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 4' } }}>
                    <DatePicker
                      label="Due date"
                      value={currentSale.dueDate ? new Date(currentSale.dueDate.seconds * 1000) : null}
                      onChange={(d) => updateSaleField('dueDate', d ? Timestamp.fromDate(d) : undefined)}
                      slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                    />
                  </Grid>
                </Grid>
              </Paper>

              {/* ──── SECTION 3: Products ──── */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <SectionHeader icon={<InventoryIcon fontSize="small" />} title="Products / Hearing Aids" count={currentSale.products.length} color="success" />

                {/* Add product card */}
                <Box sx={{ bgcolor: alpha(theme.palette.success.main, 0.04), p: 2.5, borderRadius: 2, border: '2px dashed', borderColor: alpha(theme.palette.success.main, 0.3), mb: 2.5 }}>
                  <Typography variant="body2" fontWeight={600} color="success.dark" mb={2}>Add a Product</Typography>
                  <Grid container spacing={2} alignItems="flex-end">
                    <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 5' } }}>
                      <TextField
                        label="Select Product"
                        size="medium"
                        fullWidth
                        value={selectedProduct ? `${selectedProduct.name} (${selectedProduct.company})` : ''}
                        placeholder="Open product list and select"
                        InputProps={{ readOnly: true }}
                        sx={{
                          '& .MuiInputBase-root': { borderRadius: 2 },
                          '& .MuiOutlinedInput-input': { py: 1.25 },
                        }}
                      />
                    </Grid>
                    <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 1' } }}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={() => setProductPickerOpen(true)}
                        startIcon={<OpenInNewIcon />}
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
                      >
                        Browse
                      </Button>
                    </Grid>
                    <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 2.5' } }}>
                      {selectedProduct?.quantityType === 'pair' ? (
                        <Stack spacing={1}>
                          <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={selectedPairSaleMode}
                            onChange={(_, value) => {
                              if (value) setSelectedPairSaleMode(value);
                            }}
                            fullWidth
                          >
                            <ToggleButton value="single">Sell 1 device</ToggleButton>
                            <ToggleButton value="pair">Sell both</ToggleButton>
                          </ToggleButtonGroup>
                          <TextField
                            label={selectedPairSaleMode === 'pair' ? 'Serial 1 (Left/Right)' : 'Serial Number'}
                            size="small"
                            fullWidth
                            value={selectedProductSerialPrimary}
                            onChange={(e) => setSelectedProductSerialPrimary(e.target.value)}
                            placeholder="S/N 1"
                          />
                          {selectedPairSaleMode === 'pair' && (
                            <TextField
                              label="Serial 2 (Right/Left)"
                              size="small"
                              fullWidth
                              value={selectedProductSerialSecondary}
                              onChange={(e) => setSelectedProductSerialSecondary(e.target.value)}
                              placeholder="S/N 2"
                            />
                          )}
                        </Stack>
                      ) : (
                        <TextField
                          label="Serial Number"
                          size="small"
                          fullWidth
                          value={selectedProductSerialPrimary}
                          onChange={(e) => setSelectedProductSerialPrimary(e.target.value)}
                          placeholder="S/N"
                        />
                      )}
                    </Grid>
                    <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 3', md: 'span 1.5' } }}>
                      <TextField label="Disc %" size="small" fullWidth type="number" value={selectedProductDiscount} onChange={(e) => setSelectedProductDiscount(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                    </Grid>
                    <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 3', md: 'span 2' } }}>
                      <TextField label="Selling Price" size="small" fullWidth type="number" value={selectedProductSellingPrice}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          setSelectedProductSellingPrice(v);
                          if (selectedProduct && selectedProduct.mrp > 0) setSelectedProductDiscount(Math.round(((selectedProduct.mrp - v) / selectedProduct.mrp) * 100));
                        }}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                      />
                    </Grid>
                    <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 1.5' } }}>
                      <Button variant="contained" color="success" fullWidth onClick={handleAddProduct} disabled={!selectedProduct} startIcon={<AddIcon />} sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}>
                        Add
                      </Button>
                    </Grid>
                  </Grid>
                  {selectedProduct && (
                    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
                        <Typography variant="caption"><b>MRP:</b> {formatCurrency(selectedProduct.mrp)}</Typography>
                        <Typography variant="caption"><b>Type:</b> {selectedProduct.type}</Typography>
                        <Typography variant="caption"><b>Company:</b> {selectedProduct.company}</Typography>
                        {selectedProduct.quantityType === 'pair' && <Chip label="Pair" size="small" color="secondary" variant="outlined" sx={{ height: 20 }} />}
                        {selectedProduct.gstApplicable !== false
                          ? <Chip label={`GST: ${selectedProduct.gstType || 'CGST'} @ ${selectedProduct.gstPercentage || 0}%`} size="small" color="info" variant="outlined" sx={{ height: 20 }} />
                          : <Chip label="GST Exempt" size="small" color="default" variant="outlined" sx={{ height: 20 }} />
                        }
                        {selectedProduct.hsnCode && <Typography variant="caption"><b>HSN:</b> {selectedProduct.hsnCode}</Typography>}
                      </Stack>
                      {selectedProduct.quantityType === 'pair' ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          This product is configured as <b>pair</b>. Choose <b>Sell both</b> to enter 2 serial numbers, or <b>Sell 1 device</b> for partial pair sales.
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          This product is configured as <b>piece</b>. Enter one serial number.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>

                {/* Products table */}
                {currentSale.products.length > 0 ? (
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Serial #</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>MRP</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Disc %</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Selling Price</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>GST</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                            <TableCell width={50}></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {currentSale.products.map((p, idx) => (
                            <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 }, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}>
                              <TableCell>
                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                  {idx + 1}
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                                <Stack direction="row" spacing={0.5} alignItems="center" mt={0.25}>
                                  <Typography variant="caption" color="text.secondary">{p.company} • {p.type}</Typography>
                                  {p.gstPercent > 0
                                    ? <Chip label={`${p.gstPercent}% GST`} size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                                    : <Chip label="No GST" size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                                  }
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <TextField size="small" variant="standard" placeholder="S/N" value={p.serialNumber || ''} onChange={(e) => updateProductField(idx, 'serialNumber', e.target.value)} sx={{ width: 120 }} />
                              </TableCell>
                              <TableCell align="right"><Typography variant="body2" color="text.secondary">{formatCurrency(p.mrp)}</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body2" color="text.secondary">{p.discountPercent}%</Typography></TableCell>
                              <TableCell align="right">
                                <TextField size="small" variant="standard" type="number" value={p.sellingPrice} onChange={(e) => updateProductField(idx, 'sellingPrice', Number(e.target.value) || 0)} sx={{ width: 90 }} InputProps={{ startAdornment: <InputAdornment position="start" sx={{ mr: 0 }}>₹</InputAdornment> }} />
                              </TableCell>
                              <TableCell align="right">
                                {p.gstPercent > 0 ? (
                                  <Tooltip title={`${p.gstPercent}% on ${formatCurrency(p.sellingPrice)}`}>
                                    <Typography variant="body2" color="info.main" fontWeight={500}>{formatCurrency(p.gstAmount)}</Typography>
                                  </Tooltip>
                                ) : (
                                  <Typography variant="caption" color="text.disabled">—</Typography>
                                )}
                              </TableCell>
                              <TableCell align="right"><Typography variant="body2" fontWeight={600}>{formatCurrency(p.totalWithGst)}</Typography></TableCell>
                              <TableCell>
                                <IconButton size="small" color="error" onClick={() => handleRemoveProduct(idx)}><DeleteIcon fontSize="small" /></IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <InventoryIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                    <Typography variant="body2">No catalog products yet. Add products above or use manual line items below.</Typography>
                  </Box>
                )}

                {currentSale.products.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                    GST is calculated per product based on product settings. Products marked as GST exempt will have no GST applied. You can edit the selling price inline.
                  </Typography>
                )}
              </Paper>

              {/* ──── Manual line items ──── */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <SectionHeader icon={<ReceiptIcon fontSize="small" />} title="Manual line items" color="info" />
                <ManualLineItemsEditor
                  items={currentSale.manualLineItems || []}
                  formatCurrency={formatCurrency}
                  onChange={(items) =>
                    setCurrentSale({
                      ...currentSale,
                      manualLineItems: items,
                      ...recalcFull(currentSale.products, items),
                    })
                  }
                />
              </Paper>

              {/* ──── SECTION 4: Invoice Summary ──── */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <SectionHeader icon={<CartIcon fontSize="small" />} title="Invoice Summary" color="warning" />

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Card variant="outlined" sx={{ flex: '1 1 160px', borderRadius: 2 }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="caption" color="text.secondary">Subtotal</Typography>
                      <Typography variant="h6" fontWeight={600}>{formatCurrency(currentSale.totalAmount)}</Typography>
                    </CardContent>
                  </Card>
                  <Card variant="outlined" sx={{ flex: '1 1 160px', borderRadius: 2, borderColor: 'info.light' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="caption" color="info.main">GST Amount</Typography>
                      <Typography variant="h6" fontWeight={600} color="info.main">{formatCurrency(currentSale.gstAmount)}</Typography>
                      {currentSale.products.length > 0 && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {currentSale.products.filter(p => p.gstPercent > 0).length} of {currentSale.products.length} items taxable
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                  <Card variant="outlined" sx={{ flex: '1 1 180px', borderRadius: 2, borderColor: 'success.light', bgcolor: alpha(theme.palette.success.main, 0.03) }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Typography variant="caption" color="success.main">Grand Total</Typography>
                      <Typography variant="h5" fontWeight={700} color="success.dark">{formatCurrency(currentSale.grandTotal)}</Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Paper>

              {/* ──── SECTION 5: Notes ──── */}
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <SectionHeader icon={<NotesIcon fontSize="small" />} title="Notes / Remarks" />
                <TextField fullWidth size="small" multiline minRows={2} placeholder="Add any additional notes about this sale..." value={currentSale.notes || ''} onChange={(e) => updateSaleField('notes', e.target.value)} />
              </Paper>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => { if (!savingSale) { setOpenDialog(false); setCurrentSale(null); } }} sx={{ textTransform: 'none' }} disabled={savingSale}>Cancel</Button>
          <AsyncActionButton
            variant="contained"
            onClick={handleSaveSale}
            disabled={
              !currentSale?.patientName?.trim() ||
              ((currentSale?.products?.length || 0) === 0 && (currentSale?.manualLineItems?.length || 0) === 0)
            }
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 4 }}
            startIcon={<ReceiptIcon />}
            loading={savingSale}
            loadingText={currentSale?.id ? 'Updating Sale...' : 'Saving Sale...'}
          >
            {currentSale?.id ? 'Update Sale' : 'Save Sale & Create Invoice'}
          </AsyncActionButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Select Product</DialogTitle>
        <DialogContent dividers>
          <TextField
            size="small"
            fullWidth
            placeholder="Search by name, company, type, or HSN..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TableContainer sx={{ maxHeight: 500, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">MRP</TableCell>
                  <TableCell align="center">GST</TableCell>
                  <TableCell>HSN</TableCell>
                  <TableCell align="center">Qty Type</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProductsForPicker.length > 0 ? (
                  filteredProductsForPicker.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                      </TableCell>
                      <TableCell>{p.company}</TableCell>
                      <TableCell>{p.type}</TableCell>
                      <TableCell align="right">{formatCurrency(p.mrp || 0)}</TableCell>
                      <TableCell align="center">
                        {p.gstApplicable !== false ? (
                          <Chip size="small" color="info" variant="outlined" label={`${p.gstType || 'CGST'} ${p.gstPercentage || 0}%`} />
                        ) : (
                          <Chip size="small" variant="outlined" label="Exempt" />
                        )}
                      </TableCell>
                      <TableCell>{p.hsnCode || '-'}</TableCell>
                      <TableCell align="center">{p.quantityType || 'piece'}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handlePickProduct(p)}
                        >
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      No products found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductPickerOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {invoiceSale && (
        <PDFInvoiceGenerator
          open={invoiceOpen}
          onClose={() => { setInvoiceOpen(false); setInvoiceSale(null); }}
          invoiceData={convertSaleToInvoiceData(invoiceSale)}
          template="modern"
        />
      )}

      <Snackbar open={!!successMsg} autoHideDuration={5000} onClose={() => setSuccessMsg('')}>
        <Alert onClose={() => setSuccessMsg('')} severity="success" variant="filled">{successMsg}</Alert>
      </Snackbar>
      <Snackbar open={!!errorMsg} autoHideDuration={5000} onClose={() => setErrorMsg('')}>
        <Alert onClose={() => setErrorMsg('')} severity="error" variant="filled">{errorMsg}</Alert>
      </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}
