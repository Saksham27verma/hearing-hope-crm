import { NextResponse } from 'next/server';
import { adminDb } from '@/server/firebaseAdmin';
import { assertHopeAIAdmin, requireHopeAIAuth } from '@/server/hope-ai/authz';
import { runHopeAIBackfill } from '@/server/hope-ai/indexing/builders';
import { getHopeAISettings, updateHopeAISettings } from '@/server/hope-ai/settings';

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const context = await requireHopeAIAuth(request);
    assertHopeAIAdmin(context);

    const [settings, statusSnap, logsSnap] = await Promise.all([
      getHopeAISettings(),
      adminDb().collection('hopeAiSettings').doc('indexStatus').get(),
      adminDb().collection('hopeAiLogs').orderBy('createdAt', 'desc').limit(20).get().catch(() => ({ docs: [] as any[] })),
    ]);

    const status = statusSnap.exists ? statusSnap.data() : {};
    const logs = logsSnap.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));

    return NextResponse.json({
      ok: true,
      settings,
      status,
      logs,
    });
  } catch (error: any) {
    return jsonError(error?.message || 'Failed to load Hope AI admin data', error?.status || 500);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireHopeAIAuth(request);
    assertHopeAIAdmin(context);
    const body = await request.json().catch(() => null);
    const action = body?.action;

    if (action === 'reindex') {
      const result = await runHopeAIBackfill(context.uid);
      return NextResponse.json({ ok: true, result });
    }

    if (action === 'update-settings') {
      const settings = await updateHopeAISettings({
        provider: body?.provider,
        model: body?.model,
        temperature: body?.temperature,
      }, context.uid);
      return NextResponse.json({ ok: true, settings });
    }

    return jsonError('Unsupported admin action', 400);
  } catch (error: any) {
    return jsonError(error?.message || 'Failed to complete Hope AI admin action', error?.status || 500);
  }
}
