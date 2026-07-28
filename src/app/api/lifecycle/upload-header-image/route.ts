import { NextResponse } from 'next/server';
import { verifyLifecycleWebhookSecret } from '@/server/lifecycle/lifecycleAuth';
import { adminStorageBucket } from '@/server/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024;
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function safeKey(raw: string): string {
  return String(raw || 'shared')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .slice(0, 64) || 'shared';
}

export async function POST(req: Request) {
  if (!verifyLifecycleWebhookSecret(req)) {
    return jsonError('Unauthorized', 401);
  }

  const body = (await req.json().catch(() => null)) as {
    templateKey?: string;
    contentType?: string;
    filename?: string;
    base64?: string;
  } | null;
  if (!body?.base64) return jsonError('base64 required', 400);

  const templateKey = safeKey(body.templateKey || 'shared');
  const contentType = String(body.contentType || 'image/jpeg').trim() || 'image/jpeg';
  if (!contentType.startsWith('image/')) return jsonError('contentType must be image/*', 400);

  let buffer: Buffer;
  try {
    buffer = Buffer.from(body.base64, 'base64');
  } catch {
    return jsonError('Invalid base64', 400);
  }
  if (buffer.length <= 0 || buffer.length > MAX_BYTES) {
    return jsonError('Image must be between 1 byte and 4MB', 400);
  }

  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : 'jpg';
  const objectPath = `whatsapp/lifecycle-headers/${templateKey}-${Date.now()}.${ext}`;

  try {
    const bucket = adminStorageBucket();
    const file = bucket.file(objectPath);
    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: 'public, max-age=86400' },
      resumable: false,
    });
    try {
      await file.makePublic();
    } catch {
      /* signed URL fallback */
    }

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
    try {
      const head = await fetch(publicUrl, { method: 'HEAD' });
      if (head.ok) {
        return NextResponse.json({ ok: true, url: publicUrl, path: objectPath });
      }
    } catch {
      /* fall through */
    }

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });
    return NextResponse.json({ ok: true, url: signedUrl, path: objectPath });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Upload failed', 500);
  }
}
