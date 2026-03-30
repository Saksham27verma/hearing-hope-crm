import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { normalizePtaReportListPayload, type PtaReportListItem } from '@/lib/ptaIntegration';

function jsonError(
  message: string,
  status: number,
  extra?: Record<string, string | number | undefined>
) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/**
 * Build the PTA list URL. Supports:
 * - Origin only: PTA_SOFTWARE_API_BASE=https://pta.example.com → GET {origin}{LIST_PATH}
 * - Full list URL: PTA_SOFTWARE_API_BASE=https://pta.example.com/api/crm/reports → same URL (LIST_PATH not appended again)
 */
function buildPtaListUrl(searchQuery: string): { url: URL; error?: string } {
  const fullOverride = (process.env.PTA_SOFTWARE_FULL_LIST_URL || '').trim();
  if (fullOverride) {
    try {
      const u = new URL(fullOverride);
      if (searchQuery) u.searchParams.set('q', searchQuery);
      return { url: u };
    } catch {
      return { url: new URL('http://invalid'), error: 'Invalid PTA_SOFTWARE_FULL_LIST_URL' };
    }
  }

  const baseRaw = (process.env.PTA_SOFTWARE_API_BASE || '').trim();
  if (!baseRaw) {
    return { url: new URL('http://invalid'), error: 'PTA_SOFTWARE_API_BASE is empty' };
  }

  let baseUrl: URL;
  try {
    const normalized = /^https?:\/\//i.test(baseRaw) ? baseRaw : `https://${baseRaw}`;
    baseUrl = new URL(normalized);
  } catch {
    return { url: new URL('http://invalid'), error: 'Invalid PTA_SOFTWARE_API_BASE (not a valid URL)' };
  }

  const listPath = (process.env.PTA_SOFTWARE_LIST_PATH || '/api/crm/reports').trim();
  const pathSeg = listPath.startsWith('/') ? listPath : `/${listPath}`;

  const pathIsRoot = baseUrl.pathname === '/' || baseUrl.pathname === '';
  const finalUrl = pathIsRoot ? new URL(pathSeg, `${baseUrl.origin}/`) : new URL(baseUrl.toString());

  if (searchQuery) finalUrl.searchParams.set('q', searchQuery);
  return { url: finalUrl };
}

function upstreamErrorPreview(text: string, max = 350): string {
  const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.slice(0, max);
}

/**
 * Proxies to your PTA Vercel app. Expected upstream (GET):
 *   — Query: optional `q` for search (forwarded as `q`)
 *   — Response: { reports: [...] } or [...] with items { id, patientName, viewUrl } (aliases supported; see ptaIntegration.ts)
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return jsonError('Missing Authorization bearer token', 401);

    const idToken = match[1];
    const decoded = await adminAuth().verifyIdToken(idToken);
    const db = adminDb();
    const userSnap = await db.collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return jsonError('Forbidden', 403);

    const roleRaw = (userSnap.data() as { role?: string })?.role;
    const role =
      typeof roleRaw === 'string' ? roleRaw.trim().toLowerCase() : '';
    if (!role || !['admin', 'staff', 'audiologist'].includes(role)) {
      return jsonError('Forbidden', 403);
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();

    const { url: upstreamUrl, error: buildErr } = buildPtaListUrl(q);
    if (buildErr) {
      if (buildErr.includes('empty')) {
        return jsonError(
          'PTA integration is not configured (set PTA_SOFTWARE_API_BASE on the server).',
          503
        );
      }
      return jsonError(buildErr, 503);
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'HearingHope-CRM/pta-proxy',
    };
    const apiKey = (process.env.PTA_SOFTWARE_API_KEY || '').trim();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : 'fetch failed';
      console.error('pta-reports fetch error', upstreamUrl.toString(), fetchErr);
      return jsonError(
        `Could not reach PTA software (${msg}). Check PTA_SOFTWARE_API_BASE and network/DNS.`,
        502,
        { requestedUrl: upstreamUrl.toString() }
      );
    }

    const responseText = await upstream.text().catch(() => '');

    if (!upstream.ok) {
      console.error(
        'pta-reports upstream error',
        upstream.status,
        upstreamUrl.toString(),
        responseText.slice(0, 800)
      );

      let hint = '';
      try {
        const j = JSON.parse(responseText) as { error?: string; message?: string };
        if (typeof j?.error === 'string') hint = j.error;
        else if (typeof j?.message === 'string') hint = j.message;
      } catch {
        hint = upstreamErrorPreview(responseText);
      }

      return jsonError(
        `PTA software returned ${upstream.status}. Fix the PTA app route or env (see upstreamHint).`,
        502,
        {
          requestedUrl: upstreamUrl.toString(),
          upstreamStatus: upstream.status,
          ...(hint ? { upstreamHint: hint.slice(0, 500) } : {}),
        }
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(responseText) as unknown;
    } catch {
      return jsonError('PTA software response was not JSON', 502, {
        requestedUrl: upstreamUrl.toString(),
        upstreamHint: upstreamErrorPreview(responseText, 200),
      });
    }

    const reports: PtaReportListItem[] = normalizePtaReportListPayload(body);
    return NextResponse.json({ ok: true, reports });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load PTA reports';
    console.error('pta-reports error:', err);
    return jsonError(message, 500);
  }
}
