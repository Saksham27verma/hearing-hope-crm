import type {
  AccountingInvoice,
  AccountingInvoiceItem,
} from '@/lib/accounting/types';
import type { AccountingCompanyProfile } from '@/lib/accounting/companyProfile';
import { amountInWords, formatINR } from '@/lib/accounting/computations';

const escapeHtml = (s: string | undefined | null): string =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const nl2br = (s: string | undefined | null): string =>
  escapeHtml(s).replace(/\n/g, '<br/>');

const rupee = (n: number) => formatINR(n);

function buildItemsHtml(items: AccountingInvoiceItem[]): string {
  return items
    .map(
      (it, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${nl2br(it.description)}</td>
        <td style="text-align:center">${escapeHtml(it.hsnSac || '')}</td>
        <td style="text-align:right">${Number(it.quantity || 0)}</td>
        <td style="text-align:right">${rupee(Number(it.rate || 0))}</td>
        <td style="text-align:right">${Number(it.gstPercent || 0)}%</td>
        <td style="text-align:right">${rupee(Number(it.quantity || 0) * Number(it.rate || 0))}</td>
      </tr>`,
    )
    .join('');
}

function buildItemsPlainRows(items: AccountingInvoiceItem[]): string {
  return items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${nl2br(it.description)}</td>
        <td>${escapeHtml(it.hsnSac || '')}</td>
        <td style="text-align:right">${Number(it.quantity || 0)}</td>
        <td style="text-align:right">${rupee(Number(it.rate || 0))}</td>
        <td style="text-align:right">${Number(it.gstPercent || 0)}%</td>
        <td style="text-align:right">${rupee(Number(it.quantity || 0) * Number(it.rate || 0))}</td>
      </tr>`,
    )
    .join('');
}

export type InvoiceTemplateContext = Record<string, string>;

export function buildInvoiceTemplateContext(
  invoice: AccountingInvoice,
  company: AccountingCompanyProfile | null,
): InvoiceTemplateContext {
  const client = invoice.clientSnapshot || { name: '' };
  const clientAddress = [
    client.address,
    [client.city, client.state, client.pincode].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('\n');
  const companyAddress = [
    company?.address,
    [company?.city, company?.state, company?.pincode].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('\n');
  const bankDetailsParts = [
    company?.bankName && `Bank: ${company.bankName}`,
    company?.accountNumber && `A/C: ${company.accountNumber}`,
    company?.ifsc && `IFSC: ${company.ifsc}`,
    company?.branch && `Branch: ${company.branch}`,
  ].filter(Boolean) as string[];

  const balanceDue = Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.amountPaid || 0));

  return {
    companyName: escapeHtml(company?.name || invoice.companyName),
    companyAddress: nl2br(companyAddress),
    companyAddressPlain: escapeHtml(companyAddress),
    companyGSTIN: escapeHtml(company?.gstNumber || ''),
    companyPhone: escapeHtml(company?.phone || ''),
    companyEmail: escapeHtml(company?.email || ''),
    companyWebsite: escapeHtml(company?.website || ''),
    companyBankDetails: nl2br(bankDetailsParts.join('\n')),

    invoiceNumber: escapeHtml(invoice.invoiceNumber),
    invoiceDate: escapeHtml(invoice.invoiceDate),
    dueDate: escapeHtml(invoice.dueDate || ''),
    status: escapeHtml(String(invoice.status || 'draft').toUpperCase()),
    taxMode:
      invoice.taxMode === 'inter' ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)',

    clientName: escapeHtml(client.name || ''),
    clientAddress: nl2br(clientAddress),
    clientAddressPlain: escapeHtml(clientAddress),
    clientGSTIN: escapeHtml(client.gstin || ''),
    clientPhone: escapeHtml(client.phone || ''),
    clientEmail: escapeHtml(client.email || ''),

    subtotal: rupee(invoice.subtotal),
    cgst: rupee(invoice.cgst),
    sgst: rupee(invoice.sgst),
    igst: rupee(invoice.igst),
    totalGst: rupee(invoice.totalGst),
    roundOff: rupee(invoice.roundOff),
    grandTotal: rupee(invoice.grandTotal),
    amountPaid: rupee(invoice.amountPaid),
    balanceDue: rupee(balanceDue),
    grandTotalWords: escapeHtml(amountInWords(invoice.grandTotal)),

    itemsHtml: buildItemsHtml(invoice.items || []),
    itemsPlainHtml: buildItemsPlainRows(invoice.items || []),

    notes: nl2br(invoice.notes || ''),
    terms: nl2br(invoice.terms || ''),
  };
}

