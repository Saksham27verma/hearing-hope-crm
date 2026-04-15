/**
 * Opens app routes in a separate browser tab without giving the new tab access
 * to the originating tab.
 */
export function openInNewTab(path: string) {
  if (typeof window === 'undefined') return;
  const href = new URL(path, window.location.origin).toString();

  // Anchor click is more reliable than window.open for avoiding same-tab side effects
  // in some browsers / UI containers.
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Detail/profile and edit pages that should default to a new tab. */
export function isDetailOrEditPath(path: string): boolean {
  return /^\/interaction\/enquiries\/(?:edit\/)?[^/]+(?:$|[?#])/.test(path);
}
