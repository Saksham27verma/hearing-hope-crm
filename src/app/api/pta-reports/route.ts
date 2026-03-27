import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { normalizePtaReportListPayload, type PtaReportListItem } from '@/lib/ptaIntegration';

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
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

    const role = (userSnap.data() as { role?: string })?.role;
    if (!role || !['admin', 'staff', 'audiologist'].includes(role)) {
      return jsonError('Forbidden', 403);
    }

    const base = (process.env.PTA_SOFTWARE_API_BASE || '').trim().replace(/\/+$/, '');
    if (!base) {
      return jsonError(
        'PTA integration is not configured (set PTA_SOFTWARE_API_BASE on the server).',
        503
      );
    }

    const listPath = (process.env.PTA_SOFTWARE_LIST_PATH || '/api/crm/reports').trim();
    const pathWithQuery = listPath.startsWith('/') ? listPath : `/${listPath}`;
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const upstreamUrl = new URL(base + pathWithQuery);
    if (q) upstreamUrl.searchParams.set('q', q);

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    const apiKey = (process.env.PTA_SOFTWARE_API_KEY || '').trim();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const upstream = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error('pta-reports upstream error', upstream.status, text?.slice(0, 500));
      return jsonError(
        `PTA software returned ${upstream.status}. Check PTA_SOFTWARE_API_BASE and list path.`,
        502
      );
    }

    let body: unknown;
    try {
      body = await upstream.json();
    } catch {
      return jsonError('PTA software response was not JSON', 502);
    }

    const reports: PtaReportListItem[] = normalizePtaReportListPayload(body);
    return NextResponse.json({ ok: true, reports });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load PTA reports';
    console.error('pta-reports error:', err);
    return jsonError(message, 500);
  }
}
