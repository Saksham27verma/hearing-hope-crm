import type { ProfitSummary } from './types';

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Excel Export ─────────────────────────────────────────────────────────────

export async function exportToExcel(summary: ProfitSummary, dateLabel: string): Promise<void> {
  const XLSX = (await import('xlsx')).default ?? (await import('xlsx'));

  // Summary sheet
  const summaryData = [
    ['Profit Report', dateLabel],
    [],
    ['Metric', 'Amount (₹)'],
    ['Gross Revenue (Invoice Grand Totals)', summary.grossRevenue],
    ['Dealer Costs / COGS (matched serials)', summary.totalCogs],
    ['Gross Profit (= Profit Analysis Report figure)', summary.grossProfit],
    [],
    ['Operating Expenses', ''],
    ['  Salaries', summary.totalSalaries],
    ['  Fixed Costs (Rent + Utilities)', summary.totalFixedCosts],
    ['  Cash Outflows', summary.totalCashOutflows],
    ['Total Operating Expenses', summary.totalOperatingExpenses],
    [],
    ['Net Profit (Gross Profit − Operating Expenses)', summary.netProfit],
    [],
    ['Unresolved Serials (COGS treated as ₹0)', summary.unresolvedSerialsCount],
    ['Unresolved Selling Value', summary.unresolvedSellingValue],
  ];

  // Breakdown sheet
  const breakdownHeaders = ['Date', 'Description', 'Category', 'Type', 'Amount (₹)', 'Reference', 'Center'];
  const breakdownData = [
    breakdownHeaders,
    ...summary.breakdownRows.map((r) => [
      r.date,
      r.description,
      r.category,
      r.type === 'in' ? 'Inflow' : 'Outflow',
      r.amount,
      r.reference || '',
      r.centerName || '',
    ]),
  ];

  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const wsBreakdown = XLSX.utils.aoa_to_sheet(breakdownData);
  wsBreakdown['!cols'] = [
    { wch: 14 }, { wch: 40 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 22 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsBreakdown, 'Breakdown');

  if (summary.centerRows?.length) {
    const centerHeaders = [
      'Center',
      'Gross revenue',
      'Gross profit',
      'Salaries',
      'Fixed costs',
      'Cash outflows',
      'Total expenses',
      'Net profit',
    ];
    const centerData = [
      centerHeaders,
      ...summary.centerRows.map((r) => [
        r.centerName,
        r.grossRevenue,
        r.grossProfit,
        r.salaries,
        r.fixedCosts,
        r.cashOutflows,
        r.totalExpenses,
        r.netProfit,
      ]),
    ];
    const wsCenters = XLSX.utils.aoa_to_sheet(centerData);
    wsCenters['!cols'] = [
      { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCenters, 'By center');
  }

  XLSX.writeFile(wb, `Profit_Report_${dateLabel.replace(/\s/g, '_')}.xlsx`);
}

// ── PDF Export ───────────────────────────────────────────────────────────────

export async function exportToPdf(summary: ProfitSummary, dateLabel: string): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text('Profit Report', pageW / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(dateLabel, pageW / 2, 28, { align: 'center' });

  // KPI summary table
  autoTable(doc, {
    startY: 35,
    head: [['Metric', 'Amount']],
    body: [
      ['Gross Revenue (Invoice Grand Totals)', formatCurrency(summary.grossRevenue)],
      ['Dealer Costs / COGS (matched serials)', formatCurrency(summary.totalCogs)],
      ['Gross Profit (= Profit Analysis Report figure)', formatCurrency(summary.grossProfit)],
      ['', ''],
      ['Salaries', formatCurrency(summary.totalSalaries)],
      ['Fixed Costs (Rent + Utilities)', formatCurrency(summary.totalFixedCosts)],
      ['Cash Outflows', formatCurrency(summary.totalCashOutflows)],
      ['Total Operating Expenses', formatCurrency(summary.totalOperatingExpenses)],
      ['', ''],
      ['Net Profit', formatCurrency(summary.netProfit)],
    ],
    headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { textColor: [17, 24, 39] },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      // Gross Profit row (index 2) — green
      if (data.row.index === 2 && data.section === 'body') {
        data.cell.styles.textColor = [5, 150, 105];
        data.cell.styles.fontStyle = 'bold';
      }
      // Net Profit row (index 9) — blue/red
      if (data.row.index === 9 && data.section === 'body') {
        const color: [number, number, number] =
          summary.netProfit >= 0 ? [37, 99, 235] : [225, 29, 72];
        data.cell.styles.textColor = color;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  let finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 100;

  if (summary.centerRows?.length) {
    let y = finalY + 14;
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text('Center-wise net profit', 14, y);
    autoTable(doc, {
      startY: y + 6,
      head: [[
        'Center',
        'Gross rev.',
        'Gross profit',
        'Salaries',
        'Fixed',
        'Cash',
        'Expenses',
        'Net',
      ]],
      body: summary.centerRows.map((r) => [
        r.centerName.length > 26 ? `${r.centerName.slice(0, 24)}…` : r.centerName,
        formatCurrency(r.grossRevenue),
        formatCurrency(r.grossProfit),
        formatCurrency(r.salaries),
        formatCurrency(r.fixedCosts),
        formatCurrency(r.cashOutflows),
        formatCurrency(r.totalExpenses),
        formatCurrency(r.netProfit),
      ]),
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [17, 24, 39], fontSize: 7 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { halign: 'right', cellWidth: 22 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
    });
    finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
  }

  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  let breakdownStartY = finalY + 14;
  if (breakdownStartY > 250) {
    doc.addPage();
    breakdownStartY = 20;
  }
  doc.text('Transaction Breakdown', 14, breakdownStartY);

  autoTable(doc, {
    startY: breakdownStartY + 6,
    head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
    body: summary.breakdownRows.map((r) => [
      r.date,
      r.description.length > 40 ? r.description.substring(0, 38) + '…' : r.description,
      r.category,
      r.type === 'in' ? 'Inflow' : 'Outflow',
      formatCurrency(r.amount),
    ]),
    headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { textColor: [17, 24, 39], fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 68 },
      2: { cellWidth: 28 },
      3: { cellWidth: 20 },
      4: { halign: 'right', cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const typeVal = data.cell.raw as string;
        data.cell.styles.textColor = typeVal === 'Inflow' ? [5, 150, 105] : [225, 29, 72];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 14, right: 14 },
  });

  doc.save(`Profit_Report_${dateLabel.replace(/\s/g, '_')}.pdf`);
}
