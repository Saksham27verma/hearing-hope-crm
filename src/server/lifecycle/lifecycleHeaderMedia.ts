import { pinnacleConfig } from '@/server/invoices/pinnacleSend';
import { ensureLifecycleHeaderImageUrl } from '@/server/lifecycle/ensureLifecycleHeaderImageUrl';

type HeaderMedia =
  | { kind: 'id'; id: string }
  | { kind: 'link'; link: string };

/**
 * Resolve IMAGE header media for lifecycle templates.
 * Prefer Firebase-hosted HTTPS link (same as working invoice PDF links).
 * Pinbot partnersv1 /media upload returns Unexpected field, so we do not rely on media ids.
 */
export async function resolveLifecycleHeaderMedia(): Promise<HeaderMedia> {
  const link = await ensureLifecycleHeaderImageUrl();
  return { kind: 'link', link };
}

export function headerImageParameter(media: HeaderMedia): Record<string, unknown> {
  if (media.kind === 'id') {
    return { type: 'image', image: { id: media.id } };
  }
  return { type: 'image', image: { link: media.link } };
}

/** Kept for diagnostics; Pinbot media upload is currently unreliable. */
export async function pingPinnacleConfig(): Promise<{ phoneId: string }> {
  const { phoneId } = pinnacleConfig();
  return { phoneId };
}
