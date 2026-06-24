import type { Timestamp } from 'firebase/firestore';
import {
  isSerialTrackedProductLine,
  productLineSerials,
} from '@/utils/serialUtils';

export type MaterialMovementDirection = 'in' | 'out';

export type MaterialMovementExportRow = {
  direction: MaterialMovementDirection;
  date: Date;
  dateLabel: string;
  challanNumber: string;
  partyName: string;
  partyLabel: string;
  company: string;
  location: string;
  modelName: string;
  productType: string;
  serialNumber: string;
  quantity: number;
  dealerPrice: number;
  mrp: number;
  finalPrice: number;
  status: string;
  notes: string;
  reference: string;
  convertedToPurchase: string;
  purchaseInvoiceNo: string;
};

type MaterialProductLine = {
  productId?: string;
  name?: string;
  type?: string;
  hasSerialNumber?: boolean;
  serialNumbers?: string[] | string;
  serialNumber?: string;
  serialPairs?: [string, string][];
  quantity?: number;
  dealerPrice?: number;
  mrp?: number;
  finalPrice?: number;
  remarks?: string;
};

type MaterialInRecord = {
  id?: string;
  challanNumber?: string;
  supplier?: { id?: string; name?: string };
  company?: string;
  location?: string;
  products?: MaterialProductLine[];
  receivedDate?: Timestamp;
  status?: string;
  notes?: string;
  convertedToPurchase?: boolean;
  purchaseInvoiceNo?: string;
};

type MaterialOutRecord = {
  id?: string;
  challanNumber?: string;
  recipient?: { id?: string; name?: string };
  company?: string;
  location?: string;
  products?: MaterialProductLine[];
  dispatchDate?: Timestamp;
  status?: string;
  reason?: string;
  reference?: string;
  notes?: string;
};

function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isWithinDateRange(ts: Timestamp | undefined, from: Date | null, to: Date | null): boolean {
  if (!ts?.seconds) return !from && !to;
  const d = toDateOnly(new Date(ts.seconds * 1000));
  if (from && d < toDateOnly(from)) return false;
  if (to && d > toDateOnly(to)) return false;
  return true;
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrencyInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function serialsFromProduct(
  p: MaterialProductLine,
  materialContext?: { reason?: string; reference?: string; notes?: string },
): string[] {
  return productLineSerials(p as Record<string, unknown>, materialContext);
}

function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function flattenMaterialInToRows(materials: MaterialInRecord[]): MaterialMovementExportRow[] {
  const rows: MaterialMovementExportRow[] = [];

  materials.forEach((material) => {
    const date = material.receivedDate?.seconds
      ? new Date(material.receivedDate.seconds * 1000)
      : new Date();
    const partyName = material.supplier?.name || '';
    const base = {
      direction: 'in' as const,
      date,
      dateLabel: formatDateLabel(date),
      challanNumber: material.challanNumber || '',
      partyName,
      partyLabel: 'From (Supplier)',
      company: material.company || '',
      location: material.location || '',
      status: material.status || '',
      notes: material.notes || '',
      reference: '',
      convertedToPurchase: material.convertedToPurchase ? 'Yes' : 'No',
      purchaseInvoiceNo: material.purchaseInvoiceNo || '',
    };

    (material.products || []).forEach((product) => {
      const serials = serialsFromProduct(product, { notes: material.notes });
      const line = {
        modelName: product.name || '',
        productType: product.type || '',
        dealerPrice: Number(product.dealerPrice ?? 0),
        mrp: Number(product.mrp ?? 0),
        finalPrice: Number(product.finalPrice ?? product.dealerPrice ?? 0),
      };
      const qty = Math.max(1, Number(product.quantity ?? 0) || 0);
      const isTracked = isSerialTrackedProductLine(product);

      if (serials.length > 0) {
        serials.forEach((sn) => {
          rows.push({
            ...base,
            ...line,
            serialNumber: sn,
            quantity: 1,
          });
        });
      } else if (isTracked) {
        for (let i = 0; i < qty; i += 1) {
          rows.push({
            ...base,
            ...line,
            serialNumber: '(missing — edit challan to add serial)',
            quantity: 1,
          });
        }
      } else {
        rows.push({
          ...base,
          ...line,
          serialNumber: '',
          quantity: qty,
        });
      }
    });
  });

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime() || a.challanNumber.localeCompare(b.challanNumber));
}

