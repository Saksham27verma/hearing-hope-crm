/**
 * GET /api/staff/salary-slip-pdf?staffId=<id>&month=<YYYY-MM>
 *
 * Fetches staff + salary data from Firestore (Admin SDK), generates a
 * professional A4 HTML salary slip, renders it to PDF with Puppeteer,
 * and returns the binary PDF.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { renderHtmlToPdfBuffer } from '@/server/htmlToPdfBuffer';
import { generateSalarySlipHtml } from '@/utils/salarySlipHtmlTemplate';
import type { SalarySlipData } from '@/utils/salarySlipHtmlTemplate';

export const runtime = 'nodejs';
export const maxDuration = 60;

function publicOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit?.trim()) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL;
  if (vercel?.trim()) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

function buildSalaryDocId(staffId: string, month: string) {
  return `${staffId}_${month}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const staffId = url.searchParams.get('staffId')?.trim();
    const month = url.searchParams.get('month')?.trim();

    if (!staffId) {
      return NextResponse.json({ ok: false, error: 'staffId is required' }, { status: 400 });
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ ok: false, error: 'month is required (YYYY-MM)' }, { status: 400 });
    }

    const db = adminDb();

    // ── Fetch staff document ─────────────────────────────────────────────────
    const staffSnap = await db.collection('staff').doc(staffId).get();
    if (!staffSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Staff member not found' }, { status: 404 });
    }
    const staffData = staffSnap.data() as Record<string, unknown>;

    // ── Fetch salary: try deterministic doc ID first, then query ────────────
    let salaryData: Record<string, unknown> | null = null;

    const deterministicSnap = await db
      .collection('salaries')
      .doc(buildSalaryDocId(staffId, month))
      .get();
    if (deterministicSnap.exists) {
      salaryData = deterministicSnap.data() as Record<string, unknown>;
    } else {
      const q = await db
        .collection('salaries')
        .where('staffId', '==', staffId)
        .where('month', '==', month)
        .limit(1)
        .get();
      if (!q.empty) {
        salaryData = q.docs[0].data() as Record<string, unknown>;
      }
    }

    if (!salaryData) {
      return NextResponse.json(
        { ok: false, error: `No salary record found for ${month}` },
        { status: 404 }
      );
    }

    // ── Fetch company settings (optional — for company address/phone) ────────
    let companyName = 'Hearing Hope';
    let companyAddress = 'New Delhi, India';
    let companyPhone = '';
    let companyEmail = '';
    try {
      const settingsSnap = await db.collection('settings').doc('company').get();
      if (settingsSnap.exists) {
        const s = settingsSnap.data() as Record<string, unknown>;
        companyName = String(s.companyName || s.name || companyName);
        companyAddress = String(s.address || s.companyAddress || companyAddress);
        companyPhone = String(s.phone || s.companyPhone || '');
        companyEmail = String(s.email || s.companyEmail || '');
      }
    } catch {
      // Company settings are optional — silently fall back to defaults
    }

    // ── Build template data ──────────────────────────────────────────────────
    const origin = publicOrigin();
    const logoUrl = `${origin}/images/logohope.svg`;

    const toNum = (v: unknown) => Math.round(Number(v) || 0);

    const slipData: SalarySlipData = {
      // Staff
      staffId,
      staffName: String(staffData.name || ''),
      staffNumber: staffData.staffNumber ? String(staffData.staffNumber) : undefined,
      email: staffData.email ? String(staffData.email) : undefined,
      phone: staffData.phone ? String(staffData.phone) : undefined,
      jobRole: String(staffData.jobRole || ''),
      department: staffData.department ? String(staffData.department) : undefined,
      joiningDate: staffData.joiningDate as SalarySlipData['joiningDate'],
      bankName: staffData.bankName ? String(staffData.bankName) : undefined,
      accountNumber: staffData.accountNumber ? String(staffData.accountNumber) : undefined,
      ifscCode: staffData.ifscCode ? String(staffData.ifscCode) : undefined,
      panNumber: staffData.panNumber ? String(staffData.panNumber) : undefined,

      // Salary
      month,
      basicSalary: toNum(salaryData.basicSalary),
      hra: toNum(salaryData.hra),
      travelAllowance: toNum(salaryData.travelAllowance),
      incentives: toNum(salaryData.incentives),
      festivalAdvance: toNum(salaryData.festivalAdvance),
      generalAdvance: toNum(salaryData.generalAdvance),
      deductions: toNum(salaryData.deductions),
      totalEarnings: toNum(salaryData.totalEarnings),
      totalDeductions: toNum(salaryData.totalDeductions),
      netSalary: toNum(salaryData.netSalary),
      isPaid: !!salaryData.isPaid,
      paidDate: salaryData.paidDate as SalarySlipData['paidDate'],
      remarks: salaryData.remarks ? String(salaryData.remarks) : undefined,

      // Branding
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      logoUrl,
    };

    const html = generateSalarySlipHtml(slipData);
    const buffer = await renderHtmlToPdfBuffer(html);

    const safeName = String(staffData.name || staffId)
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const filename = `salary-slip-${safeName}-${month}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate salary slip PDF';
    console.error('salary-slip-pdf error:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
