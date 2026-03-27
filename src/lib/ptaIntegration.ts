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
  /** Prefer for iframe embed (minimal chrome). Falls back to viewUrl. */
  embedUrl?: string;
  /** If PTA API returns pure-tone points, CRM can render PureToneAudiogram without iframe. */
  audiogramData?: Record<string, unknown>;
};

export type PtaReportListItem = {
  id: string;
  patientName: string;
  viewUrl: string;
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
  const createdAt = pickString(o, ['createdAt', 'created_at', 'date', 'testDate']);
  const embedUrl = pickString(o, ['embedUrl', 'iframeUrl', 'embed', 'audiogramEmbedUrl', 'previewUrl']);
  const audiogramData = pickAudiogramObject(o);
  return {
    id,
    patientName: patientName || id,
    viewUrl,
    ...(createdAt ? { createdAt } : {}),
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
  return {
    reportId: item.id,
    patientLabel: item.patientName,
    viewUrl: item.viewUrl,
    linkedAt: new Date().toISOString(),
    ...(item.embedUrl ? { embedUrl: item.embedUrl } : {}),
    ...(item.audiogramData ? { audiogramData: item.audiogramData } : {}),
  };
}
