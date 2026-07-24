/**
 * Public HTTPS image URL for lifecycle WhatsApp IMAGE-header templates.
 * Uses Firebase Storage signed URLs — same pattern as invoice PDF links that
 * already deliver successfully via Pinnacle.
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { adminStorageBucket } from '@/server/firebaseAdmin';

const STORAGE_OBJECT = 'whatsapp/lifecycle-header.jpg';
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MS = 6 * 60 * 60 * 1000;

let cached: { url: string; expiresAt: number } | null = null;

function isHttpsUrl(url: string): boolean {
  return /^https:\/\//i.test(url.trim());
}

function isFirebaseHostedUrl(url: string): boolean {
  return (
    /storage\.googleapis\.com/i.test(url) ||
    /firebasestorage\.googleapis\.com/i.test(url)
  );
}

export async function ensureLifecycleHeaderImageUrl(): Promise<string> {
  const fromEnv = (process.env.PINNACLE_LIFECYCLE_HEADER_IMAGE_URL || '').trim();
  // Only trust env URLs that Meta can fetch the same way as invoice PDFs (Firebase).
  // Plain Vercel static URLs often get API-accepted then fail delivery for IMAGE headers.
  if (isHttpsUrl(fromEnv) && isFirebaseHostedUrl(fromEnv)) {
    return fromEnv;
  }

  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) {
    return cached.url;
  }

  const localPath = path.join(process.cwd(), 'public', 'images', 'whatsapp-lifecycle-header.jpg');
  const buffer = await readFile(localPath);

  const bucket = adminStorageBucket();
  const file = bucket.file(STORAGE_OBJECT);
  await Promise.race([
    file.save(buffer, {
      contentType: 'image/jpeg',
      metadata: { cacheControl: 'public, max-age=86400' },
      resumable: false,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firebase header image upload timed out')), 15_000),
    ),
  ]);

  try {
    await file.makePublic();
  } catch {
    // Bucket may disallow ACL; signed URL below still works (invoice path).
  }

  // Prefer stable public URL when ACL allows; else signed URL (invoice style).
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${STORAGE_OBJECT}`;
  try {
    const head = await fetch(publicUrl, { method: 'HEAD' });
    if (head.ok) {
      cached = { url: publicUrl, expiresAt: now + CACHE_MS };
      return publicUrl;
    }
  } catch {
    // fall through to signed
  }

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: now + SIGNED_URL_TTL_MS,
  });
  if (!isHttpsUrl(signedUrl)) {
    throw new Error('Failed to create a public URL for the lifecycle WhatsApp header image.');
  }
  cached = { url: signedUrl, expiresAt: now + CACHE_MS };
  return signedUrl;
}
