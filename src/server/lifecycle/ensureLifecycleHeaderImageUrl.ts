/**
 * Public HTTPS image URL for lifecycle WhatsApp IMAGE-header templates.
 * Uses Firebase Storage signed URLs — same pattern as invoice PDF links that
 * already deliver successfully via Pinnacle.
 *
 * Per-template resolution order (per `templateKey`):
 *   1. `PINNACLE_LIFECYCLE_IMAGE_<KEY>` env var, if it is a Firebase-hosted HTTPS URL.
 *   2. `public/images/whatsapp-lifecycle-<key>.jpg` uploaded to Firebase Storage.
 *   3. Legacy `PINNACLE_LIFECYCLE_HEADER_IMAGE_URL` (single default), if Firebase-hosted.
 *   4. `public/images/whatsapp-lifecycle-header.jpg` uploaded to Firebase Storage.
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { adminStorageBucket } from '@/server/firebaseAdmin';

const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { url: string; expiresAt: number }>();

function isHttpsUrl(url: string): boolean {
  return /^https:\/\//i.test(url.trim());
}

function isFirebaseHostedUrl(url: string): boolean {
  return (
    /storage\.googleapis\.com/i.test(url) ||
    /firebasestorage\.googleapis\.com/i.test(url)
  );
}

function templateKeyToEnvSuffix(templateKey: string): string {
  return String(templateKey || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
}

function envUrlForTemplate(templateKey: string): string {
  const suffix = templateKeyToEnvSuffix(templateKey);
  if (!suffix) return '';
  return (process.env[`PINNACLE_LIFECYCLE_IMAGE_${suffix}`] || '').trim();
}

async function uploadLocalToFirebase(localFilename: string, storageObject: string): Promise<string | null> {
  try {
    const localPath = path.join(process.cwd(), 'public', 'images', localFilename);
    const buffer = await readFile(localPath);

    const bucket = adminStorageBucket();
    const file = bucket.file(storageObject);
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
      /* ACL may be disallowed; signed URL still works */
    }

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storageObject}`;
    try {
      const head = await fetch(publicUrl, { method: 'HEAD' });
      if (head.ok) return publicUrl;
    } catch {
      /* fall through to signed URL */
    }

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });
    return isHttpsUrl(signedUrl) ? signedUrl : null;
  } catch {
    return null;
  }
}

export async function ensureLifecycleHeaderImageUrl(templateKey?: string): Promise<string> {
  const key = String(templateKey || '').trim();
  const cacheKey = key || '__default__';
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now + 60_000) {
    return hit.url;
  }

  if (key) {
    const perTemplateEnv = envUrlForTemplate(key);
    if (isHttpsUrl(perTemplateEnv) && isFirebaseHostedUrl(perTemplateEnv)) {
      cache.set(cacheKey, { url: perTemplateEnv, expiresAt: now + CACHE_MS });
      return perTemplateEnv;
    }
    const perTemplateUploaded = await uploadLocalToFirebase(
      `whatsapp-lifecycle-${key}.jpg`,
      `whatsapp/lifecycle-${key}.jpg`,
    );
    if (perTemplateUploaded) {
      cache.set(cacheKey, { url: perTemplateUploaded, expiresAt: now + CACHE_MS });
      return perTemplateUploaded;
    }
  }

  const legacyEnv = (process.env.PINNACLE_LIFECYCLE_HEADER_IMAGE_URL || '').trim();
  if (isHttpsUrl(legacyEnv) && isFirebaseHostedUrl(legacyEnv)) {
    cache.set(cacheKey, { url: legacyEnv, expiresAt: now + CACHE_MS });
    return legacyEnv;
  }

  const defaultUploaded = await uploadLocalToFirebase(
    'whatsapp-lifecycle-header.jpg',
    'whatsapp/lifecycle-header.jpg',
  );
  if (!defaultUploaded) {
    throw new Error('Failed to create a public URL for the lifecycle WhatsApp header image.');
  }
  cache.set(cacheKey, { url: defaultUploaded, expiresAt: now + CACHE_MS });
  return defaultUploaded;
}
