import { receiptDefaultCompany } from '@/utils/receiptDataBuilders';
import {
  buildAccountingLedgerDataset,
  formatPatientPaymentsForPdf,
  type AccountingExportOptions,
} from './accountingLedgerDataset';

export interface DownloadLedgerPdfOptions extends AccountingExportOptions {
  companyLegalName?: string;
  companyGstin?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

/** Match `purchaseInvoicePrintHtml`: @page 12mm + body padding ~16px */
const PAGE_MARGIN_MM = 12;
const BODY_PAD_MM = 4.25;
/** Table / cell styling aligned with purchase `table.items` */
const BORDER: [number, number, number] = [34, 34, 34];
const HEAD_FILL: [number, number, number] = [240, 240, 240];
const CELL_PAD = { top: 2.1, right: 2.8, bottom: 2.1, left: 2.8 };
const FOOTER_RESERVE_MM = 11;
const LINE_W = 0.12;

function trunc(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function fmtInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function nextY(doc: { lastAutoTable?: { finalY: number } }, fallback: number, gapMm = 5): number {
  return (doc.lastAutoTable?.finalY ?? fallback) + gapMm;
}

type LedgerDoc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont: (a: string, b?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (...args: number[]) => void;
  text: (t: string | string[], x: number, y: number, o?: object) => void;
  splitTextToSize: (t: string, w: number) => string[];
  setDrawColor: (...args: number[]) => void;
  setLineWidth: (n: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, style: string) => void;
  save: (name: string) => void;
  lastAutoTable?: { finalY: number };
};

function drawSectionTitle(doc: LedgerDoc, title: string, x: number, y: number, width: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  doc.text(title.toUpperCase(), x, y);
  y += 3.2;
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.28);
  doc.line(x, y, x + width, y);
  doc.setDrawColor(...BORDER);
  return y + 4.5;
}

const purchaseLikeTable = {
  theme: 'grid' as const,
  styles: {
    fontSize: 8,
    cellPadding: CELL_PAD,
    textColor: [17, 17, 17] as [number, number, number],
    lineColor: BORDER,
    lineWidth: LINE_W,
    valign: 'top' as const,
    overflow: 'linebreak' as const,
  },
  headStyles: {
    fillColor: HEAD_FILL,
    textColor: [17, 17, 17] as [number, number, number],
    fontStyle: 'bold' as const,
    fontSize: 7.5,
    cellPadding: CELL_PAD,
    lineColor: BORDER,
    lineWidth: LINE_W,
    halign: 'left' as const,
  },
  bodyStyles: {
    fillColor: [255, 255, 255] as [number, number, number],
  },
  alternateRowStyles: {
    fillColor: [252, 252, 252] as [number, number, number],
  },
  margin: { bottom: FOOTER_RESERVE_MM },
  showHead: 'everyPage' as const,
};

/**
 * Professional A4 ledger PDF — margins, borders and typography aligned with purchase invoice print HTML.
 */
export async function downloadSalesAccountingLedgerPdf(opts: DownloadLedgerPdfOptions): Promise<void> {
  const data = buildAccountingLedgerDataset(opts);
  const { summary, invoiceRegister, lineItems, paymentsLedger, scopeNote } = data;

  const savedRowsForPdf = opts.rows.filter((r) => r.kind === 'saved' && r.savedSale);
  const patientPayCellPdf = savedRowsForPdf.map((r) => {
    const eid = String(r.savedSale?.enquiryId ?? '').trim();
    const pays = eid ? opts.patientPaymentsByEnquiryId[eid] : undefined;
    const s = formatPatientPaymentsForPdf(pays);
    return s || '—';
  });

  const [jspdfMod, autotableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const jm = jspdfMod as { jsPDF?: new (o?: object) => object; default?: new (o?: object) => object };
  const JsPDF = jm.jsPDF ?? jm.default;
  if (typeof JsPDF !== 'function') {
    throw new Error('jsPDF failed to load. Try clearing .next and reinstalling dependencies.');
  }
  const autoTable = (autotableMod as { default?: (d: unknown, o: unknown) => void }).default;
  if (typeof autoTable !== 'function') {
    throw new Error('jspdf-autotable failed to load. Try clearing .next and reinstalling dependencies.');
  }

  const legalName =
    opts.companyLegalName?.trim() || receiptDefaultCompany.companyName;
  const address = opts.companyAddress?.trim() || receiptDefaultCompany.companyAddress;
  const phone = opts.companyPhone?.trim() || receiptDefaultCompany.companyPhone;
  const email = opts.companyEmail?.trim() || receiptDefaultCompany.companyEmail;
  const gstin =
    opts.companyGstin?.trim() ||
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_COMPANY_GSTIN?.trim() : '') ||
    '';

  const generatedIst = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as LedgerDoc;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const contentLeft = PAGE_MARGIN_MM + BODY_PAD_MM;
  const innerW = pageW - 2 * contentLeft;
  const padInsideBox = 3;

  const footerLine = `${legalName} · Sales & collections ledger · Confidential`;

  const drawFooter = (pageNumber: number) => {
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text(footerLine, contentLeft, pageH - 6, { maxWidth: innerW - 28 });
    doc.text(`Page ${pageNumber}`, pageW - contentLeft, pageH - 6, { align: 'right' });
    doc.setTextColor(0);
  };

  let y = PAGE_MARGIN_MM + BODY_PAD_MM;

  // —— Company header (purchase-style .box) ——
  const textX = contentLeft + padInsideBox;
  const textMaxW = innerW - 2 * padInsideBox;
  let cursorY = y + padInsideBox + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(17, 17, 17);
  doc.text(legalName, textX, cursorY);
  cursorY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(55, 55, 55);
  const addrLines = doc.splitTextToSize(address, textMaxW);
  doc.text(addrLines, textX, cursorY);
  cursorY += addrLines.length * 3.8 + 1;
  doc.text(`Phone: ${phone}  ·  Email: ${email}`, textX, cursorY);
  cursorY += 4.2;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 51, 51);
  doc.text(
    gstin ? `GSTIN: ${gstin}` : 'GSTIN: — (set NEXT_PUBLIC_COMPANY_GSTIN in .env.local)',
    textX,
    cursorY
  );
  cursorY += padInsideBox + 2;

