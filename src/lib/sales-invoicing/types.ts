import type { Timestamp } from 'firebase/firestore';
import type { SaleAccessoryLine } from '@/lib/sales-invoicing/visitAccessoryInvoice';

export type InvoiceSource = 'manual' | 'enquiry';

export type PaymentStatus = 'paid' | 'pending' | 'overdue';

/** Payment status filter in the invoice table (includes voided invoices). */
export type InvoiceTablePaymentFilter = PaymentStatus | 'cancelled';

export interface ManualLineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  taxPercent: number;
}

/** Firestore sale document shape (extended). */
export interface SaleRecord {
  id?: string;
  invoiceNumber?: string;
  patientId?: string;
  patientName: string;
  phone?: string;
  email?: string;
  address?: string;
  customerGstNumber?: string;
  products: unknown[];
  accessories?: unknown[];
  manualLineItems?: ManualLineItem[];
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
  paymentStatus?: PaymentStatus;
  dueDate?: Timestamp;
  notes?: string;
  saleDate: Timestamp;
  source?: InvoiceSource;
  enquiryId?: string;
  visitorId?: string;
  enquiryVisitIndex?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  /** Soft void — invoice stays in DB for audit; excluded from covering enquiry-derived pending rows. */
  cancelled?: boolean;
  cancelledAt?: Timestamp;
  cancelledByUid?: string;
  cancelReason?: string;
  /** When the patient exchanged a prior device: credit applied (₹ inc GST) on the mirrored enquiry sale. */
  exchangeCreditInr?: number;
  /** Enquiry visit index (0-based) the exchange credit was taken from. */
  exchangePriorVisitIndex?: number;
}

export interface DerivedEnquirySale {
  id: string;
  enquiryId?: string;
  visitorId?: string;
  visitIndex: number;
  /** Staff name from visit "Who Sold" (`hearingAidBrand` / `hearingAidDetails.whoSold`). */
  whoSoldName?: string;
  patientName: string;
  phone?: string;
  email?: string;
  address?: string;
  customerGstNumber?: string;
  visitDate: Timestamp;
  products: unknown[];
  totalAmount: number;
  /** Non–hearing-aid lines on the same visit (battery, charger, accessory, other). */
  accessories?: SaleAccessoryLine[];
  /** From enquiry visit `taxAmount` (GST on hearing aid lines). */
  gstAmount?: number;
  /** `salesAfterTax` + accessory total — matches invoice grand total when visit data is consistent. */
  grandTotal?: number;
}

export type UnifiedRowKind = 'saved' | 'enquiry_pending';

/** One line from enquiry `paymentRecords` / `payments` — shown on Sales & Invoicing for linked patients. */
export interface PatientPaymentLine {
  amount: number;
  mode: string;
  referenceNumber?: string;
  remarks?: string;
  /** ISO date string (YYYY-MM-DD) when available */
  date?: string;
}

export interface UnifiedInvoiceRow {
  kind: UnifiedRowKind;
  rowId: string;
  invoiceNumber: string | null;
  date: Timestamp;
  clientName: string;
  clientPhone?: string;
  /** Raw Firestore doc id for enquiry or visitor when linked */
  linkedEnquiryRef: string | null;
  total: number;
  statusLabel: string;
  statusVariant: 'paid' | 'pending' | 'overdue' | 'uninvoiced' | 'cancelled';
  /** True when the saved sale document is cancelled (voided). */
  isCancelled?: boolean;
  source: InvoiceSource | 'enquiry_pending';
  savedSale?: SaleRecord;
  derivedEnquiry?: DerivedEnquirySale;
  /** All payments recorded on the linked enquiry (UTR, cheque #, modes, amounts). */
  patientPayments?: PatientPaymentLine[];
}

export interface SalesInvoiceFiltersState {
  dateFrom: Date | null;
  dateTo: Date | null;
  paymentStatuses: PaymentStatus[];
  source: 'all' | InvoiceSource;
}
