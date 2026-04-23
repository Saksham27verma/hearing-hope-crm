'use client';

import React, { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getHeadOfficeId } from '@/utils/centerUtils';
import { useEnquiryOptionsByField } from '@/hooks/useEnquiryOptionsByField';
import { isGenericLoginDisplayName } from '@/utils/enquiryTelecallerOptions';
import { fetchStaffRecordsWithServerFallback } from '@/utils/fetchStaffForEnquiryForms';
import { useAuth } from '@/context/AuthContext';
import ExternalPtaReportPicker from './ExternalPtaReportPicker';
import JourneyConfirmDialog, { type JourneySelectValue } from './JourneyConfirmDialog';
import {
  getEnquiryStatusMeta,
  LEAD_OUTCOME_OPTIONS,
  parseJourneyStatusOverride,
  type EnquiryJourneyStatus,
  type EnquiryStatusChipColor,
} from '@/utils/enquiryStatus';
import EnquiryInventoryPickerDialog from './EnquiryInventoryPickerDialog';
import {
  resolveGstFromProductMaster,
  gstFieldsForInventoryRowFromProd,
  isHearingDeviceInventoryItem,
  isAccessoryInventoryItem,
  type EnquiryInventoryRow,
} from './enquiryInventoryUtils';
import {
  serialsFromLineProduct,
  splitSerialStringIntoTokens,
  applySalesCollectionToAvailabilityMaps,
  applyEnquiryVisitsSalesToAvailabilityMaps,
  makeProductLocationKey,
  splitProductLocationKey,
} from '@/lib/enquiryInventoryAvailability';
import { formatPtaTestDateForDisplay, type ExternalPtaReportLink } from '@/lib/ptaIntegration';
import { sumHearingTestEntryPrices } from '@/lib/hearingTestPricing';
import { sumEntProcedurePrices } from '@/lib/entServicePricing';
import { ENT_PROCEDURE_OPTIONS } from './enquiryFormFieldOptions';
import AsyncActionButton from '@/components/common/AsyncActionButton';
import { mergeMenuPropsForReselectClear } from '@/utils/toggleableSelectMenuProps';
import {
  TextField, Button, Typography, Box, Paper,
  FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, Divider, Stepper, Step, StepLabel,
  Grid as MuiGrid, IconButton, FormHelperText, Alert, Autocomplete,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, Chip, InputAdornment, Switch, FormControlLabel,
  ToggleButton, ToggleButtonGroup,
  Dialog, DialogTitle, DialogContent, DialogActions, Avatar, Stack, Checkbox, Radio,
  List, ListItem, ListItemButton, ListItemText, ListSubheader, Badge, Link as MuiLink
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
  GridView as GridViewIcon,
  AssignmentReturn as AssignmentReturnIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  ScienceOutlined as ScienceOutlinedIcon,
  BookmarkAdded as BookmarkAddedIcon,
  LockOutlined as LockOutlinedIcon,
  Timeline as TimelineIcon
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

/** Product types eligible for the enquiry "Accessory" medical service picker (matches products module categories). */
const ACCESSORY_SERVICE_PRODUCT_TYPES: readonly string[] = [
  'Accessory',
  'Battery',
  'Charger',
  'Other',
];

function isAccessoryServiceProductType(type: string | undefined): boolean {
  return !!type && ACCESSORY_SERVICE_PRODUCT_TYPES.includes(type);
}

/** Catalog picker for accessory visit: excludes serial-tracked chargers (those use device inventory). */
function isAccessoryCatalogProductType(p: Product): boolean {
  if (!isAccessoryServiceProductType(p.type)) return false;
  if (p.type === 'Charger' && p.hasSerialNumber) return false;
  return true;
}

function accessoryServiceProductChipColor(
  type: string
): 'primary' | 'secondary' | 'success' | 'warning' | 'default' {
  switch (type) {
    case 'Accessory':
      return 'primary';
    case 'Battery':
      return 'warning';
    case 'Charger':
      return 'success';
    case 'Other':
      return 'secondary';
    default:
      return 'default';
  }
}

/** Token-based match: every word must appear somewhere in product fields (dynamic search). */
function productMatchesCatalogSearch(p: Product, queryLower: string): boolean {
  const q = queryLower.trim();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hay = `${p.company || ''} ${p.name || ''} ${p.type || ''} ${String(p.mrp ?? '')} ${p.hsnCode || ''}`
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return tokens.every((t) => hay.includes(t));
}

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

const DEFAULT_ENQUIRY_STAFF_ROLES: Record<
  'telecaller' | 'assignedTo' | 'testBy' | 'programmingBy' | 'sales' | 'general',
  string[]
> = {
  telecaller: ['Telecaller', 'Customer Support'],
  assignedTo: ['Manager', 'Sales Executive', 'Audiologist'],
  testBy: ['Audiologist', 'Technician'],
  programmingBy: ['Audiologist', 'Technician'],
  sales: ['Sales Executive', 'Manager'],
  general: JOB_ROLES,
};

function normalizeEnquiryStaffRoleConfig(
  raw: unknown,
): Record<keyof typeof DEFAULT_ENQUIRY_STAFF_ROLES, string[]> {
  const out = { ...DEFAULT_ENQUIRY_STAFF_ROLES } as Record<
    keyof typeof DEFAULT_ENQUIRY_STAFF_ROLES,
    string[]
  >;
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  (Object.keys(DEFAULT_ENQUIRY_STAFF_ROLES) as Array<
    keyof typeof DEFAULT_ENQUIRY_STAFF_ROLES
  >).forEach((k) => {
    const arr = src[k];
    if (Array.isArray(arr)) {
      out[k] = arr
        .map((v) => String(v || '').trim())
        .filter(Boolean);
    }
  });
  return out;
}

// Utility function
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/** Whole rupees for hearing-aid sale lines, GST, and visit totals (matches invoices). */
const roundInrRupee = (n: number) => Math.round(Number(n) || 0);

const formatCurrencySale = (amount: number) => formatCurrency(roundInrRupee(amount));
/** Contact phone: up to 10 letters/digits (e.g. masked numbers like 123xxx8984). */
const normalizeEnquiryPhone = (value: unknown) =>
  String(value || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 10);

/** Warranty options for sale lines — stored verbatim for invoices. */
const HEARING_AID_SALE_WARRANTY_OPTIONS = [
  '6 Months',
  '12 Months',
  '18 Months',
  '24 Months',
  '30 Months',
  '36 Months',
  '48 Months',
] as const;

/** Max 2 decimal places for discount % (display + stored values). */
const roundDiscountPercent = (value: number) =>
  Math.round(Math.max(0, Math.min(100, Number(value) || 0)) * 100) / 100;

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
  hsnCode?: string;
  serialNumber: string;
  unit: 'piece' | 'pair' | 'quantity';
  quantity?: number;
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

/** Units per sale line; amounts on the line are per unit. */
function hearingAidLineQty(p: { quantity?: number }): number {
  const q = Math.floor(Number(p.quantity));
  if (!Number.isFinite(q) || q < 1) return 1;
  return Math.min(9999, q);
}

function sumHearingAidVisitTotals(products: HearingAidProduct[]) {
  const grossMRP = roundInrRupee(products.reduce((sum, p) => sum + p.mrp * hearingAidLineQty(p), 0));
  const grossSalesBeforeTax = roundInrRupee(
    products.reduce((sum, p) => sum + p.sellingPrice * hearingAidLineQty(p), 0)
  );
  let taxAmount = roundInrRupee(products.reduce((sum, p) => sum + p.gstAmount * hearingAidLineQty(p), 0));
  const salesAfterTax = roundInrRupee(
    products.reduce((sum, p) => sum + p.finalAmount * hearingAidLineQty(p), 0)
  );
  const prePlusTax = roundInrRupee(grossSalesBeforeTax + taxAmount);
  // Align GST with line finals when float/legacy lines cause a single-rupee drift vs gross + tax.
  if (prePlusTax !== salesAfterTax && Math.abs(salesAfterTax - prePlusTax) <= 1) {
    taxAmount = roundInrRupee(salesAfterTax - grossSalesBeforeTax);
  }
  return {
    grossMRP,
    grossSalesBeforeTax,
    taxAmount,
    salesAfterTax,
  };
}

interface SalesReturnLine {
  id: string;
  serialNumber: string;
  model: string;
  productName?: string;
  brand?: string;
  visitIndex?: number;
  saleDate?: string;
  finalAmount?: number;
}

function newSalesReturnLineId(): string {
  return `sr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function legacySerialsToLines(serial: string, modelFallback: string): SalesReturnLine[] {
  const s = String(serial || '').trim();
  if (!s) return [];
  if (s.includes(',')) {
    return s
      .split(',')
      .map((part, i) => ({
        id: `legacy-${i}-${part.trim()}`,
        serialNumber: part.trim(),
        model: modelFallback || '',
      }))
      .filter((x) => x.serialNumber);
  }
  return [{ id: 'legacy-0', serialNumber: s, model: modelFallback || '' }];
}

function normalizeSalesReturnItemsFromSaved(
  saved: Record<string, any> | undefined,
  hearingDetails: Record<string, any> | undefined
): SalesReturnLine[] {
  const items = saved?.salesReturnItems ?? hearingDetails?.salesReturnItems;
  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((it: any) => ({
        id: String(it.id || newSalesReturnLineId()),
        serialNumber: String(it.serialNumber || '').trim(),
        model: String(it.model || '').trim(),
        productName: it.productName,
        brand: it.brand,
        visitIndex: typeof it.visitIndex === 'number' ? it.visitIndex : undefined,
        saleDate: it.saleDate,
        finalAmount: it.finalAmount,
      }))
      .filter((it) => it.serialNumber);
  }
  const legacy = String(saved?.returnSerialNumber ?? hearingDetails?.returnSerialNumber ?? '').trim();
  if (!legacy) return [];
  const modelFb = String(saved?.hearingAidModel ?? hearingDetails?.quotation ?? '').trim();
  return legacySerialsToLines(legacy, modelFb);
}

function linesToLegacyReturnSerialString(lines: SalesReturnLine[]): string {
  return lines.map((l) => l.serialNumber.trim()).filter(Boolean).join(', ');
}

interface PaymentRecord {
  id: string;
  paymentDate: string;
  amount: number;
  paymentFor:
    | 'hearing_test'
    | 'ent_service'
    | 'hearing_aid'
    | 'accessory'
    | 'booking_advance'
    | 'trial_home_security_deposit'
    | 'trial_home_security_deposit_refund'
    | 'programming'
    | 'full_payment'
    | 'partial_payment'
    | 'other';
  paymentMode: 'Cash' | 'Card' | 'UPI' | 'Net Banking' | 'Cheque' | 'NEFT/RTGS';
  referenceNumber: string;
  remarks: string;
  /** When paymentFor is trial_home_security_deposit, identifies which visit the deposit is for */
  relatedVisitId?: string;
  createdByUid?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdByRole?: string | null;
  updatedByUid?: string | null;
  updatedByName?: string | null;
  updatedByEmail?: string | null;
  updatedByRole?: string | null;
}

interface Visit {
  id: string;
  visitDate: string;
  visitTime: string;
  visitType: 'center' | 'home';
  /** When visitType is home: consultation / travel charges (₹). */
  homeVisitCharges: number;
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
  entService: boolean;
  /** Multiple ENT procedures in one visit — each row: procedure + price (₹) */
  entProcedureEntries: { id: string; procedureType: string; price: number }[];
  entProcedureDoneBy: string;
  entServicePrice: number;
  /** @deprecated use hearingTestEntries; kept for save/backward compat (comma-separated) */
  testType: string;
  /** Multiple tests in one visit — each row: type + price (₹) */
  hearingTestEntries: { id: string; testType: string; price: number }[];
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
  /** Linked PTA report from external Vercel PTA app (stored under hearingTestDetails on save). */
  externalPtaReport?: ExternalPtaReportLink;
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
  /** Home trial only: agreed refundable security deposit amount (record actual payment in Payments section) */
  trialHomeSecurityDepositAmount: number;
  trialNotes: string;
  trialResult: 'ongoing' | 'successful' | 'unsuccessful' | 'extended';
  trialRefundAmount?: number;
  trialRefundDate?: string;
  // Booking related fields
  bookingFromTrial: boolean;
  bookingAdvanceAmount: number;
  bookingDate: string;
  bookingFromVisitId: string; // Which visit this booking relates to
  bookingSellingPrice: number;
  bookingQuantity: number;
  // Purchase related fields
  purchaseFromTrial: boolean;
  purchaseDate: string;
  purchaseFromVisitId: string; // Which visit this purchase relates to
  
  // Sales Return related fields
  /** One row per returned device (serial + model). Kept in sync with returnSerialNumber for legacy readers. */
  salesReturnItems: SalesReturnLine[];
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
  createdByUid?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdByRole?: string | null;
  updatedByUid?: string | null;
  updatedByName?: string | null;
  updatedByEmail?: string | null;
  updatedByRole?: string | null;
}

function newHearingTestEntryId(): string {
  return `ht-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newEntProcedureEntryId(): string {
  return `ent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Multiple procedures per visit, or legacy comma-separated line on entServiceDetails. */
function normalizeEntProcedureEntriesFromSavedVisit(visit: any): {
  id: string;
  procedureType: string;
  price: number;
}[] {
  const raw = visit?.entServiceDetails?.entProcedureEntries ?? visit?.entProcedureEntries;
  const legacyTotalPrice = Math.max(
    0,
    Number(visit?.entServiceDetails?.totalPrice ?? visit?.entServicePrice ?? 0) || 0
  );
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((e: any, i: number) => ({
      id: String(e?.id || `ent-${i}-${newEntProcedureEntryId()}`),
      procedureType: String(e?.procedureType ?? e?.procedure ?? '').trim(),
      price: Math.max(0, Number(e?.price ?? e?.procedurePrice ?? 0) || 0),
    }));
  }
  const legacy = String(visit?.entServiceDetails?.procedureTypesLine ?? '').trim();
  if (legacy) {
    const types = legacy
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
    if (types.length <= 1) {
      return [{ id: newEntProcedureEntryId(), procedureType: legacy, price: legacyTotalPrice }];
    }
    return types.map((t: string, i: number) => ({
      id: newEntProcedureEntryId(),
      procedureType: t,
      price: i === 0 ? legacyTotalPrice : 0,
    }));
  }
  return [];
}

/** Multiple tests per visit, or legacy single `testType` string. */
function normalizeHearingTestEntriesFromSavedVisit(visit: any): { id: string; testType: string; price: number }[] {
  const raw = visit?.hearingTestDetails?.hearingTestEntries ?? visit?.hearingTestEntries;
  const legacyTotalPrice = Math.max(0, Number(visit?.hearingTestDetails?.testPrice ?? visit?.testPrice ?? 0) || 0);
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((e: any, i: number) => ({
      id: String(e?.id || `ht-${i}-${newHearingTestEntryId()}`),
      testType: String(e?.testType ?? '').trim(),
      price: Math.max(0, Number(e?.price ?? e?.testPrice ?? 0) || 0),
    }));
  }
  const legacy = String(visit?.hearingTestDetails?.testType ?? visit?.testType ?? '').trim();
  if (legacy) {
    const types = legacy
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
    if (types.length <= 1) {
      return [{ id: newHearingTestEntryId(), testType: legacy, price: legacyTotalPrice }];
    }
    return types.map((t: string, i: number) => ({
      id: newHearingTestEntryId(),
      testType: t,
      price: i === 0 ? legacyTotalPrice : 0,
    }));
  }
  return [];
}


/** Home trial refundable security (₹) when type is home. */
function visitHomeTrialSecurityAmount(visit: Visit): number {
  if (!visit?.hearingAidTrial || visit.trialHearingAidType !== 'home') return 0;
  return Math.max(0, Number(visit.trialHomeSecurityDepositAmount) || 0);
}

/**
 * Find the home-trial visit whose security should credit a booking/sale on visits[currentIndex].
 * Uses previousVisitId chain, then same visit (trial + booking), then most recent prior home trial.
 */
function findLinkedHomeTrialVisitWithSecurity(visits: Visit[], currentIndex: number): Visit | null {
  if (currentIndex < 0 || currentIndex >= visits.length) return null;
  const current = visits[currentIndex];
  if (
    visitHomeTrialSecurityAmount(current) > 0 &&
    current.hearingAidBooked &&
    !current.hearingAidSale
  ) {
    return current;
  }
  const startIds = [
    current.previousVisitId,
    current.bookingFromVisitId,
    current.purchaseFromVisitId,
  ].filter((x): x is string => Boolean(x && String(x).trim()));
  const seen = new Set<string>();
  for (const start of startIds) {
    let id: string | undefined = start;
    while (id && !seen.has(id)) {
      seen.add(id);
      const pv = visits.find((v) => v.id === id);
      if (!pv) break;
      if (visitHomeTrialSecurityAmount(pv) > 0) return pv;
      id = pv.previousVisitId;
    }
  }
  for (let i = currentIndex - 1; i >= 0; i--) {
    const v = visits[i];
    if (visitHomeTrialSecurityAmount(v) > 0) return v;
  }
  return null;
}

/** If true, do not add home trial security as its own line in total due — it is netted against a later booking/sale. */
function homeTrialSecurityAbsorbedIntoLaterVisit(visits: Visit[], trialIndex: number): boolean {
  const trialVisit = visits[trialIndex];
  if (!trialVisit || visitHomeTrialSecurityAmount(trialVisit) === 0) return false;
  for (let j = trialIndex + 1; j < visits.length; j++) {
    const later = visits[j];
    const linked = findLinkedHomeTrialVisitWithSecurity(visits, j);
    if (linked?.id !== trialVisit.id) continue;
    if (later.hearingAidBooked && !later.hearingAidSale) return true;
    if (later.hearingAidSale) return true;
  }
  return false;
}

function getBookingHomeTrialSecurityCredit(visits: Visit[], visitIndex: number): number {
  const v = visits[visitIndex];
  if (!v?.hearingAidBooked || v.hearingAidSale) return 0;
  const trial = findLinkedHomeTrialVisitWithSecurity(visits, visitIndex);
  return trial ? visitHomeTrialSecurityAmount(trial) : 0;
}

/** Credit toward a sale; zero if a booking visit already sat between trial and this sale (credit used at booking). */
function getSaleHomeTrialSecurityCredit(visits: Visit[], visitIndex: number): number {
  const v = visits[visitIndex];
  if (!v?.hearingAidSale) return 0;
  const trial = findLinkedHomeTrialVisitWithSecurity(visits, visitIndex);
  if (!trial) return 0;
  const ti = visits.findIndex((x) => x.id === trial.id);
  if (ti < 0) return visitHomeTrialSecurityAmount(trial);
  for (let j = ti + 1; j < visitIndex; j++) {
    const mid = visits[j];
    if (mid.hearingAidBooked && !mid.hearingAidSale) return 0;
  }
  return visitHomeTrialSecurityAmount(trial);
}

function visitBookingAdvanceAmount(visit: Visit): number {
  if (!visit?.hearingAidBooked || visit.hearingAidSale) return 0;
  return Math.max(0, Number(visit.bookingAdvanceAmount) || 0);
}

/** Sale visit continues the journey from this booking visit (same chain). */
function saleVisitContinuesFromBookingVisit(
  visits: Visit[],
  saleIndex: number,
  bookingVisitId: string
): boolean {
  const sale = visits[saleIndex];
  if (!sale?.hearingAidSale || !bookingVisitId) return false;
  if (sale.previousVisitId === bookingVisitId) return true;
  const pfv = (sale as Visit).purchaseFromVisitId;
  if (pfv && String(pfv) === bookingVisitId) return true;
  const seen = new Set<string>();
  let id: string | undefined = sale.previousVisitId;
  while (id && !seen.has(id)) {
    seen.add(id);
    if (id === bookingVisitId) return true;
    const v = visits.find((x) => x.id === id);
    id = v?.previousVisitId;
  }
  return false;
}

/**
 * Booking-only visit: its gross is not added to total due when a later linked sale supersedes it
 * (final bill is the sale; advance is credited at sale time).
 */
function bookingVisitSupersededByLaterSale(visits: Visit[], bookingIndex: number): boolean {
  const book = visits[bookingIndex];
  if (!book?.hearingAidBooked || book.hearingAidSale) return false;
  const bid = book.id;
  for (let j = bookingIndex + 1; j < visits.length; j++) {
    if (!visits[j].hearingAidSale) continue;
    if (saleVisitContinuesFromBookingVisit(visits, j, bid)) return true;
    if (findLinkedPriorBookingVisitWithAdvance(visits, j)?.id === bid) return true;
  }
  return false;
}

/** Booking visit (with advance) that the sale continues from — for crediting advance against sale due. */
function findLinkedPriorBookingVisitWithAdvance(visits: Visit[], saleIndex: number): Visit | null {
  if (saleIndex < 0 || saleIndex >= visits.length) return null;
  const sale = visits[saleIndex];
  if (!sale?.hearingAidSale) return null;
  const pfv = sale.purchaseFromVisitId;
  if (pfv) {
    const byPurchase = visits.find((v) => v.id === pfv);
    if (
      byPurchase &&
      byPurchase.hearingAidBooked &&
      !byPurchase.hearingAidSale &&
      visitBookingAdvanceAmount(byPurchase) > 0
    ) {
      return byPurchase;
    }
  }
  const seen = new Set<string>();
  let id: string | undefined = sale.previousVisitId;
  while (id && !seen.has(id)) {
    seen.add(id);
    const pv = visits.find((v) => v.id === id);
    if (!pv) break;
    if (pv.hearingAidBooked && !pv.hearingAidSale && visitBookingAdvanceAmount(pv) > 0) return pv;
    id = pv.previousVisitId;
  }
  for (let i = saleIndex - 1; i >= 0; i--) {
    const v = visits[i];
    if (v.hearingAidBooked && !v.hearingAidSale && visitBookingAdvanceAmount(v) > 0) return v;
  }
  return null;
}

function getBookingAdvanceCreditForSale(visits: Visit[], saleIndex: number): number {
  const b = findLinkedPriorBookingVisitWithAdvance(visits, saleIndex);
  return b ? visitBookingAdvanceAmount(b) : 0;
}

interface FormData {
  // Basic Information
  name: string;
  customerName: string;
  customerGstNumber: string;
  phone: string;
  email: string;
  address: string;
  reference: string[];
  // Quick scheduling before first call
  followUpDate: string;
  assignedTo: string;
  telecaller: string;
  center: string;
  message: string;
  /** Optional: marks patient bought devices elsewhere (see LEAD_OUTCOME_OPTIONS). */
  leadOutcome: string;
  /** High-priority / strong lead — highlighted across CRM lists and profile */
  hotEnquiry: boolean;

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
  onSubmit: (data: any) => Promise<void> | void;
  enquiry?: any;
  isEditMode?: boolean;
  fullPage?: boolean;
  isSubmitting?: boolean;
}

const SimplifiedEnquiryForm: React.FC<Props> = ({
  open,
  onClose,
  onSubmit,
  enquiry,
  isEditMode = false,
  fullPage = true, // Always full page now
  isSubmitting = false
}) => {
  const { userProfile, user } = useAuth();
  const isAdmin = userProfile?.role === 'admin';
  const isAudiologist = userProfile?.role === 'audiologist';
  const getPtaIdToken = useCallback(async () => {
    try {
      return user ? await user.getIdToken() : null;
    } catch {
      return null;
    }
  }, [user]);
  const { optionsByField } = useEnquiryOptionsByField();
  const referenceFieldOptions = optionsByField.reference ?? [];
  const visitLocationOpts = optionsByField.visit_location ?? [];
  const visitHaStatusOpts = optionsByField.visit_hearing_aid_status ?? [];
  const trialLocationOpts = optionsByField.trial_location_type ?? [];
  const earSideOpts = optionsByField.ear_side ?? [];
  const deviceConditionOpts = optionsByField.device_return_condition ?? [];
  const serviceLineOpts = optionsByField.simplified_service_line ?? [];
  const paymentModeOpts = optionsByField.payment_mode ?? [];
  const hearingTestTypeOpts = optionsByField.hearing_test_type ?? [];

  const [step, setStep] = useState(0);
  const [activeVisit, setActiveVisit] = useState(-1);
  const [journeyDialogOpen, setJourneyDialogOpen] = useState(false);
  const [journeySelectValue, setJourneySelectValue] = useState<JourneySelectValue>('auto');
  const [journeySuggested, setJourneySuggested] = useState<{
    key: EnquiryJourneyStatus;
    label: string;
    color: EnquiryStatusChipColor;
  } | null>(null);
  const journeyPromiseRef = useRef<{
    resolve: (v: 'cancel' | { override: EnquiryJourneyStatus | null }) => void;
  } | null>(null);
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
  
  // Load selectedRoles from localStorage or use defaults
  const getInitialSelectedRoles = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('enquiryStaffRoles');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved roles:', e);
        }
      }
    }
    return { ...DEFAULT_ENQUIRY_STAFF_ROLES };
  };
  
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>(getInitialSelectedRoles());
  // Load shared role config so staff users see the same exact dropdown setup as admin.
  useEffect(() => {
    const loadSharedRoleConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'appSettings', 'enquiryStaffRoles'));
        if (!snap.exists()) return;
        const data = snap.data() as { roles?: unknown };
        const normalized = normalizeEnquiryStaffRoleConfig(data?.roles);
        setSelectedRoles(normalized);
        if (typeof window !== 'undefined') {
          localStorage.setItem('enquiryStaffRoles', JSON.stringify(normalized));
        }
      } catch (e) {
        // Firestore read can be rule-limited for some users; localStorage/default remains fallback.
        console.warn('Failed to load shared enquiry staff roles:', e);
      }
    };
    void loadSharedRoleConfig();
  }, []);

  const [currentField, setCurrentField] = useState<keyof typeof selectedRoles>('telecaller');
  const [products, setProducts] = useState<any[]>([]);
  const [hearingAidProducts, setHearingAidProducts] = useState<Product[]>([]);
  /** Product catalog picker (trial / booking) */
  const [hearingAidCatalogDialogOpen, setHearingAidCatalogDialogOpen] = useState(false);
  const [draftCatalogProductIds, setDraftCatalogProductIds] = useState<string[]>([]);
  const [catalogDialogSearch, setCatalogDialogSearch] = useState('');
  const [catalogDialogBrandFilter, setCatalogDialogBrandFilter] = useState('');
  /** Trial visits: only one catalog hearing aid */
  const [catalogDialogSingleProduct, setCatalogDialogSingleProduct] = useState(false);
  /** Which flow opened the catalog (drives single vs multi and copy) */
  const [catalogPickerIntent, setCatalogPickerIntent] = useState<'trial' | 'booking'>('trial');
  const deferredCatalogSearch = useDeferredValue(catalogDialogSearch);
  const isCatalogSearchPending = catalogDialogSearch !== deferredCatalogSearch;
  const [centers, setCenters] = useState<any[]>([]);
  const [currentProduct, setCurrentProduct] = useState({
    inventoryId: '',
    productId: '',
    name: '',
    hsnCode: '',
    serialNumber: '',
    unit: 'piece' as 'piece' | 'pair' | 'quantity',
    quantity: 1,
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

  /** Hearing-aid sale line: mirror manual Sales & Invoicing pair / single serial entry. */
  const [salePairSaleMode, setSalePairSaleMode] = useState<'single' | 'pair'>('pair');
  const [saleSerialPrimary, setSaleSerialPrimary] = useState('');
  const [saleSerialSecondary, setSaleSerialSecondary] = useState('');
  /** When selling one device from a bonded pair row, both serials — user picks which to sell. */
  const [salePairSerialOptions, setSalePairSerialOptions] = useState<[string, string] | null>(null);

  const [currentPayment, setCurrentPayment] = useState<{
    paymentDate: string;
    amount: number;
    paymentFor: PaymentRecord['paymentFor'];
    paymentMode: PaymentRecord['paymentMode'];
    referenceNumber: string;
    remarks: string;
    relatedVisitId?: string;
  }>({
    paymentDate: new Date().toISOString().split('T')[0],
    amount: 0,
    paymentFor: 'full_payment',
    paymentMode: 'Cash',
    referenceNumber: '',
    remarks: '',
    relatedVisitId: undefined,
  });



  // Selling price is the source of truth; discount % is derived from MRP vs selling (GST from selling).
  useEffect(() => {
    if (currentProduct.mrp > 0) {
      const selling = roundInrRupee(currentProduct.sellingPrice);
      const discountAmount = roundInrRupee(Math.max(0, currentProduct.mrp - selling));
      const discountPercent = roundDiscountPercent((discountAmount / currentProduct.mrp) * 100);
      const gstAmount = roundInrRupee((selling * currentProduct.gstPercent) / 100);
      const finalAmount = roundInrRupee(selling + gstAmount);

      setCurrentProduct((prev) => ({
        ...prev,
        discountAmount,
        discountPercent,
        gstAmount,
        finalAmount,
      }));
    }
  }, [currentProduct.mrp, currentProduct.sellingPrice, currentProduct.gstPercent]);

  const updateSellingPrice = (newSellingPrice: number) => {
    const sp = roundInrRupee(newSellingPrice);
    setCurrentProduct((prev) => ({ ...prev, sellingPrice: sp }));
  };

  const handleSalePairSaleModeChange = useCallback(
    (_: React.SyntheticEvent, value: 'single' | 'pair' | null) => {
      if (value == null) return;
      const master = currentProduct.productId
        ? hearingAidProducts.find((p) => p.id === currentProduct.productId)
        : undefined;
      const isPair =
        (master?.quantityType ?? (master as { quantityTypeLegacy?: string } | undefined)?.quantityTypeLegacy) ===
        'pair';

      setSalePairSaleMode(value);

      if (!isPair || !master) return;

      const catalogMrp = roundInrRupee(Number(master.mrp) || 0);
      const nextMrp = value === 'pair' ? catalogMrp : roundInrRupee(catalogMrp / 2);

      if (value === 'single' && salePairSaleMode === 'pair' && saleSerialPrimary.trim() && saleSerialSecondary.trim()) {
        setSalePairSerialOptions([saleSerialPrimary.trim(), saleSerialSecondary.trim()]);
        setSaleSerialSecondary('');
        setCurrentProduct((prev) => {
          const gstPct = prev.gstPercent;
          const gstAmount = gstPct > 0 ? roundInrRupee((nextMrp * gstPct) / 100) : 0;
          return {
            ...prev,
            mrp: nextMrp,
            sellingPrice: nextMrp,
            serialNumber: saleSerialPrimary.trim(),
            unit: 'piece',
            gstAmount,
            finalAmount: roundInrRupee(nextMrp + gstAmount),
          };
        });
        return;
      }

      if (value === 'pair' && salePairSaleMode === 'single' && salePairSerialOptions) {
        const [a, b] = salePairSerialOptions;
        setSaleSerialPrimary(a);
        setSaleSerialSecondary(b);
        setSalePairSerialOptions(null);
        setCurrentProduct((prev) => {
          const gstPct = prev.gstPercent;
          const gstAmount = gstPct > 0 ? roundInrRupee((nextMrp * gstPct) / 100) : 0;
          return {
            ...prev,
            mrp: nextMrp,
            sellingPrice: nextMrp,
            serialNumber: `${a}, ${b}`,
            unit: 'pair',
            gstAmount,
            finalAmount: roundInrRupee(nextMrp + gstAmount),
          };
        });
        return;
      }

      setCurrentProduct((prev) => {
        const gstPct = prev.gstPercent;
        const gstAmount = gstPct > 0 ? roundInrRupee((nextMrp * gstPct) / 100) : 0;
        return {
          ...prev,
          mrp: nextMrp,
          sellingPrice: nextMrp,
          gstAmount,
          finalAmount: roundInrRupee(nextMrp + gstAmount),
        };
      });
    },
    [
      currentProduct.productId,
      hearingAidProducts,
      salePairSaleMode,
      saleSerialPrimary,
      saleSerialSecondary,
      salePairSerialOptions,
    ]
  );

  // React Hook Form setup
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid, isSubmitting: formSubmitting },
    reset
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      customerName: '',
      customerGstNumber: '',
      phone: '',
      email: '',
      address: '',
      reference: [],
      followUpDate: '',
      assignedTo: '',
      telecaller: '',
      center: '',
      message: '',
      leadOutcome: '',
      hotEnquiry: false,
      visits: [],
      followUps: [],
      payments: []
    }
  });

  // Watch specific fields
  const watchedVisits = watch('visits');
  const currentVisit = watchedVisits[activeVisit];
  const selectedCenter = watch('center');
  const watchedTelecaller = watch('telecaller');
  const watchedAssignedTo = watch('assignedTo');
  const watchedFollowUps = watch('followUps');
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
  /** Preview quantity for sale line (serialized stock = 1 unit per row). */
  const saleLineQtyPreview = (() => {
    const master = getProductById(currentProduct.productId);
    const isPair =
      (master?.quantityType ?? (master as { quantityTypeLegacy?: string } | undefined)?.quantityTypeLegacy) === 'pair';
    if (isPair) {
      if (salePairSaleMode === 'pair') {
        return saleSerialPrimary.trim() && saleSerialSecondary.trim()
          ? 1
          : hearingAidLineQty({ quantity: currentProduct.quantity });
      }
      return saleSerialPrimary.trim() || currentProduct.serialNumber?.trim()
        ? 1
        : hearingAidLineQty({ quantity: currentProduct.quantity });
    }
    return currentProduct.serialNumber?.trim().length
      ? 1
      : hearingAidLineQty({ quantity: currentProduct.quantity });
  })();

  const saleLinePairMaster = getProductById(currentProduct.productId);
  const saleLineIsPairProduct =
    (saleLinePairMaster?.quantityType ??
      (saleLinePairMaster as { quantityTypeLegacy?: string } | undefined)?.quantityTypeLegacy) === 'pair';
  const saleLineSerialLocked = saleLineIsPairProduct
    ? salePairSaleMode === 'pair'
      ? !!(saleSerialPrimary.trim() && saleSerialSecondary.trim())
      : !!(saleSerialPrimary.trim() || currentProduct.serialNumber?.trim())
    : !!currentProduct.serialNumber?.trim();

  // When booking is linked to a trial, we lock device fields
  const isUsingTrialDevice = !!(
    currentVisit?.hearingAidBooked &&
    currentVisit?.bookingFromTrial &&
    (currentVisit?.bookingFromVisitId || currentVisit?.previousVisitId)
  );

  const trialOn = !!currentVisit?.hearingAidTrial;
  const bookingOn = !!(currentVisit?.hearingAidBooked && !currentVisit?.hearingAidSale);
  const showTrialDeviceCard = trialOn && !isUsingTrialDevice;
  const showBookingDeviceCard = bookingOn && !trialOn && !isUsingTrialDevice;
  const showLockedDeviceCard = isUsingTrialDevice;
  const showHearingAidJourneyBlock = trialOn || bookingOn;

  const catalogCompanyOptions = useMemo(
    () =>
      [...new Set(hearingAidProducts.map((p) => p.company).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b)
      ),
    [hearingAidProducts]
  );

  const catalogDialogFilteredProducts = useMemo(() => {
    const brandFiltered = !catalogDialogBrandFilter
      ? hearingAidProducts
      : hearingAidProducts.filter((p) => (p.company || '') === catalogDialogBrandFilter);
    const q = deferredCatalogSearch.toLowerCase();
    return brandFiltered.filter((p) => productMatchesCatalogSearch(p, q));
  }, [hearingAidProducts, catalogDialogBrandFilter, deferredCatalogSearch]);

  const draftCatalogProductsOrdered = useMemo(() => {
    const byId = new Map(hearingAidProducts.map((p) => [p.id, p]));
    return draftCatalogProductIds.map((id) => byId.get(id)).filter((x): x is Product => !!x);
  }, [draftCatalogProductIds, hearingAidProducts]);

  const catalogDialogOrphanSelected = useMemo(() => {
    const filteredIds = new Set(catalogDialogFilteredProducts.map((p) => p.id));
    return draftCatalogProductsOrdered.filter((p) => !filteredIds.has(p.id));
  }, [draftCatalogProductsOrdered, catalogDialogFilteredProducts]);

  const selectedCatalogProducts = useMemo(() => {
    if (!currentVisit) return [];
    const ids = (currentVisit.products || [])
      .filter((p) => p.productId && hearingAidProducts.some((hp) => hp.id === p.productId))
      .map((p) => p.productId as string);
    const byId = new Map(hearingAidProducts.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((x): x is Product => !!x);
  }, [currentVisit, hearingAidProducts]);

  const watchName = watch('name');
  const watchCustomerName = watch('customerName');
  const watchPhone = watch('phone');
  const watchReference = watch('reference');

  // Check if step 0 is valid (must match submit validation: center + reference required)
  const phoneStepOk = isAudiologist || normalizeEnquiryPhone(watchPhone).length === 10;
  const isStep0Valid =
    watchName?.trim().length > 0 &&
    phoneStepOk &&
    selectedCenter != null &&
    String(selectedCenter).trim().length > 0 &&
    Array.isArray(watchReference) &&
    watchReference.length > 0;

  // Fetch products from Firebase
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const productsData: any[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const gstApplicable = !!data.gstApplicable;
          const rawPct = data.gstPercentage;
          const gstPercentage =
            rawPct !== undefined && rawPct !== null && Number.isFinite(Number(rawPct))
              ? Number(rawPct)
              : gstApplicable
                ? 18
                : 0;
          productsData.push({
            id: doc.id,
            name: data.name,
            type: data.type,
            company: data.company || '',
            mrp: data.mrp || 0,
            isFreeOfCost: data.isFreeOfCost || false,
            hasSerialNumber: !!data.hasSerialNumber,
            gstApplicable,
            gstPercentage,
            hsnCode: data.hsnCode || '',
            quantityType: data.quantityType || 'piece'
          });
        });
        setProducts(productsData);
        // Debug: Log accessory products to help troubleshoot
        const accessoryProducts = productsData.filter((p) => isAccessoryServiceProductType(p.type));
        console.log('🔄 Loaded accessory-service products:', accessoryProducts.length, 'available products:', accessoryProducts.map(p => `${p.name} (${p.type})`));
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

  // Fetch staff members (client Firestore + server fallback so staff-role users get full lists under strict rules)
  useEffect(() => {
    const fetchStaffMembers = async () => {
      try {
        const records = await fetchStaffRecordsWithServerFallback();
        const staffList: StaffMember[] = records.map((r) => ({
          id: r.id,
          name: r.name,
          jobRole: r.jobRole,
          status: ((r.status || 'active') === 'inactive' ? 'inactive' : 'active') as
            | 'active'
            | 'inactive',
        }));

        setStaffMembers(staffList);

        const groupedByRole: Record<string, StaffMember[]> = {};
        JOB_ROLES.forEach((role) => {
          groupedByRole[role] = staffList.filter((staff) => staff.jobRole === role);
        });
        setStaffByRole(groupedByRole);
      } catch (error) {
        console.error('Error fetching staff members:', error);
      }
    };

    void fetchStaffMembers();
  }, []);

  // Staff dropdowns: real Firestore staff first; merge saved enquiry/form names so values stay visible for staff users if the list query was empty.
  const getStaffOptionsForField = useCallback(
    (fieldName: keyof typeof selectedRoles): string[] => {
      const allowedRoles = selectedRoles[fieldName] || [];
      const staffForField: string[] = [];

      allowedRoles.forEach((role) => {
        const staffInRole = staffByRole[role] || [];
        staffInRole.forEach((staff) => {
          if (staff.name && !staffForField.includes(staff.name)) {
            staffForField.push(staff.name);
          }
        });
      });

      if (
        fieldName === 'telecaller' &&
        staffForField.length === 0 &&
        staffMembers.length > 0
      ) {
        staffMembers.forEach((staff) => {
          if (staff.name && !staffForField.includes(staff.name)) {
            staffForField.push(staff.name);
          }
        });
        staffForField.sort((a, b) => a.localeCompare(b));
      }

      const extras: (string | undefined | null)[] = [];
      const enqVisits = enquiry?.visits || enquiry?.visitSchedules || [];
      if (fieldName === 'telecaller') {
        const dn = userProfile?.displayName?.trim();
        if (dn && !isGenericLoginDisplayName(dn)) extras.push(dn);
        extras.push(watchedTelecaller, enquiry?.telecaller);
        (watchedFollowUps || []).forEach((f) => extras.push(f.callerName));
        (enquiry?.followUps || []).forEach((f: { callerName?: string }) => extras.push(f.callerName));
      } else if (fieldName === 'assignedTo') {
        extras.push(watchedAssignedTo, enquiry?.assignedTo);
      } else if (fieldName === 'testBy') {
        (watchedVisits || []).forEach((v) => extras.push(v.testDoneBy));
        enqVisits.forEach((v: { testDoneBy?: string }) => extras.push(v.testDoneBy));
      } else if (fieldName === 'programmingBy') {
        (watchedVisits || []).forEach((v) => extras.push(v.programmingDoneBy));
        enqVisits.forEach((v: { programmingDoneBy?: string }) => extras.push(v.programmingDoneBy));
      }
      // Who Sold (sales): options must be staff only. Do not merge visit.hearingAidBrand — that is
      // often the device manufacturer (Signia, Phonak) on trial/booking, not a salesperson.

      const merged: string[] = [];
      const seen = new Set<string>();
      const push = (s: string | undefined | null) => {
        const t = String(s || '').trim();
        if (t && !seen.has(t)) {
          seen.add(t);
          merged.push(t);
        }
      };
      extras.forEach((s) => push(s));
      staffForField.forEach((s) => push(s));

      if (merged.length > 0) return merged;
      if (fieldName === 'telecaller') {
        const dn = userProfile?.displayName?.trim();
        if (dn && !isGenericLoginDisplayName(dn)) return [dn];
        return [];
      }
      // Avoid stale hardcoded names; prefer actual staff roster.
      const fromRoster = Array.from(
        new Set(staffMembers.map((s) => String(s.name || '').trim()).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));
      return fromRoster;
    },
    [
      staffByRole,
      staffMembers,
      selectedRoles,
      watchedTelecaller,
      watchedAssignedTo,
      watchedFollowUps,
      watchedVisits,
      enquiry,
      userProfile?.displayName,
      staffMembers,
    ]
  );

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
  const [inventoryPickerMode, setInventoryPickerMode] = useState<'hearing_device' | 'accessory'>(
    'hearing_device'
  );

  const hearingDeviceInventory = useMemo(
    () => availableInventory.filter((it) => isHearingDeviceInventoryItem(it)),
    [availableInventory]
  );
  const accessoryInventory = useMemo(
    () => availableInventory.filter((it) => isAccessoryInventoryItem(it)),
    [availableInventory]
  );

  /** When a pair product is selected on the sale line, filter stock rows to pair-only or single-serial-only. */
  const hearingDeviceInventoryForPicker = useMemo(() => {
    const master = currentProduct.productId
      ? hearingAidProducts.find((p) => p.id === currentProduct.productId)
      : undefined;
    const isPair = (master?.quantityType ?? (master as { quantityTypeLegacy?: string } | undefined)?.quantityTypeLegacy) === 'pair';
    if (!currentProduct.productId || !isPair) return hearingDeviceInventory;
    if (salePairSaleMode === 'pair') {
      return hearingDeviceInventory.filter((it) => (it.serialNumbers?.length ?? 0) === 2);
    }
    // Sell 1 device: show bonded pairs (pick which serial) and orphan single-serial rows
    return hearingDeviceInventory.filter((it) => {
      const n = it.serialNumbers?.length ?? 0;
      if (n === 2 || n === 1) return true;
      if (it.serialNumber && String(it.serialNumber).trim() && n === 0) return true;
      return false;
    });
  }, [hearingDeviceInventory, currentProduct.productId, hearingAidProducts, salePairSaleMode]);

  const inventoryPickerItems = useMemo((): EnquiryInventoryRow[] => {
    if (inventoryPickerMode === 'accessory') return accessoryInventory as EnquiryInventoryRow[];
    const visit = watchedVisits[activeVisit];
    if (visit?.hearingAidSale) return hearingDeviceInventoryForPicker as EnquiryInventoryRow[];
    return hearingDeviceInventory as EnquiryInventoryRow[];
  }, [
    inventoryPickerMode,
    accessoryInventory,
    hearingDeviceInventory,
    hearingDeviceInventoryForPicker,
    watchedVisits,
    activeVisit,
  ]);

  /** Serials already on committed sale lines (productId|serial) — highlight in stock picker to avoid duplicates. */
  const saleVisitReservedSerialKeys = useMemo(() => {
    const set = new Set<string>();
    const visit = watchedVisits[activeVisit];
    if (!visit?.hearingAidSale || !Array.isArray(visit.products)) return set;
    for (const p of visit.products as HearingAidProduct[]) {
      const pid = String(p.productId || '').trim();
      if (!pid) continue;
      splitSerialStringIntoTokens(p.serialNumber).forEach((sn) => {
        if (sn) set.add(`${pid}|${sn}`);
      });
    }
    return set;
  }, [watchedVisits, activeVisit]);

  // Sales return states
  const [previousSales, setPreviousSales] = useState<any[]>([]);
  const [serialSelectionMode, setSerialSelectionMode] = useState<'dropdown' | 'manual'>('dropdown');
  
  // Function to fetch available inventory (center-aware)
  const fetchAvailableInventory = async () => {
      try {
        console.log('🔍 Starting inventory fetch for hearing aids...');
        console.log('📦 Using same logic as material-out to calculate inventory...');
        
        // Get head office ID for backward compatibility
        const headOfficeId = await getHeadOfficeId();
        
        // Get data from multiple collections (same as material-out page)
        const [productsSnap, materialInSnap, purchasesSnap, materialsOutSnap, salesSnap, enquiriesSnap, centersSnap] =
          await Promise.all([
            getDocs(collection(db, 'products')),
            getDocs(collection(db, 'materialInward')),
            getDocs(collection(db, 'purchases')),
            getDocs(collection(db, 'materialsOut')),
            getDocs(collection(db, 'sales')),
            getDocs(collection(db, 'enquiries')),
            getDocs(collection(db, 'centers')),
          ]);

        console.log(
          `📊 Found ${productsSnap.docs.length} products, ${materialInSnap.docs.length} material-in, ${purchasesSnap.docs.length} purchases, ${materialsOutSnap.docs.length} materials-out, ${salesSnap.docs.length} sales, ${enquiriesSnap.docs.length} enquiries, ${centersSnap.docs.length} centers`
        );

        const centerNameById: Record<string, string> = {};
        centersSnap.docs.forEach((d) => {
          const x = d.data() as Record<string, unknown>;
          const nm = String(x.name ?? x.displayName ?? x.centerName ?? '').trim();
          centerNameById[d.id] = nm || d.id;
        });

        const prodMap: Record<string, any> = {};
        productsSnap.docs.forEach(d => { prodMap[d.id] = { id: d.id, ...(d.data() as any) }; });

        // Per center (locationId = Firestore `centers` doc id) — matches inventory, fixes labels vs raw ids
        const serialsByProductLoc: Record<string, Set<string>> = {};
        const qtyByProductLoc: Record<string, number> = {};
        /** Pair bonds from each inbound line (same order as material-in / purchase), per product+location. */
        const inboundPairsByPlKey: Record<string, [string, string][]> = {};
        /**
         * Serials received via "Stock Transfer from ..." materialInward docs, keyed by
         * makeProductLocationKey(productId, destinationLocationId).
         * Used to detect same-center intercompany transfers: if a stock-transfer-out materialOut
         * doc at location X tries to remove a serial that was ALSO received at location X via a
         * stock-transfer-in, that means it's a same-center transfer and we must NOT subtract the
         * serial (it stays available at that location).
         */
        const stockTransferInSerialsByLoc: Record<string, Set<string>> = {};

        const addSerials = (productId: string, locationId: string, serials: string[]) => {
          const k = makeProductLocationKey(productId, locationId);
          if (!serialsByProductLoc[k]) serialsByProductLoc[k] = new Set<string>();
          serials.forEach((sn) => sn && serialsByProductLoc[k].add(String(sn)));
        };
        const addQty = (productId: string, locationId: string, q: number) => {
          const k = makeProductLocationKey(productId, locationId);
          const n = Number(q);
          if (isNaN(n) || n === 0) return;
          qtyByProductLoc[k] = (qtyByProductLoc[k] || 0) + n;
        };

        const addInbound = (docs: any[], checkStockTransferIn = false) => {
          docs.forEach(docSnap => {
            const data: any = docSnap.data();
            
            // Handle location filtering with backward compatibility
            const dataLocation = data.location || headOfficeId; // Default to head office if no location specified
            
            // Filter by location if a center is selected
            if (selectedCenter && dataLocation !== selectedCenter) {
              return; // Skip this document if it's not at the selected center
            }

            // Identify stock-transfer-in materialInward docs (supplier name set by createInventoryMovements)
            const supplierName = checkStockTransferIn
              ? String((data.supplier as { name?: string } | undefined)?.name || '')
              : '';
            const isTransferIn = checkStockTransferIn && supplierName.includes('Stock Transfer from');
            
            (data.products || []).forEach((p: any) => {
              const productId = p.productId || p.id;
              if (!productId) return;
              const locId = String(dataLocation || headOfficeId);
              const plKey = makeProductLocationKey(productId, locId);
              const serialArray = serialsFromLineProduct(p);
              if (serialArray.length > 0) {
                addSerials(productId, locId, serialArray);

                // Track which serials arrived via stock-transfer-in at this destination location.
                // This is used later to skip incorrect removals for same-center intercompany transfers.
                if (isTransferIn) {
                  if (!stockTransferInSerialsByLoc[plKey]) stockTransferInSerialsByLoc[plKey] = new Set<string>();
                  serialArray.forEach((sn) => sn && stockTransferInSerialsByLoc[plKey].add(String(sn)));
                }

                const prodRef = prodMap[productId] || {};
                const isPairProduct =
                  (prodRef.quantityType || prodRef.quantityTypeLegacy) === 'pair';
                if (isPairProduct && serialArray.length >= 2) {
                  if (!inboundPairsByPlKey[plKey]) inboundPairsByPlKey[plKey] = [];
                  for (let i = 0; i + 1 < serialArray.length; i += 2) {
                    const a = String(serialArray[i] || '').trim();
                    const b = String(serialArray[i + 1] || '').trim();
                    if (a && b) inboundPairsByPlKey[plKey].push([a, b]);
                  }
                }
              } else {
                const q = Number(p.quantity ?? p.qty ?? 0);
                addQty(productId, locId, isNaN(q) ? 0 : q);
              }
            });
          });
        };

        // Pass checkStockTransferIn=true only for materialInward (purchases are never stock transfers)
        addInbound(materialInSnap.docs, true);
        addInbound(purchasesSnap.docs, false);

        // Subtract outflows from materialsOut
        materialsOutSnap.docs.forEach(d => {
          const data: any = d.data();
          
          // Handle location filtering with backward compatibility
          const dataLocation = data.location || headOfficeId; // Default to head office if no location specified
          
          // Filter by location if a center is selected
          if (selectedCenter && dataLocation !== selectedCenter) {
            return; // Skip this document if it's not at the selected center
          }

          // Detect stock-transfer-out docs (recipient name set by createInventoryMovements)
          const recipientName = String((data.recipient as { name?: string } | undefined)?.name || '');
          const isTransferOut = recipientName.includes('Stock Transfer to');
          
          (data.products || []).forEach((p: any) => {
            const productId = p.productId || p.id;
            if (!productId) return;
            const locId = String(dataLocation || headOfficeId);
            const key = makeProductLocationKey(productId, locId);
            const serialArray = serialsFromLineProduct(p);
            if (serialArray.length > 0) {
              const set = serialsByProductLoc[key];
              if (set) {
                const transferInAtSameLoc = stockTransferInSerialsByLoc[key];
                serialArray.forEach((sn) => {
                  if (!sn) return;
                  // For stock-transfer-out docs: if the serial was received at THIS SAME location
                  // via a stock-transfer-in (same-center intercompany transfer), keep it available.
                  if (isTransferOut && transferInAtSameLoc?.has(String(sn))) return;
                  if (set.has(String(sn))) set.delete(String(sn));
                });
              }
            } else {
              const q = Number(p.quantity ?? 0);
              if (qtyByProductLoc[key] != null) {
                qtyByProductLoc[key] = Math.max(0, qtyByProductLoc[key] - (isNaN(q) ? 0 : q));
              }
            }
          });
        });

        // Align with inventory page: remove serials / qty already sold (sales + enquiry visits)
        applySalesCollectionToAvailabilityMaps(salesSnap.docs, serialsByProductLoc, qtyByProductLoc);
        applyEnquiryVisitsSalesToAvailabilityMaps(enquiriesSnap.docs, serialsByProductLoc, qtyByProductLoc);

        // Flatten to items array (real per-center location + resolved center name)
        const items: EnquiryInventoryRow[] = [];
        const pushSerialRow = (args: {
          id: string;
          serialNumber: string;
          serialNumbers?: string[];
          isPairRow?: boolean;
          quantityType?: 'piece' | 'pair';
          productId: string;
          locationId: string;
          prod: Record<string, unknown>;
          locLabel: string;
        }) => {
          const gstRow = gstFieldsForInventoryRowFromProd(
            args.prod as Parameters<typeof gstFieldsForInventoryRowFromProd>[0]
          );
          items.push({
            id: args.id,
            productId: args.productId,
            productName: String(args.prod.name || 'Product'),
            name: String(args.prod.name || 'Product'),
            type: String(args.prod.type || ''),
            company: String(args.prod.company || ''),
            serialNumber: args.serialNumber,
            serialNumbers: args.serialNumbers,
            isPairRow: args.isPairRow,
            quantityType: args.quantityType,
            isSerialTracked: true,
            mrp: Number(args.prod.mrp) || 0,
            dealerPrice: Number(args.prod.dealerPrice) || 0,
            gstApplicable: gstRow.gstApplicable,
            gstPercentage: gstRow.gstPercentage,
            gstType: String(args.prod.gstType || 'IGST'),
            status: 'In Stock',
            location: args.locLabel,
            locationId: args.locationId,
            hsnCode: String(args.prod.hsnCode || ''),
            productHasSerialNumber: !!args.prod.hasSerialNumber,
          });
        };

        Object.entries(serialsByProductLoc).forEach(([plKey, set]) => {
          const { productId, locationId } = splitProductLocationKey(plKey);
          const prod = prodMap[productId] || {};
          const locLabel = centerNameById[locationId] || locationId;
          const isPairProduct = (prod.quantityType || prod.quantityTypeLegacy) === 'pair';

          if (!isPairProduct) {
            Array.from(set).forEach((sn) => {
              pushSerialRow({
                id: `${productId}-${sn}-${locationId}`,
                productId,
                locationId,
                prod,
                locLabel,
                serialNumber: sn,
                serialNumbers: [sn],
                isPairRow: false,
                quantityType: 'piece',
              });
            });
            return;
          }

          const available = new Set(set);
          const consumed = new Set<string>();
          const inboundPairs = inboundPairsByPlKey[plKey] || [];

          for (const [a, b] of inboundPairs) {
            if (
              a &&
              b &&
              available.has(a) &&
              available.has(b) &&
              !consumed.has(a) &&
              !consumed.has(b)
            ) {
              pushSerialRow({
                id: `${productId}-${a}-${b}-${locationId}`,
                productId,
                locationId,
                prod,
                locLabel,
                serialNumber: `${a}, ${b}`,
                serialNumbers: [a, b],
                isPairRow: true,
                quantityType: 'pair',
              });
              consumed.add(a);
              consumed.add(b);
            }
          }

          const remaining = Array.from(available)
            .filter((sn) => !consumed.has(sn))
            .sort((x, y) => x.localeCompare(y));
          for (let i = 0; i < remaining.length; i += 2) {
            const a = remaining[i];
            const b = remaining[i + 1];
            if (b !== undefined) {
              pushSerialRow({
                id: `${productId}-${a}-${b}-${locationId}-fb`,
                productId,
                locationId,
                prod,
                locLabel,
                serialNumber: `${a}, ${b}`,
                serialNumbers: [a, b],
                isPairRow: true,
                quantityType: 'pair',
              });
            } else {
              pushSerialRow({
                id: `${productId}-${a}-${locationId}-single`,
                productId,
                locationId,
                prod,
                locLabel,
                serialNumber: a,
                serialNumbers: [a],
                isPairRow: false,
                quantityType: 'pair',
              });
            }
          }
        });
        
        Object.entries(qtyByProductLoc).forEach(([plKey, qty]) => {
          if (qty > 0) {
            const { productId, locationId } = splitProductLocationKey(plKey);
            const prod = prodMap[productId] || {};
            const gstRow = gstFieldsForInventoryRowFromProd(prod);
            const locLabel = centerNameById[locationId] || locationId;
            items.push({
              id: `${productId}-qty-${locationId}`,
              productId,
              productName: prod.name || 'Product',
              name: prod.name || 'Product', // Alias for compatibility
              type: prod.type || '',
              company: prod.company || '',
              isSerialTracked: false,
              quantity: qty,
              mrp: Number(prod.mrp) || 0,
              dealerPrice: Number(prod.dealerPrice) || 0,
              gstApplicable: gstRow.gstApplicable,
              gstPercentage: gstRow.gstPercentage,
              gstType: prod.gstType || 'IGST',
              status: 'In Stock',
              location: locLabel,
              locationId,
              hsnCode: prod.hsnCode || '',
              productHasSerialNumber: !!prod.hasSerialNumber,
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
        const visitSource = Array.isArray(enquiry.visitSchedules) && enquiry.visitSchedules.length > 0
          ? enquiry.visitSchedules
          : (Array.isArray(enquiry.visits) ? enquiry.visits : []);
        const visits = visitSource.map((visit: any, index: number) => {
          const savedFlat = enquiry.visits?.[index] ?? {};
          const medicalServices = Array.isArray(visit?.medicalServices) ? visit.medicalServices : [];
          const had = visit?.hearingAidDetails || {};
          const nestedAccessoryDetails = visit?.accessoryDetails || {};
          const nestedProgrammingDetails = visit?.programmingDetails || {};
          const mergedVisit = {
            ...visit,
            ...savedFlat,
          };
          const isBookingService =
            medicalServices.includes('hearing_aid_booked') ||
            Boolean(mergedVisit.hearingAidBooked);
          const isSaleService =
            medicalServices.includes('hearing_aid_sale') ||
            medicalServices.includes('hearing_aid') ||
            Boolean(mergedVisit.hearingAidSale) ||
            mergedVisit.hearingAidStatus === 'sold';
          const allowBookingFallbackFromSaleTotals = isBookingService && !isSaleService;
          const normalizedItems = normalizeSalesReturnItemsFromSaved(savedFlat, had);
          const persistedSerial = String(
            savedFlat?.returnSerialNumber ?? had.returnSerialNumber ?? ''
          ).trim();
          const serialStr =
            persistedSerial || linesToLegacyReturnSerialString(normalizedItems);

          return {
          id: visit.id || savedFlat?.id || (index + 1).toString(),
          visitDate: visit.visitDate || savedFlat?.visitDate || '',
          visitTime: visit.visitTime || savedFlat?.visitTime || '',
          visitType: visit.visitType || savedFlat?.visitType || 'center',
          homeVisitCharges: Math.max(
            0,
            Number(visit.homeVisitCharges ?? savedFlat?.homeVisitCharges) || 0
          ),
          visitNotes: visit.notes || savedFlat?.visitNotes || '',
          hearingTest: medicalServices.includes('hearing_test') || Boolean(mergedVisit.hearingTest),
          hearingAidTrial: medicalServices.includes('hearing_aid_trial') || Boolean(mergedVisit.hearingAidTrial || mergedVisit.trialGiven),
          hearingAidBooked: medicalServices.includes('hearing_aid_booked') || Boolean(mergedVisit.hearingAidBooked),
          hearingAidSale:
            medicalServices.includes('hearing_aid_sale') ||
            medicalServices.includes('hearing_aid') ||
            Boolean(mergedVisit.hearingAidSale || mergedVisit.purchaseFromTrial || mergedVisit.hearingAidStatus === 'sold'),
          accessory: medicalServices.includes('accessory') || Boolean(mergedVisit.accessory),
          programming: medicalServices.includes('programming') || Boolean(mergedVisit.programming),
          repair: medicalServices.includes('repair') || Boolean(mergedVisit.repair),
          counselling: medicalServices.includes('counselling') || Boolean(mergedVisit.counselling),
          entService: medicalServices.includes('ent_service') || Boolean(mergedVisit.entService),
          ...(() => {
            const entProcedureEntries = normalizeEntProcedureEntriesFromSavedVisit(mergedVisit);
            const ep = sumEntProcedurePrices({
              entServiceDetails: {
                entProcedureEntries,
                totalPrice: visit.entServiceDetails?.totalPrice ?? mergedVisit.entServicePrice,
              },
              entServicePrice: mergedVisit.entServicePrice,
            });
            return {
              entProcedureEntries,
              entProcedureDoneBy: visit.entServiceDetails?.doneBy || mergedVisit.entProcedureDoneBy || '',
              entServicePrice: ep,
            };
          })(),
          ...(() => {
            const hearingTestEntries = normalizeHearingTestEntriesFromSavedVisit(mergedVisit);
            const line = hearingTestEntries.map((x) => x.testType).filter(Boolean).join(', ');
            const tp = sumHearingTestEntryPrices({
              hearingTestDetails: {
                hearingTestEntries,
                testPrice: visit.hearingTestDetails?.testPrice ?? mergedVisit.testPrice,
              },
              testPrice: mergedVisit.testPrice,
            });
            return {
              hearingTestEntries,
              testType: line || visit.hearingTestDetails?.testType || mergedVisit.testType || '',
              testPrice: tp,
            };
          })(),
          testDoneBy: visit.hearingTestDetails?.testDoneBy || mergedVisit.testDoneBy || '',
          testResults: visit.hearingTestDetails?.testResults || mergedVisit.testResults || '',
          recommendations: visit.hearingTestDetails?.recommendations || mergedVisit.recommendations || '',
          audiogramData: visit.hearingTestDetails?.audiogramData ?? mergedVisit.audiogramData ?? undefined,
          externalPtaReport:
            visit.hearingTestDetails?.externalPtaReport || visit.externalPtaReport || mergedVisit.externalPtaReport || undefined,
          hearingAidType: visit.hearingAidDetails?.hearingAidSuggested || mergedVisit.hearingAidType || '',
          hearingAidBrand: visit.hearingAidDetails?.whoSold || mergedVisit.hearingAidBrand || '',
          hearingAidModel: visit.hearingAidDetails?.quotation || mergedVisit.hearingAidModel || '',
          hearingAidPrice: visit.hearingAidDetails?.bookingAmount || mergedVisit.hearingAidPrice || 0,
          warranty: visit.hearingAidDetails?.trialPeriod || mergedVisit.warranty || '',
          whichEar: visit.hearingAidDetails?.whichEar || mergedVisit.whichEar || 'both',
          hearingAidStatus: visit.hearingAidDetails?.hearingAidStatus || mergedVisit.hearingAidStatus || 'booked',
          // Journey tracking fields
          hearingAidJourneyId: visit.hearingAidDetails?.hearingAidJourneyId || mergedVisit.hearingAidJourneyId || '',
          previousVisitId: visit.hearingAidDetails?.previousVisitId || mergedVisit.previousVisitId || '',
          nextVisitId: visit.hearingAidDetails?.nextVisitId || mergedVisit.nextVisitId || '',
          journeyStage: visit.hearingAidDetails?.journeyStage || mergedVisit.journeyStage || 'initial',
          // Trial related fields
          trialGiven: visit.hearingAidDetails?.trialGiven || Boolean(mergedVisit.trialGiven),
          trialDuration: visit.hearingAidDetails?.trialDuration || mergedVisit.trialDuration || 7,
          trialStartDate: visit.hearingAidDetails?.trialStartDate || mergedVisit.trialStartDate || '',
          trialEndDate: visit.hearingAidDetails?.trialEndDate || mergedVisit.trialEndDate || '',
          trialHearingAidBrand: visit.hearingAidDetails?.trialHearingAidBrand || mergedVisit.trialHearingAidBrand || '',
          trialHearingAidModel: visit.hearingAidDetails?.trialHearingAidModel || mergedVisit.trialHearingAidModel || '',
          trialHearingAidType: visit.hearingAidDetails?.trialHearingAidType || mergedVisit.trialHearingAidType || '',
          trialSerialNumber: visit.hearingAidDetails?.trialSerialNumber || mergedVisit.trialSerialNumber || '',
          trialHomeSecurityDepositAmount:
            Number(visit.hearingAidDetails?.trialHomeSecurityDepositAmount ?? mergedVisit.trialHomeSecurityDepositAmount) || 0,
          trialNotes: visit.hearingAidDetails?.trialNotes || mergedVisit.trialNotes || '',
          trialResult: visit.hearingAidDetails?.trialResult || mergedVisit.trialResult || 'ongoing',
          trialRefundAmount: Number(visit.hearingAidDetails?.trialRefundAmount ?? mergedVisit.trialRefundAmount) || 0,
          trialRefundDate: visit.hearingAidDetails?.trialRefundDate || mergedVisit.trialRefundDate || '',
          // Booking related fields
          bookingFromTrial: visit.hearingAidDetails?.bookingFromTrial || Boolean(mergedVisit.bookingFromTrial),
          bookingAdvanceAmount: visit.hearingAidDetails?.bookingAdvanceAmount || mergedVisit.bookingAdvanceAmount || 0,
          bookingDate: visit.hearingAidDetails?.bookingDate || mergedVisit.bookingDate || '',
          bookingFromVisitId: visit.hearingAidDetails?.bookingFromVisitId || mergedVisit.bookingFromVisitId || '',
          bookingSellingPrice:
            visit.hearingAidDetails?.bookingSellingPrice ||
            mergedVisit.bookingSellingPrice ||
            (allowBookingFallbackFromSaleTotals
              ? visit.hearingAidDetails?.grossSalesBeforeTax ?? mergedVisit.grossSalesBeforeTax
              : 0) ||
            0,
          bookingQuantity: visit.hearingAidDetails?.bookingQuantity || mergedVisit.bookingQuantity || 1,
          // Purchase related fields
          purchaseFromTrial: visit.hearingAidDetails?.purchaseFromTrial || Boolean(mergedVisit.purchaseFromTrial),
          purchaseDate: visit.hearingAidDetails?.purchaseDate || mergedVisit.purchaseDate || '',
          purchaseFromVisitId: visit.hearingAidDetails?.purchaseFromVisitId || mergedVisit.purchaseFromVisitId || '',
          accessoryName: nestedAccessoryDetails.accessoryName || mergedVisit.accessoryName || '',
          accessoryDetails:
            nestedAccessoryDetails.accessoryDetails ||
            (typeof mergedVisit.accessoryDetails === 'string' ? mergedVisit.accessoryDetails : '') ||
            '',
          accessoryFOC: nestedAccessoryDetails.accessoryFOC || Boolean(mergedVisit.accessoryFOC),
          accessoryAmount: nestedAccessoryDetails.accessoryAmount || mergedVisit.accessoryAmount || 0,
          accessoryQuantity: nestedAccessoryDetails.accessoryQuantity || mergedVisit.accessoryQuantity || 1,
          programmingReason: nestedProgrammingDetails.programmingReason || mergedVisit.programmingReason || '',
          hearingAidPurchaseDate: nestedProgrammingDetails.hearingAidPurchaseDate || mergedVisit.hearingAidPurchaseDate || '',
          hearingAidName: nestedProgrammingDetails.hearingAidName || mergedVisit.hearingAidName || '',
          underWarranty: nestedProgrammingDetails.underWarranty || Boolean(mergedVisit.underWarranty),
          programmingAmount: nestedProgrammingDetails.programmingAmount || mergedVisit.programmingAmount || 0,
          programmingDoneBy: nestedProgrammingDetails.programmingDoneBy || mergedVisit.programmingDoneBy || '',
          ...(() => {
            const raw = visit.hearingAidDetails?.products || mergedVisit.products || [];
            const products = raw.map((p: any) => ({
              ...p,
              quantity: hearingAidLineQty({ quantity: p.quantity }),
              discountPercent: roundDiscountPercent(Number(p.discountPercent) || 0),
            }));
            const t = sumHearingAidVisitTotals(products);
            return {
              products,
              grossMRP: t.grossMRP,
              grossSalesBeforeTax: t.grossSalesBeforeTax,
              taxAmount: t.taxAmount,
              salesAfterTax: t.salesAfterTax,
            };
          })(),
          totalDiscountPercent: visit.hearingAidDetails?.totalDiscountPercent || mergedVisit.totalDiscountPercent || 0,
          salesReturn:
            !!savedFlat?.salesReturn ||
            !!had.salesReturn ||
            medicalServices.includes('sales_return') ||
            false,
          salesReturnItems: normalizedItems,
          returnSerialNumber: serialStr,
          returnReason: savedFlat?.returnReason ?? had.returnReason ?? '',
          returnCondition: (savedFlat?.returnCondition ??
            had.returnCondition ??
            'good') as Visit['returnCondition'],
          returnPenaltyAmount:
            Number(savedFlat?.returnPenaltyAmount ?? had.returnPenaltyAmount) || 0,
          returnRefundAmount:
            Number(savedFlat?.returnRefundAmount ?? had.returnRefundAmount) || 0,
          returnOriginalSaleDate:
            savedFlat?.returnOriginalSaleDate ?? had.returnOriginalSaleDate ?? '',
          returnOriginalSaleVisitId:
            savedFlat?.returnOriginalSaleVisitId ?? had.returnOriginalSaleVisitId ?? '',
          returnNotes: savedFlat?.returnNotes ?? had.returnNotes ?? '',
          };
        });

        reset({
          name: enquiry.name || '',
          customerName: enquiry.customerName || '',
          customerGstNumber:
            enquiry.customerGstNumber || enquiry.customerGSTNumber || enquiry.customerGSTIN || '',
          phone: enquiry.phone || '',
          email: enquiry.email || '',
          address: enquiry.address || '',
          reference: Array.isArray(enquiry.reference)
            ? enquiry.reference
            : (enquiry.reference ? [enquiry.reference] : []),
          followUpDate: enquiry.followUpDate || enquiry.nextFollowUpDate || '',
          assignedTo: enquiry.assignedTo || '',
          telecaller: enquiry.telecaller || '',
          center: enquiry.center || '',
          message: enquiry.message || '',
          leadOutcome: enquiry.leadOutcome || '',
          hotEnquiry: enquiry.hotEnquiry === true,
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
        remarks: '',
        relatedVisitId: undefined,
      });
    }
  }, [open, isEditMode, enquiry?.id, reset]);

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

  const reconcileLinesWithProductMaster = useCallback((lines: HearingAidProduct[]): HearingAidProduct[] => {
    const byId = new Map(hearingAidProducts.map((p) => [p.id, p]));
    return lines.map((line) => {
      const master = line.productId ? byId.get(line.productId) : undefined;
      if (!master) return line;
      const { gstApplicable, gstPercent } = resolveGstFromProductMaster(master);
      const sellingPrice = roundInrRupee(line.sellingPrice);
      const gstAmount =
        gstPercent > 0 ? roundInrRupee((sellingPrice * gstPercent) / 100) : 0;
      const finalAmount = roundInrRupee(sellingPrice + gstAmount);
      return { ...line, sellingPrice, gstApplicable, gstPercent, gstAmount, finalAmount };
    });
  }, [hearingAidProducts]);

  const handleInventoryItemSelected = useCallback(
    (item: EnquiryInventoryRow) => {
      const visit = getValues('visits')[activeVisit];
      if (inventoryPickerMode === 'accessory') {
        const master = products.find((p) => p.id === item.productId);
        const name = master?.name || item.productName;
        const isFree = master?.mrp === 0 || master?.isFreeOfCost;
        updateVisitFields(activeVisit, {
          accessoryName: name,
          accessoryFOC: !!isFree,
          accessoryAmount: isFree ? 0 : roundInrRupee(item.mrp || master?.mrp || 0),
          accessoryQuantity: 1,
        });
        return;
      }
      if (visit?.hearingAidTrial && visit?.trialHearingAidType === 'home') {
        updateVisit(activeVisit, 'trialSerialNumber', item.serialNumber || '');
        updateVisit(activeVisit, 'trialHearingAidBrand', item.company || '');
        updateVisit(activeVisit, 'trialHearingAidModel', item.productName || '');
        return;
      }
      const { gstApplicable, gstPercent } = resolveGstFromProductMaster(item);
      const sns =
        item.serialNumbers && item.serialNumbers.length > 0
          ? item.serialNumbers
          : splitSerialStringIntoTokens(item.serialNumber);
      const hearingMaster = hearingAidProducts.find((p) => p.id === item.productId);
      const isPairProduct =
        (hearingMaster?.quantityType ?? (hearingMaster as { quantityTypeLegacy?: string } | undefined)?.quantityTypeLegacy) ===
        'pair';
      const catalogMrp = roundInrRupee(Number(item.mrp) || 0);
      let lineMrp = catalogMrp;
      let lineSelling = catalogMrp;
      if (visit?.hearingAidSale && isPairProduct) {
        const sellFullPair = sns.length >= 2 && salePairSaleMode === 'pair';
        if (!sellFullPair) {
          lineMrp = roundInrRupee(catalogMrp / 2);
          lineSelling = lineMrp;
        }
      }
      const gstAmount = roundInrRupee((lineSelling * gstPercent) / 100);
      if (visit?.hearingAidSale) {
        if (sns.length >= 2) {
          if (salePairSaleMode === 'pair') {
            setSaleSerialPrimary(sns[0]);
            setSaleSerialSecondary(sns[1]);
            setSalePairSerialOptions(null);
          } else {
            setSalePairSerialOptions([sns[0], sns[1]]);
            setSaleSerialPrimary(sns[0]);
            setSaleSerialSecondary('');
          }
        } else if (sns.length === 1) {
          setSaleSerialPrimary(sns[0]);
          setSaleSerialSecondary('');
          setSalePairSerialOptions(null);
        } else {
          setSaleSerialPrimary('');
          setSaleSerialSecondary('');
          setSalePairSerialOptions(null);
        }
      }
      const combinedSerial =
        sns.length >= 2
          ? salePairSaleMode === 'pair'
            ? `${sns[0]}, ${sns[1]}`
            : sns[0]
          : item.serialNumber || sns[0] || '';
      const lineUnit: 'pair' | 'piece' =
        sns.length >= 2 && salePairSaleMode === 'pair' ? 'pair' : 'piece';
      setCurrentProduct((prev) => ({
        ...prev,
        inventoryId: item.id,
        productId: item.productId,
        name: item.productName,
        hsnCode: item.hsnCode || '',
        mrp: lineMrp,
        dealerPrice: item.dealerPrice ?? prev.dealerPrice ?? 0,
        gstPercent,
        gstApplicable,
        gstType: (item.gstType as 'CGST' | 'IGST') || 'IGST',
        unit: lineUnit,
        quantity: 1,
        serialNumber: combinedSerial,
        sellingPrice: lineSelling,
        discountPercent: 0,
        discountAmount: 0,
        gstAmount,
        finalAmount: roundInrRupee(lineSelling + gstAmount),
        company: item.company ?? prev.company ?? '',
        location: item.location ?? prev.location ?? '',
      }));
    },
    [
      activeVisit,
      getValues,
      inventoryPickerMode,
      products,
      updateVisit,
      updateVisitFields,
      hearingAidProducts,
      salePairSaleMode,
    ]
  );

  const applyCatalogHearingAidSelection = useCallback(
    (visitIndex: number, selectedIds: string[]) => {
      const currentVisits = getValues('visits');
      const nextVisits = [...currentVisits];
      const visit = { ...(nextVisits[visitIndex] || {}) } as Visit;

      const manualProducts = (visit.products || []).filter(
        (p) => !p.productId || !hearingAidProducts.some((hp) => hp.id === p.productId)
      );

      const bookingOnVisit = !!(visit.hearingAidBooked && !visit.hearingAidSale);
      /** Trial and booking: one catalog model per visit. Sale lines use inventory below, not this picker. */
      const forceSingle = !!visit.hearingAidTrial || bookingOnVisit;
      const effectiveIds = forceSingle ? selectedIds.slice(0, 1) : [...selectedIds];

      const byProductId = new Map(hearingAidProducts.map((p) => [p.id, p]));
      const selectedProducts = effectiveIds
        .map((id) => byProductId.get(id))
        .filter((x): x is Product => !!x);

      const mappedProducts: HearingAidProduct[] = selectedProducts.map((p) => {
        const mrp = p.mrp || 0;
        const discountPercent = 0;
        const discountAmount = 0;
        const sellingPrice = mrp;
        const { gstApplicable, gstPercent } = resolveGstFromProductMaster(p);
        const gstAmount =
          gstPercent > 0 ? roundInrRupee((sellingPrice * gstPercent) / 100) : 0;
        const finalAmount = roundInrRupee(sellingPrice + gstAmount);

        return {
          id: `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          inventoryId: '',
          productId: p.id,
          name: p.name,
          hsnCode: p.hsnCode,
          serialNumber: '',
          unit: 'piece',
          quantity: 1,
          saleDate: new Date().toISOString().split('T')[0],
          mrp: roundInrRupee(mrp),
          dealerPrice: 0,
          sellingPrice: roundInrRupee(sellingPrice),
          discountPercent,
          discountAmount,
          gstPercent,
          gstAmount,
          finalAmount,
          gstApplicable,
          gstType: p.gstType ?? 'IGST',
          warranty: '',
          company: p.company,
          location: '',
        };
      });

      const updatedProducts = [...mappedProducts, ...manualProducts];
      visit.products = updatedProducts;
      const catTotals = sumHearingAidVisitTotals(updatedProducts);
      visit.grossMRP = catTotals.grossMRP;
      visit.grossSalesBeforeTax = catTotals.grossSalesBeforeTax;
      visit.taxAmount = catTotals.taxAmount;
      visit.salesAfterTax = catTotals.salesAfterTax;

      if (selectedProducts.length > 0) {
        const first = selectedProducts[0];
        visit.hearingAidProductId = first.id;
        visit.hearingAidBrand = first.company || '';
        visit.hearingAidModel = first.name || '';
        visit.hearingAidType = first.type || '';
        visit.hearingAidPrice = first.mrp || 0;
        if (visit.hearingAidTrial) {
          visit.trialHearingAidBrand = first.company || '';
          visit.trialHearingAidModel = first.name || '';
        }
      } else {
        visit.hearingAidProductId = '';
        visit.hearingAidBrand = '';
        visit.hearingAidModel = '';
        visit.hearingAidType = '';
        visit.hearingAidPrice = 0;
        if (visit.hearingAidTrial) {
          visit.trialHearingAidBrand = '';
          visit.trialHearingAidModel = '';
        }
      }

      nextVisits[visitIndex] = visit;
      setValue('visits', nextVisits);
    },
    [getValues, setValue, hearingAidProducts]
  );

  const openHearingAidCatalogDialog = useCallback(
    (intent: 'trial' | 'booking') => {
      const visit = getValues('visits')[activeVisit];
      if (!visit) return;
      const ids = (visit.products || [])
        .filter((p) => p.productId && hearingAidProducts.some((hp) => hp.id === p.productId))
        .map((p) => p.productId as string);
      setCatalogPickerIntent(intent);
      setCatalogDialogSingleProduct(true);
      setDraftCatalogProductIds(ids.slice(0, 1));
      setCatalogDialogSearch('');
      setCatalogDialogBrandFilter('');
      setHearingAidCatalogDialogOpen(true);
    },
    [activeVisit, getValues, hearingAidProducts]
  );

  const toggleDraftCatalogProduct = useCallback(
    (productId: string) => {
      setDraftCatalogProductIds((prev) => {
        if (catalogDialogSingleProduct) {
          if (prev.includes(productId)) return [];
          return [productId];
        }
        return prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId];
      });
    },
    [catalogDialogSingleProduct]
  );

  const moveDraftCatalogProduct = useCallback((index: number, dir: -1 | 1) => {
    setDraftCatalogProductIds((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const t = next[index];
      next[index] = next[j];
      next[j] = t;
      return next;
    });
  }, []);

  const applyHearingAidCatalogDialog = useCallback(() => {
    const ids = catalogDialogSingleProduct
      ? draftCatalogProductIds.slice(0, 1)
      : draftCatalogProductIds;
    applyCatalogHearingAidSelection(activeVisit, ids);
    setHearingAidCatalogDialogOpen(false);
    setCatalogDialogSearch('');
    setCatalogDialogBrandFilter('');
    setCatalogDialogSingleProduct(false);
    setCatalogPickerIntent('trial');
  }, [
    activeVisit,
    applyCatalogHearingAidSelection,
    catalogDialogSingleProduct,
    draftCatalogProductIds,
  ]);

  const removeCatalogProductFromVisit = useCallback(
    (productId: string) => {
      const nextIds = selectedCatalogProducts.filter((p) => p.id !== productId).map((p) => p.id);
      applyCatalogHearingAidSelection(activeVisit, nextIds);
    },
    [activeVisit, applyCatalogHearingAidSelection, selectedCatalogProducts]
  );

  // Add new visit
  const addVisit = () => {
    const actorName =
      userProfile?.displayName || user?.displayName || userProfile?.email || user?.email || 'Unknown user';
    const newVisit: Visit = {
      id: (watchedVisits.length + 1).toString(),
      visitDate: '',
      visitTime: '',
      visitType: 'center',
      homeVisitCharges: 0,
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
      entService: false,
      entProcedureEntries: [],
      entProcedureDoneBy: '',
      entServicePrice: 0,
      testType: '',
      hearingTestEntries: [],
      testDoneBy: '',
      testResults: '',
      recommendations: '',
      testPrice: 0,
      audiogramData: undefined,
      externalPtaReport: undefined,
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
      trialHomeSecurityDepositAmount: 0,
      trialNotes: '',
      trialResult: 'ongoing',
      trialRefundAmount: 0,
      trialRefundDate: '',
      // Booking related fields
      bookingFromTrial: false,
      bookingAdvanceAmount: 0,
      bookingDate: '',
      bookingFromVisitId: '',
      bookingSellingPrice: 0,
      bookingQuantity: 1,
      // Purchase related fields
      purchaseFromTrial: false,
      purchaseDate: '',
      purchaseFromVisitId: '',
      
      // Sales Return related fields
      salesReturnItems: [],
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
      totalDiscountPercent: 0,
      createdByUid: user?.uid || null,
      createdByName: actorName,
      createdByEmail: userProfile?.email || user?.email || null,
      createdByRole: userProfile?.role || null,
      updatedByUid: user?.uid || null,
      updatedByName: actorName,
      updatedByEmail: userProfile?.email || user?.email || null,
      updatedByRole: userProfile?.role || null,
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
      const master = currentProduct.productId
        ? hearingAidProducts.find((p) => p.id === currentProduct.productId)
        : undefined;
      const isPair =
        (master?.quantityType ?? (master as { quantityTypeLegacy?: string } | undefined)?.quantityTypeLegacy) ===
        'pair';

      let finalSerial = '';
      if (isPair) {
        if (salePairSaleMode === 'pair') {
          const a = saleSerialPrimary.trim();
          const b = saleSerialSecondary.trim();
          if (!a || !b) {
            alert('Please enter both serial numbers for a pair sale.');
            return;
          }
          finalSerial = `${a}, ${b}`;
        } else {
          finalSerial = (saleSerialPrimary.trim() || currentProduct.serialNumber || '').trim();
          if (!finalSerial) {
            alert('Please enter the serial number.');
            return;
          }
        }
      } else {
        finalSerial = String(currentProduct.serialNumber || '').trim();
      }

      const hasSerial = !!finalSerial;
      const qty = hasSerial ? 1 : hearingAidLineQty({ quantity: currentProduct.quantity });
      const discountPercent = roundDiscountPercent(currentProduct.discountPercent);
      const sellingPrice = roundInrRupee(currentProduct.sellingPrice);
      const discountAmount = roundInrRupee(Math.max(0, currentProduct.mrp - sellingPrice));
      const gstAmount =
        currentProduct.gstPercent > 0
          ? roundInrRupee((sellingPrice * currentProduct.gstPercent) / 100)
          : 0;
      const finalAmount = roundInrRupee(sellingPrice + gstAmount);

      const newProduct: HearingAidProduct = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        inventoryId: currentProduct.inventoryId,
        productId: currentProduct.productId,
        name: currentProduct.name,
        hsnCode: currentProduct.hsnCode,
        serialNumber: finalSerial,
        unit: isPair && salePairSaleMode === 'pair' ? 'pair' : currentProduct.unit,
        quantity: qty,
        saleDate: currentProduct.saleDate,
        mrp: currentProduct.mrp,
        dealerPrice: currentProduct.dealerPrice,
        sellingPrice,
        discountPercent,
        discountAmount,
        gstPercent: currentProduct.gstPercent,
        gstAmount,
        finalAmount,
        gstApplicable: currentProduct.gstApplicable,
        gstType: currentProduct.gstType,
        warranty: currentProduct.warranty,
        company: currentProduct.company,
        location: currentProduct.location,
      };

      const updatedVisits = [...watchedVisits];
      updatedVisits[activeVisit].products.push(newProduct);

      const products = updatedVisits[activeVisit].products;
      const totals = sumHearingAidVisitTotals(products);
      updatedVisits[activeVisit].grossMRP = totals.grossMRP;
      updatedVisits[activeVisit].grossSalesBeforeTax = totals.grossSalesBeforeTax;
      updatedVisits[activeVisit].taxAmount = totals.taxAmount;
      updatedVisits[activeVisit].salesAfterTax = totals.salesAfterTax;

      setValue('visits', updatedVisits);

      setCurrentProduct({
        inventoryId: '',
        productId: '',
        name: '',
        hsnCode: '',
        serialNumber: '',
        unit: 'piece',
        quantity: 1,
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
        location: '',
      });
      setSalePairSaleMode('pair');
      setSaleSerialPrimary('');
      setSaleSerialSecondary('');
      setSalePairSerialOptions(null);
    }
  };

  const removeProduct = (productIndex: number) => {
    const updatedVisits = [...watchedVisits];
    updatedVisits[activeVisit].products.splice(productIndex, 1);

    const products = updatedVisits[activeVisit].products;
    const totals = sumHearingAidVisitTotals(products);
    updatedVisits[activeVisit].grossMRP = totals.grossMRP;
    updatedVisits[activeVisit].grossSalesBeforeTax = totals.grossSalesBeforeTax;
    updatedVisits[activeVisit].taxAmount = totals.taxAmount;
    updatedVisits[activeVisit].salesAfterTax = totals.salesAfterTax;

    setValue('visits', updatedVisits);
  };

  const updateSaleProductLine = (productIndex: number, patch: Partial<HearingAidProduct>) => {
    const updatedVisits = [...getValues('visits')];
    const visit = { ...updatedVisits[activeVisit] };
    const products = [...visit.products];
    const prev = products[productIndex];
    if (!prev) return;
    const merged = { ...prev, ...patch };
    if (merged.serialNumber?.trim()) {
      merged.quantity = 1;
    } else if (patch.quantity !== undefined) {
      merged.quantity = hearingAidLineQty({ quantity: patch.quantity });
    }
    products[productIndex] = merged;
    visit.products = products;
    const totals = sumHearingAidVisitTotals(products);
    visit.grossMRP = totals.grossMRP;
    visit.grossSalesBeforeTax = totals.grossSalesBeforeTax;
    visit.taxAmount = totals.taxAmount;
    visit.salesAfterTax = totals.salesAfterTax;
    updatedVisits[activeVisit] = visit;
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
              model: product.name || visit.hearingAidModel || '',
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

  // Payment handling functions
  const calculateTotalDue = () => {
    const visits = getValues('visits');
    let total = 0;

    visits.forEach((visit, visitIndex) => {
      if (visit.hearingTest) {
        const ht = sumHearingTestEntryPrices(visit);
        if (ht > 0) total += ht;
      }

      if (visit.entService) {
        const ent = sumEntProcedurePrices(visit);
        if (ent > 0) total += ent;
      }

      if (visit.hearingAidBooked && !visit.hearingAidSale) {
        if (!bookingVisitSupersededByLaterSale(visits, visitIndex)) {
          total +=
            (Number(visit.bookingSellingPrice) || 0) * (Number(visit.bookingQuantity) || 1);
        }
      } else if (visit.hearingAidSale && visit.products) {
        total += visit.salesAfterTax || 0;
      }

      if (visit.accessory && !visit.accessoryFOC) {
        total += (visit.accessoryAmount || 0) * (visit.accessoryQuantity || 1);
      }

      if (visit.programming) {
        total += visit.programmingAmount || 0;
      }

      if (visit.visitType === 'home') {
        total += Math.max(0, Number(visit.homeVisitCharges) || 0);
      }

      if (
        visit.hearingAidTrial &&
        visit.trialHearingAidType === 'home' &&
        Number(visit.trialHomeSecurityDepositAmount) > 0 &&
        String(visit.trialResult || '').toLowerCase() !== 'unsuccessful' &&
        !homeTrialSecurityAbsorbedIntoLaterVisit(visits, visitIndex)
      ) {
        total += Number(visit.trialHomeSecurityDepositAmount) || 0;
      }
    });

    return total;
  };

  const getAvailablePaymentOptions = () => {
    const visits = getValues('visits');
    const options = [];

    visits.forEach((visit, visitIndex) => {
      const htAmt = sumHearingTestEntryPrices(visit);
      if (visit.hearingTest && htAmt > 0) {
        options.push({
          value: 'hearing_test',
          label: 'Hearing Test',
          amount: htAmt,
          description: `Test on ${visit.visitDate || 'scheduled date'}`
        });
      }

      const entAmt = sumEntProcedurePrices(visit);
      if (visit.entService && entAmt > 0) {
        options.push({
          value: 'ent_service',
          label: 'ENT service',
          amount: entAmt,
          description: `ENT procedures on ${visit.visitDate || 'scheduled date'}`
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

      const bookingGross =
        (Number(visit.bookingSellingPrice) || 0) * (Number(visit.bookingQuantity) || 1);
      const bookingSd = getBookingHomeTrialSecurityCredit(visits, visitIndex);
      const bookingNetDue = Math.max(
        bookingGross - (Number(visit.bookingAdvanceAmount) || 0) - bookingSd,
        0
      );

      if (visit.hearingAidBooked && !visit.hearingAidSale && bookingGross > 0) {
        options.push({
          value: 'hearing_aid',
          label: 'Hearing Aid',
          amount: bookingNetDue,
          description: `Booked device x ${Number(visit.bookingQuantity) || 1}${bookingSd > 0 ? ' (after trial security adjustment)' : ''}`
        });
      } else if (visit.hearingAidSale && visit.salesAfterTax > 0) {
        const saleSd = getSaleHomeTrialSecurityCredit(visits, visitIndex);
        const saleAdv = getBookingAdvanceCreditForSale(visits, visitIndex);
        const saleNet = Math.max((visit.salesAfterTax || 0) - saleSd - saleAdv, 0);
        const creditParts: string[] = [];
        if (saleSd > 0) creditParts.push('trial security');
        if (saleAdv > 0) creditParts.push('booking advance');
        const creditNote =
          creditParts.length > 0 ? ` (after ${creditParts.join(' + ')})` : '';
        options.push({
          value: 'hearing_aid',
          label: 'Hearing Aid',
          amount: saleNet,
          description: `${visit.products?.length || 0} product(s)${creditNote}`,
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
          value: 'programming' as const,
          label: 'Programming',
          amount: visit.programmingAmount,
          description: visit.hearingAidName || 'Hearing aid programming'
        });
      }

      if (
        visit.hearingAidTrial &&
        visit.trialHearingAidType === 'home' &&
        Number(visit.trialHomeSecurityDepositAmount) > 0
      ) {
        options.push({
          value: 'trial_home_security_deposit' as const,
          label: 'Home trial security deposit',
          amount: Number(visit.trialHomeSecurityDepositAmount) || 0,
          description: `Refundable deposit · Visit ${visit.id}${visit.visitDate ? ` (${visit.visitDate})` : ''}`,
          visitId: visit.id,
        });
        
        if (visit.trialResult === 'unsuccessful') {
          options.push({
            value: 'trial_home_security_deposit_refund' as const,
            label: 'Home trial security deposit refund',
            amount: Number(visit.trialRefundAmount) || Number(visit.trialHomeSecurityDepositAmount) || 0,
            description: `Outgoing refund entry for unsuccessful trial · Source Visit ${visit.id}${visit.visitDate ? ` (${visit.visitDate})` : ''} · record on separate refund/follow-up date`,
            visitId: visit.id,
          });
        }
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
    const selectedOption = paymentOptions.find(
      (opt) => opt.value === paymentFor && !(opt as { visitId?: string }).visitId
    );

    setCurrentPayment((prev) => ({
      ...prev,
      paymentFor,
      relatedVisitId: undefined,
      amount: selectedOption?.amount || 0,
      paymentDate:
        paymentFor === 'booking_advance'
          ? getValues('visits').find((v) => v.hearingAidBooked)?.bookingDate ||
            getValues('visits').find((v) => v.hearingAidBooked)?.visitDate ||
            prev.paymentDate
          : prev.paymentDate,
    }));
  };

  const applyTrialHomeSecurityPaymentForVisit = (visitId: string) => {
    const visit = getValues('visits').find((v) => v.id === visitId);
    const amt = Number(visit?.trialHomeSecurityDepositAmount) || 0;
    setCurrentPayment((prev) => ({
      ...prev,
      paymentFor: 'trial_home_security_deposit',
      relatedVisitId: visitId,
      amount: amt,
      paymentDate: visit?.trialStartDate || visit?.visitDate || prev.paymentDate,
    }));
  };

  const handlePaymentPurposeRawChange = (raw: string) => {
    if (raw.startsWith('trial_sd_ref__')) {
      const visitId = raw.slice('trial_sd_ref__'.length);
      const visit = getValues('visits').find((v) => v.id === visitId);
      const amt = Number(visit?.trialRefundAmount) || Number(visit?.trialHomeSecurityDepositAmount) || 0;
      setCurrentPayment((prev) => ({
        ...prev,
        paymentFor: 'trial_home_security_deposit_refund',
        relatedVisitId: visitId,
        amount: amt,
        paymentDate: visit?.trialRefundDate || new Date().toISOString().split('T')[0],
      }));
      return;
    }
    if (raw.startsWith('trial_sd__')) {
      applyTrialHomeSecurityPaymentForVisit(raw.slice('trial_sd__'.length));
      return;
    }
    handlePaymentForChange(raw as PaymentRecord['paymentFor']);
  };

  const calculateTotalPaid = () => {
    const payments = getValues('payments');
    // Count only actual entries added in the Payments section.
    return payments.reduce((sum, payment) => {
      const amt = payment.amount || 0;
      if (payment.paymentFor === 'trial_home_security_deposit_refund') {
        return sum - amt;
      }
      return sum + amt;
    }, 0);
  };

  const isOutgoingPayment = (paymentFor: PaymentRecord['paymentFor']) =>
    paymentFor === 'trial_home_security_deposit_refund';

  const calculateTotalIncoming = () => {
    const payments = getValues('payments');
    return payments.reduce((sum, payment) => {
      const amt = Number(payment.amount || 0);
      return isOutgoingPayment(payment.paymentFor) ? sum : sum + amt;
    }, 0);
  };

  const calculateTotalOutgoing = () => {
    const payments = getValues('payments');
    return payments.reduce((sum, payment) => {
      const amt = Number(payment.amount || 0);
      return isOutgoingPayment(payment.paymentFor) ? sum + amt : sum;
    }, 0);
  };

  const calculatePendingRefundDue = () => {
    const visits = getValues('visits');
    return visits.reduce((sum, visit) => {
      const isHomeTrial = Boolean(visit.hearingAidTrial) && visit.trialHearingAidType === 'home';
      const isUnsuccessful = String(visit.trialResult || '').toLowerCase() === 'unsuccessful';
      if (!isHomeTrial || !isUnsuccessful) return sum;
      const refundTarget =
        Number(visit.trialRefundAmount) > 0
          ? Number(visit.trialRefundAmount)
          : Number(visit.trialHomeSecurityDepositAmount) || 0;
      return sum + Math.max(0, refundTarget);
    }, 0);
  };

  const calculateOutstanding = () => {
    // Due should be settled by net cash retained (incoming minus outgoing refunds).
    const incomingOutstanding = Math.max(
      calculateTotalDue() + calculateTotalOutgoing() - calculateTotalIncoming(),
      0
    );
    const refundOutstanding = Math.max(calculatePendingRefundDue() - calculateTotalOutgoing(), 0);
    return incomingOutstanding + refundOutstanding;
  };

  const addPayment = () => {
    if (currentPayment.amount > 0) {
      if (
        currentPayment.paymentFor === 'trial_home_security_deposit_refund' &&
        currentPayment.relatedVisitId
      ) {
        const sourceVisit = getValues('visits').find((v) => v.id === currentPayment.relatedVisitId);
        const sourceDate = String(
          sourceVisit?.trialEndDate || sourceVisit?.visitDate || sourceVisit?.trialStartDate || ''
        ).trim();
        const paymentDate = String(currentPayment.paymentDate || '').trim();
        if (sourceDate && paymentDate && sourceDate === paymentDate) {
          alert(
            'Please record refund on a separate follow-up/refund visit date, not the same trial visit date.'
          );
          return;
        }
      }

      const payments = getValues('payments');
      const actorName =
        userProfile?.displayName || user?.displayName || userProfile?.email || user?.email || 'Unknown user';
      const newPayment: PaymentRecord = {
        id: Date.now().toString(),
        paymentDate: currentPayment.paymentDate,
        amount: currentPayment.amount,
        paymentFor: currentPayment.paymentFor,
        paymentMode: currentPayment.paymentMode,
        referenceNumber: currentPayment.referenceNumber,
        remarks: currentPayment.remarks,
        ...(currentPayment.relatedVisitId
          ? { relatedVisitId: currentPayment.relatedVisitId }
          : {}),
        createdByUid: user?.uid || null,
        createdByName: actorName,
        createdByEmail: userProfile?.email || user?.email || null,
        createdByRole: userProfile?.role || null,
        updatedByUid: user?.uid || null,
        updatedByName: actorName,
        updatedByEmail: userProfile?.email || user?.email || null,
        updatedByRole: userProfile?.role || null,
      };
      
      setValue('payments', [...payments, newPayment]);
      
      // Reset current payment form
      setCurrentPayment({
        paymentDate: new Date().toISOString().split('T')[0],
        amount: 0,
        paymentFor: 'full_payment',
        paymentMode: 'Cash',
        referenceNumber: '',
        remarks: '',
        relatedVisitId: undefined,
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

  const submitLoading = isSubmitting || formSubmitting;

  const onFormSubmit = async (data: FormData) => {
    const totalDue = calculateTotalDue();
    const totalPaid = calculateTotalPaid();
    const outstanding = calculateOutstanding();

    const visitsForSave = data.visits.map((visit) => {
      const items = visit.salesReturnItems;
      if (visit.salesReturn && Array.isArray(items) && items.length > 0) {
        return {
          ...visit,
          returnSerialNumber: linesToLegacyReturnSerialString(items),
        };
      }
      return visit;
    });

    const normalizedPaymentRecords = (data.payments || []).map((payment) => ({
      id: payment.id,
      paymentType:
        payment.paymentFor === 'hearing_test' ? 'hearing_aid_test' :
        payment.paymentFor === 'ent_service' ? 'ent_service' :
        payment.paymentFor === 'booking_advance' ? 'hearing_aid_booking' :
        payment.paymentFor === 'hearing_aid' ? 'hearing_aid_sale' :
        payment.paymentFor === 'full_payment' ? 'hearing_aid_sale' :
        payment.paymentFor === 'partial_payment' ? 'hearing_aid_sale' :
        payment.paymentFor === 'trial_home_security_deposit' ? 'staff_trial_request' :
        payment.paymentFor === 'trial_home_security_deposit_refund' ? 'staff_trial_request' :
        payment.paymentFor || 'other',
      amount: Number(payment.amount || 0),
      paymentDate: payment.paymentDate || null,
      paymentMethod: payment.paymentMode || 'Cash',
      referenceNumber: payment.referenceNumber || '',
      remarks: payment.remarks || '',
      relatedVisitId: payment.relatedVisitId ?? null,
      createdByUid: payment.createdByUid ?? null,
      createdByName: payment.createdByName ?? null,
      createdByEmail: payment.createdByEmail ?? null,
      createdByRole: payment.createdByRole ?? null,
      updatedByUid: payment.updatedByUid ?? payment.createdByUid ?? null,
      updatedByName: payment.updatedByName ?? payment.createdByName ?? null,
      updatedByEmail: payment.updatedByEmail ?? payment.createdByEmail ?? null,
      updatedByRole: payment.updatedByRole ?? payment.createdByRole ?? null,
    }));

    const formattedData = {
      ...data,
      leadOutcome: (data.leadOutcome || '').trim() || null,
      visits: visitsForSave,
      followUps,
      status: 'active',
      journeyStatusOverride: null,
      // Keep legacy and normalized payment arrays in sync so profile/payment widgets
      // reflect deletes/edits made from CRM enquiry form immediately.
      paymentRecords: normalizedPaymentRecords,
      // Payment summary
      financialSummary: {
        totalDue,
        totalPaid,
        outstanding,
        paymentStatus: outstanding <= 0 ? 'fully_paid' : 'pending'
      },
      visitSchedules: visitsForSave.map(visit => {
        // Build hearingTestDetails object, only including audiogramData if it exists
        const htFiltered = (visit.hearingTestEntries || []).filter((e) => String(e.testType || '').trim());
        const htSum = htFiltered.reduce(
          (s, e) => s + Math.max(0, Number((e as { price?: number }).price) || 0),
          0
        );
        const testTypesLine = htFiltered.length
          ? htFiltered.map((e) => String(e.testType).trim()).join(', ')
          : String(visit.testType || '').trim() || null;

        const hearingTestDetails: any = {
          testType: testTypesLine,
          testDoneBy: visit.testDoneBy || null,
          testResults: visit.testResults || null,
          recommendations: visit.recommendations || null,
          testPrice: htFiltered.length > 0 ? htSum : visit.testPrice || null,
        };
        if (htFiltered.length > 0) {
          hearingTestDetails.hearingTestEntries = htFiltered.map((e) => ({
            id: e.id,
            testType: String(e.testType).trim(),
            price: Math.max(0, Number((e as { price?: number }).price) || 0),
          }));
        }

        // Only add audiogramData if it exists and is not undefined
        if (visit.audiogramData !== undefined && visit.audiogramData !== null) {
          hearingTestDetails.audiogramData = visit.audiogramData;
        }
        if (visit.externalPtaReport !== undefined && visit.externalPtaReport !== null) {
          hearingTestDetails.externalPtaReport = visit.externalPtaReport;
        }

        const entFiltered = (visit.entProcedureEntries || []).filter((e) =>
          String(e.procedureType || '').trim()
        );
        const entSum = entFiltered.reduce(
          (s, e) => s + Math.max(0, Number((e as { price?: number }).price) || 0),
          0
        );
        const proceduresLine = entFiltered.length
          ? entFiltered.map((e) => String(e.procedureType).trim()).join(', ')
          : null;

        const entServiceDetails: Record<string, unknown> = {
          procedureTypesLine: proceduresLine,
          doneBy: visit.entProcedureDoneBy || null,
          totalPrice: entFiltered.length > 0 ? entSum : visit.entServicePrice || null,
        };
        if (entFiltered.length > 0) {
          entServiceDetails.entProcedureEntries = entFiltered.map((e) => ({
            id: e.id,
            procedureType: String(e.procedureType).trim(),
            price: Math.max(0, Number((e as { price?: number }).price) || 0),
          }));
        }

        const shouldPersistBookingFields =
          (visit.hearingAidBooked && !visit.hearingAidSale) ||
          visit.bookingFromTrial ||
          Number(visit.bookingAdvanceAmount) > 0;

        return removeUndefined({
          id: visit.id,
          visitType: visit.visitType,
          visitDate: visit.visitDate,
          visitTime: visit.visitTime,
          homeVisitCharges:
            visit.visitType === 'home' ? Math.max(0, Number(visit.homeVisitCharges) || 0) : 0,
          notes: visit.visitNotes,
          medicalServices: [
            ...(visit.hearingTest ? ['hearing_test'] : []),
            ...(visit.hearingAidTrial ? ['hearing_aid_trial'] : []),
            ...(visit.hearingAidBooked ? ['hearing_aid_booked'] : []),
            ...(visit.hearingAidSale ? ['hearing_aid_sale'] : []),
            ...(visit.salesReturn ? ['sales_return'] : []),
            ...(visit.accessory ? ['accessory'] : []),
            ...(visit.programming ? ['programming'] : []),
            ...(visit.repair ? ['repair'] : []),
            ...(visit.counselling ? ['counselling'] : []),
            ...(visit.entService ? ['ent_service'] : [])
          ],
          hearingTestDetails: removeUndefined(hearingTestDetails),
          entServiceDetails: removeUndefined(entServiceDetails),
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
          trialHomeSecurityDepositAmount: visit.trialHomeSecurityDepositAmount,
          trialNotes: visit.trialNotes,
          trialResult: visit.trialResult,
          trialRefundAmount: visit.trialRefundAmount,
          trialRefundDate: visit.trialRefundDate,
          // Persist booking fields only when visit is truly booking-related.
          bookingFromTrial: shouldPersistBookingFields ? visit.bookingFromTrial : false,
          bookingAdvanceAmount: shouldPersistBookingFields ? visit.bookingAdvanceAmount : 0,
          bookingDate: shouldPersistBookingFields ? visit.bookingDate : '',
          bookingFromVisitId: shouldPersistBookingFields ? visit.bookingFromVisitId : '',
          bookingSellingPrice: shouldPersistBookingFields ? visit.bookingSellingPrice : 0,
          bookingQuantity: shouldPersistBookingFields ? visit.bookingQuantity : 1,
          // Persist purchase fields
          purchaseFromTrial: visit.purchaseFromTrial,
          purchaseDate: visit.purchaseDate,
          purchaseFromVisitId: visit.purchaseFromVisitId,
          // Sales return (mirrors flat visit for consumers that read visitSchedules only)
          salesReturn: visit.salesReturn,
          salesReturnItems: visit.salesReturnItems,
          returnSerialNumber: visit.returnSerialNumber,
          returnReason: visit.returnReason,
          returnCondition: visit.returnCondition,
          returnPenaltyAmount: visit.returnPenaltyAmount,
          returnRefundAmount: visit.returnRefundAmount,
          returnOriginalSaleDate: visit.returnOriginalSaleDate,
          returnOriginalSaleVisitId: visit.returnOriginalSaleVisitId,
          returnNotes: visit.returnNotes
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

    const autoDerived = getEnquiryStatusMeta({ ...cleanedData, journeyStatusOverride: null });
    setJourneySuggested({
      key: autoDerived.key,
      label: autoDerived.label,
      color: autoDerived.color,
    });
    const existingPin = parseJourneyStatusOverride(enquiry?.journeyStatusOverride);
    setJourneySelectValue(existingPin ?? 'auto');

    const result = await new Promise<'cancel' | { override: EnquiryJourneyStatus | null }>(
      (resolve) => {
        journeyPromiseRef.current = { resolve };
        setJourneyDialogOpen(true);
      }
    );

    if (result === 'cancel') return;

    await onSubmit({
      ...cleanedData,
      journeyStatusOverride: result.override,
    });
  };

  const handleJourneyDialogConfirm = () => {
    const override = journeySelectValue === 'auto' ? null : journeySelectValue;
    journeyPromiseRef.current?.resolve({ override });
    journeyPromiseRef.current = null;
    setJourneyDialogOpen(false);
  };

  const handleJourneyDialogCancel = () => {
    journeyPromiseRef.current?.resolve('cancel');
    journeyPromiseRef.current = null;
    setJourneyDialogOpen(false);
  };

  const stepTitles = ['Patient Information & Services', 'Review & Submit'];

  // Don't render anything if not open
  if (!open) {
    return null;
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
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
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="customerName"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Customer Name"
                          variant="outlined"
                          disabled={isAudiologist}
                          helperText="Use when payer/decision-maker differs from patient."
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
                        rules={{
                          required: 'Phone is required',
                          validate: (value) =>
                            normalizeEnquiryPhone(value).length === 10 ||
                            'Contact phone must be exactly 10 letters or digits',
                        }}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            label="Phone Number"
                            required
                            error={!!errors.phone}
                            helperText={errors.phone?.message}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(normalizeEnquiryPhone(e.target.value))}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <PhoneIcon color="action" />
                                </InputAdornment>
                              ),
                              inputProps: {
                                maxLength: 10,
                                inputMode: 'text',
                                autoComplete: 'tel',
                              },
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
                      name="customerGstNumber"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Customer GST Number"
                          disabled={isAudiologist}
                          value={(field.value || '').toUpperCase()}
                          onChange={(e) => field.onChange((e.target.value || '').toUpperCase())}
                          helperText="Optional - used for tax invoice GSTIN."
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
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
                          disabled={isAudiologist}
                          multiline
                          rows={2}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="reference"
                      control={control}
                      rules={{
                        validate: (v: string[]) =>
                          (Array.isArray(v) && v.length > 0) || 'Select at least one reference',
                      }}
                      render={({ field }) => (
                        <FormControl fullWidth required error={!!errors.reference}>
                          <InputLabel id="reference-label">Reference</InputLabel>
                          <Select
                            {...field}
                            labelId="reference-label"
                            label="Reference Source"
                            multiple
                            value={field.value || []}
                            onChange={(event) => {
                              const value = event.target.value as string[] | string;
                              field.onChange(
                                Array.isArray(value) ? value : value ? [value] : []
                              );
                            }}
                            disabled={isAudiologist}
                            sx={{ borderRadius: 2, minWidth: '200px' }}
                            renderValue={(selected) => (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {(selected as string[]).map((value) => (
                                  <Chip
                                    key={value}
                                    label={
                                      referenceFieldOptions.find((o) => o.optionValue === value)?.optionLabel ?? value
                                    }
                                    size="small"
                                    sx={{ borderRadius: 1 }}
                                  />
                                ))}
                              </Box>
                            )}
                            MenuProps={{
                              PaperProps: {
                                style: {
                                  maxHeight: 320
                                }
                              }
                            }}
                          >
                            {referenceFieldOptions.map((option) => (
                              <MenuItem key={option.optionValue} value={option.optionValue}>
                                <Checkbox
                                  checked={Array.isArray(field.value) && field.value.includes(option.optionValue)}
                                  sx={{ mr: 1 }}
                                />
                                {option.optionLabel}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.reference && (
                            <FormHelperText>{errors.reference.message as string}</FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="followUpDate"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Follow-up Date"
                          type="date"
                          disabled={isAudiologist}
                          helperText="Optional — set a follow-up date even before calling."
                          InputLabelProps={{ shrink: true }}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
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
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value)}
                              disabled={isAudiologist}
                              sx={{ borderRadius: 2, minWidth: '200px' }}
                              MenuProps={mergeMenuPropsForReselectClear(field.value, () => field.onChange(''), {
                                PaperProps: {
                                  style: {
                                    maxHeight: 300
                                  }
                                }
                              })}
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
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value)}
                              disabled={isAudiologist}
                              sx={{ borderRadius: 2, minWidth: '200px' }}
                              MenuProps={mergeMenuPropsForReselectClear(field.value, () => field.onChange(''), {
                                PaperProps: {
                                  style: {
                                    maxHeight: 300
                                  }
                                }
                              })}
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
                      rules={{
                        validate: (v: string) =>
                          (v != null && String(v).trim() !== '') || 'Center is required',
                      }}
                      render={({ field }) => (
                        <FormControl fullWidth error={!!errors.center} required>
                          <InputLabel id="center-label">Center</InputLabel>
                          <Select
                            {...field}
                            labelId="center-label"
                            label="Center"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                            disabled={isAudiologist}
                            sx={{ borderRadius: 2, minWidth: '200px' }}
                            MenuProps={mergeMenuPropsForReselectClear(field.value, () => field.onChange(''), {
                              PaperProps: {
                                style: {
                                  maxHeight: 300
                                }
                              }
                            })}
                          >
                            {centers.map(center => (
                              <MenuItem key={center.id} value={center.id}>
                                {center.name}
                              </MenuItem>
                            ))}
                          </Select>
                          {errors.center && (
                            <FormHelperText>{errors.center.message}</FormHelperText>
                          )}
                        </FormControl>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Controller
                      name="leadOutcome"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth disabled={isAudiologist}>
                          <InputLabel id="lead-outcome-label">Lead outcome</InputLabel>
                          <Select
                            {...field}
                            labelId="lead-outcome-label"
                            label="Lead outcome"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                            sx={{ borderRadius: 2 }}
                            MenuProps={mergeMenuPropsForReselectClear(field.value, () => field.onChange(''), undefined)}
                          >
                            {LEAD_OUTCOME_OPTIONS.map((opt) => (
                              <MenuItem key={opt.value || 'none'} value={opt.value}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                          <FormHelperText>
                            If they bought devices elsewhere, tag updates accordingly (booking or sale
                            here overrides this).
                          </FormHelperText>
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
                  <Grid item xs={12}>
                    <Controller
                      name="hotEnquiry"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          sx={{
                            ml: 0,
                            mr: 0,
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: field.value ? 'warning.main' : 'divider',
                            bgcolor: (t) =>
                              field.value
                                ? alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.12 : 0.08)
                                : alpha(t.palette.action.hover, t.palette.mode === 'dark' ? 0.08 : 0.04),
                            alignItems: 'flex-start',
                          }}
                          control={
                            <Switch
                              checked={!!field.value}
                              onChange={(_, c) => field.onChange(c)}
                              color="warning"
                              disabled={isAudiologist}
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="subtitle2" fontWeight={700}>
                                Hot enquiry
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Mark as a priority lead — stands out in the enquiries list and patient profile.
                              </Typography>
                            </Box>
                          }
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
                    bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), 
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderStyle: 'dashed',
                    mb: 3
                  }}>
                    <DateRangeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
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
                            onChange={(e) => {
                              const v = e.target.value as 'center' | 'home';
                              if (v === 'center') {
                                updateVisitFields(activeVisit, {
                                  visitType: 'center',
                                  homeVisitCharges: 0,
                                });
                              } else {
                                updateVisit(activeVisit, 'visitType', v);
                              }
                            }}
                            label="Visit Type"
                            disabled={isAudiologist}
                            sx={{ borderRadius: 2, minWidth: '200px' }}
                          >
                            {visitLocationOpts.map((o) => (
                              <MenuItem key={o.optionValue} value={o.optionValue}>
                                {o.optionLabel}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      {currentVisit.visitType === 'home' && (
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            label="Visit Charges (₹)"
                            type="number"
                            value={currentVisit.homeVisitCharges || ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const n =
                                raw === '' ? 0 : Math.max(0, Number(raw));
                              updateVisit(
                                activeVisit,
                                'homeVisitCharges',
                                Number.isFinite(n) ? n : 0
                              );
                            }}
                            disabled={isAudiologist}
                            inputProps={{ min: 0, step: 1 }}
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            helperText="Home visit fee (travel / consultation)"
                          />
                        </Grid>
                      )}
                      <Grid item xs={12} md={6}>
                        <Box sx={{ display: 'flex', gap: 2, height: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.hearingTest}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  if (!on) {
                                    updateVisitFields(activeVisit, {
                                      hearingTest: false,
                                      hearingTestEntries: [],
                                      testType: '',
                                      testPrice: 0,
                                    });
                                  } else {
                                    updateVisit(activeVisit, 'hearingTest', true);
                                  }
                                }}
                                disabled={isAudiologist}
                                color="primary"
                              />
                            }
                            label="Hearing Test"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.entService}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  if (!on) {
                                    updateVisitFields(activeVisit, {
                                      entService: false,
                                      entProcedureEntries: [],
                                      entProcedureDoneBy: '',
                                      entServicePrice: 0,
                                    });
                                  } else {
                                    updateVisit(activeVisit, 'entService', true);
                                  }
                                }}
                                disabled={isAudiologist}
                                color="secondary"
                              />
                            }
                            label="ENT service"
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.hearingAidTrial}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  updateVisit(activeVisit, 'hearingAidTrial', checked);
                                  if (checked) {
                                    const visit = getValues('visits')[activeVisit];
                                    const catalogIds = (visit?.products || [])
                                      .filter(
                                        (p) =>
                                          p.productId &&
                                          hearingAidProducts.some((hp) => hp.id === p.productId)
                                      )
                                      .map((p) => p.productId as string);
                                    if (catalogIds.length > 1) {
                                      applyCatalogHearingAidSelection(activeVisit, catalogIds.slice(0, 1));
                                    }
                                  }
                                }}
                                disabled={isAudiologist}
                                color="info"
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" component="span">
                                  Hearing Aid Trial
                                </Typography>
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color="text.secondary"
                                  sx={{ lineHeight: 1.2 }}
                                >
                                  Try one model · single device from catalog
                                </Typography>
                              </Box>
                            }
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.hearingAidBooked}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  updateVisit(activeVisit, 'hearingAidBooked', checked);
                                  if (checked) {
                                    const visit = getValues('visits')[activeVisit];
                                    const catalogIds = (visit?.products || [])
                                      .filter(
                                        (p) =>
                                          p.productId &&
                                          hearingAidProducts.some((hp) => hp.id === p.productId)
                                      )
                                      .map((p) => p.productId as string);
                                    if (catalogIds.length > 1) {
                                      applyCatalogHearingAidSelection(activeVisit, catalogIds.slice(0, 1));
                                    }
                                  }
                                }}
                                disabled={isAudiologist}
                                color="warning"
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" component="span">
                                  Hearing Aid Booked
                                </Typography>
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color="text.secondary"
                                  sx={{ lineHeight: 1.2 }}
                                >
                                  One catalog model · quantity in booking details
                                </Typography>
                              </Box>
                            }
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
                            label={
                              <Box>
                                <Typography variant="body2" component="span">
                                  Hearing Aid Sale
                                </Typography>
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color="text.secondary"
                                  sx={{ lineHeight: 1.2 }}
                                >
                                  Inventory: qty or one row per serial · same model allowed
                                </Typography>
                              </Box>
                            }
                          />
                          <FormControlLabel
                            control={
                              <Switch
                                checked={currentVisit.salesReturn}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  if (!on) {
                                    updateVisit(activeVisit, 'salesReturn', false);
                                    return;
                                  }
                                  const v = getValues('visits')[activeVisit];
                                  const existing = [...(v.salesReturnItems || [])];
                                  const legacy = String(v.returnSerialNumber || '').trim();
                                  if (existing.length === 0 && legacy) {
                                    const migrated = legacySerialsToLines(legacy, v.hearingAidModel || '');
                                    updateVisitFields(activeVisit, {
                                      salesReturn: true,
                                      salesReturnItems: migrated,
                                      returnSerialNumber: linesToLegacyReturnSerialString(migrated),
                                    });
                                  } else {
                                    updateVisit(activeVisit, 'salesReturn', true);
                                  }
                                }}
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
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                                Tests performed (this visit)
                              </Typography>
                              <Stack spacing={1.25}>
                                {(currentVisit.hearingTestEntries || []).map((entry) => (
                                  <Box
                                    key={entry.id}
                                    sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}
                                  >
                                    <FormControl size="small" sx={{ minWidth: 200, flex: 1, maxWidth: 420 }}>
                                      <InputLabel id={`ht-type-${entry.id}`}>Test type</InputLabel>
                                      <Select
                                        labelId={`ht-type-${entry.id}`}
                                        label="Test type"
                                        value={entry.testType || ''}
                                        MenuProps={mergeMenuPropsForReselectClear(
                                          entry.testType || '',
                                          () => {
                                            const next = (currentVisit.hearingTestEntries || []).map((x) =>
                                              x.id === entry.id ? { ...x, testType: '' } : x
                                            );
                                            const line = next.map((x) => x.testType).filter(Boolean).join(', ');
                                            const tp = sumHearingTestEntryPrices({
                                              hearingTestEntries: next,
                                              testPrice: currentVisit.testPrice,
                                            });
                                            updateVisitFields(activeVisit, {
                                              hearingTestEntries: next,
                                              testType: line,
                                              testPrice: tp,
                                            });
                                          },
                                          undefined
                                        )}
                                        onChange={(e) => {
                                          const v = String(e.target.value);
                                          const next = (currentVisit.hearingTestEntries || []).map((x) =>
                                            x.id === entry.id ? { ...x, testType: v } : x
                                          );
                                          const line = next.map((x) => x.testType).filter(Boolean).join(', ');
                                          const tp = sumHearingTestEntryPrices({
                                            hearingTestEntries: next,
                                            testPrice: currentVisit.testPrice,
                                          });
                                          updateVisitFields(activeVisit, {
                                            hearingTestEntries: next,
                                            testType: line,
                                            testPrice: tp,
                                          });
                                        }}
                                      >
                                        <MenuItem value="">
                                          <em>Select type</em>
                                        </MenuItem>
                                        {hearingTestTypeOpts.map((o) => (
                                          <MenuItem key={o.optionValue} value={o.optionValue}>
                                            {o.optionLabel}
                                          </MenuItem>
                                        ))}
                                        {entry.testType &&
                                          !hearingTestTypeOpts.some((o) => o.optionValue === entry.testType) && (
                                            <MenuItem value={entry.testType}>{entry.testType} (saved)</MenuItem>
                                          )}
                                      </Select>
                                    </FormControl>
                                    <TextField
                                      size="small"
                                      label="Price"
                                      type="number"
                                      value={entry.price ?? ''}
                                      onChange={(e) => {
                                        const num = Math.max(0, Number(e.target.value) || 0);
                                        const next = (currentVisit.hearingTestEntries || []).map((x) =>
                                          x.id === entry.id ? { ...x, price: num } : x
                                        );
                                        const line = next.map((x) => x.testType).filter(Boolean).join(', ');
                                        const tp = sumHearingTestEntryPrices({
                                          hearingTestEntries: next,
                                          testPrice: currentVisit.testPrice,
                                        });
                                        updateVisitFields(activeVisit, {
                                          hearingTestEntries: next,
                                          testType: line,
                                          testPrice: tp,
                                        });
                                      }}
                                      sx={{ width: 120 }}
                                      InputProps={{
                                        startAdornment: (
                                          <InputAdornment position="start">
                                            <RupeeIcon sx={{ fontSize: 18 }} />
                                          </InputAdornment>
                                        ),
                                      }}
                                    />
                                    <IconButton
                                      aria-label="Remove test"
                                      size="small"
                                      onClick={() => {
                                        const next = (currentVisit.hearingTestEntries || []).filter(
                                          (x) => x.id !== entry.id
                                        );
                                        const line = next.map((x) => x.testType).filter(Boolean).join(', ');
                                        const tp = sumHearingTestEntryPrices({
                                          hearingTestEntries: next,
                                          testPrice: currentVisit.testPrice,
                                        });
                                        updateVisitFields(activeVisit, {
                                          hearingTestEntries: next,
                                          testType: line,
                                          testPrice: tp,
                                        });
                                      }}
                                      sx={{ mt: 0.5 }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                ))}
                                <Button
                                  type="button"
                                  variant="outlined"
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => {
                                    const next = [
                                      ...(currentVisit.hearingTestEntries || []),
                                      { id: newHearingTestEntryId(), testType: '', price: 0 },
                                    ];
                                    const tp = sumHearingTestEntryPrices({
                                      hearingTestEntries: next,
                                      testPrice: currentVisit.testPrice,
                                    });
                                    updateVisitFields(activeVisit, { hearingTestEntries: next, testPrice: tp });
                                  }}
                                >
                                  Add hearing test
                                </Button>
                              </Stack>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Box sx={{ position: 'relative' }}>
                                <FormControl fullWidth>
                                  <InputLabel>Test Done By</InputLabel>
                                  <Select 
                                    value={currentVisit.testDoneBy}
                                    onChange={(e) => updateVisit(activeVisit, 'testDoneBy', e.target.value)}
                                    label="Test Done By"
                                    sx={{ borderRadius: 2, minWidth: '200px' }}
                                    MenuProps={mergeMenuPropsForReselectClear(
                                      currentVisit.testDoneBy,
                                      () => updateVisit(activeVisit, 'testDoneBy', ''),
                                      undefined
                                    )}
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
                            {(currentVisit.hearingTestEntries || []).filter((e) =>
                              String(e.testType || '').trim()
                            ).length > 1 && (
                              <Grid item xs={12}>
                                <Typography variant="body2" color="text.secondary">
                                  Total (hearing tests):{' '}
                                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                    {formatCurrency(sumHearingTestEntryPrices(currentVisit))}
                                  </Box>
                                </Typography>
                              </Grid>
                            )}
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

                          {/* Pure Tone Audiogram — not shown in this form (create or edit); use PTA link + patient profile */}
                          <Alert severity="info" sx={{ mt: 2 }} icon={false}>
                            <Typography variant="body2">
                              Audiogram charts are not shown here so the form stays compact. Link a PTA report below; after saving,
                              open the patient profile to view charts.
                              {enquiry?.id ? (
                                <>
                                  {' '}
                                  <MuiLink href={`/interaction/enquiries/${enquiry.id}`} target="_blank" rel="noopener noreferrer">
                                    Open patient profile
                                  </MuiLink>
                                  .
                                </>
                              ) : null}
                            </Typography>
                          </Alert>
                          <ExternalPtaReportPicker
                            value={currentVisit.externalPtaReport}
                            onChange={(next) => updateVisit(activeVisit, 'externalPtaReport', next)}
                            getIdToken={getPtaIdToken}
                            disabled={
                              !userProfile ||
                              !['admin', 'staff', 'audiologist'].includes(userProfile.role)
                            }
                          />
                        </CardContent>
                      </Card>
                    )}

                    {currentVisit.entService && (
                      <Card sx={{ mb: 4, bgcolor: 'secondary.50', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <MedicalIcon sx={{ color: 'secondary.main' }} />
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                              ENT service (billable procedures)
                            </Typography>
                          </Box>
                          <Grid container spacing={3}>
                            <Grid item xs={12}>
                              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                                Procedures (this visit)
                              </Typography>
                              <Stack spacing={1.25}>
                                {(currentVisit.entProcedureEntries || []).map((entry) => (
                                  <Box
                                    key={entry.id}
                                    sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}
                                  >
                                    <FormControl size="small" sx={{ minWidth: 200, flex: 1, maxWidth: 480 }}>
                                      <InputLabel id={`ent-proc-${entry.id}`}>Procedure</InputLabel>
                                      <Select
                                        labelId={`ent-proc-${entry.id}`}
                                        label="Procedure"
                                        value={entry.procedureType || ''}
                                        MenuProps={mergeMenuPropsForReselectClear(
                                          entry.procedureType || '',
                                          () => {
                                            const next = (currentVisit.entProcedureEntries || []).map((x) =>
                                              x.id === entry.id ? { ...x, procedureType: '' } : x
                                            );
                                            const ep = sumEntProcedurePrices({
                                              entProcedureEntries: next,
                                              entServicePrice: currentVisit.entServicePrice,
                                            });
                                            updateVisitFields(activeVisit, {
                                              entProcedureEntries: next,
                                              entServicePrice: ep,
                                            });
                                          },
                                          undefined
                                        )}
                                        onChange={(e) => {
                                          const v = String(e.target.value);
                                          const next = (currentVisit.entProcedureEntries || []).map((x) =>
                                            x.id === entry.id ? { ...x, procedureType: v } : x
                                          );
                                          const ep = sumEntProcedurePrices({
                                            entProcedureEntries: next,
                                            entServicePrice: currentVisit.entServicePrice,
                                          });
                                          updateVisitFields(activeVisit, {
                                            entProcedureEntries: next,
                                            entServicePrice: ep,
                                          });
                                        }}
                                      >
                                        <MenuItem value="">
                                          <em>Select procedure</em>
                                        </MenuItem>
                                        {ENT_PROCEDURE_OPTIONS.map((o) => (
                                          <MenuItem key={o.optionValue} value={o.optionValue}>
                                            {o.optionLabel}
                                          </MenuItem>
                                        ))}
                                        {entry.procedureType &&
                                          !ENT_PROCEDURE_OPTIONS.some((o) => o.optionValue === entry.procedureType) && (
                                            <MenuItem value={entry.procedureType}>
                                              {entry.procedureType} (saved)
                                            </MenuItem>
                                          )}
                                      </Select>
                                    </FormControl>
                                    <TextField
                                      size="small"
                                      label="Price"
                                      type="number"
                                      value={entry.price ?? ''}
                                      onChange={(e) => {
                                        const num = Math.max(0, Number(e.target.value) || 0);
                                        const next = (currentVisit.entProcedureEntries || []).map((x) =>
                                          x.id === entry.id ? { ...x, price: num } : x
                                        );
                                        const ep = sumEntProcedurePrices({
                                          entProcedureEntries: next,
                                          entServicePrice: currentVisit.entServicePrice,
                                        });
                                        updateVisitFields(activeVisit, {
                                          entProcedureEntries: next,
                                          entServicePrice: ep,
                                        });
                                      }}
                                      sx={{ width: 120 }}
                                      InputProps={{
                                        startAdornment: (
                                          <InputAdornment position="start">
                                            <RupeeIcon sx={{ fontSize: 18 }} />
                                          </InputAdornment>
                                        ),
                                      }}
                                    />
                                    <IconButton
                                      aria-label="Remove procedure"
                                      size="small"
                                      onClick={() => {
                                        const next = (currentVisit.entProcedureEntries || []).filter(
                                          (x) => x.id !== entry.id
                                        );
                                        const ep = sumEntProcedurePrices({
                                          entProcedureEntries: next,
                                          entServicePrice: currentVisit.entServicePrice,
                                        });
                                        updateVisitFields(activeVisit, {
                                          entProcedureEntries: next,
                                          entServicePrice: ep,
                                        });
                                      }}
                                      sx={{ mt: 0.5 }}
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                ))}
                                <Button
                                  type="button"
                                  variant="outlined"
                                  size="small"
                                  startIcon={<AddIcon />}
                                  onClick={() => {
                                    const next = [
                                      ...(currentVisit.entProcedureEntries || []),
                                      { id: newEntProcedureEntryId(), procedureType: '', price: 0 },
                                    ];
                                    const ep = sumEntProcedurePrices({
                                      entProcedureEntries: next,
                                      entServicePrice: currentVisit.entServicePrice,
                                    });
                                    updateVisitFields(activeVisit, { entProcedureEntries: next, entServicePrice: ep });
                                  }}
                                >
                                  Add procedure
                                </Button>
                              </Stack>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Box sx={{ position: 'relative' }}>
                                <FormControl fullWidth>
                                  <InputLabel>Procedure done by</InputLabel>
                                  <Select
                                    value={currentVisit.entProcedureDoneBy}
                                    onChange={(e) =>
                                      updateVisit(activeVisit, 'entProcedureDoneBy', e.target.value)
                                    }
                                    label="Procedure done by"
                                    sx={{ borderRadius: 2, minWidth: '200px' }}
                                    MenuProps={mergeMenuPropsForReselectClear(
                                      currentVisit.entProcedureDoneBy,
                                      () => updateVisit(activeVisit, 'entProcedureDoneBy', ''),
                                      undefined
                                    )}
                                  >
                                    {getStaffOptionsForField('testBy').map((option) => (
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
                                      zIndex: 1,
                                    }}
                                    size="small"
                                    title="Edit staff categories (Admin Only)"
                                  >
                                    <EditIcon sx={{ fontSize: '12px' }} />
                                  </IconButton>
                                )}
                              </Box>
                            </Grid>
                            {(currentVisit.entProcedureEntries || []).filter((e) =>
                              String(e.procedureType || '').trim()
                            ).length > 1 && (
                              <Grid item xs={12}>
                                <Typography variant="body2" color="text.secondary">
                                  Total (ENT procedures):{' '}
                                  <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                    {formatCurrency(sumEntProcedurePrices(currentVisit))}
                                  </Box>
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        </CardContent>
                      </Card>
                    )}

                    {/* Hearing aid journey + device blocks (trial vs booking are visually separate) */}
                    {showHearingAidJourneyBlock && (
                      <Card
                        sx={{
                          mb: 3,
                          borderRadius: 2,
                          border: 1,
                          borderColor: 'divider',
                          bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]),
                          boxShadow: 'none',
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                            <TimelineIcon sx={{ color: 'text.secondary', mt: 0.25 }} />
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                Device journey
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Link this visit to a prior trial or booking, or copy device details in one tap.
                              </Typography>
                            </Box>
                          </Box>

                          <Box sx={{ mb: 0, p: 2, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                            <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', fontWeight: 600 }}>
                              Continue from a previous visit
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                  <InputLabel>Continue from Previous Visit</InputLabel>
                                  <Select 
                                    value={currentVisit.previousVisitId}
                                    MenuProps={mergeMenuPropsForReselectClear(
                                      currentVisit.previousVisitId,
                                      () => updateVisit(activeVisit, 'previousVisitId', ''),
                                      undefined
                                    )}
                                    onChange={(e) => {
                                      const prevVisitId = String(e.target.value);
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
                                    sx={{ borderRadius: 2, minWidth: '200px' }}
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
                          
                          <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            {watchedVisits.slice(0, activeVisit).some((visit) => visit.hearingAidTrial) && (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CheckIcon />}
                                onClick={() => {
                                  const trialVisit = getValues('visits')
                                    .slice(0, activeVisit)
                                    .find((visit) => visit.hearingAidTrial);
                                  if (trialVisit) {
                                    updateVisitFields(activeVisit, {
                                      hearingAidProductId: trialVisit.hearingAidProductId || '',
                                      hearingAidBrand: trialVisit.trialHearingAidBrand || trialVisit.hearingAidBrand || '',
                                      hearingAidModel: trialVisit.trialHearingAidModel || trialVisit.hearingAidModel || '',
                                      hearingAidType: trialVisit.hearingAidType || '',
                                      whichEar: trialVisit.whichEar || 'both',
                                      previousVisitId: trialVisit.id,
                                      hearingAidPrice:
                                        typeof trialVisit.hearingAidPrice === 'number'
                                          ? trialVisit.hearingAidPrice || 0
                                          : 0,
                                      bookingFromTrial: currentVisit.hearingAidBooked
                                        ? true
                                        : currentVisit.bookingFromTrial || false,
                                      bookingFromVisitId: currentVisit.hearingAidBooked
                                        ? trialVisit.id
                                        : currentVisit.bookingFromVisitId || '',
                                      products: trialVisit.products || [],
                                      grossMRP: trialVisit.grossMRP || 0,
                                      grossSalesBeforeTax: trialVisit.grossSalesBeforeTax || 0,
                                      taxAmount: trialVisit.taxAmount || 0,
                                      salesAfterTax: trialVisit.salesAfterTax || 0,
                                    });
                                  }
                                }}
                                sx={{ color: 'info.main', borderColor: 'info.main' }}
                              >
                                Same as prior trial
                              </Button>
                            )}
                            {watchedVisits.slice(0, activeVisit).some((visit) => visit.hearingAidBooked) && (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CheckIcon />}
                                onClick={() => {
                                  const bookingVisit = getValues('visits')
                                    .slice(0, activeVisit)
                                    .find((visit) => visit.hearingAidBooked);
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
                                      salesAfterTax: bookingVisit.salesAfterTax || 0,
                                    });
                                  }
                                }}
                                sx={{ color: 'warning.main', borderColor: 'warning.main' }}
                              >
                                Same as prior booking
                              </Button>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    )}

                    {showLockedDeviceCard && (
                      <Card
                        sx={{
                          mb: 4,
                          borderRadius: 2,
                          border: 2,
                          borderColor: 'info.main',
                          bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]),
                          backgroundImage: (theme) =>
                            `linear-gradient(135deg, ${theme.palette.info.light}14 0%, transparent 55%)`,
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
                            <LockOutlinedIcon sx={{ color: 'info.main', fontSize: 32 }} />
                            <Box>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: 'info.dark' }}>
                                Device locked to trial
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                This booking continues the trial device. Change the model under Trial (or turn off
                                &quot;booking from trial&quot;) if you need a different catalog selection.
                              </Typography>
                            </Box>
                          </Stack>
                          <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                              Trial device in use
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                  Brand / model
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {currentVisit.hearingAidBrand} {currentVisit.hearingAidModel}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                  Type / ear
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  {currentVisit.hearingAidType} / {currentVisit.whichEar}
                                </Typography>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <Typography variant="caption" color="text.secondary">
                                  MRP (per unit)
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  ₹ {Number(currentVisit.hearingAidPrice || 0).toLocaleString()}
                                </Typography>
                              </Grid>
                            </Grid>
                          </Box>
                        </CardContent>
                      </Card>
                    )}

                    {showTrialDeviceCard && (
                      <Card
                        sx={{
                          mb: 4,
                          borderRadius: 2,
                          border: 2,
                          borderColor: 'info.light',
                          bgcolor: '#e8f4fc',
                          boxShadow: (theme) => `0 8px 24px ${theme.palette.info.main}18`,
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
                            <ScienceOutlinedIcon sx={{ color: 'info.main', fontSize: 32 }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: 'info.dark' }}>
                                Trial hearing aid
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Pick exactly one catalog model for this trial. The dialog uses a single-choice layout
                                and keeps brand, model, and MRP (per unit) in sync.
                              </Typography>
                            </Box>
                          </Stack>

                          <Box
                            sx={{
                              mb: 3,
                              p: 2,
                              bgcolor: 'background.paper',
                              borderRadius: 2,
                              border: 1,
                              borderColor: 'info.light',
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'info.dark', fontWeight: 600 }}>
                              Catalog — trial device
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                              Search in the dialog; one model only. Clears trial name fields when empty.
                            </Typography>
                            <Stack spacing={2}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                                <Badge
                                  color="info"
                                  badgeContent={selectedCatalogProducts.length || undefined}
                                  invisible={selectedCatalogProducts.length === 0}
                                  overlap="rectangular"
                                >
                                  <Button
                                    variant="contained"
                                    color="info"
                                    size="large"
                                    startIcon={<ScienceOutlinedIcon />}
                                    onClick={() => openHearingAidCatalogDialog('trial')}
                                    sx={{ borderRadius: 2, px: 3, py: 1.25, textTransform: 'none', fontWeight: 600 }}
                                  >
                                    Choose trial model
                                  </Button>
                                </Badge>
                                <Button
                                  variant="outlined"
                                  color="info"
                                  size="medium"
                                  onClick={() => applyCatalogHearingAidSelection(activeVisit, [])}
                                  disabled={selectedCatalogProducts.length === 0}
                                  sx={{ borderRadius: 2 }}
                                >
                                  Clear trial device
                                </Button>
                              </Stack>
                              {selectedCatalogProducts.length > 0 ? (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                                    Selected for trial
                                  </Typography>
                                  <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75}>
                                    {selectedCatalogProducts.map((p, idx) => (
                                      <Chip
                                        key={`trial-${p.id}-${idx}`}
                                        label={`${p.company ? `${p.company} ` : ''}${p.name}`}
                                        size="small"
                                        onDelete={() => removeCatalogProductFromVisit(p.id)}
                                        sx={{ maxWidth: '100%', borderRadius: 1.5 }}
                                      />
                                    ))}
                                  </Stack>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No trial model yet — open the picker above.
                                </Typography>
                              )}
                            </Stack>
                          </Box>

                          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'info.dark' }}>
                            Trial device details
                          </Typography>
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={3}>
                              <TextField
                                fullWidth
                                label="Device Brand"
                                value={brandDisplay}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAidBrand', e.target.value)}
                                helperText="From catalog"
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
                                  onChange={(e) =>
                                    updateVisit(activeVisit, 'whichEar', e.target.value)}
                                  label="Which Ear"
                                  sx={{ borderRadius: 2, minWidth: '200px' }}
                                  MenuProps={mergeMenuPropsForReselectClear(
                                    currentVisit.whichEar,
                                    () => updateVisit(activeVisit, 'whichEar', ''),
                                    undefined
                                  )}
                                >
                                  {earSideOpts.map((o) => (
                                    <MenuItem key={o.optionValue} value={o.optionValue}>
                                      {o.optionLabel}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <TextField
                                fullWidth
                                label="MRP (per unit)"
                                type="number"
                                value={currentVisit.hearingAidPrice}
                                onChange={(e) =>
                                  updateVisit(activeVisit, 'hearingAidPrice', parseFloat(e.target.value) || 0)
                                }
                                disabled={currentVisit.hearingAidBooked}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                }}
                              />
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    )}

                    {showBookingDeviceCard && (
                      <Card
                        sx={{
                          mb: 4,
                          borderRadius: 2,
                          border: 2,
                          borderColor: 'warning.main',
                          bgcolor: (t) =>
                            t.palette.mode === 'dark' ? alpha(t.palette.warning.main, 0.14) : '#fffaf0',
                          boxShadow: (theme) => `0 8px 24px ${theme.palette.warning.main}22`,
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
                            <BookmarkAddedIcon sx={{ color: 'warning.dark', fontSize: 32 }} />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                                Booking — hearing aid
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                One catalog model for this booking. MRP is per unit — use booking quantity and selling
                                price (per unit) in Booking details for totals.
                              </Typography>
                            </Box>
                          </Stack>

                          <Box
                            sx={{
                              mb: 3,
                              p: 2,
                              bgcolor: 'background.paper',
                              borderRadius: 2,
                              border: 1,
                              borderColor: 'warning.light',
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'warning.dark', fontWeight: 600 }}>
                              Catalog — booked model
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                              Single choice in the dialog. Sets primary brand, model, and catalog MRP (per unit).
                            </Typography>
                            <Stack spacing={2}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                                <Badge
                                  color="warning"
                                  badgeContent={selectedCatalogProducts.length || undefined}
                                  invisible={selectedCatalogProducts.length === 0}
                                  overlap="rectangular"
                                >
                                  <Button
                                    variant="contained"
                                    color="warning"
                                    size="large"
                                    startIcon={<BookmarkAddedIcon />}
                                    onClick={() => openHearingAidCatalogDialog('booking')}
                                    sx={{ borderRadius: 2, px: 3, py: 1.25, textTransform: 'none', fontWeight: 600 }}
                                  >
                                    Choose booking model
                                  </Button>
                                </Badge>
                                <Button
                                  variant="outlined"
                                  color="warning"
                                  size="medium"
                                  onClick={() => applyCatalogHearingAidSelection(activeVisit, [])}
                                  disabled={selectedCatalogProducts.length === 0}
                                  sx={{ borderRadius: 2 }}
                                >
                                  Clear model
                                </Button>
                              </Stack>
                              {selectedCatalogProducts.length > 0 ? (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                                    Booked model (catalog)
                                  </Typography>
                                  <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75}>
                                    {selectedCatalogProducts.map((p, idx) => (
                                      <Chip
                                        key={`book-${p.id}-${idx}`}
                                        label={`${p.company ? `${p.company} ` : ''}${p.name}`}
                                        size="small"
                                        onDelete={() => removeCatalogProductFromVisit(p.id)}
                                        sx={{ maxWidth: '100%', borderRadius: 1.5 }}
                                      />
                                    ))}
                                  </Stack>
                                </Box>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No model selected yet — open the picker above.
                                </Typography>
                              )}
                            </Stack>
                          </Box>

                          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'warning.dark' }}>
                            Booked device (per unit)
                          </Typography>
                          <Grid container spacing={3}>
                            <Grid item xs={12} md={3}>
                              <TextField
                                fullWidth
                                label="Device Brand"
                                value={brandDisplay}
                                onChange={(e) => updateVisit(activeVisit, 'hearingAidBrand', e.target.value)}
                                helperText="From catalog"
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
                                  onChange={(e) =>
                                    updateVisit(activeVisit, 'whichEar', e.target.value)}
                                  label="Which Ear"
                                  sx={{ borderRadius: 2, minWidth: '200px' }}
                                  MenuProps={mergeMenuPropsForReselectClear(
                                    currentVisit.whichEar,
                                    () => updateVisit(activeVisit, 'whichEar', ''),
                                    undefined
                                  )}
                                >
                                  {earSideOpts.map((o) => (
                                    <MenuItem key={o.optionValue} value={o.optionValue}>
                                      {o.optionLabel}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                              <TextField
                                fullWidth
                                label="MRP (per unit)"
                                type="number"
                                value={currentVisit.hearingAidPrice}
                                onChange={(e) =>
                                  updateVisit(activeVisit, 'hearingAidPrice', parseFloat(e.target.value) || 0)
                                }
                                disabled={currentVisit.hearingAidBooked}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                                }}
                              />
                            </Grid>
                          </Grid>
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
                                  MenuProps={mergeMenuPropsForReselectClear(
                                    currentVisit.trialHearingAidType,
                                    () => updateVisit(activeVisit, 'trialHearingAidType', ''),
                                    undefined
                                  )}
                                  onChange={(e) => {
                                    const trialType = String(e.target.value);
                                    updateVisit(activeVisit, 'trialHearingAidType', trialType);
                                    
                                    // Clear date fields if switching to office trial
                                    if (trialType === 'in_office') {
                                      updateVisit(activeVisit, 'trialDuration', 0);
                                      updateVisit(activeVisit, 'trialStartDate', '');
                                      updateVisit(activeVisit, 'trialEndDate', '');
                                      updateVisit(activeVisit, 'trialHomeSecurityDepositAmount', 0);
                                    }
                                  }}
                                  label="Trial Type"
                                  sx={{ borderRadius: 2, minWidth: '200px' }}
                                >
                                  {trialLocationOpts.map((o) => (
                                    <MenuItem key={o.optionValue} value={o.optionValue}>
                                      {o.optionLabel}
                                    </MenuItem>
                                  ))}
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
                                  onClick={() => {
                                    setInventoryPickerMode('hearing_device');
                                    setInventoryDialogOpen(true);
                                  }}
                                  sx={{ 
                                    height: 56,
                                    justifyContent: 'flex-start',
                                    pl: 2
                                  }}
                                  startIcon={<InventoryIcon />}
                                >
                                  {currentVisit.trialSerialNumber ? 
                                    `Selected: ${currentVisit.trialSerialNumber}` : 
                                    `Select device from stock (${hearingDeviceInventory.length})`
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

                            {currentVisit.trialHearingAidType === 'home' && (
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="Security deposit amount (agreed)"
                                  type="number"
                                  value={currentVisit.trialHomeSecurityDepositAmount || ''}
                                  onChange={(e) =>
                                    updateVisit(
                                      activeVisit,
                                      'trialHomeSecurityDepositAmount',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  InputProps={{
                                    startAdornment: (
                                      <InputAdornment position="start">
                                        <RupeeIcon />
                                      </InputAdornment>
                                    ),
                                  }}
                                  helperText="Refundable deposit for taking the device home. Record the actual collection under Payments & Billing (mode, reference, remarks)."
                                />
                              </Grid>
                            )}

                            {/* Trial Result & Refund fields */}
                            <Grid item xs={12} md={6}>
                              <FormControl fullWidth>
                                <InputLabel>Trial Result</InputLabel>
                                <Select
                                  value={currentVisit.trialResult || 'ongoing'}
                                  label="Trial Result"
                                  onChange={(e) => updateVisit(activeVisit, 'trialResult', e.target.value)}
                                >
                                  <MenuItem value="ongoing">Ongoing</MenuItem>
                                  <MenuItem value="successful">Successful</MenuItem>
                                  <MenuItem value="unsuccessful">Unsuccessful</MenuItem>
                                  <MenuItem value="extended">Extended</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                            
                            {currentVisit.trialResult === 'unsuccessful' && (
                              <>
                                <Grid item xs={12} md={3}>
                                  <TextField
                                    fullWidth
                                    label="Refund Amount"
                                    type="number"
                                    value={currentVisit.trialRefundAmount || ''}
                                    onChange={(e) => updateVisit(activeVisit, 'trialRefundAmount', parseFloat(e.target.value) || 0)}
                                    InputProps={{
                                      startAdornment: <InputAdornment position="start"><RupeeIcon /></InputAdornment>
                                    }}
                                  />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                  <TextField
                                    fullWidth
                                    label="Refund Date"
                                    type="date"
                                    value={currentVisit.trialRefundDate || ''}
                                    onChange={(e) => updateVisit(activeVisit, 'trialRefundDate', e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                  />
                                </Grid>
                              </>
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
                      <Card
                        sx={{
                          mb: 4,
                          bgcolor: (t) =>
                            t.palette.mode === 'dark' ? alpha(t.palette.warning.main, 0.12) : '#fffbf0',
                          borderRadius: 2,
                        }}
                      >
                        <CardContent sx={{ p: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <MedicalIcon sx={{ color: 'warning.main' }} />
                            <Typography variant="h6" sx={{ fontWeight: 600, color: 'warning.main' }}>
                              Booking Specific Details
                            </Typography>
                          </Box>

                          {trialOn && bookingOn && (
                            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
                              Hearing aid model and catalog selection for this visit are managed in the{' '}
                              <strong>Trial hearing aid</strong> section above. Use this card for amounts, dates, and
                              booking workflow only.
                            </Alert>
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
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Selling price (per unit)"
                                type="number"
                                value={currentVisit.bookingSellingPrice || ''}
                                onChange={(e) => updateVisit(activeVisit, 'bookingSellingPrice', parseFloat(e.target.value) || 0)}
                                InputProps={{
                                  startAdornment: <InputAdornment position="start">₹</InputAdornment>
                                }}
                                helperText="Per single unit. Booking total = this × quantity below; used for balance calculation."
                              />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                fullWidth
                                label="Quantity"
                                type="number"
                                value={currentVisit.bookingQuantity || 1}
                                onChange={(e) => updateVisit(activeVisit, 'bookingQuantity', Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                                inputProps={{ min: 1 }}
                              />
                            </Grid>
                          </Grid>

                          <Grid container spacing={2} sx={{ mt: 0.5 }}>
                            <Grid item xs={12} md={4}>
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" color="text.secondary">MRP (per unit)</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  ₹ {Number(currentVisit.hearingAidPrice || 0).toLocaleString()}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" color="text.secondary">Booking Total</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                  ₹ {((Number(currentVisit.bookingSellingPrice) || 0) * (Number(currentVisit.bookingQuantity) || 1)).toLocaleString()}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={12} md={4}>
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" color="text.secondary">Balance Amount</Typography>
                                <Typography variant="body1" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                                  ₹ {(() => {
                                    const gross =
                                      (Number(currentVisit.bookingSellingPrice) || 0) *
                                      (Number(currentVisit.bookingQuantity) || 1);
                                    const adv = Number(currentVisit.bookingAdvanceAmount) || 0;
                                    const sd = getBookingHomeTrialSecurityCredit(watchedVisits, activeVisit);
                                    return Math.max(gross - adv - sd, 0).toLocaleString();
                                  })()}
                                </Typography>
                                {getBookingHomeTrialSecurityCredit(watchedVisits, activeVisit) > 0 && (
                                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                    After booking advance and home trial security (
                                    {formatCurrency(getBookingHomeTrialSecurityCredit(watchedVisits, activeVisit))}{' '}
                                    treated as advance)
                                  </Typography>
                                )}
                              </Box>
                            </Grid>
                          </Grid>
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

                          {/* Credits toward sale: trial security + booking advance (total due = sale only when booking was superseded). */}
                          {(() => {
                            const advBook = findLinkedPriorBookingVisitWithAdvance(watchedVisits, activeVisit);
                            const saleSd = getSaleHomeTrialSecurityCredit(watchedVisits, activeVisit);
                            const saleAdv = getBookingAdvanceCreditForSale(watchedVisits, activeVisit);
                            if (saleSd <= 0 && saleAdv <= 0) return null;
                            const gross = Number(currentVisit.salesAfterTax) || 0;
                            const net = Math.max(gross - saleSd - saleAdv, 0);
                            return (
                              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                                {advBook &&
                                  (advBook.hearingAidBrand || advBook.hearingAidModel) &&
                                  saleAdv > 0 && (
                                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                                      Linked booking device: {(advBook.hearingAidBrand || '').toString()}{' '}
                                      {(advBook.hearingAidModel || '').toString()}
                                      {advBook.bookingDate || advBook.visitDate
                                        ? ` · ${advBook.bookingDate || advBook.visitDate}`
                                        : ''}
                                    </Typography>
                                  )}
                                <Typography variant="body2" component="div">
                                  {saleSd > 0 && (
                                    <>Trial security {formatCurrency(saleSd)} credited.</>
                                  )}
                                  {saleSd > 0 && saleAdv > 0 && <> </>}
                                  {saleAdv > 0 && (
                                    <>Booking advance {formatCurrency(saleAdv)} credited.</>
                                  )}{' '}
                                  Total due for this enquiry counts the sale invoice once; these prepayments are not
                                  double-counted.
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 1, fontWeight: 700 }}>
                                  Balance after credits: {formatCurrency(net)} (invoice {formatCurrency(gross)}).
                                </Typography>
                              </Alert>
                            );
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
                          <Box sx={{ mb: 2, p: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderRadius: 2 }}>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={3}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Which Ear</InputLabel>
                                  <Select
                                    value={currentVisit.whichEar}
                                    label="Which Ear"
                                    onChange={(e) =>
                                      updateVisit(activeVisit, 'whichEar', e.target.value)}
                                    sx={{ borderRadius: 2, minWidth: '200px' }}
                                    MenuProps={mergeMenuPropsForReselectClear(
                                      currentVisit.whichEar,
                                      () => updateVisit(activeVisit, 'whichEar', ''),
                                      undefined
                                    )}
                                  >
                                    {earSideOpts.map((o) => (
                                      <MenuItem key={o.optionValue} value={o.optionValue}>
                                        {o.optionLabel}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <Box sx={{ position: 'relative' }}>
                                  <FormControl fullWidth size="small">
                                    <InputLabel>Who Sold</InputLabel>
                                    <Select
                                      value={currentVisit.hearingAidBrand}
                                      onChange={(e) =>
                                        updateVisit(activeVisit, 'hearingAidBrand', e.target.value)
                                      }
                                      label="Who Sold"
                                      sx={{ borderRadius: 2, minWidth: '200px' }}
                                      MenuProps={mergeMenuPropsForReselectClear(
                                        currentVisit.hearingAidBrand,
                                        () => updateVisit(activeVisit, 'hearingAidBrand', ''),
                                        undefined
                                      )}
                                    >
                                      {(() => {
                                        const staffOpts = getStaffOptionsForField('sales');
                                        const cur = (currentVisit.hearingAidBrand || '').trim();
                                        const list =
                                          cur && !staffOpts.includes(cur)
                                            ? [cur, ...staffOpts]
                                            : staffOpts;
                                        return list.map((option) => (
                                          <MenuItem key={option} value={option}>
                                            {staffOpts.includes(option) ? `💼 ${option}` : `⚠ ${option} (not in staff list)`}
                                          </MenuItem>
                                        ));
                                      })()}
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
                                    const totals = sumHearingAidVisitTotals(products);
                                    updateVisitFields(activeVisit, {
                                      previousVisitId: trialVisit.id,
                                      hearingAidProductId: trialVisit.hearingAidProductId || '',
                                      // Do not copy trial device brand into hearingAidBrand on a sale — that field is "Who Sold" (staff).
                                      hearingAidModel: trialVisit.trialHearingAidModel || trialVisit.hearingAidModel || '',
                                      hearingAidType: trialVisit.hearingAidType || '',
                                      whichEar: trialVisit.whichEar || 'both',
                                      hearingAidPrice: typeof trialVisit.hearingAidPrice === 'number' ? (trialVisit.hearingAidPrice || 0) : 0,
                                      bookingSellingPrice: trialVisit.grossSalesBeforeTax || 0,
                                      bookingQuantity: Math.max(1, (products || []).reduce((sum, p) => sum + (Number(p.quantity) || 1), 0)),
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
                                    const rawProducts = bookingVisit.products || [];
                                    const products = reconcileLinesWithProductMaster(rawProducts);
                                    const bt = sumHearingAidVisitTotals(products);
                                    updateVisitFields(activeVisit, {
                                      previousVisitId: bookingVisit.id,
                                      hearingAidProductId: bookingVisit.hearingAidProductId || '',
                                      // Booking "brand" is the device manufacturer; on sale, hearingAidBrand is Who Sold (staff).
                                      hearingAidModel: bookingVisit.hearingAidModel || '',
                                      hearingAidType: bookingVisit.hearingAidType || '',
                                      whichEar: bookingVisit.whichEar || 'both',
                                      hearingAidPrice: bookingVisit.hearingAidPrice || 0,
                                      bookingSellingPrice: bookingVisit.bookingSellingPrice || bookingVisit.grossSalesBeforeTax || 0,
                                      bookingQuantity: bookingVisit.bookingQuantity || Math.max(1, (products || []).reduce((sum, p) => sum + (Number(p.quantity) || 1), 0)),
                                      products,
                                      grossMRP: bt.grossMRP,
                                      grossSalesBeforeTax: bt.grossSalesBeforeTax,
                                      taxAmount: bt.taxAmount,
                                      salesAfterTax: bt.salesAfterTax,
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
                          <Box
                            sx={{
                              mb: 4,
                              p: 3,
                              bgcolor: (t) =>
                                t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : '#f5f5f5',
                              borderRadius: 2,
                              border: 1,
                              borderColor: 'divider',
                            }}
                          >
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'text.secondary' }}>
                              Journey Tracking
                            </Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={4}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Continue from Previous Visit</InputLabel>
                                  <Select 
                                    value={currentVisit.previousVisitId}
                                    MenuProps={mergeMenuPropsForReselectClear(
                                      currentVisit.previousVisitId,
                                      () => updateVisit(activeVisit, 'previousVisitId', ''),
                                      undefined
                                    )}
                                    onChange={(e) => {
                                      const prevVisitId = String(e.target.value);
                                      updateVisit(activeVisit, 'previousVisitId', prevVisitId);
                                      
                                      if (prevVisitId) {
                                        // Find the previous visit and copy relevant data
                                        const previousVisit = watchedVisits.find(v => v.id === prevVisitId);
                                        if (previousVisit) {
                                          // Copy hearing aid journey ID or create new one
                                          const journeyId = previousVisit.hearingAidJourneyId || `journey_${Date.now()}`;
                                          updateVisit(activeVisit, 'hearingAidJourneyId', journeyId);
                                          
                                          // Copy basic hearing aid info if available
                                          {
                                            const saleCtx = getValues('visits')[activeVisit]?.hearingAidSale;
                                            if (saleCtx) {
                                              // On sale visits, hearingAidBrand = Who Sold — only copy from another sale visit.
                                              if (previousVisit.hearingAidSale && previousVisit.hearingAidBrand) {
                                                updateVisit(activeVisit, 'hearingAidBrand', previousVisit.hearingAidBrand);
                                              }
                                            } else if (previousVisit.hearingAidBrand) {
                                              updateVisit(activeVisit, 'hearingAidBrand', previousVisit.hearingAidBrand);
                                            }
                                            if (previousVisit.hearingAidModel) {
                                              updateVisit(activeVisit, 'hearingAidModel', previousVisit.hearingAidModel);
                                            }
                                            if (previousVisit.hearingAidType) {
                                              updateVisit(activeVisit, 'hearingAidType', previousVisit.hearingAidType);
                                            }
                                            if (previousVisit.whichEar) {
                                              updateVisit(activeVisit, 'whichEar', previousVisit.whichEar);
                                            }
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
                                    sx={{ borderRadius: 2, minWidth: '200px' }}
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
                                  onChange={(e) =>
                                    updateVisit(activeVisit, 'whichEar', e.target.value)}
                                  label="Which Ear"
                                  sx={{ borderRadius: 2, minWidth: '200px' }}
                                  MenuProps={mergeMenuPropsForReselectClear(
                                    currentVisit.whichEar,
                                    () => updateVisit(activeVisit, 'whichEar', ''),
                                    undefined
                                  )}
                                >
                                  {earSideOpts.map((o) => (
                                    <MenuItem key={o.optionValue} value={o.optionValue}>
                                      {o.optionLabel}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                              <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                                                  <Select 
                                    value={currentVisit.hearingAidStatus}
                                    onChange={(e) =>
                                      updateVisit(activeVisit, 'hearingAidStatus', e.target.value)}
                                    label="Status"
                                    sx={{ borderRadius: 2, minWidth: '200px' }}
                                    MenuProps={mergeMenuPropsForReselectClear(
                                      currentVisit.hearingAidStatus,
                                      () => updateVisit(activeVisit, 'hearingAidStatus', ''),
                                      undefined
                                    )}
                                  >
                                    {visitHaStatusOpts.map((o) => (
                                      <MenuItem key={o.optionValue} value={o.optionValue}>
                                        {o.optionLabel}
                                      </MenuItem>
                                    ))}
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
                                      MenuProps={mergeMenuPropsForReselectClear(
                                        currentVisit.trialHearingAidType,
                                        () => updateVisit(activeVisit, 'trialHearingAidType', ''),
                                        undefined
                                      )}
                                      onChange={(e) => {
                                        const trialType = String(e.target.value);
                                        updateVisit(activeVisit, 'trialHearingAidType', trialType);
                                        
                                        // Clear date fields if switching to office trial
                                        if (trialType === 'in_office') {
                                          updateVisit(activeVisit, 'trialDuration', 0);
                                          updateVisit(activeVisit, 'trialStartDate', '');
                                          updateVisit(activeVisit, 'trialEndDate', '');
                                          updateVisit(activeVisit, 'trialHomeSecurityDepositAmount', 0);
                                        }
                                      }}
                                      label="Trial Type"
                                      sx={{ borderRadius: 2, minWidth: '200px' }}
                                    >
                                      {trialLocationOpts.map((o) => (
                                        <MenuItem key={o.optionValue} value={o.optionValue}>
                                          {o.optionLabel}
                                        </MenuItem>
                                      ))}
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
                                      onClick={() => {
                                        setInventoryPickerMode('hearing_device');
                                        setInventoryDialogOpen(true);
                                      }}
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
                                        `Select device from stock (${hearingDeviceInventory.length})`
                                      }
                                    </Button>
                                  </Grid>
                                )}

                                {currentVisit.trialHearingAidType === 'home' && (
                                  <Grid item xs={12} md={6}>
                                    <TextField
                                      fullWidth
                                      label="Security deposit amount (agreed)"
                                      type="number"
                                      value={currentVisit.trialHomeSecurityDepositAmount || ''}
                                      onChange={(e) =>
                                        updateVisit(
                                          activeVisit,
                                          'trialHomeSecurityDepositAmount',
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      InputProps={{
                                        startAdornment: (
                                          <InputAdornment position="start">
                                            <RupeeIcon />
                                          </InputAdornment>
                                        ),
                                      }}
                                      helperText="Record collection in Payments & Billing (payment mode, reference, remarks)."
                                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
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
                            <Box
                              sx={{
                                mb: 4,
                                p: 3,
                                bgcolor: (t) =>
                                  t.palette.mode === 'dark' ? alpha(t.palette.warning.main, 0.12) : '#fffbf0',
                                borderRadius: 2,
                                border: 1,
                                borderColor: (t) =>
                                  t.palette.mode === 'dark'
                                    ? alpha(t.palette.warning.main, 0.35)
                                    : '#fff3e0',
                              }}
                            >
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'warning.main' }}>
                                Booking Details
                              </Typography>
                              
                              {/* Show relationship to previous visit */}
                              {currentVisit.previousVisitId && (
                                <Box
                                  sx={{
                                    mb: 2,
                                    p: 1.5,
                                    bgcolor: (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.18 : 0.1),
                                    borderRadius: 1,
                                    border: 1,
                                    borderColor: (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.4 : 0.2),
                                  }}
                                >
                                  <Typography variant="body2" sx={{ fontSize: '0.85rem', color: 'warning.light' }}>
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
                          <Box
                            sx={{
                              mb: 4,
                              p: 3,
                              bgcolor: 'background.paper',
                              borderRadius: 2,
                              border: 1,
                              borderColor: 'divider',
                              boxShadow: 1,
                            }}
                          >
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                Add sale line
                              </Typography>
                            </Stack>
                            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                              <strong>Same model, multiple devices:</strong> if stock has{' '}
                              <strong>no serial</strong>, use <strong>Quantity</strong> for several units on one line. If
                              each unit has a <strong>serial</strong>, quantity stays 1 — use <strong>Add line</strong>{' '}
                              again after each inventory pick (same model, different serials is allowed).
                            </Alert>

                            <Grid container spacing={2}>
                              <Grid item xs={12} md={5}>
                                <Button
                                  fullWidth
                                  variant="outlined"
                                  size="large"
                                  onClick={() => {
                                    setInventoryPickerMode('hearing_device');
                                    setInventoryDialogOpen(true);
                                  }}
                                  startIcon={<InventoryIcon />}
                                  sx={{
                                    minHeight: 56,
                                    borderStyle: 'dashed',
                                    borderWidth: 2,
                                    borderColor: currentProduct.inventoryId ? 'success.main' : 'grey.400',
                                    backgroundColor: currentProduct.inventoryId ? 'success.50' : 'transparent',
                                    '&:hover': {
                                      borderColor: currentProduct.inventoryId ? 'success.dark' : 'primary.main',
                                      backgroundColor: currentProduct.inventoryId ? 'success.100' : 'primary.50',
                                    },
                                  }}
                                >
                                  {currentProduct.inventoryId ? (
                                    <Box sx={{ textAlign: 'left', width: '100%' }}>
                                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.dark' }}>
                                        {currentProduct.name} — {currentProduct.company}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'success.main' }}>
                                        {currentProduct.serialNumber ? `SN: ${currentProduct.serialNumber}` : 'No serial'} · ₹
                                        {currentProduct.mrp?.toLocaleString()} ea.
                                      </Typography>
                                    </Box>
                                  ) : (
                                    <Typography>
                                      Select device stock ({inventoryPickerItems.length} lines)
                                    </Typography>
                                  )}
                                </Button>
                              </Grid>
                              <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Product name"
                                  value={currentProduct.name}
                                  onChange={(e) => setCurrentProduct((prev) => ({ ...prev, name: e.target.value }))}
                                />
                              </Grid>
                              <Grid item xs={6} sm={3} md={2}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="HSN"
                                  value={currentProduct.hsnCode}
                                  onChange={(e) => setCurrentProduct((prev) => ({ ...prev, hsnCode: e.target.value }))}
                                />
                              </Grid>
                              {saleLineIsPairProduct ? (
                                <Grid item xs={12} md={6}>
                                  <Stack spacing={1}>
                                    <ToggleButtonGroup
                                      exclusive
                                      size="small"
                                      value={salePairSaleMode}
                                      onChange={handleSalePairSaleModeChange}
                                      fullWidth
                                    >
                                      <ToggleButton value="single">Sell 1 device</ToggleButton>
                                      <ToggleButton value="pair">Sell both</ToggleButton>
                                    </ToggleButtonGroup>
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label={
                                        salePairSaleMode === 'pair'
                                          ? 'Serial 1 (Left/Right)'
                                          : 'Serial number'
                                      }
                                      value={saleSerialPrimary}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setSaleSerialPrimary(v);
                                        setCurrentProduct((prev) => {
                                          const nextSerial =
                                            salePairSaleMode === 'pair'
                                              ? [v.trim(), saleSerialSecondary.trim()].filter(Boolean).join(', ')
                                              : v.trim();
                                          return {
                                            ...prev,
                                            serialNumber: nextSerial,
                                            quantity: nextSerial ? 1 : Math.max(1, prev.quantity || 1),
                                          };
                                        });
                                      }}
                                      placeholder="S/N 1"
                                    />
                                    {salePairSaleMode === 'pair' && (
                                      <TextField
                                        fullWidth
                                        size="small"
                                        label="Serial 2 (Right/Left)"
                                        value={saleSerialSecondary}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setSaleSerialSecondary(v);
                                          setCurrentProduct((prev) => ({
                                            ...prev,
                                            serialNumber: [saleSerialPrimary.trim(), v.trim()]
                                              .filter(Boolean)
                                              .join(', '),
                                            quantity:
                                              saleSerialPrimary.trim() && v.trim()
                                                ? 1
                                                : Math.max(1, prev.quantity || 1),
                                          }));
                                        }}
                                        placeholder="S/N 2"
                                      />
                                    )}
                                    {salePairSaleMode === 'single' && salePairSerialOptions && (
                                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                        <Typography variant="caption" color="text.secondary">
                                          Which serial from this pair?
                                        </Typography>
                                        <ToggleButtonGroup
                                          exclusive
                                          size="small"
                                          value={
                                            saleSerialPrimary === salePairSerialOptions[0]
                                              ? '0'
                                              : saleSerialPrimary === salePairSerialOptions[1]
                                                ? '1'
                                                : '0'
                                          }
                                          onChange={(_, v) => {
                                            if (v == null) return;
                                            const sn = salePairSerialOptions[v === '0' ? 0 : 1];
                                            setSaleSerialPrimary(sn);
                                            setCurrentProduct((prev) => ({
                                              ...prev,
                                              serialNumber: sn,
                                              quantity: 1,
                                            }));
                                          }}
                                          fullWidth
                                        >
                                          <ToggleButton value="0">{salePairSerialOptions[0]}</ToggleButton>
                                          <ToggleButton value="1">{salePairSerialOptions[1]}</ToggleButton>
                                        </ToggleButtonGroup>
                                      </Stack>
                                    )}
                                  </Stack>
                                </Grid>
                              ) : (
                                <Grid item xs={6} sm={3} md={2}>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Serial no."
                                    value={currentProduct.serialNumber}
                                    onChange={(e) => {
                                      const sn = e.target.value;
                                      setCurrentProduct((prev) => ({
                                        ...prev,
                                        serialNumber: sn,
                                        quantity: sn.trim() ? 1 : Math.max(1, prev.quantity || 1),
                                      }));
                                    }}
                                    helperText={
                                      currentProduct.serialNumber?.trim()
                                        ? 'Quantity locked to 1 per serial'
                                        : undefined
                                    }
                                  />
                                </Grid>
                              )}

                              <Grid item xs={6} sm={4} md={2}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Quantity"
                                  type="number"
                                  disabled={saleLineSerialLocked}
                                  value={saleLineSerialLocked ? 1 : currentProduct.quantity}
                                  onChange={(e) =>
                                    setCurrentProduct((prev) => ({
                                      ...prev,
                                      quantity: Math.max(1, parseInt(e.target.value || '1', 10) || 1),
                                    }))
                                  }
                                  inputProps={{ min: 1, max: 9999 }}
                                  helperText="Same model & per-unit price"
                                />
                              </Grid>
                              <Grid item xs={6} sm={4} md={2}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label={
                                    saleLineIsPairProduct && salePairSaleMode === 'single'
                                      ? 'MRP (one device)'
                                      : 'MRP (per unit)'
                                  }
                                  type="number"
                                  value={currentProduct.mrp}
                                  onChange={(e) => {
                                    const newMrp = roundInrRupee(Number(e.target.value));
                                    setCurrentProduct((prev) => ({
                                      ...prev,
                                      mrp: newMrp,
                                      sellingPrice: newMrp > 0 ? newMrp : prev.sellingPrice,
                                    }));
                                  }}
                                  helperText={
                                    saleLineIsPairProduct && salePairSaleMode === 'pair'
                                      ? 'Full pair (catalog)'
                                      : saleLineIsPairProduct && salePairSaleMode === 'single'
                                        ? 'Half of pair catalog MRP'
                                        : undefined
                                  }
                                />
                              </Grid>
                              <Grid item xs={6} sm={4} md={2}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Selling price (per unit)"
                                  type="number"
                                  value={currentProduct.sellingPrice}
                                  onChange={(e) => updateSellingPrice(Number(e.target.value))}
                                  inputProps={{ step: 1, min: 0 }}
                                />
                              </Grid>
                              <Grid item xs={6} sm={4} md={2}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Discount %"
                                  type="number"
                                  value={currentProduct.discountPercent}
                                  InputProps={{ readOnly: true }}
                                  inputProps={{ step: 0.01, min: 0, max: 100 }}
                                  helperText="From MRP vs selling price"
                                />
                              </Grid>
                              <Grid item xs={6} sm={4} md={2}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label={currentProduct.gstPercent === 0 ? 'GST % (exempt)' : 'GST %'}
                                  type="number"
                                  value={currentProduct.gstPercent}
                                  onChange={(e) =>
                                    setCurrentProduct((prev) => ({ ...prev, gstPercent: Number(e.target.value) }))
                                  }
                                  disabled={currentProduct.productId !== '' && currentProduct.gstPercent === 0}
                                  sx={{
                                    '& .MuiInputBase-input': {
                                      color: currentProduct.gstPercent === 0 ? 'text.secondary' : 'text.primary',
                                    },
                                    '& .MuiInputLabel-root': {
                                      color: currentProduct.gstPercent === 0 ? 'warning.main' : 'text.secondary',
                                    },
                                  }}
                                />
                              </Grid>
                              <Grid item xs={12} sm={6} md={2}>
                                <FormControl fullWidth size="small">
                                  <InputLabel id="sale-line-warranty-label">Warranty</InputLabel>
                                  <Select
                                    labelId="sale-line-warranty-label"
                                    label="Warranty"
                                    value={currentProduct.warranty || ''}
                                    onChange={(e) =>
                                      setCurrentProduct((prev) => ({
                                        ...prev,
                                        warranty: String(e.target.value),
                                      }))
                                    }
                                    displayEmpty
                                    MenuProps={mergeMenuPropsForReselectClear(
                                      currentProduct.warranty || '',
                                      () =>
                                        setCurrentProduct((prev) => ({
                                          ...prev,
                                          warranty: '',
                                        })),
                                      undefined
                                    )}
                                  >
                                    <MenuItem value="">
                                      <em>None</em>
                                    </MenuItem>
                                    {currentProduct.warranty &&
                                      !(
                                        HEARING_AID_SALE_WARRANTY_OPTIONS as readonly string[]
                                      ).includes(currentProduct.warranty) && (
                                        <MenuItem value={currentProduct.warranty}>
                                          {currentProduct.warranty} (other)
                                        </MenuItem>
                                      )}
                                    {HEARING_AID_SALE_WARRANTY_OPTIONS.map((opt) => (
                                      <MenuItem key={opt} value={opt}>
                                        {opt}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                            </Grid>

                            {currentProduct.mrp > 0 && (
                              <Paper variant="outlined" sx={{ mt: 2, p: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderRadius: 2 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                  Line preview × {saleLineQtyPreview} unit{saleLineQtyPreview !== 1 ? 's' : ''}
                                </Typography>
                                <Grid container spacing={2} alignItems="center">
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary">
                                      Discount (line)
                                    </Typography>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'error.main' }}>
                                      {formatCurrencySale(currentProduct.discountAmount * saleLineQtyPreview)}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary">
                                      GST (line){' '}
                                      {currentProduct.gstPercent === 0 && '(exempt)'}
                                    </Typography>
                                    <Typography
                                      variant="subtitle1"
                                      sx={{
                                        fontWeight: 700,
                                        color: currentProduct.gstPercent === 0 ? 'text.secondary' : 'warning.main',
                                      }}
                                    >
                                      {currentProduct.gstPercent === 0
                                        ? '—'
                                        : formatCurrencySale(currentProduct.gstAmount * saleLineQtyPreview)}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6} sm={3}>
                                    <Typography variant="caption" color="text.secondary">
                                      Final (line)
                                    </Typography>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.main' }}>
                                      {formatCurrencySale(currentProduct.finalAmount * saleLineQtyPreview)}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={12} sm={3}>
                                    <Button
                                      fullWidth
                                      variant="contained"
                                      onClick={addProduct}
                                      startIcon={<AddIcon />}
                                      disabled={!currentProduct.name || currentProduct.mrp <= 0}
                                      sx={{ borderRadius: 2, py: 1.25 }}
                                    >
                                      Add line
                                    </Button>
                                  </Grid>
                                </Grid>
                              </Paper>
                            )}

                            {currentProduct.mrp === 0 && (
                              <Box sx={{ mt: 2 }}>
                                <Button
                                  variant="contained"
                                  onClick={addProduct}
                                  startIcon={<AddIcon />}
                                  disabled={!currentProduct.name || currentProduct.mrp <= 0}
                                  sx={{ borderRadius: 2 }}
                                >
                                  Add line
                                </Button>
                              </Box>
                            )}
                          </Box>

                          {currentVisit.products.length > 0 && (
                            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 2, mb: 2 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                                    <TableCell sx={{ fontWeight: 700 }}>Product</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>HSN</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Serial</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                                      Qty
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                      MRP (ea.)
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                      Sell (ea.)
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                      Disc. %
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>GST</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                      Line total
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                                      {' '}
                                    </TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {currentVisit.products.map((product, index) => {
                                    const q = hearingAidLineQty(product);
                                    const discPct = roundDiscountPercent(product.discountPercent);
                                    return (
                                      <TableRow key={product.id} hover>
                                        <TableCell>
                                          <Typography variant="body2" fontWeight={600}>
                                            {product.name}
                                          </Typography>
                                          {product.company && (
                                            <Typography variant="caption" color="text.secondary">
                                              {product.company}
                                            </Typography>
                                          )}
                                        </TableCell>
                                        <TableCell>{product.hsnCode || '—'}</TableCell>
                                        <TableCell>{product.serialNumber || '—'}</TableCell>
                                        <TableCell align="center" sx={{ minWidth: 88 }}>
                                          {product.serialNumber?.trim() ? (
                                            <Chip label="1" size="small" variant="outlined" />
                                          ) : (
                                            <TextField
                                              size="small"
                                              type="number"
                                              value={q}
                                              onChange={(e) =>
                                                updateSaleProductLine(index, {
                                                  quantity: Math.max(1, parseInt(e.target.value || '1', 10) || 1),
                                                })
                                              }
                                              inputProps={{ min: 1, max: 9999, style: { textAlign: 'center' } }}
                                              sx={{ width: 72 }}
                                            />
                                          )}
                                        </TableCell>
                                        <TableCell align="right">{formatCurrencySale(product.mrp)}</TableCell>
                                        <TableCell align="right">{formatCurrencySale(product.sellingPrice)}</TableCell>
                                        <TableCell align="right">{discPct.toFixed(2)}%</TableCell>
                                        <TableCell
                                          sx={{
                                            color: product.gstPercent === 0 ? 'text.secondary' : 'text.primary',
                                            fontStyle: product.gstPercent === 0 ? 'italic' : 'normal',
                                          }}
                                        >
                                          {product.gstPercent === 0 ? 'Exempt' : `${product.gstPercent}%`}
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                                          {formatCurrencySale(product.finalAmount * q)}
                                        </TableCell>
                                        <TableCell align="right">
                                          <IconButton size="small" onClick={() => removeProduct(index)} color="error">
                                            <DeleteIcon />
                                          </IconButton>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                                <TableBody>
                                  <TableRow sx={{ bgcolor: 'primary.50' }}>
                                    <TableCell colSpan={4} sx={{ fontWeight: 800 }}>
                                      Totals
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                                      {formatCurrencySale(currentVisit.grossMRP)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                                      {formatCurrencySale(currentVisit.grossSalesBeforeTax)}
                                    </TableCell>
                                    <TableCell align="right">—</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                                      {formatCurrencySale(currentVisit.taxAmount)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                      {formatCurrencySale(currentVisit.salesAfterTax)}
                                    </TableCell>
                                    <TableCell />
                                  </TableRow>
                                </TableBody>
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

                            {/* Devices to return: multi-select from prior sales or manual rows */}
                            <Grid item xs={12}>
                              {serialSelectionMode === 'dropdown' ? (
                                <Box>
                                  <Autocomplete
                                    multiple
                                    options={previousSales}
                                    disableCloseOnSelect
                                    getOptionLabel={(sale) =>
                                      `${sale.serialNumber} — ${sale.productName || 'Product'} (${sale.brand || ''} ${sale.model || ''})`.trim()
                                    }
                                    isOptionEqualToValue={(a, b) => a.serialNumber === b.serialNumber}
                                    value={previousSales.filter((sale) =>
                                      (currentVisit.salesReturnItems || []).some(
                                        (line) => line.serialNumber === sale.serialNumber
                                      )
                                    )}
                                    onChange={(_, newValue) => {
                                      const prevLines = currentVisit.salesReturnItems || [];
                                      const fromPicker: SalesReturnLine[] = newValue.map((sale, i) => ({
                                        id: `pick-${sale.serialNumber}-${i}`,
                                        serialNumber: sale.serialNumber,
                                        model: String(sale.model || '').trim(),
                                        productName: sale.productName,
                                        brand: sale.brand,
                                        visitIndex: sale.visitIndex,
                                        saleDate: sale.saleDate,
                                        finalAmount: sale.finalAmount,
                                      }));
                                      const manualOnly = prevLines.filter(
                                        (line) =>
                                          !previousSales.some((ps) => ps.serialNumber === line.serialNumber)
                                      );
                                      const merged = [...fromPicker, ...manualOnly];
                                      const first = fromPicker[0];
                                      updateVisitFields(activeVisit, {
                                        salesReturnItems: merged,
                                        returnSerialNumber: linesToLegacyReturnSerialString(merged),
                                        returnOriginalSaleDate: first?.saleDate || '',
                                        returnOriginalSaleVisitId:
                                          first?.visitIndex != null ? String(first.visitIndex) : '',
                                      });
                                    }}
                                    renderInput={(params) => (
                                      <TextField
                                        {...params}
                                        label="Select devices from previous sales"
                                        placeholder={
                                          previousSales.length ? 'Choose one or more serial numbers' : ''
                                        }
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                      />
                                    )}
                                    renderOption={(props, sale) => (
                                      <li {...props} key={sale.serialNumber}>
                                        <Box>
                                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                            S/N: {sale.serialNumber}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary" display="block">
                                            {sale.productName} • {sale.brand} {sale.model}
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary" display="block">
                                            Sold on: {sale.saleDate} • {formatCurrencySale(sale.finalAmount ?? 0)}
                                          </Typography>
                                        </Box>
                                      </li>
                                    )}
                                  />
                                  {previousSales.length === 0 && (
                                    <FormHelperText sx={{ mt: 1 }}>
                                      No previous sales found. Add a sale visit first or use manual entry.
                                    </FormHelperText>
                                  )}
                                  {(currentVisit.salesReturnItems || []).some(
                                    (line) =>
                                      !previousSales.some((ps) => ps.serialNumber === line.serialNumber)
                                  ) && (
                                    <Alert severity="info" sx={{ mt: 2 }}>
                                      Some devices were entered manually and are not shown in the list above.
                                      Switch to &quot;Enter Manually&quot; to edit them.
                                    </Alert>
                                  )}
                                </Box>
                              ) : (
                                <Box>
                                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                    Devices to return (serial + model per row)
                                  </Typography>
                                  {(currentVisit.salesReturnItems || []).map((line, idx) => (
                                    <Grid
                                      container
                                      spacing={1}
                                      key={line.id}
                                      sx={{ mb: 1, alignItems: 'center' }}
                                    >
                                      <Grid item xs={12} sm={5}>
                                        <TextField
                                          fullWidth
                                          size="small"
                                          label="Serial number"
                                          value={line.serialNumber}
                                          onChange={(e) => {
                                            const next = [...(currentVisit.salesReturnItems || [])];
                                            next[idx] = {
                                              ...next[idx],
                                              serialNumber: e.target.value,
                                            };
                                            updateVisitFields(activeVisit, {
                                              salesReturnItems: next,
                                              returnSerialNumber: linesToLegacyReturnSerialString(next),
                                            });
                                          }}
                                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                        />
                                      </Grid>
                                      <Grid item xs={12} sm={5}>
                                        <TextField
                                          fullWidth
                                          size="small"
                                          label="Hearing aid model"
                                          value={line.model}
                                          onChange={(e) => {
                                            const next = [...(currentVisit.salesReturnItems || [])];
                                            next[idx] = { ...next[idx], model: e.target.value };
                                            updateVisitFields(activeVisit, { salesReturnItems: next });
                                          }}
                                          placeholder="e.g. Pure Charge&Go AX"
                                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                        />
                                      </Grid>
                                      <Grid item xs={12} sm={2}>
                                        <IconButton
                                          aria-label="Remove device"
                                          color="error"
                                          onClick={() => {
                                            const next = (currentVisit.salesReturnItems || []).filter(
                                              (_, i) => i !== idx
                                            );
                                            updateVisitFields(activeVisit, {
                                              salesReturnItems: next,
                                              returnSerialNumber: linesToLegacyReturnSerialString(next),
                                            });
                                          }}
                                        >
                                          <DeleteIcon />
                                        </IconButton>
                                      </Grid>
                                    </Grid>
                                  ))}
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<AddIcon />}
                                    onClick={() => {
                                      const next = [
                                        ...(currentVisit.salesReturnItems || []),
                                        {
                                          id: newSalesReturnLineId(),
                                          serialNumber: '',
                                          model: '',
                                        },
                                      ];
                                      updateVisitFields(activeVisit, {
                                        salesReturnItems: next,
                                        returnSerialNumber: linesToLegacyReturnSerialString(next),
                                      });
                                    }}
                                    sx={{ mt: 1 }}
                                  >
                                    Add device
                                  </Button>
                                </Box>
                              )}
                            </Grid>

                            {/* Summary of selected lines (dropdown mode) */}
                            {serialSelectionMode === 'dropdown' &&
                              (currentVisit.salesReturnItems || []).length > 0 && (
                                <Grid item xs={12}>
                                  <Paper
                                    sx={{ p: 2, bgcolor: 'primary.50', borderRadius: 2, border: 1, borderColor: 'primary.100' }}
                                  >
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.dark', mb: 1 }}>
                                      Selected devices
                                    </Typography>
                                    <Stack spacing={1}>
                                      {(currentVisit.salesReturnItems || []).map((line) => (
                                        <Box
                                          key={line.id}
                                          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}
                                        >
                                          <Chip size="small" label={`S/N: ${line.serialNumber || '—'}`} />
                                          {line.model ? (
                                            <Chip size="small" variant="outlined" label={line.model} />
                                          ) : null}
                                          {line.productName ? (
                                            <Typography variant="caption" color="text.secondary">
                                              {line.productName}
                                              {line.saleDate ? ` • ${line.saleDate}` : ''}
                                            </Typography>
                                          ) : null}
                                        </Box>
                                      ))}
                                    </Stack>
                                  </Paper>
                                </Grid>
                              )}

                            {/* Return Condition */}
                            <Grid item xs={12} md={6}>
                              <FormControl fullWidth>
                                <InputLabel>Return Condition</InputLabel>
                                <Select
                                  value={currentVisit.returnCondition}
                                  label="Return Condition"
                                  onChange={(e) =>
                                    updateVisit(activeVisit, 'returnCondition', e.target.value)}
                                  sx={{ borderRadius: 2 }}
                                  MenuProps={mergeMenuPropsForReselectClear(
                                    currentVisit.returnCondition,
                                    () => updateVisit(activeVisit, 'returnCondition', ''),
                                    undefined
                                  )}
                                >
                                  {deviceConditionOpts.map((o) => (
                                    <MenuItem key={o.optionValue} value={o.optionValue}>
                                      {o.optionLabel}
                                    </MenuItem>
                                  ))}
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
                              <Stack spacing={1.5}>
                                <Button
                                  fullWidth
                                  variant="outlined"
                                  size="small"
                                  startIcon={<InventoryIcon />}
                                  onClick={() => {
                                    setInventoryPickerMode('accessory');
                                    setInventoryDialogOpen(true);
                                  }}
                                  sx={{ textTransform: 'none', borderRadius: 2 }}
                                >
                                  Select from accessory stock ({accessoryInventory.length} lines)
                                </Button>
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
                                  MenuProps={mergeMenuPropsForReselectClear(
                                    getValues('visits')[activeVisit]?.accessoryName || '',
                                    () => {
                                      const currentVisits = getValues('visits');
                                      const updatedVisits = [...currentVisits];
                                      updatedVisits[activeVisit] = {
                                        ...updatedVisits[activeVisit],
                                        accessoryName: '',
                                        accessoryAmount: 0,
                                        accessoryFOC: false,
                                      };
                                      setValue('visits', updatedVisits);
                                    },
                                    undefined
                                  )}
                                  onChange={(e) => {
                                    const currentVisits = getValues('visits');
                                    const selectedValue = String(e.target.value);
                                    console.log('=== ACCESSORY SELECTION START ===');
                                    console.log('Selected value:', selectedValue);
                                    console.log('Active visit index:', activeVisit);
                                    
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
                                      isAccessoryCatalogProductType(p)
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
                                    .filter((product) => isAccessoryCatalogProductType(product))
                                    .length === 0 ? (
                                    <MenuItem disabled>
                                      <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                        No accessory products available
                                      </Typography>
                                    </MenuItem>
                                  ) : (
                                    products
                                      .filter((product) => isAccessoryCatalogProductType(product))
                                      .map(product => (
                                        <MenuItem key={product.id} value={product.name}>
                                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                            <Typography>{product.name}{product.company ? ` - ${product.company}` : ''}</Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                              <Chip 
                                                label={product.type} 
                                                size="small" 
                                                color={accessoryServiceProductChipColor(product.type)} 
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
                              </Stack>
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
                                          isAccessoryCatalogProductType(p)
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
                                    {products.find(p => p.name === accessoryName && isAccessoryCatalogProductType(p)) && (
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
                                    onChange={(e) =>
                                      updateVisit(activeVisit, 'programmingDoneBy', e.target.value)
                                    }
                                    label="Programming Done By"
                                    sx={{ borderRadius: 2, minWidth: '200px' }}
                                    MenuProps={mergeMenuPropsForReselectClear(
                                      currentVisit.programmingDoneBy,
                                      () => updateVisit(activeVisit, 'programmingDoneBy', ''),
                                      undefined
                                    )}
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
                                    setCurrentField('programmingBy');
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
                                    {serviceLineOpts.map((o) => (
                                      <MenuItem key={o.optionValue} value={o.optionValue}>
                                        {o.optionLabel}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                  <InputLabel>Session By</InputLabel>
                                  <Select
                                    value={currentVisit.testDoneBy}
                                    onChange={(e) =>
                                      updateVisit(activeVisit, 'testDoneBy', e.target.value)
                                    }
                                    label="Session By"
                                    sx={{ borderRadius: 2, minWidth: '200px' }}
                                    MenuProps={mergeMenuPropsForReselectClear(
                                      currentVisit.testDoneBy,
                                      () => updateVisit(activeVisit, 'testDoneBy', ''),
                                      undefined
                                    )}
                                  >
                                    {getStaffOptionsForField('testBy').map(option => (
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
                            onChange={(e) =>
                              handleFollowUpChange('callerName', e.target.value)
                            }
                            label="Call Done By *"
                            sx={{ borderRadius: 2 }}
                            MenuProps={mergeMenuPropsForReselectClear(
                              currentFollowUp.callerName,
                              () => handleFollowUpChange('callerName', ''),
                              undefined
                            )}
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
                            setCurrentField('telecaller');
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
                    bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), 
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderStyle: 'dashed'
                  }}>
                    <EventIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
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
                          <Typography variant="body2" color="text.secondary">Money In</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {formatCurrency(calculateTotalIncoming())}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Money Out (Refunds)</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'error.main' }}>
                            {formatCurrency(calculateTotalOutgoing())}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Net Collected</Typography>
                          <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                            {formatCurrency(calculateTotalPaid())}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Outstanding: {formatCurrency(calculateOutstanding())}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12}>
                        <Box sx={{ textAlign: 'center', mt: -1 }}>
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
                          value={
                            currentPayment.paymentFor === 'trial_home_security_deposit' &&
                            currentPayment.relatedVisitId
                              ? `trial_sd__${currentPayment.relatedVisitId}`
                              : currentPayment.paymentFor === 'trial_home_security_deposit_refund' &&
                                currentPayment.relatedVisitId
                              ? `trial_sd_ref__${currentPayment.relatedVisitId}`
                              : currentPayment.paymentFor
                          }
                          onChange={(e) => handlePaymentPurposeRawChange(String(e.target.value))}
                          label="Payment For"
                          sx={{ borderRadius: 2 }}
                        >
                          {getAvailablePaymentOptions().map((option) => {
                            const visitId = (option as { visitId?: string }).visitId;
                            const selectValue = visitId
                              ? (option.value === 'trial_home_security_deposit_refund' ? `trial_sd_ref__${visitId}` : `trial_sd__${visitId}`)
                              : option.value;
                            return (
                            <MenuItem key={selectValue} value={selectValue}>
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
                          );
                          })}
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
                            : currentPayment.paymentFor === 'trial_home_security_deposit'
                            ? 'Matches home trial security amount for this visit'
                            : currentPayment.paymentFor === 'trial_home_security_deposit_refund'
                            ? 'Outgoing refund amount (money out). Record this on a separate refund/follow-up visit date.'
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
                          {paymentModeOpts.map((o) => (
                            <MenuItem key={o.optionValue} value={o.optionValue}>
                              {o.optionLabel}
                            </MenuItem>
                          ))}
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
                          .map((option) => {
                            const vid = (option as { visitId?: string }).visitId;
                            const chipActive =
                              option.value === 'trial_home_security_deposit' && vid
                                ? currentPayment.paymentFor === 'trial_home_security_deposit' &&
                                  currentPayment.relatedVisitId === vid
                                : option.value === 'trial_home_security_deposit_refund' && vid
                                ? currentPayment.paymentFor === 'trial_home_security_deposit_refund' &&
                                  currentPayment.relatedVisitId === vid
                                : currentPayment.paymentFor === option.value;
                            return (
                            <Chip
                              key={vid ? `${option.value}-${vid}` : option.value}
                              label={`${option.label} - ${formatCurrency(option.amount)}`}
                              variant="outlined"
                              size="small"
                              clickable
                              onClick={() =>
                                vid
                                  ? handlePaymentPurposeRawChange(
                                      option.value === 'trial_home_security_deposit_refund'
                                        ? `trial_sd_ref__${vid}`
                                        : `trial_sd__${vid}`
                                    )
                                  : handlePaymentForChange(option.value as PaymentRecord['paymentFor'])
                              }
                              color={chipActive ? 'primary' : 'default'}
                              sx={{ cursor: 'pointer' }}
                            />
                          );
                          })}
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
                             <TableCell sx={{ fontWeight: 600 }}>Direction</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Payment Mode</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Reference</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Remarks</TableCell>
                             <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                           </TableRow>
                         </TableHead>
                         <TableBody>
                           {payments.map((payment) => {
                              const paymentForLabels: Record<string, string> = {
                               hearing_test: 'Hearing Test',
                               ent_service: 'ENT service',
                               hearing_aid: 'Hearing Aid',
                               accessory: 'Accessory',
                                booking_advance: 'Booking Advance',
                               trial_home_security_deposit: 'Home trial security deposit',
                               trial_home_security_deposit_refund: 'Home trial security deposit refund',
                               programming: 'Programming',
                               full_payment: 'Full Payment',
                               partial_payment: 'Partial Payment',
                               other: 'Other'
                             };
                             
                              const paymentForColors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'default' | 'error'> = {
                               hearing_test: 'primary',
                               ent_service: 'secondary',
                               hearing_aid: 'secondary',
                               accessory: 'success',
                                booking_advance: 'warning',
                               trial_home_security_deposit: 'info',
                               trial_home_security_deposit_refund: 'error',
                               programming: 'default',
                               full_payment: 'info',
                               partial_payment: 'warning',
                               other: 'default'
                             };
                             
                             return (
                               <TableRow key={payment.id}>
                                 <TableCell>{payment.paymentDate}</TableCell>
                                 <TableCell>
                                   <Chip 
                                     label={
                                      (payment.paymentFor === 'trial_home_security_deposit' || payment.paymentFor === 'trial_home_security_deposit_refund') && payment.relatedVisitId
                                         ? `${paymentForLabels[payment.paymentFor]} (Visit ${payment.relatedVisitId})`
                                         : paymentForLabels[payment.paymentFor] || payment.paymentFor
                                     } 
                                     size="small" 
                                     color={paymentForColors[payment.paymentFor] || 'default'} 
                                     variant="outlined" 
                                   />
                                 </TableCell>
                                 <TableCell>
                                   <Chip
                                     size="small"
                                     variant="outlined"
                                     color={isOutgoingPayment(payment.paymentFor) ? 'error' : 'success'}
                                     label={isOutgoingPayment(payment.paymentFor) ? 'OUT' : 'IN'}
                                   />
                                 </TableCell>
                                 <TableCell sx={{ fontWeight: 600, color: isOutgoingPayment(payment.paymentFor) ? 'error.main' : 'success.main' }}>
                                   {isOutgoingPayment(payment.paymentFor) ? '-' : '+'}{formatCurrency(payment.amount)}
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
                             <TableCell sx={{ fontWeight: 700 }}>Net Collected</TableCell>
                             <TableCell></TableCell>
                             <TableCell></TableCell>
                             <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>
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
                  <Box sx={{ p: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Name</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>{watchName}</Typography>
                  </Box>
                </Grid>
                {watchCustomerName && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderRadius: 2 }}>
                      <Typography variant="body2" color="text.secondary">Customer Name</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>{watchCustomerName}</Typography>
                    </Box>
                  </Grid>
                )}
                {!isAudiologist && (
                  <Grid item xs={12} md={6}>
                    <Box sx={{ p: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderRadius: 2 }}>
                      <Typography variant="body2" color="text.secondary">Phone</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>{watchPhone}</Typography>
                    </Box>
                  </Grid>
                )}
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Email</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>{watch('email') || 'Not provided'}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ p: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Reference</Typography>
                    <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(watch('reference') || []).length > 0 ? (
                        (watch('reference') as string[]).map((ref) => (
                          <Chip
                            key={ref}
                            label={ref}
                            size="small"
                            sx={{ borderRadius: 1 }}
                          />
                        ))
                      ) : (
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          Not specified
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ p: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary">Address</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>{watch('address') || 'Not provided'}</Typography>
                  </Box>
                </Grid>
                {watch('hotEnquiry') && (
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'warning.main',
                        bgcolor: (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.14 : 0.1),
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        Lead priority
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                        Hot enquiry — will be highlighted in CRM
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Card>

            <Card elevation={3} sx={{ p: 4, mb: 4, borderRadius: 3 }}>
              <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: 'secondary.main' }}>
                Visits Summary ({watchedVisits.length})
              </Typography>
              {watchedVisits.map((visit, index) => (
                <Card key={visit.id} sx={{ p: 3, mb: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderRadius: 2 }}>
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
                        {visit.entService && (
                          <Chip label="ENT service" color="secondary" size="small" />
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
                        {!visit.hearingTest &&
                          !visit.entService &&
                          !(visit.hearingAidTrial || visit.hearingAidBooked || visit.hearingAidSale) &&
                          !visit.accessory &&
                          !visit.programming &&
                          !visit.repair &&
                          !visit.counselling && (
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
                                  {visit.trialHearingAidType === 'home' &&
                                    Number(visit.trialHomeSecurityDepositAmount) > 0 && (
                                      <Typography variant="body2">
                                        Home trial security deposit (agreed):{' '}
                                        {formatCurrency(Number(visit.trialHomeSecurityDepositAmount))}
                                        {' — '}
                                        collect under Payments & Billing.
                                      </Typography>
                                    )}
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
                  
                  {/* Audiogram — not on review step (same as main step); profile shows charts after save */}
                  {visit.hearingTest && (visit.audiogramData || visit.externalPtaReport?.viewUrl) && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Audiogram / PTA details are not previewed here — they appear on the patient profile after you save this
                      enquiry.
                    </Alert>
                  )}
                  {visit.hearingTest && visit.externalPtaReport?.viewUrl && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, color: 'primary.main' }}>
                        External PTA report
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {visit.externalPtaReport.patientLabel} (ID: {visit.externalPtaReport.reportId})
                        {visit.externalPtaReport.testDate
                          ? ` · Test: ${formatPtaTestDateForDisplay(visit.externalPtaReport.testDate)}`
                          : ''}
                      </Typography>
                      <MuiLink href={visit.externalPtaReport.viewUrl} target="_blank" rel="noopener noreferrer" variant="body2">
                        Open PTA report
                      </MuiLink>
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
                        <Typography variant="body2" color="text.secondary">Money In</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'success.main' }}>
                          {formatCurrency(calculateTotalIncoming())}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, bgcolor: 'error.50', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Money Out (Refunds)</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'error.main' }}>
                          {formatCurrency(calculateTotalOutgoing())}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Net Collected</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {formatCurrency(totalPaid)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Outstanding: {formatCurrency(outstanding)}
                        </Typography>
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
                         const paymentForLabels: Record<string, string> = {
                           hearing_test: 'Hearing Test',
                           hearing_aid: 'Hearing Aid',
                           accessory: 'Accessory',
                           booking_advance: 'Booking Advance',
                           trial_home_security_deposit: 'Home trial security deposit',
                           trial_home_security_deposit_refund: 'Home trial security deposit refund',
                           programming: 'Programming',
                           full_payment: 'Full Payment',
                           partial_payment: 'Partial Payment',
                           other: 'Other'
                         };
                         const forLabel =
                           payment.paymentFor === 'trial_home_security_deposit' && payment.relatedVisitId
                             ? `${paymentForLabels[payment.paymentFor] || payment.paymentFor} (Visit ${payment.relatedVisitId})`
                             : paymentForLabels[payment.paymentFor] || payment.paymentFor;
                         
                         return (
                           <Box key={payment.id} sx={{ 
                             mb: 2, 
                             p: 2, 
                              bgcolor: isOutgoingPayment(payment.paymentFor) ? 'error.50' : 'success.50', 
                             borderRadius: 2,
                             display: 'flex',
                             justifyContent: 'space-between',
                             alignItems: 'center'
                           }}>
                             <Box>
                               <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {isOutgoingPayment(payment.paymentFor) ? '-' : '+'}{formatCurrency(payment.amount)} - {payment.paymentMode}
                               </Typography>
                               <Typography variant="body2" color="text.secondary">
                                 {payment.paymentDate} • For: {forLabel}
                                 {payment.referenceNumber && ` • Ref: ${payment.referenceNumber}`}
                                 {payment.remarks && ` • ${payment.remarks}`}
                               </Typography>
                             </Box>
                             <Chip 
                              label={isOutgoingPayment(payment.paymentFor) ? 'Money Out' : 'Money In'} 
                              color={isOutgoingPayment(payment.paymentFor) ? 'error' : 'success'} 
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
                {isStep0Valid
                  ? 'Ready to review'
                  : 'Name, phone, center, and at least one reference are required'}
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
              <AsyncActionButton
                variant="contained"
                onClick={handleSubmit(onFormSubmit)}
                startIcon={<SaveIcon />}
                size="large"
                sx={{ borderRadius: 2, px: 4 }}
                loading={submitLoading}
                loadingText={isEditMode ? 'Updating Enquiry...' : 'Saving Enquiry...'}
              >
                {isEditMode ? 'Update Enquiry' : 'Save Enquiry'}
              </AsyncActionButton>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Hearing aid product catalog (trial / booking) */}
      <Dialog
        open={hearingAidCatalogDialogOpen}
        onClose={() => {
          setHearingAidCatalogDialogOpen(false);
          setCatalogDialogSearch('');
          setCatalogDialogBrandFilter('');
          setCatalogDialogSingleProduct(false);
          setCatalogPickerIntent('trial');
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            py: 2,
            px: 2.5,
            flexShrink: 0,
            background: (theme) =>
              catalogPickerIntent === 'booking'
                ? `linear-gradient(135deg, ${theme.palette.warning.dark} 0%, ${theme.palette.warning.main} 100%)`
                : `linear-gradient(135deg, ${theme.palette.info.dark} 0%, ${theme.palette.info.light} 100%)`,
            color: 'common.white',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {catalogPickerIntent === 'booking' ? (
              <BookmarkAddedIcon sx={{ opacity: 0.95 }} />
            ) : (
              <ScienceOutlinedIcon sx={{ opacity: 0.95 }} />
            )}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {catalogPickerIntent === 'booking'
                  ? 'Choose the booked model'
                  : 'Pick the trial hearing aid'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.25 }}>
                {catalogPickerIntent === 'booking'
                  ? `One model only. Catalog MRP is per unit; use booking quantity and selling price (per unit) in Booking details. ${hearingAidProducts.length} products.`
                  : 'Choose exactly one model to try — search and filter below.'}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flex: '1 1 auto',
            minHeight: 0,
          }}
        >
          <Box sx={{ p: 2, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]), borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Stack spacing={1.5}>
              <TextField
                fullWidth
                autoFocus
                size="small"
                placeholder="Type to filter — brand, model, type (RIC, BTE), or price…"
                value={catalogDialogSearch}
                onChange={(e) => setCatalogDialogSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'background.paper' } }}
              />
              {isCatalogSearchPending && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Updating matches…
                </Typography>
              )}
              <FormControl fullWidth size="small">
                <InputLabel id="catalog-dialog-brand-label">Brand</InputLabel>
                <Select
                  labelId="catalog-dialog-brand-label"
                  value={catalogDialogBrandFilter}
                  label="Brand"
                  onChange={(e) => setCatalogDialogBrandFilter(String(e.target.value))}
                  sx={{ borderRadius: 2, bgcolor: 'background.paper' }}
                  MenuProps={mergeMenuPropsForReselectClear(
                    catalogDialogBrandFilter,
                    () => setCatalogDialogBrandFilter(''),
                    undefined
                  )}
                >
                  <MenuItem value="">
                    <em>All brands</em>
                  </MenuItem>
                  {catalogCompanyOptions.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Box>

          <MuiGrid
            container
            sx={{
              flex: '1 1 auto',
              minHeight: 0,
              overflow: 'hidden',
              alignItems: 'stretch',
            }}
          >
            <MuiGrid
              size={{ xs: 12, md: 7 }}
              sx={{
                borderRight: { md: 1 },
                borderColor: 'divider',
                borderBottom: { xs: 1, md: 0 },
                minHeight: 0,
                maxHeight: { xs: 'min(42vh, 360px)', md: 'min(56vh, 520px)' },
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <List dense disablePadding sx={{ py: 0 }}>
                {catalogDialogOrphanSelected.length > 0 && (
                  <>
                    <ListSubheader
                      sx={{
                        bgcolor: 'action.hover',
                        typography: 'caption',
                        fontWeight: 700,
                        lineHeight: '36px',
                      }}
                    >
                      Still selected (hidden by filter)
                    </ListSubheader>
                    {catalogDialogOrphanSelected.map((p) => {
                      const checked = draftCatalogProductIds.includes(p.id);
                      return (
                        <ListItemButton
                          key={p.id}
                          onClick={() => toggleDraftCatalogProduct(p.id)}
                          selected={checked}
                          sx={{ alignItems: 'flex-start', py: 1 }}
                        >
                          {catalogDialogSingleProduct ? (
                            <Radio
                              checked={checked}
                              tabIndex={-1}
                              disableRipple
                              value={p.id}
                              sx={{ py: 0.25, pr: 1 }}
                            />
                          ) : (
                            <Checkbox
                              edge="start"
                              checked={checked}
                              tabIndex={-1}
                              disableRipple
                              sx={{ pt: 0.25 }}
                            />
                          )}
                          <ListItemText
                            primary={p.name}
                            secondary={`${p.company || '—'} · ${p.type || '—'} · ${formatCurrency(p.mrp || 0)}`}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItemButton>
                      );
                    })}
                    <Divider />
                  </>
                )}
                <ListSubheader
                  sx={{
                    bgcolor: 'background.paper',
                    typography: 'caption',
                    fontWeight: 700,
                    lineHeight: '36px',
                  }}
                >
                  {catalogDialogFilteredProducts.length} match
                  {catalogDialogFilteredProducts.length === 1 ? '' : 'es'}
                  {deferredCatalogSearch.trim() || catalogDialogBrandFilter ? '' : ' (showing all for this brand)'}
                </ListSubheader>
                {catalogDialogFilteredProducts.length === 0 ? (
                  <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Nothing matches. Try fewer words, another brand, or clear the search box.
                    </Typography>
                  </Box>
                ) : (
                  catalogDialogFilteredProducts.map((p) => {
                    const checked = draftCatalogProductIds.includes(p.id);
                    return (
                      <ListItemButton
                        key={p.id}
                        onClick={() => toggleDraftCatalogProduct(p.id)}
                        selected={checked}
                        sx={{ alignItems: 'flex-start', py: 1 }}
                      >
                        {catalogDialogSingleProduct ? (
                          <Radio
                            checked={checked}
                            tabIndex={-1}
                            disableRipple
                            value={p.id}
                            sx={{ py: 0.25, pr: 1 }}
                          />
                        ) : (
                          <Checkbox
                            edge="start"
                            checked={checked}
                            tabIndex={-1}
                            disableRipple
                            sx={{ pt: 0.25 }}
                          />
                        )}
                        <ListItemText
                          primary={p.name}
                          secondary={`${p.company || '—'} · ${p.type || '—'} · ${formatCurrency(p.mrp || 0)}`}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItemButton>
                    );
                  })
                )}
              </List>
            </MuiGrid>

            <MuiGrid
              size={{ xs: 12, md: 5 }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'grey.100',
                minHeight: 0,
                maxHeight: { xs: 'min(36vh, 280px)', md: 'min(56vh, 520px)' },
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Your selection
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {catalogPickerIntent === 'booking'
                    ? 'One model for this booking (brand / model / MRP per unit).'
                    : 'One device for this trial (brand / model / MRP per unit).'}
                </Typography>
              </Box>
              <List dense disablePadding sx={{ py: 0 }}>
                {draftCatalogProductsOrdered.length === 0 ? (
                  <Box sx={{ p: 2.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Tap items on the left to add them here.
                    </Typography>
                  </Box>
                ) : (
                  draftCatalogProductsOrdered.map((p, index) => (
                    <ListItem
                      key={p.id}
                      disablePadding
                      secondaryAction={
                        <Stack direction="row" alignItems="center" sx={{ pr: 0.5 }}>
                          {!catalogDialogSingleProduct && (
                            <>
                              <IconButton
                                size="small"
                                aria-label="Move up"
                                onClick={() => moveDraftCatalogProduct(index, -1)}
                                disabled={index === 0}
                              >
                                <KeyboardArrowUpIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                aria-label="Move down"
                                onClick={() => moveDraftCatalogProduct(index, 1)}
                                disabled={index === draftCatalogProductsOrdered.length - 1}
                              >
                                <KeyboardArrowDownIcon fontSize="small" />
                              </IconButton>
                            </>
                          )}
                          <IconButton
                            size="small"
                            aria-label="Remove"
                            color="error"
                            onClick={() => toggleDraftCatalogProduct(p.id)}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      }
                      sx={{
                        pr: catalogDialogSingleProduct ? 10 : 18,
                        alignItems: 'flex-start',
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <ListItemText
                        sx={{ py: 1, pl: 2, pr: 1 }}
                        primary={
                          <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                            <Typography component="span" variant="body2" fontWeight={600}>
                              {p.name}
                            </Typography>
                            {index === 0 && (
                              <Chip
                                label={
                                  catalogPickerIntent === 'booking' ? 'Booked model' : 'Trial device'
                                }
                                size="small"
                                color="primary"
                                sx={{ height: 22 }}
                              />
                            )}
                          </Stack>
                        }
                        secondary={`${p.company || '—'} · ${formatCurrency(p.mrp || 0)}`}
                        primaryTypographyProps={{ component: 'div' }}
                        secondaryTypographyProps={{ variant: 'caption', component: 'div' }}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </MuiGrid>
          </MuiGrid>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 2, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Button
            onClick={() => {
              setHearingAidCatalogDialogOpen(false);
              setCatalogDialogSearch('');
              setCatalogDialogBrandFilter('');
              setCatalogDialogSingleProduct(false);
            }}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={applyHearingAidCatalogDialog}
            sx={{ borderRadius: 2, px: 3, textTransform: 'none', fontWeight: 600 }}
          >
            Apply {draftCatalogProductIds.length > 0 ? `(${draftCatalogProductIds.length})` : ''}
          </Button>
        </DialogActions>
      </Dialog>

      <EnquiryInventoryPickerDialog
        open={inventoryDialogOpen}
        onClose={() => setInventoryDialogOpen(false)}
        items={inventoryPickerItems}
        mode={inventoryPickerMode}
        selectedInventoryId={
          inventoryPickerMode === 'hearing_device' ? currentProduct.inventoryId || undefined : undefined
        }
        formatCurrency={formatCurrency}
        onSelectItem={handleInventoryItemSelected}
        reservedSerialProductKeys={
          inventoryPickerMode === 'hearing_device' && currentVisit?.hearingAidSale
            ? saleVisitReservedSerialKeys
            : undefined
        }
      />

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
        <DialogActions sx={{ p: 3, bgcolor: (t) => (t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.06) : t.palette.grey[50]) }}>
          <Button
            onClick={() => {
              const defaultRoles = { ...DEFAULT_ENQUIRY_STAFF_ROLES };
              setSelectedRoles(defaultRoles);
              // Save to localStorage immediately
              if (typeof window !== 'undefined') {
                localStorage.setItem('enquiryStaffRoles', JSON.stringify(defaultRoles));
              }
              void setDoc(
                doc(db, 'appSettings', 'enquiryStaffRoles'),
                { roles: defaultRoles, updatedAt: new Date().toISOString() },
                { merge: true },
              ).catch((e) => console.warn('Failed to save default enquiry staff roles:', e));
            }}
            sx={{ color: 'text.secondary' }}
          >
            Reset to Default
          </Button>
          <Button
            onClick={() => {
              // Save selectedRoles to localStorage
              if (typeof window !== 'undefined') {
                localStorage.setItem('enquiryStaffRoles', JSON.stringify(selectedRoles));
              }
              void setDoc(
                doc(db, 'appSettings', 'enquiryStaffRoles'),
                { roles: selectedRoles, updatedAt: new Date().toISOString() },
                { merge: true },
              ).catch((e) => console.warn('Failed to save enquiry staff roles:', e));
              setStaffManagementOpen(false);
            }}
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

      {journeySuggested && (
        <JourneyConfirmDialog
          open={journeyDialogOpen}
          suggested={journeySuggested}
          value={journeySelectValue}
          onChange={setJourneySelectValue}
          onConfirm={handleJourneyDialogConfirm}
          onCancel={handleJourneyDialogCancel}
        />
      )}
    </Box>
  );
};

export default SimplifiedEnquiryForm; 