  const headerBoxH = cursorY - y;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(contentLeft, y, innerW, headerBoxH, 1.2, 1.2, 'S');

  y = cursorY + 5;

  // —— Document title (purchase h1) ——
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(17, 17, 17);
  doc.text('Sales, GST & collections ledger', contentLeft, y);
  y += 6;

  // —— Meta block (purchase `table.meta` rhythm: key column + value) ——
  autoTable(doc, {
    startY: y,
    body: [
      ['Statement / scope', trunc(scopeNote, 320)],
      ['Generated (IST)', generatedIst],
    ],
    showHead: false,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 1.4, right: 2, bottom: 1.4, left: 0 },
      textColor: [17, 17, 17],
      valign: 'top',
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', textColor: [68, 68, 68] },
      1: { cellWidth: innerW - 38 },
    },
    margin: { left: contentLeft, right: contentLeft, bottom: FOOTER_RESERVE_MM },
    tableWidth: innerW,
    didDrawPage: (d) => drawFooter(d.pageNumber),
  });

  y = nextY(doc, y, 6);

  y = drawSectionTitle(doc, 'Ledger summary', contentLeft, y, innerW);

  autoTable(doc, {
    ...purchaseLikeTable,
    startY: y,
    head: [['Description', 'Value']],
    body: [
      ['Total invoices in this statement', String(summary.totalInvoices)],
      ['Active', String(summary.activeCount)],
      ['Cancelled (void)', String(summary.cancelledCount)],
      ['Total taxable value — active (INR)', fmtInr(summary.totalTaxableActive)],
      ['Total GST — active (INR)', fmtInr(summary.totalGstActive)],
      ['Grand total — active (INR)', fmtInr(summary.grandTotalActive)],
      ['Payment entries (CRM, linked enquiries)', String(summary.paymentEntryCount)],
      ['Sum of payment amounts (INR)', fmtInr(summary.totalPaymentsAmount)],
    ],
    columnStyles: {
      0: { cellWidth: innerW * 0.62 },
      1: { cellWidth: innerW * 0.38, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: contentLeft, right: contentLeft, bottom: FOOTER_RESERVE_MM },
    tableWidth: innerW,
    didDrawPage: (d) => drawFooter(d.pageNumber),
  });

  y = nextY(doc, y, 6);
  y = drawSectionTitle(doc, '1. Invoice register', contentLeft, y, innerW);

  const invHead = [
    [
      '#',
      'Invoice',
      'Date',
      'Status',
      'Client',
      'Taxable',
      'GST',
      'Total',
      'Patient payments',
    ],
  ];
  const invBody = invoiceRegister.map((row, i) => [
    String(i + 1),
    String(row.Invoice_Number) || '—',
    String(row.Invoice_Date),
    row.Document_Status === 'Active' ? 'Active' : 'Void',
    trunc(String(row.Client_Name), 26),
    fmtInr(Number(row.Subtotal_before_GST_INR)),
    fmtInr(Number(row.GST_INR)),
    fmtInr(Number(row.Grand_Total_INR)),
    patientPayCellPdf[i] ?? '—',
  ]);

  const w = innerW;
  autoTable(doc, {
    ...purchaseLikeTable,
    startY: y,
    head: invHead,
    body: invBody,
    columnStyles: {
      0: { cellWidth: w * 0.052, halign: 'center' },
      1: { cellWidth: w * 0.182 },
      2: { cellWidth: w * 0.098 },
      3: { cellWidth: w * 0.068 },
      4: { cellWidth: w * 0.108 },
      5: { cellWidth: w * 0.09, halign: 'right' },
      6: { cellWidth: w * 0.072, halign: 'right' },
      7: { cellWidth: w * 0.082, halign: 'right' },
      8: { cellWidth: w * 0.248, fontSize: 7.5 },
    },
    margin: { left: contentLeft, right: contentLeft, bottom: FOOTER_RESERVE_MM },
    tableWidth: innerW,
    didDrawPage: (d) => drawFooter(d.pageNumber),
  });

  y = nextY(doc, y, 6);
  y = drawSectionTitle(doc, '2. Line-wise detail', contentLeft, y, innerW);

  const lineBody = lineItems.map((row) => {
    const total = Number(row.Line_total_with_GST_INR);
    const gst = Number(row.GST_INR);
    const taxable = Math.max(0, total - gst);
    return [
      trunc(String(row.Invoice_Number), 22),
      String(row.Invoice_Date),
      trunc(String(row.Line_Type), 14),
      trunc(String(row.Description), 58),
      String(row.Quantity),
      fmtInr(taxable),
      row.GST_percent === '' ? '—' : String(row.GST_percent),
      fmtInr(gst),
      fmtInr(total),
    ];
  });

  autoTable(doc, {
    ...purchaseLikeTable,
    startY: y,
    head: [['Invoice', 'Date', 'Type', 'Description', 'Qty', 'Taxable', 'GST %', 'GST', 'Line total']],
    body: lineBody,
    styles: { ...purchaseLikeTable.styles, fontSize: 7.5 },
    headStyles: { ...purchaseLikeTable.headStyles, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: w * 0.145 },
      1: { cellWidth: w * 0.098 },
      2: { cellWidth: w * 0.09 },
      3: { cellWidth: w * 0.227 },
      4: { cellWidth: w * 0.05, halign: 'center' },
      5: { cellWidth: w * 0.11, halign: 'right' },
      6: { cellWidth: w * 0.06, halign: 'center' },
      7: { cellWidth: w * 0.1, halign: 'right' },
      8: { cellWidth: w * 0.12, halign: 'right' },
    },
    margin: { left: contentLeft, right: contentLeft, bottom: FOOTER_RESERVE_MM },
    tableWidth: innerW,
    didDrawPage: (d) => drawFooter(d.pageNumber),
  });

  y = nextY(doc, y, 6);
  y = drawSectionTitle(doc, '3. Payment collections', contentLeft, y, innerW);

  if (paymentsLedger.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'No linked enquiry payments in this export. Collections on manual invoices may appear only in section 1 if noted on the invoice.',
      contentLeft,
      y,
      { maxWidth: innerW }
    );
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
  } else {
    const payBody = paymentsLedger.map((row) => [
      String(row.Entry_No),
      String(row.Payment_Date),
      fmtInr(Number(row.Amount_INR)),
      trunc(String(row.Mode), 12),
      trunc(String(row.Reference_UTR_Cheque), 20),
      trunc(String(row.Remarks), 32),
      trunc(String(row.Related_invoice_numbers), 24),
      String(row.Enquiry_Name) || '—',
    ]);
    autoTable(doc, {
      ...purchaseLikeTable,
      startY: y,
      head: [['#', 'Date', 'Amount', 'Mode', 'Reference', 'Remarks', 'Related invoices', 'Enquiry name']],
      body: payBody,
      columnStyles: {
        0: { cellWidth: w * 0.05, halign: 'center' },
        1: { cellWidth: w * 0.1 },
        2: { cellWidth: w * 0.12, halign: 'right' },
        3: { cellWidth: w * 0.09 },
        4: { cellWidth: w * 0.12 },
        5: { cellWidth: w * 0.2 },
        6: { cellWidth: w * 0.13 },
        7: { cellWidth: w * 0.19 },
      },
      margin: { left: contentLeft, right: contentLeft, bottom: FOOTER_RESERVE_MM },
      tableWidth: innerW,
      didDrawPage: (d) => drawFooter(d.pageNumber),
    });
  }

  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const filename = `Hope_Sales_Ledger_${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.pdf`;
  doc.save(filename);
}
