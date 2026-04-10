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

// ─── Row builder ─────────────────────────────────────────────────────────────

function slipRow(
  earningLabel: string,
  earningAmount: number | null,
  deductionLabel: string,
  deductionAmount: number | null,
  bold = false
): string {
  const rowStyle = bold
    ? 'background:#f0f4ff;font-weight:700;'
    : '';
  const earningAmtStr =
    earningAmount !== null && earningAmount > 0 ? escHtml(fmtINR(earningAmount)) : '';
  const deductionAmtStr =
    deductionAmount !== null && deductionAmount > 0 ? escHtml(fmtINR(deductionAmount)) : '';

  return `
    <tr style="${rowStyle}">
      <td style="padding:8px 14px;border-right:1px solid #e0e4ef;color:${bold ? '#1a1a2e' : '#374151'};font-size:12px;">${escHtml(earningLabel)}</td>
      <td style="padding:8px 14px;text-align:right;border-right:1px solid #e0e4ef;color:${bold ? '#166534' : '#1a1a2e'};font-size:12px;font-weight:${bold ? 700 : 500};">${earningAmtStr}</td>
      <td style="padding:8px 14px;border-right:1px solid #e0e4ef;color:${bold ? '#1a1a2e' : '#374151'};font-size:12px;">${escHtml(deductionLabel)}</td>
      <td style="padding:8px 14px;text-align:right;color:${bold ? '#991b1b' : '#1a1a2e'};font-size:12px;font-weight:${bold ? 700 : 500};">${deductionAmtStr}</td>
    </tr>`;
}

// ─── Main template function ───────────────────────────────────────────────────

export function generateSalarySlipHtml(data: SalarySlipData): string {
  const companyName = data.companyName || 'Hearing Hope';
  const companyAddress = data.companyAddress || 'New Delhi, India';
  const companyPhone = data.companyPhone || '';
  const companyEmail = data.companyEmail || '';
  const logoUrl = data.logoUrl || '/images/logohope.svg';

  const monthLabel = fmtMonth(data.month);
  const empId = employeeId(data);
  const dept = data.department || data.jobRole || '—';
  const joiningDateStr = fmtTs(data.joiningDate);

  const isPaid = !!data.isPaid;
  const paidDateStr = data.paidDate ? fmtTs(data.paidDate) : '';
  const statusBadge = isPaid
    ? `<span style="display:inline-block;background:#dcfce7;color:#166534;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;border:1px solid #bbf7d0;">✓ SALARY PAID</span>`
    : `<span style="display:inline-block;background:#fef9c3;color:#854d0e;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;border:1px solid #fde047;">⏳ PAYMENT PENDING</span>`;

  const disbursedLine = isPaid && paidDateStr
    ? `<span style="color:#6b7280;font-size:11px;margin-left:10px;">Disbursed on ${escHtml(paidDateStr)}</span>`
    : '';

  const generatedAt = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

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
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      @page { size: A4 portrait; margin: 0; }
      body { background: white; }
      .page-wrapper { box-shadow: none; margin: 0; border-radius: 0; }
    }
  </style>
