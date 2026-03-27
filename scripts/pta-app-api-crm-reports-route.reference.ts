/**
 * REFERENCE ONLY — not part of the CRM build.
 *
 * Copy this file to your PTA Next.js app as:
 *   app/api/crm/reports/route.ts
 *
 * Then fix https://pta-report-generator.vercel.app/api/crm/reports (FUNCTION_INVOCATION_FAILED).
 *
 * On Vercel (PTA project), set:
 *   CRM_PTA_API_KEY=<same value as CRM's PTA_SOFTWARE_API_KEY>
 *   NEXT_PUBLIC_APP_URL=https://pta-report-generator.vercel.app
 * (NEXT_PUBLIC_APP_URL is used below to build absolute viewUrl — adjust if you use a different public URL.)
 */
import { NextResponse } from 'next/server';

/** Use Node if you add firebase-admin or fs; Edge breaks many admin SDKs. */
export const runtime = 'nodejs';

type ReportRow = {
  id: string;
  patientName: string;
  viewUrl: string;
  createdAt?: string;
};

export async function GET(req: Request) {
  try {
    const requiredKey = process.env.CRM_PTA_API_KEY?.trim();
    if (requiredKey) {
      const auth = req.headers.get('authorization') || '';
      const token = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
      if (token !== requiredKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    let base = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
    if (!base && process.env.VERCEL_URL) {
      base = `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`;
    }

    // --- Replace this block with your real store (Firestore, DB, file index). ---
    // Must not throw: wrap your client in try/catch and return [] on failure.
    let reports: ReportRow[] = [];

    // Example static row (remove when wired to real data):
    if (process.env.PTA_CRM_LIST_MOCK === '1') {
      const origin = base || 'https://pta-report-generator.vercel.app';
      reports = [
        {
          id: 'demo-1',
          patientName: 'Demo patient',
          viewUrl: `${origin}/reports/demo-1`,
          /** Optional: minimal page without nav; CRM iframe uses embedUrl when set. */
          embedUrl: `${origin}/embed/demo-1`,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    if (q) {
      reports = reports.filter(
        (r) =>
          r.patientName.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
      );
    }

    return NextResponse.json(
      { reports },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('[api/crm/reports]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
