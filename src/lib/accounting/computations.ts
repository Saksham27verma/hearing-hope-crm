import type {
  AccountingInvoice,
  AccountingInvoiceItem,
  AccountingInvoiceStatus,
} from '@/lib/accounting/types';

export function roundTo2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const HEARING_AID_DESC_RE =
  /\bhearing\s*aids?\b|\bric\b|\bbte\b|\bcic\b|\biic\b|\bitc\b|\brechargeable\b|\bphonak\b|\bwidex\b|\bsignia\b|\boticon\b|\bresound\b|\bstarkey\b|\bunitron\b|\bbernafon\b/i;

/** Infer hearing-aid lines even on older invoices that lack `kind` / catalogKey. */
export function isHearingAidInvoiceItem(it: AccountingInvoiceItem): boolean {
  if (it.kind === 'hearing_aid') return true;
  if (it.kind && it.kind !== 'hearing_aid') return false;
  if (typeof it.catalogKey === 'string' && it.catalogKey.startsWith('product:')) return true;
  if (it.hasSerialNumber === true) return true;
  if (String(it.serialNumber || '').trim()) return true;

  const meta = (it as AccountingInvoiceItem & {
    meta?: { company?: string; productType?: string };
  }).meta;
  if (meta?.company || meta?.productType) return true;

  const desc = String(it.description || '');
  if (HEARING_AID_DESC_RE.test(desc)) return true;
  // Catalog hearing aids are saved as "Name\nCompany · Type"
  if (desc.includes('\n') && desc.includes('·')) return true;

  return false;
}

/** Enrich legacy line items so print/edit treat them like newly created ones. */
export function enrichAccountingInvoiceItems(
  items: AccountingInvoiceItem[] | undefined | null,
): AccountingInvoiceItem[] {
  return (items || []).map((it) => {
    if (it.kind) return it;
    if (isHearingAidInvoiceItem(it)) {
      return {
        ...it,
        kind: 'hearing_aid',
        hasSerialNumber: it.hasSerialNumber ?? true,
      };
    }
    if (typeof it.catalogKey === 'string') {
      if (it.catalogKey.startsWith('test:')) return { ...it, kind: 'test' };
      if (it.catalogKey.startsWith('ent:')) return { ...it, kind: 'ent' };
      if (it.catalogKey.startsWith('custom:')) return { ...it, kind: 'custom' };
    }
    return { ...it, kind: it.kind || 'custom' };
  });
}

/** Backfill gross totals / kinds so older invoices print with MRP + Amount Payable correctly. */
export function normalizeAccountingInvoiceForDisplay(
  invoice: AccountingInvoice,
): AccountingInvoice {
  const items = enrichAccountingInvoiceItems(invoice.items);
  const netPctRaw = Number(invoice.netPayablePercent);
  const netPct =
    Number.isFinite(netPctRaw) && netPctRaw > 0 ? Math.min(100, netPctRaw) : 100;
  const taxMode = invoice.taxMode === 'inter' ? 'inter' : 'intra';
  const totals = computeInvoiceTotals(items, taxMode, netPct);
  return {
    ...invoice,
    items,
    netPayablePercent: netPct,
    grossSubtotal:
      invoice.grossSubtotal != null && Number(invoice.grossSubtotal) > 0
        ? Number(invoice.grossSubtotal)
        : totals.grossSubtotal,
    grossGrandTotal:
      invoice.grossGrandTotal != null && Number(invoice.grossGrandTotal) > 0
        ? Number(invoice.grossGrandTotal)
        : totals.grossGrandTotal,
  };
}

/** Column header for the unit price: MRP, Rate, or MRP / Rate when mixed. */
export function rateColumnLabelForItems(items: AccountingInvoiceItem[]): string {
  const enriched = enrichAccountingInvoiceItems(items);
  if (!enriched.length) return 'Rate';
  let hasHa = false;
  let hasOther = false;
  for (const it of enriched) {
    if (isHearingAidInvoiceItem(it)) hasHa = true;
    else hasOther = true;
  }
  if (hasHa && hasOther) return 'MRP / Rate';
  if (hasHa) return 'MRP';
  return 'Rate';
}

export function priceFieldLabelForItem(it: AccountingInvoiceItem): string {
  return isHearingAidInvoiceItem(it) ? 'MRP' : 'Rate';
}

export function computeItemAmount(item: AccountingInvoiceItem): number {
  return roundTo2(Number(item.quantity || 0) * Number(item.rate || 0));
}

