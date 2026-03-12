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
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
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
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import PDFInvoiceGenerator from '@/components/invoices/PDFInvoiceGenerator';
import { convertSaleToInvoiceData } from '@/services/invoiceService';
import TemplateSelector from '@/components/invoices/TemplateSelector';

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

const SalesPage = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isAdmin = userProfile?.role === 'admin';

  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [enquirySales, setEnquirySales] = useState<any[]>([]);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceSale, setInvoiceSale] = useState<any | null>(null);
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplateData, setSelectedTemplateData] = useState<any>(null);
  const [salesPersons, setSalesPersons] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState<Date | null>(null);

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
    notes: '',
    saleDate: Timestamp.now(),
  };

  // ─── Data loading ───

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetchSales();
    fetchProducts();
    fetchCenters();
    fetchVisitors();
    fetchEnquirySales();
    fetchSalesPeople();
  }, [user, authLoading, router]);

  useEffect(() => {
    let filtered = [...sales];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.patientName.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q)) ||
          (s.invoiceNumber && s.invoiceNumber.toLowerCase().includes(q)) ||
          (s.referenceDoctor?.name && s.referenceDoctor.name.toLowerCase().includes(q))
      );
    }
    if (dateFilter) {
      filtered = filtered.filter((s) => {
        const d = new Date(s.saleDate.seconds * 1000);
        return d.getDate() === dateFilter.getDate() && d.getMonth() === dateFilter.getMonth() && d.getFullYear() === dateFilter.getFullYear();
      });
    }
    setFilteredSales(filtered);
  }, [sales, searchTerm, dateFilter]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'sales'), orderBy('saleDate', 'desc')));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Sale[];
      setSales(data);
      setFilteredSales(data);
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

  const fetchVisitors = async () => {
    try {
      const snap = await getDocs(collection(db, 'visitors'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      deriveEnquirySales(list, 'visitor');
    } catch (e) { console.error('Error fetching visitors:', e); }
  };

  const fetchEnquirySales = async () => {
    try {
      const snap = await getDocs(collection(db, 'enquiries'));
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      deriveEnquirySales(list, 'enquiry');
    } catch (e) { console.error('Error fetching enquiry sales:', e); }
  };

  const deriveEnquirySales = (docs: any[], source: 'visitor' | 'enquiry') => {
    const derived: any[] = [];
    docs.forEach((rec: any) => {
      const name = rec.name || rec.patientName || rec.fullName || 'Unknown';
      const phone = rec.phone || rec.mobile || '';
      const address = rec.address || rec.location || '';
      const visits: any[] = Array.isArray(rec.visits) ? rec.visits : [];
      visits.forEach((visit: any, idx: number) => {
        const isSale = !!(
          visit?.hearingAidSale ||
          (Array.isArray(visit?.medicalServices) && visit.medicalServices.includes('hearing_aid_sale')) ||
          visit?.journeyStage === 'sale' ||
          visit?.hearingAidStatus === 'sold' ||
          (Array.isArray(visit?.products) && visit.products.length > 0 && ((visit.salesAfterTax || 0) > 0 || (visit.grossSalesBeforeTax || 0) > 0))
        );
        if (!isSale) return;
        const prods: any[] = Array.isArray(visit.products) ? visit.products : [];
        const dateStr: string = visit.visitDate || visit.purchaseDate || visit.hearingAidPurchaseDate || '';
        const ts = dateStr ? Timestamp.fromDate(new Date(dateStr)) : rec.updatedAt || Timestamp.now();
        const totalAmount = prods.reduce((sum: number, p: any) => sum + (p.finalAmount || p.sellingPrice || 0), 0);
        derived.push({
          id: `${rec.id}-${idx}`,
          [source === 'visitor' ? 'visitorId' : 'enquiryId']: rec.id,
          patientName: name, visitIndex: idx, visitDate: ts, products: prods, totalAmount, phone, address,
        });
      });
    });
    derived.sort((a, b) => (b.visitDate?.seconds || 0) - (a.visitDate?.seconds || 0));
    setEnquirySales((prev) => {
      const merged = [...prev, ...derived];
      const uniq = new Map<string, any>();
      merged.forEach((x) => uniq.set(x.id, x));
      return Array.from(uniq.values()).sort((a, b) => (b.visitDate?.seconds || 0) - (a.visitDate?.seconds || 0));
    });
  };

  const fetchSalesPeople = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', 'in', ['admin', 'staff'])));
      setSalesPersons(snap.docs.map((d) => ({ id: d.id, name: d.data().displayName || d.data().email, ...d.data() })));
    } catch (e) { console.error('Error fetching salespeople:', e); }
  };

  // ─── Totals calculation (per-product GST) ───

  const recalcTotals = (prods: SaleProduct[]) => {
    const totalAmount = prods.reduce((s, p) => s + p.sellingPrice, 0);
    const gstAmount = prods.reduce((s, p) => s + p.gstAmount, 0);
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
    setCurrentSale(sale);
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
    if (!currentSale) return;
    if (!currentSale.patientName.trim()) { setErrorMsg('Patient name is required'); return; }
    if (currentSale.products.length === 0) { setErrorMsg('Add at least one product'); return; }

    try {
      const { id, ...saveData } = currentSale as any;
      if (currentSale.id) {
        await updateDoc(doc(db, 'sales', currentSale.id), { ...saveData, updatedAt: serverTimestamp() });
        setSales((prev) => prev.map((s) => (s.id === currentSale.id ? { ...currentSale, updatedAt: Timestamp.now() } : s)));
        setSuccessMsg('Sale updated');
      } else {
        const docRef = await addDoc(collection(db, 'sales'), { ...saveData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        setSales((prev) => [{ ...currentSale, id: docRef.id, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }, ...prev]);
        setSuccessMsg('Sale created');
      }
      setOpenDialog(false);
      setCurrentSale(null);
    } catch (e) {
      console.error('Error saving sale:', e);
      setErrorMsg('Failed to save sale');
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
    setCurrentSale({ ...currentSale, products: updatedProducts, ...recalcTotals(updatedProducts) });
    resetProductForm();
  };

  const handleRemoveProduct = (index: number) => {
    if (!currentSale) return;
    const updatedProducts = currentSale.products.filter((_, i) => i !== index);
    setCurrentSale({ ...currentSale, products: updatedProducts, ...recalcTotals(updatedProducts) });
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
    setCurrentSale({ ...currentSale, products: prods, ...recalcTotals(prods) });
  };

  const updateSaleField = (field: string, value: any) => {
    if (!currentSale) return;
    setCurrentSale({ ...currentSale, [field]: value });
  };

  // ─── Render ───

  if (authLoading || loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"><CircularProgress /></Box>;
  }

  return (
    <Box p={3}>
      <Typography variant="h4" fontWeight="bold" color="primary" mb={1}>Sales Management</Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>Track and manage all product sales transactions</Typography>

      {/* ── Enquiry Sales ── */}
      <Paper elevation={0} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Typography variant="h6">
            Sales from Enquiries
            {enquirySales.length > 0 && <Chip label={enquirySales.length} size="small" sx={{ ml: 1 }} />}
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Patient</TableCell><TableCell>Products</TableCell><TableCell align="right">Amount</TableCell><TableCell align="right">Invoice</TableCell></TableRow></TableHead>
            <TableBody>
              {enquirySales.length > 0 ? enquirySales.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{formatDate(s.visitDate)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{s.patientName}</Typography>
                    {s.phone && <Typography variant="caption" color="text.secondary">{s.phone}</Typography>}
                  </TableCell>
                  <TableCell>{s.products?.length > 0 ? <>{s.products[0].name}{s.products.length > 1 && ` +${s.products.length - 1}`}</> : '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(s.totalAmount || 0)}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => { setInvoiceSale(s); setTemplateSelectorOpen(true); }}><PrintIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>No sale records from enquiries</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Filters + New Sale button ── */}
      <Box mb={3} display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
        <Box display="flex" gap={2} flexWrap="wrap">
          <TextField placeholder="Search name, phone, invoice..." variant="outlined" size="small" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} sx={{ width: { xs: '100%', sm: 260 } }} />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker label="Filter by date" value={dateFilter} onChange={setDateFilter} slotProps={{ textField: { size: 'small', sx: { width: { xs: '100%', sm: 180 } } } }} />
          </LocalizationProvider>
          {dateFilter && <Button variant="outlined" size="small" onClick={() => setDateFilter(null)}>Clear</Button>}
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddSale} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}>New Sale</Button>
      </Box>

      {/* ── Sales Table ── */}
      <Paper elevation={0} variant="outlined" sx={{ borderRadius: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell><TableCell>Date</TableCell><TableCell>Patient</TableCell><TableCell>Products</TableCell><TableCell>Center</TableCell><TableCell align="right">Total</TableCell><TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSales.length > 0 ? filteredSales.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((sale) => (
                <TableRow key={sale.id} hover>
                  <TableCell><Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'monospace' }}>{sale.invoiceNumber || '—'}</Typography></TableCell>
                  <TableCell>{formatDate(sale.saleDate)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{sale.patientName}</Typography>
                    {sale.phone && <Typography variant="caption" color="text.secondary" display="block">{sale.phone}</Typography>}
                  </TableCell>
                  <TableCell>
                    {sale.products?.length > 0 ? (
                      <Box>
                        <Typography variant="body2">{sale.products[0].name}</Typography>
                        {sale.products.length > 1 && <Chip label={`+${sale.products.length - 1} more`} size="small" variant="outlined" sx={{ ml: 0.5, height: 20, fontSize: '0.7rem' }} />}
                      </Box>
                    ) : 'No products'}
                  </TableCell>
                  <TableCell>{sale.branch || '—'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{formatCurrency((sale.grandTotal || sale.totalAmount + (sale.gstAmount || 0)))}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" color="primary" onClick={() => handleEditSale(sale)}><EditIcon fontSize="small" /></IconButton>
                    {isAdmin && <IconButton size="small" color="error" onClick={() => sale.id && handleDeleteSale(sale.id)}><DeleteIcon fontSize="small" /></IconButton>}
                    <IconButton size="small" onClick={() => { setInvoiceSale(sale); setTemplateSelectorOpen(true); }} title="Print Invoice"><PrintIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No sales records found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination rowsPerPageOptions={[5, 10, 25, 50]} component="div" count={filteredSales.length} rowsPerPage={rowsPerPage} page={page} onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }} />
      </Paper>

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
                    <Autocomplete options={salesPersons.map((sp) => ({ id: sp.id, name: sp.name || sp.email || 'Unknown' }))} getOptionLabel={(o) => o.name} value={currentSale.salesperson?.id ? currentSale.salesperson : null} isOptionEqualToValue={(o, v) => o.id === v.id} onChange={(_, v) => updateSaleField('salesperson', v || { id: '', name: '' })} renderInput={(params) => <TextField {...params} label="Salesperson" size="small" fullWidth />} />
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
                    <Typography variant="body2">No products added yet. Use the form above to add products.</Typography>
                  </Box>
                )}

                {currentSale.products.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                    GST is calculated per product based on product settings. Products marked as GST exempt will have no GST applied. You can edit the selling price inline.
                  </Typography>
                )}
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
                  {isAdmin && (
                    <Card variant="outlined" sx={{ flex: '1 1 160px', borderRadius: 2 }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Typography variant="caption" color="text.secondary">Net Profit</Typography>
                        <Typography variant="h6" fontWeight={600} color={currentSale.netProfit >= 0 ? 'success.main' : 'error.main'}>{formatCurrency(Math.round(currentSale.netProfit))}</Typography>
                      </CardContent>
                    </Card>
                  )}
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
          <Button onClick={() => { setOpenDialog(false); setCurrentSale(null); }} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveSale}
            disabled={!currentSale?.patientName?.trim() || (currentSale?.products?.length || 0) === 0}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 4 }}
            startIcon={<ReceiptIcon />}
          >
            {currentSale?.id ? 'Update Sale' : 'Save Sale & Create Invoice'}
          </Button>
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

      {/* ── Template Selector ── */}
      <TemplateSelector
        open={templateSelectorOpen}
        onClose={() => { setTemplateSelectorOpen(false); setInvoiceSale(null); }}
        onSelect={async (templateId, template) => {
          setSelectedTemplateId(templateId);
          if (template.templateType === 'html') {
            try {
              const snap = await getDocs(collection(db, 'invoiceTemplates'));
              const full = snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((t) => t.id === templateId);
              if (full) setSelectedTemplateData({ id: full.id, htmlContent: (full as any).htmlContent, images: (full as any).images || [] });
            } catch (e) { console.error('Error fetching template:', e); }
          } else { setSelectedTemplateData(null); }
          setTemplateSelectorOpen(false);
          setInvoiceOpen(true);
        }}
        selectedTemplateId={selectedTemplateId}
      />

      {invoiceSale && (
        <PDFInvoiceGenerator
          open={invoiceOpen}
          onClose={() => { setInvoiceOpen(false); setInvoiceSale(null); }}
          invoiceData={convertSaleToInvoiceData(invoiceSale)}
          template="modern"
          customTemplate={selectedTemplateData}
        />
      )}

      <Snackbar open={!!successMsg} autoHideDuration={5000} onClose={() => setSuccessMsg('')}>
        <Alert onClose={() => setSuccessMsg('')} severity="success" variant="filled">{successMsg}</Alert>
      </Snackbar>
      <Snackbar open={!!errorMsg} autoHideDuration={5000} onClose={() => setErrorMsg('')}>
        <Alert onClose={() => setErrorMsg('')} severity="error" variant="filled">{errorMsg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default SalesPage;
