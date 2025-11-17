'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getHeadOfficeId } from '@/utils/centerUtils';
import { useAuth } from '@/context/AuthContext';
import PureToneAudiogram from './PureToneAudiogram';
import {
  TextField, Button, Typography, Box, Paper,
  FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Divider, Stepper, Step, StepLabel,
  Grid as MuiGrid, IconButton, FormHelperText,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, Chip, InputAdornment, Switch, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Stack, Checkbox
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Assignment as AssignmentIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  CurrencyRupee as RupeeIcon,
  DateRange as DateRangeIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  LocalHospital as MedicalIcon,
  Event as EventIcon,
  Check as CheckIcon,
  Inventory as InventoryIcon,
  Search as SearchIcon,
  Business as BusinessIcon,
  Category as CategoryIcon,
  ViewList as ViewListIcon,
  GridView as GridViewIcon,
  AssignmentReturn as AssignmentReturnIcon
} from '@mui/icons-material';

// Custom Grid wrapper
const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

// Product interface (matching the products module)
interface Product {
  id: string;
  name: string;
  type: string;
  company: string;
  hasSerialNumber?: boolean;
  mrp?: number;
  isFreeOfCost?: boolean;
  gstApplicable: boolean;
  gstType?: 'CGST' | 'IGST';
  gstPercentage?: number;
  hsnCode?: string;
  quantityType?: 'piece' | 'pair';
  createdAt: any;
  updatedAt: any;
}

// Static options
const referenceOptions = [
  'Camp',
  'CGHS/DGEHS/ Any Govt. deptt',
  'converted',
  'Dealer',
  'Dr Deepika Ref.',
  'Dr Yogesh Kansal Ref.',
  'existing',
  'Gautam dhamija',
  'GN RESOUND ENQUIRY',
  'Google Adwords',
  'Hear.com',
  'home service',
  'INDIAMART',
  'just dial',
  'Medical Store Reference',
  'must and more',
  'Nath brother ( chemist )',
  'Online',
  'Other Doctor Referenes',
  'reference existing patient',
  'signia',
  'Visit Health',
  'walking'
];

// Job roles from the staff module
const JOB_ROLES = [
  'Manager',
  'Audiologist', 
  'Sales Executive',
  'Technician',
  'Receptionist',
  'Accountant',
  'Administrator',
  'Customer Support',
  'Marketing Executive',
  'Telecaller',
];

// Staff member interface
interface StaffMember {
  id: string;
  name: string;
  jobRole: string;
  status: 'active' | 'inactive';
}

// Default fallback staff options (for backward compatibility)
const fallbackStaffOptions = [
  'Aditya', 'Chirag', 'Deepika', 'Deepika Jain', 'Manish', 'Nisha', 
  'Pankaj', 'Priya', 'Raghav', 'Rohit', 'Saksham', 'Sanjana', 
  'Siddharth', 'Tushar', 'Vikash'
];

// Utility function
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface FollowUp {
  id: string;
  date: string;
  remarks: string;
  nextFollowUpDate: string;
  callerName: string;
}

interface HearingAidProduct {
  id: string;
  inventoryId?: string;
  productId: string;
  name: string;
  hsnCode: string;
  serialNumber: string;
  unit: 'piece' | 'pair' | 'quantity';
  saleDate: string;
  mrp: number;
  dealerPrice?: number;
  sellingPrice: number;
  discountPercent: number;
  discountAmount: number;
  gstPercent: number;
  gstAmount: number;
  finalAmount: number;
  gstApplicable: boolean;
  gstType?: 'CGST' | 'IGST';
  warranty: string;
  company?: string;
  location?: string;
}

interface PaymentRecord {
  id: string;
  paymentDate: string;
  amount: number;
  paymentFor: 'hearing_test' | 'hearing_aid' | 'accessory' | 'booking_advance' | 'full_payment' | 'partial_payment' | 'other';
  paymentMode: 'Cash' | 'Card' | 'UPI' | 'Net Banking' | 'Cheque' | 'NEFT/RTGS';
  referenceNumber: string;
  remarks: string;
}

interface Visit {
  id: string;
  visitDate: string;
  visitTime: string;
  visitType: 'center' | 'home';
  visitNotes: string;
  hearingTest: boolean;
  hearingAidTrial: boolean;
  hearingAidBooked: boolean;
  hearingAidSale: boolean;
  salesReturn: boolean;
  accessory: boolean;
  programming: boolean;
  repair: boolean;
  counselling: boolean;
  testType: string;
  testDoneBy: string;
  testResults: string;
  recommendations: string;
  testPrice: number;
  audiogramData?: {
    rightAirConduction: (number | null)[];
    leftAirConduction: (number | null)[];
    rightBoneConduction: (number | null)[];
    leftBoneConduction: (number | null)[];
    rightMasking: boolean[];
    leftMasking: boolean[];
    notes?: string;
  };
  hearingAidProductId: string;
  hearingAidType: string;
  hearingAidBrand: string;
  hearingAidModel: string;
  hearingAidPrice: number;
  warranty: string;
  whichEar: 'left' | 'right' | 'both';
  hearingAidStatus: 'trial_given' | 'booked' | 'not_interested' | 'sold' | 'trial_completed' | 'trial_extended';
  // Journey tracking fields
  hearingAidJourneyId: string; // Links visits together for same hearing aid
  previousVisitId: string; // Reference to previous visit in journey
  nextVisitId: string; // Reference to next visit in journey
  journeyStage: 'initial' | 'trial' | 'booking' | 'sale' | 'followup';
  // Trial related fields
  trialGiven: boolean;
  trialDuration: number; // in days
  trialStartDate: string;
  trialEndDate: string;
  trialHearingAidBrand: string;
  trialHearingAidModel: string;
  trialHearingAidType: string;
  trialSerialNumber: string;
  trialNotes: string;
  trialResult: 'ongoing' | 'successful' | 'unsuccessful' | 'extended';
  // Booking related fields
  bookingFromTrial: boolean;
  bookingAdvanceAmount: number;
  bookingDate: string;
  bookingFromVisitId: string; // Which visit this booking relates to
  // Purchase related fields
  purchaseFromTrial: boolean;
  purchaseDate: string;
  purchaseFromVisitId: string; // Which visit this purchase relates to
  
  // Sales Return related fields
  returnSerialNumber: string;
  returnReason: string;
  returnCondition: 'excellent' | 'good' | 'fair' | 'poor';
  returnPenaltyAmount: number;
  returnRefundAmount: number;
  returnOriginalSaleDate: string;
  returnOriginalSaleVisitId: string;
  returnNotes: string;
  accessoryName: string;
  accessoryDetails: string;
  accessoryFOC: boolean;
  accessoryAmount: number;
  accessoryQuantity: number;
  programmingReason: string;
  hearingAidPurchaseDate: string;
  hearingAidName: string;
  underWarranty: boolean;
  programmingAmount: number;
  programmingDoneBy: string;
  products: HearingAidProduct[];
  grossMRP: number;
  grossSalesBeforeTax: number;
  taxAmount: number;
  salesAfterTax: number;
  totalDiscountPercent: number;
}

interface FormData {
  // Basic Information
  name: string;
  phone: string;
  email: string;
  address: string;
  reference: string;
  assignedTo: string;
  telecaller: string;
  center: string;
  message: string;
  
  // Visits array
  visits: Visit[];
  
  // Follow-ups (managed separately)
  followUps: FollowUp[];
  
