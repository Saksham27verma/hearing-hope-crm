import { readFile } from 'fs/promises';
import path from 'path';
import { adminStorageBucket } from '@/server/firebaseAdmin';

const STORAGE_OBJECT = 'whatsapp/lifecycle-header.jpg';
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MS = 6 * 60 * 60 * 1000; // refresh signed URL before weekly expiry

let cached: { url: string; expiresAt: number } | null = null;

function isHttpsUrl(url: string): boolean {
  return /^https:\/\//i.test(url.trim());
}

/**
 * Public HTTPS image URL for lifecycle WhatsApp templates that use an IMAGE header.
 * Prefers PINNACLE_LIFECYCLE_HEADER_IMAGE_URL, then production static asset, then Firebase upload.
 */
export async function ensureLifecycleHeaderImageUrl(): Promise<string> {
  const fromEnv = (process.env.PINNACLE_LIFECYCLE_HEADER_IMAGE_URL || '').trim();
  if (isHttpsUrl(fromEnv)) return fromEnv;

  // Bundled asset on production CRM (Meta can fetch this; localhost cannot).
  const appOrigin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.PINNACLE_WEBHOOK_URL?.replace(/\/api\/webhook\/whatsapp\/?$/, '') ||
    'https://hearing-hope-crm.vercel.app'
  )
    .trim()
    .replace(/\/$/, '');
  const productionFallback = 'https://hearing-hope-crm.vercel.app/images/whatsapp-lifecycle-header.jpg';
  if (isHttpsUrl(appOrigin) && !/localhost|127\.0\.0\.1/i.test(appOrigin)) {
    return `${appOrigin}/images/whatsapp-lifecycle-header.jpg`;
  }
  // Local CRM still uses the production-hosted header so Meta can download it.
  if (isHttpsUrl(productionFallback)) {
    return productionFallback;
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
