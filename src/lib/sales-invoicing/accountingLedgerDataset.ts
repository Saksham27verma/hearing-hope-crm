import type { PatientPaymentLine, SaleRecord, UnifiedInvoiceRow } from './types';
import { saleInvoiceFaceTotal } from '@/lib/sales-invoicing/saleInvoiceFaceTotal';

export interface AccountingExportOptions {
  organizationName?: string;
  rows: UnifiedInvoiceRow[];
  patientPaymentsByEnquiryId: Record<string, PatientPaymentLine[]>;
  centerNameById: Record<string, string>;
  scopeNote?: string;
}

export interface AccountingLedgerSummary {
  totalInvoices: number;
  activeCount: number;
  cancelledCount: number;
  /** Sum of taxable / subtotal (before GST) for active invoices */
  totalTaxableActive: number;
  totalGstActive: number;
  grandTotalActive: number;
  /** Sum of CRM payment lines linked to exported enquiries */
  totalPaymentsAmount: number;
  paymentEntryCount: number;
}

export interface AccountingLedgerDataset {
  summary: AccountingLedgerSummary;
  scopeNote: string;
  organizationName: string;
  invoiceRegister: Record<string, string | number>[];
  lineItems: Record<string, string | number>[];
  paymentsLedger: Record<string, string | number>[];
}

export function tsToIsoDate(ts: unknown): string {
  if (ts && typeof ts === 'object' && 'seconds' in (ts as object)) {
    const s = (ts as { seconds?: number }).seconds;
    if (typeof s === 'number' && Number.isFinite(s)) {
      return new Date(s * 1000).toISOString().slice(0, 10);
    }
  }
  return '';
}

export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

export function formatInrPlain(n: number): number {
  return Math.round(n * 100) / 100;
}

function paymentLinesSummary(pays: PatientPaymentLine[] | undefined): string {
  if (!pays || pays.length === 0) return '';
  return pays
    .map((p) => {
      const parts = [
        `₹${formatInrPlain(p.amount)}`,
        p.mode && p.mode !== '—' ? p.mode : null,
        p.referenceNumber ? `Ref ${p.referenceNumber}` : null,
        p.date || null,
      ].filter(Boolean);
      return parts.join(' · ');
    })
    .join('\n');
}

/**
 * Ledger PDF only: Helvetica renders ₹ poorly. Amount+mode on one line; full Ref and date on their
 * own lines so long UTRs use the full cell width (no mid-string ellipsis).
 */
export function formatPatientPaymentsForPdf(pays: PatientPaymentLine[] | undefined): string {
  if (!pays || pays.length === 0) return '';
  const fmtAmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      formatInrPlain(n)
    );
  return pays
    .map((p) => {
      const lines: string[] = [];
      const mode = p.mode && p.mode !== '—' ? p.mode : '';
      lines.push(mode ? `Rs. ${fmtAmt(p.amount)} · ${mode}` : `Rs. ${fmtAmt(p.amount)}`);
      if (p.referenceNumber) {
        const ref = str(p.referenceNumber).replace(/\s+/g, ' ').trim();
        if (ref) lines.push(`Ref ${ref}`);
      }
      if (p.date) lines.push(String(p.date));
      return lines.join('\n');
    })
    .join('\n\n');
}

/** Name, optional (brand), optional #serial — same text in line-item Description and invoice summary. */
function ledgerProductDescription(raw: Record<string, unknown>): string {
  const name = str(raw.name) || 'Product';
  const company = str(raw.company);
  const serial = str(raw.serialNumber);
  return [name, company ? `(${company})` : null, serial ? `#${serial}` : null].filter(Boolean).join(' ');
}

function productSummaryFromSale(s: SaleRecord): string {
  const parts: string[] = [];
  const products = Array.isArray(s.products) ? s.products : [];
  for (const raw of products) {
    parts.push(ledgerProductDescription(raw as Record<string, unknown>));
  }
  const manuals = Array.isArray(s.manualLineItems) ? s.manualLineItems : [];
  for (const m of manuals) {
    const x = m as { description?: string; quantity?: number; rate?: number };
    parts.push(`${str(x.description) || 'Line'} ×${num(x.quantity)} @ ₹${num(x.rate)}`);
  }
  const acc = Array.isArray(s.accessories) ? s.accessories : [];
  for (const a of acc) {
    const x = a as { name?: string; quantity?: number; price?: number; isFree?: boolean };
    if (x.isFree) parts.push(`${str(x.name) || 'Accessory'} (free)`);
    else parts.push(`${str(x.name) || 'Accessory'} ×${num(x.quantity)} @ ₹${num(x.price)}`);
  }
  return parts.join('; ');
}

