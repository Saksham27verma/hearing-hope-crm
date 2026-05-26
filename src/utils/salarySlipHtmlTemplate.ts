import { Timestamp } from 'firebase/firestore';

export interface SalarySlipData {
  // Staff
  staffId: string;
  staffName: string;
  staffNumber?: string;
  email?: string;
  phone?: string;
  jobRole: string;
  department?: string;
  joiningDate?: Timestamp | { seconds: number } | string | null;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;

  // Salary record
  month: string; // YYYY-MM
  basicSalary: number;
  hra: number;
  travelAllowance: number;
  incentives: number;
  festivalAdvance: number;
  generalAdvance: number;
  deductions: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  isPaid: boolean;
  paidDate?: Timestamp | { seconds: number } | null;
  remarks?: string;

  // Branding (optional overrides)
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyGst?: string;
  logoUrl?: string; // absolute URL to logo image
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));
}

function fmtTs(
  ts?: Timestamp | { seconds: number } | string | null,
  opts?: { monthYear?: boolean }
): string {
  if (!ts) return '—';
  let d: Date;
  if (typeof ts === 'string') {
    d = new Date(ts);
  } else if ('seconds' in ts) {
    d = new Date((ts as { seconds: number }).seconds * 1000);
  } else {
    return '—';
  }
  if (Number.isNaN(d.getTime())) return '—';
  if (opts?.monthYear) {
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMonth(month: string): string {
  const [y, m] = month.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function escHtml(s?: string | number | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function employeeId(data: SalarySlipData): string {
  if (data.staffNumber) return data.staffNumber;
  return data.staffId ? `HH-${data.staffId.substring(0, 6).toUpperCase()}` : '—';
}

// ─── Number to words (Indian numbering) ──────────────────────────────────────

function numberToIndianWords(num: number): string {
  if (!Number.isFinite(num)) return '';
  const n = Math.round(Math.abs(num));
  if (n === 0) return 'Zero Rupees Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (x: number): string => {
    if (x < 20) return ones[x];
    const t = Math.floor(x / 10);
    const o = x % 10;
    return o === 0 ? tens[t] : `${tens[t]} ${ones[o]}`;
  };
  const threeDigits = (x: number): string => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    const parts: string[] = [];
    if (h > 0) parts.push(`${ones[h]} Hundred`);
    if (r > 0) parts.push(twoDigits(r));
    return parts.join(' ');
  };

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest > 0) parts.push(threeDigits(rest));

  return `${parts.join(' ').replace(/\s+/g, ' ').trim()} Rupees Only`;
}

// ─── Row builder ─────────────────────────────────────────────────────────────

function slipRow(
  earningLabel: string,
  earningAmount: number | null,
  deductionLabel: string,
  deductionAmount: number | null,
  bold = false
): string {
  const rowStyle = bold
    ? 'background:#f5f7fb;'
    : '';
  const earningAmtStr =
    earningAmount !== null && earningAmount > 0 ? escHtml(fmtINR(earningAmount)) : '—';
  const deductionAmtStr =
    deductionAmount !== null && deductionAmount > 0 ? escHtml(fmtINR(deductionAmount)) : '—';

  const labelColor = bold ? '#0f172a' : '#475569';
  const amtColor = bold ? '#0f172a' : '#1e293b';
  const fontWeight = bold ? 700 : 400;
  const amtFontWeight = bold ? 700 : 500;

  return `
    <tr style="${rowStyle}">
      <td style="padding:9px 16px;border-right:1px solid #e5e7eb;border-bottom:1px solid #eef0f4;color:${labelColor};font-size:12px;font-weight:${fontWeight};">${escHtml(earningLabel)}</td>
      <td style="padding:9px 16px;text-align:right;border-right:1px solid #e5e7eb;border-bottom:1px solid #eef0f4;color:${amtColor};font-size:12px;font-weight:${amtFontWeight};font-variant-numeric:tabular-nums;">${earningAmtStr}</td>
      <td style="padding:9px 16px;border-right:1px solid #e5e7eb;border-bottom:1px solid #eef0f4;color:${deductionLabel ? labelColor : '#cbd5e1'};font-size:12px;font-weight:${fontWeight};">${deductionLabel ? escHtml(deductionLabel) : '—'}</td>
      <td style="padding:9px 16px;text-align:right;border-bottom:1px solid #eef0f4;color:${amtColor};font-size:12px;font-weight:${amtFontWeight};font-variant-numeric:tabular-nums;">${deductionLabel ? deductionAmtStr : '—'}</td>
    </tr>`;
}

// ─── Main template function ───────────────────────────────────────────────────

export function generateSalarySlipHtml(data: SalarySlipData): string {
  const companyName = data.companyName || 'Hope Digital Innovations Pvt Ltd';
  const companyAddress =
    data.companyAddress || 'G-14, Kings Mall, Rohini, Sector-13, New Delhi, Delhi-110085';
  const companyPhone = data.companyPhone || '';
  const companyEmail = data.companyEmail || '';
  const companyGst = data.companyGst || '07AAHCH3320A1Z9';
  const logoUrl = data.logoUrl || '/images/logohope.svg';

  const monthLabel = fmtMonth(data.month);
  const empId = employeeId(data);
  const dept = data.department || data.jobRole || '—';
  const joiningDateStr = fmtTs(data.joiningDate);

  const isPaid = !!data.isPaid;
  const paidDateStr = data.paidDate ? fmtTs(data.paidDate) : '';
  const statusBadge = isPaid
    ? `<span style="display:inline-block;background:#ecfdf5;color:#065f46;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.8px;border:1px solid #a7f3d0;text-transform:uppercase;">Paid</span>`
    : `<span style="display:inline-block;background:#fffbeb;color:#92400e;padding:4px 12px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.8px;border:1px solid #fde68a;text-transform:uppercase;">Pending</span>`;

  const disbursedLine = isPaid && paidDateStr
    ? `<span style="color:#64748b;font-size:11px;margin-left:12px;">Disbursed on <strong style="color:#334155;">${escHtml(paidDateStr)}</strong></span>`
    : '';

  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const netSalaryWords = numberToIndianWords(data.netSalary);

  const remarksSection = data.remarks
    ? `
    <div style="margin:0 40px 24px;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:6px;">Remarks</div>
      <div style="font-size:12px;color:#475569;line-height:1.6;">${escHtml(data.remarks)}</div>
    </div>`
    : '';

  const bankSection =
    data.bankName || data.accountNumber
      ? `
    <div style="margin:0 40px 24px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:10px;">Bank Details</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;border-collapse:separate;">
        <tr>
          <td style="padding:10px 16px;border-right:1px solid #e2e8f0;background:#f8fafc;width:33%;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Bank Name</div>
            <div style="font-size:12px;font-weight:600;color:#1e293b;">${escHtml(data.bankName || '—')}</div>
          </td>
          <td style="padding:10px 16px;border-right:1px solid #e2e8f0;background:#f8fafc;width:33%;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Account No.</div>
            <div style="font-size:12px;font-weight:600;color:#1e293b;">${escHtml(data.accountNumber || '—')}</div>
          </td>
          <td style="padding:10px 16px;background:#f8fafc;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">IFSC Code</div>
            <div style="font-size:12px;font-weight:600;color:#1e293b;">${escHtml(data.ifscCode || '—')}</div>
          </td>
        </tr>
      </table>
    </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Salary Slip — ${escHtml(data.staffName)} — ${escHtml(monthLabel)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #eef2f7;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table { border-collapse: separate; border-spacing: 0; }
    .label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .value {
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.35;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.6px;
      color: #1e3a8a;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #1e3a8a;
      display: inline-block;
    }
    @media print {
      @page { size: A4 portrait; margin: 12mm 10mm; }
      body { background: white; }
      .page-wrapper { box-shadow: none; margin: 0; border-radius: 0; border: none; }
    }
  </style>
</head>
<body>
<div class="page-wrapper" style="
  max-width: 820px;
  margin: 28px auto;
  background: white;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
  border: 1px solid #e2e8f0;
  overflow: hidden;
">

  <!-- ═══════════════ HEADER ═══════════════ -->
  <div style="
    padding: 26px 40px 22px;
    border-bottom: 3px solid #1e3a8a;
    background: #ffffff;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  ">
    <div style="display:flex;align-items:flex-start;gap:14px;max-width:62%;">
      <img
        src="${logoUrl}"
        alt="${escHtml(companyName)}"
        style="height:54px;width:auto;"
        onerror="this.style.display='none'"
      />
      <div>
        <div style="color:#0f172a;font-size:20px;font-weight:800;letter-spacing:-0.3px;line-height:1.2;">${escHtml(companyName)}</div>
        <div style="color:#64748b;font-size:11px;margin-top:5px;line-height:1.55;">${escHtml(companyAddress)}</div>
        ${
          (companyPhone || companyEmail)
            ? `<div style="color:#64748b;font-size:10.5px;margin-top:3px;line-height:1.5;">${
                companyPhone ? `Tel: ${escHtml(companyPhone)}` : ''
              }${companyPhone && companyEmail ? ' &nbsp;|&nbsp; ' : ''}${
                companyEmail ? `${escHtml(companyEmail)}` : ''
              }</div>`
            : ''
        }
        ${
          companyGst
            ? `<div style="color:#475569;font-size:10.5px;margin-top:5px;line-height:1.5;font-weight:600;letter-spacing:0.3px;">GSTIN: <span style="color:#0f172a;font-family:'SFMono-Regular',Menlo,Consolas,monospace;">${escHtml(companyGst)}</span></div>`
            : ''
        }
      </div>
    </div>
    <div style="text-align:right;">
      <div style="color:#1e3a8a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;line-height:1;">Salary Slip</div>
      <div style="color:#0f172a;font-size:20px;font-weight:700;margin-top:8px;letter-spacing:-0.3px;">${escHtml(monthLabel)}</div>
      <div style="color:#64748b;font-size:10.5px;margin-top:6px;">Employee ID: <strong style="color:#0f172a;">${escHtml(empId)}</strong></div>
    </div>
  </div>

  <!-- ═══════════════ STATUS BAR ═══════════════ -->
  <div style="
    padding: 10px 40px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 6px;
  ">
    <span style="color:#64748b;font-size:11px;font-weight:600;letter-spacing:0.4px;">STATUS:</span>
    ${statusBadge}${disbursedLine}
    <span style="flex:1;"></span>
    <span style="color:#94a3b8;font-size:10px;">Issued on ${escHtml(generatedAt)}</span>
  </div>

  <!-- ═══════════════ EMPLOYEE DETAILS ═══════════════ -->
  <div style="padding: 22px 40px 4px;">
    <div class="section-title">Employee Information</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;">
      <tr>
        <td style="padding:11px 16px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;background:#f8fafc;width:25%;">
          <div class="label">Full Name</div>
          <div class="value">${escHtml(data.staffName)}</div>
        </td>
        <td style="padding:11px 16px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;width:25%;">
          <div class="label">Designation</div>
          <div class="value">${escHtml(data.jobRole)}</div>
        </td>
        <td style="padding:11px 16px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;background:#f8fafc;width:25%;">
          <div class="label">Department</div>
          <div class="value">${escHtml(dept)}</div>
        </td>
        <td style="padding:11px 16px;border-bottom:1px solid #e2e8f0;width:25%;">
          <div class="label">Date of Joining</div>
          <div class="value">${escHtml(joiningDateStr)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:11px 16px;border-right:1px solid #e2e8f0;background:#f8fafc;">
          <div class="label">Phone</div>
          <div class="value">${escHtml(data.phone || '—')}</div>
        </td>
        <td style="padding:11px 16px;border-right:1px solid #e2e8f0;" colspan="2">
          <div class="label">Email</div>
          <div class="value">${escHtml(data.email || '—')}</div>
        </td>
        <td style="padding:11px 16px;background:#f8fafc;">
          <div class="label">Pay Period</div>
          <div class="value" style="color:#1e3a8a;">${escHtml(monthLabel)}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- ═══════════════ SALARY BREAKDOWN ═══════════════ -->
  <div style="padding: 22px 40px 0;">
    <div class="section-title">Salary Breakdown</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;">
      <thead>
        <tr style="background:#1e3a8a;">
          <th style="padding:11px 16px;text-align:left;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ffffff;border-right:1px solid #2c4a9e;">Earnings</th>
          <th style="padding:11px 16px;text-align:right;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ffffff;border-right:1px solid #2c4a9e;width:130px;">Amount (INR)</th>
          <th style="padding:11px 16px;text-align:left;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ffffff;border-right:1px solid #2c4a9e;">Deductions</th>
          <th style="padding:11px 16px;text-align:right;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ffffff;width:130px;">Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        ${slipRow('Basic Salary', data.basicSalary, 'Festival Advance', data.festivalAdvance || 0)}
        ${slipRow('House Rent Allowance', data.hra, 'General Advance', data.generalAdvance || 0)}
        ${slipRow('Travel Allowance', data.travelAllowance, 'Other Deductions', data.deductions || 0)}
        ${slipRow('Incentives / Bonus', data.incentives || 0, '', null)}
        ${slipRow('Total Earnings', data.totalEarnings, 'Total Deductions', data.totalDeductions, true)}
      </tbody>
    </table>
  </div>

  <!-- ═══════════════ NET SALARY ═══════════════ -->
  <div style="padding: 18px 40px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #1e3a8a;border-radius:4px;background:#f5f7fb;">
      <tr>
        <td style="padding:16px 22px;border-right:1px dashed #c7d2ea;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#1e3a8a;line-height:1;">Net Salary Payable</div>
          <div style="font-size:11px;color:#64748b;margin-top:6px;">For the month of ${escHtml(monthLabel)}</div>
          <div style="font-size:10.5px;color:#475569;margin-top:8px;line-height:1.45;">
            <strong style="color:#0f172a;">In Words:</strong> ${escHtml(netSalaryWords)}
          </div>
        </td>
        <td style="padding:16px 22px;text-align:right;width:240px;vertical-align:middle;">
          <div style="font-size:11px;color:#64748b;letter-spacing:0.4px;">Amount</div>
          <div style="font-size:30px;font-weight:800;color:#1e3a8a;letter-spacing:-1px;line-height:1.1;font-variant-numeric:tabular-nums;margin-top:2px;">${escHtml(fmtINR(data.netSalary))}</div>
        </td>
      </tr>
    </table>
  </div>

  ${remarksSection}
  ${bankSection}

  <!-- ═══════════════ FOOTER ═══════════════ -->
  <div style="
    margin-top: 18px;
    padding: 14px 40px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  ">
    <div style="font-size:10px;color:#94a3b8;line-height:1.5;">
      This is a system-generated salary slip and does not require a signature.<br/>
      For any discrepancies, please contact the HR / Accounts department.
    </div>
    <div style="font-size:10px;color:#94a3b8;text-align:right;line-height:1.5;">
      <div><strong style="color:#475569;">${escHtml(companyName)}</strong></div>
      <div>Confidential &middot; Page 1 of 1</div>
    </div>
  </div>

</div>
</body>
</html>`;
}