export function flattenMaterialOutToRows(materials: MaterialOutRecord[]): MaterialMovementExportRow[] {
  const rows: MaterialMovementExportRow[] = [];

  materials.forEach((material) => {
    const date = material.dispatchDate?.seconds
      ? new Date(material.dispatchDate.seconds * 1000)
      : new Date();
    const partyName = material.recipient?.name || '';
    const base = {
      direction: 'out' as const,
      date,
      dateLabel: formatDateLabel(date),
      challanNumber: material.challanNumber || '',
      partyName,
      partyLabel: 'To (Recipient)',
      company: material.company || '',
      location: material.location || '',
      status: material.status || '',
      notes: material.reason || '',
      reference: material.reference || '',
      convertedToPurchase: '',
      purchaseInvoiceNo: '',
    };

    (material.products || []).forEach((product) => {
      const serials = serialsFromProduct(product, {
        reason: material.reason,
        reference: material.reference,
        notes: material.notes,
      });
      const line = {
        modelName: product.name || '',
        productType: product.type || '',
        dealerPrice: Number(product.dealerPrice ?? 0),
        mrp: Number(product.mrp ?? 0),
        finalPrice: Number(product.finalPrice ?? product.dealerPrice ?? 0),
      };
      const qty = Math.max(1, Number(product.quantity ?? 0) || 0);
      const isTracked = isSerialTrackedProductLine(product);

      if (serials.length > 0) {
        serials.forEach((sn) => {
          rows.push({
            ...base,
            ...line,
            serialNumber: sn,
            quantity: 1,
          });
        });
      } else if (isTracked) {
        for (let i = 0; i < qty; i += 1) {
          rows.push({
            ...base,
            ...line,
            serialNumber: '(missing — edit challan to add serial)',
            quantity: 1,
          });
        }
      } else {
        rows.push({
          ...base,
          ...line,
          serialNumber: '',
          quantity: qty,
        });
      }
    });
  });

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime() || a.challanNumber.localeCompare(b.challanNumber));
}

function csvHeaders(direction: MaterialMovementDirection): string[] {
  const partyCol = direction === 'in' ? 'From (Supplier)' : 'To (Recipient)';
  const base = [
    'Date',
    'Challan #',
    partyCol,
    'Company',
    'Location',
    'Model Name',
    'Type',
    'Serial Number',
    'Quantity',
    'Dealer Price',
    'MRP',
    'Final Price',
    'Status',
  ];
  if (direction === 'in') {
    return [...base, 'Notes', 'Converted to Purchase', 'Purchase Invoice #'];
  }
  return [...base, 'Reason', 'Reference'];
}

function rowToCsvValues(row: MaterialMovementExportRow): string[] {
  const base = [
    row.dateLabel,
    row.challanNumber,
    row.partyName,
    row.company,
    row.location,
    row.modelName,
    row.productType,
    row.serialNumber,
    String(row.quantity),
    String(row.dealerPrice),
    String(row.mrp),
    String(row.finalPrice),
    row.status,
  ];
  if (row.direction === 'in') {
    return [...base, row.notes, row.convertedToPurchase, row.purchaseInvoiceNo];
  }
  return [...base, row.notes, row.reference];
}