function buildEnquiryInvoiceMap(rows: UnifiedInvoiceRow[]): Record<string, string[]> {
  const m: Record<string, Set<string>> = {};
  for (const r of rows) {
    if (r.kind !== 'saved' || !r.savedSale) continue;
    const eid = str(r.savedSale.enquiryId);
    if (!eid) continue;
    const inv = str(r.savedSale.invoiceNumber);
    if (!m[eid]) m[eid] = new Set();
    if (inv) m[eid].add(inv);
  }
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v].sort()]));
}

/**
 * Single source of truth for accountant Excel + PDF exports.
 */
export function buildAccountingLedgerDataset(opts: AccountingExportOptions): AccountingLedgerDataset {
  const org = opts.organizationName?.trim() || 'Hearing Hope';
  const savedRows = opts.rows.filter((r) => r.kind === 'saved' && r.savedSale);
  if (savedRows.length === 0) {
    throw new Error('No invoices to export. Adjust filters or add invoices.');
  }

  const enquiryInvoices = buildEnquiryInvoiceMap(savedRows);
  /** Patient / client name from any exported invoice row for that enquiry */
  const enquiryNameById: Record<string, string> = {};
  for (const r of savedRows) {
    const eid = str(r.savedSale?.enquiryId);
    if (!eid) continue;
    const nm = str(r.savedSale?.patientName);
    if (nm) enquiryNameById[eid] = nm;
  }
  const invoiceRegister: Record<string, string | number>[] = [];
  const lineItems: Record<string, string | number>[] = [];
  const paymentsLedger: Record<string, string | number>[] = [];

  let activeCount = 0;
  let cancelledCount = 0;
  let totalTaxableActive = 0;
  let totalGstActive = 0;
  let grandTotalActive = 0;

  for (const r of savedRows) {
    const s = r.savedSale!;
    const voided = Boolean(s.cancelled || r.isCancelled);
    if (voided) cancelledCount += 1;
    else {
      activeCount += 1;
      const g = saleInvoiceFaceTotal(s);
      grandTotalActive += g;
      totalTaxableActive += num(s.totalAmount);
      totalGstActive += num(s.gstAmount);
    }

    const inv = str(s.invoiceNumber) || '—';
    const invDate = tsToIsoDate(s.saleDate);
    const eid = str(s.enquiryId);
    const pays = eid ? opts.patientPaymentsByEnquiryId[eid] : undefined;
    const center = s.centerId ? opts.centerNameById[str(s.centerId)] || s.centerId : '';
    const payStatus = str(s.paymentStatus) || 'paid';
    const payMethod = str(s.paymentMethod) || '';

    invoiceRegister.push({
      Invoice_Number: inv,
      Invoice_Date: invDate,
      Document_Status: voided ? 'Cancelled (void)' : 'Active',
      Client_Name: str(s.patientName) || '—',
      Phone: str(s.phone),
      Email: str(s.email),
      Address: str(s.address),
      Source: s.source === 'enquiry' ? 'Enquiry' : 'Manual',
      Enquiry_ID: eid,
      Visitor_ID: str(s.visitorId),
      Visit_Index: s.enquiryVisitIndex ?? '',
      Center: center,
      Branch: str(s.branch),
      Salesperson: str(s.salesperson?.name),
      Referring_doctor: str(s.referenceDoctor?.name),
      Invoice_Payment_Status: payStatus,
      Payment_Mode_on_invoice: payMethod,
      Subtotal_before_GST_INR: formatInrPlain(num(s.totalAmount)),
      GST_INR: formatInrPlain(num(s.gstAmount)),
      Grand_Total_INR: formatInrPlain(saleInvoiceFaceTotal(s)),
      Product_and_service_summary: productSummaryFromSale(s),
      Patient_payments_recorded: paymentLinesSummary(pays),
      Notes: str(s.notes),
      Cancel_reason: voided ? str(s.cancelReason) : '',
    });

    let lineNo = 0;
    const products = Array.isArray(s.products) ? s.products : [];
    for (const raw of products) {
      lineNo += 1;
      const p = raw as Record<string, unknown>;
      const selling = num(p.sellingPrice);
      const gstAmt = num(p.gstAmount);
      const gstPct = num(p.gstPercent ?? p.gstPercentage);
      lineItems.push({
        Invoice_Number: inv,
        Invoice_Date: invDate,
        Client_Name: str(s.patientName) || '—',
        Line_No: lineNo,
        Line_Type: 'Product',
        Description: ledgerProductDescription(p),
        HSN_Code: str(p.hsnCode),
        Serial_Numbers: str(p.serialNumber),
        Quantity: 1,
        Unit_selling_price_INR: formatInrPlain(selling),
        GST_percent: gstPct,
        GST_INR: formatInrPlain(gstAmt),
        Line_total_with_GST_INR: formatInrPlain(selling + gstAmt),
      });
    }
    const manuals = Array.isArray(s.manualLineItems) ? s.manualLineItems : [];
    for (const m of manuals) {
      lineNo += 1;
      const x = m as { description?: string; quantity?: number; rate?: number; taxPercent?: number };
      const qty = num(x.quantity) || 1;
      const rate = num(x.rate);
      const lineSub = qty * rate;
      const taxPct = num(x.taxPercent);
      const lineGst = Math.round((lineSub * taxPct) / 100);
      lineItems.push({
        Invoice_Number: inv,
        Invoice_Date: invDate,
        Client_Name: str(s.patientName) || '—',
        Line_No: lineNo,
        Line_Type: 'Manual line',
        Description: str(x.description) || 'Manual',
        HSN_Code: '',
        Serial_Numbers: '',
        Quantity: qty,
        Unit_selling_price_INR: formatInrPlain(rate),
        GST_percent: taxPct,
        GST_INR: formatInrPlain(lineGst),
        Line_total_with_GST_INR: formatInrPlain(lineSub + lineGst),
      });
    }
    const acc = Array.isArray(s.accessories) ? s.accessories : [];
    for (const a of acc) {
      lineNo += 1;
      const x = a as { name?: string; quantity?: number; price?: number; isFree?: boolean };
      const qty = num(x.quantity) || 1;
      const price = x.isFree ? 0 : num(x.price);
      lineItems.push({
        Invoice_Number: inv,
        Invoice_Date: invDate,
        Client_Name: str(s.patientName) || '—',
        Line_No: lineNo,
        Line_Type: x.isFree ? 'Accessory (free)' : 'Accessory',
        Description: str(x.name) || 'Accessory',
        HSN_Code: '',
        Serial_Numbers: '',
        Quantity: qty,
        Unit_selling_price_INR: formatInrPlain(price),
        GST_percent: '',
        GST_INR: 0,
        Line_total_with_GST_INR: formatInrPlain(price * qty),
      });
    }
  }

  const enquiryIdsInExport = new Set(
    savedRows.map((r) => str(r.savedSale?.enquiryId)).filter(Boolean)
  );
  let paySeq = 0;
  let totalPaymentsAmount = 0;
  for (const eid of enquiryIdsInExport) {
    const pays = opts.patientPaymentsByEnquiryId[eid];
    if (!pays || pays.length === 0) continue;
    const relatedInv = (enquiryInvoices[eid] || []).join(', ');
    for (const p of pays) {
      paySeq += 1;
      totalPaymentsAmount += formatInrPlain(p.amount);
      paymentsLedger.push({
        Entry_No: paySeq,
        Payment_Date: p.date || '',
        Amount_INR: formatInrPlain(p.amount),
        Mode: p.mode,
        Reference_UTR_Cheque: p.referenceNumber || '',
        Remarks: p.remarks || '',
        Related_invoice_numbers: relatedInv,
        Enquiry_Name: enquiryNameById[eid] || '—',
      });
    }
  }

  return {
    organizationName: org,
    scopeNote: opts.scopeNote || 'Current table view (filters apply)',
    summary: {
      totalInvoices: savedRows.length,
      activeCount,
      cancelledCount,
      totalTaxableActive: formatInrPlain(totalTaxableActive),
      totalGstActive: formatInrPlain(totalGstActive),
      grandTotalActive: formatInrPlain(grandTotalActive),
      totalPaymentsAmount: formatInrPlain(totalPaymentsAmount),
      paymentEntryCount: paySeq,
    },
    invoiceRegister,
    lineItems,
    paymentsLedger,
  };
}
