'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import {
  TextField, Button, Typography, Box, Paper,
  FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Divider, Stepper, Step, StepLabel,
  Grid as MuiGrid, IconButton, FormHelperText,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, Chip, InputAdornment, Switch, FormControlLabel
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
  Check as CheckIcon
} from '@mui/icons-material';

// Custom Grid wrapper
const Grid = ({ children, ...props }: any) => <MuiGrid {...props}>{children}</MuiGrid>;

// Static options
const referenceOptions = [
  'Camp', 'CGHS/DGEHS', 'Dr. Deepika Ref.', 'Dr. Fateh Ref.', 'Dr. Isha Ref.',
  'Dr. Iti Ref.', 'Dr. Mohan Ref.', 'Dr. Sandhya Ref.', 'Dr. Vineet Ref.',
  'Facebook', 'Google Adwords', 'Google/Search', 'Instagram', 'Newspaper',
  'Radio', 'Reference', 'SMS', 'Television', 'Walk-In', 'Website', 'Other'
];

const staffOptions = [
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
  productId: string;
  name: string;
  hsnCode: string;
  serialNumber: string;
  unit: 'piece' | 'pair' | 'quantity';
  saleDate: string;
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  discountAmount: number;
  gstPercent: number;
  gstAmount: number;
  finalAmount: number;
  gstApplicable: boolean;
  warranty: string;
}

