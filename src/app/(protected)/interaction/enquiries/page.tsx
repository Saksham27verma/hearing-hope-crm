'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  TextField,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid as MuiGrid,
  IconButton,
  Chip,
  Tooltip,
  InputAdornment,
  Stack,
  Divider,
  Card,
  Alert,
  CardContent,
  Avatar,
  SelectChangeEvent,
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  StepButton,
  FormGroup,
  FormControlLabel,
  Checkbox,
  styled,
  alpha,
  DialogContentText,
  Radio,
  Slider,
  CircularProgress,
  Snackbar,
  Collapse,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Chat as ChatIcon,
  Notes as NotesIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  EventNote as EventNoteIcon,
  AccessTime as AccessTimeIcon,
  ArrowForward as ArrowForwardIcon,
  MedicalServices as MedicalServicesIcon,
  Hearing as HearingIcon,
  HomeWork as HomeWorkIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  LocationOn as LocationIcon,
  ContactPage as ContactPageIcon,
  DataSaverOn as DataSaverOnIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  ContentCopy as ContentCopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Subject as SubjectIcon,
  PersonAdd as PersonAddIcon,
  Today as TodayIcon,
  Schedule as ScheduleIcon,
  Timeline as FollowUpIcon,
  Assignment as AssignmentIcon,
  WhatsApp as WhatsAppIcon,
  Call as CallIcon,
  Refresh as RefreshIcon,
  Badge as BadgeIcon,
  Close as CloseIcon,
  ViewColumn as ViewColumnIcon,
  DragIndicator as DragIndicatorIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { collection, addDoc, getDocs, Timestamp, query, orderBy, doc, updateDoc, getDoc, where, deleteDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { v4 as uuidv4 } from 'uuid';
import SimplifiedEnquiryForm from '@/components/enquiries/SimplifiedEnquiryForm';
import { useAuth } from '@/context/AuthContext';

// Create a Grid component that doesn't have TypeScript errors
const Grid = (props: any) => <MuiGrid {...props} />;

// Styled components for the form
const StyledFormSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2.5), // Reduced from 4
  borderRadius: theme.shape.borderRadius,
  background: 'rgba(25, 118, 210, 0.05)',
  padding: theme.spacing(2), // Reduced from 3
  border: '1px solid rgba(25, 118, 210, 0.1)',
  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)', // Reduced shadow
  transition: 'all 0.2s ease',
  '&:hover': {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)', // Reduced hover shadow
    borderColor: 'rgba(25, 118, 210, 0.2)',
  }
}));

const FormSectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75), // Reduced from 1
  marginBottom: theme.spacing(1.5), // Reduced from 2.5
  color: '#1976d2',
  fontSize: '1.1rem', // Reduced from 1.2rem
  '& .MuiSvgIcon-root': {
    fontSize: '1.2rem', // Reduced from 1.4rem
  }
}));

// Enquiry type options with expanded options - Update specialized form types
const specializedFormTypes = [
  { value: 'test', label: 'Hearing & Impedance Test' },
  { value: 'hearing_aid_details', label: 'Hearing Aid Details' },
  { value: 'home_visit', label: 'Home Visit' }
];

// Define TypeScript interfaces for our data
interface Enquiry {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  subject?: string;
  status?: string;
  notes?: string;
  assignedTo?: string;
  telecaller?: string;
  reference: string;
  enquiryType: string;
  activeFormTypes: string[];
  visits: Visit[];
  followUps: FollowUp[];
  message?: string; // Add missing message property to interface
  visitStatus?: 'enquiry' | 'scheduled' | 'visited' | 'completed';
  
  // Enhanced visitor-like features
  visitorType?: 'patient' | 'general';
  visitType?: 'consultation' | 'test' | 'trial' | 'fitting' | 'followup' | 'general';
  visitingCenter?: string;
  visitDate?: string;
  visitTime?: string;
  purposeOfVisit?: string;
  companyName?: string;
  contactPerson?: string;
  
  // Multiple visits support
  visitSchedules?: VisitSchedule[];
  testDetails?: {
    testName?: string;
    testDoneBy?: string;
    testDate?: string;
    testResults?: string;
    recommendations?: string;
    hearingLossType?: string;
    rightEarLoss?: string;
    leftEarLoss?: string;
    testPrice?: number;
  };
  impedanceDetails?: {
    testDoneBy?: string;
    testDate?: string;
    testResults?: string;
    recommendations?: string;
    rightEarTympanometry?: string;
    leftEarTympanometry?: string;
    rightEarReflexes?: string;
    leftEarReflexes?: string;
    testPrice?: number;
  };
  trialDetails?: {
    trialDate?: string;
    trialDoneBy?: string;
    trialDevice?: string;
    trialDuration?: string;
    trialFeedback?: string;
    deviceBrand?: string;
    deviceModel?: string;
    deviceTechnology?: string;
    deviceStyle?: string;
    trialResult?: string;
    patientFeedback?: string;
    speechClarity?: number;
    noiseComfort?: number;
    deviceFeatures?: string[];
  };
  homeVisitDetails?: {
    visitDate?: string;
    visitDoneBy?: string;
    hearingAidsShown?: string;
    visitNotes?: string;
    visitOutcome?: string;
    visitTime?: string;
    visitAddress?: string;
    travelDistance?: string;
    patientMobility?: string;
    familyPresent?: boolean;
    familyMembers?: string;
    environmentNoise?: string;
    followupRequired?: boolean;
    devicesRecommended?: string[];
  };
  fittingDetails?: {
    fittingDate?: string;
    fittingDoneBy?: string;
    hearingAidBrand?: string;
    hearingAidModel?: string;
    hearingAidSold?: string;
    serialNumber?: string;
    hearingAidPrice?: number;
    warranty?: string;
    accessories?: string[];
    followupDate?: string;
  };
  hearingAidDetails?: {
    // Product Information
    productName?: string;
    productBrand?: string;
    productModel?: string;
    productCategory?: string;
    productType?: string;
    technology?: string;
    
    // Pricing & Quotation
    mrp?: number;
    quotationPrice?: number;
    discountAmount?: number;
    discountPercentage?: number;
    finalPrice?: number;
    
    // Trial Information
    trialStartDate?: string;
    trialEndDate?: string;
    trialDuration?: string;
    trialFeedback?: string;
    trialResult?: 'successful' | 'unsuccessful' | 'pending';
    
    // Fitting Information
    fittingDate?: string;
    fittingDoneBy?: string;
    fittingNotes?: string;
    
    // Status & Progress
    status?: 'enquiry' | 'quotation_sent' | 'trial_scheduled' | 'trial_ongoing' | 'trial_completed' | 'purchased' | 'fitted' | 'delivered';
    priority?: 'low' | 'medium' | 'high';
    
    // Additional Details
    warranty?: string;
    accessories?: string[];
    specialFeatures?: string[];
    notes?: string;
    
    // Sales Information
    salesPerson?: string;
    quotationDate?: string;
    quotationValidUntil?: string;
    paymentTerms?: string;
    deliveryDate?: string;
  };
  createdAt?: {
    _seconds: number;
    _nanoseconds: number;
  };
}

interface Visit {
  id?: string;
  date: string;
  time: string;
  staff: string;
  purpose: string;
  notes: string;
  activeFormTypes: string[];
  testDetails?: {
    testName?: string;
    testDoneBy?: string;
    testDate?: string;
    testResults?: string;
    recommendations?: string;
    hearingLossType?: string;
    rightEarLoss?: string;
    leftEarLoss?: string;
    testPrice?: number;
  };
  impedanceDetails?: {
    testDoneBy?: string;
    testDate?: string;
    testResults?: string;
    recommendations?: string;
    rightEarTympanometry?: string;
    leftEarTympanometry?: string;
    rightEarReflexes?: string;
    leftEarReflexes?: string;
  };
  trialDetails?: {
    trialDate?: string;
    trialDoneBy?: string;
    trialDevice?: string;
    trialDuration?: string;
    trialFeedback?: string;
    deviceBrand?: string;
    deviceModel?: string;
    deviceTechnology?: string;
    deviceStyle?: string;
    trialResult?: string;
    patientFeedback?: string;
    speechClarity?: number;
    noiseComfort?: number;
    deviceFeatures?: string[];
  };
  homeVisitDetails?: {
    visitDate?: string;
    visitDoneBy?: string;
    hearingAidsShown?: string;
    visitNotes?: string;
    visitOutcome?: string;
    visitTime?: string;
    visitAddress?: string;
    travelDistance?: string;
    patientMobility?: string;
    familyPresent?: boolean;
    familyMembers?: string;
    environmentNoise?: string;
    followupRequired?: boolean;
    devicesRecommended?: string[];
  };
  fittingDetails?: {
    fittingDate?: string;
    fittingDoneBy?: string;
    hearingAidBrand?: string;
    hearingAidModel?: string;
    hearingAidSold?: string;
    serialNumber?: string;
    hearingAidPrice?: number;
    warranty?: string;
    accessories?: string[];
    followupDate?: string;
  };
  createdAt?: {
    _seconds: number;
    _nanoseconds: number;
  };
}

