import type {
  AccountingClient,
  AccountingInvoice,
  AccountingPayment,
} from '@/lib/accounting/types';
import type { AccountingCompanyProfile } from '@/lib/accounting/companyProfile';
import { amountInWords, formatINR, roundTo2 } from '@/lib/accounting/computations';

export type LedgerEntry = {
  date: string;
  type: 'opening' | 'invoice' | 'payment';
  particulars: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  balanceType: 'Dr' | 'Cr';
  invoiceId?: string;
  paymentId?: string;
};

export type LedgerBuildInput = {
  client: AccountingClient;
  invoices: AccountingInvoice[];
  payments: AccountingPayment[];
  dateFrom?: string;
  dateTo?: string;
};

export type LedgerBuildResult = {
  entries: LedgerEntry[];
  openingBalance: number;
  openingType: 'Dr' | 'Cr';
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingType: 'Dr' | 'Cr';
};

function signedBalance(prevSigned: number, debit: number, credit: number): number {
  return roundTo2(prevSigned + debit - credit);
}

function toDisplay(signed: number): { amount: number; type: 'Dr' | 'Cr' } {
  if (signed >= 0) return { amount: roundTo2(signed), type: 'Dr' };
  return { amount: roundTo2(-signed), type: 'Cr' };
}

export function buildLedger({
  client,
  invoices,
  payments,
  dateFrom,
  dateTo,
}: LedgerBuildInput): LedgerBuildResult {
  const openingSigned =
    client.openingBalanceType === 'debit'
      ? Number(client.openingBalance || 0)
      : -Number(client.openingBalance || 0);

  const relevantInvoices = invoices.filter((i) => i.status !== 'cancelled' && i.status !== 'draft');

  const events: Array<{
    date: string;
    kind: 'invoice' | 'payment';
    invoice?: AccountingInvoice;
    payment?: AccountingPayment;
  }> = [];
  for (const inv of relevantInvoices) {
    events.push({ date: inv.invoiceDate || '', kind: 'invoice', invoice: inv });
  }
  for (const p of payments) {
    events.push({ date: p.paymentDate || '', kind: 'payment', payment: p });
  }
  events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  let running = openingSigned;
  let openingInPeriodSigned = openingSigned;

  if (dateFrom) {
    for (const e of events) {
      if (e.date >= dateFrom) break;
      if (e.kind === 'invoice' && e.invoice) {
        openingInPeriodSigned = signedBalance(openingInPeriodSigned, Number(e.invoice.grandTotal || 0), 0);
      } else if (e.kind === 'payment' && e.payment) {
        openingInPeriodSigned = signedBalance(openingInPeriodSigned, 0, Number(e.payment.amount || 0));
      }
    }
    running = openingInPeriodSigned;
  }

  const entries: LedgerEntry[] = [];
  const openingDisplay = toDisplay(running);
  entries.push({
    date: dateFrom || client.openingDate || '',
    type: 'opening',
    particulars: 'Opening Balance',
    reference: '',
    debit: openingDisplay.type === 'Dr' ? openingDisplay.amount : 0,
    credit: openingDisplay.type === 'Cr' ? openingDisplay.amount : 0,
    balance: openingDisplay.amount,
    balanceType: openingDisplay.type,
  });

  let totalDebit = 0;
  let totalCredit = 0;

  for (const e of events) {
    if (dateFrom && e.date < dateFrom) continue;
    if (dateTo && e.date > dateTo) continue;
    if (e.kind === 'invoice' && e.invoice) {
      const amt = Number(e.invoice.grandTotal || 0);
      running = signedBalance(running, amt, 0);
      totalDebit = roundTo2(totalDebit + amt);
      const d = toDisplay(running);
      entries.push({
        date: e.date,
        type: 'invoice',
        particulars: `Sales Invoice`,
        reference: e.invoice.invoiceNumber || '',
        debit: amt,
        credit: 0,
        balance: d.amount,
        balanceType: d.type,
        invoiceId: e.invoice.id,
      });
    } else if (e.kind === 'payment' && e.payment) {
      const amt = Number(e.payment.amount || 0);
      running = signedBalance(running, 0, amt);
      totalCredit = roundTo2(totalCredit + amt);
      const d = toDisplay(running);
      entries.push({
        date: e.date,
        type: 'payment',
        particulars: `Payment received (${e.payment.mode})${e.payment.reference ? ` · ${e.payment.reference}` : ''}`,
        reference: e.payment.allocations?.map((a) => a.invoiceNumber).filter(Boolean).join(', ') || '',
        debit: 0,
        credit: amt,
        balance: d.amount,
        balanceType: d.type,
        paymentId: e.payment.id,
      });
    }
  }

  const closing = toDisplay(running);

  return {
    entries,
    openingBalance: openingDisplay.amount,
    openingType: openingDisplay.type,
    totalDebit,
    totalCredit,
    closingBalance: closing.amount,
    closingType: closing.type,
  };
}

