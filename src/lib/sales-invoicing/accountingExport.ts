import { buildAccountingLedgerDataset, type AccountingExportOptions } from './accountingLedgerDataset';

export type { AccountingExportOptions } from './accountingLedgerDataset';

/**
 * Excel workbook for accountants (multi-sheet). Uses the same dataset as the PDF ledger.
 */
export async function downloadSalesAccountingWorkbook(opts: AccountingExportOptions): Promise<void> {
  const data = buildAccountingLedgerDataset(opts);
  const { invoiceRegister, lineItems, paymentsLedger, summary, organizationName, scopeNote } = data;

  const XLSX = await import('xlsx');

  const generatedAt = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const coverAoA: (string | number)[][] = [
    [organizationName.toUpperCase()],
    ['Sales & Invoicing — Accountant export'],
    [''],
    ['Generated (IST)', generatedAt],
    ['Scope', scopeNote],
    [''],
    ['Invoices in this export', summary.totalInvoices],
    ['Active invoices (row count)', summary.activeCount],
    ['Cancelled (void) invoices', summary.cancelledCount],
    ['Sum of taxable value — active only (INR)', summary.totalTaxableActive],
    ['Sum of GST — active only (INR)', summary.totalGstActive],
    ['Sum of Grand Total — active only (INR)', summary.grandTotalActive],
    ['CRM payment lines in ledger', summary.paymentEntryCount],
    ['Sum of payment amounts (INR)', summary.totalPaymentsAmount],
    [''],
    ['Workbook structure'],
    ['Sheet 1', 'Invoice Register — one row per invoice/tax document'],
    ['Sheet 2', 'Line Items — products, manual lines, accessories'],
    ['Sheet 3', 'Payments Ledger — collections from patient profile (linked enquiries)'],
    [''],
    [
      'Note',
      'Payments ledger lists CRM-recorded payments for patients linked to exported invoices. Manual invoices without enquiry show patient payments only in column Patient_payments_recorded on the register.',
    ],
  ];
  const wb = XLSX.utils.book_new();
  const wsCover = XLSX.utils.aoa_to_sheet(coverAoA);
  wsCover['!cols'] = [{ wch: 28 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, wsCover, 'Cover');

  const wsInv = XLSX.utils.json_to_sheet(invoiceRegister);
  wsInv['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
    { wch: 28 },
    { wch: 10 },
    { wch: 22 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 48 },
    { wch: 48 },
    { wch: 28 },
    { wch: 24 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInv, 'Invoice Register');

  const wsLines = XLSX.utils.json_to_sheet(lineItems);
  wsLines['!cols'] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 22 },
    { wch: 6 },
    { wch: 16 },
    { wch: 52 },
    { wch: 10 },
    { wch: 22 },
    { wch: 8 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLines, 'Line Items');

  if (paymentsLedger.length > 0) {
    const wsPay = XLSX.utils.json_to_sheet(paymentsLedger);
    wsPay['!cols'] = [
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 22 },
      { wch: 28 },
      { wch: 36 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPay, 'Payments Ledger');
  } else {
    const wsPay = XLSX.utils.json_to_sheet([
      {
        Entry_No: '',
        Payment_Date: '',
        Amount_INR: '',
        Mode: '',
        Reference_UTR_Cheque: '',
        Remarks: 'No linked enquiry payments in this export (e.g. only manual invoices or no payments recorded).',
        Related_invoice_numbers: '',
        Enquiry_Name: '',
      },
    ]);
    XLSX.utils.book_append_sheet(wb, wsPay, 'Payments Ledger');
  }

  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const filename = `Hope_Sales_Accountant_Export_${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.xlsx`;
  XLSX.writeFile(wb, filename);
}