export function downloadMaterialMovementCsv(
  rows: MaterialMovementExportRow[],
  direction: MaterialMovementDirection,
  dateFrom: Date | null,
  dateTo: Date | null,
): void {
  if (!rows.length) {
    throw new Error('No records to export for the selected filters.');
  }

  const headers = csvHeaders(direction);
  const csvRows = rows.map(rowToCsvValues);
  const csv = '\uFEFF' + [headers, ...csvRows].map((r) => r.map(escapeCsv).join(',')).join('\n');

  const today = new Date().toISOString().slice(0, 10);
  const rangePart =
    dateFrom || dateTo
      ? `_${dateFrom ? dateFrom.toISOString().slice(0, 10) : 'start'}-to-${dateTo ? dateTo.toISOString().slice(0, 10) : 'end'}`
      : '';
  const fileName = `material-${direction}${rangePart}_${today}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function buildMaterialMovementPrintHtml(params: {
  rows: MaterialMovementExportRow[];
  direction: MaterialMovementDirection;
  dateFrom: Date | null;
  dateTo: Date | null;
}): string {
  const { rows, direction, dateFrom, dateTo } = params;
  const title = direction === 'in' ? 'Material In Report' : 'Material Out Report';
  const partyCol = direction === 'in' ? 'From (Supplier)' : 'To (Recipient)';

  const scopeParts: string[] = [];
  if (dateFrom) scopeParts.push(`From ${formatDateLabel(dateFrom)}`);
  if (dateTo) scopeParts.push(`To ${formatDateLabel(dateTo)}`);
  const scopeNote = scopeParts.length ? scopeParts.join(' · ') : 'All dates';

  const grouped = new Map<string, MaterialMovementExportRow[]>();
  rows.forEach((row) => {
    const key = row.dateLabel;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  });

  const dateSections = Array.from(grouped.entries())
    .map(([dateLabel, dayRows]) => {
      const tableRows = dayRows
        .map(
          (r) => `<tr>
          <td>${escapeHtml(r.challanNumber)}</td>
          <td>${escapeHtml(r.partyName)}</td>
          <td>${escapeHtml(r.company)}</td>
          <td>${escapeHtml(r.location)}</td>
          <td>${escapeHtml(r.modelName)}</td>
          <td>${escapeHtml(r.productType)}</td>
          <td><strong>${escapeHtml(r.serialNumber || '—')}</strong></td>
          <td>${r.quantity}</td>
          <td>${escapeHtml(formatCurrencyInr(r.dealerPrice))}</td>
          <td>${escapeHtml(formatCurrencyInr(r.mrp))}</td>
          <td>${escapeHtml(r.status)}</td>
          <td>${escapeHtml(direction === 'in' ? r.notes : r.notes || r.reference)}</td>
        </tr>`,
        )
        .join('');

      return `<section class="date-section">
        <h2>${escapeHtml(dateLabel)} <span class="count">(${dayRows.length} line${dayRows.length === 1 ? '' : 's'})</span></h2>
        <table>
          <thead>
            <tr>
              <th>Challan #</th>
              <th>${escapeHtml(partyCol)}</th>
              <th>Company</th>
              <th>Location</th>
              <th>Model</th>
              <th>Type</th>
              <th>Serial #</th>
              <th>Qty</th>
              <th>Dealer</th>
              <th>MRP</th>
              <th>Status</th>
              <th>${direction === 'in' ? 'Notes' : 'Reason / Ref'}</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; color: #1a1a1a; font-size: 11px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #555; margin-bottom: 20px; font-size: 12px; }
    .date-section { margin-bottom: 28px; page-break-inside: avoid; }
    .date-section h2 { font-size: 14px; margin: 0 0 8px; padding-bottom: 4px; border-bottom: 2px solid #333; }
    .date-section h2 .count { font-weight: normal; color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; font-weight: 600; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 24px; font-size: 10px; color: #888; }
    @media print {
      body { margin: 12px; }
      .date-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    Generated ${escapeHtml(formatDateLabel(new Date()))} · ${escapeHtml(scopeNote)} · ${rows.length} serial/line record${rows.length === 1 ? '' : 's'}
  </div>
  ${dateSections}
  <div class="footer">Hope Enterprises CRM — Material ${direction === 'in' ? 'In' : 'Out'} export</div>
</body>
</html>`;
}

export function openMaterialMovementPrintWindow(html: string): boolean {
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

export function downloadMaterialMovementPdf(
  rows: MaterialMovementExportRow[],
  direction: MaterialMovementDirection,
  dateFrom: Date | null,
  dateTo: Date | null,
): void {
  if (!rows.length) {
    throw new Error('No records to export for the selected filters.');
  }
  const html = buildMaterialMovementPrintHtml({ rows, direction, dateFrom, dateTo });
  const ok = openMaterialMovementPrintWindow(html);
  if (!ok) {
    throw new Error('Could not open print window. Allow pop-ups for this site and try again.');
  }
}
