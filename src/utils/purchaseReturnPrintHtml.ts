/**
 * HTML print/PDF utility for Purchase Return documents.
 * Follows the same style and structure as purchaseInvoicePrintHtml.ts.
 */

import type { CompanyMasterRow, PartyMasterRow } from './purchaseInvoicePrintHtml';

export type PurchaseReturnLineForPrint = {
  name: string;
  type: string;
  quantity: number;
  quantityLabel: string;
  unitPrice: number;
  discountPercent?: number;
  finalUnit: number;
  lineTotal: number;
  serialNumbers: string[];
};

export type PurchaseReturnPrintModel = {
  returnNumber: string;
  returnDateLabel: string;
  originalInvoiceNo: string;
  reason?: string;
  notes?: string;
  gstType: string;
  gstPercentage: number;
  billedToName: string;
  billedToLines: string[];
  billedToGst?: string;
  billedToFromMaster: boolean;
  supplierName: string;
  supplierLines: string[];
  supplierGstType?: string;
  supplierGstNumber?: string;
  supplierContactPerson?: string;
  supplierFromMaster: boolean;
  lines: PurchaseReturnLineForPrint[];
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  gstExempt: boolean;
};

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrencyInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatAddressBlock(c: CompanyMasterRow): string[] {
  const lines: string[] = [];
  const a = (c.address || '').trim();
  if (a) lines.push(a);
  const cityState = [c.city, c.state].filter(Boolean).join(', ').trim();
  const pin = (c.pincode || '').trim();
  if (cityState || pin) {
    lines.push([cityState, pin].filter(Boolean).join(' - '));
  }
  return lines;
}

export function buildPurchaseReturnPrintModel(params: {
  purchaseReturn: {
    returnNumber: string;
    originalInvoiceNo: string;
    party: { id: string; name: string };
    company: string;
    gstType: string;
    gstPercentage: number;
    totalReturnAmount: number;
    reason?: string;
    notes?: string;
    products: Array<{
      name: string;
      type: string;
      quantity: number;
      dealerPrice: number;
      discountPercent?: number;
      finalPrice?: number;
      serialNumbers?: string[];
      quantityType?: 'piece' | 'pair';
    }>;
  };
  returnDateLabel: string;
  partyMaster: PartyMasterRow | null;
  companyMaster: CompanyMasterRow | null;
}): PurchaseReturnPrintModel {
  const { purchaseReturn, returnDateLabel, partyMaster, companyMaster } = params;

  const gstExempt = purchaseReturn.gstType === 'GST Exempted';
  const subtotal = Number(purchaseReturn.totalReturnAmount) || 0;
  const pct = Number(purchaseReturn.gstPercentage) || 0;
  const gstAmount = gstExempt ? 0 : subtotal * (pct / 100);
  const grandTotal = gstExempt ? subtotal : subtotal + gstAmount;

  const lines: PurchaseReturnLineForPrint[] = (purchaseReturn.products || []).map((p) => {
    const finalUnit = p.finalPrice ?? p.dealerPrice ?? 0;
    const qty = p.quantity || 0;
    const isPair = p.type === 'Hearing Aid' && p.quantityType === 'pair';
    const quantityLabel = isPair ? (qty === 1 ? 'pair' : 'pairs') : qty === 1 ? 'pc' : 'pcs';
    return {
      name: p.name || '—',
      type: p.type || '—',
      quantity: qty,
      quantityLabel,
      unitPrice: p.dealerPrice ?? 0,
      discountPercent: p.discountPercent,
      finalUnit,
      lineTotal: finalUnit * qty,
      serialNumbers: Array.isArray(p.serialNumbers) ? p.serialNumbers.filter(Boolean) : [],
    };
  });

  const supplierFromMaster = !!partyMaster;
  const supplierName = partyMaster?.name || purchaseReturn.party.name || '—';
  const supplierLines: string[] = [];
  if (partyMaster?.address?.trim()) supplierLines.push(partyMaster.address.trim());
  if (!supplierLines.length && !supplierFromMaster) {
    supplierLines.push('(Supplier details not found in Parties — name from return record only.)');
  }

  const billedToFromMaster = !!companyMaster;
  const billedToName = companyMaster?.name || purchaseReturn.company || '—';
  const billedToLines = companyMaster ? formatAddressBlock(companyMaster) : [];
  if (!billedToLines.length && !billedToFromMaster) {
    billedToLines.push('(Company details not found in Companies — name from return record only.)');
  }

  return {
    returnNumber: purchaseReturn.returnNumber || '—',
    returnDateLabel,
    originalInvoiceNo: purchaseReturn.originalInvoiceNo || '—',
    reason: purchaseReturn.reason,
    notes: purchaseReturn.notes,
    gstType: purchaseReturn.gstType || '—',
    gstPercentage: pct,
    billedToName,
    billedToLines,
    billedToGst: companyMaster?.gstNumber,
    billedToFromMaster,
    supplierName,
    supplierLines,
    supplierGstType: partyMaster?.gstType,
    supplierGstNumber: partyMaster?.gstNumber,
    supplierContactPerson: partyMaster?.contactPerson,
    supplierFromMaster,
    lines,
    subtotal,
    gstAmount,
    grandTotal,
    gstExempt,
  };
}

export function buildPurchaseReturnPrintHtml(m: PurchaseReturnPrintModel): string {
  const note = (ok: boolean) =>
    ok
      ? ''
      : '<p class="note">Details not found in master data — values below are from the return record or best available.</p>';

  const billedNote = note(m.billedToFromMaster);
  const supplierNote = note(m.supplierFromMaster);

  const rowsHtml = m.lines
    .map((line, i) => {
      const disc =
        line.discountPercent != null && line.discountPercent > 0
          ? `${line.discountPercent}%`
          : '—';
      const serials =
        line.serialNumbers.length > 0
          ? `<div class="serials">S/N: ${escapeHtml(line.serialNumbers.join(', '))}</div>`
          : '';
      return `<tr>
  <td class="num">${i + 1}</td>
  <td><strong>${escapeHtml(line.name)}</strong><div class="muted">${escapeHtml(line.type)}</div>${serials}</td>
  <td class="num">${line.quantity} ${escapeHtml(line.quantityLabel)}</td>
  <td class="num">${escapeHtml(formatCurrencyInr(line.unitPrice))}</td>
  <td class="num">${escapeHtml(disc)}</td>
  <td class="num">${escapeHtml(formatCurrencyInr(line.finalUnit))}</td>
  <td class="num">${escapeHtml(formatCurrencyInr(line.lineTotal))}</td>
</tr>`;
    })
    .join('\n');

  const billedAddr = m.billedToLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
  const supplierAddr = m.supplierLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');

  const metaGst = m.gstExempt
    ? '<tr><td class="k">GST</td><td>Exempted</td></tr>'
    : `<tr><td class="k">GST</td><td>${escapeHtml(m.gstType)} @ ${m.gstPercentage}%</td></tr>`;

  const totalsExtra = m.gstExempt
    ? ''
    : `<tr><td colspan="6" class="num strong">GST (${m.gstPercentage}%)</td><td class="num strong">${escapeHtml(formatCurrencyInr(m.gstAmount))}</td></tr>
<tr><td colspan="6" class="num strong grand">Grand total</td><td class="num strong grand">${escapeHtml(formatCurrencyInr(m.grandTotal))}</td></tr>`;

  const reasonBlock =
    m.reason || m.notes
      ? `<div class="remarks-box">
          ${m.reason ? `<div><span class="k">Reason:</span> ${escapeHtml(m.reason)}</div>` : ''}
          ${m.notes ? `<div><span class="k">Notes:</span> ${escapeHtml(m.notes)}</div>` : ''}
        </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(m.returnNumber)} — Purchase Return</title>
<style>
  @page { margin: 12mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.45; margin: 0; padding: 16px; }
  h1 { font-size: 16px; font-weight: 700; margin: 0 0 4px 0; letter-spacing: 0.02em; }
  .badge { display: inline-block; background: #fff3e0; color: #b45309; border: 1px solid #f59e0b; border-radius: 4px; padding: 2px 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; margin-bottom: 14px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  @media print { .grid2 { break-inside: avoid; } }
  .box { border: 1px solid #222; padding: 10px; }
  .box h2 { font-size: 11px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.06em; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .box .name { font-weight: 700; font-size: 12px; margin-bottom: 6px; }
  .note { font-size: 10px; color: #666; margin: 0 0 6px 0; font-style: italic; }
  .muted { color: #555; font-size: 10px; }
  .serials { font-size: 10px; color: #333; margin-top: 4px; font-family: ui-monospace, monospace; }
  table.meta { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  table.meta td { padding: 3px 8px 3px 0; vertical-align: top; }
  table.meta td.k { width: 140px; color: #444; font-weight: 600; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th, table.items td { border: 1px solid #222; padding: 6px 8px; text-align: left; }
  table.items th { background: #fff3e0; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  table.items td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.items .strong { font-weight: 700; }
  table.items .grand { background: #fff3e0; }
  .remarks-box { border: 1px solid #f59e0b; background: #fffbf0; padding: 8px 12px; margin-top: 14px; border-radius: 2px; }
  .remarks-box .k { font-weight: 600; color: #b45309; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; text-align: center; border-top: 1px solid #ddd; padding-top: 8px; }
</style>
</head>
<body>
  <h1>Purchase Return</h1>
  <div class="badge">RETURN DOCUMENT</div>

  <table class="meta">
    <tr><td class="k">Return number</td><td><strong>${escapeHtml(m.returnNumber)}</strong></td></tr>
    <tr><td class="k">Return date</td><td>${escapeHtml(m.returnDateLabel)}</td></tr>
    <tr><td class="k">Against invoice</td><td>${escapeHtml(m.originalInvoiceNo)}</td></tr>
    ${metaGst}
  </table>

  <div class="grid2">
    <div class="box">
      <h2>Company (Returning party)</h2>
      ${billedNote}
      <div class="name">${escapeHtml(m.billedToName)}</div>
      ${billedAddr}
      ${m.billedToGst ? `<div><span class="muted">GSTIN:</span> ${escapeHtml(m.billedToGst)}</div>` : ''}
    </div>
    <div class="box">
      <h2>Supplier (Receiving return)</h2>
      ${supplierNote}
      <div class="name">${escapeHtml(m.supplierName)}</div>
      ${m.supplierContactPerson ? `<div class="muted">${escapeHtml(m.supplierContactPerson)}</div>` : ''}
      ${supplierAddr}
      ${m.supplierGstType ? `<div><span class="muted">GST type:</span> ${escapeHtml(m.supplierGstType)}</div>` : ''}
      ${m.supplierGstNumber ? `<div><span class="muted">GSTIN:</span> ${escapeHtml(m.supplierGstNumber)}</div>` : ''}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>#</th>
        <th>Item / Serial Numbers</th>
        <th>Qty Returned</th>
        <th>Unit price</th>
        <th>Discount</th>
        <th>Net unit</th>
        <th>Return value</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr>
        <td colspan="6" class="num strong">Subtotal</td>
        <td class="num strong">${escapeHtml(formatCurrencyInr(m.subtotal))}</td>
      </tr>
      ${totalsExtra}
    </tbody>
  </table>

  ${reasonBlock}

  <div class="footer">
    This is a system-generated purchase return document. Return # ${escapeHtml(m.returnNumber)}
  </div>
</body>
</html>`;
}

/**
 * Opens a blank window, writes the return HTML, and triggers the browser print dialog.
 * Returns false if pop-ups are blocked.
 */
export function openPurchaseReturnPrintWindow(html: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  try {
    w.document.open();
    w.document.write(html);
    w.document.close();
  } catch {
    w.close();
    return false;
  }
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  }, 100);
  return true;
}
