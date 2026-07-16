import type {
  AccountingInvoice,
  AccountingInvoiceItem,
} from '@/lib/accounting/types';
import type { AccountingCompanyProfile } from '@/lib/accounting/companyProfile';
import {
  amountInWords,
  formatINR,
  isHearingAidInvoiceItem,
  normalizeAccountingInvoiceForDisplay,
  rateColumnLabelForItems,
} from '@/lib/accounting/computations';

const escapeHtml = (s: string | undefined | null): string =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const nl2br = (s: string | undefined | null): string =>
  escapeHtml(s).replace(/\n/g, '<br/>');

/** Unit price stays full list price; Amount Payable is the discounted line total. */
function itemsRows(
  items: AccountingInvoiceItem[],
  ratio: number = 1,
  showPayableCol: boolean,
): string {
  return items
    .map((it, i) => {
      const qty = Number(it.quantity || 0);
      const unit = Number(it.rate || 0);
      const listAmount = qty * unit;
      const payableAmount = listAmount * ratio;
      const serial = String(it.serialNumber || '').trim();
      const isHa = isHearingAidInvoiceItem(it);
      const unitLabel = isHa ? 'MRP' : 'Rate';
      return `
    <tr>
      <td class="c">${i + 1}</td>
      <td>
        <div class="desc">${nl2br(it.description)}</div>
        ${
          serial
            ? `<div class="serial" style="margin-top:4px;font-size:11px;color:#555"><b>Serial No.:</b> ${escapeHtml(serial)}</div>`
            : ''
        }
      </td>
      <td class="c">${escapeHtml(it.hsnSac || '')}</td>
      <td class="r">${qty}</td>
      <td class="r">
        <div class="unit-label">${unitLabel}</div>
        <div>${formatINR(unit).replace('₹', '')}</div>
      </td>
      <td class="r">${Number(it.gstPercent || 0)}%</td>
      ${
        showPayableCol
          ? `<td class="r muted-amt">${formatINR(listAmount).replace('₹', '')}</td>
      <td class="r"><b>${formatINR(payableAmount).replace('₹', '')}</b></td>`
          : `<td class="r">${formatINR(listAmount).replace('₹', '')}</td>`
      }
    </tr>`;
    })
    .join('');
}