  // Payments
  payments: PaymentRecord[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  enquiry?: any;
  isEditMode?: boolean;
  fullPage?: boolean;
}

const SimplifiedEnquiryForm: React.FC<Props> = ({
  open,
  onClose,
  onSubmit,
  enquiry,
  isEditMode = false,
  fullPage = true // Always full page now
}) => {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const isAudiologist = userProfile?.role === 'audiologist';
  
  const [step, setStep] = useState(0);
  const [activeVisit, setActiveVisit] = useState(-1);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [currentFollowUp, setCurrentFollowUp] = useState({
    date: new Date().toISOString().split('T')[0],
    remarks: '',
    nextFollowUpDate: '',
    callerName: ''
  });
  
  // Staff management states
  const [staffManagementOpen, setStaffManagementOpen] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffByRole, setStaffByRole] = useState<Record<string, StaffMember[]>>({});
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>({
    telecaller: ['Telecaller', 'Customer Support'],
    assignedTo: ['Manager', 'Sales Executive', 'Audiologist'],
    testBy: ['Audiologist', 'Technician'], 
    programmingBy: ['Audiologist', 'Technician'],
    sales: ['Sales Executive', 'Manager'],
    general: JOB_ROLES
  });
  const [currentField, setCurrentField] = useState<keyof typeof selectedRoles>('telecaller');
  const [products, setProducts] = useState<any[]>([]);
  const [hearingAidProducts, setHearingAidProducts] = useState<Product[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [currentProduct, setCurrentProduct] = useState({
    inventoryId: '',
    productId: '',
    name: '',
    hsnCode: '',
    serialNumber: '',
    unit: 'piece' as 'piece' | 'pair' | 'quantity',
    saleDate: new Date().toISOString().split('T')[0],
    mrp: 0,
    dealerPrice: 0,
    sellingPrice: 0,
    discountPercent: 0,
    discountAmount: 0,
    gstPercent: 18,
    gstAmount: 0,
    finalAmount: 0,
    gstApplicable: true,
    gstType: 'IGST' as 'CGST' | 'IGST',
    warranty: '',
    company: '',
    location: ''
  });

  const [currentPayment, setCurrentPayment] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: 0,
    paymentFor: 'full_payment' as PaymentRecord['paymentFor'],
    paymentMode: 'Cash' as PaymentRecord['paymentMode'],
    referenceNumber: '',
    remarks: ''
  });



  // Automatic calculation when product pricing fields change
  useEffect(() => {
    if (currentProduct.mrp > 0) {
      const discountAmount = (currentProduct.mrp * currentProduct.discountPercent) / 100;
      const calculatedSellingPrice = currentProduct.mrp - discountAmount;
      const gstAmount = (currentProduct.sellingPrice * currentProduct.gstPercent) / 100;
      const finalAmount = currentProduct.sellingPrice + gstAmount;

      setCurrentProduct(prev => ({
        ...prev,
        discountAmount,
        gstAmount,
        finalAmount
      }));
    }
  }, [currentProduct.mrp, currentProduct.sellingPrice, currentProduct.discountPercent, currentProduct.gstPercent]);

  // Calculate discount percentage when selling price is manually changed
  const updateSellingPrice = (newSellingPrice: number) => {
    if (currentProduct.mrp > 0 && newSellingPrice !== currentProduct.sellingPrice) {
      const discountAmount = currentProduct.mrp - newSellingPrice;
      const discountPercent = (discountAmount / currentProduct.mrp) * 100;
      
      setCurrentProduct(prev => ({
        ...prev,
        sellingPrice: newSellingPrice,
        discountPercent: Math.max(0, discountPercent),
        discountAmount: Math.max(0, discountAmount)
      }));
    } else {
      setCurrentProduct(prev => ({ ...prev, sellingPrice: newSellingPrice }));
    }
  };

  // Calculate selling price when discount percentage is changed
  const updateDiscountPercent = (newDiscountPercent: number) => {
    if (currentProduct.mrp > 0) {
      const discountAmount = (currentProduct.mrp * newDiscountPercent) / 100;
      const sellingPrice = currentProduct.mrp - discountAmount;
      
      setCurrentProduct(prev => ({
        ...prev,
        discountPercent: newDiscountPercent,
        discountAmount,
        sellingPrice: Math.max(0, sellingPrice)
      }));
    } else {
      setCurrentProduct(prev => ({ ...prev, discountPercent: newDiscountPercent }));
    }
  };

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid },
    reset
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      reference: '',
      assignedTo: '',
      telecaller: '',
      center: '',
      message: '',
      visits: [],
      followUps: [],
      payments: []
    }
  });

  // Watch specific fields
  const watchedVisits = watch('visits');
  const currentVisit = watchedVisits[activeVisit];
  const selectedCenter = watch('center');
  // Helpers to derive brand/model from selected product if not explicitly set
  const getProductById = (productId?: string) =>
    (productId ? hearingAidProducts.find(p => p.id === productId) : undefined);
  const brandDisplay = currentVisit
    ? (currentVisit.hearingAidBrand
        || getProductById(currentVisit.hearingAidProductId)?.company
        || (currentVisit as any).trialHearingAidBrand
        || '')
    : '';
  const modelDisplay = currentVisit
    ? (currentVisit.hearingAidModel
        || getProductById(currentVisit.hearingAidProductId)?.name
        || (currentVisit as any).trialHearingAidModel
        || '')
    : '';
  // When booking is linked to a trial, we lock device fields
  const isUsingTrialDevice = !!(
    currentVisit?.hearingAidBooked &&
    currentVisit?.bookingFromTrial &&
    (currentVisit?.bookingFromVisitId || currentVisit?.previousVisitId)
  );
  const watchName = watch('name');
  const watchPhone = watch('phone');

  // Check if step 0 is valid
  const isStep0Valid = watchName?.trim().length > 0 && watchPhone?.trim().length > 0;

  // Fetch products from Firebase
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const productsData: any[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          productsData.push({
            id: doc.id,
            name: data.name,
            type: data.type,
            company: data.company || '',
            mrp: data.mrp || 0,
            isFreeOfCost: data.isFreeOfCost || false,
            gstApplicable: data.gstApplicable || false,
            gstPercentage: data.gstPercentage || 18,
            hsnCode: data.hsnCode || '',
            quantityType: data.quantityType || 'piece'
          });
        });
        setProducts(productsData);
        // Debug: Log accessory products to help troubleshoot
        const accessoryProducts = productsData.filter(p => p.type === 'Accessory' || p.type === 'Other');
        console.log('🔄 Loaded accessory products:', accessoryProducts.length, 'available products:', accessoryProducts.map(p => `${p.name} (${p.type})`));
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchProducts();
  }, []);

  // Fetch all products for sales (hearing aids, batteries, chargers, etc.)
  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        // Remove the type filter to get ALL products
        const productsQuery = collection(db, 'products');
        const querySnapshot = await getDocs(productsQuery);
        const productsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        
        setHearingAidProducts(productsList);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };

    fetchAllProducts();
  }, []);

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

  // Fetch staff members
  useEffect(() => {
    const fetchStaffMembers = async () => {
      try {
        const staffQuery = collection(db, 'staff');
        const querySnapshot = await getDocs(staffQuery);
        const staffList: StaffMember[] = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            name: doc.data().name,
            jobRole: doc.data().jobRole,
            status: doc.data().status
          }))
          .filter(staff => staff.status === 'active'); // Only active staff

        setStaffMembers(staffList);
        
        // Group staff by role
        const groupedByRole: Record<string, StaffMember[]> = {};
        JOB_ROLES.forEach(role => {
          groupedByRole[role] = staffList.filter(staff => staff.jobRole === role);
        });
        setStaffByRole(groupedByRole);
        
      } catch (error) {
        console.error('Error fetching staff members:', error);
      }
    };

    fetchStaffMembers();
  }, []);

  // Function to get staff options for a specific field
  const getStaffOptionsForField = (fieldName: keyof typeof selectedRoles): string[] => {
    const allowedRoles = selectedRoles[fieldName] || [];
    const staffForField: string[] = [];
    
    allowedRoles.forEach(role => {
      const staffInRole = staffByRole[role] || [];
      staffInRole.forEach(staff => {
        if (!staffForField.includes(staff.name)) {
          staffForField.push(staff.name);
        }
      });
    });
    
    // Fallback to default options if no staff found
    return staffForField.length > 0 ? staffForField : fallbackStaffOptions;
  };

  // Fetch previous sales when sales return is activated
  useEffect(() => {
    const currentVisit = watchedVisits[activeVisit];
    if (currentVisit?.salesReturn) {
      fetchPreviousSales();
    }
  }, [watchedVisits, activeVisit, watchedVisits[activeVisit]?.salesReturn]);

  // Refetch inventory when center changes
  useEffect(() => {
    fetchAvailableInventory();
  }, [selectedCenter]);

  // Fetch available inventory for hearing aid sales
  const [availableInventory, setAvailableInventory] = useState<any[]>([]);
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [viewMode, setViewMode] = useState<'companies' | 'models' | 'serials'>('companies');

  // Sales return states
  const [previousSales, setPreviousSales] = useState<any[]>([]);
  const [serialSelectionMode, setSerialSelectionMode] = useState<'dropdown' | 'manual'>('dropdown');

  // Helper functions for inventory organization
  const getInventoryByCompany = () => {
    const companyGroups: Record<string, any[]> = {};
    availableInventory.forEach(item => {
      const company = item.company || 'Unknown Company';
      if (!companyGroups[company]) companyGroups[company] = [];
      companyGroups[company].push(item);
    });
    return companyGroups;
  };

  const getModelsByCompany = (company: string) => {
    const modelGroups: Record<string, any[]> = {};
    availableInventory
      .filter(item => (item.company || 'Unknown Company') === company)
      .forEach(item => {
        const model = item.productName || 'Unknown Model';
        if (!modelGroups[model]) modelGroups[model] = [];
        modelGroups[model].push(item);
      });
    return modelGroups;
  };

  const getFilteredInventory = () => {
    if (!inventorySearchTerm) return availableInventory;
    
    const searchLower = inventorySearchTerm.toLowerCase();
    return availableInventory.filter(item => 
      (item.productName?.toLowerCase().includes(searchLower)) ||
      (item.company?.toLowerCase().includes(searchLower)) ||
      (item.serialNumber?.toLowerCase().includes(searchLower)) ||
      (item.location?.toLowerCase().includes(searchLower))
    );
  };

  const resetInventorySelection = () => {
    setSelectedCompany('');
    setSelectedModel('');
    setViewMode('companies');
    setInventorySearchTerm('');
  };
  
  // Function to fetch available inventory (center-aware)
  const fetchAvailableInventory = async () => {
      try {
        console.log('🔍 Starting inventory fetch for hearing aids...');
        console.log('📦 Using same logic as material-out to calculate inventory...');
        
        // Get head office ID for backward compatibility
        const headOfficeId = await getHeadOfficeId();
        
        // Get data from multiple collections (same as material-out page)
        const [productsSnap, materialInSnap, purchasesSnap, materialsOutSnap] = await Promise.all([
          getDocs(collection(db, 'products')),
          getDocs(collection(db, 'materialInward')),
          getDocs(collection(db, 'purchases')),
          getDocs(collection(db, 'materialsOut')),
        ]);

        console.log(`📊 Found ${productsSnap.docs.length} products, ${materialInSnap.docs.length} material-in, ${purchasesSnap.docs.length} purchases, ${materialsOutSnap.docs.length} materials-out`);

        const prodMap: Record<string, any> = {};
        productsSnap.docs.forEach(d => { prodMap[d.id] = { id: d.id, ...(d.data() as any) }; });

        // Build availability from inbound docs
        const serialsByProduct: Record<string, Set<string>> = {};
        const qtyByProduct: Record<string, number> = {};

        const addInbound = (docs: any[]) => {
          docs.forEach(docSnap => {
            const data: any = docSnap.data();
            
            // Handle location filtering with backward compatibility
            const dataLocation = data.location || headOfficeId; // Default to head office if no location specified
            
            // Filter by location if a center is selected
            if (selectedCenter && dataLocation !== selectedCenter) {
              return; // Skip this document if it's not at the selected center
            }
            
            (data.products || []).forEach((p: any) => {
              const productId = p.productId || p.id;
              if (!productId) return;
              const serialArray: string[] = Array.isArray(p.serialNumbers) ? p.serialNumbers : (p.serialNumber ? [p.serialNumber] : []);
              if (serialArray.length > 0) {
                if (!serialsByProduct[productId]) serialsByProduct[productId] = new Set<string>();
                serialArray.forEach(sn => sn && serialsByProduct[productId].add(String(sn)));
              } else {
                const q = Number(p.quantity ?? p.qty ?? 0);
                if (!qtyByProduct[productId]) qtyByProduct[productId] = 0;
                qtyByProduct[productId] += isNaN(q) ? 0 : q;
              }
            });
          });
        };

        addInbound(materialInSnap.docs);
        addInbound(purchasesSnap.docs);

        // Subtract outflows from materialsOut
        materialsOutSnap.docs.forEach(d => {
          const data: any = d.data();
          
          // Handle location filtering with backward compatibility
          const dataLocation = data.location || headOfficeId; // Default to head office if no location specified
          
          // Filter by location if a center is selected
          if (selectedCenter && dataLocation !== selectedCenter) {
            return; // Skip this document if it's not at the selected center
          }
          
          (data.products || []).forEach((p: any) => {
            const productId = p.productId || p.id;
            if (!productId) return;
            const serialArray: string[] = Array.isArray(p.serialNumbers) ? p.serialNumbers : [];
            if (serialArray.length > 0) {
              if (!serialsByProduct[productId]) serialsByProduct[productId] = new Set<string>();
              serialArray.forEach(sn => {
                if (sn && serialsByProduct[productId].has(String(sn))) serialsByProduct[productId].delete(String(sn));
              });
            } else {
              const q = Number(p.quantity ?? 0);
              if (!qtyByProduct[productId]) qtyByProduct[productId] = 0;
              qtyByProduct[productId] = Math.max(0, qtyByProduct[productId] - (isNaN(q) ? 0 : q));
            }
          });
        });

        // Flatten to items array
        const items: any[] = [];
        Object.entries(serialsByProduct).forEach(([productId, set]) => {
          const prod = prodMap[productId] || {};
          Array.from(set).forEach(sn => {
            items.push({
              id: `${productId}-${sn}`, // Create unique ID for inventory items
              productId,
              productName: prod.name || 'Product',
              name: prod.name || 'Product', // Alias for compatibility
              type: prod.type || '',
              company: prod.company || '',
              serialNumber: sn,
              isSerialTracked: true,
              mrp: Number(prod.mrp) || 0,
              dealerPrice: Number(prod.dealerPrice) || 0,
              gstApplicable: prod.gstApplicable || false,
              gstPercentage: Number(prod.gstPercentage) || (prod.gstApplicable ? 18 : 0),
              gstType: prod.gstType || 'IGST',
              status: 'In Stock',
              location: selectedCenter || 'rohini', // Current center or default to Rohini
              hsnCode: prod.hsnCode || ''
            });
          });
        });
        
        Object.entries(qtyByProduct).forEach(([productId, qty]) => {
          if (qty > 0) {
            const prod = prodMap[productId] || {};
            items.push({
              id: `${productId}-qty`, // Create unique ID for non-serial items
              productId,
              productName: prod.name || 'Product',
              name: prod.name || 'Product', // Alias for compatibility
              type: prod.type || '',
              company: prod.company || '',
              isSerialTracked: false,
              quantity: qty,
              mrp: Number(prod.mrp) || 0,
              dealerPrice: Number(prod.dealerPrice) || 0,
              gstApplicable: prod.gstApplicable || false,
              gstPercentage: Number(prod.gstPercentage) || (prod.gstApplicable ? 18 : 0),
              gstType: prod.gstType || 'IGST',
              status: 'In Stock',
              location: selectedCenter || 'rohini', // Current center or default to Rohini
              hsnCode: prod.hsnCode || ''
            });
          }
        });

        console.log(`📦 Total inventory items calculated: ${items.length}`);
        
        // Show sample product data to debug pricing
        if (Object.keys(prodMap).length > 0) {
          const sampleProduct = Object.values(prodMap)[0] as any;
          console.log('💰 Sample product pricing data:', {
            name: sampleProduct.name,
            mrp: sampleProduct.mrp,
            dealerPrice: sampleProduct.dealerPrice,
            gstApplicable: sampleProduct.gstApplicable,
            gstPercentage: sampleProduct.gstPercentage
          });
        }
        
        // Show ALL products (hearing aids, batteries, chargers, etc.)
        console.log(`✅ Final inventory items found: ${items.length}`);
        console.log('📋 All product inventory:', items);
        
        setAvailableInventory(items);
        
      } catch (error) {
        console.error('❌ Error fetching available inventory:', error);
      }
    };

  // Initial inventory fetch
  useEffect(() => {
    fetchAvailableInventory();
  }, []);

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      if (isEditMode && enquiry) {
        // Set form values for edit mode
        const visits = enquiry.visitSchedules?.map((visit: any, index: number) => ({
          id: visit.id || (index + 1).toString(),
          visitDate: visit.visitDate || '',
          visitTime: visit.visitTime || '',
          visitType: visit.visitType || 'center',
          visitNotes: visit.notes || '',
          hearingTest: visit.medicalServices?.includes('hearing_test') || false,
          hearingAidTrial: visit.medicalServices?.includes('hearing_aid_trial') || false,
          hearingAidBooked: visit.medicalServices?.includes('hearing_aid_booked') || false,
          hearingAidSale: visit.medicalServices?.includes('hearing_aid_sale') || visit.medicalServices?.includes('hearing_aid') || false,
          accessory: visit.medicalServices?.includes('accessory') || false,
          programming: visit.medicalServices?.includes('programming') || false,
          repair: visit.medicalServices?.includes('repair') || false,
          counselling: visit.medicalServices?.includes('counselling') || false,
          testType: visit.hearingTestDetails?.testType || '',
          testDoneBy: visit.hearingTestDetails?.testDoneBy || '',
          testResults: visit.hearingTestDetails?.testResults || '',
          recommendations: visit.hearingTestDetails?.recommendations || '',
          testPrice: visit.hearingTestDetails?.testPrice || 0,
          audiogramData: visit.hearingTestDetails?.audiogramData || undefined,
          hearingAidType: visit.hearingAidDetails?.hearingAidSuggested || '',
          hearingAidBrand: visit.hearingAidDetails?.whoSold || '',
          hearingAidModel: visit.hearingAidDetails?.quotation || '',
          hearingAidPrice: visit.hearingAidDetails?.bookingAmount || 0,
          warranty: visit.hearingAidDetails?.trialPeriod || '',
          whichEar: visit.hearingAidDetails?.whichEar || 'both',
          hearingAidStatus: visit.hearingAidDetails?.hearingAidStatus || 'booked',
          // Journey tracking fields
          hearingAidJourneyId: visit.hearingAidDetails?.hearingAidJourneyId || '',
          previousVisitId: visit.hearingAidDetails?.previousVisitId || '',
          nextVisitId: visit.hearingAidDetails?.nextVisitId || '',
          journeyStage: visit.hearingAidDetails?.journeyStage || 'initial',
          // Trial related fields
          trialGiven: visit.hearingAidDetails?.trialGiven || false,
          trialDuration: visit.hearingAidDetails?.trialDuration || 7,
          trialStartDate: visit.hearingAidDetails?.trialStartDate || '',
          trialEndDate: visit.hearingAidDetails?.trialEndDate || '',
          trialHearingAidBrand: visit.hearingAidDetails?.trialHearingAidBrand || '',
          trialHearingAidModel: visit.hearingAidDetails?.trialHearingAidModel || '',
          trialHearingAidType: visit.hearingAidDetails?.trialHearingAidType || '',
          trialSerialNumber: visit.hearingAidDetails?.trialSerialNumber || '',
          trialNotes: visit.hearingAidDetails?.trialNotes || '',
          trialResult: visit.hearingAidDetails?.trialResult || 'ongoing',
          // Booking related fields
          bookingFromTrial: visit.hearingAidDetails?.bookingFromTrial || false,
          bookingAdvanceAmount: visit.hearingAidDetails?.bookingAdvanceAmount || 0,
          bookingDate: visit.hearingAidDetails?.bookingDate || '',
          bookingFromVisitId: visit.hearingAidDetails?.bookingFromVisitId || '',
          // Purchase related fields
          purchaseFromTrial: visit.hearingAidDetails?.purchaseFromTrial || false,
          purchaseDate: visit.hearingAidDetails?.purchaseDate || '',
          purchaseFromVisitId: visit.hearingAidDetails?.purchaseFromVisitId || '',
          accessoryName: visit.accessoryDetails?.accessoryName || '',
          accessoryDetails: visit.accessoryDetails?.accessoryDetails || '',
          accessoryFOC: visit.accessoryDetails?.accessoryFOC || false,
          accessoryAmount: visit.accessoryDetails?.accessoryAmount || 0,
          accessoryQuantity: visit.accessoryDetails?.accessoryQuantity || 1,
          programmingReason: visit.programmingDetails?.programmingReason || '',
          hearingAidPurchaseDate: visit.programmingDetails?.hearingAidPurchaseDate || '',
          hearingAidName: visit.programmingDetails?.hearingAidName || '',
          underWarranty: visit.programmingDetails?.underWarranty || false,
          programmingAmount: visit.programmingDetails?.programmingAmount || 0,
          programmingDoneBy: visit.programmingDetails?.programmingDoneBy || '',
          products: visit.hearingAidDetails?.products || [],
          grossMRP: visit.hearingAidDetails?.grossMRP || 0,
          grossSalesBeforeTax: visit.hearingAidDetails?.grossSalesBeforeTax || 0,
          taxAmount: visit.hearingAidDetails?.taxAmount || 0,
          salesAfterTax: visit.hearingAidDetails?.salesAfterTax || 0,
          totalDiscountPercent: visit.hearingAidDetails?.totalDiscountPercent || 0
        })) || [];

        reset({
          name: enquiry.name || '',
          phone: enquiry.phone || '',
          email: enquiry.email || '',
          address: enquiry.address || '',
          reference: enquiry.reference || '',
          assignedTo: enquiry.assignedTo || '',
          telecaller: enquiry.telecaller || '',
          center: enquiry.center || '',
          message: enquiry.message || '',
          visits,
          followUps: [],
          payments: enquiry.payments || []
        });
        setFollowUps(enquiry.followUps || []);
        setActiveVisit(visits.length > 0 ? 0 : -1);
      } else {
        // Reset for new form
        reset();
        setFollowUps([]);
        setActiveVisit(-1);
      }
      setStep(0);
      setCurrentFollowUp({
        date: new Date().toISOString().split('T')[0],
        remarks: '',
        nextFollowUpDate: '',
        callerName: ''
      });
      setCurrentPayment({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: 0,
        paymentFor: 'full_payment',
        paymentMode: 'Cash',
        referenceNumber: '',
        remarks: ''
      });
    }
  }, [open, isEditMode, enquiry, reset]);

  // Handle visit changes (single field)
  const updateVisit = (visitIndex: number, field: string, value: any) => {
    const currentVisits = getValues('visits');
    const nextVisits = [...currentVisits];
    nextVisits[visitIndex] = { ...nextVisits[visitIndex], [field]: value };
    setValue('visits', nextVisits);
  };

  // Handle visit changes (multiple fields at once to avoid stale overwrites)
  const updateVisitFields = (visitIndex: number, updates: Partial<Visit>) => {
    const currentVisits = getValues('visits');
    const nextVisits = [...currentVisits];
    nextVisits[visitIndex] = { ...nextVisits[visitIndex], ...updates } as Visit;
    setValue('visits', nextVisits);
  };

  // Add new visit
  const addVisit = () => {
    const newVisit: Visit = {
      id: (watchedVisits.length + 1).toString(),
      visitDate: '',
      visitTime: '',
      visitType: 'center',
      visitNotes: '',
      hearingTest: false,
      hearingAidTrial: false,
      hearingAidBooked: false,
      hearingAidSale: false,
      salesReturn: false,
      accessory: false,
      programming: false,
      repair: false,
      counselling: false,
      testType: '',
      testDoneBy: '',
      testResults: '',
      recommendations: '',
      testPrice: 0,
      audiogramData: undefined,
      hearingAidProductId: '',
      hearingAidType: '',
      hearingAidBrand: '',
      hearingAidModel: '',
      hearingAidPrice: 0,
      warranty: '',
      whichEar: 'both',
      hearingAidStatus: 'booked',
      // Journey tracking fields
      hearingAidJourneyId: '',
      previousVisitId: '',
      nextVisitId: '',
      journeyStage: 'initial',
      // Trial related fields
      trialGiven: false,
      trialDuration: 7, // default 7 days
      trialStartDate: '',
      trialEndDate: '',
      trialHearingAidBrand: '',
      trialHearingAidModel: '',
      trialHearingAidType: '',
      trialSerialNumber: '',
      trialNotes: '',
      trialResult: 'ongoing',
      // Booking related fields
      bookingFromTrial: false,
      bookingAdvanceAmount: 0,
      bookingDate: '',
      bookingFromVisitId: '',
      // Purchase related fields
      purchaseFromTrial: false,
      purchaseDate: '',
      purchaseFromVisitId: '',
      
      // Sales Return related fields
      returnSerialNumber: '',
      returnReason: '',
      returnCondition: 'good',
      returnPenaltyAmount: 0,
      returnRefundAmount: 0,
      returnOriginalSaleDate: '',
      returnOriginalSaleVisitId: '',
      returnNotes: '',
      accessoryName: '',
      accessoryDetails: '',
      accessoryFOC: false,
      accessoryAmount: 0,
      accessoryQuantity: 1,
      programmingReason: '',
      hearingAidPurchaseDate: '',
      hearingAidName: '',
      underWarranty: false,
      programmingAmount: 0,
      programmingDoneBy: '',
      products: [],
      grossMRP: 0,
      grossSalesBeforeTax: 0,
      taxAmount: 0,
      salesAfterTax: 0,
      totalDiscountPercent: 0
    };
    setValue('visits', [...watchedVisits, newVisit]);
    setActiveVisit(watchedVisits.length);
  };

  // Remove visit
  const removeVisit = (visitIndex: number) => {
    const updatedVisits = watchedVisits.filter((_, i) => i !== visitIndex);
    setValue('visits', updatedVisits);
    
    if (updatedVisits.length === 0) {
      setActiveVisit(-1);
    } else if (activeVisit >= updatedVisits.length) {
      setActiveVisit(updatedVisits.length - 1);
    }
  };

  // Handle product changes
  const addProduct = () => {
    if (currentProduct.name && currentProduct.mrp > 0) {
      const discountAmount = (currentProduct.mrp * currentProduct.discountPercent) / 100;
      const sellingPrice = currentProduct.sellingPrice || (currentProduct.mrp - discountAmount);
      const gstAmount = currentProduct.gstPercent > 0 ? (sellingPrice * currentProduct.gstPercent) / 100 : 0;
      const finalAmount = sellingPrice + gstAmount;

      const newProduct: HearingAidProduct = {
        id: Date.now().toString(),
        inventoryId: currentProduct.inventoryId,
        productId: currentProduct.productId,
        name: currentProduct.name,
        hsnCode: currentProduct.hsnCode,
        serialNumber: currentProduct.serialNumber,
        unit: currentProduct.unit,
        saleDate: currentProduct.saleDate,
        mrp: currentProduct.mrp,
        dealerPrice: currentProduct.dealerPrice,
        sellingPrice,
        discountPercent: currentProduct.discountPercent,
        discountAmount,
        gstPercent: currentProduct.gstPercent,
        gstAmount,
        finalAmount,
        gstApplicable: currentProduct.gstApplicable,
        gstType: currentProduct.gstType,
        warranty: currentProduct.warranty,
        company: currentProduct.company,
        location: currentProduct.location
      };

      const updatedVisits = [...watchedVisits];
      updatedVisits[activeVisit].products.push(newProduct);
      
      // Update totals
      const products = updatedVisits[activeVisit].products;
      updatedVisits[activeVisit].grossMRP = products.reduce((sum, p) => sum + p.mrp, 0);
      updatedVisits[activeVisit].grossSalesBeforeTax = products.reduce((sum, p) => sum + p.sellingPrice, 0);
      updatedVisits[activeVisit].taxAmount = products.reduce((sum, p) => sum + p.gstAmount, 0);
      updatedVisits[activeVisit].salesAfterTax = products.reduce((sum, p) => sum + p.finalAmount, 0);

      setValue('visits', updatedVisits);
      
      // Reset current product
      setCurrentProduct({
        inventoryId: '',
        productId: '',
        name: '',
        hsnCode: '',
        serialNumber: '',
        unit: 'piece',
        saleDate: new Date().toISOString().split('T')[0],
        mrp: 0,
        dealerPrice: 0,
        sellingPrice: 0,
        discountPercent: 0,
        discountAmount: 0,
        gstPercent: 18,
        gstAmount: 0,
        finalAmount: 0,
        gstApplicable: true,
        gstType: 'IGST',
        warranty: '',
        company: '',
        location: ''
      });
    }
  };

  const removeProduct = (productIndex: number) => {
    const updatedVisits = [...watchedVisits];
    updatedVisits[activeVisit].products.splice(productIndex, 1);
    
    // Update totals
    const products = updatedVisits[activeVisit].products;
    updatedVisits[activeVisit].grossMRP = products.reduce((sum, p) => sum + p.mrp, 0);
    updatedVisits[activeVisit].grossSalesBeforeTax = products.reduce((sum, p) => sum + p.sellingPrice, 0);
    updatedVisits[activeVisit].taxAmount = products.reduce((sum, p) => sum + p.gstAmount, 0);
    updatedVisits[activeVisit].salesAfterTax = products.reduce((sum, p) => sum + p.finalAmount, 0);

    setValue('visits', updatedVisits);
  };

  // Handle follow-up changes
  const handleFollowUpChange = (field: string, value: string) => {
    setCurrentFollowUp(prev => ({ ...prev, [field]: value }));
  };

  const addFollowUp = () => {
    // Enhanced validation - require date, caller name, and at least one meaningful field
    const isValid = currentFollowUp.date.trim() && 
                   currentFollowUp.callerName.trim() && 
                   (currentFollowUp.remarks.trim() || currentFollowUp.nextFollowUpDate.trim());
    
    if (isValid) {
      const newFollowUp: FollowUp = {
        id: Date.now().toString(),
        ...currentFollowUp
      };
      setFollowUps(prev => [...prev, newFollowUp]);
      setCurrentFollowUp({
        date: new Date().toISOString().split('T')[0],
        remarks: '',
        nextFollowUpDate: '',
        callerName: ''
      });
    } else {
      // Show validation error
      alert('Please fill in the date, caller name, and either remarks or next follow-up date.');
    }
  };

  const getNextFollowUpSuggestions = () => {
    const today = new Date();
    return [
      { label: 'Tomorrow', date: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { label: 'In 3 days', date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { label: 'Next week', date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { label: 'In 2 weeks', date: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { label: 'Next month', date: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] }
    ];
  };

  const removeFollowUp = (index: number) => {
    setFollowUps(prev => prev.filter((_, i) => i !== index));
  };

  // Fetch previous sales for this enquiry (for sales returns)
  const fetchPreviousSales = () => {
    const currentVisits = getValues('visits');
    const salesData: any[] = [];
    
    currentVisits.forEach((visit, visitIndex) => {
      if (visit.hearingAidSale && visit.products && visit.products.length > 0) {
        visit.products.forEach((product: any) => {
          if (product.serialNumber) {
            salesData.push({
              visitIndex,
              visitDate: visit.visitDate,
              serialNumber: product.serialNumber,
              productName: product.name,
              brand: visit.hearingAidBrand || product.company || '',
              model: visit.hearingAidModel || '',
              mrp: product.mrp || 0,
              sellingPrice: product.sellingPrice || 0,
              finalAmount: product.finalAmount || 0,
              saleDate: product.saleDate || visit.visitDate
            });
          }
        });
      }
    });
    
    setPreviousSales(salesData);
  };

  // Handle serial number selection from previous sales
  const handleSerialNumberSelect = (selectedSale: any) => {
    if (selectedSale) {
      // Auto-populate sale details
      updateVisitFields(activeVisit, {
        returnSerialNumber: selectedSale.serialNumber,
        returnOriginalSaleDate: selectedSale.saleDate,
        returnOriginalSaleVisitId: selectedSale.visitIndex.toString()
      });
    }
  };

  // Payment handling functions
  const calculateTotalDue = () => {
    const visits = getValues('visits');
    let total = 0;
    
    visits.forEach(visit => {
      // Add hearing test price
      if (visit.hearingTest && visit.testPrice) {
        total += visit.testPrice;
      }
      
      // Add hearing aid products total
                if ((visit.hearingAidTrial || visit.hearingAidBooked || visit.hearingAidSale) && visit.products) {
        total += visit.salesAfterTax || 0;
      }
      
      // Add accessory amount
      if (visit.accessory && !visit.accessoryFOC) {
        total += (visit.accessoryAmount || 0) * (visit.accessoryQuantity || 1);
      }
      
      // Add programming amount
      if (visit.programming) {
        total += visit.programmingAmount || 0;
      }
    });
    
    return total;
  };

  const getAvailablePaymentOptions = () => {
    const visits = getValues('visits');
    const options = [];
    
    visits.forEach(visit => {
      if (visit.hearingTest && visit.testPrice > 0) {
        options.push({
          value: 'hearing_test',
          label: 'Hearing Test',
          amount: visit.testPrice,
          description: `Test on ${visit.visitDate || 'scheduled date'}`
        });
      }
      
      if (visit.hearingAidBooked && visit.bookingAdvanceAmount > 0) {
        options.push({
          value: 'booking_advance',
          label: 'Booking Advance',
          amount: visit.bookingAdvanceAmount,
          description: `Advance for Visit ${visit.id} on ${visit.bookingDate || visit.visitDate || ''}`
        });
      }

              if ((visit.hearingAidTrial || visit.hearingAidBooked || visit.hearingAidSale) && visit.salesAfterTax > 0) {
        options.push({
          value: 'hearing_aid',
          label: 'Hearing Aid',
          amount: visit.salesAfterTax,
          description: `${visit.products?.length || 0} product(s)`
        });
      }
      
      if (visit.accessory && !visit.accessoryFOC && visit.accessoryAmount > 0) {
        const totalAccessoryAmount = (visit.accessoryAmount || 0) * (visit.accessoryQuantity || 1);
        options.push({
          value: 'accessory',
          label: 'Accessory',
          amount: totalAccessoryAmount,
          description: visit.accessoryName || 'Accessory item'
        });
      }
      
      if (visit.programming && visit.programmingAmount > 0) {
        options.push({
          value: 'programming',
          label: 'Programming',
          amount: visit.programmingAmount,
          description: visit.hearingAidName || 'Hearing aid programming'
        });
      }
    });

    // Add general options
    options.push(
      {
        value: 'full_payment',
        label: 'Full Payment',
        amount: calculateTotalDue(),
        description: 'Complete payment for all services'
      },
      {
        value: 'partial_payment',
        label: 'Partial Payment',
        amount: 0,
        description: 'Custom amount towards total bill'
      },
      {
        value: 'other',
        label: 'Other',
        amount: 0,
        description: 'Miscellaneous payment'
      }
    );
    
    return options;
  };

  const handlePaymentForChange = (paymentFor: PaymentRecord['paymentFor']) => {
    const paymentOptions = getAvailablePaymentOptions();
    const selectedOption = paymentOptions.find(opt => opt.value === paymentFor);
    
    setCurrentPayment(prev => ({
      ...prev,
      paymentFor,
      amount: selectedOption?.amount || 0,
      paymentDate: paymentFor === 'booking_advance'
        ? (getValues('visits').find(v => v.hearingAidBooked)?.bookingDate || getValues('visits').find(v => v.hearingAidBooked)?.visitDate || prev.paymentDate)
        : prev.paymentDate
    }));
  };

  const calculateTotalPaid = () => {
    const payments = getValues('payments');
    const paymentsTotal = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

    // Include booking advances recorded in visits (without double counting
    // payments already recorded as booking_advance in the payments list)
    const visits = getValues('visits');
    const plannedBookingAdvance = visits.reduce((sum, v) => {
      return sum + ((v.hearingAidBooked && v.bookingAdvanceAmount > 0) ? v.bookingAdvanceAmount : 0);
    }, 0);
    const recordedBookingAdvance = payments
      .filter(p => p.paymentFor === 'booking_advance')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const unrecordedBookingAdvance = Math.max(0, plannedBookingAdvance - recordedBookingAdvance);

    return paymentsTotal + unrecordedBookingAdvance;
  };

  const calculateOutstanding = () => {
    return calculateTotalDue() - calculateTotalPaid();
  };

  const addPayment = () => {
    if (currentPayment.amount > 0) {
      const payments = getValues('payments');
      const newPayment: PaymentRecord = {
        id: Date.now().toString(),
        ...currentPayment
      };
      
      setValue('payments', [...payments, newPayment]);
      
      // Reset current payment form
      setCurrentPayment({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: 0,
        paymentFor: 'full_payment',
        paymentMode: 'Cash',
        referenceNumber: '',
        remarks: ''
      });
    }
  };

  const removePayment = (paymentId: string) => {
    const payments = getValues('payments');
    setValue('payments', payments.filter(p => p.id !== paymentId));
  };

  // Submit form
  // Helper function to remove undefined values from objects (Firestore doesn't allow undefined)
  const removeUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefined(item));
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          if (value !== undefined) {
            cleaned[key] = removeUndefined(value);
          }
        }
      }
      return cleaned;
    }
    return obj;
  };

  const onFormSubmit = (data: FormData) => {
    const totalDue = calculateTotalDue();
    const totalPaid = calculateTotalPaid();
    const outstanding = calculateOutstanding();
    
    const formattedData = {
      ...data,
      followUps,
      status: 'active',
      // Payment summary
      financialSummary: {
        totalDue,
        totalPaid,
        outstanding,
        paymentStatus: outstanding <= 0 ? 'fully_paid' : 'pending'
      },
      visitSchedules: data.visits.map(visit => {
        // Build hearingTestDetails object, only including audiogramData if it exists
        const hearingTestDetails: any = {
          testType: visit.testType || null,
          testDoneBy: visit.testDoneBy || null,
          testResults: visit.testResults || null,
          recommendations: visit.recommendations || null,
          testPrice: visit.testPrice || null,
        };
        
        // Only add audiogramData if it exists and is not undefined
        if (visit.audiogramData !== undefined && visit.audiogramData !== null) {
          hearingTestDetails.audiogramData = visit.audiogramData;
        }
        
        return removeUndefined({
          id: visit.id,
          visitType: visit.visitType,
          visitDate: visit.visitDate,
          visitTime: visit.visitTime,
          notes: visit.visitNotes,
          medicalServices: [
            ...(visit.hearingTest ? ['hearing_test'] : []),
            ...(visit.hearingAidTrial ? ['hearing_aid_trial'] : []),
            ...(visit.hearingAidBooked ? ['hearing_aid_booked'] : []),
            ...(visit.hearingAidSale ? ['hearing_aid_sale'] : []),
            ...(visit.accessory ? ['accessory'] : []),
            ...(visit.programming ? ['programming'] : []),
            ...(visit.repair ? ['repair'] : []),
            ...(visit.counselling ? ['counselling'] : [])
          ],
          hearingTestDetails: removeUndefined(hearingTestDetails),
          hearingAidDetails: removeUndefined({
            hearingAidProductId: visit.hearingAidProductId,
          hearingAidSuggested: visit.hearingAidType,
          whoSold: visit.hearingAidBrand,
          quotation: visit.hearingAidModel,
          bookingAmount: visit.hearingAidPrice,
          trialPeriod: visit.warranty,
          whichEar: visit.whichEar,
          hearingAidStatus: visit.hearingAidStatus,
          saleDate: '',
          hearingAidGivenForTrial: false,
          products: visit.products,
          grossMRP: visit.grossMRP,
          grossSalesBeforeTax: visit.grossSalesBeforeTax,
          taxAmount: visit.taxAmount,
          salesAfterTax: visit.salesAfterTax,
          totalDiscountPercent: visit.totalDiscountPercent,
          // Persist journey fields
          hearingAidJourneyId: visit.hearingAidJourneyId,
          previousVisitId: visit.previousVisitId,
          nextVisitId: visit.nextVisitId,
          journeyStage: visit.journeyStage,
          // Persist trial fields
          trialGiven: visit.trialGiven,
          trialDuration: visit.trialDuration,
          trialStartDate: visit.trialStartDate,
          trialEndDate: visit.trialEndDate,
          trialHearingAidBrand: visit.trialHearingAidBrand,
          trialHearingAidModel: visit.trialHearingAidModel,
          trialHearingAidType: visit.trialHearingAidType,
          trialSerialNumber: visit.trialSerialNumber,
          trialNotes: visit.trialNotes,
          trialResult: visit.trialResult,
          // Persist booking fields
          bookingFromTrial: visit.bookingFromTrial,
          bookingAdvanceAmount: visit.bookingAdvanceAmount,
          bookingDate: visit.bookingDate,
          bookingFromVisitId: visit.bookingFromVisitId,
          // Persist purchase fields
          purchaseFromTrial: visit.purchaseFromTrial,
          purchaseDate: visit.purchaseDate,
          purchaseFromVisitId: visit.purchaseFromVisitId
        }),
        accessoryDetails: removeUndefined({
          accessoryName: visit.accessoryName,
          accessoryDetails: visit.accessoryDetails,
          accessoryFOC: visit.accessoryFOC,
          accessoryAmount: visit.accessoryAmount,
          accessoryQuantity: visit.accessoryQuantity
        }),
        programmingDetails: removeUndefined({
          programmingReason: visit.programmingReason,
          hearingAidPurchaseDate: visit.hearingAidPurchaseDate,
          hearingAidName: visit.hearingAidName,
          underWarranty: visit.underWarranty,
          programmingAmount: visit.programmingAmount,
          programmingDoneBy: visit.programmingDoneBy
        })
        });
      })
    };
    
    // Remove all undefined values from the entire data structure before submitting
    const cleanedData = removeUndefined(formattedData);
    onSubmit(cleanedData);
  };

  const stepTitles = ['Patient Information & Services', 'Review & Submit'];

  // Don't render anything if not open
  if (!open) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
      {/* Header */}
      <Paper elevation={2} sx={{ 
        bgcolor: 'primary.main', 
        color: 'white', 
        p: 3,
        borderRadius: 0
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AssignmentIcon sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {isEditMode ? 'Edit Enquiry' : 'Create New Enquiry'}
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 400 }}>
                {stepTitles[step]}
              </Typography>
            </Box>
          </Box>
          <Button
            onClick={onClose}
            variant="outlined"
            sx={{ 
              color: 'white',
              borderColor: 'white',
              '&:hover': { 
                bgcolor: 'rgba(255,255,255,0.1)',
                borderColor: 'white'
              }
            }}
            startIcon={<CloseIcon />}
          >
            Close
          </Button>
        </Box>
      </Paper>

      {/* Stepper */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 0 }}>
        <Stepper activeStep={step} alternativeLabel>
          {stepTitles.map((label) => (
            <Step key={label}>
              <StepLabel 
                sx={{
                  '& .MuiStepLabel-label': {
                    fontSize: '1rem',
                    fontWeight: 500
                  }
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 4 }}>
        {step === 0 && (
          <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
            {/* Basic Information */}
            <Card elevation={2} sx={{ mb: 4, borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <PersonIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                  <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    Patient Information
                  </Typography>
                </Box>
                
                      <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="name"
                      control={control}
                      rules={{ required: 'Name is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Full Name"
                          required
                          error={!!errors.name}
                          helperText={errors.name?.message}
                          variant="outlined"
                          disabled={isAudiologist}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      )}
                    />
                  </Grid>
                  {!isAudiologist && (
                    <Grid item xs={12} md={6}>
                      <Controller
                        name="phone"
                        control={control}
                        rules={{ required: 'Phone is required' }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Phone Number"
                            required
                            error={!!errors.phone}
                            helperText={errors.phone?.message}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <PhoneIcon color="action" />
                                </InputAdornment>
                              ),
                            }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />
                        )}
                      />
                    </Grid>
                  )}
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Email"
                          type="email"
                          disabled={isAudiologist}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="reference"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel id="reference-label">Reference</InputLabel>
                          <Select
                            {...field}
                            labelId="reference-label"
                            label="Reference Source"
                            disabled={isAudiologist}
                            sx={{ borderRadius: 2, minWidth: '200px' }}
                            MenuProps={{
                              PaperProps: {
                                style: {
                                  maxHeight: 300
                                }
                              }
                            }}
                          >
                            {referenceOptions.map(option => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ position: 'relative' }}>
                      <Controller
                        name="assignedTo"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel id="assigned-to-label">Assigned To</InputLabel>
                            <Select
                              {...field}
                              labelId="assigned-to-label"
                              label="Assigned To"
                              disabled={isAudiologist}
                              sx={{ borderRadius: 2, minWidth: '200px' }}
                              MenuProps={{
                                PaperProps: {
                                  style: {
                                    maxHeight: 300
                                  }
                                }
                              }}
                            >
                              {getStaffOptionsForField('assignedTo').map(option => (
                                <MenuItem key={option} value={option}>
                                  {option}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      />
                      {isAdmin && (
                        <IconButton
                          onClick={() => {
                            setCurrentField('assignedTo');
                            setStaffManagementOpen(true);
                          }}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            bgcolor: '#ff6b35',
                            color: 'white',
                            '&:hover': { bgcolor: '#e55a2b' },
                            width: '24px',
                            height: '24px',
                            zIndex: 1
                          }}
                          size="small"
                          title="Edit Assigned To Categories (Admin Only)"
                        >
                          <EditIcon sx={{ fontSize: '14px' }} />
                        </IconButton>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ position: 'relative' }}>
                      <Controller
                        name="telecaller"
                        control={control}
                        render={({ field }) => (
                          <FormControl fullWidth>
                            <InputLabel id="telecaller-label">Telecaller</InputLabel>
                            <Select
                              {...field}
                              labelId="telecaller-label"
                              label="Telecaller"
                              disabled={isAudiologist}
                              sx={{ borderRadius: 2, minWidth: '200px' }}
                              MenuProps={{
                                PaperProps: {
                                  style: {
                                    maxHeight: 300
                                  }
                                }
                              }}
                            >
                              {getStaffOptionsForField('telecaller').map(option => (
                                <MenuItem key={option} value={option}>
                                  {option}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      />
                      {isAdmin && (
                        <IconButton
                          onClick={() => {
                            setCurrentField('telecaller');
                            setStaffManagementOpen(true);
                          }}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            bgcolor: '#ff6b35',
                            color: 'white',
                            '&:hover': { bgcolor: '#e55a2b' },
                            width: '24px',
                            height: '24px',
                            zIndex: 1
                          }}
                          size="small"
                          title="Edit Telecaller Categories (Admin Only)"
                        >
                          <EditIcon sx={{ fontSize: '14px' }} />
                        </IconButton>
                      )}
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="center"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel id="center-label">Center</InputLabel>
                          <Select
                            {...field}
                            labelId="center-label"
                            label="Center"
                            disabled={isAudiologist}
                            sx={{ borderRadius: 2 }}
                          >
                            {centers.map(center => (
                              <MenuItem key={center.id} value={center.id}>
                                {center.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Controller
                      name="message"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Message/Notes"
                          multiline
                          rows={3}
                          disabled={isAudiologist}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>



            {/* Visits Section */}
            <Card elevation={2} sx={{ mb: 4, borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <DateRangeIcon sx={{ color: 'secondary.main', fontSize: 28 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                      Visit Details
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={addVisit}
                    sx={{ borderRadius: 2 }}
                  >
                    Add Visit
                  </Button>
                </Box>

                {/* Visit Tabs */}
                {watchedVisits.length > 0 && (
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs
                      value={activeVisit < 0 ? 0 : activeVisit}
                      onChange={(_, newValue) => setActiveVisit(newValue)}
                      variant="scrollable"
                      scrollButtons="auto"
                    >
                      {watchedVisits.map((visit, index) => (
                        <Tab 
                          key={visit.id}
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography>
                                Visit {index + 1}
                              </Typography>
                              {visit.visitDate && (
                                <Chip 
                                  label={visit.visitDate} 
                                  size="small" 
                                  color="primary" 
                                  variant="outlined" 
                                />
                              )}
                              {watchedVisits.length > 0 && (
                                <Box
                                  component="span"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeVisit(index);
                                  }}
                                  sx={{ 
                                    ml: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    color: 'error.main',
                                    '&:hover': {
                                      backgroundColor: 'error.light',
                                      color: 'error.contrastText'
                                    },
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </Box>
                              )}
                            </Box>
                          }
                          sx={{ textTransform: 'none' }}
                        />
                      ))}
                    </Tabs>
                  </Box>
                )}

                {/* No Visits State */}
                {watchedVisits.length === 0 && (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 8, 
                    bgcolor: 'grey.50', 
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'grey.200',
                    borderStyle: 'dashed',
                    mb: 3
                  }}>
                    <DateRangeIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No visits scheduled yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Add your first visit to start documenting patient care
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={addVisit}
                      sx={{ borderRadius: 2 }}
                    >
                      Add First Visit
                    </Button>
                  </Box>
                )}

                {/* Current Visit Details */}
                {currentVisit && (
                  <Box>
                    {/* Visit Basic Info */}
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          label="Visit Date"
                          type="date"
                          value={currentVisit.visitDate}
                          onChange={(e) => updateVisit(activeVisit, 'visitDate', e.target.value)}
                          disabled={isAudiologist}
                          InputLabelProps={{ shrink: true }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          label="Visit Time"
                          type="time"
                          value={currentVisit.visitTime}
                          onChange={(e) => updateVisit(activeVisit, 'visitTime', e.target.value)}
                          disabled={isAudiologist}
                          InputLabelProps={{ shrink: true }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                          <InputLabel>Visit Type</InputLabel>
                          <Select 
                            value={currentVisit.visitType}
                            onChange={(e) => updateVisit(activeVisit, 'visitType', e.target.value)}
                            label="Visit Type"
                            disabled={isAudiologist}
                            sx={{ borderRadius: 2 }}
                          >
                            <MenuItem value="center">Center Visit</MenuItem>
                            <MenuItem value="home">Home Visit</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ display: 'flex', gap: 2, height: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.hearingTest}
                                onChange={(e) => updateVisit(activeVisit, 'hearingTest', e.target.checked)}
                                disabled={isAudiologist}
                                color="primary"
                              />
                            }
                            label="Hearing Test"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.hearingAidTrial}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAidTrial', e.target.checked)}
                                disabled={isAudiologist}
                                color="info"
                              />
                            }
                            label="Hearing Aid Trial"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.hearingAidBooked}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAidBooked', e.target.checked)}
                                disabled={isAudiologist}
                                color="warning"
                              />
                            }
                            label="Hearing Aid Booked"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.hearingAidSale}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAidSale', e.target.checked)}
                                disabled={isAudiologist}
                                color="success"
                              />
                            }
                            label="Hearing Aid Sale"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.salesReturn}
                                onChange={(e) => updateVisit(activeVisit, 'salesReturn', e.target.checked)}
                                disabled={isAudiologist}
                                color="error"
                              />
                            }
                            label="Sales Return"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.accessory}
                                onChange={(e) => updateVisit(activeVisit, 'accessory', e.target.checked)}
                                disabled={isAudiologist}
                                color="success"
                              />
                            }
                            label="Accessory"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.programming}
                                onChange={(e) => updateVisit(activeVisit, 'programming', e.target.checked)}
                                disabled={isAudiologist}
                                color="warning"
                              />
                            }
                            label="Programming"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.repair}
                                onChange={(e) => updateVisit(activeVisit, 'repair', e.target.checked)}
                                disabled={isAudiologist}
                                color="error"
                              />
                            }
                            label="Repair"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.counselling}
                                onChange={(e) => updateVisit(activeVisit, 'counselling', e.target.checked)}
                                disabled={isAudiologist}
                                color="info"
                              />
                            }
                            label="Counselling"
                          />
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Hearing Test Details */}
                    {currentVisit.hearingTest && (
                      <Card sx={{ mb: 4, bgcolor: 'primary.50', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <MedicalIcon sx={{ color: 'primary.main' }} />
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                              Hearing Test Details
                            </Typography>
                          </Box>
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                label="Test Type"
                                value={currentVisit.testType}
                                onChange={(e) => updateVisit(activeVisit, 'testType', e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Box sx={{ position: 'relative' }}>
                                <FormControl fullWidth>
                                  <InputLabel>Test Done By</InputLabel>
                                  <Select 
                                    value={currentVisit.testDoneBy}
                                    onChange={(e) => updateVisit(activeVisit, 'testDoneBy', e.target.value)}
                                    label="Test Done By"
                                    sx={{ borderRadius: 2 }}
                                  >
                                    {getStaffOptionsForField('testBy').map(option => (
                                      <MenuItem key={option} value={option}>
                                        {option}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                {isAdmin && (
                                  <IconButton
                                    onClick={() => {
                                      setCurrentField('testBy');
                                      setStaffManagementOpen(true);
                                    }}
                                    sx={{
                                      position: 'absolute',
                                      top: 6,
                                      right: 6,
                                      bgcolor: '#ff6b35',
                                      color: 'white',
                                      '&:hover': { bgcolor: '#e55a2b' },
                                      width: '20px',
                                      height: '20px',
                                      zIndex: 1
                                    }}
                                    size="small"
                                    title="Edit Test Done By Categories (Admin Only)"
                                  >
                                    <EditIcon sx={{ fontSize: '12px' }} />
                                  </IconButton>
                                )}
                              </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                label="Test Price"
                                type="number"
                                value={currentVisit.testPrice}
                                onChange={(e) => updateVisit(activeVisit, 'testPrice', Number(e.target.value))}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <RupeeIcon />
                                    </InputAdornment>
                                  ),
                                }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Test Results"
                                multiline
                                rows={3}
                                value={currentVisit.testResults}
                                onChange={(e) => updateVisit(activeVisit, 'testResults', e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Recommendations"
                                multiline
                                rows={3}
                                value={currentVisit.recommendations}
                                onChange={(e) => updateVisit(activeVisit, 'recommendations', e.target.value)}
                                disabled={isAudiologist}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                          </Grid>

                          {/* Pure Tone Audiogram - Only for audiologists to edit, everyone can view */}
                          <Box sx={{ mt: 3 }}>
                            <PureToneAudiogram
                              data={currentVisit.audiogramData}
                              onChange={(data) => updateVisit(activeVisit, 'audiogramData', data)}
                              editable={isAudiologist}
                              readOnly={!isAudiologist}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    )}

                    {/* Hearing Aid Basic Details - only for Trial/Booking (hidden for Sale) */}
                    {(currentVisit.hearingAidTrial || currentVisit.hearingAidBooked) && (
                      <Card sx={{ mb: 4, bgcolor: '#f8f9fa', borderRadius: 2, border: 2, borderColor: 'primary.main' }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <MedicalIcon sx={{ color: 'primary.main' }} />
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                              Hearing Aid Basic Details
                            </Typography>
                          </Box>
                          
                          {/* Journey tracking */}
                          <Box sx={{ mb: 3, p: 2, bgcolor: '#e3f2fd', borderRadius: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 2, color: 'primary.dark' }}>Journey Connection</Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                  <InputLabel>Continue from Previous Visit</InputLabel>
                                  <Select 
                                    value={currentVisit.previousVisitId}
                                    onChange={(e) => {
                                      const prevVisitId = e.target.value;
                                      updateVisit(activeVisit, 'previousVisitId', prevVisitId);
                                      // Auto-populate device details from previous visit
                                      const prevVisit = getValues('visits').find(v => v.id === prevVisitId);
                                      if (prevVisit) {
                                        // Copy from trial (with fallbacks)
                                        if (prevVisit.hearingAidTrial) {
                                          updateVisitFields(activeVisit, {
                                            hearingAidProductId: prevVisit.hearingAidProductId || '',
                                            hearingAidBrand: prevVisit.trialHearingAidBrand || prevVisit.hearingAidBrand || '',
                                            hearingAidModel: prevVisit.trialHearingAidModel || prevVisit.hearingAidModel || '',
                                            hearingAidType: prevVisit.hearingAidType || prevVisit.trialHearingAidType || '',
                                            whichEar: prevVisit.whichEar,
                                            hearingAidPrice: typeof prevVisit.hearingAidPrice === 'number' ? (prevVisit.hearingAidPrice || 0) : 0,
                                            bookingFromTrial: currentVisit.hearingAidBooked ? true : (currentVisit.bookingFromTrial || false),
                                            bookingFromVisitId: currentVisit.hearingAidBooked ? prevVisit.id : (currentVisit.bookingFromVisitId || '')
                                          });
                                        }
                                        // Copy from booking
                                        if (prevVisit.hearingAidBooked) {
                                          updateVisitFields(activeVisit, {
                                            hearingAidProductId: prevVisit.hearingAidProductId || '',
                                            hearingAidBrand: prevVisit.hearingAidBrand || '',
                                            hearingAidModel: prevVisit.hearingAidModel || '',
                                            hearingAidType: prevVisit.hearingAidType || '',
                                            hearingAidPrice: prevVisit.hearingAidPrice || 0,
                                            whichEar: prevVisit.whichEar
                                          });
                                        }
                                      }
                                    }}
                                    label="Continue from Previous Visit"
                                  >
                                    <MenuItem value="">New Journey</MenuItem>
                                    {watchedVisits.slice(0, activeVisit).map((visit, index) => (
                                      (visit.hearingAidTrial || visit.hearingAidBooked || visit.hearingAidSale) && (
                                        <MenuItem key={visit.id} value={visit.id}>
                                          {`Visit ${index + 1} - ${
                                            visit.hearingAidTrial ? 'Trial' : visit.hearingAidBooked ? 'Booking' : 'Sale'
                                          } (${(visit.hearingAidTrial && (visit.trialHearingAidBrand || visit.hearingAidBrand)) || visit.hearingAidBrand || 'No Brand'})`}
                                        </MenuItem>
                                      )
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                {currentVisit.previousVisitId && (
                                  <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                                    <Typography variant="body2" sx={{ fontSize: '0.9rem', color: 'success.dark' }}>
                                      🔗 Connected Journey: Details auto-populated from previous visit
                                    </Typography>
                                  </Box>
                                )}
                              </Grid>
                            </Grid>
                          </Box>
                          
                          {/* Quick Action Buttons */}
                          <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            {watchedVisits.slice(0, activeVisit).some(visit => visit.hearingAidTrial) && (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CheckIcon />}
                                onClick={() => {
                                  const trialVisit = getValues('visits').slice(0, activeVisit).find(visit => visit.hearingAidTrial);
                                  if (trialVisit) {
                                    updateVisitFields(activeVisit, {
                                      hearingAidProductId: trialVisit.hearingAidProductId || '',
                                      hearingAidBrand: trialVisit.trialHearingAidBrand || trialVisit.hearingAidBrand || '',
                                      hearingAidModel: trialVisit.trialHearingAidModel || trialVisit.hearingAidModel || '',
                                      hearingAidType: trialVisit.hearingAidType || '',
                                      whichEar: trialVisit.whichEar || 'both',
                                      previousVisitId: trialVisit.id,
                                      hearingAidPrice: typeof trialVisit.hearingAidPrice === 'number' ? (trialVisit.hearingAidPrice || 0) : 0,
                                      bookingFromTrial: currentVisit.hearingAidBooked ? true : (currentVisit.bookingFromTrial || false),
                                      bookingFromVisitId: currentVisit.hearingAidBooked ? trialVisit.id : (currentVisit.bookingFromVisitId || ''),
                                      products: trialVisit.products || [],
                                      grossMRP: trialVisit.grossMRP || 0,
                                      grossSalesBeforeTax: trialVisit.grossSalesBeforeTax || 0,
                                      taxAmount: trialVisit.taxAmount || 0,
                                      salesAfterTax: trialVisit.salesAfterTax || 0
                                    });
                                  }
                                }}
                                sx={{ color: 'info.main', borderColor: 'info.main' }}
                              >
                                Same as Trial
                              </Button>
                            )}
                            {watchedVisits.slice(0, activeVisit).some(visit => visit.hearingAidBooked) && (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CheckIcon />}
                                onClick={() => {
                                  const bookingVisit = getValues('visits').slice(0, activeVisit).find(visit => visit.hearingAidBooked);
                                  if (bookingVisit) {
                                    updateVisitFields(activeVisit, {
                                      hearingAidProductId: bookingVisit.hearingAidProductId || '',
                                      hearingAidBrand: bookingVisit.hearingAidBrand || '',
                                      hearingAidModel: bookingVisit.hearingAidModel || '',
                                      hearingAidType: bookingVisit.hearingAidType || '',
                                      hearingAidPrice: bookingVisit.hearingAidPrice || 0,
                                      whichEar: bookingVisit.whichEar || 'both',
                                      previousVisitId: bookingVisit.id,
                                      products: bookingVisit.products || [],
                                      grossMRP: bookingVisit.grossMRP || 0,
                                      grossSalesBeforeTax: bookingVisit.grossSalesBeforeTax || 0,
                                      taxAmount: bookingVisit.taxAmount || 0,
                                      salesAfterTax: bookingVisit.salesAfterTax || 0
                                    });
                                  }
                                }}
                                sx={{ color: 'warning.main', borderColor: 'warning.main' }}
                              >
                                Same as Booked
                              </Button>
                            )}
                          </Box>

                          {/* Product Selection (hidden when using trial device) */}
                          {!isUsingTrialDevice && (
                            <Box sx={{ mb: 3, p: 2, bgcolor: '#f3e5f5', borderRadius: 2 }}>
                              <Typography variant="subtitle2" sx={{ mb: 2, color: 'secondary.dark' }}>Select from Products Database</Typography>
                              <Grid container spacing={2}>
                                <Grid item xs={12} md={8}>
                                  <FormControl fullWidth>
                                    <InputLabel>Choose Hearing Aid Product</InputLabel>
                                    <Select 
                                      value={currentVisit.hearingAidProductId || ''}
                                      onChange={(e) => {
                                        const selectedProductId = e.target.value as string;
                                        if (selectedProductId) {
                                          const selectedProduct = hearingAidProducts.find(p => p.id === selectedProductId);
                                          if (selectedProduct) {
                                            updateVisit(activeVisit, 'hearingAidProductId', selectedProduct.id);
                                            updateVisit(activeVisit, 'hearingAidBrand', selectedProduct.company || '');
                                            updateVisit(activeVisit, 'hearingAidModel', selectedProduct.name || '');
                                            updateVisit(activeVisit, 'hearingAidType', selectedProduct.type || '');
                                            updateVisit(activeVisit, 'hearingAidPrice', selectedProduct.mrp || 0);
                                          }
                                        }
                                      }}
                                      label="Choose Hearing Aid Product"
                                      displayEmpty
                                    >
                                      <MenuItem value="">Select a product...</MenuItem>
                                      {hearingAidProducts.map((product) => (
                                        <MenuItem key={product.id} value={product.id}>
                                          {product.company} {product.name} - ₹{(product.mrp || 0).toLocaleString()}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <Button
                                    variant="text"
                                    size="small"
                                    onClick={() => {
                                      // Clear all fields
                                      updateVisit(activeVisit, 'hearingAidProductId', '');
                                      updateVisit(activeVisit, 'hearingAidBrand', '');
                                      updateVisit(activeVisit, 'hearingAidModel', '');
                                      updateVisit(activeVisit, 'hearingAidType', '');
                                      updateVisit(activeVisit, 'hearingAidPrice', 0);
                                    }}
                                    sx={{ height: 'fit-content', mt: 1 }}
                                  >
                                    Clear Selection
                                  </Button>
                                </Grid>
                              </Grid>
                            </Box>
                          )}

                          {/* Device Details */}
                          {!isUsingTrialDevice ? (
                            <Grid container spacing={3}>
                              <Grid item xs={12} md={3}>
                                <TextField
                                  fullWidth
                                  label="Device Brand"
                                  value={brandDisplay}
                                  onChange={(e) => updateVisit(activeVisit, 'hearingAidBrand', e.target.value)}
                                  helperText="Select from products above"
                                  disabled
                                />
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <TextField
                                  fullWidth
                                  label="Device Model"
                                  value={modelDisplay}
                                  onChange={(e) => updateVisit(activeVisit, 'hearingAidModel', e.target.value)}
                                  disabled
                                />
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <TextField
                                  fullWidth
                                  label="Device Type"
                                  value={currentVisit.hearingAidType}
                                  onChange={(e) => updateVisit(activeVisit, 'hearingAidType', e.target.value)}
                                  placeholder="RIC, BTE, ITC..."
                                />
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <FormControl fullWidth>
                                  <InputLabel>Which Ear</InputLabel>
                                  <Select 
                                    value={currentVisit.whichEar}
                                    onChange={(e) => updateVisit(activeVisit, 'whichEar', e.target.value)}
                                    label="Which Ear"
                                  >
                                    <MenuItem value="left">Left</MenuItem>
                                    <MenuItem value="right">Right</MenuItem>
                                    <MenuItem value="both">Both</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <TextField
                                  fullWidth
                                  label="MRP"
                                  type="number"
                                  value={currentVisit.hearingAidPrice}
                                  onChange={(e) => updateVisit(activeVisit, 'hearingAidPrice', parseFloat(e.target.value) || 0)}
                                  disabled={currentVisit.hearingAidBooked}
                                  InputProps={{
                                    startAdornment: <InputAdornment position="start">₹</InputAdornment>
                                  }}
                                />
                              </Grid>
                            </Grid>
                          ) : (
                            // Read-only summary when using trial device
                            <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Using Trial Device Details</Typography>
                              <Grid container spacing={2}>
                                <Grid item xs={12} md={4}>
                                  <Typography variant="body2">Brand/Model</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    {currentVisit.hearingAidBrand} {currentVisit.hearingAidModel}
                                  </Typography>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                  <Typography variant="body2">Type / Ear</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    {currentVisit.hearingAidType} / {currentVisit.whichEar}
                                  </Typography>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                  <Typography variant="body2">MRP</Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    ₹ {Number(currentVisit.hearingAidPrice || 0).toLocaleString()}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Hearing Aid Trial Section */}
                    {currentVisit.hearingAidTrial && (
                      <Card sx={{ mb: 4, bgcolor: '#f0f8ff', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <MedicalIcon sx={{ color: 'info.main' }} />
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
                              Trial Specific Details
                            </Typography>
                          </Box>
                          
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth>
                                <InputLabel>Trial Type</InputLabel>
                                <Select 
                                  value={currentVisit.trialHearingAidType}
                                  onChange={(e) => {
                                    const trialType = e.target.value;
                                    updateVisit(activeVisit, 'trialHearingAidType', trialType);
                                    
                                    // Clear date fields if switching to office trial
                                    if (trialType === 'in_office') {
                                      updateVisit(activeVisit, 'trialDuration', 0);
                                      updateVisit(activeVisit, 'trialStartDate', '');
                                      updateVisit(activeVisit, 'trialEndDate', '');
                                    }
                                  }}
                                  label="Trial Type"
                                >
                                  <MenuItem value="in_office">In-Office Trial</MenuItem>
                                  <MenuItem value="home">Home Trial</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>

                            {/* Only show duration and date fields for home trials */}
                            {currentVisit.trialHearingAidType === 'home' && (
                              <>
                            <Grid item xs={12} md={3}>
                              <TextField
                                fullWidth
                                label="Trial Period (Days)"
                                type="number"
                                value={currentVisit.trialDuration}
                                    onChange={(e) => {
                                      const duration = parseInt(e.target.value) || 0;
                                      updateVisit(activeVisit, 'trialDuration', duration);
                                      
                                      // Auto-calculate end date if start date is set
                                      if (currentVisit.trialStartDate && duration > 0) {
                                        const startDate = new Date(currentVisit.trialStartDate);
                                        const endDate = new Date(startDate.getTime() + (duration * 24 * 60 * 60 * 1000));
                                        updateVisit(activeVisit, 'trialEndDate', endDate.toISOString().split('T')[0]);
                                      }
                                    }}
                              />
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <TextField
                                fullWidth
                                label="Trial Start Date"
                                type="date"
                                value={currentVisit.trialStartDate}
                                    onChange={(e) => {
                                      updateVisit(activeVisit, 'trialStartDate', e.target.value);
                                      
                                      // Auto-calculate end date
                                      if (e.target.value && currentVisit.trialDuration > 0) {
                                        const startDate = new Date(e.target.value);
                                        const endDate = new Date(startDate.getTime() + (currentVisit.trialDuration * 24 * 60 * 60 * 1000));
                                        updateVisit(activeVisit, 'trialEndDate', endDate.toISOString().split('T')[0]);
                                      }
                                    }}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                                <Grid item xs={12} md={2}>
                              <TextField
                                fullWidth
                                label="Trial End Date"
                                type="date"
                                value={currentVisit.trialEndDate}
                                onChange={(e) => updateVisit(activeVisit, 'trialEndDate', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                              </>
                            )}

                            {/* Serial Number Selection for Home Trials */}
                            {currentVisit.trialHearingAidType === 'home' && (
                              <Grid item xs={12} md={6}>
                                <Button
                                  fullWidth
                                  variant="outlined"
                                  onClick={() => setInventoryDialogOpen(true)}
                                  sx={{ 
                                    height: 56,
                                    justifyContent: 'flex-start',
                                    pl: 2
                                  }}
                                  startIcon={<InventoryIcon />}
                                >
                                  {currentVisit.trialSerialNumber ? 
                                    `Selected: ${currentVisit.trialSerialNumber}` : 
                                    'Select Hearing Aid from Inventory'
                                  }
                                </Button>
                          </Grid>
                            )}

                            {/* Display Selected Hearing Aid Details for Home Trials */}
                            {currentVisit.trialHearingAidType === 'home' && currentVisit.trialSerialNumber && (
                              <Grid item xs={12}>
                                <Card sx={{ bgcolor: '#e8f5e8', border: '1px solid #4caf50' }}>
                                  <CardContent sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" color="success.main" gutterBottom>
                                      Selected Hearing Aid for Trial:
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                      <Box>
                                        <Typography variant="body2" color="text.secondary">Serial Number:</Typography>
                                        <Typography variant="body1" fontWeight="medium">{currentVisit.trialSerialNumber}</Typography>
                                      </Box>
                                      {currentVisit.trialHearingAidBrand && (
                                        <Box>
                                          <Typography variant="body2" color="text.secondary">Brand:</Typography>
                                          <Typography variant="body1" fontWeight="medium">{currentVisit.trialHearingAidBrand}</Typography>
                                        </Box>
                                      )}
                                      {currentVisit.trialHearingAidModel && (
                                        <Box>
                                          <Typography variant="body2" color="text.secondary">Model:</Typography>
                                          <Typography variant="body1" fontWeight="medium">{currentVisit.trialHearingAidModel}</Typography>
                                        </Box>
                                      )}
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            )}

                            {/* Trial Notes */}
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                label="Trial Notes"
                                multiline
                                rows={3}
                                value={currentVisit.trialNotes}
                                onChange={(e) => updateVisit(activeVisit, 'trialNotes', e.target.value)}
                              />
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )}

                    {/* Hearing Aid Booked Section (only when booking and not sale) */}
                    {currentVisit.hearingAidBooked && !currentVisit.hearingAidSale && (
                      <Card sx={{ mb: 4, bgcolor: '#fffbf0', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <MedicalIcon sx={{ color: 'warning.main' }} />
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'warning.main' }}>
                              Booking Specific Details
                            </Typography>
                          </Box>
                          
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Booking Amount"
                                type="number"
                                value={currentVisit.bookingAdvanceAmount}
                                onChange={(e) => updateVisit(activeVisit, 'bookingAdvanceAmount', parseFloat(e.target.value) || 0)}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Booking Date"
                                type="date"
                                value={currentVisit.bookingDate || currentVisit.visitDate}
                                onChange={(e) => updateVisit(activeVisit, 'bookingDate', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                              />
                            </Grid>
                          </Grid>

                          {/* Read-only display of MRP for reference */}
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="body2" color="text.secondary">MRP</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              ₹ {Number(currentVisit.hearingAidPrice || 0).toLocaleString()}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    )}

                    {/* Hearing Aid Sale Section */}
                    {currentVisit.hearingAidSale && (
                      <Card sx={{ mb: 4, bgcolor: 'secondary.50', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <MedicalIcon sx={{ color: 'secondary.main' }} />
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                              Hearing Aid Details
                            </Typography>
                          </Box>

                          {/* If this sale follows a booking, show a compact booking advance summary */}
                          {currentVisit.previousVisitId && (() => {
                            const prev = getValues('visits').find(v => v.id === currentVisit.previousVisitId);
                            return prev && prev.hearingAidBooked && prev.bookingAdvanceAmount > 0 ? (
                              <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.50', borderRadius: 1, border: 1, borderColor: 'warning.100' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.dark' }}>
                                  Booking Advance: {formatCurrency(prev.bookingAdvanceAmount)} on {prev.bookingDate || prev.visitDate}
                                </Typography>
                                {(prev.hearingAidBrand || prev.hearingAidModel) && (
                                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    Booked Device: {(prev.hearingAidBrand || '').toString()} {(prev.hearingAidModel || '').toString()}
                                  </Typography>
                                )}
                              </Box>
                            ) : null;
                          })()}

                          {/* Show device names from Trial and Booking journeys when auto-population is not used */}
                          {(() => {
                            const priorVisits = getValues('visits').slice(0, activeVisit);
                            const lastTrial = [...priorVisits].reverse().find(v => v.hearingAidTrial);
                            const trialBrand = lastTrial?.trialHearingAidBrand || lastTrial?.hearingAidBrand || '';
                            const trialModel = lastTrial?.trialHearingAidModel || lastTrial?.hearingAidModel || '';
                            const showTrial = !!(trialBrand || trialModel);
                            if (!showTrial) return null;
                            return (
                              <Box sx={{ mb: 2, p: 2, bgcolor: 'info.50', borderRadius: 1, border: 1, borderColor: 'info.100' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'info.dark' }}>
                                  Trial Device: {trialBrand} {trialModel}
                                </Typography>
                                {lastTrial?.trialStartDate && (
                                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    Trial Period: {lastTrial.trialStartDate}{lastTrial.trialEndDate ? ` → ${lastTrial.trialEndDate}` : ''}
                                  </Typography>
                                )}
                              </Box>
                            );
                          })()}

                          {/* Sale-specific quick fields */}
                          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={3}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Which Ear</InputLabel>
                                  <Select
                                    value={currentVisit.whichEar}
                                    label="Which Ear"
                                    onChange={(e) => updateVisit(activeVisit, 'whichEar', e.target.value)}
                                    sx={{ borderRadius: 2 }}
                                  >
                                    <MenuItem value="left">Left</MenuItem>
                                    <MenuItem value="right">Right</MenuItem>
                                    <MenuItem value="both">Both</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <Box sx={{ position: 'relative' }}>
                                  <FormControl fullWidth size="small">
                                    <InputLabel>Who Sold</InputLabel>
                                    <Select
                                      value={currentVisit.hearingAidBrand}
                                      onChange={(e) => updateVisit(activeVisit, 'hearingAidBrand', e.target.value)}
                                      label="Who Sold"
                                      sx={{ borderRadius: 2 }}
                                    >
                                      {getStaffOptionsForField('sales').map(option => (
                                        <MenuItem key={option} value={option}>
                                          💼 {option}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                  {isAdmin && (
                                    <IconButton
                                      onClick={() => {
                                        setCurrentField('sales');
                                        setStaffManagementOpen(true);
                                      }}
                                      sx={{
                                        position: 'absolute',
                                        top: 4,
                                        right: 4,
                                        bgcolor: '#ff6b35',
                                        color: 'white',
                                        '&:hover': { bgcolor: '#e55a2b' },
                                        width: '20px',
                                        height: '20px',
                                        zIndex: 1
                                      }}
                                      size="small"
                                      title="Edit Who Sold Categories (Admin Only)"
                                    >
                                      <EditIcon sx={{ fontSize: '12px' }} />
                                    </IconButton>
                                  )}
                                </Box>
                              </Grid>
                            </Grid>
                          </Box>

                          {/* Quick actions to import from previous visit (visible in Sale too) */}
                          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            {getValues('visits').slice(0, activeVisit).some(v => v.hearingAidTrial) && (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CheckIcon />}
                                onClick={() => {
                                  const trialVisit = getValues('visits').slice(0, activeVisit).find(v => v.hearingAidTrial);
                                  if (trialVisit) {
                                    const products = trialVisit.products || [];
                                    const totals = {
                                      grossMRP: products.reduce((s, p) => s + (p.mrp || 0), 0),
                                      grossSalesBeforeTax: products.reduce((s, p) => s + (p.sellingPrice || 0), 0),
                                      taxAmount: products.reduce((s, p) => s + (p.gstAmount || 0), 0),
                                      salesAfterTax: products.reduce((s, p) => s + (p.finalAmount || 0), 0)
                                    };
                                    updateVisitFields(activeVisit, {
                                      previousVisitId: trialVisit.id,
                                      hearingAidProductId: trialVisit.hearingAidProductId || '',
                                      hearingAidBrand: trialVisit.trialHearingAidBrand || trialVisit.hearingAidBrand || '',
                                      hearingAidModel: trialVisit.trialHearingAidModel || trialVisit.hearingAidModel || '',
                                      hearingAidType: trialVisit.hearingAidType || '',
                                      whichEar: trialVisit.whichEar || 'both',
                                      hearingAidPrice: typeof trialVisit.hearingAidPrice === 'number' ? (trialVisit.hearingAidPrice || 0) : 0,
                                      products,
                                      ...totals
                                    });
                                  }
                                }}
                                sx={{ color: 'info.main', borderColor: 'info.main' }}
                              >
                                Same as Trial
                              </Button>
                            )}
                            {getValues('visits').slice(0, activeVisit).some(v => v.hearingAidBooked) && (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CheckIcon />}
                                onClick={() => {
                                  const bookingVisit = getValues('visits').slice(0, activeVisit).find(v => v.hearingAidBooked);
                                  if (bookingVisit) {
                                    const products = bookingVisit.products || [];
                                    updateVisitFields(activeVisit, {
                                      previousVisitId: bookingVisit.id,
                                      hearingAidProductId: bookingVisit.hearingAidProductId || '',
                                      hearingAidBrand: bookingVisit.hearingAidBrand || '',
                                      hearingAidModel: bookingVisit.hearingAidModel || '',
                                      hearingAidType: bookingVisit.hearingAidType || '',
                                      whichEar: bookingVisit.whichEar || 'both',
                                      hearingAidPrice: bookingVisit.hearingAidPrice || 0,
                                      products,
                                      grossMRP: bookingVisit.grossMRP || products.reduce((s, p) => s + (p.mrp || 0), 0),
                                      grossSalesBeforeTax: bookingVisit.grossSalesBeforeTax || products.reduce((s, p) => s + (p.sellingPrice || 0), 0),
                                      taxAmount: bookingVisit.taxAmount || products.reduce((s, p) => s + (p.gstAmount || 0), 0),
                                      salesAfterTax: bookingVisit.salesAfterTax || products.reduce((s, p) => s + (p.finalAmount || 0), 0)
                                    });
                                  }
                                }}
                                sx={{ color: 'warning.main', borderColor: 'warning.main' }}
                              >
                                Same as Booked
                              </Button>
                            )}
                          </Box>

                          {/* Hearing Aid Journey Tracking */}
                          <Box sx={{ mb: 4, p: 3, bgcolor: '#f5f5f5', borderRadius: 2, border: 1, borderColor: '#e0e0e0' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#666' }}>
                              Journey Tracking
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={4}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Continue from Previous Visit</InputLabel>
                                  <Select 
                                    value={currentVisit.previousVisitId}
                                    onChange={(e) => {
                                      const prevVisitId = e.target.value;
                                      updateVisit(activeVisit, 'previousVisitId', prevVisitId);
                                      
                                      if (prevVisitId) {
                                        // Find the previous visit and copy relevant data
                                        const previousVisit = watchedVisits.find(v => v.id === prevVisitId);
                                        if (previousVisit) {
                                          // Copy hearing aid journey ID or create new one
                                          const journeyId = previousVisit.hearingAidJourneyId || `journey_${Date.now()}`;
                                          updateVisit(activeVisit, 'hearingAidJourneyId', journeyId);
                                          
                                          // Copy basic hearing aid info if available
                                          if (previousVisit.hearingAidBrand) {
                                            updateVisit(activeVisit, 'hearingAidBrand', previousVisit.hearingAidBrand);
                                            updateVisit(activeVisit, 'hearingAidModel', previousVisit.hearingAidModel);
                                            updateVisit(activeVisit, 'hearingAidType', previousVisit.hearingAidType);
                                            updateVisit(activeVisit, 'whichEar', previousVisit.whichEar);
                                          }
                                          
                                          // Set journey stage based on previous visit
                                          if (previousVisit.hearingAidStatus === 'trial_given') {
                                            updateVisit(activeVisit, 'journeyStage', 'booking');
                                          } else if (previousVisit.hearingAidStatus === 'booked') {
                                            updateVisit(activeVisit, 'journeyStage', 'sale');
                                          }
                                        }
                                      }
                                    }}
                                    label="Continue from Previous Visit"
                                    sx={{ borderRadius: 2 }}
                                  >
                                    <MenuItem value="">New Journey</MenuItem>
                                    {watchedVisits.slice(0, activeVisit).map((visit, index) => (
                                      (visit.hearingAidTrial || visit.hearingAidBooked || visit.hearingAidSale) && (
                                        <MenuItem key={visit.id} value={visit.id}>
                                          Visit {index + 1} - {visit.hearingAidStatus?.replace('_', ' ')} 
                                          {visit.hearingAidBrand && ` (${visit.hearingAidBrand})`}
                                        </MenuItem>
                                      )
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              {/* Journey Stage - hidden per requirements */}
                              <Grid item xs={12} md={4}>
                                {currentVisit.hearingAidJourneyId && (
                                  <Box sx={{ p: 1, bgcolor: 'success.light', borderRadius: 1 }}>
                                    <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'success.dark' }}>
                                      🔗 Linked Journey: {currentVisit.hearingAidJourneyId.slice(-8)}
                                    </Typography>
                                  </Box>
                                )}
                              </Grid>
                            </Grid>
                            
                            {/* Journey Progress Indicator */}
                            {currentVisit.previousVisitId && (
                              <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                                  Journey Progress:
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  {(() => {
                                    const prevVisit = watchedVisits.find(v => v.id === currentVisit.previousVisitId);
                                    if (!prevVisit) return null;
                                    
                                    const stages = [];
                                    if (prevVisit.hearingAidStatus === 'trial_given') {
                                      stages.push({ label: 'Trial Given', color: 'info' });
                                    }
                                    if (prevVisit.hearingAidStatus === 'booked') {
                                      stages.push({ label: 'Booked', color: 'warning' });
                                    }
                                    if (prevVisit.hearingAidStatus === 'sold') {
                                      stages.push({ label: 'Sold', color: 'success' });
                                    }
                                    
                                    return stages.map((stage, index) => (
                                      <Chip 
                                        key={index}
                                        label={stage.label} 
                                        size="small" 
                                        color={stage.color as any}
                                        variant="outlined"
                                      />
                                    ));
                                  })()}
                                  <Typography variant="body2" sx={{ mx: 1 }}>→</Typography>
                                  <Chip 
                                    label="Current Visit" 
                                    size="small" 
                                    color="primary"
                                  />
                                </Box>
                              </Box>
                            )}
                          </Box>
                          
                          {/* Basic Hearing Aid Info - hide when Sale is selected */}
                          {!currentVisit.hearingAidSale && (
                          <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid item xs={12} md={3}>
                              <TextField
                                fullWidth
                                label="Hearing Aid Type"
                                value={currentVisit.hearingAidType}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAidType', e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <TextField
                                fullWidth
                                label="Brand"
                                value={currentVisit.hearingAidBrand}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAidBrand', e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <FormControl fullWidth>
                                <InputLabel>Which Ear</InputLabel>
                                <Select 
                                  value={currentVisit.whichEar}
                                  onChange={(e) => updateVisit(activeVisit, 'whichEar', e.target.value)}
                                  label="Which Ear"
                                  sx={{ borderRadius: 2 }}
                                >
                                  <MenuItem value="left">Left</MenuItem>
                                  <MenuItem value="right">Right</MenuItem>
                                  <MenuItem value="both">Both</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                                                  <Select 
                                    value={currentVisit.hearingAidStatus}
                                    onChange={(e) => updateVisit(activeVisit, 'hearingAidStatus', e.target.value)}
                                    label="Status"
                                    sx={{ borderRadius: 2 }}
                                  >
                                    <MenuItem value="trial_given">Trial Given</MenuItem>
                                    <MenuItem value="booked">Booked</MenuItem>
                                    <MenuItem value="sold">Sold</MenuItem>
                                    <MenuItem value="not_interested">Not Interested</MenuItem>
                                  </Select>
                              </FormControl>
                            </Grid>
                          </Grid>
                          )}

                          {/* Trial Details Section */}
                          {currentVisit.hearingAidStatus === 'trial_given' && (
                            <Box sx={{ mb: 4, p: 3, bgcolor: '#f0f8ff', borderRadius: 2, border: 1, borderColor: '#e3f2fd' }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#1976d2' }}>
                                Trial Details
                              </Typography>
                              <Grid container spacing={3}>
                                <Grid item xs={12} md={4}>
                                  <FormControl fullWidth>
                                    <InputLabel>Trial Type</InputLabel>
                                    <Select 
                                      value={currentVisit.trialHearingAidType}
                                      onChange={(e) => {
                                        const trialType = e.target.value;
                                        updateVisit(activeVisit, 'trialHearingAidType', trialType);
                                        
                                        // Clear date fields if switching to office trial
                                        if (trialType === 'in_office') {
                                          updateVisit(activeVisit, 'trialDuration', 0);
                                          updateVisit(activeVisit, 'trialStartDate', '');
                                          updateVisit(activeVisit, 'trialEndDate', '');
                                        }
                                      }}
                                      label="Trial Type"
                                      sx={{ borderRadius: 2 }}
                                    >
                                      <MenuItem value="in_office">In-Office Trial</MenuItem>
                                      <MenuItem value="home">Home Trial</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Grid>

                                {/* Only show duration and date fields for home trials */}
                                {currentVisit.trialHearingAidType === 'home' && (
                                  <>
                                <Grid item xs={12} md={4}>
                                  <TextField
                                    fullWidth
                                    label="Trial Period (Days)"
                                    type="number"
                                    value={currentVisit.trialDuration}
                                    onChange={(e) => {
                                      const duration = parseInt(e.target.value) || 0;
                                      updateVisit(activeVisit, 'trialDuration', duration);
                                      
                                      // Auto-calculate end date if start date is set
                                      if (currentVisit.trialStartDate && duration > 0) {
                                        const startDate = new Date(currentVisit.trialStartDate);
                                        const endDate = new Date(startDate.getTime() + (duration * 24 * 60 * 60 * 1000));
                                        updateVisit(activeVisit, 'trialEndDate', endDate.toISOString().split('T')[0]);
                                      }
                                    }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                  />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <TextField
                                    fullWidth
                                    label="Trial Start Date"
                                    type="date"
                                    value={currentVisit.trialStartDate}
                                    onChange={(e) => {
                                      updateVisit(activeVisit, 'trialStartDate', e.target.value);
                                      
                                      // Auto-calculate end date
                                      if (e.target.value && currentVisit.trialDuration > 0) {
                                        const startDate = new Date(e.target.value);
                                        const endDate = new Date(startDate.getTime() + (currentVisit.trialDuration * 24 * 60 * 60 * 1000));
                                        updateVisit(activeVisit, 'trialEndDate', endDate.toISOString().split('T')[0]);
                                      }
                                    }}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                  />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                  <TextField
                                    fullWidth
                                    label="Trial End Date"
                                    type="date"
                                    value={currentVisit.trialEndDate}
                                    onChange={(e) => updateVisit(activeVisit, 'trialEndDate', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                      />
                                    </Grid>
                                  </>
                                )}

                                {/* Serial Number Selection for Home Trials */}
                                {currentVisit.trialHearingAidType === 'home' && (
                                  <Grid item xs={12} md={6}>
                                    <Button
                                      fullWidth
                                      variant="outlined"
                                      onClick={() => setInventoryDialogOpen(true)}
                                      sx={{ 
                                        height: 56,
                                        borderRadius: 2,
                                        justifyContent: 'flex-start',
                                        pl: 2
                                      }}
                                      startIcon={<InventoryIcon />}
                                    >
                                      {currentVisit.trialSerialNumber ? 
                                        `Selected: ${currentVisit.trialSerialNumber}` : 
                                        'Select Hearing Aid from Inventory'
                                      }
                                    </Button>
                                  </Grid>
                                )}

                                {/* Trial Notes */}
                                <Grid item xs={12}>
                                  <TextField
                                    fullWidth
                                    label="Trial Notes"
                                    multiline
                                    rows={3}
                                    value={currentVisit.trialNotes}
                                    onChange={(e) => updateVisit(activeVisit, 'trialNotes', e.target.value)}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                  />
                                </Grid>
                              </Grid>
                            </Box>
                          )}

                          {/* Booking Details Section (only when booking is active and NOT a sale) */}
                          {currentVisit.hearingAidBooked && !currentVisit.hearingAidSale && (
                            <Box sx={{ mb: 4, p: 3, bgcolor: '#fffbf0', borderRadius: 2, border: 1, borderColor: '#fff3e0' }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#f57c00' }}>
                                Booking Details
                              </Typography>
                              
                              {/* Show relationship to previous visit */}
                              {currentVisit.previousVisitId && (
                                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(245, 124, 0, 0.1)', borderRadius: 1, border: 1, borderColor: 'rgba(245, 124, 0, 0.2)' }}>
                                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#f57c00' }}>
                                    📋 Booking following: {(() => {
                                      const prevVisit = watchedVisits.find(v => v.id === currentVisit.previousVisitId);
                                      if (prevVisit?.hearingAidStatus === 'trial_given') {
                                        return `Trial from Visit ${watchedVisits.findIndex(v => v.id === currentVisit.previousVisitId) + 1}`;
                                      }
                                      return `Previous visit ${watchedVisits.findIndex(v => v.id === currentVisit.previousVisitId) + 1}`;
                                    })()}
                                  </Typography>
                                </Box>
                              )}
                              
                              <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                  <TextField
                                    fullWidth
                                    label="Booking Amount"
                                    type="number"
                                    value={currentVisit.bookingAdvanceAmount}
                                    onChange={(e) => updateVisit(activeVisit, 'bookingAdvanceAmount', parseFloat(e.target.value) || 0)}
                                    InputProps={{
                                      startAdornment: (
                                        <InputAdornment position="start">
                                          <RupeeIcon />
                                        </InputAdornment>
                                      ),
                                    }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                  />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                  <TextField
                                    fullWidth
                                    label="Booking Date"
                                    type="date"
                                    value={currentVisit.bookingDate}
                                    onChange={(e) => updateVisit(activeVisit, 'bookingDate', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                  />
                                </Grid>
                              </Grid>
                            </Box>
                          )}



                          {/* Product Addition Form */}
                          <Box sx={{ mb: 4, p: 3, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              Add Hearing Aid Product
                            </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                💡 GST will be auto-calculated based on product settings
                              </Typography>
                            </Box>
                            <Grid container spacing={2} alignItems="end">
                              <Grid item xs={12} md={4}>
                                <Button
                                  fullWidth
                                  variant="outlined"
                                  size="large"
                                  onClick={() => setInventoryDialogOpen(true)}
                                  startIcon={<InventoryIcon />}
                                  sx={{
                                    height: '56px',
                                    borderStyle: 'dashed',
                                    borderWidth: 2,
                                    borderColor: currentProduct.inventoryId ? 'success.main' : 'grey.400',
                                    backgroundColor: currentProduct.inventoryId ? 'success.50' : 'transparent',
                                    '&:hover': {
                                      borderColor: currentProduct.inventoryId ? 'success.dark' : 'primary.main',
                                      backgroundColor: currentProduct.inventoryId ? 'success.100' : 'primary.50'
                                    }
                                  }}
                                >
                                  {currentProduct.inventoryId ? (
                                    <Box sx={{ textAlign: 'left', width: '100%' }}>
                                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.dark' }}>
                                        {currentProduct.name} - {currentProduct.company}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'success.main' }}>
                                        SN: {currentProduct.serialNumber} | ₹{currentProduct.mrp?.toLocaleString()}
                                      </Typography>
                                        </Box>
                                  ) : (
                                    <Typography>
                                      Select Hearing Aid from Inventory ({availableInventory.length} available)
                                    </Typography>
                                  )}
                                </Button>
                              </Grid>
                              <Grid item xs={12} md={2}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Product Name"
                                  value={currentProduct.name}
                                  onChange={(e) => setCurrentProduct(prev => ({ ...prev, name: e.target.value }))}
                                />
                              </Grid>
                              <Grid item xs={12} md={1}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="HSN"
                                  value={currentProduct.hsnCode}
                                  onChange={(e) => setCurrentProduct(prev => ({ ...prev, hsnCode: e.target.value }))}
                                />
                              </Grid>
                              <Grid item xs={12} md={1}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Serial No."
                                  value={currentProduct.serialNumber}
                                  onChange={(e) => setCurrentProduct(prev => ({ ...prev, serialNumber: e.target.value }))}
                                />
                              </Grid>
                              <Grid item xs={12} md={1}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="MRP"
                                  type="number"
                                  value={currentProduct.mrp}
                                  onChange={(e) => {
                                    const newMrp = Number(e.target.value);
                                    setCurrentProduct(prev => ({ 
                                      ...prev, 
                                      mrp: newMrp,
                                      sellingPrice: newMrp > 0 ? newMrp : prev.sellingPrice
                                    }));
                                  }}
                                />
                              </Grid>
                              <Grid item xs={12} md={1}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Selling Price"
                                  type="number"
                                  value={currentProduct.sellingPrice}
                                  onChange={(e) => updateSellingPrice(Number(e.target.value))}
                                />
                              </Grid>
                              <Grid item xs={12} md={1}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Discount %"
                                  type="number"
                                  value={currentProduct.discountPercent}
                                  onChange={(e) => updateDiscountPercent(Number(e.target.value))}
                                />
                              </Grid>
                              <Grid item xs={12} md={1}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label={currentProduct.gstPercent === 0 ? "GST % (Exempt)" : "GST %"}
                                  type="number"
                                  value={currentProduct.gstPercent}
                                  onChange={(e) => setCurrentProduct(prev => ({ ...prev, gstPercent: Number(e.target.value) }))}
                                  disabled={currentProduct.productId !== '' && currentProduct.gstPercent === 0}
                                  sx={{
                                    '& .MuiInputBase-input': {
                                      color: currentProduct.gstPercent === 0 ? 'text.secondary' : 'text.primary'
                                    },
                                    '& .MuiInputLabel-root': {
                                      color: currentProduct.gstPercent === 0 ? 'warning.main' : 'text.secondary'
                                    }
                                  }}
                                />
                              </Grid>
                              <Grid item xs={12} md={1}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Warranty"
                                  value={currentProduct.warranty}
                                  onChange={(e) => setCurrentProduct(prev => ({ ...prev, warranty: e.target.value }))}
                                />
                              </Grid>
                            </Grid>
                            
                            {/* Calculated Values Display */}
                            {currentProduct.mrp > 0 && (
                              <Grid container spacing={2} sx={{ mt: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                <Grid item xs={3}>
                                  <Typography variant="body2" color="text.secondary">Discount Amount</Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main' }}>
                                    {formatCurrency(currentProduct.discountAmount)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={3}>
                                  <Typography variant="body2" color="text.secondary">
                                    GST Amount {currentProduct.gstPercent === 0 && '(Exempt)'}
                                  </Typography>
                                  <Typography variant="h6" sx={{ 
                                    fontWeight: 600, 
                                    color: currentProduct.gstPercent === 0 ? 'text.secondary' : 'warning.main' 
                                  }}>
                                    {currentProduct.gstPercent === 0 ? 'Exempt' : formatCurrency(currentProduct.gstAmount)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={3}>
                                  <Typography variant="body2" color="text.secondary">Final Amount</Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                                    {formatCurrency(currentProduct.finalAmount)}
                                  </Typography>
                                </Grid>
                                <Grid item xs={3}>
                                <Button
                                  fullWidth
                                  variant="contained"
                                  onClick={addProduct}
                                  startIcon={<AddIcon />}
                                  size="small"
                                    disabled={!currentProduct.name || currentProduct.mrp <= 0}
                                >
                                    Add Product
                                </Button>
                              </Grid>
                            </Grid>
                            )}
                            
                            {currentProduct.mrp === 0 && (
                              <Grid container spacing={2} sx={{ mt: 1 }}>
                                <Grid item xs={12} md={3}>
                                  <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={addProduct}
                                    startIcon={<AddIcon />}
                                    size="small"
                                    disabled={!currentProduct.name || currentProduct.mrp <= 0}
                                  >
                                    Add Product
                                  </Button>
                                </Grid>
                              </Grid>
                            )}
                          </Box>

                          {/* Products Table */}
                          {currentVisit.products.length > 0 && (
                            <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                              <Table>
                                <TableHead>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell sx={{ fontWeight: 600 }}>Product Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>HSN</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Serial No.</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>MRP</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Selling Price</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Discount</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>GST</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Final Amount</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {currentVisit.products.map((product, index) => (
                                    <TableRow key={product.id}>
                                      <TableCell>{product.name}</TableCell>
                                      <TableCell>{product.hsnCode}</TableCell>
                                      <TableCell>{product.serialNumber}</TableCell>
                                      <TableCell>{formatCurrency(product.mrp)}</TableCell>
                                      <TableCell>{formatCurrency(product.sellingPrice)}</TableCell>
                                      <TableCell>{product.discountPercent}%</TableCell>
                                      <TableCell sx={{ 
                                        color: product.gstPercent === 0 ? 'text.secondary' : 'text.primary',
                                        fontStyle: product.gstPercent === 0 ? 'italic' : 'normal'
                                      }}>
                                        {product.gstPercent === 0 ? 'Exempt' : `${product.gstPercent}%`}
                                      </TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(product.finalAmount)}</TableCell>
                                      <TableCell>
                                        <IconButton
                                          size="small"
                                          onClick={() => removeProduct(index)}
                                          color="error"
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                                <TableHead>
                                  <TableRow sx={{ bgcolor: 'primary.50' }}>
                                    <TableCell colSpan={3} sx={{ fontWeight: 700 }}>Totals</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(currentVisit.grossMRP)}</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(currentVisit.grossSalesBeforeTax)}</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>-</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(currentVisit.taxAmount)}</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{formatCurrency(currentVisit.salesAfterTax)}</TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                </TableHead>
                              </Table>
                            </TableContainer>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Sales Return Section */}
                    {currentVisit.salesReturn && (
                      <Card sx={{ mb: 4, bgcolor: 'error.50', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <AssignmentReturnIcon sx={{ color: 'error.main' }} />
                              <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main' }}>
                                Sales Return Details
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                              💡 Return previously sold hearing aids with proper tracking
                            </Typography>
                          </Box>
                          
                          <Grid container spacing={3}>
                            {/* Serial Number Selection Mode Toggle */}
                            <Grid item xs={12}>
                              <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                  Serial Number Selection
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Button
                                    size="small"
                                    variant={serialSelectionMode === 'dropdown' ? 'contained' : 'outlined'}
                                    onClick={() => setSerialSelectionMode('dropdown')}
                                    color="primary"
                                  >
                                    Select from Previous Sales
                                  </Button>
                                  <Button
                                    size="small"
                                    variant={serialSelectionMode === 'manual' ? 'contained' : 'outlined'}
                                    onClick={() => setSerialSelectionMode('manual')}
                                    color="secondary"
                                  >
                                    Enter Manually
                                  </Button>
                                </Box>
                              </Box>
                            </Grid>

                            {/* Serial Number Selection */}
                            <Grid item xs={12} md={6}>
                              {serialSelectionMode === 'dropdown' ? (
                                <FormControl fullWidth>
                                  <InputLabel>Select Serial Number from Previous Sales</InputLabel>
                                  <Select
                                    value={currentVisit.returnSerialNumber}
                                    label="Select Serial Number from Previous Sales"
                                    onChange={(e) => {
                                      const selectedSale = previousSales.find(sale => sale.serialNumber === e.target.value);
                                      handleSerialNumberSelect(selectedSale);
                                    }}
                                    sx={{ borderRadius: 2 }}
                                  >
                                    {previousSales.length === 0 ? (
                                      <MenuItem disabled value="">
                                        <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                          No previous sales found for this patient
                                        </Typography>
                                      </MenuItem>
                                    ) : (
                                      previousSales.map((sale, index) => (
                                        <MenuItem key={index} value={sale.serialNumber}>
                                          <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                              S/N: {sale.serialNumber}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {sale.productName} • {sale.brand} {sale.model}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                              Sold on: {sale.saleDate} • Amount: ₹{sale.finalAmount}
                                            </Typography>
                                          </Box>
                                        </MenuItem>
                                      ))
                                    )}
                                  </Select>
                                  {previousSales.length === 0 && (
                                    <FormHelperText>
                                      No previous sales found. Please add a sale first or use manual entry.
                                    </FormHelperText>
                                  )}
                                </FormControl>
                              ) : (
                                <TextField
                                  fullWidth
                                  label="Serial Number to Return"
                                  value={currentVisit.returnSerialNumber}
                                  onChange={(e) => updateVisit(activeVisit, 'returnSerialNumber', e.target.value)}
                                  placeholder="Enter serial number manually"
                                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                  helperText="Enter the serial number of the hearing aid to return"
                                />
                              )}
                            </Grid>

                            {/* Selected Sale Details Display */}
                            {currentVisit.returnSerialNumber && serialSelectionMode === 'dropdown' && (
                              <Grid item xs={12}>
                                {(() => {
                                  const selectedSale = previousSales.find(sale => sale.serialNumber === currentVisit.returnSerialNumber);
                                  if (!selectedSale) return null;
                                  
                                  return (
                                    <Paper sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 2, border: 1, borderColor: 'primary.100' }}>
                                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.dark', mb: 1 }}>
                                        📋 Selected Sale Details
                                      </Typography>
                                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1 }}>
                                        <Typography variant="body2">
                                          <strong>Product:</strong> {selectedSale.productName}
                                        </Typography>
                                        <Typography variant="body2">
                                          <strong>Brand/Model:</strong> {selectedSale.brand} {selectedSale.model}
                                        </Typography>
                                        <Typography variant="body2">
                                          <strong>Sale Date:</strong> {selectedSale.saleDate}
                                        </Typography>
                                        <Typography variant="body2">
                                          <strong>Original Amount:</strong> ₹{selectedSale.finalAmount}
                                        </Typography>
                                      </Box>
                                    </Paper>
                                  );
                                })()}
                              </Grid>
                            )}

                            {/* Return Condition */}
                            <Grid item xs={12} md={6}>
                              <FormControl fullWidth>
                                <InputLabel>Return Condition</InputLabel>
                                <Select
                                  value={currentVisit.returnCondition}
                                  label="Return Condition"
                                  onChange={(e) => updateVisit(activeVisit, 'returnCondition', e.target.value)}
                                  sx={{ borderRadius: 2 }}
                                >
                                  <MenuItem value="excellent">Excellent - Like New</MenuItem>
                                  <MenuItem value="good">Good - Minor wear</MenuItem>
                                  <MenuItem value="fair">Fair - Some damage</MenuItem>
                                  <MenuItem value="poor">Poor - Significant damage</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>

                            {/* Return Reason */}
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                label="Return Reason"
                                value={currentVisit.returnReason}
                                onChange={(e) => updateVisit(activeVisit, 'returnReason', e.target.value)}
                                multiline
                                rows={2}
                                placeholder="Specify reason for return (e.g., Not satisfied, technical issues, etc.)"
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>

                            {/* Penalty Amount */}
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Penalty Amount"
                                type="number"
                                value={currentVisit.returnPenaltyAmount}
                                onChange={(e) => updateVisit(activeVisit, 'returnPenaltyAmount', parseFloat(e.target.value) || 0)}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <RupeeIcon />
                                    </InputAdornment>
                                  ),
                                }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                helperText="Penalty charges for return (if any)"
                              />
                            </Grid>

                            {/* Refund Amount */}
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Refund Amount"
                                type="number"
                                value={currentVisit.returnRefundAmount}
                                onChange={(e) => updateVisit(activeVisit, 'returnRefundAmount', parseFloat(e.target.value) || 0)}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <RupeeIcon />
                                    </InputAdornment>
                                  ),
                                }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                helperText="Final refund amount after penalty"
                              />
                            </Grid>

                            {/* Return Notes */}
                            <Grid item xs={12}>
                              <TextField
                                fullWidth
                                label="Return Notes"
                                value={currentVisit.returnNotes}
                                onChange={(e) => updateVisit(activeVisit, 'returnNotes', e.target.value)}
                                multiline
                                rows={3}
                                placeholder="Additional notes about the return process"
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )}

                    {/* Accessory Details */}
                    {currentVisit.accessory && (
                      <Card sx={{ mb: 4, bgcolor: 'success.50', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <MedicalIcon sx={{ color: 'success.main' }} />
                              <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                                Accessory Details
                              </Typography>
                  </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                              💡 Select from available accessory products
                            </Typography>
                          </Box>
                          
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                              <FormControl fullWidth>
                                <InputLabel>Name of Accessory</InputLabel>
                                <Select
                                  value={(() => {
                                    const visits = getValues('visits');
                                    const visit = visits[activeVisit];
                                    const accessoryName = visit?.accessoryName || '';
                                    console.log('Current accessory value:', accessoryName, 'from visit:', visit?.id);
                                    return accessoryName;
                                  })()}
                                  onChange={(e) => {
                                    const selectedValue = e.target.value as string;
                                    console.log('=== ACCESSORY SELECTION START ===');
                                    console.log('Selected value:', selectedValue);
                                    console.log('Active visit index:', activeVisit);
                                    
                                    // Get current visits state
                                    const currentVisits = getValues('visits');
                                    console.log('Current visits state:', currentVisits);
                                    
                                    if (!selectedValue) {
                                      console.log('Resetting accessory fields');
                                      // Reset all accessory fields when no selection
                                      const updatedVisits = [...currentVisits];
                                      updatedVisits[activeVisit] = {
                                        ...updatedVisits[activeVisit],
                                        accessoryName: '',
                                        accessoryAmount: 0,
                                        accessoryFOC: false
                                      };
                                      setValue('visits', updatedVisits);
                                      console.log('Reset complete');
                                      return;
                                    }
                                    
                                    const selectedAccessory = products.find(p => 
                                      p.name === selectedValue && 
                                      (p.type === 'Accessory' || p.type === 'Other')
                                    );
                                    console.log('Found accessory in products:', selectedAccessory);
                                    
                                    // Update visit with all changes at once
                                    const updatedVisits = [...currentVisits];
                                    const currentVisitData = updatedVisits[activeVisit];
                                    
                                    if (selectedAccessory) {
                                      const isFreeProduct = selectedAccessory.mrp === 0 || selectedAccessory.isFreeOfCost;
                                      
                                      updatedVisits[activeVisit] = {
                                        ...currentVisitData,
                                        accessoryName: selectedValue,
                                        accessoryFOC: isFreeProduct,
                                        accessoryAmount: isFreeProduct ? 0 : (selectedAccessory.mrp || 0)
                                      };
                                      
                                      console.log('Auto-populated accessory:', {
                                        name: selectedValue,
                                        amount: isFreeProduct ? 0 : (selectedAccessory.mrp || 0),
                                        isFOC: isFreeProduct,
                                        product: selectedAccessory
                                      });
                                    } else {
                                      updatedVisits[activeVisit] = {
                                        ...currentVisitData,
                                        accessoryName: selectedValue,
                                        accessoryAmount: 0,
                                        accessoryFOC: false
                                      };
                                      console.log('Fallback: product not found in database');
                                    }
                                    
                                    setValue('visits', updatedVisits);
                                    console.log('Updated visits state:', updatedVisits);
                                    console.log('=== ACCESSORY SELECTION END ===');
                                  }}
                                  label="Name of Accessory"
                                  sx={{ borderRadius: 2 }}
                                  displayEmpty
                                >
                                  <MenuItem value="">
                                    <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                      Select an accessory...
                                    </Typography>
                                  </MenuItem>
                                  {products
                                    .filter(product => product.type === 'Accessory' || product.type === 'Other')
                                    .length === 0 ? (
                                    <MenuItem disabled>
                                      <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                        No accessory products available
                                      </Typography>
                                    </MenuItem>
                                  ) : (
                                    products
                                      .filter(product => product.type === 'Accessory' || product.type === 'Other')
                                      .map(product => (
                                        <MenuItem key={product.id} value={product.name}>
                                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                            <Typography>{product.name}{product.company ? ` - ${product.company}` : ''}</Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                              <Chip 
                                                label={product.type} 
                                                size="small" 
                                                color={product.type === 'Accessory' ? 'primary' : 'secondary'} 
                                                variant="outlined"
                                                sx={{ fontSize: '0.7rem' }}
                                              />
                                              {product.mrp > 0 && (
                                                <Typography variant="body2" color="text.secondary">
                                                  {formatCurrency(product.mrp)}
                                                </Typography>
                                              )}
                                            </Box>
                                          </Box>
                                        </MenuItem>
                                      ))
                                  )}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Details of Accessory"
                                placeholder="Additional notes or specifications..."
                                value={(() => {
                                  const visits = getValues('visits');
                                  const visit = visits[activeVisit];
                                  return visit?.accessoryDetails || '';
                                })()}
                                onChange={(e) => {
                                  const currentVisits = getValues('visits');
                                  const updatedVisits = [...currentVisits];
                                  updatedVisits[activeVisit] = {
                                    ...updatedVisits[activeVisit],
                                    accessoryDetails: e.target.value
                                  };
                                  setValue('visits', updatedVisits);
                                }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={(() => {
                                      const visits = getValues('visits');
                                      const visit = visits[activeVisit];
                                      return visit?.accessoryFOC || false;
                                    })()}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      console.log('FOC toggled:', isChecked);
                                      
                                      const currentVisits = getValues('visits');
                                      const updatedVisits = [...currentVisits];
                                      const currentVisitData = updatedVisits[activeVisit];
                                      
                                      if (isChecked) {
                                        // Set amount to 0 when FOC is enabled
                                        updatedVisits[activeVisit] = {
                                          ...currentVisitData,
                                          accessoryFOC: true,
                                          accessoryAmount: 0
                                        };
                                      } else {
                                        // If unchecking FOC and an accessory is selected, restore its MRP
                                        const selectedAccessory = products.find(p => 
                                          p.name === currentVisitData?.accessoryName && 
                                          (p.type === 'Accessory' || p.type === 'Other')
                                        );
                                        updatedVisits[activeVisit] = {
                                          ...currentVisitData,
                                          accessoryFOC: false,
                                          accessoryAmount: selectedAccessory?.mrp || 0
                                        };
                                      }
                                      
                                      setValue('visits', updatedVisits);
                                      console.log('FOC updated, new state:', updatedVisits[activeVisit]);
                                    }}
                                    color="success"
                                  />
                                }
                                label="FOC (Free of Charge)"
                              />
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <TextField
                                fullWidth
                                label="Quantity"
                                type="number"
                                value={(() => {
                                  const visits = getValues('visits');
                                  const visit = visits[activeVisit];
                                  return visit?.accessoryQuantity || 1;
                                })()}
                                onChange={(e) => {
                                  const currentVisits = getValues('visits');
                                  const updatedVisits = [...currentVisits];
                                  updatedVisits[activeVisit] = {
                                    ...updatedVisits[activeVisit],
                                    accessoryQuantity: Math.max(1, Number(e.target.value))
                                  };
                                  setValue('visits', updatedVisits);
                                }}
                                inputProps={{ min: 1 }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label={(() => {
                                  const visits = getValues('visits');
                                  const visit = visits[activeVisit];
                                  return visit?.accessoryFOC ? "Amount (Free)" : "Amount of Accessory";
                                })()}
                                type="number"
                                value={(() => {
                                  const visits = getValues('visits');
                                  const visit = visits[activeVisit];
                                  return visit?.accessoryFOC ? 0 : (visit?.accessoryAmount || 0);
                                })()}
                                onChange={(e) => {
                                  const currentVisits = getValues('visits');
                                  const updatedVisits = [...currentVisits];
                                  updatedVisits[activeVisit] = {
                                    ...updatedVisits[activeVisit],
                                    accessoryAmount: Math.max(0, Number(e.target.value))
                                  };
                                  setValue('visits', updatedVisits);
                                }}
                                disabled={(() => {
                                  const visits = getValues('visits');
                                  const visit = visits[activeVisit];
                                  return visit?.accessoryFOC || false;
                                })()}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <RupeeIcon />
                                    </InputAdornment>
                                  ),
                                }}
                                sx={{ 
                                  '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                  '& .MuiInputBase-input': {
                                    color: (() => {
                                      const visits = getValues('visits');
                                      const visit = visits[activeVisit];
                                      return visit?.accessoryFOC ? 'text.secondary' : 'text.primary';
                                    })()
                                  }
                                }}
                              />
                            </Grid>
                          </Grid>

                          {/* Accessory Summary */}
                          {(() => {
                            const visits = getValues('visits');
                            const visit = visits[activeVisit];
                            const accessoryName = visit?.accessoryName;
                            
                            if (!accessoryName || accessoryName.trim() === '') return null;
                            
                            return (
                              <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'success.200' }}>
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'success.main' }}>
                                  Accessory Summary
                                </Typography>
                                <Grid container spacing={2}>
                                  <Grid item xs={12}>
                                    <Typography variant="body2" color="text.secondary">Selected Accessory</Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                      {accessoryName}
                                    </Typography>
                                    {products.find(p => p.name === accessoryName && (p.type === 'Accessory' || p.type === 'Other')) && (
                                      <Chip 
                                        label="From Product Catalog" 
                                        size="small" 
                                        color="success" 
                                        variant="outlined"
                                        sx={{ mt: 1 }}
                                      />
                                    )}
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">Total Quantity</Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                      {visit?.accessoryQuantity || 1} pc(s)
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6}>
                                    <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                                    <Typography variant="h6" sx={{ 
                                      fontWeight: 600, 
                                      color: visit?.accessoryFOC ? 'success.main' : 'primary.main' 
                                    }}>
                                      {visit?.accessoryFOC ? 'FREE' : formatCurrency((visit?.accessoryAmount || 0) * (visit?.accessoryQuantity || 1))}
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </Box>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    )}

                    {/* Programming Details */}
                    {currentVisit.programming && (
                      <Card sx={{ mb: 4, bgcolor: 'warning.50', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <MedicalIcon sx={{ color: 'warning.main' }} />
                              <Typography variant="h6" sx={{ fontWeight: 600, color: 'warning.main' }}>
                                Programming Details
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                              🔧 Hearing aid programming and configuration
                            </Typography>
                          </Box>

                          <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Reason for Programming"
                                placeholder="e.g., Volume adjustment, feedback reduction, etc."
                                value={currentVisit.programmingReason}
                                onChange={(e) => updateVisit(activeVisit, 'programmingReason', e.target.value)}
                                multiline
                                rows={2}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Date of Hearing Aid Purchase"
                                type="date"
                                value={currentVisit.hearingAidPurchaseDate}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAidPurchaseDate', e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Name/Model of Hearing Aid"
                                placeholder="e.g., Signia Pure 312 7X"
                                value={currentVisit.hearingAidName}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAidName', e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FormControl fullWidth>
                                  <InputLabel>Programming Done By</InputLabel>
                                  <Select
                                    value={currentVisit.programmingDoneBy}
                                    onChange={(e) => updateVisit(activeVisit, 'programmingDoneBy', e.target.value)}
                                    label="Programming Done By"
                                    sx={{ borderRadius: 2 }}
                                  >
                                    {getStaffOptionsForField('programmingBy').map(option => (
                                      <MenuItem key={option} value={option}>
                                        👤 {option}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                <IconButton
                                  onClick={() => {
                                    setSelectedCategory('programmingBy');
                                    setStaffManagementOpen(true);
                                  }}
                                  sx={{
                                    bgcolor: '#ff6b35',
                                    color: 'white',
                                    '&:hover': { bgcolor: '#e55a2b' },
                                    minWidth: '32px',
                                    height: '32px'
                                  }}
                                  title="Edit Programming Done By Options"
                                  size="small"
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Grid>
                                                         <Grid item xs={12} md={3}>
                               <FormControlLabel
                                 control={
                                   <Switch
                                     checked={currentVisit.underWarranty}
                                     onChange={(e) => updateVisit(activeVisit, 'underWarranty', e.target.checked)}
                                     color="success"
                                   />
                                 }
                                 label="Under Warranty"
                               />
                             </Grid>
                             <Grid item xs={12} md={3}>
                               <TextField
                                 fullWidth
                                 label="Programming Amount"
                                 type="number"
                                 value={currentVisit.programmingAmount || ''}
                                 onChange={(e) => updateVisit(activeVisit, 'programmingAmount', Number(e.target.value) || 0)}
                                 InputProps={{
                                   startAdornment: (
                                     <InputAdornment position="start">
                                       <RupeeIcon />
                                     </InputAdornment>
                                   ),
                                 }}
                                 helperText="Enter programming service charge"
                                 sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                               />
                             </Grid>
                          </Grid>

                          {/* Programming Summary */}
                          {(() => {
                            const visits = getValues('visits');
                            const visit = visits[activeVisit];
                            
                            if (!visit?.programmingReason || visit.programmingReason.trim() === '') return null;
                            
                            return (
                              <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'warning.200' }}>
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'warning.main' }}>
                                  Programming Summary
                                </Typography>
                                <Grid container spacing={2}>
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="body2" color="text.secondary">Service</Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                      Hearing Aid Programming
                                    </Typography>
                                    {visit?.hearingAidName && (
                                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                        Device: {visit.hearingAidName}
                                      </Typography>
                                    )}
                                  </Grid>
                                                                     <Grid item xs={12} md={3}>
                                     <Typography variant="body2" color="text.secondary">Warranty Status</Typography>
                                     <Typography variant="h6" sx={{ 
                                       fontWeight: 600, 
                                       color: visit?.underWarranty ? 'success.main' : 'warning.main' 
                                     }}>
                                       {visit?.underWarranty ? 'Under Warranty' : 'Out of Warranty'}
                                     </Typography>
                                   </Grid>
                                   <Grid item xs={12} md={3}>
                                     <Typography variant="body2" color="text.secondary">Service Charge</Typography>
                                     <Typography variant="h6" sx={{ 
                                       fontWeight: 600, 
                                       color: 'primary.main' 
                                     }}>
                                       {formatCurrency(visit?.programmingAmount || 0)}
                                     </Typography>
                                   </Grid>
                                </Grid>
                              </Box>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    )}

                    {/* Repair Details */}
                    {currentVisit.repair && (
                      <Card sx={{ mb: 4, bgcolor: 'error.50', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <MedicalIcon sx={{ color: 'error.main' }} />
                              <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main' }}>
                                Repair Service
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                              🔧 Hearing aid repair and maintenance
                            </Typography>
                          </Box>

                          <Box sx={{ 
                            p: 3, 
                            bgcolor: 'background.paper', 
                            borderRadius: 2, 
                            border: 1, 
                            borderColor: 'error.200',
                            textAlign: 'center'
                          }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'error.main' }}>
                              Repair Visit Recorded
                            </Typography>
                                                         <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
                               This visit has been recorded as a repair service. Use our Hearing Hope Repair Tracking 
                               system to manage repair details and track repair status.
                             </Typography>
                                                         <Button
                               variant="contained"
                               color="error"
                               size="large"
                               startIcon={<RupeeIcon />}
                               onClick={() => window.open('https://repair-tracking-system-hope.vercel.app/', '_blank')}
                               sx={{ 
                                 borderRadius: 2, 
                                 px: 4, 
                                 py: 1.5,
                                 fontSize: '1rem',
                                 fontWeight: 600
                               }}
                             >
                               Open Repair Tracking System
                             </Button>
                            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary', fontSize: '0.85rem' }}>
                              Patient: {watch('name')}{!isAudiologist && ` | Phone: ${watch('phone')}`}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    )}

                    {/* Counselling Details */}
                    {currentVisit.counselling && (
                      <Card sx={{ mb: 4, bgcolor: 'info.50', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <MedicalIcon sx={{ color: 'info.main' }} />
                              <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
                                Counselling & Speech Therapy
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                              💬 Patient counselling and therapy services
                            </Typography>
                          </Box>

                          <Box sx={{ 
                            p: 3, 
                            bgcolor: 'background.paper', 
                            borderRadius: 2, 
                            border: 1, 
                            borderColor: 'info.200'
                          }}>
                            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: 'info.main' }}>
                              Session Details
                            </Typography>
                            
                            <Grid container spacing={3}>
                              <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                  <InputLabel>Session Type</InputLabel>
                                  <Select
                                    value={currentVisit.visitNotes.includes('Counselling:') ? 'counselling' : 
                                           currentVisit.visitNotes.includes('Speech Therapy:') ? 'speech_therapy' : 
                                           currentVisit.visitNotes.includes('General Enquiry:') ? 'general_enquiry' : ''}
                                    onChange={(e) => {
                                      const sessionType = e.target.value;
                                      let prefix = '';
                                      if (sessionType === 'counselling') prefix = 'Counselling: ';
                                      else if (sessionType === 'speech_therapy') prefix = 'Speech Therapy: ';
                                      else if (sessionType === 'general_enquiry') prefix = 'General Enquiry: ';
                                      
                                      const existingNotes = currentVisit.visitNotes.replace(/^(Counselling: |Speech Therapy: |General Enquiry: )/, '');
                                      updateVisit(activeVisit, 'visitNotes', prefix + existingNotes);
                                    }}
                                    label="Session Type"
                                    sx={{ borderRadius: 2 }}
                                  >
                                    <MenuItem value="counselling">💬 Hearing Aid Counselling</MenuItem>
                                    <MenuItem value="speech_therapy">🗣️ Speech Therapy</MenuItem>
                                    <MenuItem value="general_enquiry">❓ General Enquiry</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                  <InputLabel>Session By</InputLabel>
                                  <Select
                                    value={currentVisit.testDoneBy}
                                    onChange={(e) => updateVisit(activeVisit, 'testDoneBy', e.target.value)}
                                    label="Session By"
                                    sx={{ borderRadius: 2 }}
                                  >
                                    {staffOptions.map(option => (
                                      <MenuItem key={option} value={option}>
                                        👤 {option}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12}>
                                <TextField
                                  fullWidth
                                  label="Session Notes"
                                  placeholder="Document the session details, progress, recommendations..."
                                  value={currentVisit.visitNotes.replace(/^(Counselling: |Speech Therapy: |General Enquiry: )/, '')}
                                  onChange={(e) => {
                                    const prefix = currentVisit.visitNotes.match(/^(Counselling: |Speech Therapy: |General Enquiry: )/)?.[0] || '';
                                    updateVisit(activeVisit, 'visitNotes', prefix + e.target.value);
                                  }}
                                  multiline
                                  rows={3}
                                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                              </Grid>
                            </Grid>

                            <Box sx={{ mt: 3, p: 2, bgcolor: 'info.50', borderRadius: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500, color: 'info.main', mb: 1 }}>
                                📋 Session Summary:
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {currentVisit.visitNotes || 'No session details recorded yet'}
                              </Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Follow-ups */}
            <Card elevation={2} sx={{ mb: 4, borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <EventIcon sx={{ color: 'success.main', fontSize: 28 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'success.main' }}>
                      Follow-ups & Communications
                </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    📞 Track all patient communications and schedule follow-ups
                  </Typography>
                </Box>
                
                {/* Enhanced Add Follow-up Form */}
                <Card sx={{ p: 4, mb: 4, bgcolor: 'success.50', borderRadius: 2, border: 1, borderColor: 'success.200' }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: 'success.main' }}>
                    Record New Follow-up
                  </Typography>
                  
                  {/* All Fields in One Row */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Follow-up Date *"
                        type="date"
                        value={currentFollowUp.date}
                        onChange={(e) => handleFollowUpChange('date', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                        required
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2.5}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FormControl fullWidth size="small" required sx={{ minWidth: 200 }}>
                          <InputLabel>Call Done By *</InputLabel>
                          <Select
                            value={currentFollowUp.callerName}
                            onChange={(e) => handleFollowUpChange('callerName', e.target.value)}
                            label="Call Done By *"
                            sx={{ borderRadius: 2 }}
                          >
                            {getStaffOptionsForField('telecaller').map(option => (
                              <MenuItem key={option} value={option}>
                                👤 {option}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <IconButton
                          onClick={() => {
                            setSelectedCategory('telecaller');
                            setStaffManagementOpen(true);
                          }}
                          sx={{
                            bgcolor: '#ff6b35',
                            color: 'white',
                            '&:hover': { bgcolor: '#e55a2b' },
                            minWidth: '28px',
                            height: '28px'
                          }}
                          title="Edit Call Done By Options"
                          size="small"
                        >
                          <EditIcon sx={{ fontSize: '16px' }} />
                        </IconButton>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={5.5}>
                      <TextField
                        fullWidth
                        label="Remarks/Notes"
                        placeholder="What was discussed? Any important notes..."
                        value={currentFollowUp.remarks}
                        onChange={(e) => handleFollowUpChange('remarks', e.target.value)}
                        multiline
                        minRows={1}
                        maxRows={4}
                        sx={{ 
                          '& .MuiOutlinedInput-root': { 
                            borderRadius: 2,
                            alignItems: 'flex-start'
                          },
                          '& .MuiInputBase-input': {
                            resize: 'none'
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Next Follow-up Date"
                        type="date"
                        value={currentFollowUp.nextFollowUpDate}
                        onChange={(e) => handleFollowUpChange('nextFollowUpDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                  </Grid>

                  {/* Quick Date Suggestions */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: 'success.main' }}>
                      💡 Quick Next Follow-up Options:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {getNextFollowUpSuggestions().map((suggestion) => (
                        <Chip
                          key={suggestion.label}
                          label={suggestion.label}
                          variant="outlined"
                          size="small"
                          clickable
                          onClick={() => handleFollowUpChange('nextFollowUpDate', suggestion.date)}
                          color={currentFollowUp.nextFollowUpDate === suggestion.date ? 'success' : 'default'}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Add Button */}
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="contained" 
                        onClick={addFollowUp}
                        startIcon={<AddIcon />}
                      size="medium"
                      sx={{ borderRadius: 2, px: 4 }}
                      disabled={!currentFollowUp.date.trim() || !currentFollowUp.callerName.trim() || (!currentFollowUp.remarks.trim() && !currentFollowUp.nextFollowUpDate.trim())}
                      >
                      Add Follow-up
                      </Button>
                  </Box>
                </Card>

                {/* Follow-ups List */}
                {followUps.length > 0 ? (
                      <Box>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
                      Follow-up History ({followUps.length})
                        </Typography>
                    {followUps.map((followUp, index) => {
                      return (
                         <Card 
                           key={followUp.id} 
                           sx={{ 
                             p: 3, 
                             mb: 2, 
                             borderRadius: 2, 
                             border: 1, 
                             borderColor: 'info.200',
                             bgcolor: 'background.paper'
                           }}
                         >
                           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                             <Box sx={{ flex: 1 }}>
                               {/* Header */}
                               <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main', mb: 2 }}>
                                 📞 {followUp.date} - {followUp.callerName}
                        </Typography>
                              
                              {/* Content */}
                              {followUp.remarks && (
                                <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2, lineHeight: 1.6 }}>
                                  💬 {followUp.remarks}
                                </Typography>
                              )}
                              
                              {/* Next Follow-up */}
                        {followUp.nextFollowUpDate && (
                          <Chip
                                  label={`📅 Next: ${followUp.nextFollowUpDate}`}
                                  color="info"
                            variant="outlined"
                            size="small"
                          />
                        )}
                      </Box>
                            
                            {/* Actions */}
                            <Box sx={{ ml: 2 }}>
                              <IconButton 
                                onClick={() => removeFollowUp(index)} 
                                color="error"
                                title="Delete Follow-up"
                                sx={{ '&:hover': { bgcolor: 'error.100' } }}
                              >
                        <DeleteIcon />
                      </IconButton>
                            </Box>
                    </Box>
                  </Card>
                      );
                    })}
                  </Box>
                ) : (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 6, 
                    bgcolor: 'grey.50', 
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'grey.200',
                    borderStyle: 'dashed'
                  }}>
                    <EventIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No follow-ups recorded yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Add your first follow-up to track patient communications
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Payments Section */}
            <Card elevation={2} sx={{ mb: 4, borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <RupeeIcon sx={{ color: 'info.main', fontSize: 28 }} />
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'info.main' }}>
                      Payments & Billing
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    💰 Auto-calculated from services and products
                  </Typography>
                </Box>

                {/* Payment Summary */}
                <Card sx={{ mb: 4, bgcolor: 'info.50', borderRadius: 2 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: 'info.main' }}>
                      Payment Summary
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Total Due</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                            {formatCurrency(calculateTotalDue())}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Total Paid</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {formatCurrency(calculateTotalPaid())}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Outstanding</Typography>
                          <Typography variant="h5" sx={{ 
                            fontWeight: 700, 
                            color: calculateOutstanding() > 0 ? 'error.main' : 'success.main' 
                          }}>
                            {formatCurrency(calculateOutstanding())}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Payment Status</Typography>
                          <Chip 
                            label={calculateOutstanding() <= 0 ? 'Fully Paid' : 'Pending'} 
                            color={calculateOutstanding() <= 0 ? 'success' : 'warning'}
                            variant="filled"
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Add Payment Form */}
                <Card sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Record New Payment
                  </Typography>
                  
                  {/* First Row - Payment Purpose */}
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Payment For</InputLabel>
                        <Select
                          value={currentPayment.paymentFor}
                          onChange={(e) => handlePaymentForChange(e.target.value as PaymentRecord['paymentFor'])}
                          label="Payment For"
                          sx={{ borderRadius: 2 }}
                        >
                          {getAvailablePaymentOptions().map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <Box>
                                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {option.label}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                    {option.description}
                                  </Typography>
                                </Box>
                                {option.amount > 0 && (
                                  <Chip 
                                    label={formatCurrency(option.amount)} 
                                    size="small" 
                                    color="primary" 
                                    variant="outlined"
                                  />
                                )}
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* Second Row - Payment Details */}
                  <Grid container spacing={2} alignItems="end">
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Payment Date"
                        type="date"
                        value={currentPayment.paymentDate}
                        onChange={(e) => setCurrentPayment(prev => ({ ...prev, paymentDate: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Amount"
                        type="number"
                        value={currentPayment.amount || ''}
                        onChange={(e) => setCurrentPayment(prev => ({ ...prev, amount: Number(e.target.value) || 0 }))}
                        disabled={currentPayment.paymentFor === 'full_payment' || (currentPayment.paymentFor !== 'partial_payment' && currentPayment.paymentFor !== 'other' && currentPayment.amount > 0)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <RupeeIcon />
                            </InputAdornment>
                          ),
                        }}
                        helperText={
                          currentPayment.paymentFor === 'full_payment' 
                            ? 'Auto-filled for full payment'
                            : currentPayment.paymentFor === 'partial_payment' || currentPayment.paymentFor === 'other'
                            ? 'Enter custom amount'
                            : 'Auto-filled from service'
                        }
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Payment Mode</InputLabel>
                        <Select
                          value={currentPayment.paymentMode}
                          onChange={(e) => setCurrentPayment(prev => ({ ...prev, paymentMode: e.target.value as PaymentRecord['paymentMode'] }))}
                          label="Payment Mode"
                          sx={{ borderRadius: 2 }}
                        >
                          <MenuItem value="Cash">💵 Cash</MenuItem>
                          <MenuItem value="Card">💳 Card</MenuItem>
                          <MenuItem value="UPI">📱 UPI</MenuItem>
                          <MenuItem value="Net Banking">🏦 Net Banking</MenuItem>
                          <MenuItem value="Cheque">📝 Cheque</MenuItem>
                          <MenuItem value="NEFT/RTGS">🏛️ NEFT/RTGS</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <TextField
                        fullWidth
                        label="Reference Number"
                        value={currentPayment.referenceNumber}
                        onChange={(e) => setCurrentPayment(prev => ({ ...prev, referenceNumber: e.target.value }))}
                        placeholder={
                          currentPayment.paymentMode === 'UPI' ? 'UPI Ref ID' :
                          currentPayment.paymentMode === 'Card' ? 'Card Trans ID' :
                          currentPayment.paymentMode === 'Cheque' ? 'Cheque No.' :
                          'Reference'
                        }
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        label="Remarks"
                        value={currentPayment.remarks}
                        onChange={(e) => setCurrentPayment(prev => ({ ...prev, remarks: e.target.value }))}
                        placeholder="Additional notes..."
                        size="small"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    </Grid>
                    <Grid item xs={12} md={1}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={addPayment}
                        startIcon={<AddIcon />}
                        size="small"
                        disabled={currentPayment.amount <= 0}
                        sx={{ borderRadius: 2, minHeight: 40 }}
                      >
                        Add
                      </Button>
                    </Grid>
                  </Grid>

                  {/* Quick Payment Suggestions */}
                  {calculateTotalDue() > 0 && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: 'info.main' }}>
                        💡 Quick Payment Options:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {getAvailablePaymentOptions()
                          .filter(opt => opt.amount > 0 && opt.value !== 'partial_payment' && opt.value !== 'other')
                          .map((option) => (
                            <Chip
                              key={option.value}
                              label={`${option.label} - ${formatCurrency(option.amount)}`}
                              variant="outlined"
                              size="small"
                              clickable
                              onClick={() => handlePaymentForChange(option.value as PaymentRecord['paymentFor'])}
                              color={currentPayment.paymentFor === option.value ? 'primary' : 'default'}
                              sx={{ cursor: 'pointer' }}
                            />
                          ))}
                      </Box>
                    </Box>
                  )}
                </Card>

                {/* Payments Table */}
                {(() => {
                  const payments = getValues('payments');
                  return payments.length > 0 ? (
                    <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                      <Table>
                                                 <TableHead>
                           <TableRow sx={{ bgcolor: 'info.100' }}>
                             <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Payment For</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Payment Mode</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Reference</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Remarks</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                           </TableRow>
                         </TableHead>
                         <TableBody>
                           {payments.map((payment) => {
                              const paymentForLabels = {
                               hearing_test: 'Hearing Test',
                               hearing_aid: 'Hearing Aid',
                               accessory: 'Accessory',
                                booking_advance: 'Booking Advance',
                               full_payment: 'Full Payment',
                               partial_payment: 'Partial Payment',
                               other: 'Other'
                             };
                             
                              const paymentForColors = {
                               hearing_test: 'primary',
                               hearing_aid: 'secondary',
                               accessory: 'success',
                                booking_advance: 'warning',
                               full_payment: 'info',
                               partial_payment: 'warning',
                               other: 'default'
                             } as const;
                             
                             return (
                               <TableRow key={payment.id}>
                                 <TableCell>{payment.paymentDate}</TableCell>
                                 <TableCell>
                                   <Chip 
                                     label={paymentForLabels[payment.paymentFor]} 
                                     size="small" 
                                     color={paymentForColors[payment.paymentFor]} 
                                     variant="outlined" 
                                   />
                                 </TableCell>
                                 <TableCell sx={{ fontWeight: 600, color: 'success.main' }}>
                                   {formatCurrency(payment.amount)}
                                 </TableCell>
                                 <TableCell>
                                   <Chip 
                                     label={payment.paymentMode} 
                                     size="small" 
                                     color="primary" 
                                     variant="filled" 
                                   />
                                 </TableCell>
                                 <TableCell>{payment.referenceNumber || '-'}</TableCell>
                                 <TableCell>{payment.remarks || '-'}</TableCell>
                                 <TableCell>
                                   <IconButton
                                     size="small"
                                     onClick={() => removePayment(payment.id)}
                                     color="error"
                                   >
                                     <DeleteIcon />
                                   </IconButton>
                                 </TableCell>
                               </TableRow>
                             );
                           })}
                        </TableBody>
                                                 <TableHead>
                           <TableRow sx={{ bgcolor: 'success.50' }}>
                             <TableCell sx={{ fontWeight: 700 }}>Total Paid</TableCell>
                             <TableCell></TableCell>
                             <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>
                               {formatCurrency(calculateTotalPaid())}
                             </TableCell>
                             <TableCell colSpan={4}></TableCell>
                           </TableRow>
                         </TableHead>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      <Typography variant="h6">No payments recorded yet</Typography>
                      <Typography variant="body2">Add a payment above to get started</Typography>
                    </Box>
                  );
                })()}
              </CardContent>
            </Card>
          </Box>
        )}

        {step === 1 && (
          <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
            {/* Review Section */}
            <Typography variant="h4" sx={{ mb: 4, fontWeight: 700, color: 'primary.main', textAlign: 'center' }}>
              Review Information
            </Typography>
            
            <Card elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: 'primary.main' }}>
                Patient Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Name</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>{watchName}</Typography>
                  </Box>
                </Grid>
                {!isAudiologist && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                      <Typography variant="body2" color="text.secondary">Phone</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>{watchPhone}</Typography>
                    </Box>
                  </Grid>
                )}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Email</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>{watch('email') || 'Not provided'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Reference</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>{watch('reference') || 'Not specified'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Address</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>{watch('address') || 'Not provided'}</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Card>

            <Card elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: 'secondary.main' }}>
                Visits Summary ({watchedVisits.length})
              </Typography>
              {watchedVisits.map((visit, index) => (
                <Card key={visit.id} sx={{ p: 3, mb: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Visit {index + 1}
                    {visit.visitDate && (
                      <Chip 
                        label={`${visit.visitDate} ${visit.visitTime}`} 
                        color="primary" 
                        variant="outlined" 
                        sx={{ ml: 2 }}
                      />
                    )}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="body2" color="text.secondary">Services</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                        {visit.hearingTest && (
                          <Chip label="Hearing Test" color="primary" size="small" />
                        )}
                        {(visit.hearingAidTrial || visit.hearingAidBooked || visit.hearingAidSale) && (
                          <Chip 
                            label={`Hearing Aid${visit.trialGiven ? ' (Trial)' : ''}${visit.bookingFromTrial ? ' (Booked)' : ''}${visit.purchaseFromTrial ? ' (Purchased)' : ''}`} 
                            color="secondary" 
                            size="small" 
                          />
                        )}
                        {visit.accessory && (
                          <Chip label="Accessory" color="success" size="small" />
                        )}
                        {visit.programming && (
                          <Chip label="Programming" color="warning" size="small" />
                        )}
                        {visit.repair && (
                          <Chip label="Repair" color="error" size="small" />
                        )}
                        {visit.counselling && (
                          <Chip label="Counselling" color="info" size="small" />
                        )}
                        {!visit.hearingTest && !(visit.hearingAidTrial || visit.hearingAidBooked || visit.hearingAidSale) && !visit.accessory && !visit.programming && !visit.repair && !visit.counselling && (
                          <Typography variant="body2">No services selected</Typography>
                        )}
                      </Box>
                    </Grid>
                    
                    {/* Enhanced Hearing Aid Details in Summary */}
                    {(visit.hearingAidTrial || visit.hearingAidBooked || visit.hearingAidSale) && (visit.trialGiven || visit.bookingFromTrial || visit.purchaseFromTrial || visit.hearingAidStatus !== 'booked') && (
                      <Grid item xs={12}>
                        <Box sx={{ mt: 2, p: 2, bgcolor: 'secondary.light', borderRadius: 2, border: 1, borderColor: 'secondary.main' }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                            Hearing Aid Details
                          </Typography>
                          <Grid container spacing={2}>
                            {visit.trialGiven && (
                              <Grid item xs={12} md={6}>
                                <Box sx={{ p: 1.5, bgcolor: 'info.light', borderRadius: 1, mb: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'info.dark' }}>Trial Information</Typography>
                                  <Typography variant="body2">
                                    Device: {visit.trialHearingAidBrand} {visit.trialHearingAidModel}
                                  </Typography>
                                  <Typography variant="body2">
                                    Duration: {visit.trialDuration} days ({visit.trialStartDate} to {visit.trialEndDate})
                                  </Typography>
                                  <Typography variant="body2">
                                    Result: <Chip label={visit.trialResult} size="small" color={
                                      visit.trialResult === 'successful' ? 'success' :
                                      visit.trialResult === 'unsuccessful' ? 'error' :
                                      visit.trialResult === 'extended' ? 'warning' : 'default'
                                    } />
                                  </Typography>
                                  {visit.trialNotes && (
                                    <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                                      Notes: {visit.trialNotes}
                                    </Typography>
                                  )}
                                </Box>
                              </Grid>
                            )}
                            
                            {(visit.bookingFromTrial || visit.hearingAidStatus === 'booked') && (
                              <Grid item xs={12} md={6}>
                                <Box sx={{ p: 1.5, bgcolor: 'warning.light', borderRadius: 1, mb: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.dark' }}>Booking Information</Typography>
                                  <Typography variant="body2">
                                    Device: {visit.hearingAidBrand} {visit.hearingAidModel}
                                  </Typography>
                                  <Typography variant="body2">
                                    Type: {visit.hearingAidType} | Ear: {visit.whichEar}
                                  </Typography>
                                  {visit.bookingAdvanceAmount > 0 && (
                                    <Typography variant="body2">
                                      Advance: {formatCurrency(visit.bookingAdvanceAmount)}
                                    </Typography>
                                  )}
                                  {visit.bookingDate && (
                                    <Typography variant="body2">
                                      Date: {visit.bookingDate}
                                    </Typography>
                                  )}
                                  <Typography variant="body2">
                                    Total: {formatCurrency(visit.hearingAidPrice)}
                                  </Typography>
                                </Box>
                              </Grid>
                            )}
                            
                            {(visit.purchaseFromTrial || visit.hearingAidStatus === 'sold') && (
                              <Grid item xs={12} md={6}>
                                <Box sx={{ p: 1.5, bgcolor: 'success.light', borderRadius: 1, mb: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.dark' }}>Purchase Information</Typography>
                                  <Typography variant="body2">
                                    Status: <Chip label="Purchased" size="small" color="success" />
                                  </Typography>
                                  {visit.purchaseDate && (
                                    <Typography variant="body2">
                                      Purchase Date: {visit.purchaseDate}
                                    </Typography>
                                  )}
                                  <Typography variant="body2">
                                    Amount: {formatCurrency(visit.hearingAidPrice)}
                                  </Typography>
                                  {visit.warranty && (
                                    <Typography variant="body2">
                                      Warranty: {visit.warranty}
                                    </Typography>
                                  )}
                                </Box>
                              </Grid>
                            )}
                            
                            {visit.hearingAidStatus && !visit.trialGiven && !visit.bookingFromTrial && !visit.purchaseFromTrial && (
                              <Grid item xs={12} md={6}>
                                <Box sx={{ p: 1.5, bgcolor: 'grey.100', borderRadius: 1, mb: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>General Status</Typography>
                                  <Typography variant="body2">
                                    Status: <Chip 
                                      label={visit.hearingAidStatus.replace('_', ' ').toUpperCase()} 
                                      size="small" 
                                      color={
                                        visit.hearingAidStatus === 'not_interested' ? 'error' :
                                        visit.hearingAidStatus === 'sold' ? 'success' :
                                        visit.hearingAidStatus === 'booked' ? 'warning' : 'default'
                                      }
                                    />
                                  </Typography>
                                  {visit.hearingAidBrand && visit.hearingAidModel && (
                                    <Typography variant="body2">
                                      Device: {visit.hearingAidBrand} {visit.hearingAidModel}
                                    </Typography>
                                  )}
                                </Box>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </Grid>
                    )}
                    
                    {(visit.hearingAidTrial || visit.hearingAidBooked || visit.hearingAidSale) && visit.products.length > 0 && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary">Products</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {visit.products.length} item(s) - Total: {formatCurrency(visit.salesAfterTax)}
                        </Typography>
                      </Grid>
                    )}
                    {visit.accessory && visit.accessoryName && visit.accessoryName.trim() !== '' && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary">Accessory</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {visit.accessoryName} ({visit.accessoryQuantity} pc{visit.accessoryQuantity > 1 ? 's' : ''})
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: visit.accessoryFOC ? 'success.main' : 'primary.main',
                          fontWeight: 600
                        }}>
                          {visit.accessoryFOC ? 'FREE' : `${formatCurrency(visit.accessoryAmount * visit.accessoryQuantity)}`}
                        </Typography>
                      </Grid>
                    )}
                    {visit.programming && visit.programmingReason && visit.programmingReason.trim() !== '' && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary">Programming</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {visit.hearingAidName || 'Hearing Aid Programming'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                          {visit.programmingReason}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: 'primary.main',
                          fontWeight: 600,
                          mt: 0.5
                        }}>
                          {formatCurrency(visit.programmingAmount || 0)}
                        </Typography>
                      </Grid>
                    )}
                    {visit.repair && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary">Repair Service</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          Hearing Aid Repair
                        </Typography>
                                                 <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                           Repair visit recorded - managed via repair tracking system
                         </Typography>
                        <Typography variant="body2" sx={{ 
                          color: 'info.main',
                          fontWeight: 600,
                          mt: 0.5
                        }}>
                          No charge (managed separately)
                        </Typography>
                      </Grid>
                    )}
                    {visit.counselling && visit.visitNotes && visit.visitNotes.trim() !== '' && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="body2" color="text.secondary">Counselling Session</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {visit.visitNotes.includes('Counselling:') ? '💬 Hearing Aid Counselling' :
                           visit.visitNotes.includes('Speech Therapy:') ? '🗣️ Speech Therapy' :
                           visit.visitNotes.includes('General Enquiry:') ? '❓ General Enquiry' :
                           'Counselling Session'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                          {visit.visitNotes.replace(/^(Counselling: |Speech Therapy: |General Enquiry: )/, '') || 'Session completed'}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: 'info.main',
                          fontWeight: 600,
                          mt: 0.5
                        }}>
                          No charge (consultation service)
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                  
                  {/* Pure Tone Audiogram - Show in review for all users (read-only) */}
                  {visit.hearingTest && visit.audiogramData && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                        Pure Tone Audiogram
                      </Typography>
                      <PureToneAudiogram
                        data={visit.audiogramData}
                        onChange={() => {}} // Read-only in review
                        editable={false}
                        readOnly={true}
                      />
                    </Box>
                  )}
                </Card>
              ))}
            </Card>

            {followUps.length > 0 && (
              <Card elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: 'success.main' }}>
                  📞 Follow-ups & Communications ({followUps.length})
                </Typography>
                                 {followUps.map((followUp, index) => {
                   return (
                     <Box 
                       key={followUp.id} 
                       sx={{ 
                         mb: index < followUps.length - 1 ? 3 : 0, 
                         p: 3, 
                         bgcolor: 'info.50', 
                         borderRadius: 2, 
                         border: 1, 
                         borderColor: 'info.200'
                       }}
                     >
                       {/* Header */}
                       <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main', mb: 2 }}>
                         📞 {followUp.date} - {followUp.callerName}
                    </Typography>
                      
                      {/* Content */}
                      {followUp.remarks && (
                        <Typography variant="body1" sx={{ mt: 1, mb: 2 }}>
                          💬 {followUp.remarks}
                    </Typography>
                      )}
                      
                      {/* Next follow-up */}
                    {followUp.nextFollowUpDate && (
                      <Chip
                          label={`📅 Next: ${followUp.nextFollowUpDate}`}
                          color="info"
                        variant="outlined"
                        size="small"
                      />
                    )}
                  </Box>
                  );
                })}
              </Card>
            )}

            {/* Payments Summary for Review */}
            {(() => {
              const payments = getValues('payments');
              const totalDue = calculateTotalDue();
              const totalPaid = calculateTotalPaid();
              const outstanding = calculateOutstanding();

              return (
                <Card elevation={3} sx={{ p: 4, borderRadius: 3 }}>
                  <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: 'info.main' }}>
                    Payment Summary
                  </Typography>
                  
                  {/* Financial Overview */}
                  <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, bgcolor: 'info.50', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
                          {formatCurrency(totalDue)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Amount Paid</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {formatCurrency(totalPaid)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, bgcolor: outstanding > 0 ? 'error.50' : 'success.50', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Outstanding</Typography>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          color: outstanding > 0 ? 'error.main' : 'success.main'
                        }}>
                          {formatCurrency(outstanding)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Status</Typography>
                        <Chip 
                          label={outstanding <= 0 ? 'Fully Paid' : 'Pending'} 
                          color={outstanding <= 0 ? 'success' : 'warning'}
                          variant="filled"
                          sx={{ fontWeight: 600, mt: 1 }}
                        />
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Payment Records */}
                  {payments.length > 0 ? (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        Payment Records ({payments.length})
                      </Typography>
                                             {payments.map((payment) => {
                         const paymentForLabels = {
                           hearing_test: 'Hearing Test',
                           hearing_aid: 'Hearing Aid',
                           accessory: 'Accessory',
                           booking_advance: 'Booking Advance',
                           full_payment: 'Full Payment',
                           partial_payment: 'Partial Payment',
                           other: 'Other'
                         };
                         
                         return (
                           <Box key={payment.id} sx={{ 
                             mb: 2, 
                             p: 2, 
                             bgcolor: 'success.50', 
                             borderRadius: 2,
                             display: 'flex',
                             justifyContent: 'space-between',
                             alignItems: 'center'
                           }}>
                             <Box>
                               <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                 {formatCurrency(payment.amount)} - {payment.paymentMode}
                               </Typography>
                               <Typography variant="body2" color="text.secondary">
                                 {payment.paymentDate} • For: {paymentForLabels[payment.paymentFor]}
                                 {payment.referenceNumber && ` • Ref: ${payment.referenceNumber}`}
                                 {payment.remarks && ` • ${payment.remarks}`}
                               </Typography>
                             </Box>
                             <Chip 
                               label="Paid" 
                               color="success" 
                               size="small" 
                               variant="outlined"
                             />
                           </Box>
                         );
                       })}
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                      <Typography variant="body1">No payments recorded</Typography>
                    </Box>
                  )}
                </Card>
              );
            })()}
          </Box>
        )}
      </Box>

      {/* Footer Actions */}
      <Paper elevation={3} sx={{ p: 3, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', mx: 'auto' }}>
          <Button
            onClick={() => setStep(0)}
            disabled={step === 0}
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            size="large"
            sx={{ borderRadius: 2 }}
          >
            Previous
          </Button>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {step === 0 && (
              <Typography variant="body2" color="text.secondary">
                {isStep0Valid ? 'Ready to review' : 'Please fill required fields'}
              </Typography>
            )}
            {step === 0 ? (
              <Button
                variant="contained"
                onClick={() => setStep(1)}
                disabled={!isStep0Valid}
                endIcon={<VisibilityIcon />}
                size="large"
                sx={{ borderRadius: 2, px: 4 }}
              >
                Review
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit(onFormSubmit)}
                startIcon={<SaveIcon />}
                size="large"
                sx={{ borderRadius: 2, px: 4 }}
              >
                Save Enquiry
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Hearing Aid Inventory Selection Dialog */}
      <Dialog
        open={inventoryDialogOpen}
        onClose={() => {
          setInventoryDialogOpen(false);
          resetInventorySelection();
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, maxHeight: '85vh' }
        }}
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <InventoryIcon />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Select Hearing Aid from Inventory
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {availableInventory.length} hearing aids available in stock
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Search Bar */}
          <Box sx={{ p: 3, pb: 2, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              placeholder="Search by product name, company, serial number, or location..."
              value={inventorySearchTerm}
              onChange={(e) => setInventorySearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'white'
                }
              }}
            />
          </Box>

          {/* Navigation Breadcrumb */}
          {!inventorySearchTerm && (
            <Box sx={{ p: 2, bgcolor: 'primary.50', borderBottom: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">Navigate:</Typography>
                <Button
                  size="small"
                  variant={viewMode === 'companies' ? 'contained' : 'text'}
                  onClick={() => {
                    setViewMode('companies');
                    setSelectedCompany('');
                    setSelectedModel('');
                  }}
                  sx={{ minWidth: 'auto' }}
                >
                  Companies
                </Button>
                {selectedCompany && (
                  <>
                    <Typography color="text.secondary">→</Typography>
                    <Button
                      size="small"
                      variant={viewMode === 'models' ? 'contained' : 'text'}
                      onClick={() => {
                        setViewMode('models');
                        setSelectedModel('');
                      }}
                      sx={{ minWidth: 'auto' }}
                    >
                      {selectedCompany}
                    </Button>
                  </>
                )}
                {selectedModel && (
                  <>
                    <Typography color="text.secondary">→</Typography>
                    <Button
                      size="small"
                      variant="contained"
                      sx={{ minWidth: 'auto' }}
                    >
                      {selectedModel}
                    </Button>
                  </>
                )}
              </Stack>
            </Box>
          )}

          {/* Content Area */}
          <Box sx={{ p: 3, maxHeight: '60vh', overflow: 'auto' }}>
            {availableInventory.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <InventoryIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Hearing Aids in Stock
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Please add hearing aids to inventory first or check the inventory filters.
                </Typography>
              </Box>
            ) : inventorySearchTerm ? (
              /* Search Results */
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Search results for "{inventorySearchTerm}" ({getFilteredInventory().length} items)
                </Typography>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                  {getFilteredInventory().map(item => (
                    <Card 
                      key={item.id} 
                      sx={{ 
                        cursor: 'pointer',
                        border: 2,
                        borderColor: currentProduct.inventoryId === item.id ? 'success.main' : 'transparent',
                        bgcolor: currentProduct.inventoryId === item.id ? 'success.50' : 'white',
                        '&:hover': { 
                          borderColor: 'primary.main',
                          boxShadow: 3,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                      onClick={() => {
                        const currentVisit = watchedVisits[activeVisit];
                        
                        // Check if we're selecting for trial (trial service is active and trial type is home)
                        if (currentVisit?.hearingAidTrial && 
                            currentVisit?.hearingAidStatus === 'trial_given' && 
                            currentVisit?.trialHearingAidType === 'home') {
                          // For home trials, just set the serial number and basic info
                          updateVisit(activeVisit, 'trialSerialNumber', item.serialNumber || '');
                          updateVisit(activeVisit, 'trialHearingAidBrand', item.company || '');
                          updateVisit(activeVisit, 'trialHearingAidModel', item.productName || '');
                          setInventoryDialogOpen(false);
                          resetInventorySelection();
                        } else {
                          // For sales, set the full product details
                          const gstPercent = item.gstApplicable ? (item.gstPercentage || 18) : 0;
                          const gstAmount = item.mrp * gstPercent / 100;
                          setCurrentProduct(prev => ({
                            ...prev,
                            inventoryId: item.id,
                            productId: item.productId,
                            name: item.productName,
                            hsnCode: item.hsnCode || '',
                            mrp: item.mrp,
                            dealerPrice: item.dealerPrice,
                            gstPercent,
                            gstApplicable: item.gstApplicable,
                            gstType: item.gstType,
                            unit: 'piece',
                            serialNumber: item.serialNumber || '',
                            sellingPrice: item.mrp,
                            discountPercent: 0,
                            discountAmount: 0,
                            gstAmount,
                            finalAmount: item.mrp + gstAmount,
                            company: item.company,
                            location: item.location
                          }));
                          setInventoryDialogOpen(false);
                          resetInventorySelection();
                        }
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                            <InventoryIcon />
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                              {item.productName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.company}
                            </Typography>
                          </Box>
                          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
                            ₹{item.mrp?.toLocaleString()}
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                          {item.serialNumber && (
                            <Chip 
                              label={`SN: ${item.serialNumber}`} 
                              size="small" 
                              color="success" 
                              variant="outlined"
                              sx={{ fontWeight: 600 }}
                            />
                          )}
                          {!item.serialNumber && item.quantity && (
                            <Chip 
                              label={`Qty: ${item.quantity}`} 
                              size="small" 
                              color="warning" 
                              variant="outlined"
                              sx={{ fontWeight: 600 }}
                            />
                          )}
                          <Chip 
                            label={item.location} 
                            size="small" 
                            color="info" 
                            variant="outlined"
                          />
                          <Chip 
                            label={item.status} 
                            size="small" 
                            color="secondary" 
                            variant="filled"
                          />
                          {item.gstApplicable ? (
                            <Chip 
                              label={`GST: ${item.gstPercentage || 18}%`} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                            />
                          ) : (
                            <Chip 
                              label="GST Exempt" 
                              size="small" 
                              color="error" 
                              variant="outlined"
                            />
                          )}
                        </Box>

                        {item.dealerPrice && (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                              Dealer Price: ₹{item.dealerPrice?.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                              Margin: ₹{((item.mrp || 0) - (item.dealerPrice || 0)).toLocaleString()}
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </Box>
            ) : viewMode === 'companies' ? (
              /* Company Selection */
              <Box>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BusinessIcon color="primary" />
                  Select Company ({Object.keys(getInventoryByCompany()).length} companies)
                </Typography>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
                  {Object.entries(getInventoryByCompany()).map(([company, items]) => (
                    <Card 
                      key={company} 
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { 
                          boxShadow: 4,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                      onClick={() => {
                        setSelectedCompany(company);
                        setViewMode('models');
                      }}
                    >
                      <CardContent sx={{ p: 3, textAlign: 'center' }}>
                        <Avatar sx={{ bgcolor: 'secondary.main', width: 56, height: 56, mx: 'auto', mb: 2 }}>
                          <BusinessIcon sx={{ fontSize: 32 }} />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                          {company}
                        </Typography>
                        <Chip 
                          label={`${items.length} models`}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </Box>
            ) : viewMode === 'models' ? (
              /* Model Selection */
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CategoryIcon color="primary" />
                    {selectedCompany} Models ({Object.keys(getModelsByCompany(selectedCompany)).length} models)
                  </Typography>
                  <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => {
                      setViewMode('companies');
                      setSelectedCompany('');
                    }}
                    variant="outlined"
                    size="small"
                  >
                    Back to Companies
                  </Button>
                </Box>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                  {Object.entries(getModelsByCompany(selectedCompany)).map(([model, items]) => (
                    <Card 
                      key={model} 
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': { 
                          boxShadow: 4,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                      onClick={() => {
                        setSelectedModel(model);
                        setViewMode('serials');
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Avatar sx={{ bgcolor: 'info.main', width: 48, height: 48 }}>
                            <CategoryIcon />
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                              {model}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {selectedCompany}
                            </Typography>
                          </Box>
                          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
                            ₹{items[0]?.mrp?.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip 
                            label={`${items.length} units`}
                            color="primary"
                            variant="outlined"
                            size="small"
                          />
                          {items[0]?.gstApplicable ? (
                            <Chip 
                              label={`GST: ${items[0]?.gstPercentage || 18}%`} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                            />
                          ) : (
                            <Chip 
                              label="GST Exempt" 
                              size="small" 
                              color="error" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </Box>
            ) : (
              /* Serial Selection */
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ViewListIcon color="primary" />
                    {selectedModel} - Available Units
                  </Typography>
                  <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => {
                      setViewMode('models');
                      setSelectedModel('');
                    }}
                    variant="outlined"
                    size="small"
                  >
                    Back to Models
                  </Button>
                </Box>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
                  {getModelsByCompany(selectedCompany)[selectedModel]?.map(item => (
                    <Card 
                      key={item.id} 
                      sx={{ 
                        cursor: 'pointer',
                        border: 2,
                        borderColor: currentProduct.inventoryId === item.id ? 'success.main' : 'transparent',
                        bgcolor: currentProduct.inventoryId === item.id ? 'success.50' : 'white',
                        '&:hover': { 
                          borderColor: 'primary.main',
                          boxShadow: 3,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s ease-in-out'
                        }
                      }}
                      onClick={() => {
                        const currentVisit = watchedVisits[activeVisit];
                        
                        // Check if we're selecting for trial (trial service is active and trial type is home)
                        if (currentVisit?.hearingAidTrial && currentVisit?.trialHearingAidType === 'home') {
                          // For home trials, just set the serial number and basic info
                          updateVisit(activeVisit, 'trialSerialNumber', item.serialNumber || '');
                          updateVisit(activeVisit, 'trialHearingAidBrand', item.company || '');
                          updateVisit(activeVisit, 'trialHearingAidModel', item.productName || '');
                          setInventoryDialogOpen(false);
                          resetInventorySelection();
                        } else {
                          // For sales, set the full product details
                          const gstPercent = item.gstApplicable ? (item.gstPercentage || 18) : 0;
                          const gstAmount = item.mrp * gstPercent / 100;
                          setCurrentProduct(prev => ({
                            ...prev,
                            inventoryId: item.id,
                            productId: item.productId,
                            name: item.productName,
                            hsnCode: item.hsnCode || '',
                            mrp: item.mrp,
                            dealerPrice: item.dealerPrice,
                            gstPercent,
                            gstApplicable: item.gstApplicable,
                            gstType: item.gstType,
                            unit: 'piece',
                            serialNumber: item.serialNumber || '',
                            sellingPrice: item.mrp,
                            discountPercent: 0,
                            discountAmount: 0,
                            gstAmount,
                            finalAmount: item.mrp + gstAmount,
                            company: item.company,
                            location: item.location
                          }));
                          setInventoryDialogOpen(false);
                          resetInventorySelection();
                        }
                      }}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Avatar sx={{ bgcolor: 'success.main', width: 48, height: 48 }}>
                            <InventoryIcon />
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                              {item.serialNumber ? `SN: ${item.serialNumber}` : `Qty: ${item.quantity}`}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.location}
                            </Typography>
                          </Box>
                          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
                            ₹{item.mrp?.toLocaleString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip 
                            label={item.status} 
                            size="small" 
                            color="secondary" 
                            variant="filled"
                          />
                          {item.dealerPrice && (
                            <Chip 
                              label={`Margin: ₹${((item.mrp || 0) - (item.dealerPrice || 0)).toLocaleString()}`}
                              size="small" 
                              color="success" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
          <Button
            onClick={() => {
              setInventoryDialogOpen(false);
              resetInventorySelection();
            }}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          {currentProduct.inventoryId && (
            <Button
              onClick={() => {
                setInventoryDialogOpen(false);
                resetInventorySelection();
              }}
              variant="contained"
              sx={{ borderRadius: 2 }}
            >
              Selected: {currentProduct.name}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Staff Management Dialog */}
      <Dialog 
        open={staffManagementOpen} 
        onClose={() => setStaffManagementOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#ff6b35', color: 'white', py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EditIcon />
            <Typography variant="h6">
              Manage Staff Categories - {currentField.charAt(0).toUpperCase() + currentField.slice(1)}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select which <strong>job roles</strong> should be included in the <strong>{currentField}</strong> dropdown options.
            Staff members from the selected roles will appear as options.
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Available Job Roles:
            </Typography>
            
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
              gap: 2,
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid #ddd',
              borderRadius: 2,
              p: 2
            }}>
              {JOB_ROLES.map((role) => (
                <FormControlLabel
                  key={role}
                  control={
                    <Checkbox
                      checked={selectedRoles[currentField].includes(role)}
                      onChange={(e) => {
                        const newSelectedRoles = { ...selectedRoles };
                        if (e.target.checked) {
                          newSelectedRoles[currentField] = [...newSelectedRoles[currentField], role];
                        } else {
                          newSelectedRoles[currentField] = newSelectedRoles[currentField].filter(r => r !== role);
                        }
                        setSelectedRoles(newSelectedRoles);
                      }}
                      sx={{
                        color: '#ff6b35',
                        '&.Mui-checked': {
                          color: '#ff6b35',
                        },
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{role}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {staffByRole[role]?.length || 0} staff members
                        </Typography>
                      </Box>
                      {selectedRoles[currentField].includes(role) && (
                        <Chip 
                          size="small" 
                          label="Selected" 
                          sx={{ 
                            bgcolor: '#ff6b35', 
                            color: 'white',
                            fontSize: '0.7rem',
                            height: '20px'
                          }} 
                        />
                      )}
                    </Box>
                  }
                />
              ))}
            </Box>

            <Box sx={{ mt: 2, p: 2, bgcolor: '#f8f9fa', borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>Currently selected roles for {currentField}:</strong> {selectedRoles[currentField].length} roles
              </Typography>
              <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedRoles[currentField].map((role) => (
                  <Chip
                    key={role}
                    label={role}
                    size="small"
                    sx={{ 
                      bgcolor: '#ff6b35', 
                      color: 'white',
                      fontSize: '0.75rem'
                    }}
                    onDelete={() => {
                      const newSelectedRoles = { ...selectedRoles };
                      newSelectedRoles[currentField] = newSelectedRoles[currentField].filter(r => r !== role);
                      setSelectedRoles(newSelectedRoles);
                    }}
                  />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary">
                <strong>Staff members that will appear:</strong> {getStaffOptionsForField(currentField).join(', ') || 'None'}
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, bgcolor: 'grey.50' }}>
          <Button
            onClick={() => {
              setSelectedRoles({
                telecaller: ['Telecaller', 'Customer Support'],
                assignedTo: ['Manager', 'Sales Executive', 'Audiologist'],
                testBy: ['Audiologist', 'Technician'], 
                programmingBy: ['Audiologist', 'Technician'],
                sales: ['Sales Executive', 'Manager'],
                general: JOB_ROLES
              });
            }}
            sx={{ color: '#666' }}
          >
            Reset to Default
          </Button>
          <Button
            onClick={() => setStaffManagementOpen(false)}
            variant="contained"
            sx={{
              bgcolor: '#ff6b35',
              '&:hover': { bgcolor: '#e55a2b' }
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SimplifiedEnquiryForm; 