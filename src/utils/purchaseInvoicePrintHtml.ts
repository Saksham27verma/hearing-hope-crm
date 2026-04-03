/**
 * Minimal, logo-free HTML for printing purchase records (internal filing copy).
 */

export type CompanyMasterRow = {
  id: string;
  name: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
};

export type PartyMasterRow = {
  id: string;
  name: string;
  gstType?: string;
  gstNumber?: string;
  address?: string;
  /** Shown as "Contact:" on printout when set. */
  contactPerson?: string;
  phone?: string;
  email?: string;
};

export type PurchaseLineForPrint = {
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

export type PurchaseInvoicePrintModel = {
  invoiceNo: string;
  purchaseDateLabel: string;
  reference?: string;
  gstType: string;
  gstPercentage: number;
  /** Legal entity billed to (from companies master or purchase snapshot). */
  billedToName: string;
  billedToLines: string[];
  billedToGst?: string;
  billedToFromMaster: boolean;
  /** Supplier (from parties master or purchase snapshot). */
  supplierName: string;
  supplierLines: string[];
  supplierGstType?: string;
  supplierGstNumber?: string;
  supplierContactPerson?: string;
  supplierFromMaster: boolean;
  lines: PurchaseLineForPrint[];
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  gstExempt: boolean;
};

function escapeHtml(value: string): string {
  return value
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

export function findCompanyByPurchaseCompanyName(
  companies: CompanyMasterRow[],
  purchaseCompanyName: string,
): CompanyMasterRow | null {
  const t = String(purchaseCompanyName || '').trim().toLowerCase();
  if (!t) return null;
  return companies.find((c) => String(c.name || '').trim().toLowerCase() === t) ?? null;
}

export function buildPurchaseInvoicePrintModel(params: {
  purchase: {
    invoiceNo: string;
    company: string;
    party: { id: string; name: string };
    reference?: string;
    gstType: string;
    gstPercentage: number;
    totalAmount: number;
    location?: string;
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
  purchaseDateLabel: string;
  partyMaster: PartyMasterRow | null;
  companyMaster: CompanyMasterRow | null;
}): PurchaseInvoicePrintModel {
  const { purchase, purchaseDateLabel, partyMaster, companyMaster } = params;

  const gstExempt = purchase.gstType === 'GST Exempted';
  const subtotal = Number(purchase.totalAmount) || 0;
  const pct = Number(purchase.gstPercentage) || 0;
  const gstAmount = gstExempt ? 0 : subtotal * (pct / 100);
  const grandTotal = gstExempt ? subtotal : subtotal + gstAmount;

  const lines: PurchaseLineForPrint[] = (purchase.products || []).map((p) => {
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
  const supplierName = partyMaster?.name || purchase.party.name || '—';
  const supplierLines: string[] = [];
  if (partyMaster?.address?.trim()) supplierLines.push(partyMaster.address.trim());
  if (!supplierLines.length && !supplierFromMaster) {
    supplierLines.push('(Supplier details not found in Parties — name from purchase record only.)');
  }

  const billedToFromMaster = !!companyMaster;
  const billedToName = companyMaster?.name || purchase.company || '—';
  const billedToLines = companyMaster ? formatAddressBlock(companyMaster) : [];
  if (!billedToLines.length && !billedToFromMaster) {
    billedToLines.push('(Company details not found in Companies — name from purchase record only.)');
  }

  return {
    invoiceNo: purchase.invoiceNo || '—',
    purchaseDateLabel,
    reference: purchase.reference,
    gstType: purchase.gstType || '—',
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

export function buildPurchaseInvoicePrintHtml(m: PurchaseInvoicePrintModel): string {
  const note = (ok: boolean) =>
    ok
      ? ''
      : '<p class="note">Details not found in master data — values below are from the purchase record or best available.</p>';

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
          ? `<div class="serials">${escapeHtml(line.serialNumbers.join(', '))}</div>`
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
    : `<tr><td colspan="6" class="num strong">GST</td><td class="num strong">${escapeHtml(formatCurrencyInr(m.gstAmount))}</td></tr>
<tr><td colspan="6" class="num strong">Grand total</td><td class="num strong">${escapeHtml(formatCurrencyInr(m.grandTotal))}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(m.invoiceNo)} — Purchase invoice</title>
<style>
  @page { margin: 12mm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.45; margin: 0; padding: 16px; }
  h1 { font-size: 16px; font-weight: 700; margin: 0 0 14px 0; letter-spacing: 0.02em; }
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
  table.meta td.k { width: 120px; color: #444; font-weight: 600; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th, table.items td { border: 1px solid #222; padding: 6px 8px; text-align: left; }
  table.items th { background: #f0f0f0; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  table.items td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.items .strong { font-weight: 700; }
</style>
</head>
<body>
  <h1>Purchase invoice</h1>

  <table class="meta">
    <tr><td class="k">Supplier invoice no.</td><td>${escapeHtml(m.invoiceNo)}</td></tr>
    <tr><td class="k">Date</td><td>${escapeHtml(m.purchaseDateLabel)}</td></tr>
    ${m.reference ? `<tr><td class="k">Reference</td><td>${escapeHtml(m.reference)}</td></tr>` : ''}
    ${metaGst}
  </table>

  <div class="grid2">
    <div class="box">
      <h2>Billed to</h2>
      ${billedNote}
      <div class="name">${escapeHtml(m.billedToName)}</div>
      ${billedAddr}
      ${m.billedToGst ? `<div><span class="muted">GSTIN:</span> ${escapeHtml(m.billedToGst)}</div>` : ''}
    </div>
    <div class="box">
      <h2>Supplier</h2>
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
        <th>Item</th>
        <th>Qty</th>
        <th>Unit price</th>
        <th>Discount</th>
        <th>Net unit</th>
        <th>Line total</th>
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
</body>
</html>`;
}

/**
 * Opens a same-origin blank window, writes HTML, then triggers print.
 *
 * Do not pass `noopener` in window.open's features: browsers then return `null`
 * from window.open while still opening a blank tab, so document.write never runs
 * and users see an empty window plus a false "allow pop-ups" message.
 */
export function openPurchaseInvoicePrintWindow(html: string): boolean {
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
  // Defer print so the document can paint (avoids blank print preview in some browsers).
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  }, 100);
  return true;
}