export type InvoiceTotals = {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
  roundOff: number;
  grandTotal: number;
  /** Subtotal before applying netPayablePercent scaling. */
  grossSubtotal: number;
  /** Grand total before applying netPayablePercent scaling. */
  grossGrandTotal: number;
  /** The scaling percentage that was applied (1-100). */
  netPayablePercent: number;
};

export function computeInvoiceTotals(
  items: AccountingInvoiceItem[],
  taxMode: 'intra' | 'inter',
  netPayablePercent: number = 100,
): InvoiceTotals {
  const pct =
    Number.isFinite(netPayablePercent) && netPayablePercent > 0
      ? Math.min(100, Math.max(0.0001, Number(netPayablePercent)))
      : 100;
  const ratio = pct / 100;

  let grossSubtotal = 0;
  let grossGst = 0;
  let subtotal = 0;
  let gst = 0;
  for (const it of items) {
    const qty = Number(it.quantity || 0);
    const rate = Number(it.rate || 0);
    const grossLine = qty * rate;
    const line = grossLine * ratio;
    grossSubtotal += grossLine;
    subtotal += line;
    const g = Number(it.gstPercent || 0);
    grossGst += (grossLine * g) / 100;
    gst += (line * g) / 100;
  }
  grossSubtotal = roundTo2(grossSubtotal);
  grossGst = roundTo2(grossGst);
  subtotal = roundTo2(subtotal);
  gst = roundTo2(gst);
  const cgst = taxMode === 'intra' ? roundTo2(gst / 2) : 0;
  const sgst = taxMode === 'intra' ? roundTo2(gst - cgst) : 0;
  const igst = taxMode === 'inter' ? gst : 0;
  const rawGrand = subtotal + gst;
  const grand = Math.round(rawGrand);
  const roundOff = roundTo2(grand - rawGrand);
  const grossGrand = Math.round(grossSubtotal + grossGst);
  return {
    subtotal,
    cgst,
    sgst,
    igst,
    totalGst: gst,
    roundOff,
    grandTotal: grand,
    grossSubtotal,
    grossGrandTotal: grossGrand,
    netPayablePercent: pct,
  };
}

export function invoiceSettled(
  invoice: Pick<AccountingInvoice, 'amountPaid' | 'tdsDeducted'>,
): number {
  return Number(invoice.amountPaid || 0) + Number((invoice as any).tdsDeducted || 0);
}

export function invoiceBalance(
  invoice: Pick<AccountingInvoice, 'grandTotal' | 'amountPaid' | 'tdsDeducted'>,
): number {
  return Math.max(0, Number(invoice.grandTotal || 0) - invoiceSettled(invoice));
}

export function deriveInvoiceStatus(
  invoice: Pick<AccountingInvoice, 'grandTotal' | 'amountPaid' | 'tdsDeducted' | 'dueDate' | 'status'>,
): AccountingInvoiceStatus {
  if (invoice.status === 'cancelled' || invoice.status === 'draft') return invoice.status;
  const settled = invoiceSettled(invoice);
  const total = Number(invoice.grandTotal || 0);
  if (settled <= 0) {
    if (invoice.dueDate) {
      const d = new Date(invoice.dueDate);
      if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) return 'overdue';
    }
    return invoice.status === 'sent' ? 'sent' : 'sent';
  }
  if (settled + 0.01 < total) return 'partial';
  return 'paid';
}

export function formatINR(v: number | undefined | null): string {
  const n = Number(v || 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function amountInWords(num: number): string {
  const n = Math.round(Number(num || 0));
  if (n === 0) return 'Zero Rupees Only';
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const inWords = (num: number): string => {
    if (num < 20) return a[num];
    if (num < 100) return `${b[Math.floor(num / 10)]}${num % 10 ? ' ' + a[num % 10] : ''}`;
    if (num < 1000)
      return `${a[Math.floor(num / 100)]} Hundred${num % 100 ? ' ' + inWords(num % 100) : ''}`;
    if (num < 100000)
      return `${inWords(Math.floor(num / 1000))} Thousand${num % 1000 ? ' ' + inWords(num % 1000) : ''}`;
    if (num < 10000000)
      return `${inWords(Math.floor(num / 100000))} Lakh${num % 100000 ? ' ' + inWords(num % 100000) : ''}`;
    return `${inWords(Math.floor(num / 10000000))} Crore${num % 10000000 ? ' ' + inWords(num % 10000000) : ''}`;
  };
  return `${inWords(n)} Rupees Only`.replace(/\s+/g, ' ').trim();
}
