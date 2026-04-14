import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/server/firebaseAdmin';
import { assertAdmin, assertExplicitSuperAdmin, getRequesterTenant } from '@/server/tenant/requesterTenant';
import type { ExpenseScopeType, ExpenseStatus } from '@/lib/expenses/types';

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Missing Authorization bearer token');
  const decoded = await adminAuth().verifyIdToken(match[1]);
  const requester = await getRequesterTenant(decoded.uid);
  if (!requester) throw new Error('Forbidden');
  return requester;
}

function parseDateOnly(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('date must be in YYYY-MM-DD format');
  return s;
}

function parseScopeType(value: unknown): ExpenseScopeType {
  if (value === 'center' || value === 'global') return value;
  throw new Error('scopeType must be "center" or "global"');
}

function parseStatus(value: unknown): ExpenseStatus {
  if (value === 'archived') return 'archived';
  return 'active';
}

function sanitizePayload(raw: Record<string, unknown>) {
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be a positive number');
  const category = String(raw.category ?? '').trim();
  if (!category) throw new Error('category is required');
  const scopeType = parseScopeType(raw.scopeType);
  const centerId = String(raw.centerId ?? '').trim();
  const centerName = String(raw.centerName ?? '').trim();
  if (scopeType === 'center' && !centerId) throw new Error('centerId is required when scopeType is center');
  return {
    date: parseDateOnly(raw.date),
    amount,
    category,
    subCategory: String(raw.subCategory ?? '').trim() || null,
    vendor: String(raw.vendor ?? '').trim() || null,
    notes: String(raw.notes ?? '').trim() || null,
    scopeType,
    centerId: scopeType === 'center' ? centerId : null,
    centerName: scopeType === 'center' ? centerName || null : null,
    status: parseStatus(raw.status),
  };
}

export async function GET(req: Request) {
  try {
    const requester = await authenticate(req);
    assertAdmin(requester);
    const url = new URL(req.url);
    const from = String(url.searchParams.get('from') ?? '').trim();
    const to = String(url.searchParams.get('to') ?? '').trim();
    const db = adminDb();
    const snap = await db.collection('expenses').orderBy('date', 'desc').get();
    const rows = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((row) => {
        const date = String(row.date ?? '');
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      });
    return NextResponse.json({ ok: true, data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch expenses';
    if (message.includes('Missing Authorization')) return jsonError(message, 401);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 500);
  }
}

export async function POST(req: Request) {
  try {
    const requester = await authenticate(req);
    assertExplicitSuperAdmin(requester);
    const body = (await req.json()) as Record<string, unknown>;
    const payload = sanitizePayload(body);
    const now = Date.now();
    const db = adminDb();
    const ref = await db.collection('expenses').add({
      ...payload,
      createdBy: requester.uid,
      updatedBy: requester.uid,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create expense';
    if (message.includes('Missing Authorization')) return jsonError(message, 401);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 400);
  }
}

export async function PATCH(req: Request) {
  try {
    const requester = await authenticate(req);
    assertExplicitSuperAdmin(requester);
    const body = (await req.json()) as Record<string, unknown>;
    const id = String(body.id ?? '').trim();
    if (!id) return jsonError('id is required', 400);
    const payload = sanitizePayload(body);
    const db = adminDb();
    await db.collection('expenses').doc(id).set(
      {
        ...payload,
        updatedBy: requester.uid,
        updatedAt: Date.now(),
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update expense';
    if (message.includes('Missing Authorization')) return jsonError(message, 401);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 400);
  }
}

export async function DELETE(req: Request) {
  try {
    const requester = await authenticate(req);
    assertExplicitSuperAdmin(requester);
    const url = new URL(req.url);
    const id = String(url.searchParams.get('id') ?? '').trim();
    if (!id) return jsonError('id is required', 400);
    await adminDb().collection('expenses').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete expense';
    if (message.includes('Missing Authorization')) return jsonError(message, 401);
    if (message === 'Forbidden') return jsonError(message, 403);
    return jsonError(message, 400);
  }
}