</head>
<body>
<div class="page-wrapper" style="
  max-width: 820px;
  margin: 24px auto;
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  overflow: hidden;
">

  <!-- ═══════════════ HEADER ═══════════════ -->
  <div style="
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 65%, #3b82f6 100%);
    padding: 28px 40px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  ">
    <!-- Left: Logo + Company -->
    <div style="display:flex;align-items:center;gap:16px;">
      <img
        src="${logoUrl}"
        alt="Hearing Hope Logo"
        style="height:52px;width:auto;filter:brightness(0) invert(1);"
        onerror="this.style.display='none'"
      />
      <div>
        <div style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;line-height:1.2;">${escHtml(companyName)}</div>
        <div style="color:rgba(255,255,255,0.75);font-size:11px;margin-top:2px;">${escHtml(companyAddress)}</div>
        ${companyPhone ? `<div style="color:rgba(255,255,255,0.65);font-size:10px;margin-top:1px;">${escHtml(companyPhone)}</div>` : ''}
        ${companyEmail ? `<div style="color:rgba(255,255,255,0.65);font-size:10px;">${escHtml(companyEmail)}</div>` : ''}
      </div>
    </div>
    <!-- Right: Slip title + month -->
    <div style="text-align:right;">
      <div style="color:rgba(255,255,255,0.8);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;line-height:1;">Salary Slip</div>
      <div style="color:white;font-size:18px;font-weight:700;margin-top:6px;letter-spacing:-0.3px;">${escHtml(monthLabel)}</div>
      ${isPaid && paidDateStr ? `<div style="color:rgba(255,255,255,0.7);font-size:10px;margin-top:4px;">Paid on ${escHtml(paidDateStr)}</div>` : ''}
    </div>
  </div>

  <!-- ═══════════════ STATUS BAR ═══════════════ -->
  <div style="
    padding: 10px 40px;
    background: ${isPaid ? '#f0fdf4' : '#fefce8'};
    border-bottom: 1px solid ${isPaid ? '#bbf7d0' : '#fde68a'};
    display: flex;
    align-items: center;
    gap: 10px;
  ">
    ${statusBadge}${disbursedLine}
    <span style="flex:1;"></span>
    <span style="color:#9ca3af;font-size:10px;">Generated: ${escHtml(generatedAt)}</span>
  </div>

  <!-- ═══════════════ EMPLOYEE DETAILS ═══════════════ -->
  <div style="padding: 24px 40px 0;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:10px;">Employee Information</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;border-collapse:separate;">
      <tr>
        <td style="padding:12px 16px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;background:#f8fafc;width:25%;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Full Name</div>
          <div style="font-size:13px;font-weight:700;color:#0f172a;">${escHtml(data.staffName)}</div>
        </td>
        <td style="padding:12px 16px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;width:25%;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Designation</div>
          <div style="font-size:12px;font-weight:600;color:#1e293b;">${escHtml(data.jobRole)}</div>
        </td>
        <td style="padding:12px 16px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;background:#f8fafc;width:25%;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Employee ID</div>
          <div style="font-size:12px;font-weight:600;color:#1e293b;">${escHtml(empId)}</div>
        </td>
        <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;width:25%;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Department</div>
          <div style="font-size:12px;font-weight:600;color:#1e293b;">${escHtml(dept)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 16px;border-right:1px solid #e2e8f0;background:#f8fafc;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Date of Joining</div>
          <div style="font-size:12px;font-weight:600;color:#1e293b;">${escHtml(joiningDateStr)}</div>
        </td>
        <td style="padding:12px 16px;border-right:1px solid #e2e8f0;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Phone</div>
          <div style="font-size:12px;font-weight:600;color:#1e293b;">${escHtml(data.phone || '—')}</div>
        </td>
        <td style="padding:12px 16px;border-right:1px solid #e2e8f0;background:#f8fafc;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Email</div>
          <div style="font-size:12px;font-weight:600;color:#1e293b;">${escHtml(data.email || '—')}</div>
        </td>
        <td style="padding:12px 16px;">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:3px;">Salary Month</div>
          <div style="font-size:12px;font-weight:700;color:#2563eb;">${escHtml(monthLabel)}</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- ═══════════════ SALARY BREAKDOWN ═══════════════ -->
  <div style="padding: 20px 40px 0;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:10px;">Salary Breakdown</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;border-collapse:separate;">
      <!-- Table header -->
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#166534;border-right:1px solid #e0e4ef;border-bottom:1px solid #e0e4ef;">Earnings</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#166534;border-right:1px solid #e0e4ef;border-bottom:1px solid #e0e4ef;width:130px;">Amount</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#991b1b;border-right:1px solid #e0e4ef;border-bottom:1px solid #e0e4ef;">Deductions</th>
          <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#991b1b;border-bottom:1px solid #e0e4ef;width:130px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${slipRow('Basic Salary', data.basicSalary, 'Festival Advance', data.festivalAdvance || 0)}
        ${slipRow('House Rent Allowance (HRA)', data.hra, 'General Advance', data.generalAdvance || 0)}
        ${slipRow('Travel Allowance', data.travelAllowance, 'Other Deductions', data.deductions || 0)}
        ${slipRow('Incentives / Bonus', data.incentives || 0, '', null)}
        ${slipRow('Total Earnings', data.totalEarnings, 'Total Deductions', data.totalDeductions, true)}
      </tbody>
    </table>
  </div>

  <!-- ═══════════════ NET SALARY ═══════════════ -->
  <div style="padding: 16px 40px 20px;">
    <div style="
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 24px;
      border: 2px solid #2563eb;
      border-radius: 8px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    ">
      <div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#2563eb;line-height:1;">Net Salary Payable</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;">(Total Earnings &minus; Total Deductions)</div>
      </div>
      <div style="font-size:32px;font-weight:800;color:#1d4ed8;letter-spacing:-1px;">${escHtml(fmtINR(data.netSalary))}</div>
    </div>
  </div>

  ${remarksSection}
  ${bankSection}

  <!-- ═══════════════ SEPARATOR ═══════════════ -->
  <div style="margin: 0 40px; border-top: 1px solid #e2e8f0;"></div>

  <!-- ═══════════════ SIGNATURES ═══════════════ -->
  <div style="padding: 24px 40px; display: flex; gap: 40px;">
    <div style="flex:1;text-align:center;">
      <div style="height: 52px; border-bottom: 1.5px solid #64748b; margin-bottom: 8px;"></div>
      <div style="font-size:11px;color:#64748b;font-weight:600;">Employee Signature</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${escHtml(data.staffName)}</div>
    </div>
    <div style="flex:1;text-align:center;">
      <div style="height: 52px; border-bottom: 1.5px solid #64748b; margin-bottom: 8px;"></div>
      <div style="font-size:11px;color:#64748b;font-weight:600;">Authorized Signatory</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${escHtml(companyName)}</div>
    </div>
  </div>

  <!-- ═══════════════ FOOTER ═══════════════ -->
  <div style="
    padding: 12px 40px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  ">
    <div style="font-size:10px;color:#94a3b8;">
      This is a computer-generated salary slip and does not require a physical signature.
    </div>
    <div style="font-size:10px;color:#94a3b8;">${escHtml(companyName)} &bull; Confidential</div>
  </div>

</div>
</body>
</html>`;
}
