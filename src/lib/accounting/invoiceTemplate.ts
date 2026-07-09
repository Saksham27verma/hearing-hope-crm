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

function lineSubtotal(it: AccountingInvoiceItem): number {
  return Number(it.quantity || 0) * Number(it.rate || 0);
}

function lineGst(it: AccountingInvoiceItem): number {
  const sub = lineSubtotal(it);
  return Math.round((sub * Number(it.gstPercent || 0)) / 100 * 100) / 100;
}

function linePayable(it: AccountingInvoiceItem): number {
  return Math.round((lineSubtotal(it) + lineGst(it)) * 100) / 100;
}

export function formatInvoiceMonth(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function splitDescription(desc: string): { title: string; detail: string } {
  const parts = String(desc || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { title: '', detail: '' };
  if (parts.length === 1) return { title: parts[0], detail: '' };
  return { title: parts[0], detail: parts.slice(1).join(' · ') };
}

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

function buildItemsHopeEnterprisesHtml(items: AccountingInvoiceItem[]): string {
  return items
    .map((it, i) => {
      const { title, detail } = splitDescription(it.description);
      const sub = lineSubtotal(it);
      const gst = lineGst(it);
      const payable = linePayable(it);
      return `
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="border: 1px solid #e0e0e0; text-align: center;" valign="top">${i + 1}</td>
        <td style="border: 1px solid #e0e0e0;" valign="top">
          <b>${escapeHtml(title || it.description)}</b>
          ${detail ? `<br><span style="color: #666; font-size: 11px;">${escapeHtml(detail)}</span>` : ''}
        </td>
        <td style="border: 1px solid #e0e0e0; text-align: center;" valign="top">${escapeHtml(it.hsnSac || '')}</td>
        <td style="border: 1px solid #e0e0e0; text-align: right;" valign="top">${rupee(Number(it.rate || 0))}</td>
        <td style="border: 1px solid #e0e0e0; text-align: center;" valign="top">${Number(it.quantity || 0)}</td>
        <td style="border: 1px solid #e0e0e0; text-align: center;" valign="top">${Number(it.gstPercent || 0)}%</td>
        <td style="border: 1px solid #e0e0e0; text-align: right;" valign="top">${rupee(gst)}</td>
        <td style="border: 1px solid #e0e0e0; text-align: right; font-weight: bold;" valign="top">${rupee(sub)}</td>
        <td style="border: 1px solid #e0e0e0; text-align: right; font-weight: bold;" valign="top">${rupee(payable)}</td>
      </tr>`;
    })
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

  const balanceDue = Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.amountPaid || 0) - Number((invoice as any).tdsDeducted || 0));

  const clientAddressComma = [
    client.address,
    client.city,
    client.state,
    client.pincode,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    companyName: escapeHtml(company?.name || invoice.companyName),
    companyAddress: nl2br(companyAddress),
    companyAddressPlain: escapeHtml(companyAddress),
    companyGSTIN: escapeHtml(company?.gstNumber || ''),
    companyPhone: escapeHtml(company?.phone || ''),
    companyEmail: escapeHtml(company?.email || ''),
    companyWebsite: escapeHtml(company?.website || ''),
    companyBankDetails: nl2br(bankDetailsParts.join('\n')),
    companyLogoUrl: '',
    signatureImageUrl: '',

    invoiceNumber: escapeHtml(invoice.invoiceNumber),
    invoiceDate: escapeHtml(invoice.invoiceDate),
    invoiceMonth: escapeHtml(String(invoice.invoiceMonth || '').trim()),
    dueDate: escapeHtml(invoice.dueDate || ''),
    status: escapeHtml(String(invoice.status || 'draft').toUpperCase()),
    taxMode:
      invoice.taxMode === 'inter' ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)',

    clientName: escapeHtml(client.name || ''),
    clientAddress: nl2br(clientAddress),
    clientAddressPlain: escapeHtml(clientAddress),
    clientAddressComma: escapeHtml(clientAddressComma),
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
    grossSubtotal: rupee(Number((invoice as any).grossSubtotal || invoice.subtotal || 0)),
    grossGrandTotal: rupee(Number((invoice as any).grossGrandTotal || invoice.grandTotal || 0)),
    netPayablePercent:
      Number((invoice as any).netPayablePercent || 100) < 100
        ? String(Number((invoice as any).netPayablePercent))
        : '',
    netPayableReduction:
      Number((invoice as any).netPayablePercent || 100) < 100
        ? rupee(
            Number((invoice as any).grossGrandTotal || 0) - Number(invoice.grandTotal || 0),
          )
        : '',
    amountPaid: rupee(invoice.amountPaid),
    tdsDeducted: rupee(Number((invoice as any).tdsDeducted || 0)),
    settledAmount: rupee(Number(invoice.amountPaid || 0) + Number((invoice as any).tdsDeducted || 0)),
    balanceDue: rupee(balanceDue),
    grandTotalWords: escapeHtml(amountInWords(invoice.grandTotal)),

    itemsHtml: buildItemsHtml(invoice.items || []),
    itemsPlainHtml: buildItemsPlainRows(invoice.items || []),
    itemsHopeEnterprisesHtml: buildItemsHopeEnterprisesHtml(invoice.items || []),

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
  { key: 'invoiceMonth', desc: 'Invoice month label (optional — hidden on PDF when empty)' },
  { key: 'dueDate', desc: 'Due date (may be empty)' },
  { key: 'status', desc: 'Uppercase status (DRAFT / SENT / PAID …)' },
  { key: 'taxMode', desc: 'Descriptive tax mode label' },

  { key: 'clientName', desc: 'Client name' },
  { key: 'clientAddress', desc: 'Client address as HTML block' },
  { key: 'clientAddressComma', desc: 'Client address comma-separated (street, city, state, pin)' },
  { key: 'clientGSTIN', desc: 'Client GSTIN' },
  { key: 'clientPhone', desc: 'Client phone' },
  { key: 'clientEmail', desc: 'Client email' },

  { key: 'subtotal', desc: 'Subtotal (₹ formatted)' },
  { key: 'cgst', desc: 'CGST amount' },
  { key: 'sgst', desc: 'SGST amount' },
  { key: 'igst', desc: 'IGST amount' },
  { key: 'totalGst', desc: 'Total GST' },
  { key: 'roundOff', desc: 'Round off' },
  { key: 'grandTotal', desc: 'Grand total (after net payable %)' },
  { key: 'grossGrandTotal', desc: 'Grand total before net payable % (equal to grandTotal when 100%)' },
  { key: 'grossSubtotal', desc: 'Subtotal before net payable % scaling' },
  { key: 'netPayablePercent', desc: 'Net payable % (empty when 100%) — use inside {{#if netPayablePercent}}' },
  { key: 'netPayableReduction', desc: 'Amount reduced due to net payable % (empty when 100%)' },
  { key: 'amountPaid', desc: 'Amount already received' },
  { key: 'tdsDeducted', desc: 'TDS deducted by client to date' },
  { key: 'settledAmount', desc: 'Total settled = amountPaid + tdsDeducted' },
  { key: 'balanceDue', desc: 'Balance still due' },
  { key: 'grandTotalWords', desc: 'Amount in words' },

  { key: 'itemsHtml', desc: 'Full styled <tr> rows for line items table' },
  { key: 'itemsHopeEnterprisesHtml', desc: 'Hope Enterprises / Zoho-style line item rows (9 columns)' },
  { key: 'itemsPlainHtml', desc: 'Unstyled <tr> rows if you\u2019re providing your own CSS' },
  { key: 'companyLogoUrl', desc: 'Logo image URL (set in template HTML if needed)' },
  { key: 'signatureImageUrl', desc: 'Signature image URL (set in template HTML if needed)' },

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

/** Hope Enterprises layout (converted from Zoho CRM template). */
export function getHopeEnterprisesInvoiceTemplate(): string {
  const logoUrl =
    'https://crm.zoho.in/crm/viewInLineImage?fileContent=7e6626e61d93856172a5d0a1ebf06b42e64c69461d1222a3aaf9bb56b41f3389c3955f980503bfebe17da7cd2e4c8f4e26f40bafdc3399cd4c8ad327d686881887d47887560678e72d8cab828257341a6c622bb8466972824531eb9c32159f97';
  const signatureUrl =
    'https://crm.zoho.in/crm/viewInLineImage?fileContent=0f21df6d64058a73e142a428a27a7895d490ebb243a2df565ed37f2a9e5da9a38789d734b7bf38c65ab1c2dddbd3263a2c5dfe0181fc1b159fd174a8d9a09f1879e2062daa01ae55616de618c50c65a332b00b5084728ade32d4df45813a0c7a';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Tax Invoice {{invoiceNumber}}</title>
</head>
<body style="margin:0;padding:0;">
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333; max-width: 900px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e0e0e0;">

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
    <tr>
      <td width="60%" valign="top">
        <img src="${logoUrl}" alt="Logo" width="90" style="margin-bottom: 10px;"><br>
        <span style="font-size: 22px; font-weight: bold; color: #111;">{{companyName}}</span><br>
        <span style="font-size: 13px; color: #555; line-height: 1.5;">
          {{companyAddress}}
          {{#if companyEmail}}<br>Email: {{companyEmail}}{{/if}}{{#if companyPhone}} | Contact: {{companyPhone}}{{/if}}
          {{#if companyWebsite}}<br>Website: {{companyWebsite}}{{/if}}
        </span>
      </td>
      <td width="40%" valign="top" align="right" style="line-height: 1.6;">
        <span style="font-size: 26px; font-weight: bold; color: #111; text-transform: uppercase;">Tax Invoice</span><br>
        <span style="font-size: 13px; color: #333;"><b>Invoice Date:</b> {{invoiceDate}}</span><br>
        <span style="font-size: 13px; color: #333;"><b>Invoice Number:</b> {{invoiceNumber}}</span><br>
        {{#if invoiceMonth}}<span style="font-size: 13px; color: #333;"><b>Invoice Month:</b> {{invoiceMonth}}</span><br>{{/if}}
        <span style="font-size: 13px; color: #333;"><b>GSTIN:</b> {{companyGSTIN}}</span>
      </td>
    </tr>
  </table>

  <hr style="border: 0; border-top: 2px solid #333; margin: 20px 0;">

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 30px; font-size: 13px;">
    <tr>
      <td width="50%" valign="top" style="line-height: 1.6;">
        <span style="font-size: 15px; font-weight: bold; color: #111; border-bottom: 1px solid #ccc; padding-bottom: 3px;">BILL TO</span><br><br>
        <b>Name:</b> {{clientName}}<br>
        {{#if clientPhone}}<b>Contact No:</b> {{clientPhone}}<br>{{/if}}
        {{#if clientAddressComma}}<b>Address:</b> {{clientAddressComma}}<br>{{/if}}
      </td>
      <td width="50%" valign="top" align="right" style="line-height: 1.6;">
        <br><br>
        {{#if clientGSTIN}}<b>Customer GSTIN:</b> {{clientGSTIN}}<br>{{/if}}
      </td>
    </tr>
  </table>

  <table width="100%" border="0" cellspacing="0" cellpadding="8" style="font-size: 12px; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e0e0e0;">
    <thead>
      <tr style="background-color: #f4f5f7; border-bottom: 2px solid #ccc; text-align: left;">
        <th style="border: 1px solid #e0e0e0; font-weight: bold; width: 5%;">S.No</th>
        <th style="border: 1px solid #e0e0e0; font-weight: bold; width: 28%;">Item Name &amp; Description</th>
        <th style="border: 1px solid #e0e0e0; font-weight: bold; width: 9%; text-align: center;">SAC/HSN</th>
        <th style="border: 1px solid #e0e0e0; font-weight: bold; width: 9%; text-align: right;">Rate</th>
        <th style="border: 1px solid #e0e0e0; font-weight: bold; width: 6%; text-align: center;">Qty</th>
        <th style="border: 1px solid #e0e0e0; font-weight: bold; width: 7%; text-align: center;">GST (%)</th>
        <th style="border: 1px solid #e0e0e0; font-weight: bold; width: 10%; text-align: right;">GST Amt</th>
        <th style="border: 1px solid #e0e0e0; font-weight: bold; width: 12%; text-align: right;">Total Amount</th>
        <th style="border: 1px solid #e0e0e0; font-weight: bold; width: 14%; text-align: right;">Total Amount Payable</th>
      </tr>
    </thead>
    <tbody>
      {{itemsHopeEnterprisesHtml}}
    </tbody>
  </table>

  <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 13px; margin-bottom: 30px;">
    <tr>
      <td width="65%" valign="top"></td>
      <td width="35%" valign="top">
        <table width="100%" border="0" cellspacing="0" cellpadding="4">
          <tr>
            <td align="left"><b>Sub Total:</b></td>
            <td align="right">{{subtotal}}</td>
          </tr>
          <tr>
            <td align="left"><b>Total GST:</b></td>
            <td align="right">{{totalGst}}</td>
          </tr>
          <tr>
            <td colspan="2"><hr style="border: 0; border-top: 1px solid #ccc; margin: 5px 0;"></td>
          </tr>
          <tr>
            <td align="left"><b style="font-size: 15px;">Grand Total:</b></td>
            <td align="right"><b style="font-size: 15px;">{{grandTotal}}</b></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="font-size: 12px; line-height: 1.5; color: #555; text-align: justify; margin-bottom: 40px;">
    I acknowledge that the particulars given above are true and correct, and I am satisfied with the services rendered to me.
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 12px;">
    <tr>
      <td width="60%" valign="top" style="line-height: 1.6; padding-right: 20px;">
        <b style="font-size: 14px; color: #111;">Terms and Conditions:</b><br>
        {{#if terms}}<div style="margin-top: 5px; color: #555;">{{terms}}</div>{{/if}}
        <ul style="margin-top: 5px; padding-left: 15px; color: #555;">
          <li>Goods/Services once sold/rendered will not be taken back or refunded.</li>
          <li>Interest @ 24% P.A. will be charged if payment is not received within 15 days from the date of the bill.</li>
          <li>All disputes are subject to Delhi Jurisdiction.</li>
          <li>Home visit charges will be extra (if applicable).</li>
        </ul>
      </td>
      <td width="40%" valign="bottom" align="center" style="border: 1px solid #e0e0e0; background-color: #f9f9f9; padding: 20px 10px;">
        <img src="${signatureUrl}" alt="Signature" height="60"><br>
        <hr style="border: 0; border-top: 1px solid #ccc; width: 80%; margin: 10px auto;">
        <b>Authorised Signatory</b><br>
        <span style="color: #777;">For {{companyName}}</span>
      </td>
    </tr>
  </table>

  <div style="margin-top: 40px; border-top: 1px dotted #ccc; padding-top: 20px;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 12px;">
      <tr>
        <td align="left"><b>Customer Signature:</b> ___________________________</td>
      </tr>
    </table>
  </div>

</div>
</body>
</html>`;
}
