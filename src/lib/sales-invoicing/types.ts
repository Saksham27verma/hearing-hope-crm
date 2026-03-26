import type { Timestamp } from 'firebase/firestore';

export type InvoiceSource = 'manual' | 'enquiry';

export type PaymentStatus = 'paid' | 'pending' | 'overdue';

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
}

export interface DerivedEnquirySale {
  id: string;
  enquiryId?: string;
  visitorId?: string;
  visitIndex: number;
  patientName: string;
  phone?: string;
  address?: string;
  visitDate: Timestamp;
  products: unknown[];
  totalAmount: number;
}

export type UnifiedRowKind = 'saved' | 'enquiry_pending';

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
  statusVariant: 'paid' | 'pending' | 'overdue' | 'uninvoiced';
  source: InvoiceSource | 'enquiry_pending';
  savedSale?: SaleRecord;
  derivedEnquiry?: DerivedEnquirySale;
}

export interface SalesInvoiceFiltersState {
  dateFrom: Date | null;
  dateTo: Date | null;
  paymentStatuses: PaymentStatus[];
  source: 'all' | InvoiceSource;
}
