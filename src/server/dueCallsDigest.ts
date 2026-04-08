import { adminDb } from '@/server/firebaseAdmin';
import { getEnquiryStatusMeta } from '@/utils/enquiryStatus';

type FollowUpLike = {
  id?: string;
  date?: string;
  remarks?: string;
  nextFollowUpDate?: string;
  callerName?: string;
};

const FALLBACK_APP_URL = 'https://hearing-hope-crm.vercel.app';

type EnquiryLike = {
  name?: string;
  phone?: string;
  assignedTo?: string;
  telecaller?: string;
  followUpDate?: string;
  center?: string;
  visitingCenter?: string;
  centerId?: string;
  reference?: string | string[];
  followUps?: FollowUpLike[];
  visits?: Array<{ centerId?: string; center?: string; visitingCenter?: string }>;
};

export type DueCallRow = {
  enquiryId: string;
  enquiryName: string;
  enquiryPhone: string;
  patientProfileUrl: string;
  reference: string;
  statusTag: string;
  assignedTo: string;
  telecaller: string;
  /** Best-effort center id/name for center-scoped notifications. */
  centerId: string | null;
  remarks: string;
  allFollowUpLogs: string;
  dueDate: string;
  source: 'followup_log' | 'patient_info';
};

function todayYmdInIst(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value || '1970';
  const month = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function normalizeYmd(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 10);
}