interface FollowUp {
  id: string;
  date: string;
  remarks: string;
  nextFollowUpDate: string;
  callerName: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

interface VisitSchedule {
  id: string;
  visitType: 'center' | 'home';
  visitDate: string;
  visitTime: string;
  notes: string;
  medicalService: 'hearing_test' | 'hearing_aid' | '';
  // Hearing Test Details
  hearingTestDetails?: {
    testDoneBy: string;
    testResults: string;
    recommendations: string;
  };
  // Hearing Aid Details  
  hearingAidDetails?: {
    aidType: string;
    brand: string;
    model: string;
    price: number;
    notes: string;
  };
  // Home Visit specific
  homeAddress?: string;
  contactPerson?: string;
}

export default function EnquiriesPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  // State with proper typing
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [visitLoading, setVisitLoading] = useState<boolean>(false);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [openDetailDialog, setOpenDetailDialog] = useState<boolean>(false);
  const [openVisitDialog, setOpenVisitDialog] = useState<boolean>(false);
  const [openFollowUpDialog, setOpenFollowUpDialog] = useState<boolean>(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [dateFilter, setDateFilter] = useState<string>('');

  // Advanced filter system with operators
  const [advancedFilters, setAdvancedFilters] = useState<Array<{
    id: string;
    field: string;
    operator: string;
    value: any;
    dataType: 'text' | 'number' | 'date' | 'boolean' | 'array';
    logicalOperator?: 'AND' | 'OR';
  }>>([]);

  const [filterBuilder, setFilterBuilder] = useState({
    field: '',
    operator: '',
    value: '',
    dataType: 'text' as 'text' | 'number' | 'date' | 'boolean' | 'array'
  });

  // Legacy filters for backward compatibility
  const [filters, setFilters] = useState({
    // Basic filters
    searchTerm: '',
    status: 'all',
    enquiryType: 'all',
    
    // Date filters
    dateFrom: '',
    dateTo: '',
    visitDateFrom: '',
    visitDateTo: '',
    
    // Contact filters
    hasEmail: 'all',
    hasPhone: 'all',
    
    // Assignment filters
    assignedTo: 'all',
    telecaller: 'all',
    
    // Location filters
    visitingCenter: 'all',
    
    // Visit filters
    visitorType: 'all',
    visitType: 'all',
    visitStatus: 'all',
    
    // Follow-up filters
    hasFollowUps: 'all',
    followUpStatus: 'all',
    
    // Form type filters
    activeFormTypes: [] as string[],
    
    // Test filters
    hasTestResults: 'all',
    hearingLossType: 'all',
    
    // Advanced filters
    companyName: '',
    purposeOfVisit: '',
    reference: '',
    
    // Custom field filters
    customField1: '',
    customField2: '',
  });

  // Filter presets
  const [filterPresets, setFilterPresets] = useState<Array<{
    id: string;
    name: string;
    filters: typeof filters;
    isDefault?: boolean;
  }>>([]);
  
  const [currentPreset, setCurrentPreset] = useState<string>('');
  const [presetName, setPresetName] = useState<string>('');
  const [showPresetDialog, setShowPresetDialog] = useState<boolean>(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState<boolean>(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Available fields for filtering with their data types
  const filterableFields = [
    { field: 'name', label: 'Name', dataType: 'text' as const },
    { field: 'phone', label: 'Phone', dataType: 'text' as const },
    { field: 'email', label: 'Email', dataType: 'text' as const },
    { field: 'reference', label: 'Reference', dataType: 'text' as const },
    { field: 'status', label: 'Status', dataType: 'text' as const },
    { field: 'enquiryType', label: 'Enquiry Type', dataType: 'text' as const },
    { field: 'assignedTo', label: 'Assigned To', dataType: 'text' as const },
    { field: 'telecaller', label: 'Telecaller', dataType: 'text' as const },
    { field: 'address', label: 'Address', dataType: 'text' as const },
    { field: 'subject', label: 'Subject', dataType: 'text' as const },
    { field: 'notes', label: 'Notes', dataType: 'text' as const },
    { field: 'companyName', label: 'Company Name', dataType: 'text' as const },
    { field: 'purposeOfVisit', label: 'Purpose of Visit', dataType: 'text' as const },
    { field: 'contactPerson', label: 'Contact Person', dataType: 'text' as const },
    { field: 'createdAt', label: 'Created Date', dataType: 'date' as const },
    { field: 'visitDate', label: 'Visit Date', dataType: 'date' as const },
    { field: 'testDetails.testPrice', label: 'Test Price', dataType: 'number' as const },
    { field: 'testDetails.rightEarLoss', label: 'Right Ear Loss', dataType: 'number' as const },
    { field: 'testDetails.leftEarLoss', label: 'Left Ear Loss', dataType: 'number' as const },
    { field: 'visits.length', label: 'Number of Visits', dataType: 'number' as const },
    { field: 'followUps.length', label: 'Number of Follow-ups', dataType: 'number' as const },
    { field: 'activeFormTypes', label: 'Active Form Types', dataType: 'array' as const },
    { field: 'visitorType', label: 'Visitor Type', dataType: 'text' as const },
    { field: 'visitType', label: 'Visit Type', dataType: 'text' as const },
    { field: 'visitStatus', label: 'Visit Status', dataType: 'text' as const },
    { field: 'visitingCenter', label: 'Visiting Center', dataType: 'text' as const },
  ];

  // Operators based on data type
  const operatorsByType = {
    text: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'contains', label: 'Contains' },
      { value: 'not_contains', label: 'Does Not Contain' },
      { value: 'starts_with', label: 'Starts With' },
      { value: 'ends_with', label: 'Ends With' },
      { value: 'regex', label: 'Regex Match' },
      { value: 'is_empty', label: 'Is Empty' },
      { value: 'is_not_empty', label: 'Is Not Empty' },
    ],
    number: [
      { value: 'equals', label: 'Equals' },
      { value: 'not_equals', label: 'Not Equals' },
      { value: 'greater_than', label: 'Greater Than' },
      { value: 'greater_than_equal', label: 'Greater Than or Equal' },
      { value: 'less_than', label: 'Less Than' },
      { value: 'less_than_equal', label: 'Less Than or Equal' },
      { value: 'between', label: 'Between' },
      { value: 'not_between', label: 'Not Between' },
      { value: 'is_null', label: 'Is Null' },
      { value: 'is_not_null', label: 'Is Not Null' },
    ],
    date: [
      { value: 'equals', label: 'On Date' },
      { value: 'not_equals', label: 'Not On Date' },
      { value: 'before', label: 'Before' },
      { value: 'after', label: 'After' },
      { value: 'between', label: 'Between' },
      { value: 'last_days', label: 'Last N Days' },
      { value: 'next_days', label: 'Next N Days' },
      { value: 'this_month', label: 'This Month' },
      { value: 'last_month', label: 'Last Month' },
      { value: 'this_year', label: 'This Year' },
      { value: 'is_null', label: 'Is Null' },
      { value: 'is_not_null', label: 'Is Not Null' },
    ],
    boolean: [
      { value: 'is_true', label: 'Is True' },
      { value: 'is_false', label: 'Is False' },
      { value: 'is_null', label: 'Is Null' },
    ],
    array: [
      { value: 'contains', label: 'Contains' },
      { value: 'not_contains', label: 'Does Not Contain' },
      { value: 'contains_all', label: 'Contains All' },
      { value: 'contains_any', label: 'Contains Any' },
      { value: 'is_empty', label: 'Is Empty' },
      { value: 'is_not_empty', label: 'Is Not Empty' },
      { value: 'length_equals', label: 'Length Equals' },
      { value: 'length_greater', label: 'Length Greater Than' },
      { value: 'length_less', label: 'Length Less Than' },
    ]
  };
  const [activeVisitTab, setActiveVisitTab] = useState<number>(0);
  const [activeFollowUpTab, setActiveFollowUpTab] = useState<number>(0);
  
  // Multi-step form
  const [activeStep, setActiveStep] = useState<number>(0);
  const [completed, setCompleted] = useState<{[k: number]: boolean}>({});
  
  // Add visitFormStep state
  const [visitFormStep, setVisitFormStep] = useState<number>(0);
  const [completedVisitSteps, setCompletedVisitSteps] = useState<{[k: string]: boolean}>({});
  
  // Add share dialog states
  const [shareDialogOpen, setShareDialogOpen] = useState<boolean>(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Add form validation errors state
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  // Add alert state for notifications
  const [alert, setAlert] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Simplified form states
  const [openSimplifiedDialog, setOpenSimplifiedDialog] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState<any>(null);

  // Column management states
  const [columnManagementOpen, setColumnManagementOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'name', 'phone', 'email', 'reference', 'assignedTo', 'telecaller', 'date', 'actions'
  ]);
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'name', 'phone', 'email', 'reference', 'assignedTo', 'telecaller', 'date', 'actions'
  ]);

  // Add the missing handleCloseDialog function
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
  
  const [newEnquiry, setNewEnquiry] = useState<Enquiry>({
    name: '',
    phone: '',
    email: '',
    address: '',
    reference: '',
    subject: '',
    message: '',
    status: 'open',
    enquiryType: '',
    activeFormTypes: [] as string[],
    visits: [] as Visit[],
    followUps: [] as FollowUp[],
    
    // Enhanced visitor-like features
    visitorType: 'patient',
    visitType: 'consultation',
    visitingCenter: 'main',
    visitDate: new Date().toISOString().split('T')[0],
    visitTime: '09:00',
    purposeOfVisit: '',
    companyName: '',
    contactPerson: '',
    
    // Multiple visits support
    visitSchedules: [],
    testDetails: {
      testName: '',
      testDoneBy: '',
      testDate: new Date().toISOString().split('T')[0],
      testResults: '',
      recommendations: '',
      hearingLossType: '',
      rightEarLoss: '',
      leftEarLoss: ''
    },
    impedanceDetails: {
      testDoneBy: '',
      testDate: new Date().toISOString().split('T')[0],
      testResults: '',
      recommendations: '',
      rightEarTympanometry: '',
      leftEarTympanometry: '',
      rightEarReflexes: '',
      leftEarReflexes: ''
    },
    trialDetails: {
      trialDate: new Date().toISOString().split('T')[0],
      trialDoneBy: '',
      trialDevice: '',
      trialDuration: '',
      trialFeedback: '',
      deviceBrand: '',
      deviceModel: '',
      deviceTechnology: '',
      deviceStyle: '',
      trialResult: '',
      patientFeedback: '',
      speechClarity: 0,
      noiseComfort: 0,
      deviceFeatures: [] as string[]
    },
    homeVisitDetails: {
      visitDate: new Date().toISOString().split('T')[0],
      visitDoneBy: '',
      hearingAidsShown: '',
      visitNotes: '',
      visitOutcome: ''
    },
    fittingDetails: {
      fittingDate: new Date().toISOString().split('T')[0],
      fittingDoneBy: '',
      hearingAidBrand: '',
      hearingAidModel: '',
      hearingAidSold: '',
      serialNumber: '',
      hearingAidPrice: 0,
      warranty: '',
      accessories: [] as string[],
      followupDate: new Date().toISOString().split('T')[0]
    },
    hearingAidDetails: {
      // Product Information
      productName: '',
      productBrand: '',
      productModel: '',
      productCategory: '',
      productType: '',
      technology: '',
      
      // Pricing & Quotation
      mrp: 0,
      quotationPrice: 0,
      discountAmount: 0,
      discountPercentage: 0,
      finalPrice: 0,
      
      // Trial Information
      trialStartDate: '',
      trialEndDate: '',
      trialDuration: '',
      trialFeedback: '',
      trialResult: 'pending' as 'successful' | 'unsuccessful' | 'pending',
      
      // Fitting Information
      fittingDate: '',
      fittingDoneBy: '',
      fittingNotes: '',
      
      // Status & Progress
      status: 'enquiry' as 'enquiry' | 'quotation_sent' | 'trial_scheduled' | 'trial_ongoing' | 'trial_completed' | 'purchased' | 'fitted' | 'delivered',
      priority: 'medium' as 'low' | 'medium' | 'high',
      
      // Additional Details
      warranty: '',
      accessories: [] as string[],
      specialFeatures: [] as string[],
      notes: '',
      
      // Sales Information
      salesPerson: '',
      quotationDate: '',
      quotationValidUntil: '',
      paymentTerms: '',
      deliveryDate: ''
    }
  });

  // Update the newVisit state to include activeFormTypes array
  const [newVisit, setNewVisit] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString(),
    staff: '',
    purpose: '',
    notes: '',
    testResults: '',
    recommendations: '',
    status: 'scheduled',
    visitType: '',
    activeFormTypes: [] as string[], // Add this new array for tracking multiple selected types
    testDetails: {
      testName: '',
      testDoneBy: '',
      testResults: '',
      testPrice: 0
    },
    impedanceDetails: {
      impedanceDoneBy: '',
      impedanceResults: ''
    },
    trialDetails: {
      trialDevice: '',
      trialDuration: '',
      trialFeedback: ''
    },
    homeVisitDetails: {
      visitDoneBy: '',
      hearingAidsShown: '',
      visitOutcome: ''
    },
    fittingDetails: {
      fittingDoneBy: '',
      hearingAidSold: '',
      hearingAidBrand: '',
      hearingAidModel: ''
    }
  });

  const [newFollowUp, setNewFollowUp] = useState({
    date: new Date().toISOString().split('T')[0],
    remarks: '',
    nextFollowUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    callerName: ''
  });

  const [showAddFollowUpForm, setShowAddFollowUpForm] = useState(false);
  const [selectedSpecializedForm, setSelectedSpecializedForm] = useState<string>('');

  const [selectedVisitType, setSelectedVisitType] = useState<string>('');

  const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
  const [enquiryToDelete, setEnquiryToDelete] = useState<Enquiry | null>(null);
  
  // Visitor conversion states
  const [openConvertDialog, setOpenConvertDialog] = useState<boolean>(false);
  const [enquiryToConvert, setEnquiryToConvert] = useState<Enquiry | null>(null);
  const [visitorData, setVisitorData] = useState({
    visitType: 'consultation',
    visitingCenter: 'main',
    visitDate: new Date().toISOString().split('T')[0],
    visitTime: '09:00',
    status: 'scheduled',
    notes: '',
  });

  // Visit Management States for comprehensive tabs
  const [mainActiveTab, setMainActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [visitTypeFilterMain, setVisitTypeFilterMain] = useState('all');
  const [centerFilterMain, setCenterFilterMain] = useState('all');
  
  // Multiple visits management
  const [activeVisitScheduleTab, setActiveVisitScheduleTab] = useState(0);
  const [followUpDialog, setFollowUpDialog] = useState(false);
  const [selectedEnquiryForFollowUp, setSelectedEnquiryForFollowUp] = useState<Enquiry | null>(null);
  
  useEffect(() => {
    fetchEnquiries();
  }, []);

  useEffect(() => {
    applyFilters();
    setPage(0); // Reset to first page when filters change
  }, [enquiries, filters, advancedFilters]);



  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const enquiryQuery = query(collection(db, 'enquiries'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(enquiryQuery);
      
      const enquiryData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Enquiry[];
      
      // Filter for audiologists: only show enquiries with hearing test services
      let filteredData = enquiryData;
      if (userProfile?.role === 'audiologist') {
        filteredData = enquiryData.filter(enquiry => {
          let hasHearingTest = false;
          
          // Check if enquiry has hearing test in visitSchedules
          if (enquiry.visitSchedules && Array.isArray(enquiry.visitSchedules)) {
            hasHearingTest = enquiry.visitSchedules.some((visit: any) => {
              // Check if medicalServices array includes 'hearing_test'
              if (visit.medicalServices && Array.isArray(visit.medicalServices)) {
                if (visit.medicalServices.includes('hearing_test')) {
                  return true;
                }
              }
              // Check if medicalServices is an object with hearingTest property (UI state)
              if (visit.medicalServices && typeof visit.medicalServices === 'object' && !Array.isArray(visit.medicalServices)) {
                if (visit.medicalServices.hearingTest === true) {
                  return true;
                }
              }
              // Check if medicalService is 'hearing_test' (legacy field)
              if (visit.medicalService === 'hearing_test') {
                return true;
              }
              // Check if hearingTestDetails exists (indicates hearing test was done)
              if (visit.hearingTestDetails) {
                // If hearingTestDetails exists, it means hearing test was done
                if (visit.hearingTestDetails.testResults || visit.hearingTestDetails.testType || visit.hearingTestDetails.testDoneBy || Object.keys(visit.hearingTestDetails).length > 0) {
                  return true;
                }
              }
              return false;
            });
          }
          
          // If not found in visitSchedules, check legacy fields
          if (!hasHearingTest) {
            // Check if enquiry has testDetails (legacy support)
            if (enquiry.testDetails && (enquiry.testDetails.testResults || enquiry.testDetails.testName)) {
              hasHearingTest = true;
            }
            // Check if visits array has hearing test (legacy support)
            if (!hasHearingTest && enquiry.visits && Array.isArray(enquiry.visits)) {
              hasHearingTest = enquiry.visits.some((visit: any) => visit.hearingTest === true || visit.testResults);
            }
          }
          
          return hasHearingTest;
        });
        
        console.log(`[Audiologist Filter] Total enquiries: ${enquiryData.length}, Filtered: ${filteredData.length}`);
      }
      
      setEnquiries(enquiryData);
      setFilteredEnquiries(filteredData);
    } catch (error) {
      console.error('Error fetching enquiries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fix the formatDate function to handle createdAt property correctly
  const formatDate = (enquiry: Enquiry) => {
    if (enquiry.createdAt) {
      if (enquiry.createdAt._seconds) {
        return new Date(enquiry.createdAt._seconds * 1000).toLocaleDateString();
      } else if (typeof enquiry.createdAt === 'object' && 'seconds' in enquiry.createdAt) {
        return new Date((enquiry.createdAt as any).seconds * 1000).toLocaleDateString();
      }
    }
    return 'No date';
  };

  // Also fix the applyFilters function to correctly handle createdAt
  // Helper function to get nested property value
  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object') {
        return current[key];
      }
      return undefined;
    }, obj);
  };

  // Helper function to apply a single filter condition
  const applyFilterCondition = (enquiry: any, filter: any): boolean => {
    const fieldValue = getNestedValue(enquiry, filter.field);
    const { operator, value, dataType } = filter;

    // Handle null/undefined field values
    if (fieldValue === null || fieldValue === undefined) {
      return ['is_null', 'is_empty'].includes(operator);
    }

    switch (dataType) {
      case 'text':
        const textValue = String(fieldValue).toLowerCase();
        const searchValue = String(value).toLowerCase();
        
        switch (operator) {
          case 'equals': return textValue === searchValue;
          case 'not_equals': return textValue !== searchValue;
          case 'contains': return textValue.includes(searchValue);
          case 'not_contains': return !textValue.includes(searchValue);
          case 'starts_with': return textValue.startsWith(searchValue);
          case 'ends_with': return textValue.endsWith(searchValue);
          case 'regex': 
            try {
              return new RegExp(value, 'i').test(textValue);
            } catch (e) {
              return false;
            }
          case 'is_empty': return textValue === '';
          case 'is_not_empty': return textValue !== '';
          default: return false;
        }

      case 'number':
        const numValue = Number(fieldValue);
        const searchNum = Number(value);
        
        if (isNaN(numValue)) return operator === 'is_null';
        
        switch (operator) {
          case 'equals': return numValue === searchNum;
          case 'not_equals': return numValue !== searchNum;
          case 'greater_than': return numValue > searchNum;
          case 'greater_than_equal': return numValue >= searchNum;
          case 'less_than': return numValue < searchNum;
          case 'less_than_equal': return numValue <= searchNum;
          case 'between': 
            const [min, max] = String(value).split(',').map(Number);
            return numValue >= min && numValue <= max;
          case 'not_between':
            const [minNot, maxNot] = String(value).split(',').map(Number);
            return numValue < minNot || numValue > maxNot;
          case 'is_null': return false; // Already handled above
          case 'is_not_null': return true;
          default: return false;
        }

      case 'date':
        let dateValue: Date;
        
        // Handle different date formats
        if (fieldValue._seconds) {
          dateValue = new Date(fieldValue._seconds * 1000);
        } else if (fieldValue.seconds) {
          dateValue = new Date(fieldValue.seconds * 1000);
        } else {
          dateValue = new Date(fieldValue);
        }
        
        if (isNaN(dateValue.getTime())) return operator === 'is_null';
        
        const searchDate = new Date(value);
        const today = new Date();
        
        switch (operator) {
          case 'equals': 
            return dateValue.toDateString() === searchDate.toDateString();
          case 'not_equals':
            return dateValue.toDateString() !== searchDate.toDateString();
          case 'before': return dateValue < searchDate;
          case 'after': return dateValue > searchDate;
          case 'between':
            const [startDate, endDate] = String(value).split(',').map(d => new Date(d));
            return dateValue >= startDate && dateValue <= endDate;
          case 'last_days':
            const daysBack = new Date(today.getTime() - (Number(value) * 24 * 60 * 60 * 1000));
            return dateValue >= daysBack;
          case 'next_days':
            const daysForward = new Date(today.getTime() + (Number(value) * 24 * 60 * 60 * 1000));
            return dateValue <= daysForward;
          case 'this_month':
            return dateValue.getMonth() === today.getMonth() && 
                   dateValue.getFullYear() === today.getFullYear();
          case 'last_month':
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1);
            return dateValue.getMonth() === lastMonth.getMonth() && 
                   dateValue.getFullYear() === lastMonth.getFullYear();
          case 'this_year':
            return dateValue.getFullYear() === today.getFullYear();
          case 'is_null': return false; // Already handled above
          case 'is_not_null': return true;
          default: return false;
        }

      case 'array':
        const arrayValue = Array.isArray(fieldValue) ? fieldValue : [];
        const searchArray = Array.isArray(value) ? value : [value];
        
        switch (operator) {
          case 'contains': return searchArray.some(item => arrayValue.includes(item));
          case 'not_contains': return !searchArray.some(item => arrayValue.includes(item));
          case 'contains_all': return searchArray.every(item => arrayValue.includes(item));
          case 'contains_any': return searchArray.some(item => arrayValue.includes(item));
          case 'is_empty': return arrayValue.length === 0;
          case 'is_not_empty': return arrayValue.length > 0;
          case 'length_equals': return arrayValue.length === Number(value);
          case 'length_greater': return arrayValue.length > Number(value);
          case 'length_less': return arrayValue.length < Number(value);
          default: return false;
        }

      case 'boolean':
        const boolValue = Boolean(fieldValue);
        switch (operator) {
          case 'is_true': return boolValue === true;
          case 'is_false': return boolValue === false;
          case 'is_null': return fieldValue === null || fieldValue === undefined;
          default: return false;
        }

      default:
        return false;
    }
  };

  const applyFilters = () => {
    let result = [...enquiries];
    
    // Apply legacy basic filters first for backward compatibility
    if (filters.searchTerm || searchTerm) {
      const term = filters.searchTerm || searchTerm;
      result = result.filter(enquiry => 
        (enquiry.name?.toLowerCase() || '').includes(term.toLowerCase()) ||
        (enquiry.phone || '').includes(term) ||
        (enquiry.email?.toLowerCase() || '').includes(term.toLowerCase()) ||
        (enquiry.subject?.toLowerCase() || '').includes(term.toLowerCase()) ||
        (enquiry.reference?.toLowerCase() || '').includes(term.toLowerCase()) ||
        (enquiry.notes?.toLowerCase() || '').includes(term.toLowerCase())
      );
    }
    
    // Apply legacy status and type filters
    if (filters.status !== 'all' || statusFilter !== 'all') {
      const status = filters.status !== 'all' ? filters.status : statusFilter;
      result = result.filter(enquiry => enquiry.status === status);
    }
    
    if (filters.enquiryType !== 'all' || typeFilter !== 'all') {
      const type = filters.enquiryType !== 'all' ? filters.enquiryType : typeFilter;
      result = result.filter(enquiry => enquiry.enquiryType === type);
    }

    // Apply advanced filters with logical operators
    if (advancedFilters.length > 0) {
      result = result.filter(enquiry => {
        // Group filters by logical operator
        const andFilters = advancedFilters.filter(f => !f.logicalOperator || f.logicalOperator === 'AND');
        const orFilters = advancedFilters.filter(f => f.logicalOperator === 'OR');
        
        // All AND conditions must be true
        const andResult = andFilters.length === 0 || andFilters.every(filter => 
          applyFilterCondition(enquiry, filter)
        );
        
        // At least one OR condition must be true (if any OR filters exist)
        const orResult = orFilters.length === 0 || orFilters.some(filter => 
          applyFilterCondition(enquiry, filter)
        );
        
        return andResult && orResult;
      });
    }
    
    // Apply audiologist filter if needed
    let finalResult = result;
    if (userProfile?.role === 'audiologist') {
      finalResult = result.filter(enquiry => {
        let hasHearingTest = false;
        
        // Check if enquiry has hearing test in visitSchedules
        if (enquiry.visitSchedules && Array.isArray(enquiry.visitSchedules)) {
          hasHearingTest = enquiry.visitSchedules.some((visit: any) => {
            // Check if medicalServices array includes 'hearing_test'
            if (visit.medicalServices && Array.isArray(visit.medicalServices)) {
              if (visit.medicalServices.includes('hearing_test')) {
                return true;
              }
            }
            // Check if medicalServices is an object with hearingTest property (UI state)
            if (visit.medicalServices && typeof visit.medicalServices === 'object' && !Array.isArray(visit.medicalServices)) {
              if (visit.medicalServices.hearingTest === true) {
                return true;
              }
            }
            // Check if medicalService is 'hearing_test' (legacy field)
            if (visit.medicalService === 'hearing_test') {
              return true;
            }
            // Check if hearingTestDetails exists (indicates hearing test was done)
            if (visit.hearingTestDetails) {
              // If hearingTestDetails exists, it means hearing test was done
              if (visit.hearingTestDetails.testResults || visit.hearingTestDetails.testType || visit.hearingTestDetails.testDoneBy || Object.keys(visit.hearingTestDetails).length > 0) {
                return true;
              }
            }
            return false;
          });
        }
        
        // If not found in visitSchedules, check legacy fields
        if (!hasHearingTest) {
          // Check if enquiry has testDetails (legacy support)
          if (enquiry.testDetails && (enquiry.testDetails.testResults || enquiry.testDetails.testName)) {
            hasHearingTest = true;
          }
          // Check if visits array has hearing test (legacy support)
          if (!hasHearingTest && enquiry.visits && Array.isArray(enquiry.visits)) {
            hasHearingTest = enquiry.visits.some((visit: any) => visit.hearingTest === true || visit.testResults);
          }
        }
        
        return hasHearingTest;
      });
    }
    setFilteredEnquiries(finalResult);
  };

  // Open simplified enquiry dialog
  const handleOpenSimplifiedDialog = () => {
    // Navigate to new enquiry page
    window.location.href = '/interaction/enquiries/new';
  };

  // Handle simplified form submission
  const handleSimplifiedFormSubmit = async (enquiryData: any) => {
    try {
      if (editingEnquiry) {
        // Update existing enquiry
        const enquiryRef = doc(db, 'enquiries', editingEnquiry.id);
        await updateDoc(enquiryRef, {
          ...enquiryData,
          createdAt: editingEnquiry.createdAt
        });
      } else {
        // Create new enquiry
        await addDoc(collection(db, 'enquiries'), {
          ...enquiryData,
          createdAt: serverTimestamp()
        });
      }
      
      // Refresh the enquiries list
      await fetchEnquiries();
      
      // Close the dialog
      setOpenSimplifiedDialog(false);
      setEditingEnquiry(null);
      
    } catch (error) {
      console.error('Error saving enquiry:', error);
    }
  };

  // Open enquiry dialog (legacy - keeping for now)
  const handleOpenDialog = () => {
    setIsEditMode(false);
    setSelectedSpecializedForm('');
    
    // Initialize only the basic fields without specialized form details
    setNewEnquiry({
      name: '',
      phone: '',
      email: '',
      address: '',
      subject: '',
      message: '',
      status: 'open',
      reference: '',
      enquiryType: '',
      activeFormTypes: [],
      followUps: [],
      visits: [],
      visitorType: 'patient',
      visitSchedules: [{
        id: crypto.randomUUID(),
        visitType: 'center' as const,
        visitDate: '',
        visitTime: '',
        notes: '',
        medicalService: '',
        hearingTestDetails: {
          testDoneBy: '',
          testResults: '',
          recommendations: ''
        },
        hearingAidDetails: {
          aidType: '',
          brand: '',
          model: '',
          price: 0,
          notes: ''
        },
        homeAddress: '',
        contactPerson: ''
      }]
    });
    
    setActiveStep(0);
    setCompleted({});
    setOpenDialog(true);
  };
  
  const handleCloseVisitDialog = () => {
    setOpenVisitDialog(false);
  };
  
  // Helper function to get enquiry type label
  const getSpecializedFormLabel = (type: string): string => {
    const found = specializedFormTypes.find(t => t.value === type);
    return found ? found.label : type;
  };

  // Visit Management Functions
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchEnquiries();
    } finally {
      setRefreshing(false);
    }
  };

  const getVisitStats = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let totalVisits = 0;
    let todaysAppointments = 0;
    let completedVisits = 0;
    let overdueVisits = 0;
    let followUps = 0;
    let patientVisits = 0;

    enquiries.forEach(enquiry => {
      if (enquiry.visits && enquiry.visits.length > 0) {
        enquiry.visits.forEach(visit => {
          totalVisits++;
          
          // Today's appointments
          if (visit.date === todayStr) {
            todaysAppointments++;
          }
          
          // Completed visits (assuming status field exists)
          if ((visit as any).status === 'completed') {
            completedVisits++;
          }
          
          // Overdue visits (past date and not completed)
          if (visit.date < todayStr && (visit as any).status !== 'completed') {
            overdueVisits++;
          }
          
          // Follow-ups needed
          if ((visit as any).followupRequired) {
            followUps++;
          }
          
          // Patient visits (medical services)
          if (visit.activeFormTypes && visit.activeFormTypes.length > 0) {
            patientVisits++;
          }
        });
      }
    });

    return {
      total: totalVisits,
      todaysAppointments,
      completed: completedVisits,
      overdue: overdueVisits,
      followUps,
      patients: patientVisits
    };
  };

  const getFilteredVisits = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    let allVisits: any[] = [];
    
    enquiries.forEach(enquiry => {
      if (enquiry.visits && enquiry.visits.length > 0) {
        enquiry.visits.forEach(visit => {
          allVisits.push({
            ...visit,
            enquiryId: enquiry.id,
            enquiryName: enquiry.name,
            enquiryPhone: enquiry.phone,
            enquiryEmail: enquiry.email
          });
        });
      }
      
      // Also include visit schedules from multiple visits
      if (enquiry.visitSchedules && enquiry.visitSchedules.length > 0) {
        enquiry.visitSchedules.forEach(schedule => {
          allVisits.push({
            ...schedule,
            enquiryId: enquiry.id,
            enquiryName: enquiry.name,
            enquiryPhone: enquiry.phone,
            enquiryEmail: enquiry.email,
            date: schedule.visitDate,
            time: schedule.visitTime,
            purpose: schedule.notes,
            notes: schedule.notes,
            activeFormTypes: schedule.medicalService ? [schedule.medicalService] : []
          });
        });
      }
    });

    // Filter based on active tab
    switch (mainActiveTab) {
      case 0: // All Visits
        return allVisits;
      case 1: // Today's Appointments
        return allVisits.filter(visit => visit.date === todayStr);
      case 2: // Upcoming
        return allVisits.filter(visit => visit.date > todayStr);
      case 3: // Completed
        return allVisits.filter(visit => visit.status === 'completed');
      case 4: // Follow-ups
        return allVisits.filter(visit => visit.followupRequired);
      case 5: // Patients (Medical Services)
        return allVisits.filter(visit => visit.activeFormTypes && visit.activeFormTypes.length > 0);
      default:
        return allVisits;
    }
  };

  // Multiple visits management functions
  const addNewVisitSchedule = () => {
          const newSchedule: VisitSchedule = {
      id: crypto.randomUUID(),
        visitType: 'center' as const,
      visitDate: new Date().toISOString().split('T')[0],
      visitTime: '09:00',
      notes: '',
        medicalService: '',
        hearingTestDetails: {
          testDoneBy: '',
          testResults: '',
        recommendations: ''
      },
        hearingAidDetails: {
          aidType: '',
          brand: '',
          model: '',
          price: 0,
          notes: ''
        },
        homeAddress: '',
        contactPerson: ''
    };

    setNewEnquiry({
      ...newEnquiry,
      visitSchedules: [...(newEnquiry.visitSchedules || []), newSchedule]
    });
    setActiveVisitScheduleTab((newEnquiry.visitSchedules || []).length);
  };

  const removeVisitSchedule = (index: number) => {
    const updatedSchedules = (newEnquiry.visitSchedules || []).filter((_, i) => i !== index);
    setNewEnquiry({
      ...newEnquiry,
      visitSchedules: updatedSchedules
    });
    if (activeVisitScheduleTab >= updatedSchedules.length && updatedSchedules.length > 0) {
      setActiveVisitScheduleTab(updatedSchedules.length - 1);
    }
  };

  const updateVisitSchedule = (index: number, field: string, value: any) => {
    const updatedSchedules = [...(newEnquiry.visitSchedules || [])];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      const currentSchedule = updatedSchedules[index];
      updatedSchedules[index] = {
        ...currentSchedule,
        [parent]: {
          ...(currentSchedule[parent as keyof typeof currentSchedule] as any),
          [child]: value
        }
      };
    } else {
      updatedSchedules[index] = {
        ...updatedSchedules[index],
        [field]: value
      };
    }
    setNewEnquiry({
      ...newEnquiry,
      visitSchedules: updatedSchedules
    });
  };

  // Follow-up management functions (enhanced)
  const handleOpenFollowUpDialogEnhanced = (enquiry: Enquiry) => {
    setSelectedEnquiryForFollowUp(enquiry);
    setFollowUpDialog(true);
  };

  const handleCloseFollowUpDialogEnhanced = () => {
    setFollowUpDialog(false);
    setSelectedEnquiryForFollowUp(null);
  };

  const handleScheduleFollowUp = async (followUpData: any) => {
    if (!selectedEnquiryForFollowUp?.id) return;

    try {
      const enquiryRef = doc(db, 'enquiries', selectedEnquiryForFollowUp.id);
      const newFollowUp = {
        ...followUpData,
        id: crypto.randomUUID(),
        createdAt: serverTimestamp()
      };

      await updateDoc(enquiryRef, {
        followUps: arrayUnion(newFollowUp)
      });

      await fetchEnquiries(); // Refresh data
      handleCloseFollowUpDialog();
    } catch (error) {
      console.error('Error scheduling follow-up:', error);
    }
  };

  // Function to add a follow-up during enquiry creation
  const handleAddFollowUpToNewEnquiry = () => {
    const newFollowUpData = {
      ...newFollowUp,
      id: crypto.randomUUID(),
      createdAt: Timestamp.now()
    };
    
    setNewEnquiry({
      ...newEnquiry,
      followUps: [...newEnquiry.followUps, newFollowUpData]
    });
    
    // Reset form
    setNewFollowUp({
      date: new Date().toISOString().split('T')[0],
      remarks: '',
      nextFollowUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      callerName: ''
    });
    
    setShowAddFollowUpForm(false);
  };

  // Add a new function to handle specialized form selection change
  const handleSpecializedFormChange = (event: SelectChangeEvent) => {
    const selectedType = event.target.value;
    setSelectedSpecializedForm(selectedType);
    // Also update the enquiry type when specialized form changes
    setNewEnquiry({
      ...newEnquiry,
      enquiryType: selectedType || 'online'
    });
  };

  // Add a handler for visit type selection
  const handleVisitTypeChange = (event: SelectChangeEvent) => {
    setSelectedVisitType(event.target.value);
    setNewVisit({
      ...newVisit,
      visitType: event.target.value
    });
  };

  // Add a function to handle enquiry deletion
  const handleOpenDeleteDialog = (enquiry: Enquiry) => {
    setEnquiryToDelete(enquiry);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setEnquiryToDelete(null);
  };

  // Convert to Visitor functions
  const handleOpenConvertDialog = (enquiry: Enquiry) => {
    setEnquiryToConvert(enquiry);
    setVisitorData({
      visitType: 'consultation',
      visitingCenter: 'main', 
      visitDate: new Date().toISOString().split('T')[0],
      visitTime: '09:00',
      status: 'scheduled',
      notes: `Converted from enquiry: ${enquiry.subject}`,
    });
    setOpenConvertDialog(true);
  };

  const handleCloseConvertDialog = () => {
    setOpenConvertDialog(false);
    setEnquiryToConvert(null);
  };

  const handleVisitorDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent) => {
    const { name, value } = e.target;
    setVisitorData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleConvertToVisitor = async () => {
    if (!enquiryToConvert) return;

    try {
      // Create visitor record
      const visitorRecord = {
        name: enquiryToConvert.name,
        phone: enquiryToConvert.phone,
        email: enquiryToConvert.email || '',
        visitType: visitorData.visitType,
        visitingCenter: visitorData.visitingCenter,
        visitDate: visitorData.visitDate,
        visitTime: visitorData.visitTime,
        status: visitorData.status,
        notes: visitorData.notes,
        enquiryId: enquiryToConvert.id, // Reference to original enquiry
        createdAt: serverTimestamp(),
      };

      // Add to visitors collection
      await addDoc(collection(db, 'visitors'), visitorRecord);

      // Update enquiry status to 'converted'
      if (enquiryToConvert.id) {
        await updateDoc(doc(db, 'enquiries', enquiryToConvert.id), {
          status: 'converted',
          updatedAt: serverTimestamp(),
        });
      }

      // Refresh enquiries
      await fetchEnquiries();
      
      handleCloseConvertDialog();
      
      // Show success message (if you have a notification system)
      setAlert({
        open: true,
        message: 'Enquiry successfully converted to visitor!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error converting enquiry to visitor:', error);
      setAlert({
        open: true,
        message: 'Failed to convert enquiry to visitor.',
        severity: 'error'
      });
    }
  };

  const handleDeleteEnquiry = async () => {
    if (!enquiryToDelete) return;
    
    try {
      setLoading(true);
      
      // First, find and delete any related visitor records
      const visitorQuery = query(
        collection(db, 'visitors'),
        where('relatedEnquiryId', '==', enquiryToDelete.id)
      );
      
      const visitorSnapshot = await getDocs(visitorQuery);
      
      // Create an array of promises for batch deletion
      const deletePromises = visitorSnapshot.docs.map(visitorDoc => 
        deleteDoc(doc(db, 'visitors', visitorDoc.id))
      );
      
      // Add the enquiry deletion to the promises
      deletePromises.push(deleteDoc(doc(db, 'enquiries', enquiryToDelete.id)));
      
      // Execute all deletions in parallel
      await Promise.all(deletePromises);
      
      console.log(`Deleted enquiry and ${visitorSnapshot.docs.length} related visitor records`);
      
      // Update the local state
      setEnquiries(prevEnquiries => 
        prevEnquiries.filter(enquiry => enquiry.id !== enquiryToDelete.id)
      );
      
      setFilteredEnquiries(prevEnquiries => 
        prevEnquiries.filter(enquiry => enquiry.id !== enquiryToDelete.id)
      );
      
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting enquiry and related records:', error);
      // Show error notification (you can add a snackbar here if you have one)
    } finally {
      setLoading(false);
    }
  };

  // Handle share dialog open
  const handleOpenShareDialog = () => {
    if (!selectedEnquiry) return;
    
    // Create shareable link with the base URL and enquiry ID
    const baseUrl = window.location.origin;
    const shareableLink = `${baseUrl}/interaction/enquiries/${selectedEnquiry.id}`;
    setShareLink(shareableLink);
    setShareDialogOpen(true);
  };

  // Handle share dialog close
  const handleCloseShareDialog = () => {
    setShareDialogOpen(false);
    setCopySuccess(false);
  };

  // Copy link to clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink)
      .then(() => {
        setCopySuccess(true);
        // Reset copy success message after 2 seconds
        setTimeout(() => {
          setCopySuccess(false);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy link: ', err);
      });
  };

  // Add this function to fetch and update a single enquiry
  const fetchAndUpdateSelectedEnquiry = async (enquiryId: string) => {
    try {
      const enquiryDoc = await getDoc(doc(db, 'enquiries', enquiryId));
      if (enquiryDoc.exists()) {
        const updatedEnquiry = { id: enquiryDoc.id, ...enquiryDoc.data() } as Enquiry;
        setSelectedEnquiry(updatedEnquiry);
        
        // Also update the enquiry in the main list
        setEnquiries(prev => 
          prev.map(item => 
            item.id === enquiryId ? updatedEnquiry : item
          )
        );
        
        setFilteredEnquiries(prev => 
          prev.map(item => 
            item.id === enquiryId ? updatedEnquiry : item
          )
        );
      }
    } catch (error) {
      console.error('Error fetching updated enquiry:', error);
    }
  };

  // Handle moving to the next step in visit form
  const handleNextVisitStep = () => {
    // Mark current step as completed
    if (visitFormStep === 0) {
      // If we're on the first step (selecting types), only proceed if at least one type is selected
      if (newVisit.activeFormTypes.length === 0) {
        alert('Please select at least one visit type');
        return;
      }
      setCompletedVisitSteps({...completedVisitSteps, '0': true});
    } else {
      // Mark the current form type as completed
      const currentFormType = newVisit.activeFormTypes[visitFormStep - 1];
      setCompletedVisitSteps({...completedVisitSteps, [currentFormType]: true});
    }
    
    setVisitFormStep((prevStep) => prevStep + 1);
  };
  
  // Handle going back to the previous step
  const handleBackVisitStep = () => {
    setVisitFormStep((prevStep) => Math.max(0, prevStep - 1));
  };
  
  // Get the total number of steps in the visit form (selection + one for each type)
  const getTotalVisitSteps = () => {
    return newVisit.activeFormTypes.length > 0 ? 
      newVisit.activeFormTypes.length + 1 : // +1 for the initial selection step
      1; // Just the selection step if no types selected yet
  };
  
  // Check if we're on the last step
  const isLastVisitStep = () => {
    return visitFormStep === getTotalVisitSteps() - 1;
  };
  
  // Helper to get the icon for a form type
  const getFormTypeIcon = (type: string) => {
    switch (type) {
      case 'test':
        return <MedicalServicesIcon />;
      case 'hearing_aid_details':
        return <HearingIcon />;
      case 'home_visit':
        return <HomeWorkIcon />;
      default:
        return <DataSaverOnIcon />;
    }
  };

  // Add essential handler functions
  
  // Generic input change handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent) => {
    const { name, value } = e.target;
    
    // Handle nested properties using dot notation (e.g., "testDetails.testName")
    if (name.includes('.')) {
      const [parentKey, childKey] = name.split('.');
      
      // Initialize the parent object if it doesn't exist
      if (!newEnquiry[parentKey as keyof Enquiry]) {
        setNewEnquiry({
          ...newEnquiry,
          [parentKey]: { [childKey]: value }
        });
      } else {
        setNewEnquiry({
          ...newEnquiry,
          [parentKey]: {
            ...(newEnquiry[parentKey as keyof Enquiry] as any),
            [childKey]: value
          }
        });
      }
    } else {
      setNewEnquiry({
        ...newEnquiry,
        [name]: value
      });
    }
  };
  
  // Status change handler
  const handleStatusChange = async (enquiryId: string | undefined, newStatus: string) => {
    if (!enquiryId) return;
    
    try {
      // Update in Firestore
      const enquiryRef = doc(db, 'enquiries', enquiryId);
      await updateDoc(enquiryRef, { status: newStatus });
      
      // Update local state
      setEnquiries(prevEnquiries =>
        prevEnquiries.map(e =>
          e.id === enquiryId ? { ...e, status: newStatus } : e
        )
      );
      
      // Also update filtered enquiries
      setFilteredEnquiries(prevEnquiries =>
        prevEnquiries.map(e =>
          e.id === enquiryId ? { ...e, status: newStatus } : e
        )
      );
      
      // Update selected enquiry if it's the one being edited
      if (selectedEnquiry && selectedEnquiry.id === enquiryId) {
        setSelectedEnquiry({ ...selectedEnquiry, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating enquiry status:', error);
    }
  };
  
  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFilter('');
    setFilters({
      searchTerm: '',
      status: 'all',
      enquiryType: 'all',
      dateFrom: '',
      dateTo: '',
      visitDateFrom: '',
      visitDateTo: '',
      hasEmail: 'all',
      hasPhone: 'all',
      assignedTo: 'all',
      telecaller: 'all',
      visitingCenter: 'all',
      visitorType: 'all',
      visitType: 'all',
      visitStatus: 'all',
      hasFollowUps: 'all',
      followUpStatus: 'all',
      activeFormTypes: [],
      hasTestResults: 'all',
      hearingLossType: 'all',
      companyName: '',
      purposeOfVisit: '',
      reference: '',
      customField1: '',
      customField2: '',
    });
    setCurrentPreset('');
  };

  // Filter preset management
  const saveFilterPreset = () => {
    if (!presetName.trim()) return;
    
    const newPreset = {
      id: Date.now().toString(),
      name: presetName,
      filters: { ...filters }
    };
    
    setFilterPresets(prev => [...prev, newPreset]);
    setPresetName('');
    setShowPresetDialog(false);
    setCurrentPreset(newPreset.id);
    
    // Save to localStorage
    const updatedPresets = [...filterPresets, newPreset];
    localStorage.setItem('enquiry_filter_presets', JSON.stringify(updatedPresets));
  };

  const loadFilterPreset = (presetId: string) => {
    const preset = filterPresets.find(p => p.id === presetId);
    if (preset) {
      setFilters(preset.filters);
      setCurrentPreset(presetId);
      
      // Also update legacy filter states for backward compatibility
      setSearchTerm(preset.filters.searchTerm);
      setStatusFilter(preset.filters.status);
      setTypeFilter(preset.filters.enquiryType);
      setDateFilter(preset.filters.dateFrom);
    }
  };

  const deleteFilterPreset = (presetId: string) => {
    setFilterPresets(prev => prev.filter(p => p.id !== presetId));
    if (currentPreset === presetId) {
      setCurrentPreset('');
    }
    
    // Update localStorage
    const updatedPresets = filterPresets.filter(p => p.id !== presetId);
    localStorage.setItem('enquiry_filter_presets', JSON.stringify(updatedPresets));
  };

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    
    // Also update legacy states for backward compatibility
    if (key === 'searchTerm') setSearchTerm(value);
    if (key === 'status') setStatusFilter(value);
    if (key === 'enquiryType') setTypeFilter(value);
    if (key === 'dateFrom') setDateFilter(value);
  };

  // Advanced filter management functions
  const addAdvancedFilter = () => {
    if (!filterBuilder.field || !filterBuilder.operator) return;
    
    const newFilter = {
      id: Date.now().toString(),
      field: filterBuilder.field,
      operator: filterBuilder.operator,
      value: filterBuilder.value,
      dataType: filterBuilder.dataType,
      logicalOperator: 'AND' as 'AND' | 'OR'
    };
    
    setAdvancedFilters(prev => [...prev, newFilter]);
    setFilterBuilder({
      field: '',
      operator: '',
      value: '',
      dataType: 'text'
    });
  };

  const updateAdvancedFilter = (id: string, updates: Partial<typeof advancedFilters[0]>) => {
    setAdvancedFilters(prev => prev.map(filter => 
      filter.id === id ? { ...filter, ...updates } : filter
    ));
  };

  const removeAdvancedFilter = (id: string) => {
    setAdvancedFilters(prev => prev.filter(filter => filter.id !== id));
  };

  const clearAllAdvancedFilters = () => {
    setAdvancedFilters([]);
    clearFilters();
  };

  // Update field selection to set data type
  const handleFieldChange = (field: string) => {
    const fieldConfig = filterableFields.find(f => f.field === field);
    setFilterBuilder(prev => ({
      ...prev,
      field,
      dataType: fieldConfig?.dataType || 'text',
      operator: '',
      value: ''
    }));
  };

  // Get appropriate operators for current field
  const getAvailableOperators = () => {
    return operatorsByType[filterBuilder.dataType] || [];
  };

  // Render value input based on operator and data type
  const renderValueInput = () => {
    const { operator, dataType, value } = filterBuilder;
    
    // Some operators don't need values
    if (['is_null', 'is_not_null', 'is_empty', 'is_not_empty', 'this_month', 'last_month', 'this_year'].includes(operator)) {
      return null;
    }

    switch (dataType) {
      case 'number':
        if (operator === 'between' || operator === 'not_between') {
          return (
            <TextField
              size="small"
              placeholder="min,max (e.g., 10,100)"
              value={value}
              onChange={(e) => setFilterBuilder(prev => ({ ...prev, value: e.target.value }))}
              helperText="Enter two numbers separated by comma"
            />
          );
        }
        return (
          <TextField
            size="small"
            type="number"
            value={value}
            onChange={(e) => setFilterBuilder(prev => ({ ...prev, value: e.target.value }))}
          />
        );

      case 'date':
        if (operator === 'between') {
          return (
            <TextField
              size="small"
              placeholder="start,end (YYYY-MM-DD,YYYY-MM-DD)"
              value={value}
              onChange={(e) => setFilterBuilder(prev => ({ ...prev, value: e.target.value }))}
              helperText="Enter two dates separated by comma"
            />
          );
        }
        if (operator === 'last_days' || operator === 'next_days') {
          return (
            <TextField
              size="small"
              type="number"
              placeholder="Number of days"
              value={value}
              onChange={(e) => setFilterBuilder(prev => ({ ...prev, value: e.target.value }))}
            />
          );
        }
        return (
          <TextField
            size="small"
            type="date"
            value={value}
            onChange={(e) => setFilterBuilder(prev => ({ ...prev, value: e.target.value }))}
          />
        );

      case 'array':
        if (operator.includes('length')) {
          return (
            <TextField
              size="small"
              type="number"
              placeholder="Array length"
              value={value}
              onChange={(e) => setFilterBuilder(prev => ({ ...prev, value: e.target.value }))}
            />
          );
        }
        return (
          <TextField
            size="small"
            placeholder="Values (comma separated)"
            value={value}
            onChange={(e) => setFilterBuilder(prev => ({ ...prev, value: e.target.value }))}
            helperText="Enter values separated by commas"
          />
        );

      default: // text
        return (
          <TextField
            size="small"
            placeholder="Enter value"
            value={value}
            onChange={(e) => setFilterBuilder(prev => ({ ...prev, value: e.target.value }))}
            helperText={operator === 'regex' ? 'Enter regular expression' : ''}
          />
        );
    }
  };

  // Pagination handlers
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get paginated data
  const getPaginatedData = () => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredEnquiries.slice(startIndex, endIndex);
  };

  // Load presets from localStorage on component mount
  useEffect(() => {
    const savedPresets = localStorage.getItem('enquiry_filter_presets');
    if (savedPresets) {
      try {
        setFilterPresets(JSON.parse(savedPresets));
      } catch (error) {
        console.error('Error loading filter presets:', error);
      }
    }
  }, []);

  // Column management functions
  const availableColumns = [
    { key: 'name', label: 'Name', category: 'Basic' },
    { key: 'phone', label: 'Phone', category: 'Contact' },
    { key: 'email', label: 'Email', category: 'Contact' },
    { key: 'address', label: 'Address', category: 'Contact' },
    { key: 'reference', label: 'Reference', category: 'Basic' },
    { key: 'assignedTo', label: 'Assigned To', category: 'Management' },
    { key: 'telecaller', label: 'Telecaller', category: 'Management' },
    { key: 'visitingCenter', label: 'Visiting Center', category: 'Visit' },
    { key: 'visitStatus', label: 'Visit Status', category: 'Visit' },
    { key: 'subject', label: 'Subject', category: 'Basic' },
    { key: 'message', label: 'Message', category: 'Basic' },
    { key: 'date', label: 'Date Created', category: 'Basic' },
    { key: 'actions', label: 'Actions', category: 'System' }
  ];

  const handleColumnToggle = (columnKey: string) => {
    if (columnKey === 'actions') return; // Actions column is always visible
    
    setVisibleColumns(prev => {
      const newVisible = prev.includes(columnKey)
        ? prev.filter(col => col !== columnKey)
        : [...prev, columnKey];
      
      // Remove duplicates
      const uniqueVisible = Array.from(new Set(newVisible));
      
      // If adding a column, add it to the order if not already there
      if (!prev.includes(columnKey) && !columnOrder.includes(columnKey)) {
        setColumnOrder(currentOrder => {
          const actionsIndex = currentOrder.indexOf('actions');
          const newOrder = [...currentOrder];
          newOrder.splice(actionsIndex, 0, columnKey);
          // Remove duplicates from column order
          return Array.from(new Set(newOrder));
        });
      }
      
      return uniqueVisible;
    });
  };

  const handleColumnReorder = (dragIndex: number, hoverIndex: number) => {
    const newOrder = [...columnOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);
    setColumnOrder(newOrder);
  };

  const moveColumnUp = (columnKey: string) => {
    const currentIndex = columnOrder.indexOf(columnKey);
    if (currentIndex > 0) {
      const newOrder = [...columnOrder];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      setColumnOrder(newOrder);
    }
  };

  const moveColumnDown = (columnKey: string) => {
    const currentIndex = columnOrder.indexOf(columnKey);
    if (currentIndex < columnOrder.length - 1) {
      const newOrder = [...columnOrder];
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
      setColumnOrder(newOrder);
    }
  };

  const resetColumnSettings = () => {
    const defaultColumns = ['name', 'phone', 'email', 'reference', 'assignedTo', 'telecaller', 'date', 'actions'];
    setVisibleColumns(defaultColumns);
    setColumnOrder(defaultColumns);
  };

  const getColumnValue = (enquiry: Enquiry, columnKey: string) => {
    switch (columnKey) {
      case 'name':
        return enquiry.name || '';
      case 'phone':
        return enquiry.phone || '';
      case 'email':
        return enquiry.email || '';
      case 'address':
        return enquiry.address || '';
      case 'reference':
        return enquiry.reference || '';
      case 'assignedTo':
        return enquiry.assignedTo || '';
      case 'telecaller':
        return enquiry.telecaller || '';
      case 'visitingCenter':
        return enquiry.visitingCenter || '';
      case 'visitStatus':
        return enquiry.visitStatus || '';
      case 'subject':
        return enquiry.subject || '';
      case 'message':
        return enquiry.message || '';
      case 'date':
        return formatDate(enquiry);
      default:
        return '';
    }
  };
  
  // Get initials from name for avatar
  const getInitials = (name: string | undefined): string => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  // Get status chip component
  const getStatusChip = (status: string) => {
    let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
    
    switch (status) {
      case 'new':
        color = 'info';
        break;
      case 'in-progress':
        color = 'primary';
        break;
      case 'resolved':
        color = 'success';
        break;
      case 'closed':
        color = 'secondary';
        break;
    }
    
    return <Chip label={status} size="small" color={color} />;
  };
  
  // Open detail dialog - navigate to details page
  const handleOpenDetailDialog = (enquiry: Enquiry) => {
    // Navigate to the enquiry details page in the same tab
    router.push(`/interaction/enquiries/${enquiry.id}`);
  };
  
  // Close detail dialog
  const handleCloseDetailDialog = () => {
    setOpenDetailDialog(false);
    setSelectedEnquiry(null);
  };
  
  // Open visit dialog
  const handleOpenVisitDialog = () => {
    if (!selectedEnquiry) return;
    
    setNewVisit({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString(),
      staff: '',
      purpose: '',
      notes: '',
      testResults: '',
      recommendations: '',
      status: 'scheduled',
      visitType: '',
      activeFormTypes: [],
      testDetails: {
        testName: '',
        testDoneBy: '',
        testResults: '',
        testPrice: 0
      },
      impedanceDetails: {
        impedanceDoneBy: '',
        impedanceResults: ''
      },
      trialDetails: {
        trialDevice: '',
        trialDuration: '',
        trialFeedback: ''
      },
      homeVisitDetails: {
        visitDoneBy: '',
        hearingAidsShown: '',
        visitOutcome: ''
      },
      fittingDetails: {
        fittingDoneBy: '',
        hearingAidSold: '',
        hearingAidBrand: '',
        hearingAidModel: ''
      }
    });
    
    setVisitFormStep(0);
    setCompletedVisitSteps({});
    setOpenVisitDialog(true);
  };
  
  // Add visit to enquiry and sync with visitors collection
  const handleAddVisit = async () => {
    try {
      setVisitLoading(true);
      
      // Basic validation for visit fields
      if (!newVisit.date) {
        alert('Please fill out the visit date');
        setVisitLoading(false);
        return;
      }
      
      // Validate test fields if applicable
      if (newVisit.activeFormTypes.includes('test')) {
        if (!newVisit.testDetails?.testName) {
          alert('Test Name is required for test visits');
          setVisitLoading(false);
          return;
        }
        
        if (!newVisit.testDetails?.testDoneBy) {
          alert('Test Done By is required for test visits');
          setVisitLoading(false);
          return;
        }
      }
      
      if (!selectedEnquiry) return;
      
      // Create visit data with the correct structure matching the Visit interface
      const visitData: any = {
        id: uuidv4(),
        date: newVisit.date,
        time: newVisit.time || new Date().toLocaleTimeString(),
        staff: newVisit.staff || newVisit.testDetails?.testDoneBy || 'Staff',
        purpose: newVisit.purpose || 'Visit',
        notes: newVisit.notes || '',
        activeFormTypes: newVisit.activeFormTypes,
        createdAt: { 
          _seconds: Timestamp.now().seconds, 
          _nanoseconds: Timestamp.now().nanoseconds 
        }
      };
      
      // Add test details if this is a test visit
      if (newVisit.activeFormTypes.includes('test')) {
        visitData.testDetails = {
          testName: newVisit.testDetails.testName,
          testDoneBy: newVisit.testDetails.testDoneBy,
          testDate: new Date().toISOString().split('T')[0],
          testResults: newVisit.testDetails.testResults || '',
          testPrice: newVisit.testDetails.testPrice || 0,
          recommendations: newVisit.recommendations || '',
          hearingLossType: '',
          rightEarLoss: '',
          leftEarLoss: ''
        };
      }

      // Add impedance details if this is an impedance visit
      if (newVisit.activeFormTypes.includes('impedance')) {
        visitData.impedanceDetails = {
          testDoneBy: newVisit.impedanceDetails?.impedanceDoneBy || '',
          testDate: new Date().toISOString().split('T')[0],
          testResults: newVisit.impedanceDetails?.impedanceResults || '',
          recommendations: '',
          rightEarTympanometry: '',
          leftEarTympanometry: '',
          rightEarReflexes: '',
          leftEarReflexes: ''
        };
      }

      // Add trial details if this is a trial visit
      if (newVisit.activeFormTypes.includes('trial')) {
        visitData.trialDetails = {
          trialDate: new Date().toISOString().split('T')[0],
          trialDoneBy: newVisit.trialDetails?.trialDevice || '',
          trialDevice: newVisit.trialDetails?.trialDevice || '',
          trialDuration: newVisit.trialDetails?.trialDuration || '',
          trialFeedback: newVisit.trialDetails?.trialFeedback || '',
          deviceBrand: '',
          deviceModel: '',
          deviceTechnology: '',
          deviceStyle: '',
          trialResult: '',
          patientFeedback: '',
          speechClarity: 0,
          noiseComfort: 0,
          deviceFeatures: []
        };
      }

      // Add home visit details if this is a home visit
      if (newVisit.activeFormTypes.includes('home_visit')) {
        visitData.homeVisitDetails = {
          visitDate: new Date().toISOString().split('T')[0],
          visitDoneBy: newVisit.homeVisitDetails?.visitDoneBy || '',
          hearingAidsShown: newVisit.homeVisitDetails?.hearingAidsShown || '',
          visitNotes: newVisit.notes || '',
          visitOutcome: newVisit.homeVisitDetails?.visitOutcome || '',
          visitTime: newVisit.time || '',
          visitAddress: '',
          travelDistance: '',
          patientMobility: '',
          familyPresent: false,
          familyMembers: '',
          environmentNoise: '',
          followupRequired: false,
          devicesRecommended: []
        };
      }

      // Add fitting details if this is a fitting visit
      if (newVisit.activeFormTypes.includes('hearing_aid')) {
        visitData.fittingDetails = {
          fittingDate: new Date().toISOString().split('T')[0],
          fittingDoneBy: newVisit.fittingDetails?.fittingDoneBy || '',
          hearingAidBrand: newVisit.fittingDetails?.hearingAidBrand || '',
          hearingAidModel: newVisit.fittingDetails?.hearingAidModel || '',
          hearingAidSold: newVisit.fittingDetails?.hearingAidSold || '',
          serialNumber: '',
          hearingAidPrice: 0,
          warranty: '',
          accessories: [],
          followupDate: ''
        };
      }
      
      // Update the enquiry with the new visit
      const updatedVisits = [...(selectedEnquiry.visits || []), visitData];
      
      // Use the correct method to reference the document
      if (!selectedEnquiry.id) return;
      const enquiryRef = doc(db, 'enquiries', selectedEnquiry.id);
      
      await updateDoc(enquiryRef, {
        visits: updatedVisits
      });

      // SYNC WITH VISITORS COLLECTION: Create/Update visitor record
      try {
        // Create visitor data that matches the visitor interface
        const visitorData = {
          name: selectedEnquiry.name || '',
          phone: selectedEnquiry.phone || '',
          email: selectedEnquiry.email || '',
          visitorType: 'patient' as const,
          visitType: newVisit.activeFormTypes.includes('test') ? 'test' as const :
                    newVisit.activeFormTypes.includes('trial') ? 'trial' as const :
                    newVisit.activeFormTypes.includes('hearing_aid') ? 'fitting' as const :
                    newVisit.activeFormTypes.includes('home_visit') ? 'consultation' as const :
                    'consultation' as const,
          visitingCenter: 'main',
          visitDate: newVisit.date,
          visitTime: newVisit.time || '09:00',
          status: 'completed' as const,
          notes: newVisit.notes || '',
          enquiryId: selectedEnquiry.id,
          activeFormTypes: newVisit.activeFormTypes,
          purposeOfVisit: newVisit.purpose || 'Medical consultation',
          companyName: '',
          contactPerson: '',
          visitSchedules: [],
          testDetails: visitData.testDetails || {},
          trialDetails: visitData.trialDetails || {},
          fittingDetails: visitData.fittingDetails || {},
          homeVisitDetails: visitData.homeVisitDetails || {},
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        // Remove any undefined values to prevent Firebase errors
        const cleanVisitorData: any = {};
        Object.keys(visitorData).forEach(key => {
          const value = (visitorData as any)[key];
          if (value !== undefined && value !== null && value !== '') {
            cleanVisitorData[key] = value;
          }
        });

        // Add to visitors collection
        await addDoc(collection(db, 'visitors'), cleanVisitorData);
        
        console.log('Visitor record created successfully');
      } catch (visitorError) {
        console.error('Error creating visitor record:', visitorError);
        // Don't fail the entire operation if visitor creation fails
      }
      
      // Update the local state
      const updatedEnquiry = {
        ...selectedEnquiry,
        visits: updatedVisits
      };
      
      setSelectedEnquiry(updatedEnquiry);
      
      // Update the enquiry in the main list
      setEnquiries(prev => 
        prev.map(item => 
          item.id === selectedEnquiry.id ? updatedEnquiry : item
        )
      );
      
      // Also update the filtered enquiries
      setFilteredEnquiries(prev => 
        prev.map(item => 
          item.id === selectedEnquiry.id ? updatedEnquiry : item
        )
      );
      
      // Close the dialog
      handleCloseVisitDialog();
      
      // Show success message or notification
      console.log('Visit added successfully and synced with visitors collection');
    } catch (error) {
      console.error('Error adding visit:', error);
    } finally {
      setVisitLoading(false);
    }
  };
  
  // Visit form input change handler
  const handleVisitChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent) => {
    const { name, value } = e.target;
    
    // Handle nested properties using dot notation (e.g., "testDetails.testName")
    if (name.includes('.')) {
      const [parentKey, childKey] = name.split('.');
      setNewVisit({
        ...newVisit,
        [parentKey]: {
          ...newVisit[parentKey as keyof typeof newVisit],
          [childKey]: value
        }
      });
    } else {
      setNewVisit({
        ...newVisit,
        [name]: value
      });
    }
  };
  
  // Follow-up form input change handler
  const handleFollowUpChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewFollowUp({
      ...newFollowUp,
      [name]: value
    });
  };
  
  // Open follow-up dialog
  const handleOpenFollowUpDialog = () => {
    if (!selectedEnquiry) return;
    
    setNewFollowUp({
      date: new Date().toISOString().split('T')[0],
      remarks: '',
      nextFollowUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      callerName: ''
    });
    
    setOpenFollowUpDialog(true);
  };
  
  // Close follow-up dialog
  const handleCloseFollowUpDialog = () => {
    setOpenFollowUpDialog(false);
  };
  
  // Add follow-up to enquiry
  const handleAddFollowUp = async () => {
    if (!selectedEnquiry) return;
    
    try {
      setLoading(true);
      
      // Prepare the follow-up data
      const followUpData = {
        ...newFollowUp,
        id: crypto.randomUUID(),
        createdAt: Timestamp.now()
      };
      
      // Update the enquiry with the new follow-up
      const updatedFollowUps = [...(selectedEnquiry.followUps || []), followUpData];
      const enquiryRef = doc(db, 'enquiries', selectedEnquiry.id);
      
      await updateDoc(enquiryRef, {
        followUps: updatedFollowUps
      });
      
      // Update the local state
      setSelectedEnquiry({
        ...selectedEnquiry,
        followUps: updatedFollowUps
      });
      
      // Update the enquiry in the main list
      setEnquiries(prev => 
        prev.map(item => 
          item.id === selectedEnquiry.id ? { ...item, followUps: updatedFollowUps } : item
        )
      );
      
      // Close the dialog
      handleCloseFollowUpDialog();
      
      // Show success message or notification
      console.log('Follow-up added successfully');
    } catch (error) {
      console.error('Error adding follow-up:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Edit enquiry with simplified form
  const handleEdit = (enquiry: Enquiry) => {
    // Navigate to edit enquiry page
    window.location.href = `/interaction/enquiries/edit/${enquiry.id}`;
  };

  // Create a function to validate the test form fields
  const validateTestForm = () => {
    const errors: {[key: string]: string} = {};
    
    // Check required test fields
    if (activeStep === 2 && newEnquiry.activeFormTypes.includes('test')) {
      if (!newEnquiry.testDetails?.testName) {
        errors['testDetails.testName'] = 'Test Name is required';
      }
      
      if (!newEnquiry.testDetails?.testDoneBy) {
        errors['testDetails.testDoneBy'] = 'Test Done By is required';
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Fix the handleNext function to properly validate and advance steps
  const handleNext = () => {
    if (activeStep === 0) {
      // Validate basic information
      if (!newEnquiry.name || !newEnquiry.phone) {
        alert('Please fill out required fields: Name and Phone');
        return;
      }
    } else if (activeStep === 1) {
      // Medical services step - no validation needed, just advance
    }
    
    const newCompleted = {...completed};
    newCompleted[activeStep] = true;
    setCompleted(newCompleted);
    setActiveStep(activeStep + 1);
  };
  
  // Modify the handleSubmit function to include validation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('handleSubmit called'); // Debug log
    console.log('newEnquiry:', newEnquiry); // Debug log
    
    // Check for required fields
    if (!newEnquiry.name || !newEnquiry.phone || !newEnquiry.reference) {
      console.log('Validation failed - missing required fields'); // Debug log
      setAlert({
        open: true,
        message: 'Please fill in all required fields: Name, Phone, and Reference.',
        severity: 'error'
      });
      return;
    }
    
    console.log('Validation passed, setting loading to true'); // Debug log
    setLoading(true);
    
    try {
      const enquiryData: any = {
        name: newEnquiry.name,
        phone: newEnquiry.phone,
        email: newEnquiry.email || '',
        address: newEnquiry.address || '',
        reference: newEnquiry.reference,
        assignedTo: newEnquiry.assignedTo || '',
        telecaller: newEnquiry.telecaller || '',
        message: newEnquiry.message || '',
        status: newEnquiry.status || 'open',
        followUps: newEnquiry.followUps || [],
        activeFormTypes: newEnquiry.activeFormTypes || [],
        createdAt: isEditMode ? newEnquiry.createdAt : serverTimestamp(),
      };
      
      // Add source if it exists on the newEnquiry object
      if ('source' in newEnquiry) {
        enquiryData.source = newEnquiry.source || '';
      }
      
      // Only add specialized form details if they exist
      if (newEnquiry.testDetails) {
        enquiryData.testDetails = newEnquiry.testDetails;
      }
      
      if (newEnquiry.impedanceDetails) {
        enquiryData.impedanceDetails = newEnquiry.impedanceDetails;
      }
      
      if (newEnquiry.trialDetails) {
        enquiryData.trialDetails = newEnquiry.trialDetails;
      }
      
      if (newEnquiry.homeVisitDetails) {
        enquiryData.homeVisitDetails = newEnquiry.homeVisitDetails;
      }
      
      if (newEnquiry.fittingDetails) {
        enquiryData.fittingDetails = newEnquiry.fittingDetails;
      }
    
      if (isEditMode) {
        const enquiryDocRef = doc(db, 'enquiries', newEnquiry.id!);
        await updateDoc(enquiryDocRef, enquiryData);
        setAlert({
          open: true,
          message: 'Enquiry updated successfully!',
          severity: 'success'
        });
      } else {
        await addDoc(collection(db, 'enquiries'), enquiryData);
        setAlert({
          open: true,
          message: 'Enquiry added successfully!',
          severity: 'success'
        });
      }
      
      handleCloseDialog();
      fetchEnquiries();
    } catch (error) {
      console.error('Error saving enquiry:', error);
      setAlert({
        open: true,
        message: `Error: ${(error as any).message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Add a function to check if a step is completed
  const isStepComplete = (step: number): boolean => {
    return Boolean(completed[step]);
  };

  // Add a function to check if current step is the last step
  const isLastStep = (): boolean => {
    // New simplified step structure:
    // 0: Basic Details & Follow-ups
    // 1: Medical Services
    // 2: Summary & Review
    
    return activeStep >= 2; // Last step is step 2
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <StyledFormSection>
            <FormSectionTitle>
              <PersonIcon />
              Patient Information
            </FormSectionTitle>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Full Name *"
                  name="name"
                  value={newEnquiry.name || ''}
                  onChange={handleInputChange}
                  required
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone Number *"
                  name="phone"
                  value={newEnquiry.phone || ''}
                  onChange={handleInputChange}
                  required
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email Address"
                  name="email"
                  type="email"
                  value={newEnquiry.email || ''}
                  onChange={handleInputChange}
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Visiting Center</InputLabel>
                  <Select
                    name="visitingCenter"
                    value={newEnquiry.visitingCenter || 'main'}
                    label="Visiting Center"
                    onChange={handleInputChange}
                  >
                    <MenuItem value="main">Main Center</MenuItem>
                    <MenuItem value="north">North Branch</MenuItem>
                    <MenuItem value="south">South Branch</MenuItem>
                    <MenuItem value="east">East Branch</MenuItem>
                    <MenuItem value="west">West Branch</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }} required>
                  <InputLabel>Reference *</InputLabel>
                  <Select
                    name="reference"
                    value={newEnquiry.reference || ''}
                    label="Reference *"
                    onChange={handleInputChange}
                    required
                  >
                    <MenuItem value="Camp">Camp</MenuItem>
                    <MenuItem value="CGHS/DGEHS/ Any Govt. deptt">CGHS/DGEHS/ Any Govt. deptt</MenuItem>
                    <MenuItem value="converted">converted</MenuItem>
                    <MenuItem value="Dealer">Dealer</MenuItem>
                    <MenuItem value="Dr Deepika Ref.">Dr Deepika Ref.</MenuItem>
                    <MenuItem value="Dr Yogesh Kansal Ref.">Dr Yogesh Kansal Ref.</MenuItem>
                    <MenuItem value="existing">existing</MenuItem>
                    <MenuItem value="Gautam dhamija">Gautam dhamija</MenuItem>
                    <MenuItem value="GN RESOUND ENQUIRY">GN RESOUND ENQUIRY</MenuItem>
                    <MenuItem value="Google Adwords">Google Adwords</MenuItem>
                    <MenuItem value="Hear.com">Hear.com</MenuItem>
                    <MenuItem value="home service">home service</MenuItem>
                    <MenuItem value="INDIAMART">INDIAMART</MenuItem>
                    <MenuItem value="just dial">just dial</MenuItem>
                    <MenuItem value="Medical Store Reference">Medical Store Reference</MenuItem>
                    <MenuItem value="must and more">must and more</MenuItem>
                    <MenuItem value="Nath brother ( chemist )">Nath brother ( chemist )</MenuItem>
                    <MenuItem value="Online">Online</MenuItem>
                    <MenuItem value="Other Doctor Referenes">Other Doctor Referenes</MenuItem>
                    <MenuItem value="reference existing patient">reference existing patient</MenuItem>
                    <MenuItem value="Visit Health">Visit Health</MenuItem>
                    <MenuItem value="walking">walking</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  name="address"
                  value={newEnquiry.address || ''}
                  onChange={handleInputChange}
                  multiline
                  rows={2}
                  variant="outlined"
                  sx={{ mb: 2 }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Additional Notes"
                  name="notes"
                  value={newEnquiry.notes || ''}
                  onChange={handleInputChange}
                  multiline
                  rows={3}
                  variant="outlined"
                />
              </Grid>
            </Grid>
          </StyledFormSection>
        );

      case 1:
        return (
          <StyledFormSection>
            <FormSectionTitle>
              <MedicalServicesIcon />
              Medical Services & Configuration
            </FormSectionTitle>
            
            {/* Service Selection */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Select Required Services:
              </Typography>
              <Grid container spacing={2}>
                {specializedFormTypes.map((formType) => (
                  <Grid item xs={12} sm={6} md={3} key={formType.value}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: newEnquiry.activeFormTypes.includes(formType.value) ? '2px solid' : '1px solid',
                        borderColor: newEnquiry.activeFormTypes.includes(formType.value) ? 'primary.main' : 'divider',
                        bgcolor: newEnquiry.activeFormTypes.includes(formType.value) ? alpha('#1976d2', 0.1) : 'background.paper',
                        '&:hover': {
                          boxShadow: 3,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s ease'
                        }
                      }}
                      onClick={() => {
                        const isSelected = newEnquiry.activeFormTypes.includes(formType.value);
                        const updatedTypes = isSelected
                          ? newEnquiry.activeFormTypes.filter(type => type !== formType.value)
                          : [...newEnquiry.activeFormTypes, formType.value];

                        setNewEnquiry({ ...newEnquiry, activeFormTypes: updatedTypes });
                      }}
                    >
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Box sx={{ mb: 1, color: 'primary.main' }}>
                          {getFormTypeIcon(formType.value)}
                        </Box>
                        <Typography variant="body2" fontWeight="medium">
                          {formType.label}
                        </Typography>
                        {newEnquiry.activeFormTypes.includes(formType.value) && (
                          <CheckCircleIcon sx={{ color: 'success.main', mt: 1, fontSize: 20 }} />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Quick Configuration for Selected Services */}
            <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                DEBUG - Quick Configuration:
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                activeFormTypes length: {newEnquiry.activeFormTypes.length}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                activeFormTypes content: [{newEnquiry.activeFormTypes.map(t => `"${t}"`).join(', ')}]
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Contains hearing_aid_details: {newEnquiry.activeFormTypes.includes('hearing_aid_details') ? 'YES' : 'NO'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                newEnquiry object keys: {Object.keys(newEnquiry).join(', ')}
              </Typography>
            </Box>
            
            {/* Actual Quick Configuration for Selected Services */}
            {newEnquiry.activeFormTypes.length > 0 && (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                  Quick Configuration:
                </Typography>
                <Grid container spacing={2}>
                  {newEnquiry.activeFormTypes.includes('test') && (
                    <Grid item xs={12} md={6}>
                      <Card sx={{ p: 2, bgcolor: alpha('#1976d2', 0.05) }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main', fontWeight: 600 }}>
                          <HearingIcon sx={{ mr: 1, fontSize: 18 }} />
                          Hearing Test
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          label="Test Type"
                          value={newEnquiry.testDetails?.testName || ''}
                          onChange={(e) => setNewEnquiry({
                            ...newEnquiry,
                            testDetails: { ...newEnquiry.testDetails, testName: e.target.value }
                          })}
                          sx={{ mb: 1 }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="Conducted By"
                          value={newEnquiry.testDetails?.testDoneBy || ''}
                          onChange={(e) => setNewEnquiry({
                            ...newEnquiry,
                            testDetails: { ...newEnquiry.testDetails, testDoneBy: e.target.value }
                          })}
                        />
                      </Card>
                    </Grid>
                  )}
                  
                  {newEnquiry.activeFormTypes.includes('hearing_aid_details') && (
                    <Grid item xs={12}>
                      <Card sx={{ p: 3, bgcolor: alpha('#1976d2', 0.05), border: '1px solid', borderColor: alpha('#1976d2', 0.2) }}>
                        <Typography variant="subtitle2" sx={{ mb: 2, color: 'primary.main', fontWeight: 600, fontSize: '1.1rem' }}>
                          <HearingIcon sx={{ mr: 1, fontSize: 20 }} />
                          Hearing Aid Details
                        </Typography>
                        
                        <Grid container spacing={2}>
                          {/* Product Information */}
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Product Name"
                              value={newEnquiry.hearingAidDetails?.productName || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                hearingAidDetails: { ...newEnquiry.hearingAidDetails, productName: e.target.value }
                              })}
                              sx={{ mb: 1 }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Brand"
                              value={newEnquiry.hearingAidDetails?.productBrand || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                hearingAidDetails: { ...newEnquiry.hearingAidDetails, productBrand: e.target.value }
                              })}
                              sx={{ mb: 1 }}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Model"
                              value={newEnquiry.hearingAidDetails?.productModel || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                hearingAidDetails: { ...newEnquiry.hearingAidDetails, productModel: e.target.value }
                              })}
                              sx={{ mb: 1 }}
                            />
                          </Grid>
                          
                          {/* Pricing Information */}
                          <Grid item xs={12} md={3}>
                            <TextField
                              fullWidth
                              size="small"
                              label="MRP (₹)"
                              type="number"
                              value={newEnquiry.hearingAidDetails?.mrp || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                hearingAidDetails: { ...newEnquiry.hearingAidDetails, mrp: parseFloat(e.target.value) || 0 }
                              })}
                              sx={{ mb: 1 }}
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Quotation Price (₹)"
                              type="number"
                              value={newEnquiry.hearingAidDetails?.quotationPrice || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                hearingAidDetails: { ...newEnquiry.hearingAidDetails, quotationPrice: parseFloat(e.target.value) || 0 }
                              })}
                              sx={{ mb: 1 }}
                            />
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                              <InputLabel>Status</InputLabel>
                              <Select
                                value={newEnquiry.hearingAidDetails?.status || 'enquiry'}
                                label="Status"
                                onChange={(e) => setNewEnquiry({
                                  ...newEnquiry,
                                  hearingAidDetails: { ...newEnquiry.hearingAidDetails, status: e.target.value as any }
                                })}
                              >
                                <MenuItem value="enquiry">Enquiry</MenuItem>
                                <MenuItem value="quotation_sent">Quotation Sent</MenuItem>
                                <MenuItem value="trial_scheduled">Trial Scheduled</MenuItem>
                                <MenuItem value="trial_ongoing">Trial Ongoing</MenuItem>
                                <MenuItem value="trial_completed">Trial Completed</MenuItem>
                                <MenuItem value="purchased">Purchased</MenuItem>
                                <MenuItem value="fitted">Fitted</MenuItem>
                                <MenuItem value="delivered">Delivered</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                              <InputLabel>Priority</InputLabel>
                              <Select
                                value={newEnquiry.hearingAidDetails?.priority || 'medium'}
                                label="Priority"
                                onChange={(e) => setNewEnquiry({
                                  ...newEnquiry,
                                  hearingAidDetails: { ...newEnquiry.hearingAidDetails, priority: e.target.value as any }
                                })}
                              >
                                <MenuItem value="low">Low</MenuItem>
                                <MenuItem value="medium">Medium</MenuItem>
                                <MenuItem value="high">High</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      </Card>
                    </Grid>
                  )}
                  
                  {newEnquiry.activeFormTypes.includes('home_visit') && (
                    <Grid item xs={12} md={6}>
                      <Card sx={{ p: 2, bgcolor: alpha('#ed6c02', 0.05) }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, color: 'warning.main', fontWeight: 600 }}>
                          <HomeIcon sx={{ mr: 1, fontSize: 18 }} />
                          Home Visit
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          label="Visit Address"
                          value={newEnquiry.homeVisitDetails?.visitAddress || ''}
                          onChange={(e) => setNewEnquiry({
                            ...newEnquiry,
                            homeVisitDetails: { ...newEnquiry.homeVisitDetails, visitAddress: e.target.value }
                          })}
                          sx={{ mb: 1 }}
                        />
                        <TextField
                          fullWidth
                          size="small"
                          label="Contact Person"
                          value={newEnquiry.homeVisitDetails?.familyMembers || ''}
                          onChange={(e) => setNewEnquiry({
                            ...newEnquiry,
                            homeVisitDetails: { ...newEnquiry.homeVisitDetails, familyMembers: e.target.value }
                          })}
                        />
                      </Card>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}

            {newEnquiry.activeFormTypes.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                <MedicalServicesIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="h6" gutterBottom>
                  Select Medical Services
                </Typography>
                <Typography variant="body2">
                  Choose the services this patient requires from the options above.
                </Typography>
              </Box>
            )}
          </StyledFormSection>
        );

      case 2:
        // Visit Scheduling (only in edit mode)
        if (!isEditMode) return getStepContent(3); // Skip to follow-ups if not edit mode
        
        return (
          <StyledFormSection>
            <FormSectionTitle>
              <EventNoteIcon />
              Visit Scheduling
            </FormSectionTitle>
            
            {/* Visit scheduling content will be here */}
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" gutterBottom>
                Visit Scheduling
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage patient visit schedules and appointments.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleOpenVisitDialog}
                sx={{ mt: 2 }}
              >
                Schedule New Visit
              </Button>
            </Box>
          </StyledFormSection>
        );

      case 3:
        // Follow-up Management (step 3 in edit mode, step 2 in create mode)
        return (
          <StyledFormSection>
            <FormSectionTitle>
              <FollowUpIcon />
              Follow-up Management
            </FormSectionTitle>
            
            <TableContainer component={Paper} sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Call Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Feedback</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Next Follow-up</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Telecaller</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {newEnquiry.followUps && newEnquiry.followUps.length > 0 ? (
                    newEnquiry.followUps.map((followUp, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <TextField
                            type="date"
                            size="small"
                            value={followUp.date || ''}
                            onChange={(e) => {
                              const updatedFollowUps = [...(newEnquiry.followUps || [])];
                              updatedFollowUps[index] = { ...followUp, date: e.target.value };
                              setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                            }}
                            InputLabelProps={{ shrink: true }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            multiline
                            rows={2}
                            value={followUp.remarks || ''}
                            onChange={(e) => {
                              const updatedFollowUps = [...(newEnquiry.followUps || [])];
                              updatedFollowUps[index] = { ...followUp, remarks: e.target.value };
                              setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                            }}
                            sx={{ minWidth: 200 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="date"
                            size="small"
                            value={followUp.nextFollowUpDate || ''}
                            onChange={(e) => {
                              const updatedFollowUps = [...(newEnquiry.followUps || [])];
                              updatedFollowUps[index] = { ...followUp, nextFollowUpDate: e.target.value };
                              setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                            }}
                            InputLabelProps={{ shrink: true }}
                          />
                        </TableCell>
                        <TableCell>
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={followUp.callerName || ''}
                              onChange={(e) => {
                                const updatedFollowUps = [...(newEnquiry.followUps || [])];
                                updatedFollowUps[index] = { ...followUp, callerName: e.target.value };
                                setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                              }}
                              displayEmpty
                            >
                              <MenuItem value="">-None-</MenuItem>
                              <MenuItem value="Staff 1">Staff 1</MenuItem>
                              <MenuItem value="Staff 2">Staff 2</MenuItem>
                              <MenuItem value="Manager">Manager</MenuItem>
                              <MenuItem value="Telecaller">Telecaller</MenuItem>
                            </Select>
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => {
                              const updatedFollowUps = newEnquiry.followUps?.filter((_, i) => i !== index) || [];
                              setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No follow-up records yet. Click "Add Follow-up" to add the first record.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                const newFollowUp = {
                  id: crypto.randomUUID(),
                  date: '',
                  remarks: '',
                  nextFollowUpDate: '',
                  callerName: '',
                  createdAt: {
                    seconds: Math.floor(Date.now() / 1000),
                    nanoseconds: 0
                  }
                };
                setNewEnquiry({
                  ...newEnquiry,
                  followUps: [...(newEnquiry.followUps || []), newFollowUp]
                });
              }}
              sx={{ mb: 2 }}
            >
              Add Follow-up
            </Button>
          </StyledFormSection>
        );

      case 4:
        // Summary & Review (step 4 in edit mode, step 3 in create mode)
        return (
          <StyledFormSection>
            <FormSectionTitle>
              <CheckCircleIcon />
              Summary & Review
            </FormSectionTitle>
            
            <Grid container spacing={3}>
              {/* Patient Information Summary */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, bgcolor: alpha('#1976d2', 0.05) }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                    <PersonIcon sx={{ mr: 1 }} />
                    Patient Information
                  </Typography>
                  <Box sx={{ '& > div': { mb: 1 } }}>
                    <Typography variant="body2"><strong>Name:</strong> {newEnquiry.name || 'Not provided'}</Typography>
                    {userProfile?.role !== 'audiologist' && (
                      <Typography variant="body2"><strong>Phone:</strong> {newEnquiry.phone || 'Not provided'}</Typography>
                    )}
                    <Typography variant="body2"><strong>Email:</strong> {newEnquiry.email || 'Not provided'}</Typography>
                    <Typography variant="body2"><strong>Address:</strong> {newEnquiry.address || 'Not provided'}</Typography>
                    <Typography variant="body2"><strong>Center:</strong> {newEnquiry.visitingCenter || 'Main Center'}</Typography>
                    <Typography variant="body2"><strong>Subject:</strong> {newEnquiry.subject || 'Not provided'}</Typography>
                  </Box>
                </Card>
              </Grid>

              {/* Medical Services Summary */}
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 2, bgcolor: alpha('#2e7d32', 0.05) }}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'success.main' }}>
                    <MedicalServicesIcon sx={{ mr: 1 }} />
                    Medical Services
                  </Typography>
                  {newEnquiry.activeFormTypes.length > 0 ? (
                    <Box sx={{ '& > div': { mb: 1 } }}>
                      {newEnquiry.activeFormTypes.map(type => (
                        <Chip 
                          key={type} 
                          label={specializedFormTypes.find(f => f.value === type)?.label || type}
                          size="small"
                          color="success"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No medical services selected
                    </Typography>
                  )}
                </Card>
              </Grid>

              {/* Follow-ups Summary */}
              {newEnquiry.followUps && newEnquiry.followUps.length > 0 && (
                <Grid item xs={12}>
                  <Card sx={{ p: 2, bgcolor: alpha('#ed6c02', 0.05) }}>
                    <Typography variant="h6" sx={{ mb: 2, color: 'warning.main' }}>
                      <FollowUpIcon sx={{ mr: 1 }} />
                      Follow-up Schedule ({newEnquiry.followUps.length} records)
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {newEnquiry.followUps.length} follow-up records have been configured for this patient.
                    </Typography>
                  </Card>
                </Grid>
              )}

              {/* Ready to Save */}
              <Grid item xs={12}>
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    Ready to Save!
                  </Typography>
                  <Typography variant="body2">
                    All information has been collected. Click "Save Enquiry" to create the patient record.
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </StyledFormSection>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ 
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: 'background.default',
      p: 2
    }}>
      {/* Header Section */}
      <Box sx={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: 'background.paper',
        zIndex: 1200,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        flexShrink: 0
      }}>
        <Typography variant="h5" component="h1">
          Enquiries Management
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          gap: 1,
          flexWrap: 'wrap'
        }}>
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={refreshing}
            size="small"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button 
            variant="outlined" 
            startIcon={<ViewColumnIcon />}
            onClick={() => setColumnManagementOpen(true)}
            size="small"
          >
            Manage Columns
          </Button>
        {userProfile?.role !== 'audiologist' && (
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleOpenSimplifiedDialog}
            size="small"
          >
            New Enquiry
          </Button>
        )}
        </Box>
      </Box>

      {/* Content Area */}
      <Box sx={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        overflow: 'hidden'
      }}>

      {/* Enquiry Statistics Cards */}
      <Grid container spacing={1} sx={{ mb: 2, flexShrink: 0 }}>
        {(() => {
          const totalEnquiries = enquiries.length;
          const openEnquiries = enquiries.filter(e => e.status === 'open').length;
          const inProgressEnquiries = enquiries.filter(e => e.status === 'in-progress').length;
          const resolvedEnquiries = enquiries.filter(e => e.status === 'resolved').length;
          const todayEnquiries = enquiries.filter(e => {
            if (e.createdAt?._seconds) {
              const enquiryDate = new Date(e.createdAt._seconds * 1000).toDateString();
              return enquiryDate === new Date().toDateString();
            }
            return false;
          }).length;
          
          const statCards = [
            { title: 'Total Enquiries', value: totalEnquiries, icon: <AssignmentIcon />, color: 'primary.main' },
            { title: "Today's Enquiries", value: todayEnquiries, icon: <TodayIcon />, color: 'success.main' },
            { title: 'Open', value: openEnquiries, icon: <EmailIcon />, color: 'info.main' },
            { title: 'In Progress', value: inProgressEnquiries, icon: <ScheduleIcon />, color: 'warning.main' },
            { title: 'Resolved', value: resolvedEnquiries, icon: <CheckCircleIcon />, color: 'success.main' }
          ];
          
          return statCards.map((stat, index) => (
            <Grid item xs={12} sm={6} md={2.4} key={index}>
              <Paper 
                sx={{ 
                  p: 1.5, 
                  display: 'flex', 
                  alignItems: 'center', 
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  minHeight: '70px'
                }}
              >
                <Box 
                  sx={{ 
                    mr: 1.5, 
                    p: 1, 
                    borderRadius: 1, 
                    bgcolor: stat.color,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {stat.icon}
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                    {stat.title}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ));
        })()}
      </Grid>



      {/* Advanced Search and Filter Controls */}
      <Paper sx={{ 
        p: 2, 
        mb: 2, 
        flexShrink: 0,
        maxHeight: '40vh', // Reduced height to give more space to table
        overflow: 'auto', // Add scroll if needed
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-track': { backgroundColor: '#f1f1f1' },
        '&::-webkit-scrollbar-thumb': { backgroundColor: '#888', borderRadius: '4px' }
      }}>
        {/* Filter Presets */}
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" color="text.secondary">Filter Presets:</Typography>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={currentPreset}
              onChange={(e) => loadFilterPreset(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">Select Preset</MenuItem>
              {filterPresets.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  {preset.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setShowPresetDialog(true)}
            startIcon={<AddIcon />}
          >
            Save Current
          </Button>
          {currentPreset && (
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => deleteFilterPreset(currentPreset)}
              startIcon={<DeleteIcon />}
            >
              Delete
            </Button>
          )}
        </Box>

        {/* Advanced Filter Builder - More Compact */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">Advanced Filter Builder</Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setShowFilterBuilder(!showFilterBuilder)}
              startIcon={showFilterBuilder ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {showFilterBuilder ? 'Hide' : 'Show'} Builder
            </Button>
          </Box>

          <Collapse in={showFilterBuilder}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', mb: 2 }}>
              <Grid container spacing={1} alignItems="end" sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6} md={2.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Field</InputLabel>
                    <Select
                      value={filterBuilder.field}
                      label="Field"
                      onChange={(e) => handleFieldChange(e.target.value)}
                    >
                      {filterableFields.map((field) => (
                        <MenuItem key={field.field} value={field.field}>
                          {field.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={2.5}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Operator</InputLabel>
                    <Select
                      value={filterBuilder.operator}
                      label="Operator"
                      onChange={(e) => setFilterBuilder(prev => ({ ...prev, operator: e.target.value, value: '' }))}
                      disabled={!filterBuilder.field}
                    >
                      {getAvailableOperators().map((op) => (
                        <MenuItem key={op.value} value={op.value}>
                          {op.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  {renderValueInput()}
                </Grid>

                <Grid item xs={12} sm={6} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={addAdvancedFilter}
                    disabled={!filterBuilder.field || !filterBuilder.operator}
                    startIcon={<AddIcon />}
                    size="small"
                  >
                    Add
                  </Button>
                </Grid>

                <Grid item xs={12} sm={12} md={2}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={clearAllAdvancedFilters}
                    disabled={advancedFilters.length === 0}
                    startIcon={<ClearIcon />}
                    size="small"
                  >
                    Clear All
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Collapse>

          {/* Active Advanced Filters - Compact Display */}
          {advancedFilters.length > 0 && (
            <Box sx={{ mb: 2, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="caption" fontWeight="bold">
                  Active Filters ({advancedFilters.length}):
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {advancedFilters.map((filter, index) => {
                  const fieldLabel = filterableFields.find(f => f.field === filter.field)?.label || filter.field;
                  const operatorLabel = operatorsByType[filter.dataType]?.find(op => op.value === filter.operator)?.label || filter.operator;
                  
                  return (
                    <Box key={filter.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {index > 0 && (
                        <Chip 
                          label={filter.logicalOperator || 'AND'} 
                          size="small" 
                          variant="outlined"
                          onClick={() => updateAdvancedFilter(filter.id, { 
                            logicalOperator: filter.logicalOperator === 'AND' ? 'OR' : 'AND' 
                          })}
                          sx={{ fontSize: '0.7rem', height: '20px' }}
                        />
                      )}
                      
                      <Chip
                        label={`${fieldLabel}: ${operatorLabel} ${filter.value || ''}`}
                        variant="outlined"
                        onDelete={() => removeAdvancedFilter(filter.id)}
                        size="small"
                        sx={{ fontSize: '0.75rem', height: '24px' }}
                      />
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}
        </Box>

        {/* Basic Filters Row */}
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by name, phone, email, reference..."
              value={filters.searchTerm || searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: (filters.searchTerm || searchTerm) && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => updateFilter('searchTerm', '')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status || statusFilter}
                label="Status"
                onChange={(e) => updateFilter('status', e.target.value)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.enquiryType}
                label="Type"
                onChange={(e) => updateFilter('enquiryType', e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="general">General</MenuItem>
                <MenuItem value="product">Product Inquiry</MenuItem>
                <MenuItem value="service">Service Request</MenuItem>
                <MenuItem value="complaint">Complaint</MenuItem>
                <MenuItem value="appointment">Appointment</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              type="date"
              fullWidth
              size="small"
              label="Date From"
              value={filters.dateFrom || dateFilter}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              type="date"
              fullWidth
              size="small"
              label="Date To"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={1}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={showAdvancedFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              size="small"
            >
              {showAdvancedFilters ? 'Less' : 'More'}
            </Button>
          </Grid>
        </Grid>

        {/* Advanced Filters */}
        <Collapse in={showAdvancedFilters}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>Advanced Filters</Typography>
            
            {/* Contact & Assignment Filters */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Has Email</InputLabel>
                  <Select
                    value={filters.hasEmail}
                    label="Has Email"
                    onChange={(e) => updateFilter('hasEmail', e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="yes">Yes</MenuItem>
                    <MenuItem value="no">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Has Phone</InputLabel>
                  <Select
                    value={filters.hasPhone}
                    label="Has Phone"
                    onChange={(e) => updateFilter('hasPhone', e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="yes">Yes</MenuItem>
                    <MenuItem value="no">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Assigned To</InputLabel>
                  <Select
                    value={filters.assignedTo}
                    label="Assigned To"
                    onChange={(e) => updateFilter('assignedTo', e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="Dr. Smith">Dr. Smith</MenuItem>
                    <MenuItem value="Dr. Johnson">Dr. Johnson</MenuItem>
                    <MenuItem value="Staff A">Staff A</MenuItem>
                    <MenuItem value="Staff B">Staff B</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Telecaller</InputLabel>
                  <Select
                    value={filters.telecaller}
                    label="Telecaller"
                    onChange={(e) => updateFilter('telecaller', e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="Telecaller 1">Telecaller 1</MenuItem>
                    <MenuItem value="Telecaller 2">Telecaller 2</MenuItem>
                    <MenuItem value="Telecaller 3">Telecaller 3</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Center</InputLabel>
                  <Select
                    value={filters.visitingCenter}
                    label="Center"
                    onChange={(e) => updateFilter('visitingCenter', e.target.value)}
                  >
                    <MenuItem value="all">All Centers</MenuItem>
                    <MenuItem value="main">Main Center</MenuItem>
                    <MenuItem value="branch1">Branch 1</MenuItem>
                    <MenuItem value="branch2">Branch 2</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Visitor Type</InputLabel>
                  <Select
                    value={filters.visitorType}
                    label="Visitor Type"
                    onChange={(e) => updateFilter('visitorType', e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="patient">Patient</MenuItem>
                    <MenuItem value="general">General</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* Visit & Follow-up Filters */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Visit Type</InputLabel>
                  <Select
                    value={filters.visitType}
                    label="Visit Type"
                    onChange={(e) => updateFilter('visitType', e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="consultation">Consultation</MenuItem>
                    <MenuItem value="test">Test</MenuItem>
                    <MenuItem value="trial">Trial</MenuItem>
                    <MenuItem value="fitting">Fitting</MenuItem>
                    <MenuItem value="followup">Follow-up</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Visit Status</InputLabel>
                  <Select
                    value={filters.visitStatus}
                    label="Visit Status"
                    onChange={(e) => updateFilter('visitStatus', e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="enquiry">Enquiry</MenuItem>
                    <MenuItem value="scheduled">Scheduled</MenuItem>
                    <MenuItem value="visited">Visited</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Has Follow-ups</InputLabel>
                  <Select
                    value={filters.hasFollowUps}
                    label="Has Follow-ups"
                    onChange={(e) => updateFilter('hasFollowUps', e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="yes">Yes</MenuItem>
                    <MenuItem value="no">No</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Test Results</InputLabel>
                  <Select
                    value={filters.hasTestResults}
                    label="Test Results"
                    onChange={(e) => updateFilter('hasTestResults', e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="yes">Has Results</MenuItem>
                    <MenuItem value="no">No Results</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  label="Visit Date From"
                  value={filters.visitDateFrom}
                  onChange={(e) => updateFilter('visitDateFrom', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  type="date"
                  fullWidth
                  size="small"
                  label="Visit Date To"
                  value={filters.visitDateTo}
                  onChange={(e) => updateFilter('visitDateTo', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>

            {/* Text Search Filters */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Company Name"
                  value={filters.companyName}
                  onChange={(e) => updateFilter('companyName', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Purpose of Visit"
                  value={filters.purposeOfVisit}
                  onChange={(e) => updateFilter('purposeOfVisit', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Reference"
                  value={filters.reference}
                  onChange={(e) => updateFilter('reference', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Form Types</InputLabel>
                  <Select
                    multiple
                    value={filters.activeFormTypes}
                    label="Form Types"
                    onChange={(e) => updateFilter('activeFormTypes', e.target.value)}
                    renderValue={(selected) => `${selected.length} selected`}
                  >
                    <MenuItem value="audiometry">Audiometry</MenuItem>
                    <MenuItem value="tympanometry">Tympanometry</MenuItem>
                    <MenuItem value="hearing-aid">Hearing Aid</MenuItem>
                    <MenuItem value="consultation">Consultation</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </Collapse>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {Math.min(page * rowsPerPage + 1, filteredEnquiries.length)}-{Math.min((page + 1) * rowsPerPage, filteredEnquiries.length)} of {filteredEnquiries.length} enquiries
              {filteredEnquiries.length !== enquiries.length && ` (filtered from ${enquiries.length} total)`}
            </Typography>
            {advancedFilters.length > 0 && (
              <Chip 
                label={`${advancedFilters.length} advanced filters active`} 
                color="primary" 
                size="small" 
                variant="outlined"
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={clearAllAdvancedFilters}
              size="small"
              disabled={advancedFilters.length === 0 && !searchTerm && statusFilter === 'all' && typeFilter === 'all'}
            >
              Clear All Filters
            </Button>
            <Button 
              variant="contained"
              startIcon={<FilterIcon />}
              onClick={() => setShowFilterBuilder(!showFilterBuilder)}
              size="small"
              color={advancedFilters.length > 0 ? 'success' : 'primary'}
            >
              {advancedFilters.length > 0 ? `${advancedFilters.length} Filters Active` : 'Add Filters'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Filter Preset Save Dialog */}
      <Dialog open={showPresetDialog} onClose={() => setShowPresetDialog(false)}>
        <DialogTitle>Save Filter Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Preset Name"
            fullWidth
            variant="outlined"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPresetDialog(false)}>Cancel</Button>
          <Button onClick={saveFilterPreset} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Enquiries Table */}
       <Paper sx={{ 
         width: '100%', 
         overflow: 'hidden', 
         display: 'flex', 
         flexDirection: 'column',
         height: 'auto',
         minHeight: '600px' // Ensure adequate height for table
       }}>
         <TableContainer sx={{ 
           flex: 1,
           overflowX: 'auto',
           overflowY: 'auto',
           maxHeight: '70vh', // Use viewport height instead of fixed calc
           maxWidth: 'calc(100vw - 280px)', // Account for sidebar width
           '&::-webkit-scrollbar': { height: '8px', width: '8px' },
           '&::-webkit-scrollbar-track': { backgroundColor: '#f1f1f1' },
           '&::-webkit-scrollbar-thumb': { backgroundColor: '#888', borderRadius: '4px' }
         }}>
           <Table stickyHeader sx={{ minWidth: 1370, width: 'max-content' }}>
          <TableHead>
            <TableRow>
                   <TableCell sx={{ fontWeight: 600, width: 160, minWidth: 160, backgroundColor: '#f5f5f5' }}>Name</TableCell>
                   {userProfile?.role !== 'audiologist' && (
                     <TableCell sx={{ fontWeight: 600, width: 120, minWidth: 120, backgroundColor: '#f5f5f5' }}>Phone</TableCell>
                   )}
                   <TableCell sx={{ fontWeight: 600, width: 180, minWidth: 180, backgroundColor: '#f5f5f5' }}>Email</TableCell>
                   <TableCell sx={{ fontWeight: 600, width: 150, minWidth: 150, backgroundColor: '#f5f5f5' }}>Address</TableCell>
                   <TableCell sx={{ fontWeight: 600, width: 100, minWidth: 100, backgroundColor: '#f5f5f5' }}>Reference</TableCell>
                   <TableCell sx={{ fontWeight: 600, width: 100, minWidth: 100, backgroundColor: '#f5f5f5' }}>Assigned To</TableCell>
                   <TableCell sx={{ fontWeight: 600, width: 100, minWidth: 100, backgroundColor: '#f5f5f5' }}>Telecaller</TableCell>
                   <TableCell sx={{ fontWeight: 600, width: 110, minWidth: 110, backgroundColor: '#f5f5f5' }}>Center</TableCell>
                   <TableCell sx={{ fontWeight: 600, width: 100, minWidth: 100, backgroundColor: '#f5f5f5' }}>Status</TableCell>
                   <TableCell sx={{ fontWeight: 600, width: 120, minWidth: 120, backgroundColor: '#f5f5f5' }}>Subject</TableCell>
                   <TableCell sx={{ fontWeight: 600, width: 150, minWidth: 150, backgroundColor: '#f5f5f5' }}>Message</TableCell>
                   <TableCell sx={{ fontWeight: 600, width: 100, minWidth: 100, backgroundColor: '#f5f5f5' }}>Date</TableCell>
                   <TableCell 
                     sx={{ 
                       fontWeight: 600, 
                       width: 170,
                       minWidth: 170,
                       maxWidth: 170,
                       position: 'sticky', 
                       right: 0, 
                       backgroundColor: '#f5f5f5 !important',
                       zIndex: 1100,
                       boxShadow: '-4px 0 8px rgba(0,0,0,0.15)',
                       borderLeft: '2px solid #e0e0e0'
                     }}
                   >
                     Actions
                   </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                   <TableCell colSpan={userProfile?.role === 'audiologist' ? 12 : 13} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredEnquiries.length === 0 ? (
              <TableRow>
                   <TableCell colSpan={userProfile?.role === 'audiologist' ? 12 : 13} align="center" sx={{ py: 4 }}>
                     <Typography variant="body2" color="text.secondary">
                  No enquiries found
                     </Typography>
                </TableCell>
              </TableRow>
            ) : (
                 getPaginatedData().map((enquiry, index) => (
                   <TableRow 
                     key={enquiry.id}
                     sx={{
                       '&:nth-of-type(even)': { backgroundColor: '#fafafa' },
                       '&:hover': { backgroundColor: '#f0f7ff !important' }
                     }}
                   >
                     <TableCell sx={{ width: 160, minWidth: 160 }}>
                       <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                         <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', backgroundColor: 'primary.main' }}>
                        {getInitials(enquiry.name)}
                      </Avatar>
                         <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                           {enquiry.name || '-'}
                         </Typography>
                    </Box>
                  </TableCell>
                     {userProfile?.role !== 'audiologist' && (
                       <TableCell sx={{ width: 120, minWidth: 120 }}>
                         <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                           {enquiry.phone || '-'}
                         </Typography>
                       </TableCell>
                     )}
                     <TableCell sx={{ width: 180, minWidth: 180 }}>
                       <Typography variant="body2" noWrap title={enquiry.email || ''} sx={{ fontSize: '0.8rem' }}>
                         {enquiry.email || '-'}
                       </Typography>
                  </TableCell>
                     <TableCell sx={{ width: 150, minWidth: 150 }}>
                       <Typography variant="body2" noWrap title={enquiry.address || ''} sx={{ fontSize: '0.8rem' }}>
                         {enquiry.address || '-'}
                       </Typography>
                     </TableCell>
                     <TableCell sx={{ width: 100, minWidth: 100 }}>
                       <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                         {enquiry.reference || '-'}
                       </Typography>
                     </TableCell>
                     <TableCell sx={{ width: 100, minWidth: 100 }}>
                       <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                         {enquiry.assignedTo || '-'}
                       </Typography>
                     </TableCell>
                     <TableCell sx={{ width: 100, minWidth: 100 }}>
                       <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                         {enquiry.telecaller || '-'}
                       </Typography>
                     </TableCell>
                     <TableCell sx={{ width: 110, minWidth: 110 }}>
                       <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                         {enquiry.visitingCenter || '-'}
                       </Typography>
                     </TableCell>
                     <TableCell sx={{ width: 100, minWidth: 100 }}>
                       <Chip 
                         label={enquiry.visitStatus || 'enquiry'} 
                         size="small" 
                         sx={{ fontSize: '0.7rem', height: '20px' }}
                         color={
                           enquiry.visitStatus === 'completed' ? 'success' :
                           enquiry.visitStatus === 'visited' ? 'info' :
                           enquiry.visitStatus === 'scheduled' ? 'warning' : 'default'
                         }
                       />
                     </TableCell>
                     <TableCell sx={{ width: 120, minWidth: 120 }}>
                       <Typography variant="body2" noWrap title={enquiry.subject || ''} sx={{ fontSize: '0.8rem' }}>
                         {enquiry.subject || '-'}
                       </Typography>
                     </TableCell>
                     <TableCell sx={{ width: 150, minWidth: 150 }}>
                       <Typography variant="body2" noWrap title={enquiry.message || ''} sx={{ fontSize: '0.8rem' }}>
                         {enquiry.message || '-'}
                       </Typography>
                     </TableCell>
                     <TableCell sx={{ width: 100, minWidth: 100 }}>
                       <Typography variant="body2" noWrap sx={{ fontSize: '0.8rem' }}>
                         {formatDate(enquiry)}
                       </Typography>
                     </TableCell>
                     <TableCell 
                       sx={{ 
                         width: 170,
                         minWidth: 170,
                         maxWidth: 170,
                         position: 'sticky', 
                         right: 0, 
                         backgroundColor: (index % 2 === 0 ? '#ffffff' : '#fafafa') + ' !important',
                         zIndex: 1000,
                         boxShadow: '-4px 0 8px rgba(0,0,0,0.15)',
                         borderLeft: '2px solid #e0e0e0'
                       }}
                     >
                       <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {userProfile?.role !== 'audiologist' && (
                      <Tooltip title="View Details">
                             <IconButton 
                               size="small" 
                               onClick={() => handleOpenDetailDialog(enquiry)}
                               sx={{ color: 'primary.main' }}
                             >
                               <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit">
                           <IconButton 
                             size="small" 
                             onClick={() => handleEdit(enquiry)}
                             sx={{ color: 'secondary.main' }}
                           >
                             <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {userProfile?.role !== 'audiologist' && (
                      <Tooltip title="Convert to Visitor">
                        <IconButton 
                               size="small"
                          onClick={() => handleOpenConvertDialog(enquiry)}
                               sx={{ color: 'success.main' }}
                          disabled={enquiry.status === 'converted'}
                        >
                               <PersonAddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {userProfile?.role === 'admin' && (
                      <Tooltip title="Delete">
                             <IconButton 
                               size="small" 
                               onClick={() => handleOpenDeleteDialog(enquiry)}
                               sx={{ color: 'error.main' }}
                             >
                               <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                       </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Table Pagination */}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={filteredEnquiries.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      />
       </Paper>

      {/* Add/Edit Enquiry Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="xl"
        PaperProps={{
          sx: { 
            minHeight: '85vh',
            maxHeight: '95vh'
          }
        }}
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          {getFormTypeIcon(isEditMode ? 'edit' : 'add')}
          {isEditMode ? 'Edit Enquiry' : 'New Enquiry'}
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          {/* Simplified Stepper */}
          <Box sx={{ bgcolor: 'grey.50', p: 2 }}>
            <Stepper activeStep={activeStep} orientation="horizontal">
            <Step completed={isStepComplete(0)}>
                <StepLabel>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PersonIcon fontSize="small" />
                    Basic Details & Follow-ups
                  </Box>
                </StepLabel>
            </Step>
            <Step completed={isStepComplete(1)}>
                <StepLabel>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <MedicalServicesIcon fontSize="small" />
                    Medical Services
                  </Box>
                </StepLabel>
            </Step>
              <Step completed={isStepComplete(2)}>
                <StepLabel>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleIcon fontSize="small" />
                    Summary & Review
                  </Box>
                </StepLabel>
              </Step>
          </Stepper>
          </Box>

          <Box sx={{ p: 3 }}>
            {/* Step 0: Basic Details & Follow-ups */}
          {activeStep === 0 && (
            <Box>
                {/* Patient Information Section */}
              <StyledFormSection>
                  <FormSectionTitle>
                    <PersonIcon />
                    Patient Information
                </FormSectionTitle>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Full Name *"
                      name="name"
                      value={newEnquiry.name || ''}
                      onChange={handleInputChange}
                      required
                        variant="outlined"
                    />
                  </Grid>
                    <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Phone Number *"
                      name="phone"
                      value={newEnquiry.phone || ''}
                      onChange={handleInputChange}
                      required
                        variant="outlined"
                    />
                  </Grid>
                    <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Email Address"
                      name="email"
                        type="email"
                      value={newEnquiry.email || ''}
                      onChange={handleInputChange}
                      variant="outlined"
                    />
                  </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Visiting Center</InputLabel>
                        <Select
                          name="visitingCenter"
                          value={newEnquiry.visitingCenter || 'main'}
                          label="Visiting Center"
                          onChange={handleInputChange}
                        >
                          <MenuItem value="main">Main Center</MenuItem>
                          <MenuItem value="north">North Branch</MenuItem>
                          <MenuItem value="south">South Branch</MenuItem>
                          <MenuItem value="east">East Branch</MenuItem>
                          <MenuItem value="west">West Branch</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth required>
                        <InputLabel>Reference *</InputLabel>
                        <Select
                          name="reference"
                          value={newEnquiry.reference || ''}
                          label="Reference *"
                          onChange={handleInputChange}
                          required
                          sx={{ minWidth: 200 }}
                        >
                          <MenuItem value="Camp">Camp</MenuItem>
                          <MenuItem value="CGHS/DGEHS/ Any Govt. deptt">CGHS/DGEHS/ Any Govt. deptt</MenuItem>
                          <MenuItem value="converted">converted</MenuItem>
                          <MenuItem value="Dealer">Dealer</MenuItem>
                          <MenuItem value="Dr Deepika Ref.">Dr Deepika Ref.</MenuItem>
                          <MenuItem value="Dr Yogesh Kansal Ref.">Dr Yogesh Kansal Ref.</MenuItem>
                          <MenuItem value="existing">existing</MenuItem>
                          <MenuItem value="Gautam dhamija">Gautam dhamija</MenuItem>
                          <MenuItem value="GN RESOUND ENQUIRY">GN RESOUND ENQUIRY</MenuItem>
                          <MenuItem value="Google Adwords">Google Adwords</MenuItem>
                          <MenuItem value="Hear.com">Hear.com</MenuItem>
                          <MenuItem value="home service">home service</MenuItem>
                          <MenuItem value="INDIAMART">INDIAMART</MenuItem>
                          <MenuItem value="just dial">just dial</MenuItem>
                          <MenuItem value="Medical Store Reference">Medical Store Reference</MenuItem>
                          <MenuItem value="must and more">must and more</MenuItem>
                          <MenuItem value="Nath brother ( chemist )">Nath brother ( chemist )</MenuItem>
                          <MenuItem value="Online">Online</MenuItem>
                          <MenuItem value="Other Doctor Referenes">Other Doctor Referenes</MenuItem>
                          <MenuItem value="reference existing patient">reference existing patient</MenuItem>
                          <MenuItem value="Visit Health">Visit Health</MenuItem>
                          <MenuItem value="walking">walking</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                    <TextField
                        fullWidth
                      label="Address"
                        name="address"
                      value={newEnquiry.address || ''}
                      onChange={handleInputChange}
                        multiline
                        rows={2}
                      variant="outlined"
                    />
                  </Grid>
                    
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Patient Visit Status</InputLabel>
                      <Select
                        name="visitStatus"
                        value={newEnquiry.visitStatus || 'enquiry'}
                        label="Patient Visit Status"
                        onChange={handleInputChange}
                      >
                        <MenuItem value="enquiry">Enquiry Only</MenuItem>
                        <MenuItem value="scheduled">Visit Scheduled</MenuItem>
                        <MenuItem value="visited">Patient Visited</MenuItem>
                        <MenuItem value="completed">Treatment Completed</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Assign to</InputLabel>
                      <Select
                        name="assignedTo"
                        value={newEnquiry.assignedTo || ''}
                        label="Assign to"
                        onChange={handleInputChange}
                        sx={{ minWidth: 200 }}
                      >
                        <MenuItem value="">-None-</MenuItem>
                        <MenuItem value="Dr. Sharma">Dr. Sharma</MenuItem>
                        <MenuItem value="Dr. Patel">Dr. Patel</MenuItem>
                        <MenuItem value="Audiologist - Ravi">Audiologist - Ravi</MenuItem>
                        <MenuItem value="Audiologist - Priya">Audiologist - Priya</MenuItem>
                        <MenuItem value="Senior Technician">Senior Technician</MenuItem>
                        <MenuItem value="Manager">Manager</MenuItem>
                        <MenuItem value="Sales Executive">Sales Executive</MenuItem>
                        <MenuItem value="Customer Service">Customer Service</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Telecaller</InputLabel>
                      <Select
                        name="telecaller"
                        value={newEnquiry.telecaller || ''}
                        label="Telecaller"
                        onChange={handleInputChange}
                        sx={{ minWidth: 200 }}
                      >
                        <MenuItem value="">-None-</MenuItem>
                        <MenuItem value="Telecaller 1">Telecaller 1</MenuItem>
                        <MenuItem value="Telecaller 2">Telecaller 2</MenuItem>
                        <MenuItem value="Telecaller 3">Telecaller 3</MenuItem>
                        <MenuItem value="Senior Telecaller">Senior Telecaller</MenuItem>
                        <MenuItem value="Team Lead">Team Lead</MenuItem>
                        <MenuItem value="Customer Care Executive">Customer Care Executive</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                        fullWidth
                        label="Additional Notes"
                      name="message"
                      value={newEnquiry.message || ''}
                      onChange={handleInputChange}
                      multiline
                      rows={3}
                        variant="outlined"
                        placeholder="Additional information about the patient or enquiry..."
                    />
                  </Grid>
                </Grid>
              </StyledFormSection>

                {/* Follow-up Details Section */}
                <StyledFormSection>
                  <FormSectionTitle>
                    <FollowUpIcon />
                    Follow-up Details
                  </FormSectionTitle>
                  
                  <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table>
                      <TableHead sx={{ bgcolor: 'grey.50' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 'bold' }}>Call Date</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Feedback</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Next Follow-up</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Telecaller</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', width: 100 }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {newEnquiry.followUps && newEnquiry.followUps.length > 0 ? (
                          newEnquiry.followUps.map((followUp, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <TextField
                                  type="date"
                                  value={followUp.date || ''}
                                  onChange={(e) => {
                                    const updatedFollowUps = [...(newEnquiry.followUps || [])];
                                    updatedFollowUps[index] = { ...followUp, date: e.target.value };
                                    setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                                  }}
                                  size="small"
                                  variant="outlined"
                                  InputLabelProps={{ shrink: true }}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  multiline
                                  rows={2}
                                  value={followUp.remarks || ''}
                                  onChange={(e) => {
                                    const updatedFollowUps = [...(newEnquiry.followUps || [])];
                                    updatedFollowUps[index] = { ...followUp, remarks: e.target.value };
                                    setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                                  }}
                                  size="small"
                                  variant="outlined"
                                  placeholder="Enter feedback/remarks..."
                                  sx={{ minWidth: 200 }}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  type="date"
                                  value={followUp.nextFollowUpDate || ''}
                                  onChange={(e) => {
                                    const updatedFollowUps = [...(newEnquiry.followUps || [])];
                                    updatedFollowUps[index] = { ...followUp, nextFollowUpDate: e.target.value };
                                    setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                                  }}
                                  size="small"
                                  variant="outlined"
                                  InputLabelProps={{ shrink: true }}
                                />
                              </TableCell>
                              <TableCell>
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                  <Select
                                    value={followUp.callerName || ''}
                                    onChange={(e) => {
                                      const updatedFollowUps = [...(newEnquiry.followUps || [])];
                                      updatedFollowUps[index] = { ...followUp, callerName: e.target.value };
                                      setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                                    }}
                                    displayEmpty
                                  >
                                    <MenuItem value="">-None-</MenuItem>
                                    <MenuItem value="Staff 1">Staff 1</MenuItem>
                                    <MenuItem value="Staff 2">Staff 2</MenuItem>
                                    <MenuItem value="Manager">Manager</MenuItem>
                                    <MenuItem value="Telecaller">Telecaller</MenuItem>
                                  </Select>
                                </FormControl>
                              </TableCell>
                              <TableCell>
                                <IconButton
                                  color="error"
                                  size="small"
                                  onClick={() => {
                                    const updatedFollowUps = newEnquiry.followUps?.filter((_, i) => i !== index) || [];
                                    setNewEnquiry({ ...newEnquiry, followUps: updatedFollowUps });
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                              No follow-up records yet. Click "Add Follow-up" to add the first record.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      const newFollowUp = {
                        id: crypto.randomUUID(),
                        date: '',
                        remarks: '',
                        nextFollowUpDate: '',
                        callerName: '',
                        createdAt: {
                          seconds: Math.floor(Date.now() / 1000),
                          nanoseconds: 0
                        }
                      };
                      setNewEnquiry({
                        ...newEnquiry,
                        followUps: [...(newEnquiry.followUps || []), newFollowUp]
                      });
                    }}
                    sx={{ mb: 2 }}
                  >
                    Add Follow-up
                  </Button>
                </StyledFormSection>
            </Box>
          )}



        {/* Step 1: Medical Services & Configuration */}
          {activeStep === 1 && (
              <StyledFormSection>
                <FormSectionTitle>
                  <MedicalServicesIcon />
                  Medical Services & Configuration
                </FormSectionTitle>
                
                {/* Service Selection */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                    Select Required Services:
                </Typography>
                  <Grid container spacing={2}>
                    {specializedFormTypes.map((formType) => (
                      <Grid item xs={12} sm={6} md={3} key={formType.value}>
                        <Card
                          sx={{
                            cursor: 'pointer',
                            border: newEnquiry.activeFormTypes.includes(formType.value) ? '2px solid' : '1px solid',
                            borderColor: newEnquiry.activeFormTypes.includes(formType.value) ? 'primary.main' : 'divider',
                            bgcolor: newEnquiry.activeFormTypes.includes(formType.value) ? alpha('#1976d2', 0.1) : 'background.paper',
                            '&:hover': {
                              boxShadow: 3,
                              transform: 'translateY(-2px)',
                              transition: 'all 0.2s ease'
                            }
                          }}
                          onClick={() => {
                            const isSelected = newEnquiry.activeFormTypes.includes(formType.value);
                            const updatedTypes = isSelected
                              ? newEnquiry.activeFormTypes.filter(type => type !== formType.value)
                              : [...newEnquiry.activeFormTypes, formType.value];
                            setNewEnquiry({ ...newEnquiry, activeFormTypes: updatedTypes });
                          }}
                        >
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Box sx={{ mb: 1, color: 'primary.main' }}>
                              {getFormTypeIcon(formType.value)}
                            </Box>
                            <Typography variant="body2" fontWeight="medium">
                              {formType.label}
                            </Typography>
                            {newEnquiry.activeFormTypes.includes(formType.value) && (
                              <CheckCircleIcon sx={{ color: 'success.main', mt: 1, fontSize: 20 }} />
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                {/* Quick Configuration for Selected Services */}
                {newEnquiry.activeFormTypes.length > 0 && (
                  <Box>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                      Quick Configuration:
                    </Typography>
                <Grid container spacing={2}>
                      {newEnquiry.activeFormTypes.includes('test') && (
                        <Grid item xs={12}>
                          <Card sx={{ p: 3, bgcolor: alpha('#1976d2', 0.05), border: '1px solid', borderColor: 'primary.main' }}>
                            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
                              <HearingIcon sx={{ mr: 1, fontSize: 20 }} />
                              Hearing & Impedance Test Configuration
                            </Typography>
                            
                            <Grid container spacing={3}>
                              <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                  <InputLabel>Test Type</InputLabel>
                                  <Select
                                    value={newEnquiry.testDetails?.testName || ''}
                                    label="Test Type"
                                    onChange={(e) => setNewEnquiry({
                                      ...newEnquiry,
                                      testDetails: { ...newEnquiry.testDetails, testName: e.target.value }
                                    })}
                                    sx={{ minWidth: 200 }}
                                  >
                                    <MenuItem value="PTA">PTA</MenuItem>
                                    <MenuItem value="BERA">BERA</MenuItem>
                                    <MenuItem value="Aided audiometry">Aided audiometry</MenuItem>
                                    <MenuItem value="Impedence">Impedence</MenuItem>
                                    <MenuItem value="OAE">OAE</MenuItem>
                                    <MenuItem value="Others">Others</MenuItem>
                                    <MenuItem value="Speech Discrimination test">Speech Discrimination test</MenuItem>
                                    <MenuItem value="Free Field Audiometry">Free Field Audiometry</MenuItem>
                                    <MenuItem value="BOA">BOA</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              
                              <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                  <InputLabel>Conducted By</InputLabel>
                                  <Select
                                    value={newEnquiry.testDetails?.testDoneBy || ''}
                                    label="Conducted By"
                                    onChange={(e) => setNewEnquiry({
                                      ...newEnquiry,
                                      testDetails: { ...newEnquiry.testDetails, testDoneBy: e.target.value }
                                    })}
                                    sx={{ minWidth: 200 }}
                                  >
                                    <MenuItem value="Dr. Sharma">Dr. Sharma</MenuItem>
                                    <MenuItem value="Dr. Patel">Dr. Patel</MenuItem>
                                    <MenuItem value="Audiologist - Ravi">Audiologist - Ravi</MenuItem>
                                    <MenuItem value="Audiologist - Priya">Audiologist - Priya</MenuItem>
                                    <MenuItem value="Senior Technician">Senior Technician</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              
                              <Grid item xs={12} sm={6}>
                                <TextField
                                  fullWidth
                                  label="Test Price (₹)"
                                  type="number"
                                  value={newEnquiry.testDetails?.testPrice || ''}
                                  onChange={(e) => setNewEnquiry({
                                    ...newEnquiry,
                                    testDetails: { ...newEnquiry.testDetails, testPrice: Number(e.target.value) }
                                  })}
                                  InputProps={{
                                    startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>
                                  }}
                                />
                              </Grid>
                              

                            </Grid>
                          </Card>
                        </Grid>
                      )}
                      
                      {newEnquiry.activeFormTypes.includes('trial') && (
                        <Grid item xs={12} md={6}>
                          <Card sx={{ p: 2, bgcolor: alpha('#9c27b0', 0.05) }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, color: 'secondary.main', fontWeight: 600 }}>
                              <MedicalServicesIcon sx={{ mr: 1, fontSize: 18 }} />
                              Device Trial
                            </Typography>
                            <TextField
                              fullWidth
                              size="small"
                              label="Device Model"
                              value={newEnquiry.trialDetails?.deviceBrand || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                trialDetails: { ...newEnquiry.trialDetails, deviceBrand: e.target.value }
                              })}
                              sx={{ mb: 1 }}
                            />
                            <TextField
                              fullWidth
                              size="small"
                              label="Trial Duration"
                              value={newEnquiry.trialDetails?.trialDuration || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                trialDetails: { ...newEnquiry.trialDetails, trialDuration: e.target.value }
                              })}
                            />
                          </Card>
                    </Grid>
                      )}
                      
                      {newEnquiry.activeFormTypes.includes('hearing_aid') && (
                        <Grid item xs={12} md={6}>
                          <Card sx={{ p: 2, bgcolor: alpha('#2e7d32', 0.05) }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, color: 'success.main', fontWeight: 600 }}>
                              <HearingIcon sx={{ mr: 1, fontSize: 18 }} />
                              Hearing Aid Fitting
                            </Typography>
                            <TextField
                              fullWidth
                              size="small"
                              label="Device Brand"
                              value={newEnquiry.fittingDetails?.hearingAidBrand || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                fittingDetails: { ...newEnquiry.fittingDetails, hearingAidBrand: e.target.value }
                              })}
                              sx={{ mb: 1 }}
                            />
                            <TextField
                              fullWidth
                              size="small"
                              label="Model"
                              value={newEnquiry.fittingDetails?.hearingAidModel || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                fittingDetails: { ...newEnquiry.fittingDetails, hearingAidModel: e.target.value }
                              })}
                            />
                          </Card>
                </Grid>
                      )}
                      
                      {newEnquiry.activeFormTypes.includes('home_visit') && (
                        <Grid item xs={12} md={6}>
                          <Card sx={{ p: 2, bgcolor: alpha('#ed6c02', 0.05) }}>
                            <Typography variant="subtitle2" sx={{ mb: 1, color: 'warning.main', fontWeight: 600 }}>
                              <HomeIcon sx={{ mr: 1, fontSize: 18 }} />
                              Home Visit
                            </Typography>
                            <TextField
                              fullWidth
                              size="small"
                              label="Visit Address"
                              value={newEnquiry.homeVisitDetails?.visitAddress || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                homeVisitDetails: { ...newEnquiry.homeVisitDetails, visitAddress: e.target.value }
                              })}
                              sx={{ mb: 1 }}
                            />
                            <TextField
                              fullWidth
                              size="small"
                              label="Contact Person"
                              value={newEnquiry.homeVisitDetails?.familyMembers || ''}
                              onChange={(e) => setNewEnquiry({
                                ...newEnquiry,
                                homeVisitDetails: { ...newEnquiry.homeVisitDetails, familyMembers: e.target.value }
                              })}
                            />
                          </Card>
                        </Grid>
                      )}
                    </Grid>
            </Box>
          )}

                {newEnquiry.activeFormTypes.length === 0 && (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <MedicalServicesIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                    <Typography variant="h6" gutterBottom>
                      Select Medical Services
                    </Typography>
                    <Typography variant="body2">
                      Choose the services this patient requires from the options above.
                    </Typography>
                  </Box>
                )}
              </StyledFormSection>
            )}

                    {/* Medical Form Steps */}
        {newEnquiry.activeFormTypes?.map((formType, index) => (
          activeStep === index + 3 && (
                <Box key={formType}>
                  {(() => {
                    const currentFormType = formType;
                switch (currentFormType) {
                  case 'test':
                    return (
                      <StyledFormSection>
                            <FormSectionTitle variant="h6">
                              <HearingIcon /> Hearing & Impedance Test Configuration
                        </FormSectionTitle>
                        
                            {/* Test form content here */}
                        <Grid container spacing={3}>
                              <Grid item xs={12}>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                                  Configure the hearing test parameters and expected outcomes.
                                </Typography>
                              </Grid>
                              {/* Add your test form fields here */}
                            </Grid>
                          </StyledFormSection>
                        );
                      
                      case 'trial':
                        return (
                          <StyledFormSection>
                            <FormSectionTitle variant="h6">
                              <MedicalServicesIcon /> Device Trial Configuration
                            </FormSectionTitle>
                            
                            {/* Trial form content here */}
                            <Grid container spacing={3}>
                              <Grid item xs={12}>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                                  Set up device trial parameters and evaluation criteria.
                                </Typography>
                              </Grid>
                              {/* Add your trial form fields here */}
                            </Grid>
                          </StyledFormSection>
                        );
                      
                      case 'hearing_aid':
                        return (
                          <StyledFormSection>
                            <FormSectionTitle variant="h6">
                              <HearingIcon /> Hearing Aid Fitting Configuration
                            </FormSectionTitle>
                            
                            {/* Fitting form content here */}
                            <Grid container spacing={3}>
                              <Grid item xs={12}>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                                  Configure hearing aid fitting and adjustment parameters.
                                </Typography>
                              </Grid>
                              {/* Add your fitting form fields here */}
                            </Grid>
                          </StyledFormSection>
                        );
                      
                      case 'home_visit':
                        return (
                          <StyledFormSection>
                            <FormSectionTitle variant="h6">
                              <HomeIcon /> Home Visit Configuration
                            </FormSectionTitle>
                            
                            {/* Home visit form content here */}
                            <Grid container spacing={3}>
                              <Grid item xs={12}>
                                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                                  Set up home visit details and logistics.
                                </Typography>
                              </Grid>
                              {/* Add your home visit form fields here */}
                            </Grid>
                          </StyledFormSection>
                        );
                      
                      default:
                        return (
                          <Typography>No form configuration for {currentFormType}</Typography>
                        );
                    }
                  })()}
                </Box>
              )
            ))}

                    {/* Visits Management Step - Chrome-style tabs interface */}
        {isEditMode && activeStep === 3 + newEnquiry.activeFormTypes.length && (
              <Box>
                <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentIcon />
                  Multiple Visits Management
                </Typography>
                
                {/* Chrome-style tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3, bgcolor: 'grey.50', borderRadius: '8px 8px 0 0', p: 1 }}>
                  <Stack direction="row" spacing={0} alignItems="center">
                    {(newEnquiry.visitSchedules || []).map((schedule, index) => (
                      <Box
                        key={schedule.id || index}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          px: 2,
                          py: 1,
                          borderTop: '3px solid',
                          borderLeft: '1px solid',
                          borderRight: '1px solid',
                          borderTopColor: activeVisitScheduleTab === index ? 'primary.main' : 'transparent',
                          borderLeftColor: 'divider',
                          borderRightColor: 'divider',
                          bgcolor: activeVisitScheduleTab === index ? 'background.paper' : 'transparent',
                          cursor: 'pointer',
                          borderTopLeftRadius: 8,
                          borderTopRightRadius: 8,
                          position: 'relative',
                          minWidth: 120,
                          '&:hover': {
                            bgcolor: activeVisitScheduleTab === index ? 'background.paper' : 'grey.100'
                          }
                        }}
                        onClick={() => setActiveVisitScheduleTab(index)}
                      >
                        <Typography variant="body2" sx={{ mr: 1, fontWeight: activeVisitScheduleTab === index ? 'bold' : 'normal' }}>
                          Visit {index + 1}
                                </Typography>
                        {(newEnquiry.visitSchedules || []).length > 1 && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeVisitSchedule(index);
                            }}
                            sx={{ 
                              ml: 0.5, 
                              p: 0.25,
                              '&:hover': { bgcolor: 'error.light', color: 'white' }
                            }}
                          >
                            <CloseIcon fontSize="inherit" />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                    
                    {/* Add new visit button */}
                    <IconButton
                      onClick={addNewVisitSchedule}
                      sx={{
                        ml: 1,
                        bgcolor: 'success.main',
                        color: 'white',
                        width: 32,
                        height: 32,
                        '&:hover': {
                          bgcolor: 'success.dark'
                        }
                      }}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>

                {/* Visit content */}
                {(newEnquiry.visitSchedules || [])[activeVisitScheduleTab] && (
                  <Box sx={{ bgcolor: 'background.paper', p: 3, border: '1px solid', borderColor: 'divider', borderTop: 'none' }}>
                    <Grid container spacing={3}>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                              <InputLabel>Visit Type</InputLabel>
                              <Select
                                value={(newEnquiry.visitSchedules || [])[activeVisitScheduleTab]?.visitType || 'center'}
                                onChange={(e) => updateVisitSchedule(activeVisitScheduleTab, 'visitType', e.target.value)}
                                label="Visit Type"
                              >
                                <MenuItem value="center">Visit Center</MenuItem>
                                <MenuItem value="home">Home Visit</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                      <Grid item xs={12} sm={3}>
                            <TextField
                              fullWidth
                          label="Visit Date"
                          type="date"
                          value={(newEnquiry.visitSchedules || [])[activeVisitScheduleTab]?.visitDate || ''}
                          onChange={(e) => updateVisitSchedule(activeVisitScheduleTab, 'visitDate', e.target.value)}
                              variant="outlined"
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <TextField
                          fullWidth
                          label="Visit Time"
                          type="time"
                          value={(newEnquiry.visitSchedules || [])[activeVisitScheduleTab]?.visitTime || ''}
                          onChange={(e) => updateVisitSchedule(activeVisitScheduleTab, 'visitTime', e.target.value)}
                          variant="outlined"
                          InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                      
                      {/* Medical Services Selection */}
                      <Grid item xs={12}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', color: 'primary.main' }}>
                          Medical Services for this Visit:
                        </Typography>
                        <Grid container spacing={2}>
                          {[
                            { key: 'hearingTest', label: 'Hearing Test', icon: <HearingIcon />, color: 'primary' },
                            { key: 'trial', label: 'Device Trial', icon: <MedicalServicesIcon />, color: 'secondary' },
                            { key: 'fitting', label: 'Device Fitting', icon: <HearingIcon />, color: 'success' },
                            { key: 'homeVisit', label: 'Home Visit', icon: <HomeIcon />, color: 'warning' }
                          ].map((service) => (
                            <Grid item xs={12} sm={6} md={3} key={service.key}>
                              <Card
                                sx={{
                                  cursor: 'pointer',
                                  border: ((newEnquiry.visitSchedules || [])[activeVisitScheduleTab]?.medicalServices as any)?.[service.key] ? '2px solid' : '1px solid',
                                  borderColor: ((newEnquiry.visitSchedules || [])[activeVisitScheduleTab]?.medicalServices as any)?.[service.key] ? `${service.color}.main` : 'divider',
                                  bgcolor: ((newEnquiry.visitSchedules || [])[activeVisitScheduleTab]?.medicalServices as any)?.[service.key] ? alpha('#1976d2', 0.1) : 'background.paper'
                                }}
                                onClick={() => updateVisitSchedule(activeVisitScheduleTab, `medicalServices.${service.key}`, !((newEnquiry.visitSchedules || [])[activeVisitScheduleTab]?.medicalServices as any)?.[service.key])}
                              >
                                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                                  <Box sx={{ mb: 1, color: `${service.color}.main` }}>
                                    {service.icon}
                                  </Box>
                                  <Typography variant="body2" fontWeight="medium">
                                    {service.label}
                                  </Typography>
                                  {((newEnquiry.visitSchedules || [])[activeVisitScheduleTab]?.medicalServices as any)?.[service.key] && (
                                    <CheckCircleIcon sx={{ color: 'success.main', mt: 1 }} fontSize="small" />
                                  )}
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Grid>
                          
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                          label="Visit Notes"
                              multiline
                              rows={3}
                          value={(newEnquiry.visitSchedules || [])[activeVisitScheduleTab]?.notes || ''}
                          onChange={(e) => updateVisitSchedule(activeVisitScheduleTab, 'notes', e.target.value)}
                          variant="outlined"
                          placeholder="Add any specific notes or instructions for this visit..."
                            />
                          </Grid>
                        </Grid>
                  </Box>
                )}
              </Box>
            )}

        {/* Summary & Review Step */}
        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon />
              Summary & Review
            </Typography>
            
            {/* Basic Information Summary */}
            <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon fontSize="small" />
                Patient Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Name</Typography>
                  <Typography variant="body1" fontWeight="medium">{newEnquiry.name || 'Not provided'}</Typography>
                </Grid>
                {userProfile?.role !== 'audiologist' && (
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">Phone</Typography>
                    <Typography variant="body1" fontWeight="medium">{newEnquiry.phone || 'Not provided'}</Typography>
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Email</Typography>
                  <Typography variant="body1" fontWeight="medium">{newEnquiry.email || 'Not provided'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Reference</Typography>
                  <Typography variant="body1" fontWeight="medium">{newEnquiry.reference || 'Not provided'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Assigned To</Typography>
                  <Typography variant="body1" fontWeight="medium">{newEnquiry.assignedTo || 'Not assigned'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Telecaller</Typography>
                  <Typography variant="body1" fontWeight="medium">{newEnquiry.telecaller || 'Not assigned'}</Typography>
                </Grid>
                
                {newEnquiry.address && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Address</Typography>
                    <Typography variant="body1" fontWeight="medium">{newEnquiry.address}</Typography>
                  </Grid>
                )}
                {newEnquiry.message && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">Message/Notes</Typography>
                    <Typography variant="body1" fontWeight="medium">{newEnquiry.message}</Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>

            {/* Follow-ups Summary */}
            {newEnquiry.followUps && newEnquiry.followUps.length > 0 && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FollowUpIcon fontSize="small" />
                  Follow-up Summary ({newEnquiry.followUps.length} records)
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {newEnquiry.followUps.map((followUp, index) => (
                    <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Grid container spacing={1}>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="text.secondary">Call Date</Typography>
                          <Typography variant="body2">{followUp.date || 'Not set'}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="text.secondary">Next Follow-up</Typography>
                          <Typography variant="body2">{followUp.nextFollowUpDate || 'Not set'}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="text.secondary">Telecaller</Typography>
                          <Typography variant="body2">{followUp.callerName || 'Not assigned'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Typography variant="body2" color="text.secondary">Remarks</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                            {followUp.remarks ? (followUp.remarks.length > 30 ? `${followUp.remarks.substring(0, 30)}...` : followUp.remarks) : 'No remarks'}
                          </Typography>
                        </Grid>
                      </Grid>
            </Box>
                  ))}
                </Box>
              </Paper>
            )}

            {/* Medical Services Summary */}
            {newEnquiry.activeFormTypes && newEnquiry.activeFormTypes.length > 0 && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MedicalServicesIcon fontSize="small" />
                  Medical Services Configuration
                </Typography>
                
                {/* Test Configuration Summary */}
                {newEnquiry.activeFormTypes.includes('test') && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'primary.main' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HearingIcon fontSize="small" />
                      Hearing & Impedance Test
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="body2" color="text.secondary">Test Type</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {newEnquiry.testDetails?.testName || 'Not selected'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="body2" color="text.secondary">Conducted By</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {newEnquiry.testDetails?.testDoneBy || 'Not assigned'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Typography variant="body2" color="text.secondary">Test Price</Typography>
                        <Typography variant="body1" fontWeight="medium" color="success.main">
                          {newEnquiry.testDetails?.testPrice ? `₹${newEnquiry.testDetails.testPrice}` : 'Not set'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Trial Configuration Summary */}
                {newEnquiry.activeFormTypes.includes('trial') && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'secondary.main' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, color: 'secondary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MedicalServicesIcon fontSize="small" />
                      Device Trial
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Device Model</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {newEnquiry.trialDetails?.deviceBrand || 'Not specified'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Trial Duration</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {newEnquiry.trialDetails?.trialDuration || 'Not specified'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Hearing Aid Fitting Summary */}
                {newEnquiry.activeFormTypes.includes('hearing_aid') && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HearingIcon fontSize="small" />
                      Hearing Aid Fitting
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Device Brand</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {newEnquiry.fittingDetails?.hearingAidBrand || 'Not specified'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Model</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {newEnquiry.fittingDetails?.hearingAidModel || 'Not specified'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Home Visit Summary */}
                {newEnquiry.activeFormTypes.includes('home_visit') && (
                  <Box sx={{ mb: 3, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'warning.main' }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, color: 'warning.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HomeIcon fontSize="small" />
                      Home Visit
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Visit Address</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {newEnquiry.homeVisitDetails?.visitAddress || 'Not specified'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">Contact Person</Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {newEnquiry.homeVisitDetails?.familyMembers || 'Not specified'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* Show selected services as chips for quick reference */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Selected Services:</Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {newEnquiry.activeFormTypes.map((type) => (
                      <Chip 
                        key={type}
                        label={getSpecializedFormLabel(type)} 
                        color="primary" 
                        variant="outlined"
                        size="small"
                        icon={getFormTypeIcon(type)}
                      />
                    ))}
                  </Box>
                </Box>
              </Paper>
            )}

            {/* Visit Schedules Summary (Edit Mode) */}
            {isEditMode && newEnquiry.visitSchedules && newEnquiry.visitSchedules.length > 0 && (
              <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentIcon fontSize="small" />
                  Visit Schedules ({newEnquiry.visitSchedules.length} visits)
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {newEnquiry.visitSchedules.map((visit, index) => (
                    <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Grid container spacing={1}>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="text.secondary">Purpose</Typography>
                          <Typography variant="body2">{visit.visitPurpose || 'Not specified'}</Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography variant="body2" color="text.secondary">Date & Time</Typography>
                          <Typography variant="body2">{visit.visitDate || 'Not set'} {visit.visitTime && `at ${visit.visitTime}`}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">Medical Services</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {Object.entries(visit.medicalServices || {}).filter(([_, selected]) => selected).map(([service, _]) => (
                              <Chip key={service} label={service.charAt(0).toUpperCase() + service.slice(1)} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}

            {/* Ready to Save */}
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body1" fontWeight="medium">
                ✅ Ready to Save
              </Typography>
              <Typography variant="body2">
                Please review all the information above. You can go back to any step to make changes or click "Save Enquiry" to complete the process.
              </Typography>
            </Alert>
          </Box>
        )}

          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, bgcolor: 'grey.50', justifyContent: 'space-between' }}>
          <Box>
          {activeStep > 0 ? (
              <Button 
                onClick={() => setActiveStep(activeStep - 1)} 
                variant="outlined"
                startIcon={<ArrowForwardIcon sx={{ transform: 'rotate(180deg)' }} />}
              >
              Back
            </Button>
          ) : (
            <Button onClick={handleCloseDialog} variant="outlined">
              Cancel
            </Button>
          )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isLastStep() && (
              <Button 
                onClick={handleNext} 
                variant="contained" 
                color="primary"
                endIcon={<ArrowForwardIcon />}
                disabled={
                  (activeStep === 0 && (!newEnquiry.name || !newEnquiry.phone))
                }
              >
                Next
              </Button>
            )}
            
            {isLastStep() && (
              <Button 
                onClick={handleSubmit}
                variant="contained" 
                color="success"
                startIcon={<SaveIcon />}
                disabled={loading}
                size="large"
              >
                {loading ? 'Saving...' : isEditMode ? 'Update Enquiry' : 'Save Enquiry'}
              </Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>

      {/* Convert to Visitor Dialog */}
      <Dialog 
        open={openConvertDialog} 
        onClose={handleCloseConvertDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Convert Enquiry to Visitor
        </DialogTitle>
        <DialogContent dividers>
          {enquiryToConvert && (
            <Box>
              {/* Patient Info */}
              <Box mb={2} p={2} bgcolor="grey.50" borderRadius={1}>
                <Typography variant="h6" gutterBottom>
                  Patient Information
                </Typography>
                <Typography variant="body2">
                  <strong>Name:</strong> {enquiryToConvert.name}
                </Typography>
                {userProfile?.role !== 'audiologist' && (
                  <Typography variant="body2">
                    <strong>Phone:</strong> {enquiryToConvert.phone}
                  </Typography>
                )}
                {enquiryToConvert.email && (
                  <Typography variant="body2">
                    <strong>Email:</strong> {enquiryToConvert.email}
                  </Typography>
                )}
                <Typography variant="body2">
                  <strong>Subject:</strong> {enquiryToConvert.subject}
                </Typography>
              </Box>

              {/* Visit Details */}
              <Typography variant="h6" gutterBottom color="primary">
                Visit Details
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Visit Type</InputLabel>
                    <Select
                      name="visitType"
                      value={visitorData.visitType}
                      label="Visit Type"
                      onChange={handleVisitorDataChange}
                    >
                      <MenuItem value="consultation">General Consultation</MenuItem>
                      <MenuItem value="test">Hearing Test</MenuItem>
                      <MenuItem value="trial">Device Trial</MenuItem>
                      <MenuItem value="fitting">Device Fitting</MenuItem>
                      <MenuItem value="followup">Follow-up Visit</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>Center</InputLabel>
                    <Select
                      name="visitingCenter"
                      value={visitorData.visitingCenter}
                      label="Center"
                      onChange={handleVisitorDataChange}
                    >
                      <MenuItem value="main">Main Center</MenuItem>
                      <MenuItem value="north">North Branch</MenuItem>
                      <MenuItem value="south">South Branch</MenuItem>
                      <MenuItem value="east">East Branch</MenuItem>
                      <MenuItem value="west">West Branch</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="visitDate"
                    label="Visit Date"
                    type="date"
                    fullWidth
                    required
                    value={visitorData.visitDate}
                    onChange={handleVisitorDataChange}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="visitTime"
                    label="Visit Time"
                    type="time"
                    fullWidth
                    required
                    value={visitorData.visitTime}
                    onChange={handleVisitorDataChange}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      name="status"
                      value={visitorData.status}
                      label="Status"
                      onChange={handleVisitorDataChange}
                    >
                      <MenuItem value="scheduled">Scheduled</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                      <MenuItem value="no-show">No Show</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    name="notes"
                    label="Notes"
                    fullWidth
                    multiline
                    rows={3}
                    value={visitorData.notes}
                    onChange={handleVisitorDataChange}
                    placeholder="Add any notes about the visit..."
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConvertDialog}>
            Cancel
          </Button>
              <Button 
            onClick={handleConvertToVisitor}
                variant="contained" 
                color="success"
            startIcon={<PersonAddIcon />}
              >
            Convert to Visitor
              </Button>
        </DialogActions>
      </Dialog>

      {/* Simplified Enquiry Form */}
      <SimplifiedEnquiryForm
        open={openSimplifiedDialog}
        onClose={() => setOpenSimplifiedDialog(false)}
        onSubmit={handleSimplifiedFormSubmit}
        enquiry={editingEnquiry}
        isEditMode={!!editingEnquiry}
      />

      {/* Column Management Dialog */}
      <Dialog 
        open={columnManagementOpen} 
        onClose={() => setColumnManagementOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ViewColumnIcon />
            Manage Table Columns
          </Box>
          <IconButton onClick={() => setColumnManagementOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Column Visibility
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select which columns to display in the table
            </Typography>
            
            {/* Group columns by category */}
            {['Basic', 'Contact', 'Management', 'Visit', 'System'].map(category => (
              <Box key={category} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
                  {category}
                </Typography>
                <FormGroup row>
                  {availableColumns
                    .filter(col => col.category === category)
                    .map(column => (
                      <FormControlLabel
                        key={column.key}
                        control={
                          <Checkbox
                            checked={visibleColumns.includes(column.key)}
                            onChange={() => handleColumnToggle(column.key)}
                            disabled={column.key === 'actions'}
                          />
                        }
                        label={column.label}
                      />
                    ))}
                </FormGroup>
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box>
            <Typography variant="h6" gutterBottom>
              Column Order
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Reorder columns using the up/down arrows
            </Typography>
            
            <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
              {columnOrder.filter(col => visibleColumns.includes(col)).map((columnKey, index) => {
                const column = availableColumns.find(c => c.key === columnKey);
                const isFirst = index === 0;
                const isLast = index === columnOrder.filter(col => visibleColumns.includes(col)).length - 1;
                
                return (
                  <Box
                    key={columnKey}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 1,
                      px: 2,
                      mb: 1,
                      bgcolor: 'grey.50',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DragIndicatorIcon color="disabled" />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {index + 1}. {column?.label}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => moveColumnUp(columnKey)}
                        disabled={isFirst || columnKey === 'actions'}
                      >
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => moveColumnDown(columnKey)}
                        disabled={isLast || columnKey === 'actions'}
                      >
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Paper>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => {
              console.log('Visible columns:', visibleColumns);
              console.log('Column order:', columnOrder);
            }} 
            color="info"
          >
            Debug Info
          </Button>
          <Button onClick={resetColumnSettings} color="warning">
            Reset to Default
          </Button>
          <Button onClick={() => setColumnManagementOpen(false)} variant="outlined">
            Cancel
          </Button>
          <Button 
            onClick={() => {
              console.log('Applying changes - Visible:', visibleColumns, 'Order:', columnOrder);
              setColumnManagementOpen(false);
            }} 
            variant="contained"
          >
            Apply Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alert Snackbar */}
      <Snackbar
        open={alert.open}
        autoHideDuration={6000}
        onClose={() => setAlert({ ...alert, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setAlert({ ...alert, open: false })} 
          severity={alert.severity}
          sx={{ width: '100%' }}
        >
          {alert.message}
        </Alert>
      </Snackbar>
      </Box>
    </Box>
  );
} 