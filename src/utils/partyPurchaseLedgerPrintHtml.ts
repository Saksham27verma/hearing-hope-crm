/**
 * Printable account/purchase ledger for a party (supplier) in Parties.
 */

export type PartyLedgerPrintParty = {
  name: string;
  type?: string;
  gstType?: string;
  gstNumber?: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
};

export type PartyLedgerPrintRow = {
  dateLabel: string;
  invoiceNo: string;
  company: string;
  centerLabel: string;
  subtotal: number;
  grandTotal: number;
};

export type PartyLedgerPrintModel = {
  party: PartyLedgerPrintParty;
  rows: PartyLedgerPrintRow[];
  sortNewestFirst: boolean;
  printedAtLabel: string;
  sumSubtotal: number;
  sumGrandTotal: number;
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

function gstLine(party: PartyLedgerPrintParty): string {
  const gstType = (party.gstType || '').trim();
  if (gstType === 'Exempt' || gstType === 'GST Exempted') {
    return 'GST: Exempted';
  }
  const gstin = (party.gstNumber || '').trim();
  if (gstType && gstin) return `GST (${gstType}): ${gstin}`;
  if (gstin) return `GSTIN: ${gstin}`;
  if (gstType) return `GST type: ${gstType}`;
  return '';
}

export function renderPartyPurchaseLedgerHtml(model: PartyLedgerPrintModel): string {
  const { party, rows, sortNewestFirst, printedAtLabel, sumSubtotal, sumGrandTotal } = model;
  const gst = gstLine(party);
  const contactBits = [party.contactPerson, party.phone, party.email].filter(Boolean).join(' · ');

  const bodyRows =
    rows.length === 0
      ? `<tr><td colspan="6" style="text-align:center;color:#666;padding:16px">No purchase invoices found for this party.</td></tr>`
      : rows
          .map(
            (r) => `
        <tr>
          <td>${escapeHtml(r.dateLabel)}</td>
          <td>${escapeHtml(r.invoiceNo || '—')}</td>
          <td>${escapeHtml(r.company || '—')}</td>
          <td>${escapeHtml(r.centerLabel || '—')}</td>
          <td class="num">${escapeHtml(formatCurrencyInr(r.subtotal))}</td>
          <td class="num">${escapeHtml(formatCurrencyInr(r.grandTotal))}</td>
        </tr>`,
          )
          .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Account ledger — ${escapeHtml(party.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 0; padding: 24px; font-size: 12px; }
    h1 { margin: 0 0 4px; font-size: 18px; }
    h2 { margin: 16px 0 8px; font-size: 14px; letter-spacing: 0.04em; text-align: center; text-transform: uppercase; }
    .meta { color: #555; line-height: 1.5; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0 16px; }
    .box { border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
    .box h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; color: #444; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; border-bottom: 2px solid #333; padding: 8px 6px; }
    td { border-bottom: 1px solid #e5e5e5; padding: 7px 6px; vertical-align: top; }
    th.num, td.num { text-align: right; white-space: nowrap; }
    tfoot td { font-weight: bold; border-top: 2px solid #333; border-bottom: none; }
    .foot { margin-top: 20px; color: #666; font-size: 11px; }
    @media print {
      body { padding: 0; }
      @page { size: A4; margin: 14mm; }
    }
  </style>
</head>
<body>
  <h1>Hearing Hope</h1>
  <div class="meta">Account ledger (purchase invoices)</div>
  <h2>Account Ledger</h2>
  <div class="grid">
    <div class="box">
      <h3>Party</h3>
      <div><b>${escapeHtml(party.name)}</b>${party.type ? ` · ${escapeHtml(party.type)}` : ''}</div>
      ${party.address ? `<div>${escapeHtml(party.address).replace(/\n/g, '<br/>')}</div>` : ''}
      ${gst ? `<div>${escapeHtml(gst)}</div>` : ''}
      ${contactBits ? `<div>${escapeHtml(contactBits)}</div>` : ''}
    </div>
    <div class="box">
      <h3>Statement</h3>
      <div>Invoices: <b>${rows.length}</b></div>
      <div>Order: ${sortNewestFirst ? 'Newest first' : 'Oldest first'}</div>
      <div>Printed: ${escapeHtml(printedAtLabel)}</div>
      <div>Total (incl. GST): <b>${escapeHtml(formatCurrencyInr(sumGrandTotal))}</b></div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Invoice #</th>
        <th>Company</th>
        <th>Center</th>
        <th class="num">Subtotal</th>
        <th class="num">Total (incl. GST)</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
    ${
      rows.length
        ? `<tfoot>
      <tr>
        <td colspan="4">Total (${rows.length} invoices)</td>
        <td class="num">${escapeHtml(formatCurrencyInr(sumSubtotal))}</td>
        <td class="num">${escapeHtml(formatCurrencyInr(sumGrandTotal))}</td>
      </tr>
    </tfoot>`
        : ''
    }
  </table>
  <div class="foot">Generated from Parties · purchase invoices where this party is the supplier. Subtotal is before GST.</div>
</body>
</html>`;
}

export function openPartyPurchaseLedgerPrintWindow(html: string): boolean {
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