function formatFollowUpLogsReadable(followUps: FollowUpLike[]): string {
  if (!followUps.length) return '-';
  return followUps
    .map((fu, idx) => {
      const date = String(fu.date || '').trim();
      const caller = String(fu.callerName || '').trim();
      const remarks = String(fu.remarks || '').trim();
      const next = normalizeYmd(fu.nextFollowUpDate);
      const left = [date ? `[${date}]` : '', caller || 'Caller unknown'].filter(Boolean).join(' ');
      const right = [
        remarks || 'No remarks',
        next ? `(Next follow-up: ${next})` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `${idx + 1}) ${left} - ${right}`.trim();
    })
    .join('\n');
}

function extractEnquiryCenterId(enquiry: EnquiryLike): string | null {
  const candidates: string[] = [];
  const push = (v: unknown) => {
    const t = String(v ?? '').trim();
    if (t) candidates.push(t);
  };
  push(enquiry.centerId);
  push(enquiry.visitingCenter);
  push(enquiry.center);
  const visits = Array.isArray(enquiry.visits) ? enquiry.visits : [];
  for (const v of visits) {
    push(v?.centerId);
    push(v?.visitingCenter);
    push(v?.center);
  }
  const uniq = [...new Set(candidates)];
  return uniq.length > 0 ? uniq[0] : null;
}

export async function collectTodayDueCallsDigest(now = new Date()): Promise<{
  dateYmdIst: string;
  rows: DueCallRow[];
}> {
  const dateYmdIst = todayYmdInIst(now);
  const snap = await adminDb().collection('enquiries').get();
  const out: DueCallRow[] = [];
  const seen = new Set<string>();

  for (const doc of snap.docs) {
    const enquiry = (doc.data() || {}) as EnquiryLike;
    const enquiryId = doc.id;
    const enquiryName = String(enquiry.name || 'Unknown').trim() || 'Unknown';
    const enquiryPhone = String(enquiry.phone || '').trim();
    const assignedTo = String(enquiry.assignedTo || '').trim();
    const telecallerFallback =
      String(enquiry.telecaller || assignedTo || 'Unassigned').trim() || 'Unassigned';
    const profileBase = (process.env.NEXT_PUBLIC_APP_URL || FALLBACK_APP_URL).replace(/\/$/, '');
    const patientProfileUrl = `${profileBase}/interaction/enquiries/${enquiryId}`;
    const rawRef = enquiry.reference;
    const reference = Array.isArray(rawRef)
      ? rawRef.map((v) => String(v || '').trim()).filter(Boolean).join(' | ')
      : String(rawRef || '').trim();
    const statusTag = getEnquiryStatusMeta({ ...enquiry, id: enquiryId }).label;
    const centerId = extractEnquiryCenterId(enquiry);

    const followUps = Array.isArray(enquiry.followUps) ? enquiry.followUps : [];
    const allFollowUpLogs = formatFollowUpLogsReadable(followUps);
    let hasLogForToday = false;

    for (let i = 0; i < followUps.length; i += 1) {
      const fu = followUps[i] || {};
      const dueYmd = normalizeYmd(fu.nextFollowUpDate);
      if (!dueYmd || dueYmd !== dateYmdIst) continue;
      hasLogForToday = true;
      const telecaller = String(fu.callerName || telecallerFallback).trim() || telecallerFallback;
      const remarks = String(fu.remarks || '').trim();
      const key = `${enquiryId}|${dueYmd}|followup_log|${String(fu.id || i)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        enquiryId,
        enquiryName,
        enquiryPhone,
        patientProfileUrl,
        reference,
        statusTag,
        assignedTo,
        telecaller,
        centerId,
        remarks,
        allFollowUpLogs,
        dueDate: dueYmd,
        source: 'followup_log',
      });
    }

    const patientDue = normalizeYmd(enquiry.followUpDate);
    if (patientDue === dateYmdIst && !hasLogForToday) {
      const key = `${enquiryId}|${patientDue}|patient_info`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          enquiryId,
          enquiryName,
          enquiryPhone,
          patientProfileUrl,
          reference,
          statusTag,
          assignedTo,
          telecaller: telecallerFallback,
          centerId,
          remarks: 'Follow-up date from patient information. No call log found for today.',
          allFollowUpLogs: allFollowUpLogs || '-',
          dueDate: patientDue,
          source: 'patient_info',
        });
      }
    }
  }

  out.sort((a, b) => {
    const name = a.enquiryName.localeCompare(b.enquiryName);
    if (name !== 0) return name;
    return a.enquiryId.localeCompare(b.enquiryId);
  });

  return { dateYmdIst, rows: out };
}

function escHtml(v: string): string {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildDueCallsDigestEmailSubject(dateYmdIst: string): string {
  return `[Hope CRM] Today's Due Calls — ${dateYmdIst} (IST)`;
}

export function buildDueCallsDigestText(dateYmdIst: string, rows: DueCallRow[]): string {
  const lines: string[] = [
    `Today's Due Calls (${dateYmdIst} IST)`,
    '',
    `Total due calls: ${rows.length}`,
    '',
  ];
  if (!rows.length) {
    lines.push('No due calls for today.');
    return lines.join('\n');
  }
  rows.forEach((r, idx) => {
    lines.push(
      `${idx + 1}. ${r.enquiryName} (${r.enquiryId})`,
      `   Phone: ${r.enquiryPhone || '-'}`,
      `   Profile URL: ${r.patientProfileUrl || '-'}`,
      `   Reference: ${r.reference || '-'}`,
      `   Status: ${r.statusTag || '-'}`,
      `   Assigned To: ${r.assignedTo || '-'}`,
      `   Telecaller: ${r.telecaller || '-'}`,
      `   Due Date: ${r.dueDate}`,
      `   Source: ${r.source === 'followup_log' ? 'Follow-up Log' : 'Patient Info'}`,
      `   Remarks: ${r.remarks || '-'}`,
      `   Follow-up logs: ${r.allFollowUpLogs || '-'}`,
      '',
    );
  });
  return lines.join('\n');
}

export function buildDueCallsDigestHtml(dateYmdIst: string, rows: DueCallRow[], appUrl?: string): string {
  const telecallingUrl = `${(appUrl || '').replace(/\/$/, '')}/telecalling-records`;
  const hasUrl = /^https?:\/\//.test(telecallingUrl);
  const tableRows = rows
    .map(
      (r) => `<tr>
  <td><a href="${escHtml(r.patientProfileUrl)}" target="_blank" rel="noreferrer">${escHtml(
        r.patientProfileUrl,
      )}</a></td>
  <td>${escHtml(r.enquiryName)}</td>
  <td>${escHtml(r.enquiryPhone || '-')}</td>
  <td>${escHtml(r.reference || '-')}</td>
  <td>${escHtml(r.statusTag || '-')}</td>
  <td>${escHtml(r.assignedTo || '-')}</td>
  <td>${escHtml(r.telecaller || '-')}</td>
  <td>${escHtml(r.dueDate)}</td>
  <td>${escHtml(r.source === 'followup_log' ? 'Follow-up Log' : 'Patient Info')}</td>
  <td>${escHtml(r.remarks || '-')}</td>
  <td style="white-space:pre-wrap;line-height:1.45;">${escHtml(r.allFollowUpLogs || '-')}</td>
</tr>`,
    )
    .join('\n');

  return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;color:#1f2937;">
    <h2 style="margin:0 0 8px;">Today's Due Calls (${escHtml(dateYmdIst)} IST)</h2>
    <p style="margin:0 0 12px;">Total due calls: <strong>${rows.length}</strong></p>
    ${hasUrl ? `<p style="margin:0 0 12px;"><a href="${escHtml(telecallingUrl)}">Open Telecalling Records</a></p>` : ''}
    ${
      rows.length
        ? `<table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;font-size:12px;">
      <thead style="background:#f3f4f6;">
        <tr>
          <th>Patient Profile URL</th>
          <th>Name</th>
          <th>Phone</th>
          <th>Reference</th>
          <th>Status</th>
          <th>Assigned To</th>
          <th>Telecaller</th>
          <th>Due Date</th>
          <th>Source</th>
          <th>Remarks</th>
          <th>All Follow-up Logs</th>
        </tr>
      </thead>
      <tbody>
${tableRows}
      </tbody>
    </table>`
        : '<p>No due calls for today.</p>'
    }
  </body>
</html>`;
}