interface PaymentRecord {
  id: string;
  paymentDate: string;
  amount: number;
  paymentFor: 'hearing_test' | 'hearing_aid' | 'accessory' | 'full_payment' | 'partial_payment' | 'other';
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
  hearingAid: boolean;
  accessory: boolean;
  programming: boolean;
  repair: boolean;
  counselling: boolean;
  testType: string;
  testDoneBy: string;
  testResults: string;
  recommendations: string;
  testPrice: number;
  hearingAidType: string;
  hearingAidBrand: string;
  hearingAidModel: string;
  hearingAidPrice: number;
  warranty: string;
  whichEar: 'left' | 'right' | 'both';
  hearingAidStatus: 'booked' | 'not interested' | 'sold';
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
  const [step, setStep] = useState(0);
  const [activeVisit, setActiveVisit] = useState(0);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [currentFollowUp, setCurrentFollowUp] = useState({
    date: new Date().toISOString().split('T')[0],
    remarks: '',
    nextFollowUpDate: '',
    callerName: ''
  });
  const [products, setProducts] = useState<any[]>([]);
  const [currentProduct, setCurrentProduct] = useState({
    productId: '',
    name: '',
    hsnCode: '',
    serialNumber: '',
    unit: 'piece' as 'piece' | 'pair' | 'quantity',
    saleDate: new Date().toISOString().split('T')[0],
    mrp: 0,
    sellingPrice: 0,
    discountPercent: 0,
    discountAmount: 0,
    gstPercent: 18,
    gstAmount: 0,
    finalAmount: 0,
    warranty: ''
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
      message: '',
                    visits: [],
      followUps: [],
      payments: []
    }
  });

  // Watch specific fields
  const watchedVisits = watch('visits');
  const currentVisit = watchedVisits[activeVisit] || null;
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
          hearingAid: visit.medicalServices?.includes('hearing_aid') || false,
          accessory: visit.medicalServices?.includes('accessory') || false,
          programming: visit.medicalServices?.includes('programming') || false,
          repair: visit.medicalServices?.includes('repair') || false,
          counselling: visit.medicalServices?.includes('counselling') || false,
          testType: visit.hearingTestDetails?.testType || '',
          testDoneBy: visit.hearingTestDetails?.testDoneBy || '',
          testResults: visit.hearingTestDetails?.testResults || '',
          recommendations: visit.hearingTestDetails?.recommendations || '',
          testPrice: visit.hearingTestDetails?.testPrice || 0,
          hearingAidType: visit.hearingAidDetails?.hearingAidSuggested || '',
          hearingAidBrand: visit.hearingAidDetails?.whoSold || '',
          hearingAidModel: visit.hearingAidDetails?.quotation || '',
          hearingAidPrice: visit.hearingAidDetails?.bookingAmount || 0,
          warranty: visit.hearingAidDetails?.trialPeriod || '',
          whichEar: visit.hearingAidDetails?.whichEar || 'both',
          hearingAidStatus: visit.hearingAidDetails?.hearingAidStatus || 'booked',
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
        })) || [{
          id: '1',
          visitDate: '',
          visitTime: '',
          visitType: 'center',
          visitNotes: '',
          hearingTest: false,
          hearingAid: false,
          accessory: false,
          programming: false,
          repair: false,
          counselling: false,
          testType: '',
          testDoneBy: '',
          testResults: '',
          recommendations: '',
          testPrice: 0,
          hearingAidType: '',
          hearingAidBrand: '',
          hearingAidModel: '',
          hearingAidPrice: 0,
          warranty: '',
          whichEar: 'both',
          hearingAidStatus: 'booked',
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
        }];

        reset({
          name: enquiry.name || '',
          phone: enquiry.phone || '',
          email: enquiry.email || '',
          address: enquiry.address || '',
          reference: enquiry.reference || '',
          assignedTo: enquiry.assignedTo || '',
          telecaller: enquiry.telecaller || '',
          message: enquiry.message || '',
          visits,
          followUps: [],
          payments: enquiry.payments || []
        });
        setFollowUps(enquiry.followUps || []);
      } else {
        // Reset for new form
        reset();
        setFollowUps([]);
      }
      setStep(0);
      setActiveVisit(0);
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

  // Handle visit changes
  const updateVisit = (visitIndex: number, field: string, value: any) => {
    const updatedVisits = [...watchedVisits];
    updatedVisits[visitIndex] = { ...updatedVisits[visitIndex], [field]: value };
    setValue('visits', updatedVisits);
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
      hearingAid: false,
      accessory: false,
      programming: false,
      repair: false,
      counselling: false,
      testType: '',
      testDoneBy: '',
      testResults: '',
      recommendations: '',
      testPrice: 0,
      hearingAidType: '',
      hearingAidBrand: '',
      hearingAidModel: '',
      hearingAidPrice: 0,
      warranty: '',
      whichEar: 'both',
      hearingAidStatus: 'booked',
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
    if (watchedVisits.length > 1) {
      const updatedVisits = watchedVisits.filter((_, i) => i !== visitIndex);
      setValue('visits', updatedVisits);
      if (activeVisit >= updatedVisits.length) {
        setActiveVisit(updatedVisits.length - 1);
      }
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
        productId: currentProduct.productId,
        name: currentProduct.name,
        hsnCode: currentProduct.hsnCode,
        serialNumber: currentProduct.serialNumber,
        unit: currentProduct.unit,
        saleDate: currentProduct.saleDate,
        mrp: currentProduct.mrp,
        sellingPrice,
        discountPercent: currentProduct.discountPercent,
        discountAmount,
        gstPercent: currentProduct.gstPercent,
        gstAmount,
        finalAmount,
        gstApplicable: currentProduct.gstPercent > 0,
        warranty: currentProduct.warranty
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
        productId: '',
        name: '',
        hsnCode: '',
        serialNumber: '',
        unit: 'piece',
        saleDate: new Date().toISOString().split('T')[0],
        mrp: 0,
        sellingPrice: 0,
        discountPercent: 0,
        discountAmount: 0,
        gstPercent: 18,
        gstAmount: 0,
        finalAmount: 0,
        warranty: ''
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
      if (visit.hearingAid && visit.products) {
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
      
      if (visit.hearingAid && visit.salesAfterTax > 0) {
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
      amount: selectedOption?.amount || 0
    }));
  };

  const calculateTotalPaid = () => {
    const payments = getValues('payments');
    return payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
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
      visitSchedules: data.visits.map(visit => ({
        id: visit.id,
        visitType: visit.visitType,
        visitDate: visit.visitDate,
        visitTime: visit.visitTime,
        notes: visit.visitNotes,
        medicalServices: [
          ...(visit.hearingTest ? ['hearing_test'] : []),
          ...(visit.hearingAid ? ['hearing_aid'] : []),
          ...(visit.accessory ? ['accessory'] : []),
          ...(visit.programming ? ['programming'] : []),
          ...(visit.repair ? ['repair'] : []),
          ...(visit.counselling ? ['counselling'] : [])
        ],
        hearingTestDetails: {
          testType: visit.testType,
          testDoneBy: visit.testDoneBy,
          testResults: visit.testResults,
          recommendations: visit.recommendations,
          testPrice: visit.testPrice
        },
        hearingAidDetails: {
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
          totalDiscountPercent: visit.totalDiscountPercent
        },
        accessoryDetails: {
          accessoryName: visit.accessoryName,
          accessoryDetails: visit.accessoryDetails,
          accessoryFOC: visit.accessoryFOC,
          accessoryAmount: visit.accessoryAmount,
          accessoryQuantity: visit.accessoryQuantity
        },
        programmingDetails: {
          programmingReason: visit.programmingReason,
          hearingAidPurchaseDate: visit.hearingAidPurchaseDate,
          hearingAidName: visit.hearingAidName,
          underWarranty: visit.underWarranty,
          programmingAmount: visit.programmingAmount,
          programmingDoneBy: visit.programmingDoneBy
        }
      }))
    };
    onSubmit(formattedData);
  };

  const stepTitles = ['Patient Information & Services', 'Review & Submit'];

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
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      )}
                    />
                  </Grid>
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
                          <InputLabel>Reference Source</InputLabel>
                          <Select {...field} label="Reference Source" sx={{ borderRadius: 2 }}>
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
                  <Grid item xs={12}>
                    <Controller
                      name="address"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Address"
                          multiline
                          rows={3}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="assignedTo"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Assigned To</InputLabel>
                          <Select {...field} label="Assigned To" sx={{ borderRadius: 2 }}>
                            {staffOptions.map(option => (
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
                    <Controller
                      name="telecaller"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Telecaller</InputLabel>
                          <Select {...field} label="Telecaller" sx={{ borderRadius: 2 }}>
                            {staffOptions.map(option => (
                              <MenuItem key={option} value={option}>
                                {option}
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
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
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
                      <FormControl fullWidth size="small" required sx={{ minWidth: 200 }}>
                        <InputLabel>Call Done By *</InputLabel>
                        <Select
                          value={currentFollowUp.callerName}
                          onChange={(e) => handleFollowUpChange('callerName', e.target.value)}
                          label="Call Done By *"
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
                      const statusColors = {
                        pending: 'info',
                        completed: 'success',
                        cancelled: 'error'
                      } as const;

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
                {watchedVisits.length > 0 ? (
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                    <Tabs
                      value={activeVisit}
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
                            {watchedVisits.length > 1 && (
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
                ) : (
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
                    <DateRangeIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                    <Typography variant="h5" color="text.secondary" gutterBottom>
                      No visits scheduled yet
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                      Add a visit to record patient services and details
                    </Typography>
                    <Button
                      variant="contained"
                      size="large"
                      startIcon={<AddIcon />}
                      onClick={addVisit}
                      sx={{ borderRadius: 2, px: 4, py: 1.5 }}
                    >
                      Schedule First Visit
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
                                color="primary"
                              />
                            }
                            label="Hearing Test"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.hearingAid}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAid', e.target.checked)}
                                color="secondary"
                              />
                            }
                            label="Hearing Aid"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.accessory}
                                onChange={(e) => updateVisit(activeVisit, 'accessory', e.target.checked)}
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
                              <FormControl fullWidth>
                                <InputLabel>Test Done By</InputLabel>
                                <Select 
                                  value={currentVisit.testDoneBy}
                                  onChange={(e) => updateVisit(activeVisit, 'testDoneBy', e.target.value)}
                                  label="Test Done By"
                                  sx={{ borderRadius: 2 }}
                                >
                                  {staffOptions.map(option => (
                                    <MenuItem key={option} value={option}>
                                      {option}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
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
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )}

                    {/* Hearing Aid Details */}
                    {currentVisit.hearingAid && (
                      <Card sx={{ mb: 4, bgcolor: 'secondary.50', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <MedicalIcon sx={{ color: 'secondary.main' }} />
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                              Hearing Aid Details
                            </Typography>
                          </Box>
                          
                          {/* Basic Hearing Aid Info */}
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
                                  <MenuItem value="booked">Booked</MenuItem>
                                  <MenuItem value="not interested">Not Interested</MenuItem>
                                  <MenuItem value="sold">Sold</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          </Grid>

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
                              <Grid item xs={12} md={2}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Select Product</InputLabel>
                                  <Select
                                    value={currentProduct.productId}
                                    onChange={(e) => {
                                      const selectedProduct = products.find(p => p.id === e.target.value);
                                      if (selectedProduct) {
                                        const gstPercent = selectedProduct.gstApplicable ? (selectedProduct.gstPercentage || 18) : 0;
                                        const gstAmount = selectedProduct.mrp * gstPercent / 100;
                                        setCurrentProduct(prev => ({
                                          ...prev,
                                          productId: selectedProduct.id,
                                          name: selectedProduct.name,
                                          hsnCode: selectedProduct.hsnCode,
                                          mrp: selectedProduct.mrp,
                                          gstPercent,
                                          unit: selectedProduct.quantityType || 'piece',
                                          sellingPrice: selectedProduct.mrp,
                                          discountPercent: 0,
                                          discountAmount: 0,
                                          gstAmount,
                                          finalAmount: selectedProduct.mrp + gstAmount
                                        }));
                                      }
                                    }}
                                    label="Select Product"
                                  >
                                    {products.map(product => (
                                      <MenuItem key={product.id} value={product.id}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                          <Typography>{product.name} - {product.company}</Typography>
                                          {!product.gstApplicable && (
                                            <Chip 
                                              label="GST Exempt" 
                                              size="small" 
                                              color="warning" 
                                              variant="outlined"
                                              sx={{ ml: 1, fontSize: '0.7rem' }}
                                            />
                                          )}
                                        </Box>
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
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
                              <FormControl fullWidth>
                                <InputLabel>Programming Done By</InputLabel>
                                <Select
                                  value={currentVisit.programmingDoneBy}
                                  onChange={(e) => updateVisit(activeVisit, 'programmingDoneBy', e.target.value)}
                                  label="Programming Done By"
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
                              Patient: {watch('name')} | Phone: {watch('phone')}
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
                          <Typography variant="h5" sx={{ fontWeight: 700, color: calculateOutstanding() > 0 ? 'error.main' : 'success.main' }}>
                            {formatCurrency(calculateOutstanding())}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Payment Status</Typography>
                          <Chip
                            label={
                              calculateOutstanding() === 0 
                                ? 'Fully Paid' 
                                : calculateTotalPaid() > 0 
                                  ? 'Partially Paid' 
                                  : 'Unpaid'
                            }
                            color={
                              calculateOutstanding() === 0 
                                ? 'success' 
                                : calculateTotalPaid() > 0 
                                  ? 'warning' 
                                  : 'error'
                            }
                            variant="filled"
                            sx={{ fontWeight: 600 }}
                          />
                                                 </Box>
                       </Grid>
                    </Grid>
                  </CardContent>
                </Card>
                      <FormControl fullWidth size="small" required sx={{ minWidth: 200 }}>
                        <InputLabel>Call Done By *</InputLabel>
                        <Select
                          value={currentFollowUp.callerName}
                          onChange={(e) => handleFollowUpChange('callerName', e.target.value)}
                          label="Call Done By *"
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
                               full_payment: 'Full Payment',
                               partial_payment: 'Partial Payment',
                               other: 'Other'
                             };
                             
                             const paymentForColors = {
                               hearing_test: 'primary',
                               hearing_aid: 'secondary',
                               accessory: 'success',
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
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Phone</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>{watchPhone}</Typography>
                  </Box>
                </Grid>
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
                        {visit.hearingAid && (
                          <Chip label="Hearing Aid" color="secondary" size="small" />
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
                        {!visit.hearingTest && !visit.hearingAid && !visit.accessory && !visit.programming && !visit.repair && !visit.counselling && (
                          <Typography variant="body2">No services selected</Typography>
                        )}
                      </Box>
                    </Grid>
                    {visit.hearingAid && visit.products.length > 0 && (
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
    </Box>
  );
};

export default SimplifiedEnquiryForm; 