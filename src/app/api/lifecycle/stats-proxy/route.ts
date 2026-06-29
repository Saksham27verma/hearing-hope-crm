import { NextResponse } from 'next/server';

export async function GET() {
  const lifecycleUrl = (process.env.LIFECYCLE_APP_URL || '').replace(/\/$/, '');
  const secret = process.env.LIFECYCLE_WEBHOOK_SECRET?.trim();
  if (!lifecycleUrl) {
    return NextResponse.json({ error: 'LIFECYCLE_APP_URL not configured' }, { status: 503 });
  }
  if (!secret) {
    return NextResponse.json({ error: 'LIFECYCLE_WEBHOOK_SECRET not configured' }, { status: 503 });
  }

  try {
    const res = await fetch(`${lifecycleUrl}/api/stats/today`, {
      headers: { Authorization: `Bearer ${secret}` },
      next: { revalidate: 60 },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Lifecycle app unreachable' }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to reach lifecycle app' },
      { status: 502 },
    );
  }
}
