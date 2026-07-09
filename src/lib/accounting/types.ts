import type { Timestamp } from 'firebase/firestore';

export type AccountingClient = {
  id?: string;
  companyId: string;
  name: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  openingBalance: number;
  openingBalanceType: 'debit' | 'credit';
  openingDate?: string;
  notes?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
};

export type AccountingInvoiceItem = {
  id: string;
  description: string;
  hsnSac?: string;
  quantity: number;
  rate: number;
  gstPercent: number;
  amount: number;
};

export type AccountingInvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export type AccountingInvoiceClientSnapshot = {
  name: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
};

export type AccountingInvoice = {
  id?: string;
  companyId: string;
  companyName: string;
  clientId: string;
  clientSnapshot: AccountingInvoiceClientSnapshot;
  invoiceNumber: string;
  invoiceDate: string;
  /** Optional label e.g. "July 2026" — shown on PDF/HTML only when set */
  invoiceMonth?: string;
  dueDate?: string;
  items: AccountingInvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  taxMode: 'intra' | 'inter';
  status: AccountingInvoiceStatus;
  notes?: string;
  terms?: string;
  createdBy?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
};

export type AccountingPaymentMode =
  | 'cash'
  | 'upi'
  | 'bank'
  | 'cheque'
  | 'card'
  | 'other';

export type AccountingPaymentAllocation = {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
};

export type AccountingPayment = {
  id?: string;
  companyId: string;
  clientId: string;
  clientName: string;
  paymentDate: string;
  amount: number;
  mode: AccountingPaymentMode;
  reference?: string;
  notes?: string;
  allocations: AccountingPaymentAllocation[];
  unallocated: number;
  createdBy?: string;
  createdAt?: Timestamp | Date;
};

export type AccountingNumberSettings = {
  prefix: string;
  suffix: string;
  padding: number;
  nextNumber: number;
};

export const DEFAULT_ACCOUNTING_NUMBER_SETTINGS: AccountingNumberSettings = {
  prefix: 'ACC/',
  suffix: '',
  padding: 4,
  nextNumber: 1,
};