const escapeHtml = (s: string | undefined | null): string =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const nl2br = (s: string | undefined | null): string =>
  escapeHtml(s).replace(/\n/g, '<br/>');

export function renderLedgerHtml(
  client: AccountingClient,
  company: AccountingCompanyProfile | null,
  result: LedgerBuildResult,
  dateFrom?: string,
  dateTo?: string,
): string {
  const companyName = escapeHtml(company?.name || 'Company');
  const companyAddress = nl2br(
    [company?.address, [company?.city, company?.state, company?.pincode].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join('\n'),
  );
  const rows = result.entries
    .map(
      (e) => `
      <tr>
        <td>${escapeHtml(e.date)}</td>
        <td>${escapeHtml(e.particulars)}</td>
        <td>${escapeHtml(e.reference)}</td>
        <td class="r">${e.debit ? formatINR(e.debit) : '—'}</td>
        <td class="r">${e.credit ? formatINR(e.credit) : '—'}</td>
        <td class="r">${formatINR(e.balance)} ${e.balanceType}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Ledger - ${escapeHtml(client.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 0; padding: 24px; font-size: 12px; }
    .wrap { max-width: 900px; margin: 0 auto; }
    .head { border-bottom: 3px solid #1976d2; padding-bottom: 12px; margin-bottom: 16px; }
    .head h1 { margin: 0 0 4px; color: #1976d2; font-size: 20px; }
    .meta { color: #555; line-height: 1.5; }
    .title { margin: 12px 0; text-align: center; }
    .title h2 { margin: 0; color: #333; letter-spacing: 1px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
    .box { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; }
    .box h3 { margin: 0 0 6px; font-size: 12px; color: #1976d2; text-transform: uppercase; }
    table.led { width: 100%; border-collapse: collapse; }
    table.led th { background: #e3f2fd; color: #1976d2; padding: 8px; text-align: left; border-bottom: 2px solid #1976d2; }
    table.led td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
    table.led td.r, table.led th.r { text-align: right; }
    .totals { display: flex; justify-content: flex-end; margin-top: 12px; }
    .totals table { border-collapse: collapse; min-width: 300px; }
    .totals td { padding: 6px 12px; }
    .totals tr.total td { border-top: 2px solid #1976d2; font-weight: bold; color: #1976d2; font-size: 14px; }
    .foot { margin-top: 24px; }
    @media print { body { padding: 0; } .wrap { max-width: none; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <h1>${companyName}</h1>
      <div class="meta">${companyAddress}${company?.gstNumber ? `<br/>GSTIN: ${escapeHtml(company.gstNumber)}` : ''}</div>
    </div>

    <div class="title">
      <h2>ACCOUNT STATEMENT / LEDGER</h2>
      <div>${dateFrom || '—'} to ${dateTo || '—'}</div>
    </div>

    <div class="grid">
      <div class="box">
        <h3>Client</h3>
        <div><b>${escapeHtml(client.name)}</b></div>
        <div>${nl2br(
          [client.address, [client.city, client.state, client.pincode].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join('\n'),
        )}</div>
        ${client.gstin ? `<div>GSTIN: ${escapeHtml(client.gstin)}</div>` : ''}
        ${client.phone ? `<div>Phone: ${escapeHtml(client.phone)}</div>` : ''}
      </div>
      <div class="box">
        <h3>Summary</h3>
        <div>Opening: <b>${formatINR(result.openingBalance)} ${result.openingType}</b></div>
        <div>Total Debit: <b>${formatINR(result.totalDebit)}</b></div>
        <div>Total Credit: <b>${formatINR(result.totalCredit)}</b></div>
        <div>Closing: <b>${formatINR(result.closingBalance)} ${result.closingType}</b></div>
      </div>
    </div>

    <table class="led">
      <thead>
        <tr>
          <th>Date</th>
          <th>Particulars</th>
          <th>Reference</th>
          <th class="r">Debit</th>
          <th class="r">Credit</th>
          <th class="r">Balance</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <table>
        <tr>
          <td>Total Debit</td>
          <td class="r">${formatINR(result.totalDebit)}</td>
        </tr>
        <tr>
          <td>Total Credit</td>
          <td class="r">${formatINR(result.totalCredit)}</td>
        </tr>
        <tr class="total">
          <td>Closing Balance</td>
          <td class="r">${formatINR(result.closingBalance)} ${result.closingType}</td>
        </tr>
      </table>
    </div>
    <div class="foot">
      <em>Amount in words: ${escapeHtml(amountInWords(result.closingBalance))}</em>
    </div>
  </div>
</body>
</html>`;
}
