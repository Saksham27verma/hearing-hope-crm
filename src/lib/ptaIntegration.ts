/**
 * CRM ↔ external PTA (Pure Tone Audiometry) app contract.
 *
 * Your Vercel-hosted PTA app should expose an HTTP GET endpoint that returns JSON.
 * Configure CRM with PTA_SOFTWARE_API_BASE and optional PTA_SOFTWARE_LIST_PATH / PTA_SOFTWARE_API_KEY.
 */

export type ExternalPtaReportLink = {
  reportId: string;
  patientLabel: string;
  viewUrl: string;
  linkedAt?: string;
  /** Date of test / report from PTA software (for display). */
  testDate?: string;
  /** Prefer for iframe embed (minimal chrome). Falls back to viewUrl. */
  embedUrl?: string;
  /** If PTA API returns pure-tone points, CRM can render PureToneAudiogram without iframe. */
  audiogramData?: Record<string, unknown>;
};

export type PtaReportListItem = {
  id: string;
  patientName: string;
  viewUrl: string;
  /** Date of test (preferred for labels; parsed from several upstream field names). */
  testDate?: string;
  createdAt?: string;
  embedUrl?: string;
  audiogramData?: Record<string, unknown>;
};

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/** Pick a parseable date string from flexible PTA payloads (strings or Firestore-like objects). */
function pickTestDateString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object') {
      const any = v as { seconds?: number; _seconds?: number };
      const sec =
        typeof any.seconds === 'number'
          ? any.seconds
          : typeof any._seconds === 'number'
            ? any._seconds
            : NaN;
      if (Number.isFinite(sec)) {
        try {
          return new Date(sec * 1000).toISOString();
        } catch {
          /* ignore */
        }
      }
    }
    if (typeof v === 'number' && Number.isFinite(v) && v > 1e12) {
      try {
        return new Date(v).toISOString();
      } catch {
        /* ignore */
      }
    }
  }
  return '';
}

/** Short display date for autocomplete / profile (e.g. "15 Mar 2026"). */
export function formatPtaTestDateForDisplay(raw?: string | null): string {
  if (raw == null || !String(raw).trim()) return '';
  const d = new Date(String(raw).trim());
  if (!Number.isFinite(d.getTime())) return String(raw).trim();
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function pickAudiogramObject(o: Record<string, unknown>): Record<string, unknown> | undefined {
  const keys = ['audiogramData', 'audiogram', 'ptaAudiogram', 'pureToneAudiogram'];
  for (const k of keys) {
    const v = o[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  }
  return undefined;
}

/** Normalize one row from the PTA app (flexible field names). */
export function normalizePtaReportRow(raw: unknown): PtaReportListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = pickString(o, ['id', 'reportId', '_id', 'uuid']);
  const patientName = pickString(o, ['patientName', 'name', 'patientLabel', 'title', 'label']);
  const viewUrl = pickString(o, ['viewUrl', 'url', 'href', 'link', 'publicUrl']);
  if (!id || !viewUrl) return null;
  const testDateRaw = pickTestDateString(o, [
    'testDate',
    'dateOfTest',
    'examDate',
    'appointmentDate',
    'visitDate',
    'testedAt',
    'createdAt',
    'created_at',
    'date',
    'timestamp',
    'time',
  ]);
  const embedUrl = pickString(o, ['embedUrl', 'iframeUrl', 'embed', 'audiogramEmbedUrl', 'previewUrl']);
  const audiogramData = pickAudiogramObject(o);
  const testDate = testDateRaw || undefined;
  return {
    id,
    patientName: patientName || id,
    viewUrl,
    ...(testDate ? { testDate, createdAt: testDate } : {}),
    ...(embedUrl ? { embedUrl } : {}),
    ...(audiogramData ? { audiogramData } : {}),
  };
}

export function normalizePtaReportListPayload(json: unknown): PtaReportListItem[] {
  if (Array.isArray(json)) {
    return json.map(normalizePtaReportRow).filter(Boolean) as PtaReportListItem[];
  }
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    const arr = o.reports ?? o.data ?? o.items ?? o.results;
    if (Array.isArray(arr)) {
      return arr.map(normalizePtaReportRow).filter(Boolean) as PtaReportListItem[];
    }
  }
  return [];
}

export function listItemToStoredLink(item: PtaReportListItem): ExternalPtaReportLink {
  const testDate = item.testDate || item.createdAt;
  return {
    reportId: item.id,
    patientLabel: item.patientName,
    viewUrl: item.viewUrl,
    linkedAt: new Date().toISOString(),
    ...(testDate ? { testDate } : {}),
    ...(item.embedUrl ? { embedUrl: item.embedUrl } : {}),
    ...(item.audiogramData ? { audiogramData: item.audiogramData } : {}),
  };
}
