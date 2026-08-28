export type LifecycleDigestRow = {
  customerName: string;
  phone: string;
  saleDate: string;
  milestoneLabel: string;
  milestoneDays: number;
  templateKey: string;
  templateName: string;
  status: 'sent' | 'failed';
  error?: string;
};

export type LifecycleDigestPayload = {
  date: string;
  due: number;
  sent: number;
  failed: number;
  byMilestone?: Record<string, { due: number; sent: number; failed: number }>;
  rows?: LifecycleDigestRow[];
  dashboardUrl?: string;
  notificationCreated?: number;
  crmNotified?: number;
};

const MILESTONE_LABELS: Record<string, string> = {
  service_1mo: '1-month reprogramming',
  service_6mo: '6-month service',
  service_1yr: '1-year service',
};

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function parseLifecycleDigestEmails(): string[] {
  return (process.env.LIFECYCLE_DIGEST_EMAIL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildLifecycleDigestSubject(payload: LifecycleDigestPayload): string {
  if (payload.due === 0) {
    return `Hearing Hope lifecycle — none due ${payload.date}`;
  }
  return `Hearing Hope lifecycle — ${payload.sent} sent, ${payload.failed} failed (${payload.date})`;
}

export function buildLifecycleDigestText(payload: LifecycleDigestPayload): string {
  const lines = [
    `Customer lifecycle WhatsApp report for ${payload.date} (IST)`,
    '',
    `Due: ${payload.due}  ·  Sent: ${payload.sent}  ·  Failed: ${payload.failed}`,
    `CRM notifications created: ${payload.notificationCreated ?? 0}  ·  CRM bell notified: ${payload.crmNotified ?? 0}`,
    '',
  ];

  const by = payload.byMilestone || {};
  for (const key of Object.keys(by)) {
    const b = by[key];
    const label = MILESTONE_LABELS[key] || key;
    lines.push(`${label} (${key}): due ${b.due}, sent ${b.sent}, failed ${b.failed}`);
  }

  const rows = payload.rows || [];
  if (rows.length === 0) {
    lines.push('', 'Nobody was due today. The daily job ran successfully.');
  } else {
    lines.push('', 'Recipients:');
    for (const row of rows) {
      const err = row.status === 'failed' && row.error ? ` — ${row.error}` : '';
      lines.push(
        `- ${row.customerName} · ${row.phone} · ${row.saleDate} · ${row.milestoneLabel} · ${row.templateName} · ${row.status}${err}`,
      );
    }
  }

  if (payload.dashboardUrl) {
    lines.push('', `Dashboard: ${payload.dashboardUrl}`);
  }
  return lines.join('\n');
}

export function buildLifecycleDigestHtml(payload: LifecycleDigestPayload): string {
  const rows = payload.rows || [];
  const by = payload.byMilestone || {};
  const milestoneRows = Object.keys(by)
    .map((key) => {
      const b = by[key];
      const label = MILESTONE_LABELS[key] || key;
      return `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(label)}</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${b.due}</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${b.sent}</td><td style="padding:6px 10px;border:1px solid #e5e7eb">${b.failed}</td></tr>`;
    })
    .join('');

  const bodyRows =
    rows.length === 0
      ? `<tr><td colspan="7" style="padding:12px 10px;border:1px solid #e5e7eb;color:#6b7280">Nobody was due today. The daily job ran successfully.</td></tr>`
      : rows
          .map((row) => {
            const color = row.status === 'sent' ? '#166534' : '#b91c1c';
            return `<tr>
              <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(row.customerName)}</td>
              <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(row.phone)}</td>
              <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(row.saleDate)}</td>
              <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(row.milestoneLabel)}</td>
              <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(row.templateName)}</td>
              <td style="padding:6px 10px;border:1px solid #e5e7eb;color:${color};font-weight:600">${escapeHtml(row.status)}</td>
              <td style="padding:6px 10px;border:1px solid #e5e7eb">${escapeHtml(row.error || '')}</td>
            </tr>`;
          })
          .join('');

  const dashboard = payload.dashboardUrl
    ? `<p style="margin-top:16px"><a href="${escapeHtml(payload.dashboardUrl)}">Open lifecycle dashboard</a></p>`
    : '';

  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;line-height:1.45">
    <h2 style="margin:0 0 8px">Customer lifecycle WhatsApp</h2>
    <p style="margin:0 0 12px;color:#4b5563">${escapeHtml(payload.date)} (IST)</p>
    <p><strong>Due:</strong> ${payload.due} &nbsp;·&nbsp; <strong>Sent:</strong> ${payload.sent} &nbsp;·&nbsp; <strong>Failed:</strong> ${payload.failed}</p>
    <p style="color:#6b7280">CRM notifications created: ${payload.notificationCreated ?? 0} · CRM bell notified: ${payload.crmNotified ?? 0}</p>
    <table style="border-collapse:collapse;margin:12px 0 20px">
      <thead><tr>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Milestone</th>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Due</th>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Sent</th>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Failed</th>
      </tr></thead>
      <tbody>${milestoneRows || '<tr><td colspan="4" style="padding:8px 10px;border:1px solid #e5e7eb">—</td></tr>'}</tbody>
    </table>
    <table style="border-collapse:collapse;width:100%">
      <thead><tr>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Name</th>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Phone</th>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Sale date</th>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Milestone</th>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Template</th>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Status</th>
        <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb;background:#f9fafb">Error</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
    ${dashboard}
  </div>`;
}