/** Simple {{key}} + {{#if key}}...{{/if}} substitution. */
export function applyInvoiceTemplate(template: string, ctx: InvoiceTemplateContext): string {
  const conditional = template.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_m, key: string, block: string) => {
      const v = ctx[key];
      if (v == null) return '';
      const stripped = String(v).replace(/<[^>]*>/g, '').trim();
      return stripped.length > 0 ? block : '';
    },
  );
  return conditional.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = ctx[key];
    return v == null ? '' : String(v);
  });
}

export const TEMPLATE_PLACEHOLDERS: {
  key: keyof InvoiceTemplateContext | string;
  desc: string;
}[] = [
  { key: 'companyName', desc: 'Business company name' },
  { key: 'companyAddress', desc: 'Company address (HTML, newlines to <br/>)' },
  { key: 'companyGSTIN', desc: 'Company GSTIN' },
  { key: 'companyPhone', desc: 'Company phone' },
  { key: 'companyEmail', desc: 'Company email' },
  { key: 'companyWebsite', desc: 'Company website' },
  { key: 'companyBankDetails', desc: 'Bank name / A/C / IFSC / branch as HTML block' },

  { key: 'invoiceNumber', desc: 'Invoice number' },
  { key: 'invoiceDate', desc: 'Invoice date' },
  { key: 'dueDate', desc: 'Due date (may be empty)' },
  { key: 'status', desc: 'Uppercase status (DRAFT / SENT / PAID …)' },
  { key: 'taxMode', desc: 'Descriptive tax mode label' },

  { key: 'clientName', desc: 'Client name' },
  { key: 'clientAddress', desc: 'Client address as HTML block' },
  { key: 'clientGSTIN', desc: 'Client GSTIN' },
  { key: 'clientPhone', desc: 'Client phone' },
  { key: 'clientEmail', desc: 'Client email' },

  { key: 'subtotal', desc: 'Subtotal (₹ formatted)' },
  { key: 'cgst', desc: 'CGST amount' },
  { key: 'sgst', desc: 'SGST amount' },
  { key: 'igst', desc: 'IGST amount' },
  { key: 'totalGst', desc: 'Total GST' },
  { key: 'roundOff', desc: 'Round off' },
  { key: 'grandTotal', desc: 'Grand total' },
  { key: 'amountPaid', desc: 'Amount already received' },
  { key: 'balanceDue', desc: 'Balance still due' },
  { key: 'grandTotalWords', desc: 'Amount in words' },

  { key: 'itemsHtml', desc: 'Full styled <tr> rows for line items table' },
  { key: 'itemsPlainHtml', desc: 'Unstyled <tr> rows if you\u2019re providing your own CSS' },

  { key: 'notes', desc: 'Invoice notes as HTML block' },
  { key: 'terms', desc: 'Terms as HTML block' },
];

