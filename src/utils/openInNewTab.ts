/**
 * Opens app routes in a separate browser tab without giving the new tab access
 * to the originating tab.
 */
export function openInNewTab(path: string) {
  if (typeof window === 'undefined') return;
  window.open(path, '_blank', 'noopener,noreferrer');
}

/** Detail/profile and edit pages that should default to a new tab. */
export function isDetailOrEditPath(path: string): boolean {
  return /^\/interaction\/enquiries\/(?:edit\/)?[^/]+(?:$|[?#])/.test(path);
}
