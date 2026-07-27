/** Fire-and-forget POST to /api/lifecycle/sync-sale. Never throws. Safe for browser + node. */
export function notifyLifecycleSaleSync(saleId: string): void {
  if (!saleId) return;
  try {
    const base =
      typeof window === 'undefined'
        ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
        : '';
    const url = `${base}/api/lifecycle/sync-sale`;
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ saleId }),
      keepalive: typeof window !== 'undefined',
    }).catch((err) => {
      console.warn('[notifyLifecycleSaleSync] failed', err);
    });
  } catch (err) {
    console.warn('[notifyLifecycleSaleSync] threw', err);
  }
}