export function renderAccountingInvoiceHtml(
  invoice: AccountingInvoice,
  company: AccountingCompanyProfile | null,
): string {
  const normalized = normalizeAccountingInvoiceForDisplay(invoice);
  const companyName = escapeHtml(company?.name || normalized.companyName);
  const companyAddress = nl2br(
    [company?.address, [company?.city, company?.state, company?.pincode].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join('\n'),
  );
  const client = normalized.clientSnapshot || { name: '' };
  const clientAddress = nl2br(
    [client.address, [client.city, client.state, client.pincode].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join('\n'),
  );
  const taxMode = normalized.taxMode || 'intra';
  const netPct = Math.min(
    100,
    Math.max(0.01, Number(normalized.netPayablePercent || 100)),
  );
  const ratio = netPct / 100;
  const showPayableCol = netPct < 100;
  const discountPct = Math.round((100 - netPct) * 100) / 100;
  const items = normalized.items || [];
  const rateColumnLabel = rateColumnLabelForItems(items);
  const grossSubtotal = Number(normalized.grossSubtotal ?? normalized.subtotal ?? 0);
  const grossGrandTotal = Number(
    normalized.grossGrandTotal ?? normalized.grandTotal ?? 0,
  );
  const discountAmt = Math.max(0, grossSubtotal - Number(normalized.subtotal || 0));
  const amountPayableLabel = showPayableCol ? 'Amount Payable' : 'Grand Total';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${escapeHtml(normalized.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 0; padding: 24px; font-size: 12px; }
    .wrap { max-width: 860px; margin: 0 auto; }
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
    table.items th { background: #fff3e0; color: #ef6c00; text-align: left; padding: 10px 8px; border-bottom: 2px solid #ef6c00; font-size: 11px; }
    table.items td { padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
    table.items td.c, table.items th.c { text-align: center; }
    table.items td.r, table.items th.r { text-align: right; }
    table.items .unit-label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; line-height: 1.3; }
    table.items td.muted-amt { color: #666; }
    .totals { margin-top: 12px; display: flex; justify-content: flex-end; }
    .totals table { border-collapse: collapse; min-width: 340px; }
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
        <h1>${companyName}</h1>
        <div class="meta">
          ${companyAddress}
          ${company?.gstNumber ? `<div><b>GSTIN:</b> ${escapeHtml(company.gstNumber)}</div>` : ''}
          ${company?.phone ? `<div><b>Phone:</b> ${escapeHtml(company.phone)}</div>` : ''}
          ${company?.email ? `<div><b>Email:</b> ${escapeHtml(company.email)}</div>` : ''}
        </div>
      </div>
      <div class="doc-title">
        <h2>TAX INVOICE</h2>
        <div>Invoice #: <span class="num">${escapeHtml(normalized.invoiceNumber)}</span></div>
        <div>Date: ${escapeHtml(normalized.invoiceDate)}</div>
        ${normalized.dueDate ? `<div>Due: ${escapeHtml(normalized.dueDate)}</div>` : ''}
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <h3>Bill To</h3>
        <div><b>${escapeHtml(client.name)}</b></div>
        <div>${clientAddress}</div>
        ${client.gstin ? `<div><b>GSTIN:</b> ${escapeHtml(client.gstin)}</div>` : ''}
        ${client.phone ? `<div><b>Phone:</b> ${escapeHtml(client.phone)}</div>` : ''}
        ${client.email ? `<div><b>Email:</b> ${escapeHtml(client.email)}</div>` : ''}
      </div>
      <div class="box">
        <h3>Summary</h3>
        <div>Status: <b>${escapeHtml(String(normalized.status || 'draft').toUpperCase())}</b></div>
        <div>Tax Mode: <b>${taxMode === 'intra' ? 'CGST + SGST (intra-state)' : 'IGST (inter-state)'}</b></div>
        <div>Amount Paid: <b>${formatINR(normalized.amountPaid || 0)}</b></div>
        <div>Balance Due: <b>${formatINR(Math.max(0, normalized.grandTotal - (normalized.amountPaid || 0) - Number(normalized.tdsDeducted || 0)))}</b></div>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th class="c" style="width:32px">#</th>
          <th>Description</th>
          <th class="c" style="width:80px">HSN/SAC</th>
          <th class="r" style="width:50px">Qty</th>
          <th class="r" style="width:100px">${escapeHtml(rateColumnLabel)} (₹)</th>
          <th class="r" style="width:60px">GST</th>
          ${
            showPayableCol
              ? `<th class="r" style="width:100px">${escapeHtml(rateColumnLabel)} Amount</th>
          <th class="r" style="width:110px">Amount Payable</th>`
              : `<th class="r" style="width:110px">Amount (₹)</th>`
          }
        </tr>
      </thead>
      <tbody>
        ${itemsRows(items, ratio, showPayableCol)}
      </tbody>
    </table>

    <div class="totals">
      <table>
        ${
          showPayableCol
            ? `<tr><td>${escapeHtml(rateColumnLabel)} Total</td><td class="r">${formatINR(grossSubtotal)}</td></tr>
        <tr><td>Discount (${discountPct}%)</td><td class="r">− ${formatINR(discountAmt)}</td></tr>`
            : ''
        }
        <tr><td>${showPayableCol ? 'Taxable (payable)' : 'Subtotal'}</td><td class="r">${formatINR(normalized.subtotal)}</td></tr>
        ${
          taxMode === 'intra'
            ? `<tr><td>CGST</td><td class="r">${formatINR(normalized.cgst)}</td></tr>
               <tr><td>SGST</td><td class="r">${formatINR(normalized.sgst)}</td></tr>`
            : `<tr><td>IGST</td><td class="r">${formatINR(normalized.igst)}</td></tr>`
        }
        <tr><td>Round Off</td><td class="r">${formatINR(normalized.roundOff)}</td></tr>
        <tr class="grand"><td>${escapeHtml(amountPayableLabel)}</td><td class="r">${formatINR(normalized.grandTotal)}</td></tr>
        ${
          showPayableCol
            ? `<tr><td style="color:#888;font-size:11px">${escapeHtml(rateColumnLabel)} Grand Total</td><td class="r" style="color:#888;font-size:11px">${formatINR(grossGrandTotal)}</td></tr>`
            : ''
        }
      </table>
    </div>
    <div class="words">Amount in words: ${escapeHtml(amountInWords(normalized.grandTotal))}</div>

    <div class="foot">
      <div>
        ${normalized.notes ? `<div class="notes"><b>Notes:</b><br/>${nl2br(normalized.notes)}</div>` : ''}
        ${normalized.terms ? `<div class="notes" style="margin-top:8px"><b>Terms:</b><br/>${nl2br(normalized.terms)}</div>` : ''}
        ${
          company?.bankName || company?.accountNumber || company?.ifsc
            ? `<div class="bank">
                <b>Bank Details:</b><br/>
                ${company?.bankName ? `Bank: ${escapeHtml(company.bankName)}<br/>` : ''}
                ${company?.accountNumber ? `A/C: ${escapeHtml(company.accountNumber)}<br/>` : ''}
                ${company?.ifsc ? `IFSC: ${escapeHtml(company.ifsc)}` : ''}
                ${company?.branch ? ` &middot; ${escapeHtml(company.branch)}` : ''}
              </div>`
            : ''
        }
      </div>
      <div>
        <div class="sign">
          For <b>${companyName}</b><br/><br/>
          Authorised Signatory
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function openInvoiceHtmlInNewTab(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function printInvoiceHtml(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.addEventListener('load', () => {
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {
        /* ignore */
      }
    }, 300);
  });
}

export function buildWhatsAppShareUrl({
  phone,
  companyName,
  invoiceNumber,
  amount,
  dueDate,
}: {
  phone?: string;
  companyName: string;
  invoiceNumber: string;
  amount: number;
  dueDate?: string;
}) {
  const digits = String(phone || '').replace(/\D/g, '');
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  const parts = [
    `Hello,`,
    ``,
    `Please find below invoice details from ${companyName}:`,
    `Invoice #: ${invoiceNumber}`,
    `Amount: ${formatINR(amount)}`,
    ...(dueDate ? [`Due: ${dueDate}`] : []),
    ``,
    `Please share your confirmation. Thank you.`,
  ];
  const text = encodeURIComponent(parts.join('\n'));
  return normalized
    ? `https://wa.me/${normalized}?text=${text}`
    : `https://wa.me/?text=${text}`;
}
