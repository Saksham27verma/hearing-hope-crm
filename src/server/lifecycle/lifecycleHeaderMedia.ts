import { readFile } from 'fs/promises';
import path from 'path';
import { pinnacleConfig } from '@/server/invoices/pinnacleSend';
import { ensureLifecycleHeaderImageUrl } from '@/server/lifecycle/ensureLifecycleHeaderImageUrl';

type HeaderMedia =
  | { kind: 'id'; id: string }
  | { kind: 'link'; link: string };

let cachedMediaId: { id: string; expiresAt: number } | null = null;
const MEDIA_CACHE_MS = 24 * 60 * 60 * 1000; // WhatsApp media ids typically last ~30 days; refresh daily

async function uploadHeaderImageToPinnacle(): Promise<string> {
  const { phoneId, apiKey } = pinnacleConfig();
  const localPath = path.join(process.cwd(), 'public', 'images', 'whatsapp-lifecycle-header.jpg');
  const buffer = await readFile(localPath);

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'image/jpeg');
  form.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' }),
    'whatsapp-lifecycle-header.jpg',
  );

  const url = `https://partnersv1.pinbot.ai/v3/${phoneId}/media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: apiKey },
    body: form,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `Pinnacle media upload failed (${res.status}): ${typeof json.error === 'object' ? JSON.stringify(json.error) : text || res.statusText}`,
    );
  }

  const id = String(json.id || '').trim();
  if (!id) {
    throw new Error(`Pinnacle media upload returned no id: ${text.slice(0, 200)}`);
  }
  return id;
}

/**
 * Resolve IMAGE header media for lifecycle templates.
 * Prefer a public HTTPS link (same pattern as invoice PDF document links, which
 * already work with Pinnacle). Fall back to uploading a media id if needed.
 */
export async function resolveLifecycleHeaderMedia(): Promise<HeaderMedia> {
  try {
    const link = await ensureLifecycleHeaderImageUrl();
    return { kind: 'link', link };
  } catch (linkErr) {
    const now = Date.now();
    if (cachedMediaId && cachedMediaId.expiresAt > now) {
      return { kind: 'id', id: cachedMediaId.id };
    }
    try {
      const id = await uploadHeaderImageToPinnacle();
      cachedMediaId = { id, expiresAt: now + MEDIA_CACHE_MS };
      return { kind: 'id', id };
    } catch (uploadErr) {
      const linkMsg = linkErr instanceof Error ? linkErr.message : 'Header image URL failed';
      const uploadMsg = uploadErr instanceof Error ? uploadErr.message : 'Media upload failed';
      throw new Error(
        `${linkMsg}. Media upload also failed: ${uploadMsg}. Set PINNACLE_LIFECYCLE_HEADER_IMAGE_URL to a public https JPG/PNG.`,
      );
    }
  }
}

export function headerImageParameter(media: HeaderMedia): Record<string, unknown> {
  if (media.kind === 'id') {
    return { type: 'image', image: { id: media.id } };
  }
  return { type: 'image', image: { link: media.link } };
}
