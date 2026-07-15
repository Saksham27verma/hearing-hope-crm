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
  /** Serial number(s) for hearing aids / serial-tracked products. Comma-separated when qty > 1. */
  serialNumber?: string;
  /** True when this line should collect / display a serial number. */
  hasSerialNumber?: boolean;
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
  /** Cumulative TDS deducted by clients (still due from tax dept but counts toward settlement). */
  tdsDeducted?: number;
  /** Portion of the gross value being billed (1-100). 100 = full bill, 50 = half billing. Defaults to 100. */
  netPayablePercent?: number;
  /** Gross subtotal (before applying netPayablePercent). Kept for display / audit. */
  grossSubtotal?: number;
  /** Gross grand total (before applying netPayablePercent). */
  grossGrandTotal?: number;
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
  /** TDS amount deducted by client against this invoice (part of settled total, not part of cash `amount`). */
  tdsAmount?: number;
};

export type AccountingPayment = {
  id?: string;
  companyId: string;
  clientId: string;
  clientName: string;
  paymentDate: string;
  /** Actual cash / bank amount received. */
  amount: number;
  /** Total TDS across all allocations of this payment (0 if none). */
  tdsAmount?: number;
  /** TDS % that was used at entry time (informational). */
  tdsPercent?: number;
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