/** The built-in default template, exposed for the settings editor. */
export function getDefaultInvoiceTemplate(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice {{invoiceNumber}}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 0; padding: 24px; font-size: 12px; }
    .wrap { max-width: 800px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #ef6c00; padding-bottom: 12px; margin-bottom: 16px; }
    .company h1 { margin: 0 0 4px; color: #ef6c00; font-size: 20px; }
    .company .meta { color: #555; line-height: 1.5; }
    .doc-title { text-align: right; }
    .doc-title h2 { margin: 0 0 4px; color: #333; font-size: 22px; letter-spacing: 1px; }
    .doc-title .num { color: #ef6c00; font-weight: bold; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .box { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; }
    .box h3 { margin: 0 0 6px; font-size: 12px; color: #ef6c00; text-transform: uppercase; letter-spacing: 0.5px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.items th { background: #fff3e0; color: #ef6c00; text-align: left; padding: 8px; border-bottom: 2px solid #ef6c00; font-size: 11px; }
    table.items td { padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
    .totals { margin-top: 12px; display: flex; justify-content: flex-end; }
    .totals table { border-collapse: collapse; min-width: 300px; }
    .totals td { padding: 6px 12px; }
    .totals tr.grand td { border-top: 2px solid #ef6c00; font-weight: bold; font-size: 14px; color: #ef6c00; }
    .foot { margin-top: 24px; display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
    .notes { border: 1px dashed #ccc; padding: 10px; border-radius: 6px; }
    .sign { text-align: right; padding-top: 40px; border-top: 1px solid #ccc; }
    .words { font-style: italic; color: #666; margin-top: 6px; }
    .bank { border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px; color: #555; }
    @media print { body { padding: 0; } .wrap { max-width: none; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div class="company">
        <h1>{{companyName}}</h1>
        <div class="meta">
          {{companyAddress}}
          {{#if companyGSTIN}}<div><b>GSTIN:</b> {{companyGSTIN}}</div>{{/if}}
          {{#if companyPhone}}<div><b>Phone:</b> {{companyPhone}}</div>{{/if}}
          {{#if companyEmail}}<div><b>Email:</b> {{companyEmail}}</div>{{/if}}
        </div>
      </div>
      <div class="doc-title">
        <h2>TAX INVOICE</h2>
        <div>Invoice #: <span class="num">{{invoiceNumber}}</span></div>
        <div>Date: {{invoiceDate}}</div>
        {{#if dueDate}}<div>Due: {{dueDate}}</div>{{/if}}
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h3>Bill To</h3>
        <div><b>{{clientName}}</b></div>
        <div>{{clientAddress}}</div>
        {{#if clientGSTIN}}<div><b>GSTIN:</b> {{clientGSTIN}}</div>{{/if}}
        {{#if clientPhone}}<div><b>Phone:</b> {{clientPhone}}</div>{{/if}}
        {{#if clientEmail}}<div><b>Email:</b> {{clientEmail}}</div>{{/if}}
      </div>
      <div class="box">
        <h3>Summary</h3>
        <div>Status: <b>{{status}}</b></div>
        <div>Tax Mode: <b>{{taxMode}}</b></div>
        <div>Amount Paid: <b>{{amountPaid}}</b></div>
        <div>Balance Due: <b>{{balanceDue}}</b></div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:32px;text-align:center">#</th>
          <th>Description</th>
          <th style="width:80px;text-align:center">HSN/SAC</th>
          <th style="width:60px;text-align:right">Qty</th>
          <th style="width:90px;text-align:right">Rate</th>
          <th style="width:70px;text-align:right">GST</th>
          <th style="width:110px;text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {{itemsHtml}}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Subtotal</td><td style="text-align:right">{{subtotal}}</td></tr>
        {{#if cgst}}<tr><td>CGST</td><td style="text-align:right">{{cgst}}</td></tr>{{/if}}
        {{#if sgst}}<tr><td>SGST</td><td style="text-align:right">{{sgst}}</td></tr>{{/if}}
        {{#if igst}}<tr><td>IGST</td><td style="text-align:right">{{igst}}</td></tr>{{/if}}
        <tr><td>Round Off</td><td style="text-align:right">{{roundOff}}</td></tr>
        <tr class="grand"><td>Grand Total</td><td style="text-align:right">{{grandTotal}}</td></tr>
      </table>
    </div>
    <div class="words">Amount in words: {{grandTotalWords}}</div>

    <div class="foot">
      <div>
        {{#if notes}}<div class="notes"><b>Notes:</b><br/>{{notes}}</div>{{/if}}
        {{#if terms}}<div class="notes" style="margin-top:8px"><b>Terms:</b><br/>{{terms}}</div>{{/if}}
        {{#if companyBankDetails}}<div class="bank"><b>Bank Details:</b><br/>{{companyBankDetails}}</div>{{/if}}
      </div>
      <div>
        <div class="sign">
          For <b>{{companyName}}</b><br/><br/>
          Authorised Signatory
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
